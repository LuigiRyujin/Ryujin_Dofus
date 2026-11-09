import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { ModuleError } from '../emails/errors.js';
import { fingerprintApiKey } from '../ankabot-licenses/credentials.js';
import { createSessionCredential, sessionCredentialMatches } from './credentials.js';
import type { RegisterSession, SessionFilters } from './validation.js';
import {lockSessionAllocation} from '../character-groups/allocation.js';
import {finalizeSession} from './lifecycle.js';
import {heartbeatBodySchema,heartbeatReportSchema} from '../character-progress/validation.js';
import type {HeartbeatReport} from '../character-progress/validation.js';
import {synchronizeCharacters} from './sync.js';
import {lockTopology} from '../topology.js';

// Shared by mutations, effective reads and tests. Strict inequality preserves the exact boundary.
export const sessionExpiredSql="last_heartbeat_at < statement_timestamp() - INTERVAL '15 minutes'";
const effectiveStatus=`CASE WHEN status='active' AND ${sessionExpiredSql} THEN 'expired' ELSE status END`;
const columns=`id,ankabot_license_id AS "licenseId",hostname,pid::double precision AS pid,
  ${effectiveStatus} AS status,last_heartbeat_at AS "lastHeartbeatAt",created_at AS "createdAt",
  CASE WHEN status='active' AND ${sessionExpiredSql} THEN last_heartbeat_at+INTERVAL '15 minutes' ELSE ended_at END AS "endedAt"`;

export class AnkabotSessionRepository {
  constructor(private readonly pool:Pool,private readonly key:string){}

  private async transaction<T>(run:(client:PoolClient)=>Promise<T>):Promise<T>{
    const client=await this.pool.connect();
    try{await client.query('BEGIN');await lockTopology(client);const result=await run(client);await client.query('COMMIT');return result;}
    catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }

  async register(input:RegisterSession){
    return this.transaction(async client=>{
      const license=(await client.query('SELECT id FROM ankabot_licenses WHERE api_key_fingerprint=$1 FOR UPDATE',
        [fingerprintApiKey(input.apiKey,this.key)])).rows[0];
      if(!license)throw new ModuleError(401,'INVALID_LICENSE','Credencial de licença inválida.');
      const identity=[license.id,input.hostname,input.pid];
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify(identity)]);
      const previous=await client.query(`SELECT id FROM ankabot_sessions WHERE ankabot_license_id=$1 AND hostname=$2 AND pid=$3 AND status='active' ORDER BY id FOR UPDATE`,identity);
      for(const row of previous.rows)await finalizeSession(client,row.id);
      const duplicate=await client.query("SELECT id FROM ankabot_sessions WHERE ankabot_license_id=$1 AND hostname=$2 AND pid=$3 AND status='active'",identity);
      if(duplicate.rowCount)throw new ModuleError(409,'SESSION_DUPLICATE','Esta execução já possui uma sessão ativa.');
      const credential=createSessionCredential();
      const result=await client.query(`INSERT INTO ankabot_sessions(id,ankabot_license_id,hostname,pid,credential_hash)
        VALUES($1,$2,$3,$4,$5) RETURNING ${columns}`,[randomUUID(),...identity,credential.hash]);
      return {...result.rows[0],sessionToken:credential.token};
    });
  }

  async get(id:string){
    const result=await this.pool.query(`SELECT ${columns},(SELECT report||jsonb_build_object('receivedAt',to_char(received_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) FROM session_sync_state WHERE session_id=ankabot_sessions.id) AS sync FROM ankabot_sessions WHERE id=$1`,[id]);
    if(!result.rows[0])throw new ModuleError(404,'SESSION_NOT_FOUND','Sessão não encontrada.');
    return result.rows[0];
  }

  async list(filters:SessionFilters){
    const result=await this.pool.query(`WITH sessions AS (SELECT ${columns} FROM ankabot_sessions),
      filtered AS (SELECT * FROM sessions WHERE ($1::uuid IS NULL OR "licenseId"=$1) AND ($2::text IS NULL OR status=$2))
      SELECT (SELECT count(*) FROM filtered) AS total,
      COALESCE((SELECT json_agg(page) FROM (SELECT * FROM filtered ORDER BY "createdAt" DESC,id LIMIT $3 OFFSET $4) page),'[]'::json) AS items`,
      [filters.licenseId??null,filters.status??null,filters.pageSize,(filters.page-1)*filters.pageSize]);
    return {...result.rows[0],total:Number(result.rows[0].total),page:filters.page,pageSize:filters.pageSize};
  }

  private async mutate(id:string,token:string|undefined,close:boolean,operator:boolean,report?:HeartbeatReport){
    let result;
    try{result=await this.transaction(async client=>{
      const row=await lockSessionAllocation(client,id);
      if(!operator&&!sessionCredentialMatches(token,row.credential_hash))throw new ModuleError(403,'SESSION_FORBIDDEN','Credencial de sessão inválida.');
      await finalizeSession(client,id,close);
      if(!close) await client.query(`UPDATE ankabot_sessions SET last_heartbeat_at=statement_timestamp()
        WHERE id=$1 AND status='active' AND NOT (${sessionExpiredSql})`,[id]);
      if(!close)await finalizeSession(client,id);
      let sync:unknown;
      if(report){
        const state=(await client.query('SELECT status FROM ankabot_sessions WHERE id=$1',[id])).rows[0];
        if(state.status==='active')sync=await synchronizeCharacters(client,id,report);
        await client.query('SET CONSTRAINTS ALL IMMEDIATE');
        const live=await client.query(`SELECT id FROM ankabot_sessions WHERE id=$1 AND status='active' AND NOT (${sessionExpiredSql})`,[id]);
        if(!live.rowCount)throw new ModuleError(409,'SESSION_INACTIVE','Sessão expirada durante a sincronização.');
      }
      const response=(await client.query(`SELECT ${columns} FROM ankabot_sessions WHERE id=$1`,[id])).rows[0];
      return sync===undefined?response:{...response,sync};
    });}catch(error){if(error instanceof ModuleError&&error.code==='SESSION_INACTIVE')await this.expire();throw error;}
    // Throw only after commit so logical expiration is not rolled back on a rejected heartbeat.
    if(!close&&result.status!=='active')throw new ModuleError(409,'SESSION_INACTIVE','Sessão encerrada ou expirada. Registre uma nova sessão.');
    return result;
  }
  heartbeat(id:string,token:string|undefined,body?:unknown){
    const parsed=heartbeatBodySchema.parse(body);
    return this.mutate(id,token,false,false,parsed&&Object.keys(parsed).length?heartbeatReportSchema.parse(parsed):undefined);
  }
  close(id:string,token:string|undefined,operator=false){return this.mutate(id,token,true,operator);}
  async expire():Promise<number>{
    const candidates=await this.pool.query(`SELECT id FROM ankabot_sessions s WHERE
      (status='active' AND ${sessionExpiredSql}) OR (status<>'active' AND EXISTS
      (SELECT 1 FROM character_groups g WHERE g.session_id=s.id AND g.status='active')) ORDER BY ankabot_license_id,id`);
    let expired=0;
    for(const row of candidates.rows)expired+=await this.transaction(async client=>{
      await lockSessionAllocation(client,row.id);return finalizeSession(client,row.id);
    });
    return expired;
  }
}
