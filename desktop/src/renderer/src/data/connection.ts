import { ConnectionSnapshot } from '../types/domain';

export const INITIAL_CONNECTION: ConnectionSnapshot = {
  api: { ok: true, latencyMs: 42 },
  database: { ok: true },
  automation: { state: 'running' },
  checkedAt: new Date(Date.now() - 4 * 60000).toISOString(),
};

