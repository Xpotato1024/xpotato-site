import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
const get=(name:string)=>readFile(new URL(name,import.meta.url),'utf8');
it('keeps the shell free of home, search results and code-toolbar rules',async()=>{
 const shell=await get('../styles/global.css');
 expect(shell).not.toMatch(/\.home[-\s.{]|#search-results|\.code-toolbar|\.prose\s/u);
 expect(shell).toContain('.header-search');expect(shell).toContain('prefers-reduced-motion');
 expect(await get('../pages/index.astro')).toContain('styles/home.css');
 expect(await get('../pages/search/index.astro')).toContain('pageCssHrefs={[searchCssHref]}');
});
it('retains prose and print for Tool explanations and loads code styles conditionally',async()=>{
 const layout=await get('../layouts/ContentLayout.astro');
 expect(layout).toContain('styles/content.css');
 expect(layout).toContain('pageCssHrefs={hasCodeBlocks ? [codeCssHref] : []}');
 const content=await get('../styles/content.css');
 expect(content).toContain('.prose h2');expect(content).toContain('@media print');
 expect(content).toContain('.math-source-print');
 expect(content).not.toContain('.code-toolbar');
});
