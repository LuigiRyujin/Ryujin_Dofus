import { randomUUID } from 'node:crypto';
import type { Pool,PoolClient } from 'pg';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ModuleError } from '../emails/errors.js';
import { tokenMatches } from '../auth.js';
import { sessionCredentialMatches } from '../ankabot-sessions/credentials.js';
import { AnkabotSessionRepository } from '../ankabot-sessions/repository.js';
import { lockSessionAllocation,licenseUsage } from './allocation.js';
import { CharacterGroupRepository } from './repository.js';
import { CharacterGroupService } from './service.js';
import {progressJsonSql} from '../character-progress/repository.js';

export const claimGroupsSchema=z.object({serverId:z.number().int().positive().max(2147483647),idempotencyKey:z.uuid()}).strict();
type Candidate={id:string;ankama_id:string;breed_id:number;server_id:number;status:string;completed_at:Date|null;account_status:string;created_at:Date};
const recoveryEligibleSql=`g.status='abandoned' AND EXISTS (
  SELECT 1 FROM group_members m JOIN characters ch ON ch.id=m.character_id JOIN ankama_accounts a ON a.id=ch.ankama_id
  WHERE m.group_id=g.id AND m.removed_at IS NULL GROUP BY m.group_id
  HAVING count(*)=3 AND count(DISTINCT ch.breed_id)=3 AND count(DISTINCT ch.ankama_id)=3
    AND count(*) FILTER(WHERE ch.completed_at IS NULL)>0
    AND bool_and(ch.server_id=$1 AND ch.status IN ('C','E','P') AND a.status<>'B' AND m.released_at IS NULL))`;

export function oldestTrio(candidates:Candidate[]):Candidate[]|null{
  for(let a=0;a<candidates.length;a++)for(let b=a+1;b<candidates.length;b++){
    const first=candidates[a]!,second=candidates[b]!;
    if(first.breed_id===second.breed_id||first.ankama_id===second.ankama_id)continue;
    for(let d=b+1;d<candidates.length;d++){
      const third=candidates[d]!;
      if(third.breed_id!==first.breed_id&&third.breed_id!==second.breed_id&&third.ankama_id!==first.ankama_id&&third.ankama_id!==second.ankama_id)
        return [first,second,third];
    }
  }return null;
}

export class GroupClaimService {
  private readonly repository:CharacterGroupRepository;
  private readonly groups:CharacterGroupService;
  private readonly sessions:AnkabotSessionRepository;
  constructor(private readonly pool:Pool,key:string){
    this.repository=new CharacterGroupRepository(pool);this.groups=new CharacterGroupService(this.repository);
    this.sessions=new AnkabotSessionRepository(pool,key);
  }
  private async authenticate(sessionId:string,token:string|undefined,c?:PoolClient){
    const row=(await (c??this.pool).query('SELECT credential_hash FROM ankabot_sessions WHERE id=$1',[sessionId])).rows[0];
    if(!row)throw new ModuleError(404,'SESSION_NOT_FOUND','Sessão não encontrada.');
    if(!sessionCredentialMatches(token,row.credential_hash))throw new ModuleError(403,'SESSION_FORBIDDEN','Credencial de sessão inválida.');
  }
  private async assertActive(c:PoolClient,id:string){
    const result=await c.query("SELECT id FROM ankabot_sessions WHERE id=$1 AND status='active' AND last_heartbeat_at>=statement_timestamp()-INTERVAL '15 minutes'",[id]);
    if(!result.rowCount)throw new ModuleError(409,'SESSION_INACTIVE','A sessão não está ativa.');
  }
  private async currentGroups(c:PoolClient,id:string){
    return (await c.query(`SELECT g.id,g.status,g.session_slot AS "sessionSlot",g.assignment_id AS "assignmentId",
      (SELECT json_agg(x ORDER BY x.id) FROM (
        SELECT c.id,c.ankama_id AS "ankamaId",c.name,c.breed_id AS "breedId",c.server_id AS "serverId",c.status,c.completed_at AS "completedAt",${progressJsonSql} AS progress
        FROM group_members m JOIN characters c ON c.id=m.character_id LEFT JOIN character_progress p ON p.character_id=c.id WHERE m.group_id=g.id AND m.removed_at IS NULL
      ) x) AS members FROM character_groups g WHERE g.session_id=$1 AND g.status='active' ORDER BY g.session_slot`,[id])).rows;
  }
  async claim(sessionId:string,token:string|undefined,input:unknown){
    z.uuid().parse(sessionId);const request=claimGroupsSchema.parse(input);
    await this.authenticate(sessionId,token);
    // Cleanup is committed independently and remains effective if allocation subsequently fails.
    await this.sessions.expire();
    try{return await this.repository.transaction(async c=>{
      const session=await lockSessionAllocation(c,sessionId);
      await this.authenticate(sessionId,token,c);await this.assertActive(c,sessionId);
      const previous=(await c.query('SELECT server_id,response FROM group_claims WHERE session_id=$1 AND idempotency_key=$2',[sessionId,request.idempotencyKey])).rows[0];
      if(previous){
        if(previous.server_id!==request.serverId)throw new ModuleError(409,'CLAIM_KEY_CONFLICT','Chave já utilizada com outro servidor.');
        const current=await this.currentGroups(c,sessionId);
        if(previous.response.groups.some((old:{id:string;assignmentId:string})=>!current.some(g=>g.id===old.id&&g.assignmentId===old.assignmentId)))
          throw new ModuleError(409,'CLAIM_STALE','As atribuições deste claim foram liberadas. Use uma nova chave.');
        await this.assertActive(c,sessionId);return previous.response;
      }
      const existing=await this.currentGroups(c,sessionId);
      if(existing.some(g=>g.members.some((m:{serverId:number})=>m.serverId!==request.serverId)))throw new ModuleError(409,'SESSION_SERVER_CONFLICT','A sessão já controla grupos de outro servidor.');
      const license=(await c.query('SELECT max_characters FROM ankabot_licenses WHERE id=$1',[session.ankabot_license_id])).rows[0];
      let free=Math.max(0,Math.min(3-existing.length,Math.floor((license.max_characters-await licenseUsage(c,session.ankabot_license_id))/3)));
      const assigned:string[]=[];let recoveryBusy=false;
      if(free){
        // Lock only the needed eligible groups, leaving the remaining pool available to other licenses.
        const abandoned=(await c.query(`SELECT g.id FROM character_groups g WHERE ${recoveryEligibleSql}
          ORDER BY g.created_at,g.id LIMIT $2 FOR UPDATE OF g SKIP LOCKED`,[request.serverId,free])).rows.map(g=>g.id);
        const memberships=(await c.query('SELECT group_id,character_id,released_at FROM group_members WHERE group_id=ANY($1::uuid[]) AND removed_at IS NULL',[abandoned])).rows;
        const recoveredIds=memberships.map(m=>m.character_id);
        const availablePredicate=`(c.id=ANY($2::uuid[]) OR (c.server_id=$1 AND c.status='C' AND c.completed_at IS NULL AND NOT EXISTS
          (SELECT 1 FROM group_members m WHERE m.character_id=c.id AND m.released_at IS NULL)))`;
        const accounts=(await c.query(`SELECT a.id FROM ankama_accounts a WHERE a.id IN
          (SELECT c.ankama_id FROM characters c WHERE ${availablePredicate}) ORDER BY a.id FOR UPDATE OF a SKIP LOCKED`,[request.serverId,recoveredIds])).rows.map(a=>a.id);
        const candidates=(await c.query<Candidate>(`SELECT c.*,(SELECT status FROM ankama_accounts WHERE id=c.ankama_id) AS account_status
          FROM characters c WHERE ${availablePredicate} AND c.ankama_id=ANY($3::uuid[]) ORDER BY c.id FOR UPDATE OF c SKIP LOCKED`,[request.serverId,recoveredIds,accounts])).rows;
        const byId=new Map(candidates.map(ch=>[ch.id,ch]));
        for(const groupId of abandoned){
          if(!free)break;
          const members=memberships.filter(m=>m.group_id===groupId);
          const chars=members.map(m=>byId.get(m.character_id));
          if(members.length!==3||members.some(m=>m.released_at)||chars.some(ch=>!ch||ch.server_id!==request.serverId||!['C','E','P'].includes(ch.status)||ch.account_status==='B')||chars.every(ch=>ch?.completed_at))continue;
          const complete=chars as Candidate[];
          if(new Set(complete.map(ch=>ch.breed_id)).size!==3||new Set(complete.map(ch=>ch.ankama_id)).size!==3)continue;
          await this.groups.activateInTransaction(c,groupId,sessionId,'abandoned');assigned.push(groupId);free--;
        }
        // Do not create fresh groups while eligible recovery work is temporarily held by another transaction.
        if(free)recoveryBusy=(await c.query(`SELECT EXISTS(SELECT 1 FROM character_groups g WHERE ${recoveryEligibleSql}) AS busy`,[request.serverId])).rows[0].busy;
        // Recheck reservations after recovery, on the same transaction snapshot, before creating groups.
        const reserved=new Set((await c.query('SELECT character_id FROM group_members WHERE character_id=ANY($1::uuid[]) AND released_at IS NULL',[candidates.map(ch=>ch.id)])).rows.map(m=>m.character_id));
        let available=candidates.filter(ch=>ch.server_id===request.serverId&&ch.status==='C'&&!ch.completed_at&&ch.account_status!=='B'&&!reserved.has(ch.id))
          .sort((a,b)=>a.created_at.getTime()-b.created_at.getTime()||a.id.localeCompare(b.id));
        while(free&&!recoveryBusy){
          const trio=oldestTrio(available);if(!trio)break;
          const ids=trio.map(ch=>ch.id),id=await this.groups.createInTransaction(c,ids);
          await this.groups.activateInTransaction(c,id,sessionId,'forming');assigned.push(id);free--;
          const used=new Set(ids);available=available.filter(ch=>!used.has(ch.id));
        }
      }
      const groups=await this.currentGroups(c,sessionId);
      const licenseUsed=await licenseUsage(c,session.ankabot_license_id);
      const reason=groups.length===3?'SESSION_FULL':license.max_characters-licenseUsed<3?'LICENSE_CAPACITY':recoveryBusy?'RECOVERY_BUSY':'NO_ELIGIBLE_TRIO';
      const response={sessionId,serverId:request.serverId,groups,newlyAssignedGroupIds:assigned,
        capacity:{sessionGroups:groups.length,sessionCharacters:groups.length*3,sessionMaxGroups:3,sessionMaxCharacters:9,
          licenseCharacters:licenseUsed,licenseMaxCharacters:license.max_characters},reason};
      await c.query('INSERT INTO group_claims(id,session_id,idempotency_key,server_id,response) VALUES($1,$2,$3,$4,$5)',[randomUUID(),sessionId,request.idempotencyKey,request.serverId,JSON.stringify(response)]);
      // Force deferred group checks before the final temporal validation.
      await c.query('SET CONSTRAINTS ALL IMMEDIATE');await this.assertActive(c,sessionId);
      return response;
    });}catch(error){
      if(error instanceof ModuleError&&error.code==='SESSION_INACTIVE')await this.sessions.expire();
      throw error;
    }
  }
}

export function registerGroupClaimRoute(app:FastifyInstance,pool:Pool,key:string,ankabotToken?:string){
  const service=new GroupClaimService(pool,key);
  app.post('/api/services/ankabot/sessions/:id/claim-groups',async(request,reply)=>{
    if(!tokenMatches(request.headers.authorization,ankabotToken))throw new ModuleError(403,'FORBIDDEN','Use a credencial AnkaBot para solicitar grupos.');
    const id=z.object({id:z.uuid()}).parse(request.params).id;
    const token=request.headers['x-ankabot-session-token'];reply.header('Cache-Control','no-store');
    return service.claim(id,typeof token==='string'?token:undefined,request.body);
  });
}
