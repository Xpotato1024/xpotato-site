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
   'packages/site-validators/src/migration/migration-cohort.ts',
   'packages/site-validators/src/browser-tools/tool-runtime-policy.ts',
   'tools/build/publication.ts',
   'tools/authoring/content-draft.ts',
  ]){
   const source=await readFile(resolve(path),'utf8');
   expect(source).toContain('@xpotato/portable-content/catalog');
   expect(source).not.toContain('/lib/discovery/catalog.js');
  }
 });
 it('does not put fixture source builders back into production validation modules',async()=>{
  const files=await readdir(resolve('packages/site-validators/src'));
  expect(files).not.toContain('browser-tool-fixture.ts');
  expect(files).not.toContain('page-authoring.ts');
  expect(files).not.toContain('browser-tool-authoring.ts');
 });
 it('keeps frozen migration writes out of shared read-only regeneration checks',async()=>{
  const names=['phase4-content-materialization','phase5-taxonomy-inventory','phase5-taxonomy-materialization',
   'phase6-media-inventory','phase6-media-review','phase6-media-candidate','phase7-interactive-readiness','phase8-route-discovery-readiness'];
  for(const name of names){
   const source=await readFile(resolve('packages/site-validators/src/migration',name+'.ts'),'utf8');
   expect(source,name).not.toMatch(/\b(?:writeFile|mkdir|rm|rename|open)\s*\(/);
   expect(source,name).not.toMatch(/^import .*from ['"](?:\.\.\/)+tools\//m);
  }
  const files=await readdir(resolve('packages/site-validators/src'));
  expect(files).not.toContain('phase6-media-processing.ts');
  expect(files).not.toContain('release-package-cli.ts');
  expect(files).not.toContain('security-headers-cli.ts');
 });
});
