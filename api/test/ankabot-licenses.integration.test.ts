import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { buildApp } from '../src/app.js';
import { migrations, runMigrations } from '../src/migrations.js';
import { decrypt } from '../src/crypto.js';
import { AnkabotLicenseRepository } from '../src/ankabot-licenses/repository.js';
import { fingerprintApiKey } from '../src/ankabot-licenses/credentials.js';

for (const upgrade of [false, true]) {
  test(`licenses PostgreSQL CRUD/security/races; ${upgrade ? 'upgrade v3' : 'empty database'}`,
    { skip: !process.env.TEST_DATABASE_URL }, async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    url.hostname = url.hostname.replace('-pooler', '');
    url.searchParams.set('sslmode', 'verify-full');
    const admin = new Pool({ connectionString: url.toString() });
    const schema = 'licenses_test_' + randomUUID().replaceAll('-', '');
    await admin.query(`CREATE SCHEMA ${schema}`);
    url.searchParams.set('options', `-c search_path=${schema}`);
    const pool = new Pool({ connectionString: url.toString() });
    const key = randomBytes(32).toString('base64');
    const operatorToken = randomBytes(32).toString('hex');
    const ankabotToken = randomBytes(32).toString('hex');
    const app = buildApp({ databaseUrl: url.toString(), port: 3000, encryptionKey: key, operatorToken, ankabotToken });
    const path = '/api/ankabot-licenses';
    const req = (method: string, suffix = '', payload?: unknown, token: string | null = operatorToken) =>
      app.inject({ method: method as 'GET', url: path + suffix,
        headers: token ? { authorization: `Bearer ${token}` } : {},
        ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }) });
    try {
      if (upgrade) {
        await pool.query('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
        for (const migration of migrations.filter(item => item.version < 4)) {
          await pool.query(migration.sql);
          await pool.query('INSERT INTO schema_migrations(version) VALUES($1)', [migration.version]);
        }
      }
      await app.ready();
      await runMigrations(pool);
      assert.equal((await pool.query('SELECT count(*) FROM schema_migrations WHERE version=4')).rows[0].count, '1');
      const secret = 'opaque-Sensitive-API-key-1234';
      const created = await req('POST', '', { apiKey: secret });
      assert.equal(created.statusCode, 201, created.body);
      const license = created.json();
      assert.equal(license.maxCharacters, 40);
      assert.equal(license.apiKeyMasked, '********1234');
      assert.deepEqual(Object.keys(license).sort(), ['id','apiKeyMasked','maxCharacters','createdAt','updatedAt'].sort());
      assert.ok(!created.body.includes(secret));
      const stored = (await pool.query('SELECT * FROM ankabot_licenses WHERE id=$1', [license.id])).rows[0];
      assert.notEqual(stored.api_key_encrypted, secret);
      assert.ok(!stored.api_key_encrypted.includes(secret));
      assert.equal(decrypt(stored.api_key_encrypted, key), secret);
      assert.equal(stored.api_key_fingerprint, fingerprintApiKey(secret, key));
      const repository = new AnkabotLicenseRepository(pool, key);
      assert.equal((await repository.findById(license.id))?.maxCharacters, 40);
      assert.equal((await repository.findByFingerprint(stored.api_key_fingerprint))?.id, license.id);
      assert.equal(await repository.findByFingerprint('missing'), null);
      assert.equal((await req('GET', `/${license.id}`)).json().id, license.id);
      const listed = (await req('GET', '?page=1&pageSize=1')).json();
      assert.equal(listed.total, 1); assert.equal(listed.items.length, 1);
      assert.ok(!JSON.stringify(listed).includes(secret));
      assert.ok(!JSON.stringify(listed).includes(stored.api_key_fingerprint));
      assert.equal((await req('GET', '?page=2&pageSize=1')).json().items.length, 0);
      assert.equal((await req('POST', '', { apiKey: secret })).statusCode, 409);
      const race = await Promise.all([req('POST', '', { apiKey:'race-license' }), req('POST', '', { apiKey:'race-license' })]);
      assert.deepEqual(race.map(result => result.statusCode).sort(), [201,409]);
      const raceId = race.find(result => result.statusCode === 201)!.json().id;
      assert.equal((await req('PATCH', `/${raceId}`, { apiKey:secret })).statusCode,409);
      const capacity = (await req('PATCH', `/${license.id}`, { maxCharacters:55 })).json();
      assert.equal(capacity.maxCharacters,55); assert.equal(capacity.apiKeyMasked,license.apiKeyMasked);
      assert.ok(new Date(capacity.updatedAt) >= new Date(license.updatedAt));
      const changed = (await req('PATCH', `/${license.id}`, { apiKey:'short' })).json();
      assert.equal(changed.maxCharacters,55); assert.equal(changed.apiKeyMasked,'********');
      const updateRace = await Promise.all([req('PATCH', `/${license.id}`, {apiKey:'same-new-key'}), req('PATCH', `/${raceId}`, {apiKey:'same-new-key'})]);
      assert.deepEqual(updateRace.map(result => result.statusCode).sort(),[200,409]);
      assert.equal((await req('POST', '', {apiKey:'CaseKey'})).statusCode,201);
      assert.equal((await req('POST', '', {apiKey:'casekey'})).statusCode,201);
      for(const body of [{}, {apiKey:''}, {apiKey:' bad'}, {apiKey:'a\n'}, {apiKey:'a'.repeat(4097)}, {apiKey:'key',maxCharacters:0}, {apiKey:'key',maxCharacters:1.5}, {apiKey:'key',maxCharacters:2147483648}, {apiKey:'key',extra:true}])
        assert.equal((await req('POST','',body)).statusCode,400);
      for(const body of [{}, {maxCharacters:null}, {maxCharacters:-1}, {apiKey:' bad'}, {unknown:true}])
        assert.equal((await req('PATCH',`/${license.id}`,body)).statusCode,400);
      assert.equal((await req('GET','/invalid')).statusCode,400);
      assert.equal((await req('GET','?pageSize=101')).statusCode,400);
      const missing = randomUUID();
      assert.equal((await req('GET',`/${missing}`)).statusCode,404);
      assert.equal((await req('PATCH',`/${missing}`,{maxCharacters:10})).statusCode,404);
      assert.equal((await req('DELETE',`/${missing}`)).statusCode,404);
      for(const [method,suffix,body] of [['GET','',undefined],['GET',`/${license.id}`,undefined],['POST','',{apiKey:'unauthorized'}],['PATCH',`/${license.id}`,{maxCharacters:3}],['DELETE',`/${license.id}`,undefined]] as const) {
        assert.equal((await req(method,suffix,body,ankabotToken)).statusCode,403);
        assert.equal((await req(method,suffix,body,null)).statusCode,401);
        assert.equal((await req(method,suffix,body,'invalid')).statusCode,401);
      }
      assert.equal((await req('DELETE',`/${license.id}`)).statusCode,204);
      assert.equal((await req('GET',`/${license.id}`)).statusCode,404);
      await assert.rejects(pool.query('INSERT INTO ankabot_licenses(id,api_key_encrypted,api_key_fingerprint,max_characters) VALUES($1,$2,$3,0)',[randomUUID(),'encrypted','invalid-capacity']),{code:'23514'});
    } finally {
      await app.close(); await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();
    }
  });
}
