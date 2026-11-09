import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomBytes,randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {buildApp} from '../src/app.js';
import {runMigrations,migrations} from '../src/migrations.js';
test('real PostgreSQL account lifecycle, constraints, races, bot permissions',{skip:!process.env.TEST_DATABASE_URL},async()=>{
const url=new URL(process.env.TEST_DATABASE_URL!),schema='test_'+randomUUID().replaceAll('-',''),admin=new Pool({connectionString:url.toString()});url.hostname=url.hostname.replace('-pooler','');url.searchParams.set('sslmode','verify-full');await admin.query(`CREATE SCHEMA ${schema}`);url.searchParams.set('options',`-c search_path=${schema}`);const pool=new Pool({connectionString:url.toString()});
const operatorToken=randomBytes(32).toString('hex'),ankabotToken=randomBytes(32).toString('hex'),app=buildApp({databaseUrl:url.toString(),port:3000,operatorToken,ankabotToken,encryptionKey:randomBytes(32).toString('base64')});
const req=(method:string,path:string,payload?:unknown,bot=false)=>app.inject({method:method as 'GET',url:'/api'+path,headers:{authorization:'Bearer '+(bot?ankabotToken:operatorToken)},...(payload===undefined?{}:{payload:payload as Record<string,unknown>})});
try{await pool.query(migrations[0]!.sql);await pool.query('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');await pool.query('INSERT INTO schema_migrations(version) VALUES(1)');await runMigrations(pool);await runMigrations(pool);
const email=await req('POST','/emails',{email:'one@example.com',password:'secret'});assert.equal(email.statusCode,200,email.body);const emailId=email.json().id;
const accounts=await Promise.all([1,2].map(i=>req('POST','/ankama-accounts',{login:'user'+i,password:'literal|password|value',emailId})));assert.deepEqual(accounts.map(x=>x.statusCode).sort(),[200,409]);const account=accounts.find(x=>x.statusCode===200)!.json();assert.ok(!JSON.stringify(account).includes('password'));
assert.equal((await req('PATCH',`/emails/${emailId}/status`,{status:'D'})).statusCode,409);
const created=await req('POST','/characters',{ankamaId:account.id,name:'Hero',breedId:1,serverId:100});assert.equal(created.statusCode,200,created.body);const id=created.json().id;
assert.equal((await req('POST','/characters',{ankamaId:account.id,name:'hErO',breedId:1,serverId:100})).statusCode,409);
for(const status of ['E','F','C','B','E'])assert.equal((await req('PATCH',`/characters/${id}/status`,{status},true)).statusCode,200);
const first=await req('PATCH',`/characters/${id}/status`,{status:'E'},true),second=await req('PATCH',`/characters/${id}/status`,{status:'E'},true);assert.equal(first.json().updatedAt,second.json().updatedAt);
assert.equal((await req('POST',`/ankama-accounts/${account.id}/reveal`,undefined,true)).statusCode,403);assert.equal((await req('POST',`/ankama-accounts/${account.id}/reveal`)).json().password,'literal|password|value');
assert.equal((await req('PATCH',`/ankama-accounts/${account.id}/status`,{status:'B'})).statusCode,200);assert.equal((await req('GET',`/characters/${id}`,undefined,true)).json().status,'B');await req('PATCH',`/ankama-accounts/${account.id}/status`,{status:'C'});assert.equal((await req('GET',`/characters/${id}`)).json().status,'B');
await assert.rejects(pool.query('INSERT INTO characters(id,ankama_id,email_id,name,breed_id,server_id) VALUES($1,$2,$3,$4,1,100)',[randomUUID(),account.id,randomUUID(),'Mismatch']),{code:'23503'});
assert.equal((await req('PATCH',`/characters/${id}/status`,{status:'X'},true)).statusCode,400);assert.equal((await req('PATCH',`/characters/${randomUUID()}/status`,{status:'E'},true)).statusCode,404);assert.equal((await app.inject('/api/characters')).statusCode,401);
const email2=(await req('POST','/emails',{email:'two@example.com',password:'mailpass'})).json();const idem=randomUUID();
const start=await req('POST','/ankama-creation-operations',{emailId:email2.id,idempotencyKey:idem});assert.equal(start.statusCode,202,start.body);const operation=start.json();
assert.ok(!JSON.stringify(operation).includes('password'));assert.equal((await req('POST','/ankama-creation-operations',{emailId:email2.id,idempotencyKey:idem})).json().id,operation.id);
assert.equal((await req('POST','/ankama-creation-operations',{emailId:emailId,idempotencyKey:idem})).statusCode,409);
assert.equal((await req('PATCH',`/emails/${email2.id}/status`,{status:'D'})).statusCode,409);
const claims=await Promise.all([1,2].map(i=>req('POST','/creation-worker/claim',{workerId:'worker'+i,type:'ankama'})));
const claim=claims.find(x=>x.json().operation)?.json().operation;assert.ok(claim);assert.equal(claims.filter(x=>x.json().operation).length,1);
const workerId=claims[0]!.json().operation?'worker1':'worker2';
assert.equal((await req('POST',`/creation-worker/${operation.id}/heartbeat`,{workerId,leaseToken:claim.leaseToken,stage:'submitted',submitted:true})).statusCode,200);
await pool.query("UPDATE creation_operations SET lease_until=NOW()-INTERVAL '1 minute' WHERE id=$1",[operation.id]);
await req('POST','/creation-worker/claim',{workerId:'third',type:'ankama'});
assert.equal((await req('GET',`/creation-operations/${operation.id}`)).json().state,'uncertain');assert.equal((await req('POST',`/creation-operations/${operation.id}/retry`,{})).statusCode,409);
const report={workerId,leaseToken:claim.leaseToken,state:'completed',result:{login:'confirmed'}};
assert.equal((await req('POST',`/creation-worker/${operation.id}/report`,report)).statusCode,200);
const replay=await req('POST',`/creation-worker/${operation.id}/report`,report);assert.equal(replay.statusCode,200,replay.body);assert.equal(replay.json().state,'completed');
assert.equal(Number((await pool.query('SELECT count(*) FROM ankama_accounts WHERE email_id=$1',[email2.id])).rows[0].count),1);
assert.equal((await req('POST','/creation-worker/claim',{workerId:'bot',type:'ankama'},true)).statusCode,403);
}finally{await app.close();await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}
});



