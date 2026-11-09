import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { tokenMatches } from '../auth.js';
import { ModuleError } from '../emails/errors.js';
import { AnkabotSessionRepository } from './repository.js';
import { sessionIdSchema,registerSessionSchema,sessionFiltersSchema } from './validation.js';

export function registerAnkabotSessionRoutes(app:FastifyInstance,pool:Pool,key:string,operatorToken:string,ankabotToken?:string){
  const repository=new AnkabotSessionRepository(pool,key),path='/api/services/ankabot/sessions';
  const credential=(value:string|string[]|undefined)=>typeof value==='string'?value:undefined;
  app.post(path,async(request,reply)=>{
    if(!tokenMatches(request.headers.authorization,ankabotToken))throw new ModuleError(403,'FORBIDDEN','Use a credencial AnkaBot para registrar uma sessão.');
    reply.header('Cache-Control','no-store');
    return reply.code(201).send(await repository.register(registerSessionSchema.parse(request.body)));
  });
  app.get(path,request=>repository.list(sessionFiltersSchema.parse(request.query)));
  app.get(`${path}/:id`,request=>repository.get(sessionIdSchema.parse(request.params).id));
  app.put(`${path}/:id/heartbeat`,request=>{
    if(!tokenMatches(request.headers.authorization,ankabotToken))throw new ModuleError(403,'FORBIDDEN','Use a credencial AnkaBot para heartbeat.');
    return repository.heartbeat(sessionIdSchema.parse(request.params).id,credential(request.headers['x-ankabot-session-token']),request.body);
  });
  app.put(`${path}/:id/close`,request=>repository.close(sessionIdSchema.parse(request.params).id,
    credential(request.headers['x-ankabot-session-token']),tokenMatches(request.headers.authorization,operatorToken)));
  return repository;
}
