import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { mkdir, readFile, open, rename, unlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
export class ResultSpool {
 constructor(directory,key){this.directory=directory;this.key=Buffer.from(key,'base64');if(this.key.length!==32)throw Error('32-byte spool key required');}
 async save(id,result){await mkdir(this.directory,{recursive:true});const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',this.key,iv);const encrypted=Buffer.concat([cipher.update(JSON.stringify(result)),cipher.final()]);const file=join(this.directory,id+'.json');const handle=await open(file+'.tmp','w',0o600);try{await handle.writeFile(JSON.stringify({iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')}));await handle.sync();}finally{await handle.close();}await rename(file+'.tmp',file);}
 async list(){await mkdir(this.directory,{recursive:true});const items=[];for(const name of await readdir(this.directory)){if(!/^[a-f0-9-]+\.json$/.test(name))continue;const value=JSON.parse(await readFile(join(this.directory,name),'utf8'));const d=createDecipheriv('aes-256-gcm',this.key,Buffer.from(value.iv,'base64'));d.setAuthTag(Buffer.from(value.tag,'base64'));items.push({id:name.slice(0,-5),body:JSON.parse(Buffer.concat([d.update(Buffer.from(value.data,'base64')),d.final()]).toString())});}return items;}
 async remove(id){await unlink(join(this.directory,id+'.json'));}
}
