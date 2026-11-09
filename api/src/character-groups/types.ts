import { z } from 'zod';
export const groupStatusSchema=z.enum(['forming','active','abandoned','awaiting_restart','completed']);
export type GroupStatus=z.infer<typeof groupStatusSchema>;
export const groupIdSchema=z.uuid();
export const memberIdsSchema=z.array(z.uuid()).max(3).refine(ids=>new Set(ids).size===ids.length);
export const groupFiltersSchema=z.object({status:groupStatusSchema.optional(),sessionId:z.uuid().optional(),
  page:z.number().int().min(1).default(1),pageSize:z.number().int().min(1).max(100).default(25)}).strict();
export type GroupFilters=z.infer<typeof groupFiltersSchema>;
