import {afterEach,expect,it} from 'vitest';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,copyFile,cp,readFile,writeFile,rm,lstat,symlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {browserToolReleases} from '../../../apps/site/src/content-registry/interactive/releases.js';
import {readHistoricalToolFiles,verifyRetainedToolPin} from './browser-tool-history.js';
import {inspectToolArtifactFiles,verifyToolPin,selectToolRelease} from './browser-tool-adoption.js';
import {restoreHistoricalToolRelease} from '../../../tools/authoring/browser-tool-history.js';
const roots:string[]=[];
afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
const historical=browserToolReleases.filter(p=>p.releaseId!=='v0-2-2');
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'tool-history-'));roots.push(root);
 execFileSync('git',['clone','--quiet','--shared','--no-checkout',resolve('.'),root]);
 await mkdir(join(root,'config/browser-tools'),{recursive:true});
 await copyFile(resolve('config/browser-tools/history.json'),join(root,'config/browser-tools/history.json'));
 await mkdir(join(root,'vendor/browser-tools'),{recursive:true});
 await cp(resolve('vendor/browser-tool-license-supplements'),join(root,'vendor/browser-tool-license-supplements'),{recursive:true});
 const license='apps/site/public/tool-licenses/prime-factorizer-v0.1.0';
 await mkdir(join(root,license),{recursive:true});
 await copyFile(resolve(license,'MUSL-COPYRIGHT.txt'),join(root,license,'MUSL-COPYRIGHT.txt'));
 return root;
}
it('checks all six historical pins from fixed Git without files or network, while the selected release still needs its vendor',async()=>{
 const root=await fixture();expect(historical).toHaveLength(6);
 for(const pin of historical)expect((await verifyRetainedToolPin(root,pin)).toolId).toBe(pin.toolId);
 expect(await lstat(join(root,'vendor/browser-tools')).then(()=>true)).toBe(true);
 await expect(lstat(join(root,'vendor/browser-tools/prime-factorizer'))).rejects.toMatchObject({code:'ENOENT'});
 const active=browserToolReleases.find(p=>p.releaseId==='v0-2-2')!;
 await expect(verifyRetainedToolPin(root,active)).rejects.toThrow();
 await expect(verifyToolPin(join(root,'vendor/browser-tools'),historical[0])).rejects.toThrow();
},30000);
it('requires actual restoration before selection and never overwrites or hides tampered/incomplete restored bytes',async()=>{
 const root=await fixture(),pin=historical.find(p=>p.releaseId==='v0-1-0')!,vendor=join(root,'vendor/browser-tools');
 await expect(selectToolRelease(vendor,[pin],pin.toolId,pin.releaseId)).rejects.toThrow();
 expect(await restoreHistoricalToolRelease(root,pin)).toMatchObject({restored:true,pin});
 await expect(selectToolRelease(vendor,[pin],pin.toolId,pin.releaseId)).resolves.toEqual(pin);
 expect(await restoreHistoricalToolRelease(root,pin)).toMatchObject({restored:false});
 const manifest=await verifyToolPin(vendor,pin),file=join(vendor,pin.toolId,pin.releaseId,manifest.integration.entry);
 const tampered=Buffer.concat([await readFile(file),Buffer.from('\n//changed')]);await writeFile(file,tampered);
 await expect(verifyRetainedToolPin(root,pin)).rejects.toThrow();
 await expect(restoreHistoricalToolRelease(root,pin)).rejects.toThrow();
 expect(await readFile(file)).toEqual(tampered);
 await rm(file);
 await expect(verifyRetainedToolPin(root,pin)).rejects.toThrow();
 await expect(restoreHistoricalToolRelease(root,pin)).rejects.toThrow('exact-set');
 await expect(readFile(file)).rejects.toMatchObject({code:'ENOENT'});
},30000);
it('rejects wrong pin, tree, missing immutable commit, unsafe file maps and missing artifact bytes',async()=>{
 const root=await fixture(),pin=historical[0]!,file=join(root,'config/browser-tools/history.json'),original=JSON.parse(await readFile(file,'utf8'));
 await expect(readHistoricalToolFiles(root,{...pin,sourceCommit:'0'.repeat(40)})).rejects.toThrow('pin identity');
 const tree=structuredClone(original);tree.releases[0].tree='0'.repeat(40);await writeFile(file,JSON.stringify(tree));
 await expect(readHistoricalToolFiles(root,pin)).rejects.toThrow('tree identity');
 const missing=structuredClone(original);missing.releases[0].commit='0'.repeat(40);await writeFile(file,JSON.stringify(missing));
 await expect(readHistoricalToolFiles(root,pin)).rejects.toThrow();
 await writeFile(file,JSON.stringify(original));
 const files=(await readHistoricalToolFiles(root,pin))!;
 const unsafe=new Map(files);unsafe.set('../escape',Buffer.from('x'));expect(()=>inspectToolArtifactFiles(unsafe)).toThrow();
 const oversized=new Map(files);oversized.set('oversized',Buffer.alloc(2000001));expect(()=>inspectToolArtifactFiles(oversized)).toThrow('too large');
 const incomplete=new Map(files);incomplete.delete('browser-tool.json');expect(()=>inspectToolArtifactFiles(incomplete)).toThrow();
},30000);
it('refuses an existing adoption lock and leaves it intact without publishing a tree',async()=>{
 const root=await fixture(),pin=historical[0]!,parent=join(root,'vendor/browser-tools',pin.toolId);
 await mkdir(parent);const lock=join(parent,'.adoption-lock');await writeFile(lock,'other operation');
 await expect(restoreHistoricalToolRelease(root,pin)).rejects.toMatchObject({code:'EEXIST'});
 expect(await readFile(lock,'utf8')).toBe('other operation');
 await expect(lstat(join(parent,pin.releaseId))).rejects.toMatchObject({code:'ENOENT'});
},15000);
it('rejects a symlink target instead of falling back to good Git bytes',async()=>{
 const root=await fixture(),pin=historical[0]!,parent=join(root,'vendor/browser-tools',pin.toolId),unrelated=join(root,'unrelated');
 await mkdir(parent);await mkdir(unrelated);await writeFile(join(unrelated,'marker'),'untouched');
 const target=join(parent,pin.releaseId);await symlink(unrelated,target,process.platform==='win32'?'junction':'dir');
 await expect(verifyRetainedToolPin(root,pin)).rejects.toThrow(/links|symlink/);
 await expect(restoreHistoricalToolRelease(root,pin)).rejects.toThrow(/links|symlink/);
 expect((await lstat(target)).isSymbolicLink()).toBe(true);
 expect(await readFile(join(unrelated,'marker'),'utf8')).toBe('untouched');
},15000);
