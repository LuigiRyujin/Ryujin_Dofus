import type {PoolClient} from 'pg';
import {ModuleError} from '../emails/errors.js';
import type {ProgressInput} from './validation.js';

/** Reused by GET and claim; completion remains authoritative on characters. */
export const progressJsonSql=`jsonb_build_object('schemaVersion',1,'characterId',c.id,'revision',COALESCE(p.revision,0),
  'quest',p.quest,'data',COALESCE(p.data,'{}'::jsonb),'updatedAt',to_char(p.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'lastSessionId',p.last_session_id,'lastAssignmentId',p.last_assignment_id,
  'completedAt',to_char(c.completed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))`;

export class CharacterProgressRepository {
  async read(c:PoolClient,characterId:string){
    const result=await c.query(`SELECT ${progressJsonSql} AS progress FROM characters c
      LEFT JOIN character_progress p ON p.character_id=c.id WHERE c.id=$1`,[characterId]);
    if(!result.rows[0])throw new ModuleError(404,'CHARACTER_NOT_FOUND','Personagem não encontrado.');
    return result.rows[0].progress;
  }
  async assignedGroup(c:PoolClient,sessionId:string,characterId:string){
    const group=(await c.query(`SELECT g.id,g.assignment_id FROM character_groups g JOIN group_members m ON m.group_id=g.id
      WHERE m.character_id=$1 AND m.removed_at IS NULL AND m.released_at IS NULL AND g.status='active' AND g.session_id=$2
      FOR UPDATE OF g`,[characterId,sessionId])).rows[0];
    if(!group)throw new ModuleError(403,'CHARACTER_NOT_ASSIGNED','Personagem não pertence à sessão.');
    return group;
  }
  async previousUpdate(c:PoolClient,sessionId:string,updateId:string){
    return (await c.query('SELECT character_id,payload_fingerprint,response FROM character_progress_updates WHERE session_id=$1 AND update_id=$2',[sessionId,updateId])).rows[0];
  }
  async save(c:PoolClient,sessionId:string,groupId:string,characterId:string,input:ProgressInput){
    await c.query('INSERT INTO character_progress(character_id) VALUES($1) ON CONFLICT(character_id) DO NOTHING',[characterId]);
    const result=await c.query(`UPDATE character_progress SET revision=revision+1,quest=$3,data=$4,last_session_id=$5,
      last_group_id=$6,last_assignment_id=$7,updated_at=statement_timestamp()
      WHERE character_id=$1 AND revision=$2 RETURNING revision`,[characterId,input.baseRevision,
      input.quest===null?null:JSON.stringify(input.quest),JSON.stringify(input.data),sessionId,groupId,input.assignmentId]);
    if(!result.rowCount)throw new ModuleError(409,'PROGRESS_REVISION_CONFLICT','O progresso mudou. Consulte a revisão atual.');
    if(input.completed)await c.query(`UPDATE characters SET completed_at=COALESCE(completed_at,statement_timestamp()),
      updated_at=statement_timestamp() WHERE id=$1`,[characterId]);
  }
  async recordUpdate(c:PoolClient,sessionId:string,groupId:string,characterId:string,input:ProgressInput,fingerprint:string,response:unknown){
    await c.query(`INSERT INTO character_progress_updates(session_id,update_id,character_id,group_id,assignment_id,payload_fingerprint,response)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,[sessionId,input.updateId,characterId,groupId,input.assignmentId,fingerprint,JSON.stringify(response)]);
  }
}
