import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConnectionChecker, resolveApiUrl } from '../src/main/connection';

const api = 'https://ryujindofus-api.onrender.com';
afterEach(() => vi.useRealTimers());

describe('connection checks', () => {
  it('requests both endpoints concurrently and shares the pending check', async () => {
    const fetcher = vi.fn(async () => new Response('{"status":"ok"}'));
    const check = createConnectionChecker(api, fetcher);
    const first = check();
    expect(check()).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const result = await first;
    expect(result.api.status).toBe('ok');
    expect(result.database.status).toBe('ok');
    expect(fetcher.mock.calls.map((call) => (call as unknown[])[0])).toEqual([`${api}/health`, `${api}/ready`]);
    await check();
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('distinguishes database unavailability from API availability', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) =>
      new Response(JSON.stringify({ status: String(url).endsWith('/ready') ? 'unavailable' : 'ok' }),
        { status: String(url).endsWith('/ready') ? 503 : 200 }));
    const result = await createConnectionChecker(api, fetcher)();
    expect(result.api.status).toBe('ok');
    expect(result.database.status).toBe('unavailable');
  });

  it.each([
    ['<html>Starting</html>', 200, 'invalid_response'],
    ['{"status":"unknown"}', 200, 'invalid_response'],
    ['{"status":"ok"}', 500, 'http_error'],
    ['{}', 503, 'http_error'],
  ])('validates body %s with HTTP %s', async (body, status, expected) => {
    const result = await createConnectionChecker(api, async () => new Response(body, { status }))();
    expect(result.api.status).toBe(expected);
  });

  it('returns a safe network error and recovers on a subsequent check', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error('private network detail'))
      .mockRejectedValueOnce(new Error('private network detail'))
      .mockImplementation(async () => new Response('{"status":"ok"}'));
    const check = createConnectionChecker(api, fetcher);
    const failed = await check();
    expect(failed.api.status).toBe('network_error');
    expect(JSON.stringify(failed)).not.toContain('private network detail');
    expect((await check()).api.status).toBe('ok');
  });

  it('aborts both requests after 90 seconds', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }));
    const pending = createConnectionChecker(api, fetcher)();
    await vi.advanceTimersByTimeAsync(90000);
    const result = await pending;
    expect(result.api.status).toBe('timeout');
    expect(result.database.status).toBe('timeout');
  });
});

it('uses the fixed production API and restricts development overrides', () => {
  expect(resolveApiUrl(false, 'http://localhost:3000')).toBe(api);
  expect(resolveApiUrl(true, 'http://localhost:3000/')).toBe('http://localhost:3000');
  expect(() => resolveApiUrl(true, 'http://remote.example')).toThrow();
  expect(() => resolveApiUrl(true, 'https://user:password@example.com')).toThrow();
});
