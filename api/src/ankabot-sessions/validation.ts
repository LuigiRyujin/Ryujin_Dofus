import { z } from 'zod';
import { createLicenseSchema, licenseFiltersSchema } from '../ankabot-licenses/validation.js';

export const registerSessionSchema = z.object({
  apiKey: createLicenseSchema.shape.apiKey,
  hostname: z.string().refine(value=>!/[\x00-\x1f\x7f-\x9f]/u.test(value))
    .transform(value=>value.trim().toLowerCase())
    .pipe(z.string().min(1).max(255).regex(/^[^\s\x00-\x1f\x7f-\x9f]+$/u)),
  pid: z.number().int().min(1).max(4294967295),
}).strict();
export const sessionIdSchema = z.object({id:z.uuid()}).strict();
export const sessionFiltersSchema = licenseFiltersSchema.extend({
  licenseId: z.uuid().optional(), status: z.enum(['active','expired','closed']).optional(),
}).strict();
export type RegisterSession = z.infer<typeof registerSessionSchema>;
export type SessionFilters = z.infer<typeof sessionFiltersSchema>;
