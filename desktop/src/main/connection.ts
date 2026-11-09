import type { ConnectionResult, ConnectionStatus } from '../shared/contracts';

export const productionApiUrl = 'https://ryujindofus-api.onrender.com';
export const requestTimeoutMs = 90_000;

export function resolveApiUrl(development: boolean, override?: string): string {
  if (!development || !override) return productionApiUrl;
  const url = new URL(override);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/'
    || !(url.protocol === 'https:' || (local && url.protocol === 'http:'))) {
    throw new Error('RYUJIN_API_URL must be an HTTPS origin or a local HTTP origin.');
  }
  return url.origin;
}

export function createConnectionChecker(baseUrl: string, fetcher: typeof fetch = fetch) {
  let pending: Promise<ConnectionResult> | undefined;

  async function endpoint(path: string, signal: AbortSignal) {
    const started = performance.now();
    let status: ConnectionStatus;
    try {
      const response = await fetcher(`${baseUrl}${path}`, { signal, redirect: 'error' });
      let data: unknown;
      try { data = await response.json(); } catch { data = null; }
      const value = data && typeof data === 'object' && 'status' in data ? data.status : undefined;
      if (response.ok && value === 'ok') status = 'ok';
      else if (response.status === 503 && value === 'unavailable') status = 'unavailable';
      else if (!response.ok) status = 'http_error';
      else status = 'invalid_response';
    } catch {
      status = signal.aborted ? 'timeout' : 'network_error';
    }
    return { status, elapsedMs: Math.round(performance.now() - started) };
  }

  return function checkConnection(): Promise<ConnectionResult> {
    if (pending) return pending;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    pending = Promise.all([
      endpoint('/health', controller.signal),
      endpoint('/ready', controller.signal),
    ]).then(([api, database]) => ({ api, database, checkedAt: new Date().toISOString() }))
      .finally(() => { clearTimeout(timer); pending = undefined; });
    return pending;
  };
}
