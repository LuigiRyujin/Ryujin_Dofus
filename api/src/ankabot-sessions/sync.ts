import type {PoolClient} from 'pg';
import type {HeartbeatReport} from '../character-progress/validation.js';

export async function synchronizeCharacters(c:PoolClient,sessionId:string,input:HeartbeatReport){
  const previous=(await c.query('SELECT sequence,report,received_at FROM session_sync_state WHERE session_id=$1',[sessionId])).rows[0];
  if(previous&&input.sequence<=previous.sequence)return {...previous.report,reportStatus:'stale',receivedSequence:input.sequence,receivedAt:previous.received_at};
  // Session/license locks are already held. Acquire all group, account and character locks in order.
  const groupIds=(await c.query("SELECT id FROM character_groups WHERE session_id=$1 AND status='active' ORDER BY id FOR UPDATE",[sessionId])).rows.map(g=>g.id);
  const expected=(await c.query(`SELECT ch.id,g.assignment_id FROM group_members m JOIN character_groups g ON g.id=m.group_id
    JOIN characters ch ON ch.id=m.character_id WHERE g.id=ANY($1::uuid[]) AND m.removed_at IS NULL AND m.released_at IS NULL ORDER BY ch.id`,[groupIds])).rows;
  const ids=expected.map(ch=>ch.id);
  await c.query('SELECT id FROM ankama_accounts WHERE id IN (SELECT ankama_id FROM characters WHERE id=ANY($1::uuid[])) ORDER BY id FOR UPDATE',[ids]);
  await c.query('SELECT id FROM characters WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[ids]);
  const assignments=new Map(expected.map(ch=>[ch.id,ch.assignment_id]));
  const valid:string[]=[],unexpected:string[]=[],staleAssignments:{characterId:string;reportedAssignmentId:string;expectedAssignmentId:string}[]=[];
  for(const entry of input.loadedCharacters){
    const assignment=assignments.get(entry.characterId);
    if(!assignment)unexpected.push(entry.characterId);
    else if(assignment!==entry.assignmentId)staleAssignments.push({characterId:entry.characterId,reportedAssignmentId:entry.assignmentId,expectedAssignmentId:assignment});
    else valid.push(entry.characterId);
  }
  const present=new Set(valid);
  const report={schemaVersion:1,sequence:input.sequence,reportStatus:'accepted',expected:ids,valid,missing:ids.filter(id=>!present.has(id)),unexpected,staleAssignments};
  await c.query("UPDATE characters SET status='E',updated_at=statement_timestamp() WHERE id=ANY($1::uuid[]) AND status IN ('C','P') AND completed_at IS NULL",[valid]);
  const saved=await c.query(`INSERT INTO session_sync_state(session_id,sequence,loaded_characters,report) VALUES($1,$2,$3,$4)
    ON CONFLICT(session_id) DO UPDATE SET sequence=EXCLUDED.sequence,loaded_characters=EXCLUDED.loaded_characters,
      report=EXCLUDED.report,received_at=statement_timestamp() RETURNING received_at`,[sessionId,input.sequence,JSON.stringify(input.loadedCharacters),JSON.stringify(report)]);
  return {...report,receivedAt:saved.rows[0].received_at};
}
