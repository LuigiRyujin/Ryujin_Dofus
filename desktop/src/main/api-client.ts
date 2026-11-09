import type { ApiResult } from '../shared/contracts';
import { requestTimeoutMs } from './connection';

export const failure = (code: string, message: string): ApiResult<never> => ({
  ok: false, error: { code, message },
});

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly credential: () => Promise<string | null>,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async request<T>(path: string, method = 'GET', body?: unknown, csv = false): Promise<ApiResult<T>> {
    const token = await this.credential();
    if (!token) return failure('UNAUTHORIZED', 'Configure sua credencial de acesso para continuar.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, Accept: csv ? 'text/csv' : 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
        redirect: 'error',
        cache: 'no-store',
      });
      if (response.ok && csv) return { ok: true, data: await response.text() as T };
      let data: unknown;
      try { data = await response.json(); } catch { data = null; }
      if (!response.ok) {
        const error = data && typeof data === 'object' && 'error' in data ? data.error : null;
        if (error && typeof error === 'object' && 'code' in error && 'message' in error
          && typeof error.code === 'string' && typeof error.message === 'string') {
          return failure(error.code.slice(0, 80), error.message.slice(0, 500));
        }
        if (response.status === 401) return failure('UNAUTHORIZED', 'Credencial inválida. Atualize seu acesso.');
        return failure('HTTP_ERROR', `A API respondeu com erro HTTP ${response.status}. Tente novamente.`);
      }
      if (!data || typeof data !== 'object') return failure('INVALID_RESPONSE', 'A API retornou uma resposta inválida.');
      return { ok: true, data: data as T };
    } catch {
      return controller.signal.aborted
        ? failure('TIMEOUT', 'O tempo de resposta terminou. Consulte o histórico antes de repetir uma compra.')
        : failure('NETWORK_ERROR', 'Não foi possível acessar a API. Verifique sua conexão.');
    } finally {
      clearTimeout(timer);
    }
  }
}
