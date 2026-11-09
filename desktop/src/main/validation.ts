import type { EmailFilters, EmailInput, EmailStatus, ImportInput, PurchaseInput } from '../shared/contracts';

function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some((key) => !keys.includes(key))) throw new Error('Invalid input.');
  return value as Record<string, unknown>;
}

function text(value: unknown, maximum: number, minimum = 1): string {
  if (typeof value !== 'string' || value.length < minimum || value.length > maximum) throw new Error('Invalid text.');
  return value;
}

function integer(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error('Invalid number.');
  }
  return value;
}

function date(value: unknown): string {
  const result = text(value, 10, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00Z`))
    || new Date(`${result}T00:00:00Z`).toISOString().slice(0, 10) !== result) throw new Error('Invalid date.');
  return result;
}

export function identifier(value: unknown): string {
  const result = text(value, 36, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result)) {
    throw new Error('Invalid identifier.');
  }
  return result;
}

export function status(value: unknown): EmailStatus {
  if (value !== 'D' && value !== 'U' && value !== 'B') throw new Error('Invalid status.');
  return value;
}

export function filters(value: unknown): EmailFilters {
  const input = record(value, ['search', 'status', 'domain', 'from', 'to', 'unknownDate', 'page', 'pageSize']);
  const result: EmailFilters = {};
  if (input.search !== undefined && input.search !== '') result.search = text(input.search, 254);
  if (input.status !== undefined && input.status !== '') result.status = status(input.status);
  if (input.domain !== undefined && input.domain !== '') result.domain = text(input.domain, 253);
  if (input.from !== undefined && input.from !== '') result.from = date(input.from);
  if (input.to !== undefined && input.to !== '') result.to = date(input.to);
  if (input.unknownDate !== undefined) {
    if (typeof input.unknownDate !== 'boolean') throw new Error('Invalid filter.');
    result.unknownDate = input.unknownDate;
  }
  if (input.page !== undefined) result.page = integer(input.page, 1, 1000000);
  if (input.pageSize !== undefined) result.pageSize = integer(input.pageSize, 1, 100);
  return result;
}

export function queryString(value: EmailFilters): string {
  const entries = Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== false);
  return new URLSearchParams(entries.map(([key, entry]) => [key, String(entry)])).toString();
}

export function emailInput(value: unknown): EmailInput {
  const input = record(value, ['email', 'password', 'purchaseDate', 'status']);
  const email = text(input.email, 254).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email.');
  return {
    email,
    password: text(input.password, 16384),
    purchaseDate: input.purchaseDate == null || input.purchaseDate === '' ? null : date(input.purchaseDate),
    status: input.status === undefined ? 'D' : status(input.status),
  };
}

export function importInput(value: unknown): ImportInput {
  const input = record(value, ['source', 'csv', 'paymentId', 'purchaseDate', 'operationId']);
  const purchaseDate = input.purchaseDate == null || input.purchaseDate === '' ? null : date(input.purchaseDate);
  if (input.source === 'csv') return { source: 'csv', csv: text(input.csv, 2_000_000), purchaseDate };
  if (input.source === 'purchase') {
    const paymentId = text(input.paymentId, 30);
    if (!/^\d+$/.test(paymentId)) throw new Error('Invalid payment.');
    return { source: 'purchase', paymentId, purchaseDate,
      ...(input.operationId === undefined ? {} : { operationId: identifier(input.operationId) }) };
  }
  throw new Error('Invalid import source.');
}

export function purchaseInput(value: unknown): PurchaseInput {
  const input = record(value, ['idempotencyKey', 'count', 'domain', 'age', 'maxTotal']);
  const maxTotal = text(input.maxTotal, 24);
  if (!/^\d+(\.\d{1,8})?$/.test(maxTotal) || Number(maxTotal) <= 0) throw new Error('Invalid price.');
  const result: PurchaseInput = {
    idempotencyKey: identifier(input.idempotencyKey), count: integer(input.count, 1, 500), maxTotal,
  };
  if (input.domain !== undefined && input.domain !== '') {
    result.domain = text(input.domain, 253);
    if (!/^[a-z0-9.-]+$/i.test(result.domain)) throw new Error('Invalid domain.');
  }
  if (input.age !== undefined && input.age !== '') {
    result.age = text(input.age, 10);
    if (!['fresh', 'medium', 'aged', 'old'].includes(result.age)) throw new Error('Invalid age.');
  }
  return result;
}

export function clipboardText(value: unknown): string {
  return text(value, 32768);
}

export function entityFilters(value: unknown) {
  const input = record(value, ['search', 'status', 'ankamaId', 'emailId', 'breedId', 'serverId', 'page', 'pageSize']);
  const result: Record<string, string | number> = {};
  if (input.search) result.search = text(input.search, 254);
  if (input.status) { const value = text(input.status, 1); if (!['C', 'E', 'F', 'B'].includes(value)) throw new Error('Invalid status'); result.status = value; }
  for (const key of ['ankamaId', 'emailId']) if (input[key]) result[key] = identifier(input[key]);
  for (const key of ['breedId', 'serverId']) if (input[key] !== undefined) result[key] = integer(input[key], 1, 1000000);
  if (input.page !== undefined) result.page = integer(input.page, 1, 1000000);
  if (input.pageSize !== undefined) result.pageSize = integer(input.pageSize, 1, 100);
  return new URLSearchParams(Object.entries(result).map(([key, value]) => [key, String(value)])).toString();
}
export function entityStatus(value: unknown, character = false) {
  if (!(character ? ['C', 'E', 'F', 'B'] : ['C', 'B']).includes(String(value))) throw new Error('Invalid status');
  return String(value);
}
export function ankamaInput(value: unknown) {
  const input = record(value, ['login', 'password', 'emailId']);
  return { login: text(input.login, 254).trim(), password: text(input.password, 16384), emailId: identifier(input.emailId) };
}
export function characterInput(value: unknown, operation = false) {
  const input = record(value, operation ? ['ankamaId', 'breedId', 'serverId', 'idempotencyKey'] : ['ankamaId', 'name', 'breedId', 'serverId']);
  return { ankamaId: identifier(input.ankamaId), breedId: integer(input.breedId, 1, 1000000), serverId: integer(input.serverId, 1, 1000000),
    ...(operation ? { idempotencyKey: identifier(input.idempotencyKey) } : { name: text(input.name, 100).trim() }) };
}
export function ankamaOperationInput(value: unknown) {
  const input = record(value, ['emailId', 'idempotencyKey']);
  return { emailId: identifier(input.emailId), idempotencyKey: identifier(input.idempotencyKey) };
}
