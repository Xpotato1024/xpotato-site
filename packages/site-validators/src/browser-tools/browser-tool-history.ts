import {execFileSync} from 'node:child_process';
import {lstat,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {browserToolPinSchema,type BrowserToolPin} from '@xpotato/content-contracts';
import {fingerprint} from '@xpotato/content-contracts/canonical';
import {readSourceBlobs} from './browser-tool-source-blobs.js';
import {inspectToolArtifactFiles,verifyToolPinArtifact,verifyToolPin,noToolLinks} from './browser-tool-adoption.js';

const hash=z.string().regex(/^[a-f0-9]{40}$/u);
const historySchema=z.object({schemaVersion:z.literal(1),releases:z.array(z.object({
 toolId:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),releaseId:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
 commit:hash,tree:hash,pinSha256:z.string().regex(/^[a-f0-9]{64}$/u),
}).strict()).max(64)}).strict();

/** Local immutable Git objects only. No checkout, fetch, provider, cache or mutation. */
export async function readHistoricalToolFiles(root:string,pinInput:unknown):Promise<Map<string,Buffer>|null>{
 const pin=browserToolPinSchema.parse(pinInput),config=join(root,'config/browser-tools/history.json');
 try{await noToolLinks(config);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
 if((await lstat(config)).size>100000)throw Error('Oversized tool history index');
 const index=historySchema.parse(JSON.parse(await readFile(config,'utf8')));
 if(new Set(index.releases.map(r=>r.toolId+':'+r.releaseId)).size!==index.releases.length)throw Error('Duplicate historical release');
 const record=index.releases.find(r=>r.toolId===pin.toolId&&r.releaseId===pin.releaseId);
 if(!record)return null;
 if(record.pinSha256!==fingerprint(pin))throw Error('Historical pin identity mismatch');
 const git=(...args:string[])=>execFileSync('git',['-c','core.fsmonitor=false','-C',root,...args],{
  maxBuffer:1000000,stdio:'pipe',env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1',GIT_OPTIONAL_LOCKS:'0'},
 });
 try{if(git('cat-file','-t',record.commit).toString().trim()!=='commit')throw Error('Not a commit');}
 catch(error){throw Error('Historical commit unavailable; use a full Git checkout',{cause:error});}
 const sourcePath='vendor/browser-tools/'+pin.toolId+'/'+pin.releaseId;
 if(git('rev-parse',record.commit+':'+sourcePath).toString().trim()!==record.tree)throw Error('Historical tree identity mismatch');
 const records=git('ls-tree','-rlz',record.tree).toString('utf8').split('\0').filter(Boolean).map(line=>{
  const tab=line.indexOf('\t'),fields=line.slice(0,tab).trim().split(/\s+/u),p=line.slice(tab+1);
  if(tab<0||fields.length!==4||fields[0]!=='100644'||fields[1]!=='blob'||!p||p.split('/').some(s=>!s||s==='.'||s==='..')||!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(p))throw Error('Unsafe historical tool object');
  const size=Number(fields[3]);if(!Number.isSafeInteger(size)||size<0||size>2000000)throw Error('Oversized historical tool object');
  return{path:p,oid:fields[2]!,size};
 });
 if(records.length>101||records.reduce((n,r)=>n+r.size,0)>8000000||new Set(records.map(r=>r.path.toLowerCase())).size!==records.length)throw Error('Historical artifact exceeds exact file budget');
 const blobs=readSourceBlobs(records,(input,maxBuffer)=>execFileSync('git',['-c','core.fsmonitor=false','-C',root,'cat-file','--batch'],{
  input,maxBuffer,env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1',GIT_OPTIONAL_LOCKS:'0'},
 }));
 return new Map(records.map(r=>[r.path,blobs.get(r.oid)!]));
}

/** Normal all-pin history check. Present trees must pass; corruption never falls back. */
export async function verifyRetainedToolPin(root:string,pinInput:BrowserToolPin){
 const pin=browserToolPinSchema.parse(pinInput);
 const vendor=join(root,'vendor/browser-tools'),target=join(vendor,pin.toolId,pin.releaseId);
 await noToolLinks(vendor);
 let present=false;
 // Walk ancestors even when the final release is absent: a linked tool directory
 // must never turn ENOENT into permission to use the immutable fallback.
 try{await noToolLinks(target);present=true;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 // Once observed present, every verification failure propagates without fallback.
 if(present)return verifyToolPin(vendor,pin);
 const files=await readHistoricalToolFiles(root,pin);
 if(!files)return verifyToolPin(vendor,pin);
 return verifyToolPinArtifact(vendor,pin,inspectToolArtifactFiles(files,pin.artifactSha256));
}
