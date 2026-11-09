import Client from './protocol/DofusTouchClient.cjs';
import AuthManager from './protocol/AuthManager.cjs';
import compatibility from './protocol/login-compatibility.cjs';
import build from './protocol/client-build.cjs';
import handshake from './protocol/login-handshake.cjs';
import { randomBytes, randomInt } from 'node:crypto';
export async function probeCompatibility(){try{Client.DEFAULT_CONFIG;const version=await build.fetchOfficialBuildVersion();const result=await compatibility.probeLoginCompatibility({createClient:()=>new Client({buildVersion:version})});return {...result,version};}catch{return {ok:false,reason:'COMPATIBILITY_UNCONFIRMED'};}}
function wait(client,event,send,timeout=30000){return new Promise((resolve,reject)=>{const finish=(error,value)=>{clearTimeout(timer);client.off(event,success);client.off('error',failure);client.off('close',closed);error?reject(error):resolve(value);};const success=value=>finish(null,value);const failure=()=>finish(Error('TRANSPORT_ERROR'));const closed=()=>finish(Error('TRANSPORT_CLOSED'));const timer=setTimeout(()=>finish(Error('PROTOCOL_TIMEOUT')),timeout);client.once(event,success);client.once('error',failure);client.once('close',closed);try{send();}catch(e){finish(e);}});}
export async function createCharacter(operation,checkpoint,authenticate,dependencies={}){
 const ProtocolClient=dependencies.Client??Client;const Auth=dependencies.AuthManager??AuthManager;const probeConnection=dependencies.probe??probeCompatibility;const loginHandshake=dependencies.handshake??handshake.authenticateLoginServer;
 const p=operation.parameters;const auth=new Auth();const verifier=auth.generateCodeVerifier();
 const state=randomBytes(24).toString('hex');
 const authorizeUrl='https://auth.ankama.com/login/ankama?'+new URLSearchParams({state,client_id:'18',code_challenge:auth.generateCodeChallenge(verifier),code_challenge_method:'S256',redirect_uri:'dofustouch://authorized'});
 let stage='authenticating';let lost=false;const timer=setInterval(()=>checkpoint({stage}).catch(()=>{lost=true;}),20000);
 let client;
 try{
 const {code}=await authenticate({login:operation.login,password:operation.password,authorizeUrl,state});
 const tokens=await auth.exchangeCodeForToken(code,verifier);const account=await auth.getAccountInfo(tokens.access_token);const gameToken=await auth.createGameToken(tokens.access_token);
 const probe=await probeConnection();if(!probe.ok)throw Error('COMPATIBILITY_UNCONFIRMED');
 client=new ProtocolClient({buildVersion:probe.version});await client.connect(null,false,null);
 const {servers}=await loginHandshake({client,accountId:account.id,gameToken});
 const target=servers.find(s=>Number(s.id)===p.serverId);if(!target)throw Error('SERVER_UNAVAILABLE');
 const ticket=await wait(client,'SelectedServerDataMessage',()=>client.sendMessage('ServerSelectionMessage',{serverId:p.serverId}));
 await client.connect(ticket._access||`wss://${ticket.address}:${ticket.port}/primus/`,true,null);
 const charactersPromise=new Promise((resolve,reject)=>{
 const timeout=setTimeout(()=>reject(Error('GAME_AUTH_TIMEOUT')),30000);
 client.once('HelloGameMessage',()=>client.sendMessage('AuthenticationTicketMessage',{ticket:ticket.ticket,lang:'fr'}));
 const list=()=>client.sendMessage('CharactersListRequestMessage',{});
 client.once('AuthenticationTicketAcceptedMessage',list);client.once('TrustStatusMessage',list);
 client.once('CharactersListMessage',m=>{clearTimeout(timeout);resolve(m.characters??[]);});
 client.once('LoginInviteCodeRequiredMessage',()=>{clearTimeout(timeout);reject(Error('SERVER_INVITE_REQUIRED'));});
 });client.sendConnecting({address:ticket.address,port:ticket.port,id:p.serverId});
 let characters=await charactersPromise;
 if(p.name){const found=characters.find(c=>c.name===p.name&&Number(c.breed)===p.breedId);if(found)return {name:found.name,externalId:String(found.id),attributes:p.attributes??{}};}
 if(p.reconcileOnly)throw Error('RECONCILIATION_UNCONFIRMED');
 const sex=p.attributes?.sex??Boolean(randomInt(2));const head=p.attributes?.head??randomInt(8);const colors=p.attributes?.colors??Array.from({length:5},()=>randomInt(0x1000000));const attributes={sex,head,colors};
 for(let attempt=0;attempt<5;attempt++){
  const suggestion=await wait(client,'CharacterNameSuggestionSuccessMessage',()=>client.sendMessage('CharacterNameSuggestionRequestMessage',{}));const name=attempt===0&&p.name?p.name:(suggestion.suggestion||suggestion.name);
  if(typeof name!=='string')throw Error('INVALID_NAME_SUGGESTION');
  stage='creating';await checkpoint({stage,parameters:{name,attributes},submitted:true});if(lost)throw Error('LEASE_LOST');
  const result=await wait(client,'CharacterCreationResultMessage',()=>client.sendMessage('CharacterCreationRequestMessage',{name,breed:p.breedId,sex,colors,cosmeticId:ProtocolClient.computeCosmeticId(p.breedId,sex,head)}));
  if(result.result===3)continue;if(result.result!==0)throw Error('CHARACTER_CREATION_REFUSED');
  const list=await wait(client,'CharactersListMessage',()=>client.sendMessage('CharactersListRequestMessage',{}));const created=list.characters?.find(c=>c.name===name&&Number(c.breed)===p.breedId);
  if(!created)throw Error('CHARACTER_UNCONFIRMED');return {name:created.name,externalId:String(created.id),attributes};
 }
 throw Error('NAME_ATTEMPTS_EXHAUSTED');
 }finally{clearInterval(timer);client?.disconnect('FINISHED');}
}
