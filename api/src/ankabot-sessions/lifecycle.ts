import type { PoolClient } from 'pg';

/** Caller holds license then session locks. Safe for already terminal sessions. */
export async function finalizeSession(c:PoolClient,sessionId:string,close=false):Promise<number>{
  const result=await c.query(`UPDATE ankabot_sessions SET
    status=CASE WHEN last_heartbeat_at<statement_timestamp()-INTERVAL '15 minutes' THEN 'expired' ELSE 'closed' END,
    ended_at=CASE WHEN last_heartbeat_at<statement_timestamp()-INTERVAL '15 minutes'
      THEN last_heartbeat_at+INTERVAL '15 minutes' ELSE statement_timestamp() END
    WHERE id=$1 AND status='active' AND ($2 OR last_heartbeat_at<statement_timestamp()-INTERVAL '15 minutes') RETURNING status`,[sessionId,close]);
  const state=(await c.query('SELECT status FROM ankabot_sessions WHERE id=$1',[sessionId])).rows[0]?.status;
  if(state==='active')return 0;
  const groups=(await c.query("SELECT id FROM character_groups WHERE session_id=$1 AND status='active' ORDER BY id FOR UPDATE",[sessionId])).rows;
  const ids=groups.map(g=>g.id);
  if(ids.length){
    const characters=(await c.query('SELECT character_id FROM group_members WHERE group_id=ANY($1::uuid[]) AND removed_at IS NULL ORDER BY character_id',[ids])).rows.map(m=>m.character_id);
    await c.query('SELECT id FROM ankama_accounts WHERE id IN (SELECT ankama_id FROM characters WHERE id=ANY($1::uuid[])) ORDER BY id FOR UPDATE',[characters]);
    await c.query('SELECT id FROM characters WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[characters]);
    await c.query("UPDATE characters SET status='P',updated_at=statement_timestamp() WHERE id=ANY($1::uuid[]) AND completed_at IS NULL AND status<>'B' AND status<>'P'",[characters]);
    await c.query("UPDATE character_groups SET status='abandoned',session_id=NULL,session_slot=NULL,assignment_id=NULL,updated_at=statement_timestamp() WHERE id=ANY($1::uuid[])",[ids]);
    await c.query(`INSERT INTO group_events(id,group_id,event_type,from_status,to_status,from_session_id)
      SELECT gen_random_uuid(),id,'state_changed','active','abandoned',$2 FROM character_groups WHERE id=ANY($1::uuid[])`,[ids,sessionId]);
  }
  return result.rows[0]?.status==='expired'?1:0;
}
