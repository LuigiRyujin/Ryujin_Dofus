import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ResultSpool } from './spool.mjs';
import { createCharacter, probeCompatibility } from './character.mjs';
if(process.env.RYUJIN_AUTOMATION_ENABLED!=='1'){console.log('Automation disabled. Set RYUJIN_AUTOMATION_ENABLED=1 after validation.');process.exit(0);}
const base=new URL(process.env.RYUJIN_API_URL);if(base.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(base.hostname))throw Error('HTTPS required');
const workerId=process.env.RYUJIN_WORKER_ID??'local';
const spool=new ResultSpool(process.env.RYUJIN_SPOOL_DIRECTORY??fileURLToPath(new URL('./.state/',import.meta.url)),process.env.RYUJIN_SPOOL_KEY??'');
process.env.RYUJIN_SPOOL_DIRECTORY=spool.directory;
const localToken=randomBytes(32).toString('hex');const port=process.env.RYUJIN_LOCAL_PORT??'3139';
const browser=spawn(process.env.RYUJIN_PYTHON??'python',[fileURLToPath(new URL('./browser_service.py',import.meta.url))],{env:{...process.env,RYUJIN_LOCAL_TOKEN:localToken,RYUJIN_LOCAL_PORT:port},stdio:['ignore','ignore','ignore'],windowsHide:true});
let stopping=false;for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;browser.kill();});
browser.on('exit',()=>{stopping=true;});
browser.on('error',()=>{stopping=true;console.error('Browser service unavailable.');});
export async function api(path,body){const response=await fetch(new URL('/api/'+path,base),{method:'POST',headers:{Authorization:'Bearer '+process.env.RYUJIN_OPERATOR_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('API_REQUEST_FAILED');return response.json();}
async function local(path,body){const response=await fetch(`http://127.0.0.1:${port}${path}`,{method:'POST',headers:{'X-Ryujin-Local-Token':localToken,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(900000)});if(!response.ok)throw Error('LOCAL_FLOW_FAILED');return response.json();}
async function replay(){for(const item of await spool.list()){await api('creation-worker/'+item.id+'/report',item.body);await spool.remove(item.id);}}
await new Promise(resolve=>setTimeout(resolve,1500));
try{while(!stopping){try{await replay();for(const type of ['ankama','character']){
 if(stopping)break;
 if(type==='character'&&!(await probeCompatibility()).ok)continue;
 const {operation}=await api('creation-worker/claim',{workerId,type});if(!operation)continue;
 const owner={workerId,leaseToken:operation.leaseToken};let result;let state='completed';
 try{result=type==='ankama'?await local('/register',{operation,owner}):await createCharacter(operation,async extra=>api('creation-worker/'+operation.id+'/heartbeat',{...owner,stage:'character',...extra}),body=>local('/auth',body));}
 catch{if((await spool.list()).some(item=>item.id===operation.id)){await replay();continue;}state='failed';}
 const report={...owner,state,...(result?{result}:{})};await spool.save(operation.id,report);await replay();
 }}catch{console.error('Worker paused: inspect API connectivity and pending results.');}await new Promise(resolve=>setTimeout(resolve,10000));}}finally{browser.kill();}
