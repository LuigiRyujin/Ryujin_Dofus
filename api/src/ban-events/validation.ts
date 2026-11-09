import {createHash} from 'node:crypto';
import {z} from 'zod';
const uuid=z.uuid().transform(value=>value.toLowerCase());
export const banEventSchema=z.object({
  schemaVersion:z.literal(1),eventId:uuid,
  target:z.object({type:z.enum(['character','ankama_account']),id:uuid}).strict(),
  reasonCode:z.string().regex(/^[A-Z0-9_]{1,64}$/),
  description:z.string().max(1000).refine(value=>!/[\x00-\x1f\x7f-\x9f]/u.test(value)).optional(),
  sessionId:uuid.optional(),assignmentId:uuid.optional(),
}).strict().refine(value=>(value.sessionId===undefined)===(value.assignmentId===undefined));
export type BanEventInput=z.infer<typeof banEventSchema>;
export type BanActor={type:'operator'|'legacy_status'}|{type:'session';token:string|undefined};
export const banFiltersSchema=z.object({page:z.coerce.number().int().min(1).max(2147483647).default(1),
  pageSize:z.coerce.number().int().min(1).max(100).default(25),targetType:z.enum(['character','ankama_account']).optional(),targetId:uuid.optional()}).strict();
export const preparationFiltersSchema=z.object({page:z.coerce.number().int().min(1).max(2147483647).default(1),
  pageSize:z.coerce.number().int().min(1).max(100).default(25),groupId:uuid.optional(),sessionId:uuid.optional()}).strict();
export const idSchema=z.object({id:uuid}).strict();
function canonical(value:unknown):string{
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical((value as Record<string,unknown>)[key])).join(',')+'}';
  return JSON.stringify(value);
}
export function banFingerprint(value:unknown){return createHash('sha256').update(canonical(value)).digest('hex');}
export const requiredActions=['stop_group','deposit_items','confirm_preparation','archive_old_characters','create_replacements','form_new_group','restore_items'];
