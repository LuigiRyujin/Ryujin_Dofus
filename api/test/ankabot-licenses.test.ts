import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLicenseSchema, updateLicenseSchema, licenseFiltersSchema } from '../src/ankabot-licenses/validation.js';
import { fingerprintApiKey, maskApiKey } from '../src/ankabot-licenses/credentials.js';
import { randomBytes } from 'node:crypto';

test('license validation rejects malformed credentials and capacities without normalizing secrets', () => {
  assert.equal(createLicenseSchema.parse({apiKey:'opaque'}).maxCharacters,40);
  for(const apiKey of ['', ' space', 'space ', 'a b', 'a\n', 'é', 'a'.repeat(4097), null])
    assert.equal(createLicenseSchema.safeParse({apiKey}).success,false);
  assert.equal(createLicenseSchema.safeParse({apiKey:'!'.repeat(4096)}).success,true);
  for(const maxCharacters of [0,-1,1.2,2147483648,'40',null])
    assert.equal(createLicenseSchema.safeParse({apiKey:'key',maxCharacters}).success,false);
  assert.equal(updateLicenseSchema.safeParse({}).success,false);
  assert.deepEqual(updateLicenseSchema.parse({apiKey:'new'}),{apiKey:'new'});
  assert.equal(createLicenseSchema.safeParse({apiKey:'key',extra:true}).success,false);
  assert.equal(licenseFiltersSchema.safeParse({pageSize:101}).success,false);
});

test('fingerprints are deterministic, domain keyed and case sensitive; masks protect short keys', () => {
  const key=randomBytes(32).toString('base64');
  assert.equal(fingerprintApiKey('Abcd',key),fingerprintApiKey('Abcd',key));
  assert.notEqual(fingerprintApiKey('Abcd',key),fingerprintApiKey('abcd',key));
  assert.notEqual(fingerprintApiKey('Abcd',key),fingerprintApiKey('Abcd',randomBytes(32).toString('base64')));
  assert.equal(maskApiKey('short'),'********');
  assert.equal(maskApiKey('long-api-key'),'********-key');
});
