import Fastify from 'fastify';
import { Pool } from 'pg';
import type { Config } from './config.js';

const readinessTimeoutMs = 5000;

export function buildApp(config: Config) {
  const app = Fastify({
    logger: {
      serializers: {
        req: (request) => ({ method: request.method, path: request.url?.split('?')[0] }),
      },
      redact: ['req.headers.authorization', 'req.headers.cookie', 'password', 'DATABASE_URL'],
    },
  });
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 5,
    connectionTimeoutMillis: readinessTimeoutMs,
    query_timeout: readinessTimeoutMs,
    statement_timeout: readinessTimeoutMs,
    idleTimeoutMillis: 10000,
    enableChannelBinding: true,
  });
  pool.on('error', () => app.log.warn('Idle database connection failed.'));
  app.addHook('onClose', async () => { await pool.end(); });

  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/ready', async (_request, reply) => {
    let timer: NodeJS.Timeout | undefined;
    try {
      // One deadline covers both acquiring a connection and executing the query.
      await Promise.race([
        pool.query('SELECT 1'),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Readiness timeout')), readinessTimeoutMs);
        }),
      ]);
      return { status: 'ok' };
    } catch {
      app.log.warn('Database readiness check failed.');
      return reply.code(503).send({ status: 'unavailable' });
    } finally {
      clearTimeout(timer);
    }
  });
  return app;
}
