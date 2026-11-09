import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {migrations,runMigrations} from '../src/migrations.js';

test('migration 7 rejects pre-existing overcapacity without changing data, then upgrades safely',
 {skip:!process.env.TEST_DATABASE_URL},async()=>{
 const url=new URL(process.env.TEST_DATABASE_URL!);url.hostname=url.hostname.replace('-pooler','');url.searchParams.set('sslmode','verify-full');
 const admin=new Pool({connectionString:url.toString()}),schema='claim_migration_'+randomUUID().replaceAll('-','');
 await admin.query(`CREATE SCHEMA ${schema}`);url.searchParams.set('options',`-c search_path=${schema}`);
 const pool=new Pool({connectionString:url.toString()});
 try{
  await pool.query('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  for(const migration of migrations.filter(m=>m.version<7)){await pool.query(migration.sql);await pool.query('INSERT INTO schema_migrations(version) VALUES($1)',[migration.version]);}
  const licenseId=randomUUID(),sessionId=randomUUID(),groupId=randomUUID();
  await pool.query("INSERT INTO ankabot_licenses(id,api_key_encrypted,api_key_fingerprint,max_characters) VALUES($1,'secret','old-license',2)",[licenseId]);
  await pool.query("INSERT INTO ankabot_sessions(id,ankabot_license_id,hostname,pid,credential_hash) VALUES($1,$2,'pc',1,$3)",[sessionId,licenseId,'a'.repeat(64)]);
  const ids:string[]=[];
  for(let breed=1;breed<=3;breed++){
   const email=randomUUID(),account=randomUUID(),character=randomUUID();ids.push(character);
   await pool.query("INSERT INTO email_accounts(id,email,password_encrypted,original_encrypted) VALUES($1,$2,'secret','secret')",[email,email+'@example.com']);
   await pool.query("INSERT INTO ankama_accounts(id,login,password_encrypted,email_id) VALUES($1,$2,'secret',$3)",[account,account,email]);
   await pool.query('INSERT INTO characters(id,ankama_id,email_id,name,breed_id,server_id) VALUES($1,$2,$3,$4,$5,1)',[character,account,email,character,breed]);
  }
  await pool.query('INSERT INTO character_groups(id) VALUES($1)',[groupId]);
  await pool.query('INSERT INTO group_members(group_id,character_id) SELECT $1,unnest($2::uuid[])',[groupId,ids]);
  await pool.query("UPDATE character_groups SET status='active',session_id=$2,session_slot=1 WHERE id=$1",[groupId,sessionId]);
  await assert.rejects(runMigrations(pool),{code:'23514'});
  assert.equal((await pool.query('SELECT count(*) FROM schema_migrations WHERE version=7')).rows[0].count,'0');
  assert.equal((await pool.query('SELECT status FROM character_groups WHERE id=$1',[groupId])).rows[0].status,'active');
  assert.equal((await pool.query('SELECT count(*) FROM group_members')).rows[0].count,'3');
  // Explicit operator reconciliation, rather than migration silently discarding assignments.
  await pool.query('UPDATE ankabot_licenses SET max_characters=3 WHERE id=$1',[licenseId]);
  await runMigrations(pool);await runMigrations(pool);
  assert.ok((await pool.query('SELECT assignment_id FROM character_groups WHERE id=$1',[groupId])).rows[0].assignment_id);
 }finally{await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}
});
