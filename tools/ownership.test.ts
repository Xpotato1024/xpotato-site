import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {describe,it,expect} from 'vitest';

describe('working-tool ownership boundaries',()=>{
 it('keeps installation checking free from process and file mutations',async()=>{
  const source=await readFile(resolve('packages/site-validators/src/browser-tool-installation.ts'),'utf8');
  expect(source).not.toMatch(/\b(?:writeFile|mkdir|rm|rename|open|execFileSync|spawnSync)\s*\(/);
  expect(source).toContain('export async function checkBrowserToolInstallations');
  expect(source).not.toMatch(/^import .*from ['"](?:\.\.\/)+tools\//m);
 });
 it('does not put fixture source builders back into production validation modules',async()=>{
  const files=await readdir(resolve('packages/site-validators/src'));
  expect(files).not.toContain('browser-tool-fixture.ts');
  expect(files).not.toContain('page-authoring.ts');
  expect(files).not.toContain('browser-tool-authoring.ts');
 });
});
