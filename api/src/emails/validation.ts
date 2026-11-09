import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { ModuleError } from './errors.js';
import type { AccountInput } from './types.js';

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, 'Data inválida.');
export const statusSchema = z.enum(['D', 'U', 'B']);
const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const accountSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(16384),
  purchaseDate: dateSchema.nullable().optional().default(null),
  status: statusSchema.optional().default('D'),
}).strict();
export const filtersSchema = z.object({
  search: z.string().trim().max(254).optional(),
  status: statusSchema.optional(),
  domain: z.string().trim().toLowerCase().max(253).optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  unknownDate: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
}).strict().refine((value) => !value.from || !value.to || value.from <= value.to, 'Período inválido.');
export const purchaseSchema = z.object({
  idempotencyKey: z.uuid(),
  count: z.number().int().min(1).max(500),
  domain: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+$/).max(253).optional(),
  age: z.enum(['fresh', 'medium', 'aged', 'old']).optional(),
  maxTotal: z.string().regex(/^\d{1,6}(\.\d{1,8})?$/),
}).strict();
export const importSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('csv'), csv: z.string().min(1).max(2_000_000), purchaseDate: dateSchema.nullable().optional() }).strict(),
  z.object({ source: z.literal('purchase'), paymentId: z.string().regex(/^\d+$/).max(30), purchaseDate: dateSchema.nullable().optional(), operationId: z.uuid().optional() }).strict(),
]);
export function normalizeAccount(input: unknown): AccountInput {
  return accountSchema.parse(input);
}

export function parseImportCsv(csv: string, purchaseDate: string | null = null) {
  let rows: Record<string, string>[];
  try {
    const header = csv.replace(/^\uFEFF/, '').split(/\r?\n/)[0] ?? '';
    rows = parse(csv, {
      bom: true, columns: true, skip_empty_lines: true,
      delimiter: header.includes(';') ? ';' : ',', max_record_size: 32768,
    }) as Record<string, string>[];
  } catch {
    throw new ModuleError(400, 'INVALID_CSV', 'CSV inválido. Confira o cabeçalho, delimitadores e aspas.');
  }
  if (rows.length === 0 || rows.length > 5000) throw new ModuleError(400, 'IMPORT_LIMIT', 'Importe entre 1 e 5.000 linhas por arquivo.');
  const accounts: AccountInput[] = [];
  const errors: { line: number; message: string }[] = [];
  rows.forEach((row, index) => {
    const result = accountSchema.safeParse({ email: row.email, password: row.senha,
      purchaseDate: row.data_compra?.trim() || purchaseDate, status: row.status?.trim() || 'D' });
    if (result.success) accounts.push(result.data);
    else errors.push({ line: index + 2, message: 'Verifique email, senha, data (AAAA-MM-DD) e status (D/U/B).' });
  });
  return { accounts, errors, total: rows.length };
}

export function csvCell(value: string | null): string {
  const text = value ?? '';
  const safe = /^[\s]*[=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function moneyUnits(value: string | number): bigint {
  const text = String(value);
  if (!/^\d{1,12}(\.\d{1,8})?$/.test(text)) throw new ProviderErrorForMoney();
  const [whole = '0', fraction = ''] = text.split('.');
  return BigInt(whole) * 100000000n + BigInt(fraction.padEnd(8, '0'));
}
class ProviderErrorForMoney extends ModuleError {
  constructor() { super(502, 'INVALID_PROVIDER_RESPONSE', 'O fornecedor retornou um valor monetário inválido.'); }
}
