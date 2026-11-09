import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {heartbeatBodySchema,progressSchema,progressFingerprint} from '../src/character-progress/validation.js';

test('heartbeat accepts legacy requests and validates versioned reports',()=>{
  assert.equal(heartbeatBodySchema.safeParse(undefined).success,true);
  assert.equal(heartbeatBodySchema.safeParse({}).success,true);
  const characterId=randomUUID(),assignmentId=randomUUID();
  const report={schemaVersion:1,sequence:1,loadedCharacters:[{characterId,assignmentId}]};
  assert.equal(heartbeatBodySchema.safeParse(report).success,true);
  assert.equal(heartbeatBodySchema.safeParse({...report,loadedCharacters:[{characterId:characterId.toUpperCase(),assignmentId}]}).success,true);
  assert.equal(heartbeatBodySchema.safeParse({...report,loadedCharacters:[{characterId,assignmentId},{characterId:characterId.toUpperCase(),assignmentId}]}).success,false);
  for(const body of [null,{...report,schemaVersion:2},{...report,sequence:0},
    {...report,loadedCharacters:[report.loadedCharacters[0],report.loadedCharacters[0]]},
    {...report,loadedCharacters:Array.from({length:65},()=>({characterId:randomUUID(),assignmentId}))}, {...report,extra:true}])
    assert.equal(heartbeatBodySchema.safeParse(body).success,false);
});
test('progress is a strict versioned snapshot with bounded JSON and stable fingerprint',()=>{
  const body={schemaVersion:1,assignmentId:randomUUID(),updateId:randomUUID(),baseRevision:0,quest:null,data:{b:2,a:1},completed:false};
  assert.equal(progressSchema.safeParse(body).success,true);
  for(const bad of [{...body,baseRevision:-1},{...body,schemaVersion:2},{...body,data:{x:'a'.repeat(16384)}},
    {...body,quest:{id:'',stepId:null}},{...body,completed:'true'},{...body,extra:true}])
    assert.equal(progressSchema.safeParse(bad).success,false);
  const id=randomUUID();
  assert.equal(progressFingerprint(id,body),progressFingerprint(id,{...body,data:{a:1,b:2}}));
  assert.notEqual(progressFingerprint(id,body),progressFingerprint(randomUUID(),body));
});
