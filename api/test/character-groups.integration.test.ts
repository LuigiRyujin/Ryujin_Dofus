import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID,randomBytes} from 'node:crypto';
import {Pool} from 'pg';
import {migrations,runMigrations} from '../src/migrations.js';
import {CharacterGroupRepository} from '../src/character-groups/repository.js';
import {CharacterGroupService} from '../src/character-groups/service.js';
import {buildApp} from '../src/app.js';

test('PostgreSQL group domain, migration, deferred invariants, concurrency and character compatibility',
 {skip:!process.env.TEST_DATABASE_URL},async()=>{
 const url=new URL(process.env.TEST_DATABASE_URL!);url.hostname=url.hostname.replace('-pooler','');url.searchParams.set('sslmode','verify-full');
 const admin=new Pool({connectionString:url.toString()}),schema='groups_test_'+randomUUID().replaceAll('-','');
 await admin.query(`CREATE SCHEMA ${schema}`);url.searchParams.set('options',`-c search_path=${schema}`);
 const pool=new Pool({connectionString:url.toString()}),key=randomBytes(32).toString('base64');
 const operatorToken=randomBytes(32).toString('hex'),ankabotToken=randomBytes(32).toString('hex');
 const app=buildApp({databaseUrl:url.toString(),port:3000,encryptionKey:key,operatorToken,ankabotToken});
 const service=new CharacterGroupService(new CharacterGroupRepository(pool));
 const dbtx=async(run:(client:import('pg').PoolClient)=>Promise<void>)=>{
  const c=await pool.connect();try{await c.query('BEGIN');await run(c);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 };
 const characters=async(count=3,breeds=[1,2,3],servers=[100,100,100])=>{
  const rows=Array.from({length:count},(_,index)=>({id:randomUUID(),emailId:randomUUID(),ankamaId:randomUUID(),breed:breeds[index%breeds.length],server:servers[index%servers.length]}));
  await dbtx(async c=>{
   await c.query("INSERT INTO email_accounts(id,email,password_encrypted,original_encrypted) SELECT x.\"emailId\",x.id||'@example.com','secret','secret' FROM jsonb_to_recordset($1) AS x(id TEXT,\"emailId\" UUID)",[JSON.stringify(rows)]);
   await c.query("INSERT INTO ankama_accounts(id,login,password_encrypted,email_id) SELECT x.\"ankamaId\",x.id,'secret',x.\"emailId\" FROM jsonb_to_recordset($1) AS x(id TEXT,\"emailId\" UUID,\"ankamaId\" UUID)",[JSON.stringify(rows)]);
   await c.query('INSERT INTO characters(id,ankama_id,email_id,name,breed_id,server_id) SELECT x.id,x."ankamaId",x."emailId",x.id::text,x.breed,x.server FROM jsonb_to_recordset($1) AS x(id UUID,"emailId" UUID,"ankamaId" UUID,breed INTEGER,server INTEGER)',[JSON.stringify(rows)]);
  });return rows.map(row=>row.id);
 };
 const request=(method:string,path:string,body?:unknown)=>app.inject({method:method as 'GET',url:'/api/characters'+path,headers:{authorization:'Bearer '+ankabotToken},...(body===undefined?{}:{payload:body as Record<string,unknown>})});
 try{
  await pool.query('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  for(const migration of migrations.filter(m=>m.version<6)){await pool.query(migration.sql);await pool.query('INSERT INTO schema_migrations(version) VALUES($1)',[migration.version]);}
  const legacy=(await characters(1))[0]!;
  await pool.query("UPDATE characters SET status='F',updated_at='2026-01-01T12:00:00Z' WHERE id=$1",[legacy]);
  await runMigrations(pool);await runMigrations(pool);await app.ready();
  const legacyRow=(await pool.query('SELECT * FROM characters WHERE id=$1',[legacy])).rows[0];
  assert.equal(legacyRow.status,'E');assert.equal(legacyRow.completed_at.toISOString(),'2026-01-01T12:00:00.000Z');
  await assert.rejects(service.createGroup([legacy]),{code:'CHARACTER_INELIGIBLE'});
  const licenseId=randomUUID();await pool.query("INSERT INTO ankabot_licenses(id,api_key_encrypted,api_key_fingerprint) VALUES($1,'secret','group-license')",[licenseId]);
  const session=async()=>{const id=randomUUID();await pool.query('INSERT INTO ankabot_sessions(id,ankabot_license_id,hostname,pid,credential_hash) VALUES($1,$2,$3,1,$4)',[id,licenseId,id,'a'.repeat(64)]);return id;};
  const sessionId=await session(),otherSession=await session();
  const ids=await characters(4,[1,2,3,4],[100]);
  const forming=await service.createGroup();assert.equal(forming.members.length,0);
  await service.addMember(forming.id,ids[0]!);await service.addMember(forming.id,ids[1]!);
  await assert.rejects(service.addMember(forming.id,ids[0]!),{code:'MEMBER_DUPLICATE'});
  await assert.rejects(service.activateGroup(forming.id,sessionId),{code:'GROUP_CARDINALITY'});
  await service.addMember(forming.id,ids[2]!);
  await assert.rejects(service.addMember(forming.id,ids[3]!),{code:'GROUP_CARDINALITY'});
  await service.removeMember(forming.id,ids[2]!);await service.addMember(forming.id,ids[2]!);
  const active=await service.activateGroup(forming.id,sessionId);assert.equal(active.sessionSlot,1);
  const events=await service.getEvents(active.id);
  await service.activateGroup(active.id,sessionId);assert.equal((await service.getEvents(active.id)).length,events.length);
  await assert.rejects(service.activateGroup(active.id,otherSession),{code:'GROUP_ALREADY_ASSIGNED'});
  await assert.rejects(service.removeMember(active.id,ids[0]!),{code:'GROUP_IMMUTABLE'});
  await assert.rejects(service.createGroup([ids[0]!]),{code:'CHARACTER_RESERVED'});
  const progress=await request('PATCH',`/${ids[0]}/status`,{status:'E'});assert.equal(progress.statusCode,200);
  const abandoned=await service.abandonGroup(active.id);assert.equal(abandoned.sessionId,null);assert.equal(abandoned.members.length,3);
  assert.equal((await request('GET',`/${ids[0]}`)).json().status,'E');
  await assert.rejects(service.createGroup([ids[0]!]),{code:'CHARACTER_RESERVED'});
  await service.resumeGroup(active.id,otherSession);
  // A separately completed character retains its earlier timestamp when the whole group completes.
  assert.equal((await request('PATCH',`/${ids[0]}/status`,{status:'F'})).statusCode,409);
  const completedFixture=await pool.query("UPDATE characters SET completed_at=statement_timestamp() WHERE id=$1 RETURNING completed_at",[ids[0]]);
  const completion={completedAt:completedFixture.rows[0].completed_at.toISOString()};
  const completed=await service.completeGroup(active.id);assert.equal(completed.status,'completed');assert.ok(completed.completedAt);
  const completedRows=(await pool.query('SELECT completed_at,status FROM characters WHERE id=ANY($1::uuid[])',[ids.slice(0,3)])).rows;
  assert.ok(completedRows.every(row=>row.completed_at));assert.equal((await request('GET',`/${ids[0]}`)).json().completedAt,completion.completedAt);
  assert.equal((await pool.query('SELECT count(*) FROM group_members WHERE group_id=$1 AND released_at IS NULL',[active.id])).rows[0].count,'0');
  await service.completeGroup(active.id);await assert.rejects(service.resumeGroup(active.id,sessionId),{code:'GROUP_TRANSITION'});
  await assert.rejects(service.createGroup(ids.slice(0,3)),{code:'CHARACTER_INELIGIBLE'});
  for(const status of ['P','C','B','E']){const response=await request('PATCH',`/${ids[0]}/status`,{status});assert.equal(response.statusCode,200);assert.equal(response.json().completedAt,completion.completedAt);}
  assert.equal((await request('GET','?status=F')).json().items.some((row:{id:string})=>row.id===ids[0]),true);
  const sameBreed=await characters(3,[1,1,2]);await assert.rejects(service.createGroup(sameBreed),{code:'GROUP_COMPOSITION'});
  const mixedServer=await characters(3,[1,2,3],[100,200,100]);await assert.rejects(service.createGroup(mixedServer),{code:'GROUP_COMPOSITION'});
  const sameAccount=await characters();
  await pool.query('UPDATE characters SET ankama_id=s.ankama_id,email_id=s.email_id FROM characters s WHERE characters.id=$1 AND s.id=$2',[sameAccount[1],sameAccount[0]]);
  await assert.rejects(service.createGroup(sameAccount),{code:'GROUP_COMPOSITION'});
  const contested=(await characters(1))[0]!;
  const claims=await Promise.allSettled([service.createGroup([contested]),service.createGroup([contested])]);
  assert.equal(claims.filter(r=>r.status==='fulfilled').length,1);
  const blocked=await service.createGroup(await characters());await service.activateGroup(blocked.id,sessionId);await service.awaitRestart(blocked.id);
  await assert.rejects(service.resumeGroup(blocked.id,sessionId),{code:'GROUP_TRANSITION'});
  const incomplete=await service.createGroup([(await characters(1))[0]!]);await service.abandonGroup(incomplete.id);
  await assert.rejects(service.resumeGroup(incomplete.id,sessionId),{code:'GROUP_CARDINALITY'});
  const four=await Promise.all(Array.from({length:4},async()=>service.createGroup(await characters())));
  const capacity=await Promise.allSettled(four.map(g=>service.activateGroup(g.id,sessionId)));
  assert.equal(capacity.filter(r=>r.status==='fulfilled').length,3);
  assert.equal((await service.listGroups({sessionId,status:'active'})).total,3);
  const unassigned=four.find((_,i)=>capacity[i]!.status==='rejected')!;
  assert.equal((await service.getGroup(unassigned.id)).status,'forming');
  await assert.rejects(service.activateGroup(unassigned.id,randomUUID()),{code:'SESSION_NOT_FOUND'});
  const expired=await session();await pool.query("UPDATE ankabot_sessions SET last_heartbeat_at=statement_timestamp()-INTERVAL '16 minutes' WHERE id=$1",[expired]);
  await assert.rejects(service.activateGroup(unassigned.id,expired),{code:'SESSION_INACTIVE'});
  const closed=await session();await pool.query("UPDATE ankabot_sessions SET status='closed',ended_at=statement_timestamp() WHERE id=$1",[closed]);
  await assert.rejects(service.activateGroup(unassigned.id,closed),{code:'SESSION_INACTIVE'});
  // Deferred database validation rejects incomplete activation even outside the domain service.
  const raw=await service.createGroup();
  await assert.rejects(dbtx(async c=>{await c.query("UPDATE character_groups SET status='active',session_id=$2,session_slot=1 WHERE id=$1",[raw.id,otherSession]);}),{code:'23514'});
  assert.equal((await service.getGroup(raw.id)).status,'forming');
  await assert.rejects(pool.query('DELETE FROM characters WHERE id=$1',[ids[0]]));
  await assert.rejects(pool.query('DELETE FROM group_members WHERE group_id=$1',[active.id]),{code:'23514'});
  await assert.rejects(pool.query('DELETE FROM character_groups WHERE id=$1',[active.id]));
  await assert.rejects(pool.query('UPDATE characters SET completed_at=NULL WHERE id=$1',[ids[0]]),{code:'23514'});
  // Character PATCH locks account→character; domain locks group→account→character.
  // Status and first completion updates must not acquire a deferred group lock.
  const concurrentIds=await characters();const concurrentGroup=await service.createGroup(concurrentIds);
  await service.activateGroup(concurrentGroup.id,otherSession);
  const completionRace=await Promise.all([service.completeGroup(concurrentGroup.id),request('PATCH',`/${concurrentIds[0]}/status`,{status:'E'})]);
  assert.equal(completionRace[1].statusCode,200);assert.equal(completionRace[0].status,'completed');
  const structuralIds=await characters();const structuralGroup=await service.createGroup(structuralIds);await service.activateGroup(structuralGroup.id,otherSession);
  await assert.rejects(pool.query('UPDATE characters SET breed_id=(SELECT breed_id FROM characters WHERE id=$2) WHERE id=$1',[structuralIds[0],structuralIds[1]]),{code:'23514'});
  await pool.query("UPDATE ankabot_sessions SET last_heartbeat_at=statement_timestamp()-INTERVAL '16 minutes' WHERE id=$1",[otherSession]);
  const countBefore=(await service.getEvents(structuralGroup.id)).length;
  await service.activateGroup(structuralGroup.id,otherSession);assert.equal((await service.getEvents(structuralGroup.id)).length,countBefore);
  assert.ok((await service.getEvents(active.id)).some(event=>event.fromSessionId===sessionId&&event.toStatus==='abandoned'));
 }finally{await app.close();await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}
});
