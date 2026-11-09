import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { EmailRepository } from './emails/repository.js';
import { EmailService } from './emails/service.js';
import { ApiMailClient } from './emails/provider.js';
import { accountSchema,filtersSchema,statusSchema,importSchema,purchaseSchema,csvCell } from './emails/validation.js';
export function registerEmailRoutes(app:FastifyInstance,pool:Pool,key:string,providerToken?:string){
 const repo=new EmailRepository(pool,key),provider=new ApiMailClient(providerToken),service=new EmailService(repo,provider);
 const id=(params:unknown)=>z.object({id:z.uuid()}).parse(params).id;
 app.get('/api/emails',r=>repo.list(filtersSchema.parse(r.query)));
 app.post('/api/emails',r=>repo.create(accountSchema.parse(r.body)));
 app.get('/api/emails/reports/summary',r=>repo.summary(filtersSchema.parse(r.query)));
 app.get('/api/emails/reports/export',async(r,reply)=>{const rows=await repo.all(filtersSchema.parse(r.query));return reply.type('text/csv; charset=utf-8').header('Content-Disposition','attachment; filename="emails.csv"').send(['email,data_compra,status',...rows.map(row=>[row.email,row.purchaseDate,row.status].map(csvCell).join(','))].join('\r\n'));});
 app.get('/api/emails/:id',r=>repo.get(id(r.params)));
 app.post('/api/emails/:id/reveal',r=>repo.reveal(id(r.params)));
 app.patch('/api/emails/:id/status',r=>repo.setStatus(id(r.params),z.object({status:statusSchema}).strict().parse(r.body).status));
 app.post('/api/emails/imports/preview',r=>service.preview(importSchema.parse(r.body)));
 app.post('/api/emails/imports',r=>service.import(importSchema.parse(r.body)));
 app.get('/api/apimail/balance',()=>provider.balance());
 app.get('/api/apimail/availability',()=>provider.availability());
 app.post('/api/apimail/purchases',r=>service.purchase(purchaseSchema.parse(r.body)));
 app.get('/api/apimail/purchases',async()=>({items:await repo.operations()}));
 app.get('/api/apimail/purchases/:id',r=>repo.operation(id(r.params)));
}

