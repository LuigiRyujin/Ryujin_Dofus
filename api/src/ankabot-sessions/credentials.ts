import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

export function createSessionCredential() {
  const token=randomBytes(32).toString('hex');
  return {token,hash:createHash('sha256').update(token).digest('hex')};
}
export function sessionCredentialMatches(token:string|undefined, expectedHash:string):boolean {
  if(!token || !/^[a-f0-9]{64}$/.test(token))return false;
  const actual=createHash('sha256').update(token).digest();
  const expected=Buffer.from(expectedHash,'hex');
  return actual.length===expected.length && timingSafeEqual(actual,expected);
}
