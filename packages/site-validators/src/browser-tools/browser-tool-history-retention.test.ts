import {afterEach,expect,it,vi} from 'vitest';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,cp,readFile,writeFile,rm,lstat,readdir,symlink} from 'node:fs/promises';
import {join,resolve,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {fingerprint} from '@xpotato/content-contracts/canonical';
import {browserToolReleases} from '../../../../apps/site/src/content-registry/interactive/releases.js';
import {readHistoricalToolFiles,verifyRetainedToolPin} from './browser-tool-history.js';
import {selectToolRelease} from './browser-tool-adoption.js';
import {restoreHistoricalToolRelease} from '../../../../tools/authoring/browser-tool-history.js';

vi.mock('node:fs/promises',async importOriginal=>{
 const actual=await importOriginal<typeof import('node:fs/promises')>();
 return {...actual,writeFile:vi.fn(actual.writeFile),rm:vi.fn(actual.rm)};
});
const actualFs=await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
const roots:string[]=[];
afterEach(async()=>{
 vi.mocked(writeFile).mockImplementation(actualFs.writeFile);vi.mocked(rm).mockImplementation(actualFs.rm);
 for(const root of roots.splice(0))await actualFs.rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});
});
const git=(root:string,args:string[],input?:string|Buffer)=>execFileSync('git',['-c','core.fsmonitor=false','-C',root,...args],{
 input,stdio:'pipe',maxBuffer:20_000_000,env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1'},
});
const index=JSON.parse(await readFile('config/browser-tools/history.json','utf8'));
const retained=JSON.parse(await readFile('docs/migration/prime-history-retention-v1.json','utf8')) as {
 releases:{toolId:string;releaseId:string;commit:string;tree:string;pinSha256:string;fileCount:number;bytes:number;
 files:{path:string;mode:string;bytes:number;gitBlob:string;sha256:string}[]}[];
};
const pins=retained.releases.map(record=>browserToolReleases.find(pin=>pin.toolId===record.toolId&&pin.releaseId===record.releaseId)!);
const selected=JSON.parse(await readFile('config/browser-tools/installations.json','utf8')).installations[0].pin;
const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
// The merged retention implementation still has every approved preimage.
const preRemovalMain='d3b522303fa310d91b06cefa950b822a0f4c56e3';
async function root(){const value=await mkdtemp(join(tmpdir(),'tool-retention-'));roots.push(value);return value;}
async function fixture(){
 const value=await root();
 // Independent full object store, not alternates or a shallow/archive-only fixture.
 git(resolve('.'),['clone','--quiet','--local','--no-hardlinks','--no-checkout',resolve('.'),value]);
 expect(git(value,['rev-parse','--is-shallow-repository']).toString().trim()).toBe('false');
 await expect(lstat(join(value,'.git/objects/info/alternates'))).rejects.toMatchObject({code:'ENOENT'});
 for(const path of ['config/browser-tools','vendor/browser-tool-license-supplements','apps/site/public/tool-licenses/prime-factorizer-v0.1.0']){
  await mkdir(join(value,path),{recursive:true});await cp(resolve(path),join(value,path),{recursive:true});
 }
 // v0.2.5 remains immutable on disk; adoption does not authorize its retirement.
 for(const pin of browserToolReleases.filter(p=>!index.releases.some((r:{toolId:string;releaseId:string})=>r.toolId===p.toolId&&r.releaseId===p.releaseId))){
  const active='vendor/browser-tools/'+pin.toolId+'/'+pin.releaseId;
  await mkdir(join(value,active),{recursive:true});await cp(resolve(active),join(value,active),{recursive:true});
 }
 return value;
}
async function regularPaths(directory:string):Promise<string[]>{
 const files:string[]=[];
 async function walk(path:string){for(const name of await readdir(path)){
  const child=join(path,name),info=await lstat(child);
  expect(info.isSymbolicLink()).toBe(false);
  if(info.isDirectory())await walk(child);else{expect(info.isFile()).toBe(true);expect(info.nlink).toBe(1);files.push(relative(directory,child).replaceAll('\\','/'));}
 }}
 await walk(directory);return files.sort();
}

it('preserves all 291 immutable preimages and original six records after retiring only the three tracked copies',async()=>{
 expect(retained.releases.map(r=>r.releaseId)).toEqual(['v0-2-2','v0-2-3','v0-2-4']);
 expect(index.releases).toHaveLength(9);expect(browserToolReleases).toHaveLength(11);
 const original=JSON.parse(git(resolve('.'),['show','e862538b8cae2249fba7c8fe98a043d7f96b67f5:config/browser-tools/history.json']).toString());
 expect(index.releases.slice(0,6)).toEqual(original.releases);
 expect(retained.releases.flatMap(r=>r.files)).toHaveLength(291);
 expect(retained.releases.reduce((sum,r)=>sum+r.bytes,0)).toBe(17_416_793);
 git(resolve('.'),['merge-base','--is-ancestor',preRemovalMain,'HEAD']);
 for(const [i,record] of retained.releases.entries()){
  const pin=pins[i]!,path='vendor/browser-tools/'+record.toolId+'/'+record.releaseId;
  git(resolve('.'),['merge-base','--is-ancestor',record.commit,'HEAD']);
  expect(git(resolve('.'),['rev-parse',record.commit+':'+path]).toString().trim()).toBe(record.tree);
  expect(git(resolve('.'),['rev-parse',preRemovalMain+':'+path]).toString().trim()).toBe(record.tree);
  expect(git(resolve('.'),['ls-files','-z','--',path]).length).toBe(0);
  expect(fingerprint(pin)).toBe(record.pinSha256);expect(record.fileCount).toBe(97);
  expect(index.releases.find((r:{releaseId:string})=>r.releaseId===record.releaseId)).toEqual({toolId:record.toolId,releaseId:record.releaseId,commit:record.commit,tree:record.tree,pinSha256:record.pinSha256});
  const files=(await readHistoricalToolFiles(resolve('.'),pin))!;
  expect([...files.keys()].sort()).toEqual(record.files.map(f=>f.path.slice(path.length+1)).sort());
  for(const file of record.files){
   const bytes=files.get(file.path.slice(path.length+1))!;
   expect(file.mode).toBe('100644');expect(bytes.length).toBe(file.bytes);expect(digest(bytes)).toBe(file.sha256);
   expect(createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex')).toBe(file.gitBlob);
  }
  expect([...files.values()].reduce((sum,b)=>sum+b.length,0)).toBe(record.bytes);
  // Absent trees use immutable bytes; explicitly restored trees must still pass.
  expect((await verifyRetainedToolPin(resolve('.'),pin)).toolId).toBe(pin.toolId);
 }
},60000);

it('verifies all eleven pins with the two non-archived vendors, restores each added release byte-for-byte, then selects only inside a full-clone fixture',async()=>{
 const value=await fixture(),vendor=join(value,'vendor/browser-tools');
 for(const pin of browserToolReleases)expect((await verifyRetainedToolPin(value,pin)).toolId).toBe(pin.toolId);
 for(const pin of pins){
  const path=join(vendor,pin.toolId,pin.releaseId),expected=(await readHistoricalToolFiles(value,pin))!;
  await expect(lstat(path)).rejects.toMatchObject({code:'ENOENT'});
  await expect(selectToolRelease(vendor,[pin],pin.toolId,pin.releaseId)).rejects.toThrow();
  expect(await restoreHistoricalToolRelease(value,pin)).toMatchObject({restored:true});
  expect(await regularPaths(path)).toEqual([...expected.keys()].sort());expect(expected.size).toBe(97);
  for(const [name,bytes] of expected){const info=await lstat(join(path,name));expect(info.size).toBe(bytes.length);expect((await readFile(join(path,name))).equals(bytes)).toBe(true);if(process.platform!=='win32')expect(info.mode&0o111).toBe(0);}
  expect(await selectToolRelease(vendor,[pin],pin.toolId,pin.releaseId)).toEqual(pin);
  const mtime=(await lstat(join(path,'browser-tool.json'))).mtimeMs;
  expect(await restoreHistoricalToolRelease(value,pin)).toMatchObject({restored:false});
  expect((await lstat(join(path,'browser-tool.json'))).mtimeMs).toBe(mtime);
  const manifest=JSON.parse(expected.get('browser-tool.json')!.toString('utf8'));
  const entry=join(path,manifest.integration.entry),changed=Buffer.concat([await readFile(entry),Buffer.from('\n//changed')]);
  await writeFile(entry,changed);
  await expect(verifyRetainedToolPin(value,pin)).rejects.toThrow();
  await expect(restoreHistoricalToolRelease(value,pin)).rejects.toThrow();
  await expect(selectToolRelease(vendor,[pin],pin.toolId,pin.releaseId)).rejects.toThrow();
  expect((await readFile(entry)).equals(changed)).toBe(true);
  await rm(entry);
  await expect(verifyRetainedToolPin(value,pin)).rejects.toThrow();
  await expect(restoreHistoricalToolRelease(value,pin)).rejects.toThrow();
  await expect(lstat(entry)).rejects.toMatchObject({code:'ENOENT'});
 }
 // Restoration/selection never edits installation/admission state.
 expect(await readFile(join(value,'config/browser-tools/installations.json'))).toEqual(await readFile('config/browser-tools/installations.json'));
 const active=join(vendor,selected.toolId,selected.releaseId);await rm(active,{recursive:true});
 await expect(verifyRetainedToolPin(value,selected)).rejects.toThrow();
},60000);

it('rejects a linked parent with an absent child instead of hiding it behind Git fallback',async()=>{
 const value=await fixture(),pin=pins[0]!,outside=join(value,'unrelated'),vendor=join(value,'vendor/browser-tools');
 await mkdir(outside);await writeFile(join(outside,'marker'),'untouched');
 // Use another tool directory in the fixture so the retained active tree stays untouched.
 await rm(join(vendor,pin.toolId),{recursive:true});
 await symlink(outside,join(vendor,pin.toolId),process.platform==='win32'?'junction':'dir');
 await expect(verifyRetainedToolPin(value,pin)).rejects.toThrow(/links|symlink/);
 await expect(restoreHistoricalToolRelease(value,pin)).rejects.toThrow(/links|symlink/);
 expect(await readFile(join(outside,'marker'),'utf8')).toBe('untouched');expect(await readdir(outside)).toEqual(['marker']);
},30000);

it('does not replace an ordinary-file target or a restored tree missing its manifest',async()=>{
 const value=await fixture(),pin=pins[0]!,target=join(value,'vendor/browser-tools',pin.toolId,pin.releaseId);
 await writeFile(target,'existing file');
 await expect(restoreHistoricalToolRelease(value,pin)).rejects.toThrow();expect(await readFile(target,'utf8')).toBe('existing file');
 await rm(target);await restoreHistoricalToolRelease(value,pin);await rm(join(target,'browser-tool.json'));
 await expect(restoreHistoricalToolRelease(value,pin)).rejects.toThrow();
 await expect(verifyRetainedToolPin(value,pin)).rejects.toThrow();
 await expect(lstat(join(target,'browser-tool.json'))).rejects.toMatchObject({code:'ENOENT'});
},30000);

it('cleans a partially written stage and owned lock, preserves other bytes, and can retry',async()=>{
 const value=await fixture(),pin=pins[0]!,parent=join(value,'vendor/browser-tools',pin.toolId);
 const marker=join(parent,'unrelated');await writeFile(marker,'untouched');let writes=0;
 vi.mocked(writeFile).mockImplementation(async(...args:Parameters<typeof writeFile>)=>{
  if(String(args[0]).includes('.restore-')&&++writes===2)throw Error('injected stage write failure');
  return actualFs.writeFile(...args);
 });
 await expect(restoreHistoricalToolRelease(value,pin)).rejects.toThrow('injected stage write failure');
 vi.mocked(writeFile).mockImplementation(actualFs.writeFile);
 expect(writes).toBe(2);expect(await readdir(parent)).toEqual(expect.arrayContaining([selected.releaseId,'unrelated']));
 expect((await readdir(parent)).filter(name=>name.startsWith('.')||name===pin.releaseId)).toEqual([]);
 expect(await readFile(marker,'utf8')).toBe('untouched');
 expect(await restoreHistoricalToolRelease(value,pin)).toMatchObject({restored:true});
},30000);

it('releases its owned lock even when stage cleanup itself fails',async()=>{
 const value=await fixture(),pin=pins[0]!,parent=join(value,'vendor/browser-tools',pin.toolId);
 await writeFile(join(parent,pin.releaseId),'untouched');
 vi.mocked(rm).mockImplementation(async(...args:Parameters<typeof rm>)=>{
  if(String(args[0]).includes('.restore-'))throw Error('injected cleanup failure');return actualFs.rm(...args);
 });
 await expect(restoreHistoricalToolRelease(value,pin)).rejects.toThrow('injected cleanup failure');
 await expect(lstat(join(parent,'.adoption-lock'))).rejects.toMatchObject({code:'ENOENT'});
 expect(await readFile(join(parent,pin.releaseId),'utf8')).toBe('untouched');
},30000);

it('rejects actual Git entries with unsafe modes/paths, case aliases, or excessive byte/file budgets before restoration',async()=>{
 const value=await root(),pin=pins[0]!;git(value,['init','--quiet']);await mkdir(join(value,'config/browser-tools'),{recursive:true});
 const blob=(bytes:Buffer)=>git(value,['hash-object','-w','--stdin'],bytes).toString().trim();
 const small=blob(Buffer.from('x')),large=blob(Buffer.alloc(2_000_001)),bounded=blob(Buffer.alloc(2_000_000));
 const tree=(lines:string)=>git(value,['mktree','-z'],lines).toString().trim();
 const commit=(oid:string)=>git(value,['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit-tree',oid], 'fixture\n').toString().trim();
 const seed=commit(tree('100644 blob '+small+'\tseed\0'));
 const cases:[string,RegExp][]=[
  ['100755 blob '+small+'\texecutable\0',/Unsafe historical tool object/],
  ['120000 blob '+small+'\tlink\0',/Unsafe historical tool object/],
  ['160000 commit '+seed+'\tsubmodule\0',/Unsafe historical tool object/],
  ['100644 blob '+small+'\tbad\\name\0',/Unsafe historical tool object/],
  ['100644 blob '+small+'\tbad name\0',/Unsafe historical tool object/],
  ['100644 blob '+small+'\tName\0'+'100644 blob '+small+'\tname\0',/exact file budget/],
  ['100644 blob '+large+'\tlarge\0',/Oversized historical tool object/],
  [Array.from({length:5},(_,i)=>'100644 blob '+bounded+'\tfile'+i+'\0').join(''),/exact file budget/],
  [Array.from({length:102},(_,i)=>'100644 blob '+small+'\tfile'+i+'\0').join(''),/exact file budget/],
 ];
 for(const [entries,message] of cases){
  const releaseTree=tree(entries);let nested=releaseTree;
  for(const name of [pin.releaseId,pin.toolId,'browser-tools','vendor'])nested=tree('040000 tree '+nested+'\t'+name+'\0');
  await writeFile(join(value,'config/browser-tools/history.json'),JSON.stringify({schemaVersion:1,releases:[{toolId:pin.toolId,releaseId:pin.releaseId,commit:commit(nested),tree:releaseTree,pinSha256:fingerprint(pin)}]}));
  await expect(readHistoricalToolFiles(value,pin)).rejects.toThrow(message);
  await expect(lstat(join(value,'vendor'))).rejects.toMatchObject({code:'ENOENT'});
 }
},30000);
