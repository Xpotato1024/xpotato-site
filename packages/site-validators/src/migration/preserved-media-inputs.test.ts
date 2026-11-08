import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {fileSymlink} from '../../../../tests/fixtures/file-symlink.mjs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {expect,it} from 'vitest';
import {sha256} from '@xpotato/content-contracts/canonical';
import {buildPreservedMediaCatalog,readPreservedMediaInputs,preservedMediaCatalogPath,preservedMediaOutputErrors} from './preserved-media-inputs.js';
import {validateGitMediaChange,validateLegacyRemoval} from "../git-media.js";

const root=process.cwd();
async function fixture(run:(root:string)=>Promise<void>){
 const target=await mkdtemp(join(tmpdir(),'preserved-media-input-'));
 try{
  execFileSync('git',['clone','--quiet','--shared','--no-checkout',root,target]);
  const catalog=buildPreservedMediaCatalog(root);
  const paths=['tests/fixtures/migration/legacy-freeze-baseline.json','docs/migration/media-raw-inventory-v1.json',
   'docs/migration/media-repository-candidate-v1.json',preservedMediaCatalogPath,...catalog.entries.map(e=>e.path)];
  for(const path of paths){await mkdir(dirname(join(target,path)),{recursive:true});await writeFile(join(target,path),await readFile(join(root,path)));}
  await run(target);
 }finally{await rm(target,{recursive:true,force:true});}
}

it('moves exactly the nine frozen sources to new ownership, preserving full bytes and real existing bindings',()=>{
 const {catalog,byLegacyPath,relocations}=readPreservedMediaInputs(root);
 expect(catalog.entries).toHaveLength(9);expect(relocations.size).toBe(9);
 expect(catalog.entries.filter(e=>e.disposition==='migration-ingest-input')).toHaveLength(6);
 expect(catalog.entries.filter(e=>e.disposition==='homepage-build-input')).toHaveLength(1);
 const replaced=catalog.entries.filter(e=>e.disposition==='replaced-original');
 expect(replaced).toHaveLength(1);
 expect(replaced[0]!.bindings).toEqual([{contentId:'f202daa7-cb5c-4dd3-8b17-7bb6b1feefae',assetId:'inline-01',relation:'replaced-by'}]);
 const unassigned=catalog.entries.filter(e=>e.disposition==='unassigned-original');
 expect(unassigned).toHaveLength(1);expect(unassigned[0]!.bindings).toEqual([]);
 for(const entry of catalog.entries){
  const bytes=byLegacyPath.get(entry.source.path)!;
  expect(sha256(bytes)).toBe(entry.source.sha256);expect(bytes.length).toBe(entry.source.sizeBytes);
  const original=execFileSync('git',['show',entry.source.commit+':'+entry.source.path],{maxBuffer:2_000_000,env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1'}});
  expect(bytes.equals(original)).toBe(true);
  expect(validateGitMediaChange({kind:'R',previousPath:entry.source.path,path:entry.path},relocations).allowed).toBe(true);
  expect(validateGitMediaChange({kind:'A',path:entry.path},relocations).allowed).toBe(true);
  expect(validateLegacyRemoval({kind:'D',path:entry.source.path},undefined,undefined,relocations).allowed).toBe(true);
 }
 expect(validateGitMediaChange({kind:'A',path:'apps/site/source-inputs/media/sha256/unknown.jpg'},relocations).allowed).toBe(false);
 expect(validateGitMediaChange({kind:'R',previousPath:catalog.entries[0]!.source.path,path:'apps/site/public/photo.png'},relocations).allowed).toBe(false);
 expect(validateLegacyRemoval({kind:'D',path:'public/unknown.png'},undefined,undefined,relocations).allowed).toBe(false);
},20000);

it('rejects missing, changed and duplicated inputs without falling back to the original Git blob',async()=>{
 await fixture(async target=>{
  const {catalog}=readPreservedMediaInputs(target),entry=catalog.entries[0]!,path=join(target,entry.path),bytes=await readFile(path);
  await writeFile(path,Buffer.from('changed'));expect(()=>readPreservedMediaInputs(target)).toThrow('bytes mismatch');
  await rm(path);expect(()=>readPreservedMediaInputs(target)).toThrow();
  await writeFile(path,bytes);
  const file=join(target,preservedMediaCatalogPath),actual=JSON.parse(await readFile(file,'utf8'));
  actual.entries.push(actual.entries[0]);await writeFile(file,JSON.stringify(actual));
  expect(()=>readPreservedMediaInputs(target)).toThrow('exact set/ownership');
 });
},20000);

it('rejects symbolic inputs without falling back to the original Git blob',async(context)=>{
 await fixture(async target=>{
  const {catalog}=readPreservedMediaInputs(target),path=join(target,catalog.entries[0]!.path),other=join(target,catalog.entries[1]!.path);
  await rm(path);await fileSymlink(other,path,context);expect(()=>readPreservedMediaInputs(target)).toThrow('symlink');
 });
},20000);

it('rejects old-layout replicas and mismatched ownership/path mappings',async()=>{
 await fixture(async target=>{
  const entry=buildPreservedMediaCatalog(target).entries[0]!,old=join(target,entry.source.path);
  await mkdir(dirname(old),{recursive:true});await writeFile(old,await readFile(join(target,entry.path)));
  expect(()=>readPreservedMediaInputs(target)).toThrow('Old root media copy');await rm(old);
  const file=join(target,preservedMediaCatalogPath),actual=JSON.parse(await readFile(file,'utf8'));
  actual.entries[0].bindings[0].contentId='00000000-0000-4000-8000-000000000000';
  await writeFile(file,JSON.stringify(actual));expect(()=>readPreservedMediaInputs(target)).toThrow('exact set/ownership');
 });
},20000);

it('refuses raw source bytes under any output name and source-input directories while allowing derived media',()=>{
 const {catalog,byLegacyPath}=readPreservedMediaInputs(root),hashes=new Set(catalog.entries.map(e=>e.source.sha256));
 for(const bytes of byLegacyPath.values())expect(preservedMediaOutputErrors('renamed.bin',bytes,hashes)).not.toHaveLength(0);
 expect(preservedMediaOutputErrors('source-inputs/media/catalog.json',Buffer.from('{}'),hashes)).not.toHaveLength(0);
 expect(preservedMediaOutputErrors('_media/derived.webp',Buffer.from('independently validated derivative'),hashes)).toEqual([]);
});

it('has no active legacy root layout or historical version-specific checkout attributes',async()=>{
 for(const path of ['src','public','astro.config.mjs','tailwind.config.mjs','wrangler.jsonc'])await expect(stat(resolve(root,path))).rejects.toThrow();
 const attributes=await readFile(join(root,'.gitattributes'),'utf8');
 expect(attributes).not.toMatch(/prime-factorizer\/v0-/u);
 expect((await readFile(join(root,'.nvmrc'),'utf8')).trim()).toBe((await readFile(join(root,'.node-version'),'utf8')).trim());
});
