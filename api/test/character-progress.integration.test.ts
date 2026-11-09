import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID,randomBytes} from 'node:crypto';
import {Pool} from 'pg';
import {buildApp} from '../src/app.js';
import {encrypt} from '../src/crypto.js';
import {fingerprintApiKey} from '../src/ankabot-licenses/credentials.js';
import {AnkabotSessionRepository} from '../src/ankabot-sessions/repository.js';
import {migrations,runMigrations} from '../src/migrations.js';

test('PostgreSQL synchronization, ordered progress, partial recovery, completion and rollback',
 {skip:!process.env.TEST_DATABASE_URL},async()=>{
 const url=new URL(process.env.TEST_DATABASE_URL!);url.hostname=url.hostname.replace('-pooler','');url.searchParams.set('sslmode','verify-full');
 const admin=new Pool({connectionString:url.toString()}),schema='progress_test_'+randomUUID().replaceAll('-','');
 await admin.query(`CREATE SCHEMA ${schema}`);url.searchParams.set('options',`-c search_path=${schema}`);
 const pool=new Pool({connectionString:url.toString()}),key=randomBytes(32).toString('base64');
 const operatorToken=randomBytes(32).toString('hex'),ankabotToken=randomBytes(32).toString('hex');
 const app=buildApp({databaseUrl:url.toString(),port:3000,encryptionKey:key,operatorToken,ankabotToken});
 const sessions=new AnkabotSessionRepository(pool,key);
 const license=async()=>{const id=randomUUID(),apiKey=randomUUID();await pool.query('INSERT INTO ankabot_licenses(id,api_key_encrypted,api_key_fingerprint,max_characters) VALUES($1,$2,$3,3)',[id,encrypt(apiKey,key),fingerprintApiKey(apiKey,key)]);return {id,apiKey};};
 const makeSession=async(l:{apiKey:string})=>sessions.register({apiKey:l.apiKey,hostname:randomUUID(),pid:1});
 const characters=async(serverId:number)=>{
  const ids:string[]=[];
  for(let breed=1;breed<=3;breed++){
   const id=randomUUID(),email=randomUUID(),account=randomUUID();ids.push(id);
   await pool.query("INSERT INTO email_accounts(id,email,password_encrypted,original_encrypted) VALUES($1,$2,'secret','secret')",[email,email+'@example.com']);
   await pool.query("INSERT INTO ankama_accounts(id,login,password_encrypted,email_id) VALUES($1,$2,'secret',$3)",[account,account,email]);
   await pool.query(`INSERT INTO characters(id,ankama_id,email_id,name,breed_id,server_id,attributes) VALUES($1,$2,$3,$4,$5,$6,'{"colors":[1,2,3],"head":0}')`,[id,account,email,id,breed,serverId]);
  }return ids;
 };
 const req=(s:{id:string;sessionToken:string},method:string,suffix:string,body?:unknown,token=ankabotToken)=>app.inject({
  method:method as 'GET',url:`/api/services/ankabot/sessions/${s.id}${suffix}`,headers:{authorization:'Bearer '+token,'x-ankabot-session-token':s.sessionToken},...(body===undefined?{}:{payload:body as Record<string,unknown>})});
 const claim=async(s:{id:string;sessionToken:string},serverId:number)=>{const response=await req(s,'POST','/claim-groups',{serverId,idempotencyKey:randomUUID()});assert.equal(response.statusCode,200,response.body);return response.json();};
 const progress=(assignmentId:string,baseRevision=0,completed=false)=>({schemaVersion:1,assignmentId,updateId:randomUUID(),baseRevision,quest:{id:'quest-A',stepId:'step-1'},data:{objectivesCompleted:['one']},completed});
 try{
  // Upgrade v7 with existing cosmetic attributes, then verify repeat application.
  await pool.query('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  for(const migration of migrations.filter(m=>m.version<8)){await pool.query(migration.sql);await pool.query('INSERT INTO schema_migrations(version) VALUES($1)',[migration.version]);}
  const ids=await characters(100);await app.ready();await runMigrations(pool);
  assert.deepEqual((await pool.query('SELECT attributes FROM characters WHERE id=$1',[ids[0]])).rows[0].attributes,{colors:[1,2,3],head:0});
  const l=await license(),first=await makeSession(l),foreign=await makeSession(await license());
  const assigned=await claim(first,100),group=assigned.groups[0],assignment=group.assignmentId;
  assert.equal(group.members.length,3);assert.ok(group.members.every((m:{progress:{revision:number}})=>m.progress.revision===0));
  const heartbeat=await req(first,'PUT','/heartbeat');assert.equal(heartbeat.statusCode,200);assert.equal('sync' in heartbeat.json(),false);
  assert.equal((await req(first,'PUT','/heartbeat',{})).statusCode,200);
  const outsider=randomUUID();
  const report={schemaVersion:1,sequence:1,loadedCharacters:[{characterId:ids[0],assignmentId:assignment},{characterId:ids[1],assignmentId:randomUUID()},{characterId:outsider,assignmentId:assignment}]};
  const synced=await req(first,'PUT','/heartbeat',report);assert.equal(synced.statusCode,200,synced.body);
  assert.deepEqual(synced.json().sync.valid,[ids[0]]);assert.deepEqual(synced.json().sync.unexpected,[outsider]);
  assert.equal(synced.json().sync.staleAssignments.length,1);assert.equal(synced.json().sync.missing.length,2);
  assert.equal((await pool.query('SELECT status FROM characters WHERE id=$1',[ids[0]])).rows[0].status,'E');
  assert.equal((await pool.query('SELECT status FROM characters WHERE id=$1',[ids[1]])).rows[0].status,'C');
  const empty=await req(first,'PUT','/heartbeat',{schemaVersion:1,sequence:2,loadedCharacters:[]});assert.equal(empty.json().sync.missing.length,3);
  const delayed=await req(first,'PUT','/heartbeat',{schemaVersion:1,sequence:1,loadedCharacters:ids.map(characterId=>({characterId,assignmentId:assignment}))});
  assert.equal(delayed.json().sync.reportStatus,'stale');assert.equal(delayed.json().sync.sequence,2);
  assert.equal((await sessions.get(first.id)).sync.sequence,2);
  assert.equal((await pool.query('SELECT status FROM characters WHERE id=$1',[ids[1]])).rows[0].status,'C');
  const badReport=await req(first,'PUT','/heartbeat',{...report,schemaVersion:2});assert.equal(badReport.statusCode,400);
  const allLoaded={schemaVersion:1,sequence:3,loadedCharacters:ids.map(characterId=>({characterId,assignmentId:assignment}))};
  await pool.query("UPDATE characters SET status='B' WHERE id=$1",[ids[2]]);
  assert.equal((await req(first,'PUT','/heartbeat',allLoaded)).json().sync.valid.length,3);
  assert.equal((await pool.query('SELECT status FROM characters WHERE id=$1',[ids[2]])).rows[0].status,'B');
  await pool.query("UPDATE characters SET status='E' WHERE id=$1",[ids[2]]);
  const reportRace=await Promise.all([req(first,'PUT','/heartbeat',{schemaVersion:1,sequence:4,loadedCharacters:[]}),
    req(first,'PUT','/heartbeat',{...allLoaded,sequence:5})]);
  assert.ok(reportRace.every(response=>response.statusCode===200));assert.equal((await sessions.get(first.id)).sync.sequence,5);
  const initial=await req(first,'GET',`/characters/${ids[0]}/progress`);assert.equal(initial.statusCode,200);assert.equal(initial.json().progress.revision,0);
  assert.equal((await req(foreign,'GET',`/characters/${ids[0]}/progress`)).statusCode,403);
  const body=progress(assignment);const updated=await req(first,'POST',`/characters/${ids[0]}/progress`,body);
  assert.equal(updated.statusCode,200,updated.body);assert.equal(updated.json().progress.revision,1);
  assert.ok(!updated.body.includes(first.sessionToken));assert.ok(!updated.body.includes(l.apiKey));assert.ok(!updated.body.includes(key));
  const repeated=await req(first,'POST',`/characters/${ids[0]}/progress`,body);assert.equal(repeated.json().replayed,true);
  assert.equal(repeated.json().progress.updatedAt,updated.json().progress.updatedAt);
  assert.equal((await req(first,'POST',`/characters/${ids[0]}/progress`,{...body,data:{other:true}})).statusCode,409);
  assert.equal((await req(first,'POST',`/characters/${ids[1]}/progress`,body)).statusCode,409);
  assert.equal((await req(first,'POST',`/characters/${ids[1]}/progress`,progress(randomUUID()))).statusCode,409);
  assert.equal((await req(foreign,'POST',`/characters/${ids[1]}/progress`,progress(assignment))).statusCode,403);
  assert.equal((await req(first,'POST',`/characters/${ids[1]}/progress`,progress(assignment),operatorToken)).statusCode,403);
  assert.equal((await req({...first,sessionToken:foreign.sessionToken},'GET',`/characters/${ids[0]}/progress`)).statusCode,403);
  const races=await Promise.all([req(first,'POST',`/characters/${ids[0]}/progress`,{...progress(assignment,1),data:{winner:'a'}}),req(first,'POST',`/characters/${ids[0]}/progress`,{...progress(assignment,1),data:{winner:'b'}})]);
  assert.deepEqual(races.map(r=>r.statusCode).sort(),[200,409]);
  const current=(await req(first,'GET',`/characters/${ids[0]}/progress`)).json().progress;assert.equal(current.revision,2);
  assert.equal((await req(first,'POST',`/characters/${ids[0]}/progress`,progress(assignment,0))).statusCode,409);
  const completeFirst=await req(first,'POST',`/characters/${ids[0]}/progress`,{...progress(assignment,2,true),data:current.data});
  assert.equal(completeFirst.statusCode,200,completeFirst.body);assert.equal(completeFirst.json().group.capacityReleased,false);
  const firstDate=completeFirst.json().progress.completedAt;assert.ok(firstDate);
  assert.equal((await req(first,'POST',`/characters/${ids[0]}/progress`,progress(assignment,3))).statusCode,409);
  const legacy=await app.inject({method:'PATCH',url:`/api/characters/${ids[1]}/status`,headers:{authorization:'Bearer '+operatorToken},payload:{status:'F'}});
  assert.equal(legacy.statusCode,409);assert.equal(legacy.json().error.code,'USE_SESSION_PROGRESS');
  await pool.query("UPDATE ankabot_sessions SET last_heartbeat_at=statement_timestamp()-INTERVAL '16 minutes' WHERE id=$1",[first.id]);
  assert.equal((await req(first,'PUT','/heartbeat',allLoaded)).statusCode,409);
  assert.equal((await pool.query('SELECT status FROM character_groups WHERE id=$1',[group.id])).rows[0].status,'abandoned');
  assert.equal((await pool.query('SELECT completed_at FROM characters WHERE id=$1',[ids[0]])).rows[0].completed_at.toISOString(),new Date(firstDate).toISOString());
  const second=await makeSession(l),recovered=await claim(second,100),recoveredGroup=recovered.groups[0];
  assert.equal(recoveredGroup.id,group.id);assert.notEqual(recoveredGroup.assignmentId,assignment);
  const recoveredMember=recoveredGroup.members.find((m:{id:string})=>m.id===ids[0]);assert.equal(recoveredMember.progress.revision,3);assert.deepEqual(recoveredMember.progress.data,current.data);
  assert.equal((await req(second,'POST',`/characters/${ids[1]}/progress`,progress(assignment))).statusCode,409);
  assert.equal((await req(first,'POST',`/characters/${ids[1]}/progress`,progress(assignment))).statusCode,409);
  await pool.query("UPDATE characters SET status='P' WHERE id=$1",[ids[0]]);
  const afterRecovery=await req(second,'PUT','/heartbeat',{schemaVersion:1,sequence:1,loadedCharacters:ids.map(characterId=>({characterId,assignmentId:recoveredGroup.assignmentId}))});
  assert.equal(afterRecovery.statusCode,200);assert.equal((await pool.query('SELECT status FROM characters WHERE id=$1',[ids[1]])).rows[0].status,'E');
  assert.equal((await pool.query('SELECT status FROM characters WHERE id=$1',[ids[0]])).rows[0].status,'P');
  const thirdBody=progress(recoveredGroup.assignmentId,0,true);
  const finishing=await Promise.all([req(second,'POST',`/characters/${ids[1]}/progress`,progress(recoveredGroup.assignmentId,0,true)),
    req(second,'POST',`/characters/${ids[2]}/progress`,thirdBody)]);
  assert.ok(finishing.every(response=>response.statusCode===200));
  assert.equal(finishing.filter(response=>response.json().group.capacityReleased).length,1);
  assert.equal((await pool.query("SELECT count(*) FROM group_events WHERE group_id=$1 AND to_status='completed'",[group.id])).rows[0].count,'1');
  assert.equal((await pool.query('SELECT count(*) FROM group_members WHERE group_id=$1 AND released_at IS NULL',[group.id])).rows[0].count,'0');
  const thirdReplay=await req(second,'POST',`/characters/${ids[2]}/progress`,thirdBody);assert.equal(thirdReplay.statusCode,200);assert.equal(thirdReplay.json().replayed,true);
  assert.equal((await pool.query('SELECT count(*) FROM character_progress_updates WHERE session_id=$1 AND update_id=$2',[second.id,thirdBody.updateId])).rows[0].count,'1');
  await characters(100);const reused=await claim(second,100);assert.equal(reused.groups.length,1);assert.notEqual(reused.groups[0].id,group.id);
  assert.deepEqual((await pool.query('SELECT attributes FROM characters WHERE id=$1',[ids[0]])).rows[0].attributes,{colors:[1,2,3],head:0});
  // Expiry during a progress write must roll back progress, completion and the accepted-update ledger.
  const lateGroup=reused.groups[0],lateId=lateGroup.members[0].id;
  await pool.query(`CREATE SEQUENCE progress_attempts;
    CREATE FUNCTION slow_progress_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM nextval('progress_attempts'); PERFORM pg_sleep(3); RETURN NEW; END $$;
    CREATE TRIGGER slow_progress_test BEFORE UPDATE ON character_progress FOR EACH ROW EXECUTE FUNCTION slow_progress_write()`);
  await pool.query("UPDATE ankabot_sessions SET last_heartbeat_at=statement_timestamp()-INTERVAL '14 minutes 58 seconds' WHERE id=$1",[second.id]);
  const lateBody=progress(lateGroup.assignmentId,0,true),late=await req(second,'POST',`/characters/${lateId}/progress`,lateBody);
  assert.equal(late.statusCode,409,late.body);assert.equal((await sessions.get(second.id)).status,'expired');
  assert.equal((await pool.query('SELECT is_called FROM progress_attempts')).rows[0].is_called,true);
  assert.equal((await pool.query('SELECT count(*) FROM character_progress WHERE character_id=$1',[lateId])).rows[0].count,'0');
  assert.equal((await pool.query('SELECT count(*) FROM character_progress_updates WHERE update_id=$1',[lateBody.updateId])).rows[0].count,'0');
  assert.equal((await pool.query('SELECT completed_at FROM characters WHERE id=$1',[lateId])).rows[0].completed_at,null);
  assert.equal((await pool.query('SELECT status FROM character_groups WHERE id=$1',[lateGroup.id])).rows[0].status,'abandoned');
  // A late synchronization also rolls back its report/promotions before independent session cleanup.
  const syncSession=await makeSession(l),syncGroup=(await claim(syncSession,100)).groups[0];
  await pool.query(`CREATE SEQUENCE sync_attempts;
    CREATE FUNCTION slow_sync_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      PERFORM nextval('sync_attempts'); PERFORM pg_sleep(3);
      UPDATE ankabot_sessions SET last_heartbeat_at=statement_timestamp()-INTERVAL '16 minutes' WHERE id=NEW.session_id;
      RETURN NEW; END $$;
    CREATE TRIGGER slow_sync_test BEFORE INSERT ON session_sync_state FOR EACH ROW EXECUTE FUNCTION slow_sync_write()`);
  await pool.query("UPDATE ankabot_sessions SET last_heartbeat_at=statement_timestamp()-INTERVAL '14 minutes 58 seconds' WHERE id=$1",[syncSession.id]);
  const lateSync=await req(syncSession,'PUT','/heartbeat',{schemaVersion:1,sequence:1,loadedCharacters:syncGroup.members.map((m:{id:string})=>({characterId:m.id,assignmentId:syncGroup.assignmentId}))});
  assert.equal(lateSync.statusCode,409,lateSync.body);assert.equal((await sessions.get(syncSession.id)).status,'expired');
  assert.equal((await pool.query('SELECT is_called FROM sync_attempts')).rows[0].is_called,true);
  assert.equal((await pool.query('SELECT count(*) FROM session_sync_state WHERE session_id=$1',[syncSession.id])).rows[0].count,'0');
  assert.ok((await pool.query('SELECT status FROM characters WHERE id=ANY($1::uuid[])',[syncGroup.members.map((m:{id:string})=>m.id)])).rows.every(row=>row.status==='P'));
 }finally{await app.close();await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}
});
