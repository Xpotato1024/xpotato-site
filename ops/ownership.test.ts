import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {describe,it,expect} from 'vitest';

describe('working-tool ownership boundaries',()=>{
 it('keeps installation checking free from process and file mutations',async()=>{
  const source=await readFile(resolve("packages/site-validators/src/browser-tools/browser-tool-installation.ts"),'utf8');
  expect(source).not.toMatch(/\b(?:writeFile|mkdir|rm|rename|open|execFileSync|spawnSync)\s*\(/);
  expect(source).toContain('export async function checkBrowserToolInstallations');
  expect(source).not.toMatch(/^import .*from ['"](?:\.\.\/)+tools\//m);
 });
 it('keeps content catalog in a reusable package instead of reaching into the Astro site',async()=>{
  for(const name of ['catalog.ts','feed.ts']){
   const source=await readFile(resolve('packages/portable-content/src',name),'utf8');
   expect(source).not.toMatch(/apps\/site|astro:|\.\.\/\.\.\//u);
  }
  for(const path of [
   'packages/site-validators/src/site-content.ts',
   'packages/site-validators/src/browser-tools/tool-runtime-policy.ts',
   'ops/build/publication.ts',
   'ops/authoring/content-draft.ts',
  ]){
   const source=await readFile(resolve(path),'utf8');
   expect(source).toContain('@xpotato/portable-content/catalog');
   expect(source).not.toContain('/lib/discovery/catalog.js');
  }
 });
 it('keeps content registry data independent from Astro renderer implementations',async()=>{
  async function check(directory:string):Promise<void>{for(const entry of await readdir(resolve(directory),{withFileTypes:true})){const path=directory+'/'+entry.name;if(entry.isDirectory())await check(path);else if(/\.(?:ts|mjs)$/u.test(entry.name)&&!entry.name.includes('.test.')){const source=await readFile(resolve(path),'utf8');expect(source,path).not.toMatch(/(?:import|export)[^;]*from\s*['"][^'"]*(?:apps\/site|\.astro)(?:[^'"]*)['"]/u);}}}
  await check('content/registry');
  const adapter=await readFile(resolve('apps/site/src/features/tools/registry/component-imports.ts'),'utf8');expect(adapter).toContain('./generated/components.js');
 });
 it('does not put fixture source builders back into production validation modules',async()=>{
  const files=await readdir(resolve('packages/site-validators/src'));
  expect(files).not.toContain('browser-tool-fixture.ts');
  expect(files).not.toContain('page-authoring.ts');
  expect(files).not.toContain('browser-tool-authoring.ts');
 });
});
