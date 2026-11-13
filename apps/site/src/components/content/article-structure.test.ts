import {readFile} from 'node:fs/promises';
import {describe,it,expect} from 'vitest';
import postcss, {type Rule} from 'postcss';
const resolvedSelectors=(rule:Rule):string[]=>{
 const parent=rule.parent;
 if(parent?.type!=='rule')return rule.selectors;
 return rule.selectors.flatMap(selector=>resolvedSelectors(parent).map(ancestor=>selector.includes('&')?selector.replaceAll('&',ancestor):`${ancestor} ${selector}`));
};
const proseSelectors=(css:string)=>{
 const selectors:string[]=[];
 postcss.parse(css).walkRules(rule=>{if(rule.nodes.some(node=>node.type==='decl'))selectors.push(...resolvedSelectors(rule).filter(selector=>selector.includes('.prose ')));});
 return selectors;
};
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
  const selectors=proseSelectors(modules);
  expect(selectors.length).toBeGreaterThan(10);
  for(const selector of selectors)expect(selector).toMatch(/:not\(:where\(\[data-bt\],\s*\[data-bt\] \*\)\)/u);
 });
 it('retains exclusions through nesting but exposes unscoped siblings',()=>{
  const selectors=proseSelectors(':not(:where([data-bt],[data-bt] *)){.prose .title&{color:red}} .prose .unsafe{color:red}');
  expect(selectors).toEqual(['.prose .title:not(:where([data-bt],[data-bt] *))','.prose .unsafe']);
 });
 it('uses intrinsic icon dimensions and only labels provided reasons',async()=>{
  const icon=await get('./ArticleIcon.astro'),item=await get('./DiagnosticItem.astro');
  expect(icon).toContain('width="20" height="20"');expect(icon).toContain('aria-hidden="true"');
  expect(item).toContain('{reason &&');expect(item).not.toContain('なぜ？');
 });
 it('provides the selected Japanese body face as metadata fallback without changing code fonts',async()=>{
  const css=await get('../../styles/global.css');
  expect(css).toMatch(/--font-mono:\s*ui-monospace,\s*"Cascadia Code",\s*monospace;/u);
  expect(css).toMatch(/--font-meta:[^;]*"Zen Kaku Gothic New"/u);
 });
});
