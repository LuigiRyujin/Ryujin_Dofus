import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { encryptCredentials, decryptCredentials } from '../src/emails/crypto.js';
import { parseImportCsv, normalizeAccount, csvCell } from '../src/emails/validation.js';

test('credentials round trip with authenticated encryption and preserve original', () => {
  const key = randomBytes(32).toString('base64');
  const original = 'password|refresh-token|client-id';
  const encrypted = encryptCredentials(original, key);
  assert.ok(!encrypted.includes('password'));
  assert.notEqual(encrypted, encryptCredentials(original, key));
  assert.deepEqual(decryptCredentials(encrypted, key), {
    password: 'password', refreshToken: 'refresh-token', clientId: 'client-id', original,
  });
  assert.throws(() => decryptCredentials(encrypted, randomBytes(32).toString('base64')));
});

test('CSV parses quoted credentials, validates dates and statuses without exposing credentials', () => {
  const parsed = parseImportCsv('email,senha,data_compra,status\r\nONE@Example.com,"a,b",2024-02-29,D\r\ntwo@example.com,topsecret,2025-02-29,D');
  assert.equal(parsed.accounts[0]?.email, 'one@example.com');
  assert.equal(parsed.accounts[0]?.password, 'a,b');
  assert.equal(parsed.errors.length, 1);
  assert.ok(!JSON.stringify(parsed.errors).includes('topsecret'));
  assert.throws(() => normalizeAccount({ email: 'x@example.com', password: 'secret', status: 'X' }));
});

test('unknown dates stay null and exported cells cannot become formulas', () => {
  assert.equal(normalizeAccount({ email: ' X@Example.com ', password: 'secret' }).purchaseDate, null);
  assert.equal(csvCell('=1+1'), '"\'=1+1"');
  assert.equal(csvCell('a"b'), '"a""b"');
});
