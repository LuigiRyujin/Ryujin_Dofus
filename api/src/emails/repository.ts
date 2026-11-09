import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { encryptCredentials, decryptCredentials, splitCredentials } from './crypto.js';
import { ModuleError } from './errors.js';
import type { Account, AccountInput, AccountFilters, PurchaseInput, PurchaseOperation } from './types.js';

const publicColumns = `id, email, purchase_date::text AS "purchaseDate", origin, status,
  created_at AS "createdAt", updated_at AS "updatedAt"`;
const operationColumns = `id, idempotency_key AS "idempotencyKey", state,
  payment_id AS "paymentId", account_count AS count, inserted,
  total_price::text AS "totalPrice", message`;

function conditions(filters: AccountFilters) {
  const values: unknown[] = [];
  const terms: string[] = [];
  function add(sql: string, value: unknown) {
    values.push(value);
    terms.push(sql.replace('?', `$${values.length}`));
  }
  if (filters.search) add('email LIKE ?', `%${filters.search.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`);
  if (filters.status) add('status = ?', filters.status);
  if (filters.domain) add("split_part(email, '@', 2) = ?", filters.domain);
  if (filters.unknownDate === 'true') terms.push('purchase_date IS NULL');
  else {
    if (filters.unknownDate === 'false') terms.push('purchase_date IS NOT NULL');
    if (filters.from) add('purchase_date >= ?::date', filters.from);
    if (filters.to) add('purchase_date <= ?::date', filters.to);
  }
  return { where: terms.length ? `WHERE ${terms.join(' AND ')}` : '', values };
}

export class EmailRepository {
  constructor(private readonly pool: Pool, private readonly key: string) {}

  async list(filters: AccountFilters) {
    const { where, values } = conditions(filters);
    const count = await this.pool.query<{ total: string }>(`SELECT count(*)::text AS total FROM email_accounts ${where}`, values);
    const result = await this.pool.query<Account>(`SELECT ${publicColumns} FROM email_accounts ${where}
      ORDER BY created_at DESC, id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, filters.pageSize, (filters.page - 1) * filters.pageSize]);
    return { items: result.rows, total: Number(count.rows[0]?.total ?? 0), page: filters.page, pageSize: filters.pageSize };
  }

  async all(filters: AccountFilters) {
    const { where, values } = conditions(filters);
    const result = await this.pool.query<Account>(`SELECT ${publicColumns} FROM email_accounts ${where} ORDER BY email`, values);
    return result.rows;
  }

  async get(id: string) {
    const result = await this.pool.query<Account>(`SELECT ${publicColumns} FROM email_accounts WHERE id = $1`, [id]);
    if (!result.rows[0]) throw new ModuleError(404, 'EMAIL_NOT_FOUND', 'Email não encontrado.');
    return result.rows[0];
  }

  async reveal(id: string) {
    const result = await this.pool.query<{
      password_encrypted: string; refresh_token_encrypted: string | null;
      client_id_encrypted: string | null; original_encrypted: string;
    }>('SELECT password_encrypted, refresh_token_encrypted, client_id_encrypted, original_encrypted FROM email_accounts WHERE id = $1', [id]);
    const row = result.rows[0];
    if (!row) throw new ModuleError(404, 'EMAIL_NOT_FOUND', 'Email não encontrado.');
    return {
      password: decryptCredentials(row.password_encrypted, this.key).original,
      refreshToken: row.refresh_token_encrypted ? decryptCredentials(row.refresh_token_encrypted, this.key).original : null,
      clientId: row.client_id_encrypted ? decryptCredentials(row.client_id_encrypted, this.key).original : null,
      original: decryptCredentials(row.original_encrypted, this.key).original,
    };
  }

  async setStatus(id: string, status: string) {
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN');
      const locked=await client.query('SELECT id FROM email_accounts WHERE id=$1 FOR UPDATE',[id]);
      if(!locked.rows[0])throw new ModuleError(404,'EMAIL_NOT_FOUND','Email não encontrado.');
      if(status==='D'){
        const bound=await client.query('SELECT id FROM ankama_accounts WHERE email_id=$1 UNION ALL SELECT id FROM email_reservations WHERE email_id=$1',[id]);
        if(bound.rows.length)throw new ModuleError(409,'EMAIL_BOUND','Email vinculado ou reservado.');
      }
      const result=await client.query<Account>(`UPDATE email_accounts SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING ${publicColumns}`,[id,status]);
      await client.query('COMMIT');return result.rows[0]!;
    } catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}

  }

  async existing(emails: string[]) {
    if (!emails.length) return new Set<string>();
    const result = await this.pool.query<{ email: string }>('SELECT email FROM email_accounts WHERE email = ANY($1::text[])', [emails]);
    return new Set(result.rows.map((row) => row.email));
  }

  private async insert(client: PoolClient, account: AccountInput) {
    const parts = splitCredentials(account.password);
    const result = await client.query<Account>(`INSERT INTO email_accounts
      (id,email,password_encrypted,refresh_token_encrypted,client_id_encrypted,original_encrypted,purchase_date,status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (email) DO NOTHING RETURNING ${publicColumns}`, [
      randomUUID(), account.email, encryptCredentials(parts.password, this.key),
      parts.refreshToken ? encryptCredentials(parts.refreshToken, this.key) : null,
      parts.clientId ? encryptCredentials(parts.clientId, this.key) : null,
      encryptCredentials(parts.original, this.key), account.purchaseDate, account.status,
    ]);
    return result.rows[0];
  }

  async create(account: AccountInput) {
    const client = await this.pool.connect();
    try {
      const inserted = await this.insert(client, account);
      if (!inserted) throw new ModuleError(409, 'DUPLICATE_EMAIL', 'Este email já está cadastrado.');
      return inserted;
    } finally { client.release(); }
  }

  async import(accounts: AccountInput[], options: { paymentId?: string; operationId?: string; totalPrice?: string | null } = {}) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      let operation: PurchaseOperation | undefined;
      if (options.operationId) {
        const result = await client.query<PurchaseOperation>(`SELECT ${operationColumns} FROM email_purchase_operations WHERE id = $1 FOR UPDATE`, [options.operationId]);
        operation = result.rows[0];
        if (!operation) throw new ModuleError(404, 'PURCHASE_NOT_FOUND', 'Operação de compra não encontrada.');
        if (operation.paymentId && options.paymentId && operation.paymentId !== options.paymentId) {
          throw new ModuleError(409, 'PAYMENT_MISMATCH', 'A compra informada não corresponde à operação.');
        }
        if (operation.state === 'failed') throw new ModuleError(409, 'PURCHASE_FAILED', 'Uma operação recusada não pode ser conciliada.');
        if (operation.state === 'completed') {
          await client.query('COMMIT');
          return { inserted: 0, duplicates: accounts.length, total: accounts.length };
        }
        if (operation.count !== accounts.length) throw new ModuleError(409, 'PURCHASE_COUNT_MISMATCH', 'A quantidade recuperada difere da operação. Confira a compra informada.');
      }
      if (options.paymentId) {
        await client.query('INSERT INTO email_purchase_imports(payment_id, operation_id) VALUES ($1,$2) ON CONFLICT (payment_id) DO NOTHING', [options.paymentId, options.operationId ?? null]);
        const recorded = await client.query<{ operation_id: string | null }>('SELECT operation_id FROM email_purchase_imports WHERE payment_id = $1 FOR UPDATE', [options.paymentId]);
        const linked = recorded.rows[0]?.operation_id;
        if (linked && options.operationId && linked !== options.operationId) throw new ModuleError(409, 'PAYMENT_ALREADY_LINKED', 'Esta compra já está vinculada a outra operação.');
        if (options.operationId && !linked) await client.query('UPDATE email_purchase_imports SET operation_id = $2 WHERE payment_id = $1', [options.paymentId, options.operationId]);
      }
      let inserted = 0;
      for (const account of accounts) if (await this.insert(client, account)) inserted++;
      if (options.operationId) {
        await client.query(`UPDATE email_purchase_operations SET state = 'completed', inserted = $2,
          payment_id = COALESCE($3,payment_id), total_price = COALESCE($4,total_price), message = NULL, updated_at = NOW()
          WHERE id = $1`, [options.operationId, inserted, options.paymentId ?? null, options.totalPrice ?? null]);
      }
      await client.query('COMMIT');
      return { inserted, duplicates: accounts.length - inserted, total: accounts.length };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async summary(filters: AccountFilters) {
    const { where, values } = conditions(filters);
    const base = `FROM email_accounts ${where}`;
    const [totals, statuses, domains, days] = await Promise.all([
      this.pool.query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE purchase_date IS NULL)::int AS "unknownDate" ${base}`, values),
      this.pool.query(`SELECT status, count(*)::int AS count ${base} GROUP BY status ORDER BY status`, values),
      this.pool.query(`SELECT split_part(email,'@',2) AS domain, count(*)::int AS count ${base} GROUP BY domain ORDER BY count DESC, domain LIMIT 10`, values),
      this.pool.query(`SELECT purchase_date::text AS date, count(*)::int AS count ${base} ${where ? 'AND' : 'WHERE'} purchase_date IS NOT NULL GROUP BY purchase_date ORDER BY purchase_date`, values),
    ]);
    return { total: totals.rows[0]?.total ?? 0, unknownDate: totals.rows[0]?.unknownDate ?? 0,
      byStatus: statuses.rows, byDomain: domains.rows, byDay: days.rows };
  }

  async claim(input: PurchaseInput) {
    const hash = createHash('sha256').update(JSON.stringify({ count: input.count, domain: input.domain ?? '', age: input.age ?? '', maxTotal: input.maxTotal })).digest('hex');
    const id = randomUUID();
    const inserted = await this.pool.query(`INSERT INTO email_purchase_operations(id,idempotency_key,request_hash,state,account_count)
      VALUES ($1,$2,$3,'pending',$4) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`, [id, input.idempotencyKey, hash, input.count]);
    const existing = await this.pool.query<{ id: string; request_hash: string }>('SELECT id, request_hash FROM email_purchase_operations WHERE idempotency_key = $1', [input.idempotencyKey]);
    const row = existing.rows[0]!;
    if (row.request_hash !== hash) throw new ModuleError(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave já foi usada para outra solicitação de compra.');
    return { id: row.id, claimed: inserted.rowCount === 1 };
  }

  async updateOperation(id: string, state: 'failed' | 'uncertain', message: string, paymentId?: string | null, totalPrice?: string | null) {
    await this.pool.query(`UPDATE email_purchase_operations SET state = $2, message = $3,
      payment_id = COALESCE($4,payment_id), total_price = COALESCE($5,total_price), updated_at = NOW()
      WHERE id = $1 AND state <> 'completed'`, [id, state, message, paymentId ?? null, totalPrice ?? null]);
  }

  async markInterrupted() {
    // A pending request from another instance is never retried. It can still finish successfully.
    await this.pool.query(`UPDATE email_purchase_operations SET state = 'uncertain',
      message = 'O serviço reiniciou durante a compra. Confira a compra no fornecedor e concilie pelo payment_id.', updated_at = NOW()
      WHERE state = 'pending'`);
  }

  async operation(id: string) {
    await this.pool.query(`UPDATE email_purchase_operations SET state = 'uncertain',
      message = 'A compra excedeu o prazo. Confira o fornecedor antes de tentar outra compra.', updated_at = NOW()
      WHERE id = $1 AND state = 'pending' AND updated_at < NOW() - INTERVAL '2 minutes'`, [id]);
    const result = await this.pool.query<PurchaseOperation>(`SELECT ${operationColumns} FROM email_purchase_operations WHERE id = $1`, [id]);
    if (!result.rows[0]) throw new ModuleError(404, 'PURCHASE_NOT_FOUND', 'Operação de compra não encontrada.');
    return result.rows[0];
  }

  async operations() {
    const result = await this.pool.query<PurchaseOperation>(`SELECT ${operationColumns} FROM email_purchase_operations ORDER BY created_at DESC LIMIT 50`);
    return result.rows;
  }
}


