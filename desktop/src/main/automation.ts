import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';

interface Encryption { isEncryptionAvailable(): boolean; encryptString(value: string): Buffer; decryptString(value: Buffer): string }
export class AutomationSupervisor {
  private child: ChildProcess | undefined;
  private stopping = false;
  private error = '';
  failed() { this.error = 'Não foi possível iniciar o serviço local. Confira as credenciais e a configuração.'; }
  status() { return { running: !!this.child, error: this.error }; }
  constructor(private readonly userData: string, private readonly encryption: Encryption) {}
  async start(entry: string, apiUrl: string, token: string) {
    if (this.child || this.stopping) return;
    if (!this.encryption.isEncryptionAvailable()) throw new Error('Secure storage unavailable');
    await access(entry);
    await mkdir(this.userData, { recursive: true });
    const keyPath = join(this.userData, 'automation-key.bin');
    let key: string;
    try { key = this.encryption.decryptString(await readFile(keyPath)); }
    catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw new Error('Automation key unavailable', { cause: error });
      key = randomBytes(32).toString('base64');
      await writeFile(keyPath, this.encryption.encryptString(key), { flag: 'wx' });
    }
    if (this.stopping) return;
    const child = spawn(process.execPath, [entry], { shell: false, windowsHide: true, stdio: 'ignore', env: {
      ...process.env, ELECTRON_RUN_AS_NODE: '1', RYUJIN_AUTOMATION_ENABLED: '1', RYUJIN_API_URL: apiUrl,
      RYUJIN_OPERATOR_TOKEN: token, RYUJIN_SPOOL_DIRECTORY: join(this.userData, 'results'), RYUJIN_SPOOL_KEY: key,
    } });
    this.child = child;
    this.error = '';
    child.once('error', () => { this.error = 'Não foi possível iniciar o serviço local. Confira a configuração.'; if (this.child === child) this.child = undefined; });
    child.once('exit', (code) => { if (!this.stopping && code !== 0) this.error = 'O serviço local foi interrompido. Confira a configuração e as operações pendentes.'; if (this.child === child) this.child = undefined; });
  }
  async restart() {
    const child = this.child;
    const exited = child ? new Promise<void>(resolve => { child.once('exit', () => resolve()); setTimeout(resolve, 5000); }) : Promise.resolve();
    this.stop();
    await exited;
    this.stopping = false;
  }
  stop() {
    this.stopping = true;
    const child = this.child;
    if (child?.pid && process.platform === 'win32') {
      const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' });
      killer.once('error', () => child.kill());
    } else child?.kill();
    this.child = undefined;
  }
}





