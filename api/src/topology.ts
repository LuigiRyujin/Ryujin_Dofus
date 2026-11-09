import type {PoolClient} from 'pg';

/** Acquire before row locks. Shared for normal graph writers; exclusive for cross-license bans. */
export async function lockTopology(client:PoolClient,exclusive=false):Promise<void>{
  await client.query(exclusive?'SELECT pg_advisory_xact_lock(82024,1)':'SELECT pg_advisory_xact_lock_shared(82024,1)');
}
