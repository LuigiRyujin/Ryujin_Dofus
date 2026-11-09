import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createCharacter } from '../character.mjs';
import { ResultSpool } from '../spool.mjs';
import { randomBytes } from 'node:crypto';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
class Auth {generateCodeVerifier(){return 'v';}generateCodeChallenge(){return 'c';}async exchangeCodeForToken(){return {access_token:'a'};}async getAccountInfo(){return {id:1};}async createGameToken(){return 't';}}
const task={id:'x',login:'login',password:'password',parameters:{breedId:1,serverId:123}};
function fake({servers=[{id:123}],characters=[],rejectNames=0}={}){
 let attempts=0;let current=[...characters];
 class Client extends EventEmitter{
  static computeCosmeticId(){return 1;}async connect(){}disconnect(){}
  sendConnecting(){queueMicrotask(()=>this.emit('CharactersListMessage',{characters:current}));}
  sendMessage(type,body){queueMicrotask(()=>{
   if(type==='ServerSelectionMessage')this.emit('SelectedServerDataMessage',{address:'game',port:443,ticket:'ticket'});
   if(type==='CharacterNameSuggestionRequestMessage')this.emit('CharacterNameSuggestionSuccessMessage',{name:'Random'+String.fromCharCode(97+attempts)});
   if(type==='CharacterCreationRequestMessage'){attempts++;if(attempts>rejectNames)current.push({name:body.name,breed:1,id:99});this.emit('CharacterCreationResultMessage',{result:attempts<=rejectNames?3:0});}
   if(type==='CharactersListRequestMessage')this.emit('CharactersListMessage',{characters:current});
  });}
 }
 return {Client,AuthManager:Auth,probe:async()=>({ok:true}),handshake:async()=>({servers}),attempts:()=>attempts};
}
test('missing server never sends creation',async()=>{const deps=fake({servers:[]});await assert.rejects(createCharacter(task,async()=>{},async()=>({code:'c'}),deps),/SERVER_UNAVAILABLE/);assert.equal(deps.attempts(),0);});
test('name refusal tries at most five candidates',async()=>{const deps=fake({rejectNames:9});await assert.rejects(createCharacter(task,async()=>{},async()=>({code:'c'}),deps),/NAME_ATTEMPTS_EXHAUSTED/);assert.equal(deps.attempts(),5);});
test('existing checkpoint reconciles without creation',async()=>{const deps=fake({characters:[{id:44,name:'Saved',breed:1}]});const result=await createCharacter({...task,parameters:{...task.parameters,name:'Saved'}},async()=>{},async()=>({code:'c'}),deps);assert.equal(result.externalId,'44');assert.equal(deps.attempts(),0);});
test('checkpoints before send and confirms exact external identifier',async()=>{const deps=fake();let checkpoints=0;const result=await createCharacter(task,async body=>{assert.equal(body.submitted,true);assert.ok(body.parameters.name);checkpoints++;},async()=>({code:'c'}),deps);assert.equal(checkpoints,1);assert.equal(result.externalId,'99');});
test('failed checkpoint prevents creation',async()=>{const deps=fake();await assert.rejects(createCharacter(task,async()=>{throw Error('LEASE_LOST');},async()=>({code:'c'}),deps),/LEASE_LOST/);assert.equal(deps.attempts(),0);});
test('encrypted spool survives restart and removes after acknowledgement',async()=>{const directory=await mkdtemp(join(tmpdir(),'ryujin-'));try{const key=randomBytes(32).toString('base64');const spool=new ResultSpool(directory,key);await spool.save('abc',{secret:'protected',result:{name:'Name'}});assert.ok(!(await readFile(join(directory,'abc.json'),'utf8')).includes('protected'));assert.deepEqual((await new ResultSpool(directory,key).list())[0].body.result,{name:'Name'});await spool.remove('abc');assert.deepEqual(await spool.list(),[]);}finally{await rm(directory,{recursive:true,force:true});}});
