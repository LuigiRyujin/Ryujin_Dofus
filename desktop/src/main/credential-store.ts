import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

interface Encryption {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

export function validCredential(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 32 && value.length <= 4096
    && /^[\x21-\x7e]+$/.test(value);
}

export class CredentialStore {
  private pendingWrite: Promise<void> = Promise.resolve();

  constructor(private readonly path: string, private readonly encryption: Encryption) {}

  async get(): Promise<string | null> {
    await this.pendingWrite.catch(() => undefined);
    if (!this.encryption.isEncryptionAvailable()) return null;
    try {
      const value = this.encryption.decryptString(await readFile(this.path));
      return validCredential(value) ? value : null;
    } catch {
      return null;
    }
  }

  set(value: string): Promise<void> {
    if (!validCredential(value)) return Promise.reject(new Error('Invalid credential.'));
    this.pendingWrite = this.pendingWrite.catch(() => undefined).then(async () => {
      if (!this.encryption.isEncryptionAvailable()) throw new Error('Secure storage unavailable.');
      const encrypted = this.encryption.encryptString(value);
      await mkdir(dirname(this.path), { recursive: true });
      const temporary = `${this.path}.${randomUUID()}.tmp`;
      await writeFile(temporary, encrypted, { mode: 0o600 });
      await rename(temporary, this.path);
    });
    return this.pendingWrite;
  }
}
