import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { encrypt, decrypt } from './crypto.js';
import { ModuleError } from './emails/errors.js';
const uuid=z.uuid();
const pageSchema=z.object({page:z.coerce.number().int().min(1).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(25),search:z.string().max(254).optional(),status:z.string().optional(),emailId:uuid.optional(),ankamaId:uuid.optional(),breedId:z.coerce.number().int().positive().optional(),serverId:z.coerce.number().int().positive().optional()}).strict();
const ac=`a.id,a.login,a.email_id AS "emailId",e.email,a.status,a.created_at AS "createdAt",a.updated_at AS "updatedAt"`;
const cc=`c.id,c.ankama_id AS "ankamaId",c.email_id AS "emailId",e.email,a.login,c.name,c.breed_id AS "breedId",c.server_id AS "serverId",c.status,c.completed_at AS "completedAt",c.created_at AS "createdAt",c.updated_at AS "updatedAt"`;
const fromA='FROM ankama_accounts a JOIN email_accounts e ON e.id=a.email_id';
const fromC='FROM characters c JOIN ankama_accounts a ON a.id=c.ankama_id JOIN email_accounts e ON e.id=c.email_id';
export const accountMigration={version:2,sql:`
CREATE TABLE ankama_accounts(id UUID PRIMARY KEY,login TEXT NOT NULL,password_encrypted TEXT NOT NULL,email_id UUID NOT NULL UNIQUE REFERENCES email_accounts(id),status CHAR(1) NOT NULL DEFAULT 'C' CHECK(status IN ('C','B')),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(id,email_id));
CREATE UNIQUE INDEX ankama_login_unique ON ankama_accounts(lower(login));
CREATE TABLE characters(id UUID PRIMARY KEY,ankama_id UUID NOT NULL,email_id UUID NOT NULL,name TEXT NOT NULL,breed_id INTEGER NOT NULL CHECK(breed_id>0),server_id INTEGER NOT NULL CHECK(server_id>0),status CHAR(1) NOT NULL DEFAULT 'C' CHECK(status IN ('C','E','F','B')),external_id TEXT,attributes JSONB,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),FOREIGN KEY(ankama_id,email_id) REFERENCES ankama_accounts(id,email_id));
CREATE UNIQUE INDEX character_name_server_unique ON characters(server_id,lower(name));
CREATE INDEX character_account_idx ON characters(ankama_id);
CREATE TABLE email_reservations(email_id UUID PRIMARY KEY REFERENCES email_accounts(id),id UUID NOT NULL UNIQUE);
`};
export function registerAccountRoutes(app:FastifyInstance,pool:Pool,key:string,options:{breeds:{id:number;name:string}[];servers:{id:number;name:string}[]}={breeds:[],servers:[]}){
 async function get(kind:'ankama-accounts'|'characters',id:string){
  const result=await pool.query(`SELECT ${kind==='characters'?cc:ac} ${kind==='characters'?fromC:fromA} WHERE ${kind==='characters'?'c':'a'}.id=$1`,[id]);
  if(!result.rows[0]) throw new ModuleError(404,'NOT_FOUND','Registro não encontrado.'); return result.rows[0];
 }
 for(const kind of ['ankama-accounts','characters'] as const){
  const char=kind==='characters',alias=char?'c':'a';
  app.get(`/api/${kind}`,async request=>{
   const f=pageSchema.parse(request.query),values:unknown[]=[],terms:string[]=[];
   function add(sql:string,v:unknown){values.push(v);terms.push(sql.replace('?',`$${values.length}`));}
   if(f.search) add(char?`(c.name ILIKE ? OR a.login ILIKE $${values.length+1} OR e.email ILIKE $${values.length+1})`:'(a.login ILIKE ? OR e.email ILIKE $'+(values.length+1)+')',`%${f.search}%`);
   if(char&&f.status==='F')terms.push('c.completed_at IS NOT NULL');
   else if(f.status) add(`${alias}.status=?`,(char?z.enum(['C','E','B','P']):z.enum(['C','B'])).parse(f.status));
   if(f.emailId)add(`${alias}.email_id=?`,f.emailId);
   if(char&&f.ankamaId)add('c.ankama_id=?',f.ankamaId);
   if(char&&f.breedId)add('c.breed_id=?',f.breedId);
   if(char&&f.serverId)add('c.server_id=?',f.serverId);
   const from=(char?fromC:fromA)+(terms.length?' WHERE '+terms.join(' AND '):'');
   const count=await pool.query(`SELECT count(*) AS total ${from}`,values);
   const rows=await pool.query(`SELECT ${char?cc:ac} ${from} ORDER BY ${alias}.created_at DESC,${alias}.id LIMIT $${values.length+1} OFFSET $${values.length+2}`,[...values,f.pageSize,(f.page-1)*f.pageSize]);
   return {items:rows.rows,total:Number(count.rows[0].total),page:f.page,pageSize:f.pageSize};
  });
  app.get(`/api/${kind}/:id`,async request=>get(kind,uuid.parse((request.params as {id:string}).id)));
  app.patch(`/api/${kind}/:id/status`,async request=>{
   const id=uuid.parse((request.params as {id:string}).id),{status}=z.object({status:z.enum(['C','E','F','B','P'])}).strict().parse(request.body);
   if(!char)z.enum(['C','B']).parse(status);
   const client=await pool.connect();try{
    await client.query('BEGIN');
    // Lock parent first for both paths to serialize ban and individual updates.
    if(char) await client.query('SELECT a.id FROM ankama_accounts a JOIN characters c ON c.ankama_id=a.id WHERE c.id=$1 FOR UPDATE OF a',[id]);
    if(char&&status==='F'){
      const reserved=await client.query('SELECT group_id FROM group_members WHERE character_id=$1 AND released_at IS NULL',[id]);
      if(reserved.rowCount)throw new ModuleError(409,'USE_SESSION_PROGRESS','Personagem reservado: conclua pelo endpoint autenticado de progresso da sessão.');
    }
    const updated=char
      ?await client.query(`UPDATE characters SET status=$2,
        completed_at=CASE WHEN $3 THEN COALESCE(completed_at,statement_timestamp()) ELSE completed_at END,
        updated_at=CASE WHEN status IS DISTINCT FROM $2 OR ($3 AND completed_at IS NULL) THEN statement_timestamp() ELSE updated_at END
        WHERE id=$1 RETURNING id`,[id,status==='F'?'E':status,status==='F'])
      :await client.query(`UPDATE ankama_accounts SET status=$2,updated_at=CASE WHEN status IS DISTINCT FROM $2 THEN NOW() ELSE updated_at END WHERE id=$1 RETURNING id`,[id,status]);
    if(!updated.rows[0])throw new ModuleError(404,'NOT_FOUND','Registro não encontrado.');
    if(!char&&status==='B')await client.query("UPDATE characters SET status='B',updated_at=NOW() WHERE ankama_id=$1",[id]);
    await client.query('COMMIT');
   }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
   return get(kind,id);
  });
 }
 app.post('/api/ankama-accounts',async request=>{
  const input=z.object({login:z.string().trim().min(1).max(254),password:z.string().min(1).max(16384),emailId:uuid,status:z.enum(['C','B']).default('C')}).strict().parse(request.body);
  const client=await pool.connect(),id=randomUUID();try{
   await client.query('BEGIN');
   const email=await client.query('SELECT id,status FROM email_accounts WHERE id=$1 FOR UPDATE',[input.emailId]);
   if(!email.rows[0])throw new ModuleError(404,'EMAIL_NOT_FOUND','Email não encontrado.');
   const reserved=await client.query("SELECT id FROM creation_operations WHERE email_id=$1 AND state IN ('queued','running','uncertain','failed')",[input.emailId]);
   if(reserved.rows.length)throw new ModuleError(409,'EMAIL_RESERVED','Email reservado para criação.');
   if(email.rows[0].status==='B')throw new ModuleError(409,'EMAIL_BLOCKED','Email bloqueado.');
   await client.query('INSERT INTO ankama_accounts(id,login,password_encrypted,email_id,status) VALUES($1,$2,$3,$4,$5)',[id,input.login,encrypt(input.password,key),input.emailId,input.status]);
   await client.query("UPDATE email_accounts SET status='U',updated_at=NOW() WHERE id=$1",[input.emailId]);
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}return get('ankama-accounts',id);
 });
 app.post('/api/ankama-accounts/:id/reveal',async request=>{
  const id=uuid.parse((request.params as {id:string}).id);const result=await pool.query('SELECT password_encrypted FROM ankama_accounts WHERE id=$1',[id]);
  if(!result.rows[0])throw new ModuleError(404,'NOT_FOUND','Conta não encontrada.');return {password:decrypt(result.rows[0].password_encrypted,key)};
 });
 app.post('/api/characters',async request=>{
  const input=z.object({ankamaId:uuid,name:z.string().trim().min(1).max(64),breedId:z.number().int().positive(),serverId:z.number().int().positive(),status:z.enum(['C','E','F','B','P']).default('C')}).strict().parse(request.body);
  const client=await pool.connect(),id=randomUUID();try{
   await client.query('BEGIN');const account=await client.query('SELECT email_id,status FROM ankama_accounts WHERE id=$1 FOR UPDATE',[input.ankamaId]);
   if(!account.rows[0])throw new ModuleError(404,'NOT_FOUND','Conta não encontrada.');
   if(account.rows[0].status==='B')throw new ModuleError(409,'ACCOUNT_BANNED','Conta banida.');
   await client.query(`INSERT INTO characters(id,ankama_id,email_id,name,breed_id,server_id,status,completed_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,CASE WHEN $8 THEN statement_timestamp() ELSE NULL END)`,[id,input.ankamaId,account.rows[0].email_id,input.name,input.breedId,input.serverId,input.status==='F'?'E':input.status,input.status==='F']);await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}return get('characters',id);
 });
 app.get('/api/character-options',async()=>options);
}

