import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {banEventSchema,banFingerprint} from '../src/ban-events/validation.js';

test('ban events require strict versioned target, reason and complete sender identity',()=>{
  const body={schemaVersion:1,eventId:randomUUID(),target:{type:'character',id:randomUUID()},reasonCode:'BAN_CONFIRMED'};
  assert.equal(banEventSchema.safeParse(body).success,true);
  for(const invalid of [{...body,schemaVersion:2},{...body,reasonCode:'bad reason'},
    {...body,description:'x'.repeat(1001)},{...body,description:'x\n'},
    {...body,sessionId:randomUUID()},{...body,assignmentId:randomUUID()},
    {...body,target:{type:'email',id:randomUUID()}},{...body,extra:true}])
    assert.equal(banEventSchema.safeParse(invalid).success,false);
  assert.equal(banEventSchema.parse({...body,target:{...body.target,id:body.target.id.toUpperCase()}}).target.id,body.target.id);
  assert.equal(banFingerprint(body),banFingerprint({...body,target:{id:body.target.id,type:'character'}}));
});
