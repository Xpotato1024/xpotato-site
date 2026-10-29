import {readFile} from 'node:fs/promises';
import {describe,it,expect} from 'vitest';
const get=(p:string)=>readFile(new URL(p,import.meta.url),'utf8');
describe('article style boundaries',()=>{
 it('loads shared prose styles for tools too, modules only when rendered',async()=>{
  const s=await get('../../layouts/ContentLayout.astro');
  expect(s).not.toContain('collection === "tools" ? undefined : articleCssHref');
  expect(s).toContain('articleModulesCssHref={hasArticleModules ? articleModulesCssHref : undefined}');
 });
 it('preserves heading typography and keeps every new prose selector out of data-bt',async()=>{
  const css=await get('../../styles/article-structure.css');
  for(const rule of css.split('}').filter(s=>s.includes('.prose > h')))expect(rule).not.toMatch(/font-(?:family|size|weight)|line-height|letter-spacing/u);
  const modules=await get('../../styles/article-modules.css');
  for(const selector of modules.matchAll(/[.]prose[^{}]+[{]/gu))expect(selector[0]).toContain('[data-bt]');
 });
 it('uses intrinsic icon dimensions and only labels provided reasons',async()=>{
  const icon=await get('./ArticleIcon.astro'),item=await get('./DiagnosticItem.astro');
  expect(icon).toContain('width="20" height="20"');expect(icon).toContain('aria-hidden="true"');
  expect(item).toContain('{reason &&');expect(item).not.toContain('なぜ？');
 });
 it('provides the selected Japanese body face as metadata fallback without changing code fonts',async()=>{
  const css=await get('../../styles/global.css');
  expect(css).toContain('--font-mono: ui-monospace, "Cascadia Code", monospace;');
  expect(css).toMatch(/--font-meta:[^;]*"Zen Kaku Gothic New"/u);
 });
});
