import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { buildApp } from '../src/app.js';
import { migrations,runMigrations } from '../src/migrations.js';
import { AnkabotSessionRepository,sessionExpiredSql } from '../src/ankabot-sessions/repository.js';
import { sessionCredentialMatches } from '../src/ankabot-sessions/credentials.js';

test('PostgreSQL session lifecycle, credentials, expiration boundaries and concurrent requests',
  {skip:!process.env.TEST_DATABASE_URL},async()=>{
  const url=new URL(process.env.TEST_DATABASE_URL!);
  url.hostname=url.hostname.replace('-pooler','');url.searchParams.set('sslmode','verify-full');
  const admin=new Pool({connectionString:url.toString()}),schema='sessions_test_'+randomUUID().replaceAll('-','');
  await admin.query(`CREATE SCHEMA ${schema}`);url.searchParams.set('options',`-c search_path=${schema}`);
  const pool=new Pool({connectionString:url.toString()}),key=randomBytes(32).toString('base64');
  const operatorToken=randomBytes(32).toString('hex'),ankabotToken=randomBytes(32).toString('hex');
  const app=buildApp({databaseUrl:url.toString(),port:3000,encryptionKey:key,operatorToken,ankabotToken});
  const path='/api/services/ankabot/sessions';
  const req=(method:string,suffix='',body?:unknown,token:string|null=ankabotToken,sessionToken?:string)=>app.inject({
    method:method as 'GET',url:path+suffix,headers:{...(token?{authorization:'Bearer '+token}:{}),
      ...(sessionToken?{'x-ankabot-session-token':sessionToken}:{})},...(body===undefined?{}:{payload:body as Record<string,unknown>})});
  const operator=(method:string,url:string,payload?:unknown)=>app.inject({method:method as 'GET',url,
    headers:{authorization:'Bearer '+operatorToken},...(payload===undefined?{}:{payload:payload as Record<string,unknown>})});
  const repository=new AnkabotSessionRepository(pool,key),apiKey='external-license-for-sessions';
  let licenseId:string;
  const register=async(pid:number,hostname=' PC-01 ')=>(await req('POST','',{apiKey,hostname,pid}));
  const age=async(id:string,interval:string)=>pool.query("UPDATE ankabot_sessions SET last_heartbeat_at=statement_timestamp()-$2::interval WHERE id=$1",[id,interval]);
  try{
    // Upgrade existing v4 and reapply safely, including a pre-existing license.
    await pool.query('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    for(const migration of migrations.filter(item=>item.version<5)){
      await pool.query(migration.sql);await pool.query('INSERT INTO schema_migrations(version) VALUES($1)',[migration.version]);
    }
    await app.ready();await runMigrations(pool);
    licenseId=(await operator('POST','/api/ankabot-licenses',{apiKey})).json().id;
    assert.equal((await req('POST','',{apiKey:'unknown',hostname:'pc',pid:1})).statusCode,401);
    assert.equal((await req('POST','',{apiKey,hostname:'pc',pid:1},null)).statusCode,401);
    assert.equal((await req('POST','',{apiKey,hostname:'pc',pid:1},operatorToken)).statusCode,403);
    const firstResponse=await register(1);assert.equal(firstResponse.statusCode,201,firstResponse.body);
    assert.equal(firstResponse.headers['cache-control'],'no-store');
    const first=firstResponse.json();assert.equal(first.hostname,'pc-01');assert.equal(first.pid,1);
    assert.equal(first.status,'active');assert.equal(first.licenseId,licenseId);
    assert.equal(first.sessionToken.length,64);
    const stored=(await pool.query('SELECT * FROM ankabot_sessions WHERE id=$1',[first.id])).rows[0];
    assert.notEqual(stored.credential_hash,first.sessionToken);
    assert.equal(sessionCredentialMatches(first.sessionToken,stored.credential_hash),true);
    assert.equal((await register(1,'pc-01')).statusCode,409);
    const race=await Promise.all([register(2),register(2)]);
    assert.deepEqual(race.map(item=>item.statusCode).sort(),[201,409]);
    const second=race.find(item=>item.statusCode===201)!.json();
    assert.equal((await req('PUT',`/${first.id}/heartbeat`,undefined,ankabotToken,second.sessionToken)).statusCode,403);
    assert.equal((await req('PUT',`/${first.id}/heartbeat`)).statusCode,403);
    assert.equal((await req('PUT',`/${first.id}/heartbeat`,undefined,operatorToken,first.sessionToken)).statusCode,403);
    assert.equal((await req('PUT',`/${randomUUID()}/heartbeat`,undefined,ankabotToken,first.sessionToken)).statusCode,404);
    await age(first.id,'14 minutes 59 seconds');
    const heartbeat=await req('PUT',`/${first.id}/heartbeat`,undefined,ankabotToken,first.sessionToken);
    assert.equal(heartbeat.statusCode,200,heartbeat.body);
    assert.ok(new Date(heartbeat.json().lastHeartbeatAt)>=new Date(first.lastHeartbeatAt));
    assert.ok(!heartbeat.body.includes(first.sessionToken));assert.ok(!heartbeat.body.includes('credential_hash'));

    // Exact database boundary, same expression as production and same statement clock.
    const boundary=await pool.query(`SELECT delta,(${sessionExpiredSql}) AS expired FROM
      (SELECT delta,statement_timestamp()-delta AS last_heartbeat_at FROM
        (VALUES(INTERVAL '14 minutes 59 seconds'),(INTERVAL '15 minutes'),(INTERVAL '15 minutes 0.000001 seconds')) valueset(delta)) samples ORDER BY delta`);
    assert.deepEqual(boundary.rows.map(row=>row.expired),[false,false,true]);
    await age(first.id,'16 minutes');
    const effective=await req('GET',`?status=expired&licenseId=${licenseId}`,undefined,operatorToken);
    assert.equal(effective.statusCode,200);assert.ok(effective.json().items.some((item:{id:string})=>item.id===first.id));
    assert.equal((await pool.query('SELECT status FROM ankabot_sessions WHERE id=$1',[first.id])).rows[0].status,'active');
    assert.equal((await req('PUT',`/${first.id}/heartbeat`,undefined,ankabotToken,first.sessionToken)).statusCode,409);
    assert.equal((await pool.query('SELECT status FROM ankabot_sessions WHERE id=$1',[first.id])).rows[0].status,'expired');
    assert.equal((await req('PUT',`/${first.id}/close`,undefined,ankabotToken,first.sessionToken)).json().status,'expired');
    const replacement=(await register(1)).json();assert.notEqual(replacement.id,first.id);
    const close=await req('PUT',`/${replacement.id}/close`,undefined,ankabotToken,replacement.sessionToken);
    assert.equal(close.statusCode,200);assert.equal(close.json().status,'closed');
    const closeAgain=await req('PUT',`/${replacement.id}/close`,undefined,ankabotToken,replacement.sessionToken);
    assert.equal(closeAgain.json().endedAt,close.json().endedAt);
    assert.equal((await req('PUT',`/${replacement.id}/heartbeat`,undefined,ankabotToken,replacement.sessionToken)).statusCode,409);
    assert.equal((await register(1)).statusCode,201);
    const stale=(await register(3)).json();await age(stale.id,'16 minutes');
    const newer=await register(3);assert.equal(newer.statusCode,201);assert.notEqual(newer.json().id,stale.id);
    const jobSession=(await register(4)).json();await age(jobSession.id,'16 minutes');
    assert.equal((await Promise.all([repository.expire(),repository.expire()])).reduce((sum,value)=>sum+value,0),1);
    assert.equal(await repository.expire(),0);
    const competing=(await register(5)).json();
    const simultaneous=await Promise.all([
      req('PUT',`/${competing.id}/heartbeat`,undefined,ankabotToken,competing.sessionToken),
      req('PUT',`/${competing.id}/close`,undefined,ankabotToken,competing.sessionToken),repository.expire()]);
    assert.ok([200,409].includes((simultaneous[0] as {statusCode:number}).statusCode));
    assert.equal((await repository.get(competing.id)).status,'closed');
    const competingExpiry=(await register(6)).json();await age(competingExpiry.id,'16 minutes');
    await Promise.all([repository.expire(),req('PUT',`/${competingExpiry.id}/heartbeat`,undefined,ankabotToken,competingExpiry.sessionToken)]);
    assert.equal((await repository.get(competingExpiry.id)).status,'expired');
    const adminClose=await req('PUT',`/${second.id}/close`,undefined,operatorToken);
    assert.equal(adminClose.statusCode,200);
    const queries=[await req('GET','',undefined,operatorToken),await req('GET',`/${first.id}`,undefined,operatorToken)];
    for(const response of queries){assert.equal(response.statusCode,200);for(const secret of [apiKey,first.sessionToken,stored.credential_hash])assert.ok(!response.body.includes(secret));}
    assert.equal((await req('GET')).statusCode,403);
    assert.equal((await req('GET',`/${first.id}`)).statusCode,403);
    assert.equal((await req('GET','/invalid',undefined,operatorToken)).statusCode,400);
    assert.equal((await req('GET','?status=bad',undefined,operatorToken)).statusCode,400);
    assert.equal((await req('POST','',{apiKey,hostname:'invalid host',pid:1})).statusCode,400);
    await assert.rejects(pool.query('DELETE FROM ankabot_licenses WHERE id=$1',[licenseId]),{code:'23001'});
    assert.equal((await operator('DELETE',`/api/ankabot-licenses/${licenseId}`)).statusCode,409);
    // Rotating license credentials must not revoke an existing session credential.
    const rotation=(await register(7)).json();
    await operator('PATCH',`/api/ankabot-licenses/${licenseId}`,{apiKey:'rotated-license-key'});
    assert.equal((await req('PUT',`/${rotation.id}/heartbeat`,undefined,ankabotToken,rotation.sessionToken)).statusCode,200);
    assert.equal((await register(8)).statusCode,401);
    assert.equal((await pool.query('SELECT count(*) FROM ankabot_sessions')).rows[0].count,'10');
  }finally{
    await app.close();await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();
  }
});
