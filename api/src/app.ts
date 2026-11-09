import Fastify from 'fastify';
import { createPool } from './database.js';
import type { Config } from './config.js';
import { tokenMatches } from './auth.js';
import { ZodError } from 'zod';
import { ModuleError } from './emails/errors.js';
import { registerEmailRoutes } from './email-routes.js';
import { registerAccountRoutes } from './accounts.js';
import { registerOperationRoutes } from './operations.js';
import { runMigrations } from './migrations.js';
import { registerAnkabotLicenseRoutes } from './ankabot-licenses/routes.js';
import { registerAnkabotSessionRoutes } from './ankabot-sessions/routes.js';
import { SessionExpirationJob } from './ankabot-sessions/job.js';
import {registerGroupClaimRoute} from './character-groups/claim.js';
import {registerCharacterProgressRoutes} from './character-progress/routes.js';

const readinessTimeoutMs = 5000;

export function buildApp(config: Config) {
  const app = Fastify({
    logger: {
      serializers: {
        req: (request) => ({ method: request.method, path: request.url?.split('?')[0] }),
      },
      redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-ankabot-session-token"]', 'password', 'DATABASE_URL'],
    },
  });
  const pool = createPool(config.databaseUrl);
  pool.on('error', () => app.log.warn('Idle database connection failed.'));
  let sessionJob:SessionExpirationJob|undefined;
  app.addHook('onClose', async () => { await sessionJob?.stop(); await pool.end(); });

  app.setErrorHandler((error,_request,reply)=>{
    if(error instanceof ModuleError)return reply.code(error.statusCode).send({error:{code:error.code,message:error.message}});
    if(error instanceof ZodError)return reply.code(400).send({error:{code:'INVALID_INPUT',message:'Dados inválidos.'}});
    const code=(error as {code?:string}).code;
    if(code==='23505'||code==='23503')return reply.code(409).send({error:{code:'CONFLICT',message:'Registro duplicado ou vínculo inválido.'}});
    if((error as {statusCode?:number}).statusCode===400)return reply.code(400).send({error:{code:'INVALID_INPUT',message:'Requisição inválida.'}});
    return reply.code(503).send({error:{code:'UNAVAILABLE',message:'Serviço temporariamente indisponível.'}});
  });
  app.addHook('onRequest',async(request,reply)=>{
    if(!request.url.startsWith('/api/'))return;
    if(tokenMatches(request.headers.authorization,config.operatorToken))return;
    if(tokenMatches(request.headers.authorization,config.ankabotToken)){
      const path=request.url.split('?')[0]!;
      if((request.method==='POST'&&path==='/api/services/ankabot/sessions') ||
        ((request.method==='GET'||request.method==='POST')&&/^\/api\/services\/ankabot\/sessions\/[^/]+\/characters\/[^/]+\/progress$/.test(path)) ||
        (request.method==='POST'&&/^\/api\/services\/ankabot\/sessions\/[^/]+\/claim-groups$/.test(path)) ||
        (request.method==='PUT'&&/^\/api\/services\/ankabot\/sessions\/[^/]+\/(heartbeat|close)$/.test(path)))return;
      if((request.method==='GET'&& /^\/api\/characters(?:\/[0-9a-f-]+)?$/.test(path)) || (request.method==='PATCH'&&/^\/api\/characters\/[0-9a-f-]+\/status$/.test(path)))return;
      return reply.code(403).send({error:{code:'FORBIDDEN',message:'Acesso não permitido.'}});
    }
    return reply.code(401).send({error:{code:'UNAUTHORIZED',message:'Credencial inválida.'}});
  });
  if(config.encryptionKey && config.operatorToken){
    app.addHook('onReady',()=>runMigrations(pool));
    registerEmailRoutes(app,pool,config.encryptionKey,config.apiMailToken);
    registerAccountRoutes(app,pool,config.encryptionKey,config.characterOptions);
    registerOperationRoutes(app,pool,config.encryptionKey);
    registerAnkabotLicenseRoutes(app,pool,config.encryptionKey);
    const sessions=registerAnkabotSessionRoutes(app,pool,config.encryptionKey,config.operatorToken,config.ankabotToken);
    registerGroupClaimRoute(app,pool,config.encryptionKey,config.ankabotToken);
    registerCharacterProgressRoutes(app,pool,config.encryptionKey,config.ankabotToken);
    sessionJob=new SessionExpirationJob(()=>sessions.expire(),config.ankabotSessionExpirationIntervalMs??60000,
      count=>{if(count)app.log.info({expiredCount:count},'AnkaBot sessions expired.');},
      ()=>app.log.warn('AnkaBot session expiration failed; it will retry.'));
    app.addHook('onReady',()=>sessionJob!.start());
  }
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/ready', async (_request, reply) => {
    let timer: NodeJS.Timeout | undefined;
    try {
      // One deadline covers both acquiring a connection and executing the query.
      await Promise.race([
        pool.query('SELECT 1'),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Readiness timeout')), readinessTimeoutMs);
        }),
      ]);
      return { status: 'ok' };
    } catch {
      app.log.warn('Database readiness check failed.');
      return reply.code(503).send({ status: 'unavailable' });
    } finally {
      clearTimeout(timer);
    }
  });
  return app;
}
