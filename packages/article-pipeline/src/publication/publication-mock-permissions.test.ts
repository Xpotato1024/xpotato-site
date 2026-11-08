import {afterEach,expect,it,vi} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DirectoryMockPublicationPort,mockPolicySha256} from './publication-mock-port.js';
import {persistMockObject} from './publication-operation.js';

const fault=vi.hoisted(()=>({code:''}));
vi.mock('node:fs/promises',async importOriginal=>{
 const fs=await importOriginal<typeof import('node:fs/promises')>();
 return {...fs,rename:async(...args:Parameters<typeof fs.rename>)=>{
  if(fault.code&&String(args[0]).includes('.staging-'))throw Object.assign(Error('fixture permission denial'),{code:fault.code});
  return fs.rename(...args);
 }};
});
const roots:string[]=[];
afterEach(async()=>{fault.code='';for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
it.each(['EPERM','EACCES'])('does not turn a genuine %s write failure into success',async code=>{
 const folder=await mkdtemp(join(tmpdir(),'mock-permission-'));roots.push(folder);
 const port=new DirectoryMockPublicationPort(join(folder,'provider'));
 const input={folder,port,plane:'public' as const,key:'synthetic-key',
  binding:{candidateSha256:'a'.repeat(64),approvalSha256:'b'.repeat(64),attemptId:'attempt-fixture',inputSha256:'c'.repeat(64)},
  object:{bytes:Buffer.from('fixture'),contentType:'image/webp',cacheControl:'immutable',policySha256:mockPolicySha256,protectedRef:null},fresh:async()=>{}};
 fault.code=code;
 await expect(persistMockObject(input)).rejects.toThrow('PUBLICATION_WRITE_RESULT_UNKNOWN_STOP');
 expect(await port.read('public',input.key)).toEqual({status:'absent',authoritative:true});
 fault.code='';expect((await persistMockObject(input)).action).toBe('uploaded');
});
