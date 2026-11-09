import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerSessionSchema } from '../src/ankabot-sessions/validation.js';
import { sessionCredentialMatches, createSessionCredential } from '../src/ankabot-sessions/credentials.js';
import { SessionExpirationJob } from '../src/ankabot-sessions/job.js';
import { readConfig } from '../src/config.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('session validation normalizes Windows identity and checks PID bounds', () => {
  assert.equal(registerSessionSchema.parse({apiKey:'key',hostname:' PC-01 ',pid:4294967295}).hostname,'pc-01');
  for(const hostname of ['', 'a b','a\nb','a\n','\tpc','a'.repeat(256)])
    assert.equal(registerSessionSchema.safeParse({apiKey:'key',hostname,pid:1}).success,false);
  for(const pid of [0,-1,1.5,4294967296,'1'])
    assert.equal(registerSessionSchema.safeParse({apiKey:'key',hostname:'pc',pid}).success,false);
});
test('session credentials are random and compared through hashes', () => {
  const first=createSessionCredential(), second=createSessionCredential();
  assert.notEqual(first.token,second.token); assert.notEqual(first.hash,first.token);
  assert.equal(sessionCredentialMatches(first.token,first.hash),true);
  assert.equal(sessionCredentialMatches(second.token,first.hash),false);
  assert.equal(sessionCredentialMatches(undefined,first.hash),false);
});
test('expiration configuration defaults and validates its range', () => {
  const env={DATABASE_URL:'postgresql://user:password@localhost/test'};
  assert.equal(readConfig(env).ankabotSessionExpirationIntervalMs,60000);
  for(const value of ['0','999','3600001','1.5','bad',''])
    assert.throws(()=>readConfig({...env,ANKABOT_SESSION_EXPIRATION_INTERVAL_MS:value}));
});
test('expiration job starts immediately, recovers and stops waiting for in-flight work', async () => {
  let calls=0, release!:()=>void;
  const running=new Promise<void>(resolve=>{release=resolve;});
  const job=new SessionExpirationJob(async()=>{calls++; await running; return 1;},1000,()=>{},()=>{});
  const start=job.start(); await Promise.resolve(); assert.equal(calls,1);
  let stopped=false; const stop=job.stop().then(()=>{stopped=true;});
  await Promise.resolve(); assert.equal(stopped,false);
  release(); await start; await stop; assert.equal(stopped,true);
  await job.start(); assert.equal(calls,1);
});

test('expiration job retries after synchronous failure without overlapping or leaking errors', async () => {
  let calls=0,failures=0,complete!:()=>void;
  const recovered=new Promise<void>(resolve=>{complete=resolve;});
  const job=new SessionExpirationJob(()=>{
    calls++; if(calls===1)throw new Error('sensitive database error');
    complete(); return Promise.resolve(2);
  },10,count=>assert.equal(count,2),()=>{failures++;});
  const timeout=setTimeout(()=>complete(),1000);
  try{
    await job.start(); assert.equal(calls,1); assert.equal(failures,1);
    await job.start();assert.equal(calls,1);
    await recovered; await job.stop(); assert.equal(calls,2);
  }finally{clearTimeout(timeout);await job.stop();}
});

test('HTTP logging excludes session headers, license keys and query credentials', async () => {
  const headerSecret='SESSION_HEADER_SECRET_123456789';
  const bodySecret='LICENSE_BODY_SECRET_123456789';
  const querySecret='QUERY_SECRET_123456789';
  const appUrl=new URL('../src/app.ts',import.meta.url).href;
  const source=`import {buildApp} from ${JSON.stringify(appUrl)};
    const app=buildApp({databaseUrl:'postgresql://user:password@127.0.0.1:1/test',port:3000});
    await app.inject({method:'POST',url:'/api/services/ankabot/sessions?secret=${querySecret}',
      headers:{'x-ankabot-session-token':'${headerSecret}'},
      payload:{apiKey:'${bodySecret}',hostname:'pc',pid:1}});
    await app.close();`;
  const {stdout,stderr}=await promisify(execFile)(process.execPath,['--import','tsx','--input-type=module','-e',source]);
  assert.ok(stdout.includes('incoming request'));
  for(const secret of [headerSecret,bodySecret,querySecret])assert.ok(!(stdout+stderr).includes(secret));
});
