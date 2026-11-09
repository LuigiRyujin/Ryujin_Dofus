import { encrypt, decrypt } from '../crypto.js';
export const encryptCredentials = encrypt;
export function decryptCredentials(value: string,key: string) { return splitCredentials(decrypt(value,key)); }
export function splitCredentials(original: string) {
 const parts=original.split('|'); const composite=parts.length===3&&parts.every(Boolean);
 return {password:composite?parts[0]!:original,refreshToken:composite?parts[1]!:null,clientId:composite?parts[2]!:null,original};
}
