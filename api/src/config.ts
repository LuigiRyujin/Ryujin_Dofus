export interface Config {
  databaseUrl: string;
  port: number;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  let databaseUrl: URL;
  try {
    databaseUrl = new URL(env.DATABASE_URL ?? '');
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)
    || !databaseUrl.hostname || !databaseUrl.username || !databaseUrl.password
    || databaseUrl.pathname.length <= 1) {
    throw new Error('DATABASE_URL must include PostgreSQL host, database and credentials.');
  }
  // Always verify TLS, including when the supplied URL uses sslmode=require.
  databaseUrl.searchParams.set('sslmode', 'verify-full');
  const portText = env.PORT ?? '3000';
  const port = Number(portText);
  if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return { databaseUrl: databaseUrl.toString(), port };
}
