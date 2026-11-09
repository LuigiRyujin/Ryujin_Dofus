import type {FastifyInstance} from 'fastify';
import type {Pool} from 'pg';
import {z} from 'zod';
import {tokenMatches} from '../auth.js';
import {ModuleError} from '../emails/errors.js';
import {CharacterProgressService} from './service.js';

export function registerCharacterProgressRoutes(app:FastifyInstance,pool:Pool,key:string,ankabotToken?:string){
  const service=new CharacterProgressService(pool,key),path='/api/services/ankabot/sessions/:sessionId/characters/:characterId/progress';
  for(const method of ['GET','POST'] as const)app.route({method,url:path,handler:(request,reply)=>{
    reply.header('Cache-Control','no-store');
    if(!tokenMatches(request.headers.authorization,ankabotToken))throw new ModuleError(403,'FORBIDDEN','Use a credencial AnkaBot para progresso.');
    const {sessionId,characterId}=z.object({sessionId:z.uuid(),characterId:z.uuid()}).parse(request.params);
    const value=request.headers['x-ankabot-session-token'],token=typeof value==='string'?value:undefined;
    return method==='GET'?service.get(sessionId,characterId,token):service.update(sessionId,characterId,token,request.body);
  }});
}
