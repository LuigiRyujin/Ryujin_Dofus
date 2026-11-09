import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApiClient } from '../src/main/api-client';
import { CredentialStore } from '../src/main/credential-store';
import { isTrustedRendererUrl } from '../src/main/security';
import { emailInput, filters, identifier, importInput, purchaseInput, queryString } from '../src/main/validation';

const directories: string[] = [];
afterEach(async () => {
  vi.useRealTimers();
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true });
});

describe('credential storage', () => {
  it('persists only encrypted bytes, serializes updates and reloads the latest token', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ryujin-test-'));
    directories.push(directory);
    const path = join(directory, 'access.bin');
    const encryption = {
      isEncryptionAvailable: () => true,
      encryptString: (value: string) => Buffer.from(value.split('').reverse().join('')),
      decryptString: (value: Buffer) => value.toString().split('').reverse().join(''),
    };
    const store = new CredentialStore(path, encryption);
    const first = 'first-personal-token-01234567890123456789';
    const last = 'last-personal-token-01234567890123456789';
    await Promise.all([store.set(first), store.set(last)]);
    expect((await readFile(path)).toString()).not.toContain(last);
    expect(await new CredentialStore(path, encryption).get()).toBe(last);
  });

  it('fails closed when OS encryption is unavailable', async () => {
    const store = new CredentialStore('unused', {
      isEncryptionAvailable: () => false,
      encryptString: () => { throw new Error('must not be called'); },
      decryptString: () => { throw new Error('must not be called'); },
    });
    expect(await store.get()).toBeNull();
    await expect(store.set('x'.repeat(32))).rejects.toThrow('Secure storage unavailable');
  });
});

describe('API transport', () => {
  it('requires a credential and never sends anonymous protected requests', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const result = await new ApiClient('https://api.example', async () => null, fetcher).request('/api/emails');
    expect(result.ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns safe API errors and disables redirects', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'UNAUTHORIZED', message: 'Credencial inválida.' },
    }), { status: 401 }));
    const client = new ApiClient('https://api.example', async () => 'secret', fetcher);
    expect(await client.request('/api/emails')).toEqual({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Credencial inválida.' } });
    expect(fetcher).toHaveBeenCalledWith('https://api.example/api/emails', expect.objectContaining({ redirect: 'error' }));
  });

  it('never retries a failed purchase', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('secret transport details'));
    const result = await new ApiClient('https://api.example', async () => 'secret', fetcher)
      .request('/api/apimail/purchases', 'POST', { count: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('aborts a hanging request with a safe timeout result', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const pending = new ApiClient('https://api.example', async () => 'secret', fetcher).request('/api/emails');
    await vi.advanceTimersByTimeAsync(90000);
    expect(await pending).toMatchObject({ ok: false, error: { code: 'TIMEOUT' } });
  });
});

it('accepts only the exact trusted renderer document', () => {
  expect(isTrustedRendererUrl('http://127.0.0.1:5173/', 'http://127.0.0.1:5173')).toBe(true);
  expect(isTrustedRendererUrl('https://attacker.example', 'http://127.0.0.1:5173')).toBe(false);
  expect(isTrustedRendererUrl('file:///tmp/evil.html', 'file:///tmp/index.html')).toBe(false);
  expect(isTrustedRendererUrl('http://127.0.0.1:5173/other', 'http://127.0.0.1:5173')).toBe(false);
});

it('validates IPC inputs before constructing requests', () => {
  expect(() => identifier('../../reveal')).toThrow();
  expect(() => filters({ unknown: 'yes' })).toThrow();
  expect(() => filters({ from: '2026-02-30' })).toThrow();
  expect(() => emailInput({ email: 'bad', password: 'secret' })).toThrow();
  expect(() => purchaseInput({ idempotencyKey: crypto.randomUUID(), count: 501, maxTotal: '1' })).toThrow();
  expect(() => importInput({ source: 'purchase', paymentId: '../../url' })).toThrow();
  expect(queryString(filters({ search: 'a&status=B', unknownDate: true }))).toBe('search=a%26status%3DB&unknownDate=true');
});
