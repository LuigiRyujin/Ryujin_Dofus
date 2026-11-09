import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {claimGroupsSchema,oldestTrio} from '../src/character-groups/claim.js';
test('claim input requires server and idempotency key without unknown fields',()=>{
  const input={serverId:1,idempotencyKey:randomUUID()};assert.deepEqual(claimGroupsSchema.parse(input),input);
  for(const candidate of [{}, {...input,serverId:0},{...input,serverId:2147483648},{...input,serverId:'1'},
    {...input,idempotencyKey:'bad'},{...input,extra:true}])assert.equal(claimGroupsSchema.safeParse(candidate).success,false);
});
test('trio selection looks beyond an incompatible oldest pair and preserves oldest feasible tuple',()=>{
  const candidates=[1,1,2,3].map((breed,index)=>({id:String(index),ankama_id:String(index),breed_id:breed,server_id:1,
    status:'C',completed_at:null,account_status:'C',created_at:new Date(index)}));
  assert.deepEqual(oldestTrio(candidates)?.map(c=>c.id),['0','2','3']);
  assert.equal(oldestTrio(candidates.slice(0,3)),null);
  const sameAccount=candidates.map(c=>({...c,ankama_id:'same'}));assert.equal(oldestTrio(sameAccount),null);
});
