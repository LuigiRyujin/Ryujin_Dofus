import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { encrypt, decrypt } from '../crypto.js';
import { ModuleError } from '../emails/errors.js';
import { fingerprintApiKey, maskApiKey } from './credentials.js';
import type { CreateLicense, UpdateLicense, LicenseFilters, License } from './validation.js';
import {licenseUsage} from '../character-groups/allocation.js';

interface StoredLicense {
  id: string;
  api_key_encrypted: string;
  max_characters: number;
  created_at: Date;
  updated_at: Date;
}
const columns = 'id, api_key_encrypted, max_characters, created_at, updated_at';

export class AnkabotLicenseRepository {
  constructor(private readonly pool: Pool, private readonly key: string) {}

  private publicLicense(row: StoredLicense): License {
    return { id: row.id, apiKeyMasked: maskApiKey(decrypt(row.api_key_encrypted, this.key)),
      maxCharacters: row.max_characters, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
  }

  private duplicate(error: unknown): never {
    if ((error as { code?: string }).code === '23505')
      throw new ModuleError(409, 'ANKABOT_LICENSE_DUPLICATE', 'Esta API key já está cadastrada.');
    throw error;
  }

  async create(input: CreateLicense): Promise<License> {
    try {
      const result = await this.pool.query<StoredLicense>(
        `INSERT INTO ankabot_licenses(id,api_key_encrypted,api_key_fingerprint,max_characters)
         VALUES($1,$2,$3,$4) RETURNING ${columns}`,
        [randomUUID(), encrypt(input.apiKey, this.key), fingerprintApiKey(input.apiKey, this.key), input.maxCharacters]);
      return this.publicLicense(result.rows[0]!);
    } catch (error) { return this.duplicate(error); }
  }

  async get(id: string): Promise<License> {
    const row = await this.findById(id);
    if (!row) throw new ModuleError(404, 'ANKABOT_LICENSE_NOT_FOUND', 'Licença não encontrada.');
    return row;
  }

  async findById(id: string): Promise<License | null> {
    const result = await this.pool.query<StoredLicense>(`SELECT ${columns} FROM ankabot_licenses WHERE id=$1`, [id]);
    return result.rows[0] ? this.publicLicense(result.rows[0]) : null;
  }

  async findByFingerprint(fingerprint: string): Promise<License | null> {
    const result = await this.pool.query<StoredLicense>(`SELECT ${columns} FROM ankabot_licenses WHERE api_key_fingerprint=$1`, [fingerprint]);
    return result.rows[0] ? this.publicLicense(result.rows[0]) : null;
  }

  async list(filters: LicenseFilters) {
    // Window count and page share one snapshot, even during concurrent writes.
    const result = await this.pool.query<{ total: string; items: StoredLicense[] }>(`
      SELECT (SELECT count(*) FROM ankabot_licenses) AS total,
        COALESCE((SELECT json_agg(page) FROM (
          SELECT ${columns} FROM ankabot_licenses ORDER BY created_at DESC,id LIMIT $1 OFFSET $2
        ) page),'[]'::json) AS items`, [filters.pageSize, (filters.page - 1) * filters.pageSize]);
    const row = result.rows[0]!;
    return { items: row.items.map(item => this.publicLicense({ ...item,
      created_at: new Date(item.created_at), updated_at: new Date(item.updated_at) })),
      total: Number(row.total), page: filters.page, pageSize: filters.pageSize };
  }

  async update(id: string, input: UpdateLicense): Promise<License> {
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN');
      const locked=await client.query('SELECT id FROM ankabot_licenses WHERE id=$1 FOR UPDATE',[id]);
      if(!locked.rowCount)throw new ModuleError(404,'ANKABOT_LICENSE_NOT_FOUND','Licença não encontrada.');
      if(input.maxCharacters!==undefined&&input.maxCharacters<await licenseUsage(client,id))
        throw new ModuleError(409,'LICENSE_CAPACITY_IN_USE','O limite não pode ficar abaixo dos personagens alocados.');
      const result = await client.query<StoredLicense>(`
        UPDATE ankabot_licenses SET
          api_key_encrypted=COALESCE($2,api_key_encrypted),
          api_key_fingerprint=COALESCE($3,api_key_fingerprint),
          max_characters=COALESCE($4,max_characters),updated_at=NOW()
        WHERE id=$1 RETURNING ${columns}`, [id,
        input.apiKey === undefined ? null : encrypt(input.apiKey, this.key),
        input.apiKey === undefined ? null : fingerprintApiKey(input.apiKey, this.key), input.maxCharacters ?? null]);
      if (!result.rows[0]) throw new ModuleError(404, 'ANKABOT_LICENSE_NOT_FOUND', 'Licença não encontrada.');
      const license=this.publicLicense(result.rows[0]);await client.query('COMMIT');return license;
    } catch (error) { await client.query('ROLLBACK');return this.duplicate(error); }
    finally{client.release();}
  }

  async delete(id: string): Promise<void> {
    try {
      const result = await this.pool.query('DELETE FROM ankabot_licenses WHERE id=$1 RETURNING id', [id]);
      if (!result.rowCount) throw new ModuleError(404, 'ANKABOT_LICENSE_NOT_FOUND', 'Licença não encontrada.');
    } catch(error) {
      if(['23503','23001'].includes((error as {code?:string}).code??''))throw new ModuleError(409,'ANKABOT_LICENSE_HAS_SESSIONS','A licença possui histórico de sessões e não pode ser excluída.');
      throw error;
    }
  }
}
