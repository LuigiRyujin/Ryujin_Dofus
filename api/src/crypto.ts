import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
export function encrypt(value: string, key: string) {
 const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'base64'),iv);
 const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
 return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),data.toString('base64')].join('.');
}
export function decrypt(value: string,key: string) {
 const [version,iv,tag,data]=value.split('.');
 if(version!=='v1'||!iv||!tag||!data) throw new Error('Invalid encrypted value');
 const cipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'base64'),Buffer.from(iv,'base64'));
 cipher.setAuthTag(Buffer.from(tag,'base64'));
 return Buffer.concat([cipher.update(Buffer.from(data,'base64')),cipher.final()]).toString('utf8');
}
