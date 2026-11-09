import { accountMigration } from './accounts.js';
import { ankabotLicenseMigration } from './ankabot-licenses/migration.js';
import { ankabotSessionMigration } from './ankabot-sessions/migration.js';
import { characterGroupMigration } from './character-groups/migration.js';
import { groupClaimMigration } from './character-groups/claim-migration.js';
import {characterProgressMigration} from './character-progress/migration.js';
import {banEventMigration} from './ban-events/migration.js';
import { operationMigration } from './operations.js';
import type { Pool } from 'pg';

export const migrations = [{
  version: 1,
  sql: `
    CREATE TABLE email_accounts (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_encrypted TEXT NOT NULL,
      refresh_token_encrypted TEXT,
      client_id_encrypted TEXT,
      original_encrypted TEXT NOT NULL,
      purchase_date DATE,
      origin TEXT NOT NULL DEFAULT 'apimail' CHECK (origin = 'apimail'),
      status CHAR(1) NOT NULL DEFAULT 'D' CHECK (status IN ('D','U','B')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (email = lower(trim(email)))
    );
    CREATE INDEX email_accounts_status_idx ON email_accounts(status);
    CREATE INDEX email_accounts_purchase_date_idx ON email_accounts(purchase_date);
    CREATE TABLE email_purchase_operations (
      id UUID PRIMARY KEY,
      idempotency_key UUID NOT NULL UNIQUE,
      request_hash TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('pending','completed','uncertain','failed')),
      payment_id TEXT UNIQUE,
      account_count INTEGER NOT NULL,
      inserted INTEGER NOT NULL DEFAULT 0,
      total_price NUMERIC(20,8),
      message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE email_purchase_imports (
      payment_id TEXT PRIMARY KEY,
      operation_id UUID UNIQUE REFERENCES email_purchase_operations(id),
      imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
}, accountMigration, operationMigration, ankabotLicenseMigration, ankabotSessionMigration, characterGroupMigration, groupClaimMigration,characterProgressMigration,banEventMigration];

export async function runMigrations(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL statement_timeout = 30000');
    await client.query('SELECT pg_advisory_xact_lock(748219360)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    const applied = await client.query<{ version: number }>('SELECT version FROM schema_migrations');
    for (const migration of migrations) {
      if (applied.rows.some((row) => row.version === migration.version)) continue;
      await client.query(migration.sql);
      await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [migration.version]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

