import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';
import { readConfig } from '../src/config.js';

const databaseUrl = 'postgresql://user:secret@127.0.0.1:1/neondb?sslmode=verify-full';

test('configuration rejects missing credentials and invalid ports without leaking secrets', () => {
  assert.throws(() => readConfig({}), /DATABASE_URL/);
  assert.throws(() => readConfig({ DATABASE_URL: 'secret' }), /DATABASE_URL/);
  for (const port of ['0', '65536', '1.5', 'abc', '']) {
    assert.throws(() => readConfig({ DATABASE_URL: databaseUrl, PORT: port }), /PORT/);
  }
  assert.equal(readConfig({ DATABASE_URL: databaseUrl }).port, 3000);
});

test('health stays available when database is unreachable, readiness returns a safe 503', async (t) => {
  const app = buildApp(readConfig({ DATABASE_URL: databaseUrl }));
  t.after(() => app.close());
  const health = await app.inject('/health');
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json(), { status: 'ok' });
  const ready = await app.inject('/ready');
  assert.equal(ready.statusCode, 503);
  assert.deepEqual(ready.json(), { status: 'unavailable' });
  assert.ok(!ready.body.includes('secret'));
});

test('readiness stops waiting after five seconds on an unresponsive database', async (t) => {
  const sockets = new Set<import('node:net').Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as import('node:net').AddressInfo;
  const app = buildApp(readConfig({
    DATABASE_URL: `postgresql://user:secret@127.0.0.1:${address.port}/neondb?sslmode=verify-full`,
  }));
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await app.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const start = performance.now();
  const response = await app.inject('/ready');
  assert.equal(response.statusCode, 503);
  assert.ok(performance.now() - start < 6000, 'readiness must respect its five-second deadline');
});
