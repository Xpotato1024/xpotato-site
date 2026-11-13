import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
const get=(name:string)=>readFile(new URL(name,import.meta.url),'utf8');
it('keeps the shell free of home, search results and code-toolbar rules',async()=>{
 const shell=await get('../styles/global.css');
 expect(shell).not.toMatch(/\.home[-\s.{]|#search-results|\.code-toolbar|\.prose\s/u);
 expect(shell).toContain('.header-search');expect(shell).toContain('prefers-reduced-motion');
 expect(await get('../pages/index.astro')).toContain('styles/home.css');
 expect(await get('../pages/search/index.astro')).toContain('pageCssHrefs={[searchCssHref,tagCssHref]}');
 expect(await get('../components/content/TagLinks.astro')).not.toContain('styles/tag-directory.css');
 for(const path of ['../components/content/ArchivePage.astro','../pages/articles/tags/[...page].astro']){
  expect(await get(path)).toContain('styles/tag-directory.css?url&no-inline');
  expect(await get(path)).toContain('pageCssHrefs={[tagCssHref]}');
 }
});
it('retains prose and print for Tool explanations and loads code styles conditionally',async()=>{
 const layout=await get('../layouts/ContentLayout.astro');
 expect(layout).toContain('styles/content.css');
 expect(layout).toContain('...(hasCodeBlocks ? [codeCssHref] : [])');
 expect(layout).toContain('...(hasAnimatedMedia ? [articleMotionCssHref] : [])');
 const content=await get('../styles/content.css');
 expect(content).toContain('.prose h2');expect(content).toContain('@media print');
 expect(content).toContain('.math-source-print');
 expect(content).not.toContain('.code-toolbar');
});
