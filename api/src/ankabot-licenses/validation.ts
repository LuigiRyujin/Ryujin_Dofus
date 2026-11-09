import { z } from 'zod';

const apiKey = z.string().min(1).max(4096).regex(/^[\x21-\x7e]+$/);
const maxCharacters = z.number().int().min(1).max(2147483647);
export const createLicenseSchema = z.object({ apiKey, maxCharacters: maxCharacters.default(40) }).strict();
export const updateLicenseSchema = z.object({ apiKey: apiKey.optional(), maxCharacters: maxCharacters.optional() })
  .strict().refine(value => value.apiKey !== undefined || value.maxCharacters !== undefined);
export const licenseIdSchema = z.object({ id: z.uuid() }).strict();
export const licenseFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).max(2147483647).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export type CreateLicense = z.infer<typeof createLicenseSchema>;
export type UpdateLicense = z.infer<typeof updateLicenseSchema>;
export type LicenseFilters = z.infer<typeof licenseFiltersSchema>;
export interface License {
  id: string;
  apiKeyMasked: string;
  maxCharacters: number;
  createdAt: string;
  updatedAt: string;
}
