import { randomUUID, randomBytes, createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { encryptCredentials, decryptCredentials } from './emails/crypto.js';
import { ModuleError } from './emails/errors.js';

export const operationMigration = { version: 3, sql: `
CREATE TABLE creation_operations (
 id UUID PRIMARY KEY, type TEXT NOT NULL CHECK(type IN ('ankama','character')),
 idempotency_key UUID NOT NULL UNIQUE, request_hash TEXT NOT NULL,
 email_id UUID NOT NULL REFERENCES email_accounts(id), ankama_id UUID REFERENCES ankama_accounts(id),
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','completed','failed','uncertain')),
 parameters JSONB NOT NULL DEFAULT '{}', password_encrypted TEXT, code_encrypted TEXT,
 stage TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0,
 worker_id TEXT, lease_token UUID, lease_until TIMESTAMPTZ, submitted BOOLEAN NOT NULL DEFAULT FALSE,
 error TEXT, result_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX creation_character_active ON creation_operations(ankama_id) WHERE type='character' AND state IN ('queued','running','uncertain','failed');
` };
const columns = `id,type,state,email_id AS "emailId",ankama_id AS "ankamaId",parameters,stage,attempts,error,result_id AS "resultId",created_at AS "createdAt",updated_at AS "updatedAt"`;
const uuid = z.string().uuid();
const accountInput = z.object({emailId:uuid,idempotencyKey:uuid}).strict();
const characterInput = z.object({ankamaId:uuid,breedId:z.number().int().min(1).max(18),serverId:z.number().int().positive(),idempotencyKey:uuid}).strict();
const owner = z.object({workerId:z.string().min(1).max(100),leaseToken:uuid});
async function transaction<T>(pool:Pool, run:(client:PoolClient)=>Promise<T>):Promise<T> {
 const c=await pool.connect(); try { await c.query('BEGIN'); const value=await run(c); await c.query('COMMIT'); return value; } catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export function operationFingerprint(type:string,input:Record<string,unknown>) { return createHash('sha256').update(JSON.stringify({type,...input})).digest('hex'); }
export async function registerOperations(app:FastifyInstance,pool:Pool,key:string) {
 const get=async(id:string)=>{const r=await pool.query(`SELECT ${columns} FROM creation_operations WHERE id=$1`,[id]);if(!r.rows[0])throw new ModuleError(404,'OPERATION_NOT_FOUND','Operação não encontrada.');return r.rows[0];};
 for(const type of ['ankama','character'] as const) app.post(`/api/${type}-creation-operations`,async(req,reply)=>{
  const input=type==='ankama'?accountInput.parse(req.body):characterInput.parse(req.body);
  const {idempotencyKey,...parameters}=input; const hash=operationFingerprint(type,parameters);
  const id=await transaction(pool,async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[idempotencyKey]);
   const previous=await c.query('SELECT id,request_hash FROM creation_operations WHERE idempotency_key=$1',[idempotencyKey]);
   if(previous.rows[0]) {if(previous.rows[0].request_hash!==hash)throw new ModuleError(409,'IDEMPOTENCY_CONFLICT','Chave já usada com outros parâmetros.');return previous.rows[0].id as string;}
   const id=randomUUID(); let emailId:string;let ankamaId:string|null=null;
   if('emailId' in input){
    const r=await c.query('SELECT id,status FROM email_accounts WHERE id=$1 FOR UPDATE',[input.emailId]);
    if(!r.rows[0])throw new ModuleError(404,'EMAIL_NOT_FOUND','Email não encontrado.');
    if(r.rows[0].status!=='D')throw new ModuleError(409,'EMAIL_UNAVAILABLE','Email indisponível.');
    if((await c.query('SELECT id FROM ankama_accounts WHERE email_id=$1',[input.emailId])).rowCount)throw new ModuleError(409,'EMAIL_LINKED','Email já vinculado.');
    if((await c.query('SELECT id FROM email_reservations WHERE email_id=$1',[input.emailId])).rowCount)throw new ModuleError(409,'EMAIL_RESERVED','Email reservado.');
    emailId=input.emailId;
    await c.query('INSERT INTO email_reservations(email_id,id) VALUES($1,$2)',[emailId,id]);
   }else{
    const r=await c.query('SELECT id,email_id,status FROM ankama_accounts WHERE id=$1 FOR UPDATE',[input.ankamaId]);
    if(!r.rows[0])throw new ModuleError(404,'ANKAMA_NOT_FOUND','Conta não encontrada.');
    if(r.rows[0].status==='B')throw new ModuleError(409,'ANKAMA_BANNED','Conta banida.');
    const active=await c.query("SELECT id FROM creation_operations WHERE ankama_id=$1 AND type='character' AND state<>'completed'",[input.ankamaId]);
    if(active.rowCount)throw new ModuleError(409,'CHARACTER_OPERATION_EXISTS','Retome ou revise a operação existente.');
    ankamaId=input.ankamaId;emailId=r.rows[0].email_id;
   }
   const password=type==='ankama'?encryptCredentials(randomBytes(18).toString('base64url')+'#1aA',key):null;
   await c.query('INSERT INTO creation_operations(id,type,idempotency_key,request_hash,email_id,ankama_id,parameters,password_encrypted) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,type,idempotencyKey,hash,emailId,ankamaId,JSON.stringify(parameters),password]);return id;
  });return reply.code(202).send(await get(id));
 });
 app.get('/api/creation-operations',async()=>({items:(await pool.query(`SELECT ${columns} FROM creation_operations ORDER BY created_at DESC LIMIT 100`)).rows}));
 app.get('/api/creation-operations/:id',async req=>get(uuid.parse((req.params as {id:string}).id)));
 app.post('/api/creation-operations/:id/code',async req=>{
  const id=uuid.parse((req.params as {id:string}).id);const {code}=z.object({code:z.string().regex(/^\d{6}$/)}).strict().parse(req.body);
  const r=await pool.query("UPDATE creation_operations SET code_encrypted=$2,updated_at=NOW() WHERE id=$1 AND state='running' AND stage='waiting_code' RETURNING id",[id,encryptCredentials(code,key)]);
  if(!r.rowCount)throw new ModuleError(409,'NOT_WAITING_CODE','Operação não aguarda código.');return get(id);
 });
 app.post('/api/creation-operations/:id/retry',async req=>{
  const id=uuid.parse((req.params as {id:string}).id);
  const r=await pool.query("UPDATE creation_operations SET state='queued',stage='queued',error=NULL,worker_id=NULL,lease_token=NULL,lease_until=NULL,updated_at=NOW() WHERE id=$1 AND state='failed' AND submitted=FALSE RETURNING id",[id]);
  if(!r.rowCount)throw new ModuleError(409,'RETRY_UNSAFE','Somente falhas anteriores ao envio podem ser repetidas. Resultados incertos exigem reconciliação.');return get(id);
 });
 app.post('/api/creation-operations/:id/reconcile',async req=>{
  const id=uuid.parse((req.params as {id:string}).id);
  const r=await pool.query("UPDATE creation_operations SET state='queued',stage='reconciling',parameters=parameters || '{\"reconcileOnly\":true}'::jsonb,worker_id=NULL,lease_token=NULL,lease_until=NULL,updated_at=NOW() WHERE id=$1 AND type='character' AND state='uncertain' AND parameters->>'name' IS NOT NULL RETURNING id",[id]);
  if(!r.rowCount)throw new ModuleError(409,'RECONCILIATION_UNAVAILABLE','A reconcilia��o autom�tica exige um personagem com nome salvo e resultado incerto.');return get(id);
 });
 app.post('/api/creation-worker/claim',async req=>{
  const {workerId}=z.object({workerId:z.string().min(1).max(100),type:z.enum(['ankama','character'])}).strict().parse(req.body);
  const type=(req.body as {type:string}).type;
  return transaction(pool,async c=>{
   await c.query("UPDATE creation_operations SET state=CASE WHEN submitted THEN 'uncertain' ELSE 'failed' END,error='Execução interrompida; revise antes de retomar.',stage='interrupted',updated_at=NOW() WHERE state='running' AND lease_until<NOW()");
   const r=await c.query("SELECT * FROM creation_operations WHERE state='queued' AND type=$1 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",[type]);
   const row=r.rows[0];if(!row)return {operation:null};
   if(type==='character') {const account=await c.query('SELECT status FROM ankama_accounts WHERE id=$1 FOR UPDATE',[row.ankama_id]);if(account.rows[0]?.status!=='C')throw new ModuleError(409,'ANKAMA_BANNED','Conta indisponível.');}
   const token=randomUUID();await c.query("UPDATE creation_operations SET state='running',worker_id=$2,lease_token=$3,lease_until=NOW()+INTERVAL '2 minutes',attempts=attempts+1,updated_at=NOW() WHERE id=$1",[row.id,workerId,token]);
   const email=(await c.query('SELECT email,original_encrypted FROM email_accounts WHERE id=$1',[row.email_id])).rows[0];
   const account=type==='character'?(await c.query('SELECT login,password_encrypted FROM ankama_accounts WHERE id=$1',[row.ankama_id])).rows[0]:null;
   return {operation:{id:row.id,type,parameters:row.parameters,email:email.email,emailCredentials:decryptCredentials(email.original_encrypted,key),login:account?.login??email.email,password:decryptCredentials(account?.password_encrypted??row.password_encrypted,key).original,leaseToken:token}};
  });
 });
 app.post('/api/creation-worker/:id/heartbeat',async req=>{
  const id=uuid.parse((req.params as {id:string}).id);const body=owner.extend({stage:z.string().min(1).max(80),submitted:z.boolean().optional(),parameters:z.object({name:z.string().min(1).max(100),attributes:z.object({sex:z.boolean(),head:z.number().int().min(0).max(7),colors:z.array(z.number().int().min(0).max(16777215)).length(5)}).strict()}).strict().optional()}).strict().parse(req.body);
  const r=await pool.query("UPDATE creation_operations SET stage=$4,submitted=submitted OR $5,parameters=parameters || $6::jsonb,lease_until=NOW()+INTERVAL '2 minutes',updated_at=NOW() WHERE id=$1 AND worker_id=$2 AND lease_token=$3 AND state='running' AND lease_until>NOW() RETURNING code_encrypted",[id,body.workerId,body.leaseToken,body.stage,body.submitted??false,JSON.stringify(body.parameters??{})]);
  if(!r.rows[0])throw new ModuleError(409,'LEASE_LOST','Reserva expirada.');
  return {code:r.rows[0].code_encrypted?decryptCredentials(r.rows[0].code_encrypted,key).original:null};
 });
 app.post('/api/creation-worker/:id/report',async req=>{
  const id=uuid.parse((req.params as {id:string}).id);const body=owner.extend({state:z.enum(['completed','failed','uncertain']),result:z.object({login:z.string().min(1).max(254).optional(),name:z.string().min(1).max(100).optional(),externalId:z.string().min(1).max(100).optional(),attributes:z.record(z.string(),z.unknown()).optional()}).optional()}).strict().parse(req.body);
  await transaction(pool,async c=>{
   const row=(await c.query('SELECT * FROM creation_operations WHERE id=$1 FOR UPDATE',[id])).rows[0];
   if(!row||row.worker_id!==body.workerId||row.lease_token!==body.leaseToken)throw new ModuleError(409,'LEASE_LOST','Reserva inválida.');
   if(row.state==='completed')return;
   // A durable confirmed result may be replayed after lease expiry, but never by another owner.
   if(!['running','uncertain','failed'].includes(row.state))throw new ModuleError(409,'INVALID_STATE','Estado inválido.');
   let resultId:null|string=null;
   if(body.state==='completed'){
    resultId=randomUUID();
    if(row.type==='ankama'){
     const login=body.result?.login;if(!login)throw new ModuleError(400,'INVALID_RESULT','Login confirmado obrigatório.');
     await c.query("INSERT INTO ankama_accounts(id,login,password_encrypted,email_id,status) VALUES($1,$2,$3,$4,'C')",[resultId,login,row.password_encrypted,row.email_id]);
     await c.query("UPDATE email_accounts SET status='U',updated_at=NOW() WHERE id=$1",[row.email_id]);
     await c.query('DELETE FROM email_reservations WHERE email_id=$1 AND id=$2',[row.email_id,id]);
    }else{
     const result=body.result;if(!result?.name||!result.externalId)throw new ModuleError(400,'INVALID_RESULT','Nome e identificador externo obrigatórios.');
     const a=(await c.query('SELECT status FROM ankama_accounts WHERE id=$1 FOR UPDATE',[row.ankama_id])).rows[0];
     await c.query('INSERT INTO characters(id,ankama_id,email_id,name,breed_id,server_id,status,external_id,attributes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[resultId,row.ankama_id,row.email_id,result.name,row.parameters.breedId,row.parameters.serverId,a.status==='B'?'B':'C',result.externalId,JSON.stringify(result.attributes??{})]);
    }
   }
   const state=body.state==='failed'&&row.submitted?'uncertain':body.state;
   await c.query('UPDATE creation_operations SET state=$2,stage=$2,result_id=$3,error=$4,code_encrypted=NULL,updated_at=NOW() WHERE id=$1',[id,state,resultId,state==='completed'?null:'Execução interrompida. Consulte o worker local e revise o resultado antes de retomar.']);
  });return get(id);
 });
}

export const registerOperationRoutes = registerOperations;
