import type { PoolClient } from 'pg';
import { ModuleError } from '../emails/errors.js';

export async function lockSessionAllocation(c:PoolClient,sessionId:string){
  const session=(await c.query('SELECT ankabot_license_id FROM ankabot_sessions WHERE id=$1',[sessionId])).rows[0];
  if(!session)throw new ModuleError(404,'SESSION_NOT_FOUND','Sessão não encontrada.');
  await c.query('SELECT id FROM ankabot_licenses WHERE id=$1 FOR UPDATE',[session.ankabot_license_id]);
  const row=(await c.query('SELECT * FROM ankabot_sessions WHERE id=$1 FOR UPDATE',[sessionId])).rows[0];
  if(!row)throw new ModuleError(404,'SESSION_NOT_FOUND','Sessão não encontrada.');
  return row;
}

export async function licenseUsage(c:PoolClient,licenseId:string):Promise<number>{
  return Number((await c.query(`SELECT count(*) AS used FROM group_members m
    JOIN character_groups g ON g.id=m.group_id JOIN ankabot_sessions s ON s.id=g.session_id
    WHERE s.ankabot_license_id=$1 AND g.status='active' AND m.removed_at IS NULL`,[licenseId])).rows[0].used);
}

export async function assertLicenseCapacity(c:PoolClient,sessionId:string,additional=3){
  const row=(await c.query('SELECT l.id,l.max_characters FROM ankabot_licenses l JOIN ankabot_sessions s ON s.ankabot_license_id=l.id WHERE s.id=$1',[sessionId])).rows[0];
  if(!row)throw new ModuleError(404,'SESSION_NOT_FOUND','Sessão não encontrada.');
  if(await licenseUsage(c,row.id)+additional>row.max_characters)
    throw new ModuleError(409,'LICENSE_CAPACITY','A licença não possui capacidade para outro trio.');
}
