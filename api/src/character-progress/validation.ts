import {createHash} from 'node:crypto';
import {z} from 'zod';
export const progressUuidSchema=z.uuid().transform(value=>value.toLowerCase());

export const heartbeatReportSchema=z.object({
  schemaVersion:z.literal(1),sequence:z.number().int().min(1).max(2147483647),
  loadedCharacters:z.array(z.object({characterId:progressUuidSchema,assignmentId:progressUuidSchema}).strict()).max(64)
    .refine(entries=>new Set(entries.map(entry=>entry.characterId)).size===entries.length),
}).strict();
export const heartbeatBodySchema=z.union([z.undefined(),z.object({}).strict(),heartbeatReportSchema]);
export type HeartbeatReport=z.infer<typeof heartbeatReportSchema>;
export const progressSchema=z.object({
  schemaVersion:z.literal(1),assignmentId:progressUuidSchema,updateId:progressUuidSchema,baseRevision:z.number().int().min(0).max(2147483646),
  quest:z.object({id:z.string().min(1).max(128),stepId:z.string().min(1).max(128).nullable()}).strict().nullable(),
  data:z.record(z.string(),z.json()).refine(value=>Buffer.byteLength(JSON.stringify(value),'utf8')<=16384),
  completed:z.boolean(),
}).strict();
export type ProgressInput=z.infer<typeof progressSchema>;
function canonical(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical((value as Record<string,unknown>)[key])).join(',')+'}';
  return JSON.stringify(value);
}
export function progressFingerprint(characterId:string,input:unknown){
  return createHash('sha256').update(canonical({characterId,input})).digest('hex');
}
