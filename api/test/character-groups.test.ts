import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {memberIdsSchema,groupFiltersSchema} from '../src/character-groups/types.js';
import {canTransition} from '../src/character-groups/service.js';
test('group inputs and lifecycle reject duplicates, oversize and forbidden transitions',()=>{
  assert.equal(memberIdsSchema.safeParse([]).success,true);
  const id=randomUUID();assert.equal(memberIdsSchema.safeParse([id,id]).success,false);
  assert.equal(memberIdsSchema.safeParse(Array.from({length:4},()=>randomUUID())).success,false);
  assert.equal(groupFiltersSchema.safeParse({pageSize:101}).success,false);
  assert.equal(canTransition('forming','active'),true);
  assert.equal(canTransition('active','completed'),true);
  assert.equal(canTransition('abandoned','active'),true);
  assert.equal(canTransition('completed','active'),false);
  assert.equal(canTransition('awaiting_restart','active'),false);
});
