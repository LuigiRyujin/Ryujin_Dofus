import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID,randomBytes} from 'node:crypto';
import {Pool} from 'pg';
import {buildApp} from '../src/app.js';
import {encrypt} from '../src/crypto.js';
import {fingerprintApiKey} from '../src/ankabot-licenses/credentials.js';
import {AnkabotSessionRepository} from '../src/ankabot-sessions/repository.js';
import {CharacterGroupRepository} from '../src/character-groups/repository.js';
import {CharacterGroupService} from '../src/character-groups/service.js';
import {licenseUsage} from '../src/character-groups/allocation.js';

test('PostgreSQL claim recovery, global capacity, idempotency, cleanup and concurrency',
 {skip:!process.env.TEST_DATABASE_URL},async()=>{
 const url=new URL(process.env.TEST_DATABASE_URL!);url.hostname=url.hostname.replace('-pooler','');url.searchParams.set('sslmode','verify-full');
 const admin=new Pool({connectionString:url.toString()}),schema='claim_test_'+randomUUID().replaceAll('-','');
 await admin.query(`CREATE SCHEMA ${schema}`);url.searchParams.set('options',`-c search_path=${schema}`);
 const pool=new Pool({connectionString:url.toString(),max:10}),key=randomBytes(32).toString('base64');
 const operatorToken=randomBytes(32).toString('hex'),ankabotToken=randomBytes(32).toString('hex');
 const app=buildApp({databaseUrl:url.toString(),port:3000,encryptionKey:key,operatorToken,ankabotToken});
 const sessions=new AnkabotSessionRepository(pool,key),groups=new CharacterGroupService(new CharacterGroupRepository(pool));
 const license=async(max=40)=>{const id=randomUUID(),apiKey=randomUUID();await pool.query('INSERT INTO ankabot_licenses(id,api_key_encrypted,api_key_fingerprint,max_characters) VALUES($1,$2,$3,$4)',[id,encrypt(apiKey,key),fingerprintApiKey(apiKey,key),max]);return {id,apiKey};};
 const session=async(l:{apiKey:string})=>sessions.register({apiKey:l.apiKey,hostname:randomUUID(),pid:1});
 let sequence=0;
 const characters=async(count:number,serverId:number,breeds=[1,2,3])=>{
  const rows=Array.from({length:count},(_,i)=>({id:randomUUID(),emailId:randomUUID(),ankamaId:randomUUID(),breed:breeds[i%breeds.length],server:serverId,ordinal:sequence++}));
  const client=await pool.connect();try{await client.query('BEGIN');
   await client.query("INSERT INTO email_accounts(id,email,password_encrypted,original_encrypted) SELECT x.\"emailId\",x.id||'@example.com','secret','secret' FROM jsonb_to_recordset($1) AS x(id TEXT,\"emailId\" UUID)",[JSON.stringify(rows)]);
   await client.query("INSERT INTO ankama_accounts(id,login,password_encrypted,email_id) SELECT x.\"ankamaId\",x.id,'secret',x.\"emailId\" FROM jsonb_to_recordset($1) AS x(id TEXT,\"emailId\" UUID,\"ankamaId\" UUID)",[JSON.stringify(rows)]);
   await client.query(`INSERT INTO characters(id,ankama_id,email_id,name,breed_id,server_id,created_at)
    SELECT x.id,x."ankamaId",x."emailId",x.id::text,x.breed,x.server,'2026-01-01'::timestamptz+x.ordinal*INTERVAL '1 second'
    FROM jsonb_to_recordset($1) AS x(id UUID,"emailId" UUID,"ankamaId" UUID,breed INTEGER,server INTEGER,ordinal INTEGER)`,[JSON.stringify(rows)]);
   await client.query('COMMIT');return rows.map(row=>row.id);
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 };
 const claim=(s:{id:string;sessionToken:string},serverId:number,idempotencyKey=randomUUID(),token=ankabotToken)=>app.inject({
  method:'POST',url:`/api/services/ankabot/sessions/${s.id}/claim-groups`,headers:{authorization:'Bearer '+token,'x-ankabot-session-token':s.sessionToken},payload:{serverId,idempotencyKey}});
 const usage=async(id:string)=>{const c=await pool.connect();try{return await licenseUsage(c,id);}finally{c.release();}};
 try{
  await app.ready();
  const a=await license(9),b=await license(9),old=await session(a),receiver=await session(b);
  const trio=await characters(3,100),group=await groups.createGroup(trio);await groups.activateGroup(group.id,old.id);
  await pool.query("UPDATE characters SET status='E',attributes='{\"step\":7}' WHERE id=ANY($1::uuid[])",[trio]);
  await characters(6,100); // Stock exists, but recovery must precede forming new groups.
  await pool.query("UPDATE ankabot_sessions SET last_heartbeat_at=statement_timestamp()-INTERVAL '16 minutes' WHERE id=$1",[old.id]);
  const key1=randomUUID(),first=await claim(receiver,100,key1);assert.equal(first.statusCode,200,first.body);
  const firstBody=first.json();assert.equal(firstBody.groups.length,3);assert.equal(firstBody.newlyAssignedGroupIds[0],group.id);
  const recovered=firstBody.groups.find((g:{id:string})=>g.id===group.id);
  assert.deepEqual(recovered.members.map((m:{id:string})=>m.id).sort(),trio.slice().sort());
  assert.ok(recovered.members.every((m:{status:string})=>m.status==='P'));
  assert.equal((await pool.query('SELECT attributes FROM characters WHERE id=$1',[trio[0]])).rows[0].attributes.step,7);
  assert.equal((await sessions.get(old.id)).status,'expired');assert.equal(await usage(a.id),0);assert.equal(await usage(b.id),9);
  assert.ok(!first.body.includes(receiver.sessionToken));assert.ok(!first.body.includes(b.apiKey));assert.ok(!first.body.includes('password'));
  const replay=await claim(receiver,100,key1);assert.deepEqual(replay.json(),firstBody);
  assert.equal((await claim(receiver,200,key1)).statusCode,409);
  assert.equal((await claim(receiver,200)).statusCode,409);
  const receiver2=await session(b);const blocked=await claim(receiver2,100);assert.equal(blocked.statusCode,200);assert.equal(blocked.json().groups.length,0);assert.equal(blocked.json().reason,'LICENSE_CAPACITY');
  const reduction=await app.inject({method:'PATCH',url:`/api/ankabot-licenses/${b.id}`,headers:{authorization:'Bearer '+operatorToken},payload:{maxCharacters:8}});
  assert.equal(reduction.statusCode,409);
  // Explicit close and replay invalidation, without changing progress or memberships.
  await sessions.close(receiver.id,receiver.sessionToken);assert.equal((await groups.getGroup(group.id)).status,'abandoned');
  const again=await claim(receiver2,100);assert.equal(again.statusCode,200,again.body);assert.equal(again.json().groups.length,3);
  assert.equal((await claim(receiver,100,key1)).statusCode,409);
  const snapshotKey=randomUUID();const snapshot=(await claim(receiver2,100,snapshotKey)).json();
  const one=snapshot.groups[0].id;await groups.abandonGroup(one);await groups.resumeGroup(one,receiver2.id);
  assert.equal((await claim(receiver2,100,snapshotKey)).statusCode,409);
  assert.equal((await claim({...receiver2,sessionToken:old.sessionToken},100)).statusCode,403);
  assert.equal((await claim(receiver2,100,randomUUID(),operatorToken)).statusCode,403);
  // Capacity 40 fits thirteen trios (39), across five sessions.
  const wide=await license(40);await characters(42,200);
  const wideSessions=await Promise.all(Array.from({length:5},()=>session(wide)));
  const wideClaims=await Promise.all(wideSessions.map(s=>claim(s,200)));
  assert.ok(wideClaims.every(r=>r.statusCode===200));assert.equal(await usage(wide.id),39);
  assert.deepEqual(wideClaims.map(r=>r.json().groups.length).sort(),[1,3,3,3,3]);
  const allIds=wideClaims.flatMap(r=>r.json().groups.flatMap((g:{members:{id:string}[]})=>g.members.map(m=>m.id)));
  assert.equal(new Set(allIds).size,39);
  const low=await license(2),lowSession=await session(low);assert.equal((await claim(lowSession,200)).json().groups.length,0);
  // Same-session concurrent idempotent claims return exactly the same assignment snapshot.
  const concurrentLicense=await license(9),concurrent=await session(concurrentLicense);await characters(9,300);
  const sameKey=randomUUID();const same=await Promise.all([claim(concurrent,300,sameKey),claim(concurrent,300,sameKey)]);
  assert.ok(same.every(r=>r.statusCode===200));assert.deepEqual(same[0]!.json(),same[1]!.json());
  assert.equal(await usage(concurrentLicense.id),9);
  // Different licenses compete for the same stock without duplicate characters.
  const crossA=await session(await license(9)),crossB=await session(await license(9));await characters(9,400);
  const cross=await Promise.all([claim(crossA,400),claim(crossB,400)]);assert.ok(cross.every(r=>r.statusCode===200));
  const crossIds=cross.flatMap(r=>r.json().groups.flatMap((g:{members:{id:string}[]})=>g.members.map(m=>m.id)));
  assert.equal(new Set(crossIds).size,crossIds.length);assert.ok(crossIds.length<=9);
  // Invalid abandoned groups stay intact; forming and awaiting_restart are not reused.
  const invalidLicense=await license(9),invalidSession=await session(invalidLicense);
  const bannedIds=await characters(3,500),bannedGroup=await groups.createGroup(bannedIds);await groups.abandonGroup(bannedGroup.id);
  await pool.query("UPDATE characters SET status='B' WHERE id=$1",[bannedIds[0]]);
  const incomplete=await groups.createGroup(await characters(1,500));await groups.abandonGroup(incomplete.id);
  const completedIds=await characters(3,500),completedGroup=await groups.createGroup(completedIds);await groups.abandonGroup(completedGroup.id);
  await pool.query('UPDATE characters SET completed_at=statement_timestamp() WHERE id=ANY($1::uuid[])',[completedIds]);
  const pendingIds=await characters(3,500),pendingGroup=await groups.createGroup(pendingIds);await groups.activateGroup(pendingGroup.id,invalidSession.id);await groups.awaitRestart(pendingGroup.id);
  const forming=await groups.createGroup(await characters(3,500));
  const invalidClaim=await claim(invalidSession,500);assert.equal(invalidClaim.statusCode,200,invalidClaim.body);assert.equal(invalidClaim.json().groups.length,0);
  assert.equal((await groups.getGroup(bannedGroup.id)).members.length,3);assert.equal((await groups.getGroup(forming.id)).status,'forming');
  // Look past a first incompatible pair; never form a partial trio.
  const selective=await session(await license(9));const selectiveIds=await characters(4,600,[1,1,2,3]);
  const selectiveClaim=await claim(selective,600);assert.equal(selectiveClaim.json().groups.length,1);
  assert.deepEqual(selectiveClaim.json().groups[0].members.map((m:{breedId:number})=>m.breedId).sort(),[1,2,3]);
  assert.ok(selectiveClaim.json().groups[0].members.some((m:{id:string})=>m.id===selectiveIds[0]));
  // Completed and banned members retain their business state when the session ends.
  const preserved=selectiveClaim.json().groups[0].members;
  await pool.query("UPDATE characters SET status='B' WHERE id=$1",[preserved[0].id]);
  await pool.query('UPDATE characters SET completed_at=statement_timestamp() WHERE id=$1',[preserved[1].id]);
  const date=(await pool.query('SELECT completed_at FROM characters WHERE id=$1',[preserved[1].id])).rows[0].completed_at;
  await sessions.close(selective.id,selective.sessionToken);
  assert.equal((await pool.query('SELECT status FROM characters WHERE id=$1',[preserved[0].id])).rows[0].status,'B');
  assert.equal((await pool.query('SELECT completed_at FROM characters WHERE id=$1',[preserved[1].id])).rows[0].completed_at.toISOString(),date.toISOString());
  // A waiting claim must check time after locks; expiry commits despite claim rejection.
  const timed=await session(await license(9));await characters(3,700);
  const blocker=await pool.connect();await blocker.query('BEGIN');await blocker.query('SELECT id FROM ankabot_licenses WHERE id=$1 FOR UPDATE',[timed.licenseId]);
  const waiting=claim(timed,700);
  await new Promise(resolve=>setTimeout(resolve,100));
  await blocker.query("UPDATE ankabot_sessions SET last_heartbeat_at=statement_timestamp()-INTERVAL '16 minutes' WHERE id=$1",[timed.id]);
  await blocker.query('COMMIT');blocker.release();
  const expiredClaim=await waiting;assert.equal(expiredClaim.statusCode,409,expiredClaim.body);assert.equal((await sessions.get(timed.id)).status,'expired');
  assert.equal((await pool.query('SELECT count(*) FROM group_claims WHERE session_id=$1',[timed.id])).rows[0].count,'0');
  // Internal activation cannot bypass global license capacity.
  const lowGroup=await groups.createGroup(await characters(3,800));
  await assert.rejects(groups.activateGroup(lowGroup.id,lowSession.id),{code:'LICENSE_CAPACITY'});
  // Reduction and allocation contend on exactly the same license lock.
  const racingLicense=await license(9),racingSession=await session(racingLicense);await characters(3,900);
  const gate=await pool.connect();await gate.query('BEGIN');await gate.query('SELECT id FROM ankabot_licenses WHERE id=$1 FOR UPDATE',[racingLicense.id]);
  const allocating=claim(racingSession,900);
  const reducing=app.inject({method:'PATCH',url:`/api/ankabot-licenses/${racingLicense.id}`,headers:{authorization:'Bearer '+operatorToken},payload:{maxCharacters:2}});
  await new Promise(resolve=>setTimeout(resolve,100));await gate.query('COMMIT');gate.release();
  const [allocated,reduced]=await Promise.all([allocating,reducing]);assert.equal(allocated.statusCode,200,allocated.body);
  assert.ok([200,409].includes(reduced.statusCode));
  const finalLimit=(await pool.query('SELECT max_characters FROM ankabot_licenses WHERE id=$1',[racingLicense.id])).rows[0].max_characters;
  assert.ok(await usage(racingLicense.id)<=finalLimit);
  // Force expiry after new-group construction has begun and verify complete rollback.
  const late=await session(await license(9));await characters(3,1000);
  await pool.query(`CREATE SEQUENCE slow_group_attempts;
    CREATE FUNCTION slow_group_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM nextval('slow_group_attempts'); PERFORM pg_sleep(3); RETURN NEW; END $$;
    CREATE TRIGGER slow_group_test BEFORE INSERT ON character_groups FOR EACH ROW EXECUTE FUNCTION slow_group_insert()`);
  await pool.query("UPDATE ankabot_sessions SET last_heartbeat_at=statement_timestamp()-INTERVAL '14 minutes 58 seconds' WHERE id=$1",[late.id]);
  const before=(await pool.query('SELECT count(*) FROM character_groups')).rows[0].count;
  const lateResponse=await claim(late,1000);assert.equal(lateResponse.statusCode,409,lateResponse.body);
  assert.equal((await sessions.get(late.id)).status,'expired');assert.equal((await pool.query('SELECT count(*) FROM character_groups')).rows[0].count,before);
  assert.equal((await pool.query('SELECT is_called FROM slow_group_attempts')).rows[0].is_called,true);
  await pool.query('DROP TRIGGER slow_group_test ON character_groups; DROP FUNCTION slow_group_insert(); DROP SEQUENCE slow_group_attempts');
  // Concurrent licenses recover separate batches instead of one claim locking the whole abandoned pool.
  const recoveryIds:string[]=[];
  for(let i=0;i<6;i++){const g=await groups.createGroup(await characters(3,1100));await groups.abandonGroup(g.id);recoveryIds.push(g.id);}
  await characters(3,1100);
  const recoveryA=await session(await license(9)),recoveryB=await session(await license(9));
  const recoveredTogether=await Promise.all([claim(recoveryA,1100),claim(recoveryB,1100)]);
  assert.ok(recoveredTogether.every(r=>r.statusCode===200));
  const assignedRecovery=recoveredTogether.flatMap(r=>r.json().groups.map((g:{id:string})=>g.id));
  assert.equal(assignedRecovery.length,6);assert.equal(new Set(assignedRecovery).size,6);
  assert.ok(assignedRecovery.every(id=>recoveryIds.includes(id)));
 }finally{await app.close();await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}
});
