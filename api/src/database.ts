import { Pool } from 'pg';

export function createPool(databaseUrl: string) {
  return new Pool({
    connectionString: databaseUrl,
    max: 5,
    connectionTimeoutMillis: 5000,
    query_timeout: 35000,
    statement_timeout: 30000,
    idleTimeoutMillis: 10000,
    enableChannelBinding: true,
  });
}
