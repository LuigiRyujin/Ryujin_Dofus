import type {Pool,PoolClient} from 'pg';
import {ModuleError} from '../emails/errors.js';
import {lockSessionAllocation} from '../character-groups/allocation.js';
import {CharacterGroupRepository} from '../character-groups/repository.js';
import {CharacterGroupService} from '../character-groups/service.js';
import {AnkabotSessionRepository} from '../ankabot-sessions/repository.js';
import {sessionCredentialMatches} from '../ankabot-sessions/credentials.js';
import {CharacterProgressRepository} from './repository.js';
import {progressSchema,progressFingerprint,progressUuidSchema} from './validation.js';

export class CharacterProgressService {
  private readonly groups:CharacterGroupRepository;
  private readonly domain:CharacterGroupService;
  private readonly sessions:AnkabotSessionRepository;
  private readonly progress=new CharacterProgressRepository();
  constructor(pool:Pool,key:string){this.groups=new CharacterGroupRepository(pool);this.domain=new CharacterGroupService(this.groups);this.sessions=new AnkabotSessionRepository(pool,key);}
  private async assertActive(c:PoolClient,id:string){
    const live=await c.query("SELECT id FROM ankabot_sessions WHERE id=$1 AND status='active' AND last_heartbeat_at>=statement_timestamp()-INTERVAL '15 minutes'",[id]);
    if(!live.rowCount)throw new ModuleError(409,'SESSION_INACTIVE','A sessão não está ativa.');
  }
  private async authorized<T>(sessionId:string,token:string|undefined,run:(c:PoolClient)=>Promise<T>):Promise<T>{
    sessionId=progressUuidSchema.parse(sessionId);
    try{return await this.groups.transaction(async c=>{
      const session=await lockSessionAllocation(c,sessionId);
      if(!sessionCredentialMatches(token,session.credential_hash))throw new ModuleError(403,'SESSION_FORBIDDEN','Credencial de sessão inválida.');
      await this.assertActive(c,sessionId);
      const result=await run(c);await c.query('SET CONSTRAINTS ALL IMMEDIATE');await this.assertActive(c,sessionId);return result;
    });}catch(error){if(error instanceof ModuleError&&error.code==='SESSION_INACTIVE')await this.sessions.expire();throw error;}
  }
  get(sessionId:string,characterId:string,token:string|undefined){
    sessionId=progressUuidSchema.parse(sessionId);characterId=progressUuidSchema.parse(characterId);
    return this.authorized(sessionId,token,async c=>{
      const group=await this.progress.assignedGroup(c,sessionId,characterId);
      return {schemaVersion:1,groupId:group.id,assignmentId:group.assignment_id,progress:await this.progress.read(c,characterId)};
    });
  }
  update(sessionId:string,characterId:string,token:string|undefined,body:unknown){
    sessionId=progressUuidSchema.parse(sessionId);characterId=progressUuidSchema.parse(characterId);
    const input=progressSchema.parse(body),fingerprint=progressFingerprint(characterId,input);
    return this.authorized(sessionId,token,async c=>{
      const previous=await this.progress.previousUpdate(c,sessionId,input.updateId);
      if(previous){
        if(previous.character_id!==characterId||previous.payload_fingerprint!==fingerprint)
          throw new ModuleError(409,'PROGRESS_UPDATE_CONFLICT','ID de atualização já utilizado com outro conteúdo.');
        return {...previous.response,replayed:true};
      }
      const group=await this.progress.assignedGroup(c,sessionId,characterId);
      if(group.assignment_id!==input.assignmentId)throw new ModuleError(409,'ASSIGNMENT_STALE','A atribuição mudou. Consulte o progresso atual.');
      const ids=await this.groups.memberIds(c,group.id),members=await this.groups.lockCharacters(c,ids);
      const character=members.find(m=>m.id===characterId);
      if(!character)throw new ModuleError(403,'CHARACTER_NOT_ASSIGNED','Personagem não pertence à sessão.');
      if(character.completedAt)throw new ModuleError(409,'CHARACTER_COMPLETED','O fluxo do personagem já foi concluído.');
      if(character.status==='B')throw new ModuleError(409,'CHARACTER_UNAVAILABLE','Personagem indisponível para progresso.');
      await this.progress.save(c,sessionId,group.id,characterId,input);
      const completed=await this.domain.completeIfAllMembersFinished(c,group.id,sessionId);
      const result={schemaVersion:1,progress:await this.progress.read(c,characterId),
        group:{id:group.id,status:completed?'completed':'active',capacityReleased:completed},replayed:false};
      await this.progress.recordUpdate(c,sessionId,group.id,characterId,input,fingerprint,result);return result;
    });
  }
}
