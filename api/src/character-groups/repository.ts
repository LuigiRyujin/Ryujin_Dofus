import { randomUUID } from 'node:crypto';
import type { Pool,PoolClient } from 'pg';
import { ModuleError } from '../emails/errors.js';
import type { GroupFilters,GroupStatus } from './types.js';
import {lockSessionAllocation,assertLicenseCapacity} from './allocation.js';
import {lockTopology} from '../topology.js';

export interface GroupRow {id:string;sessionId:string|null;sessionSlot:number|null;status:GroupStatus;completedAt:Date|null}
export interface MemberRow {id:string;ankamaId:string;breedId:number;serverId:number;status:string;completedAt:Date|null;accountStatus:string;lifecycleStatus:string}
const fields='id,session_id AS "sessionId",session_slot AS "sessionSlot",status,created_at AS "createdAt",updated_at AS "updatedAt",completed_at AS "completedAt"';
export class CharacterGroupRepository {
  constructor(private readonly pool:Pool){}
  async transaction<T>(run:(client:PoolClient)=>Promise<T>):Promise<T>{
    const client=await this.pool.connect();
    try{await client.query('BEGIN');await lockTopology(client);const result=await run(client);await client.query('COMMIT');return result;}
    catch(error){await client.query('ROLLBACK');
      const code=(error as {code?:string}).code;
      if(code==='23505')throw new ModuleError(409,'GROUP_CONFLICT','Personagem reservado ou capacidade da sessão esgotada.');
      if(code==='23514')throw new ModuleError(409,'GROUP_INTEGRITY','A operação viola a integridade do grupo.');
      throw error;
    }finally{client.release();}
  }
  async lockGroup(c:PoolClient,id:string):Promise<GroupRow>{
    const row=(await c.query<GroupRow>(`SELECT ${fields} FROM character_groups WHERE id=$1 FOR UPDATE`,[id])).rows[0];
    if(!row)throw new ModuleError(404,'GROUP_NOT_FOUND','Grupo não encontrado.');return row;
  }
  async currentSession(c:PoolClient,id:string):Promise<string|null>{
    return (await c.query('SELECT session_id FROM character_groups WHERE id=$1',[id])).rows[0]?.session_id??null;
  }
  async lockSession(c:PoolClient,id:string,requireActive=true){
    await lockSessionAllocation(c,id);
    if(!requireActive)return;
    // Separate statement after lock acquisition avoids using a stale pre-lock timestamp.
    const active=await c.query("SELECT id FROM ankabot_sessions WHERE id=$1 AND status='active' AND last_heartbeat_at>=statement_timestamp()-INTERVAL '15 minutes'",[id]);
    if(!active.rowCount)throw new ModuleError(409,'SESSION_INACTIVE','A sessão não está ativa.');
  }
  async lockCharacters(c:PoolClient,ids:string[]):Promise<MemberRow[]>{
    await c.query('SELECT id FROM ankama_accounts WHERE id IN (SELECT ankama_id FROM characters WHERE id=ANY($1::uuid[])) ORDER BY id FOR UPDATE',[ids]);
    return (await c.query<MemberRow>(`SELECT c.id,c.ankama_id AS "ankamaId",c.breed_id AS "breedId",c.server_id AS "serverId",
      c.status,c.lifecycle_status AS "lifecycleStatus",c.completed_at AS "completedAt",(SELECT status FROM ankama_accounts WHERE id=c.ankama_id) AS "accountStatus"
      FROM characters c WHERE c.id=ANY($1::uuid[]) ORDER BY c.id FOR UPDATE`,[ids])).rows;
  }
  async memberIds(c:PoolClient,id:string):Promise<string[]>{
    return (await c.query('SELECT character_id FROM group_members WHERE group_id=$1 AND removed_at IS NULL ORDER BY character_id',[id])).rows.map(row=>row.character_id);
  }
  async assertReservations(c:PoolClient,groupId:string,ids:string[]){
    const conflict=await c.query('SELECT character_id FROM group_members WHERE character_id=ANY($1::uuid[]) AND released_at IS NULL AND group_id<>$2',[ids,groupId]);
    if(conflict.rowCount)throw new ModuleError(409,'CHARACTER_RESERVED','Um personagem já pertence a outro grupo.');
  }
  async insertGroup(c:PoolClient,id:string){await c.query('INSERT INTO character_groups(id) VALUES($1)',[id]);}
  async addMember(c:PoolClient,id:string,characterId:string){
    await c.query(`INSERT INTO group_members(group_id,character_id) VALUES($1,$2)
      ON CONFLICT(group_id,character_id) DO UPDATE SET removed_at=NULL,released_at=NULL,joined_at=statement_timestamp()`,[id,characterId]);
    await c.query('UPDATE character_groups SET updated_at=statement_timestamp() WHERE id=$1',[id]);
  }
  async removeMember(c:PoolClient,id:string,characterId:string){
    const result=await c.query('UPDATE group_members SET removed_at=statement_timestamp(),released_at=statement_timestamp() WHERE group_id=$1 AND character_id=$2 AND removed_at IS NULL RETURNING character_id',[id,characterId]);
    if(!result.rowCount)throw new ModuleError(404,'MEMBER_NOT_FOUND','Integrante não encontrado.');
    await c.query('UPDATE character_groups SET updated_at=statement_timestamp() WHERE id=$1',[id]);
  }
  async availableSlot(c:PoolClient,sessionId:string):Promise<number>{
    const used=(await c.query("SELECT session_slot FROM character_groups WHERE session_id=$1 AND status='active'",[sessionId])).rows.map(row=>row.session_slot);
    const slot=[1,2,3].find(value=>!used.includes(value));
    if(!slot)throw new ModuleError(409,'SESSION_GROUP_LIMIT','A sessão já controla três grupos.');return slot;
  }
  async setState(c:PoolClient,id:string,status:GroupStatus,sessionId:string|null=null,slot:number|null=null){
    if(status==='active'&&sessionId)await assertLicenseCapacity(c,sessionId);
    await c.query(`UPDATE character_groups SET status=$2,session_id=$3,session_slot=$4,updated_at=statement_timestamp(),
      assignment_id=CASE WHEN $2='active' THEN gen_random_uuid() ELSE NULL END,
      completed_at=CASE WHEN $2='completed' THEN statement_timestamp() ELSE completed_at END WHERE id=$1`,[id,status,sessionId,slot]);
    if(status==='completed'){
      await c.query(`UPDATE characters SET completed_at=COALESCE(characters.completed_at,g.completed_at),
        updated_at=CASE WHEN characters.completed_at IS NULL THEN g.completed_at ELSE characters.updated_at END
        FROM group_members m,character_groups g WHERE g.id=$1 AND m.group_id=g.id AND m.removed_at IS NULL AND characters.id=m.character_id`,[id]);
      await c.query('UPDATE group_members SET released_at=(SELECT completed_at FROM character_groups WHERE id=$1) WHERE group_id=$1 AND removed_at IS NULL',[id]);
    }
  }
  async event(c:PoolClient,id:string,type:string,from:GroupStatus|null,to:GroupStatus,fromSession:string|null=null,toSession:string|null=null,characterId:string|null=null){
    await c.query(`INSERT INTO group_events(id,group_id,event_type,from_status,to_status,from_session_id,to_session_id,character_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[randomUUID(),id,type,from,to,fromSession,toSession,characterId]);
  }
  async get(id:string){
    const row=(await this.pool.query(`SELECT ${fields},
      COALESCE((SELECT json_agg(m ORDER BY m."characterId") FROM
        (SELECT character_id AS "characterId",joined_at AS "joinedAt",released_at AS "releasedAt" FROM group_members WHERE group_id=g.id AND removed_at IS NULL) m),'[]'::json) AS members
      FROM character_groups g WHERE id=$1`,[id])).rows[0];
    if(!row)throw new ModuleError(404,'GROUP_NOT_FOUND','Grupo não encontrado.');return row;
  }
  async events(id:string){await this.get(id);return (await this.pool.query(`SELECT id,event_type AS type,character_id AS "characterId",from_status AS "fromStatus",to_status AS "toStatus",
    from_session_id AS "fromSessionId",to_session_id AS "toSessionId",created_at AS "createdAt" FROM group_events WHERE group_id=$1 ORDER BY created_at,id`,[id])).rows;}
  async list(filters:GroupFilters){
    const result=await this.pool.query(`WITH groups AS (SELECT ${fields} FROM character_groups WHERE ($1::text IS NULL OR status=$1) AND ($2::uuid IS NULL OR session_id=$2))
      SELECT (SELECT count(*) FROM groups) AS total,COALESCE((SELECT json_agg(p) FROM
      (SELECT * FROM groups ORDER BY "createdAt" DESC,id LIMIT $3 OFFSET $4) p),'[]'::json) AS items`,[filters.status??null,filters.sessionId??null,filters.pageSize,(filters.page-1)*filters.pageSize]);
    return {...result.rows[0],total:Number(result.rows[0].total),page:filters.page,pageSize:filters.pageSize};
  }
}
