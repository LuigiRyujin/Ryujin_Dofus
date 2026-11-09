import { createHmac, hkdfSync } from 'node:crypto';

export function fingerprintApiKey(apiKey: string, encryptionKey: string): string {
  const key = hkdfSync('sha256', Buffer.from(encryptionKey, 'base64'), Buffer.alloc(0),
    'ryujindofus:ankabot-license-fingerprint:v1', 32);
  return createHmac('sha256', Buffer.from(key)).update(apiKey, 'utf8').digest('hex');
}

export function maskApiKey(apiKey: string): string {
  return apiKey.length >= 8 ? `********${apiKey.slice(-4)}` : '********';
}
