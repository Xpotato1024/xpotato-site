import {expect,it} from 'vitest';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {readFrozenLegacyTextCopies,verifiedLegacyTextRetirement} from './repository-retirement.js';
import {validateLegacyRemoval} from './git-media.js';
import {LEGACY_COMMIT,LEGACY_TAG} from './legacy-inventory.js';

it('recovers all 124 retired text/config bytes from the exact immutable source without a working copy',async()=>{
 const files=readFrozenLegacyTextCopies(process.cwd()),paths=new Set(files.keys()),root=await mkdtemp(join(tmpdir(),'legacy-text-restore-'));
 try{
  expect(paths.size).toBe(124);
  for(const[p,bytes]of files){
   const destination=join(root,p);await mkdir(dirname(destination),{recursive:true});await writeFile(destination,bytes,{flag:'wx'});
   expect(await readFile(destination),p).toEqual(bytes);
   expect(validateLegacyRemoval({kind:'D',path:p},undefined,paths).allowed,p).toBe(true);
  }
 }finally{await rm(root,{recursive:true,force:true});}
},20000);

it('keeps raster/unknown deletion and rename denied without pretending cutover evidence exists',()=>{
 const paths=verifiedLegacyTextRetirement(process.cwd());
 for(const p of ['public/images/ui/hero-workshop-stage.jpg','public/unknown.svg','src/new-unknown.ts']){
  expect(validateLegacyRemoval({kind:'D',path:p},undefined,paths).allowed,p).toBe(false);
  expect(validateLegacyRemoval({kind:'R',previousPath:p,path:'moved.txt'},undefined,paths).allowed,p).toBe(false);
 }
 expect(validateLegacyRemoval({kind:'R',path:'moved.txt'},undefined,paths).allowed).toBe(false);
 expect(validateLegacyRemoval({kind:'R',previousPath:'astro.config.mjs',path:'reproduction.txt'},undefined,paths).allowed).toBe(true);
});
it('rejects a moved/lightweight tag in an isolated clone without changing the source tag',async()=>{
 const root=await mkdtemp(join(tmpdir(),'legacy-tag-fixture-'));
 const tag=execFileSync('git',['rev-parse','refs/tags/'+LEGACY_TAG],{encoding:'utf8'}).trim();
 try{
  execFileSync('git',['clone','--quiet','--shared','--no-checkout',resolve('.'),root]);
  await mkdir(join(root,'tests/fixtures/migration'),{recursive:true});
  await writeFile(join(root,'tests/fixtures/migration/legacy-freeze-baseline.json'),await readFile(resolve('tests/fixtures/migration/legacy-freeze-baseline.json')));
  execFileSync('git',['-C',root,'update-ref','refs/tags/'+LEGACY_TAG,LEGACY_COMMIT]);
  expect(()=>verifiedLegacyTextRetirement(root)).toThrow('exact annotated');
  expect(execFileSync('git',['rev-parse','refs/tags/'+LEGACY_TAG],{encoding:'utf8'}).trim()).toBe(tag);
 }finally{await rm(root,{recursive:true,force:true});}
});
