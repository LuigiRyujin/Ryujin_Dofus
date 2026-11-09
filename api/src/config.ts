import { z } from 'zod';
export interface Config {
  databaseUrl: string;
  port: number;
  operatorToken?: string;
  ankabotToken?: string;
  encryptionKey?: string;
  apiMailToken?: string;
  ankabotSessionExpirationIntervalMs?: number;
  characterOptions?: {breeds:{id:number;name:string}[];servers:{id:number;name:string}[]};
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
  const operatorToken=env.OPERATOR_TOKEN, ankabotToken=env.ANKABOT_TOKEN, encryptionKey=env.CREDENTIALS_KEY;
  if(operatorToken && (operatorToken.length<32 || !encryptionKey || Buffer.from(encryptionKey,'base64').length!==32)) throw new Error('OPERATOR_TOKEN requires at least 32 characters and CREDENTIALS_KEY must encode 32 bytes.');
  if(ankabotToken && (ankabotToken.length<32 || ankabotToken===operatorToken))throw new Error('ANKABOT_TOKEN must be distinct and contain at least 32 characters.');
  const optionItem=z.object({id:z.number().int().positive(),name:z.string().trim().min(1).max(100)}).strict();
  let characterOptions;
  if(env.CHARACTER_OPTIONS_JSON){try{characterOptions=z.object({breeds:z.array(optionItem),servers:z.array(optionItem)}).strict().parse(JSON.parse(env.CHARACTER_OPTIONS_JSON));}catch{throw new Error('CHARACTER_OPTIONS_JSON must contain valid breeds and servers arrays.');}}
  const intervalText=env.ANKABOT_SESSION_EXPIRATION_INTERVAL_MS??'60000';
  const ankabotSessionExpirationIntervalMs=Number(intervalText);
  if(!/^\d+$/.test(intervalText)||!Number.isInteger(ankabotSessionExpirationIntervalMs)||ankabotSessionExpirationIntervalMs<1000||ankabotSessionExpirationIntervalMs>3600000)
    throw new Error('ANKABOT_SESSION_EXPIRATION_INTERVAL_MS must be an integer between 1000 and 3600000.');
  return { ankabotSessionExpirationIntervalMs,characterOptions,databaseUrl: databaseUrl.toString(), port,operatorToken,ankabotToken,encryptionKey,apiMailToken:env.APIMAIL_TOKEN };
}
