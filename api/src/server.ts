import { buildApp } from './app.js';
import { readConfig } from './config.js';

async function main() {
  const config = readConfig();
  const app = buildApp(config);
  let closing = false;
  async function shutdown() {
    if (closing) return;
    closing = true;
    app.log.info('Shutting down.');
    try {
      await app.close();
    } catch {
      app.log.error('Shutdown failed.');
      process.exitCode = 1;
    }
  }
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  try {
    await app.listen({ host: '0.0.0.0', port: config.port });
  } catch {
    await app.close();
    throw new Error('HTTP server could not start.');
  }
}

main().catch(() => {
  console.error('Startup failed. Check DATABASE_URL, PORT and port availability.');
  process.exitCode = 1;
});
