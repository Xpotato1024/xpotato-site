import {describe,it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {derivePageShare} from '../../../apps/site/src/lib/page-share.js';
import {inspectPageShareMarkup,measurePageShareRuntime,validatePageShareSource} from './page-share-runtime.js';
import {analyzeBuiltHtml,renderSecurityHeaderArtifact,validateBuiltHtmlAgainstSecurityHeaders} from './security-headers.js';
import {measureRouteRuntime} from './phase8-runtime.js';
const title='共有 & 計算',route='/blog/sharing/',share=derivePageShare({collection:'blog',title,canonical:'https://xpotato.net'+route,canonicalOrigin:'https://xpotato.net/',published:true,noindex:false,preview:false})!;
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('"','&quot;');
const fixture=`<html><head><link rel="canonical" href="${share.url}"></head><body><main data-search-collection="blog"><h1>${escape(title)}</h1><section data-page-share data-share-title="${escape(title)}" data-share-url="${share.url}"><a href="${escape(share.x)}" target="_blank" rel="noopener noreferrer nofollow" referrerpolicy="no-referrer">X</a><a href="${escape(share.line)}" target="_blank" rel="noopener noreferrer nofollow" referrerpolicy="no-referrer">LINE</a><button data-share-copy type="button" hidden>Copy</button><button data-share-native type="button" hidden>Share</button><details><input value="${share.url}" readonly></details><p role="status" aria-live="polite"></p></section><script type="module" src="/scripts/page-share.js"></script></main></body></html>`;
describe('bounded conditional page sharing runtime',()=>{
 it.each(['fetch("/collect")','navigator.sendBeacon("/collect","input")','navigator.clipboard.readText()','location.href','import("other")','new Function("return 0")'])('rejects network/state collection/dependencies in shared source: %s',source=>expect(()=>validatePageShareSource(source)).toThrow('forbidden'));
 it('requires the actual bounded source at the built security gate',async()=>{
  const pages=[{path:'blog/sharing/index.html',html:fixture},{path:'notes/infrastructure-foundation/index.html',html:'<main><h1>Static note</h1></main>'},{path:'search/index.html',html:'<main><h1>Search</h1></main><script type="module" src="/_astro/search.js"></script>'}],headers=renderSecurityHeaderArtifact(analyzeBuiltHtml(pages));
  const source=await readFile(new URL('../../../apps/site/public/scripts/page-share.js',import.meta.url),'utf8');
  expect(validateBuiltHtmlAgainstSecurityHeaders(headers,pages,[{path:'scripts/page-share.js',source}])).toEqual([]);
  expect(validateBuiltHtmlAgainstSecurityHeaders(headers,pages,[])).toContain('Page sharing runtime asset is missing');
  expect(validateBuiltHtmlAgainstSecurityHeaders(headers,pages,[{path:'scripts/page-share.js',source:'fetch("/collect")'}]).join(' ')).toContain('forbidden');
 });
 it('admits a matching static article and preserves the ordinary unknown-script rejection',()=>{
  expect(inspectPageShareMarkup(fixture,route).pageShareScripts).toBe(1);
  expect(analyzeBuiltHtml([{path:'blog/sharing/index.html',html:fixture}]).errors).toEqual([]);
  expect(analyzeBuiltHtml([{path:'blog/sharing/index.html',html:fixture+'<script src="/scripts/unknown.js"></script>'}]).errors.length).toBeGreaterThan(0);
  expect(inspectPageShareMarkup('<main>no enhancement</main>','/about/').pageShareScripts).toBe(0);
 });
 it.each([
  fixture.replace('</head>','<meta name="robots" content="noindex"></head>'),
  fixture.replace('</head>','<meta name="xpotato-private-draft-preview-v1" content="candidate"></head>'),
  fixture.replace('data-search-collection="blog"','data-search-collection="pages"'),
  fixture.replace('data-share-title="共有 &amp; 計算"','data-share-title="private input"'),
  fixture.replace('data-share-url="'+share.url+'"','data-share-url="http://100.110.169.96:21120/"'),
  fixture.replace('src="/scripts/page-share.js"','src="https://foreign.invalid/scripts/page-share.js"'),
  fixture.replace('src="/scripts/page-share.js"','src="/scripts/page-share.js?alias=1"'),
  fixture.replace('type="module" src','async type="module" src'),
  fixture.replace('readonly',''),fixture.replace('noreferrer',''),
  fixture.replace('</script>','void 0;</script>'),fixture+'<script type="module" src="/scripts/page-share.js"></script>',
 ])('rejects hidden/private/orphaned/altered enhancement markup',html=>{expect(()=>inspectPageShareMarkup(html,route)).toThrow();});
 it('rejects a component copied to the wrong route',()=>expect(()=>inspectPageShareMarkup(fixture,'/about/')).toThrow());
 it('separately measures only reviewed local source and rejects a changed artifact',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'page-share-runtime-'));try{
   await mkdir(join(folder,'scripts'));const source=await readFile(new URL('../../../apps/site/public/scripts/page-share.js',import.meta.url));await writeFile(join(folder,'scripts/page-share.js'),source);
   const result=await measurePageShareRuntime(folder,fixture,route);expect(result.pageShareAssets).toHaveLength(1);expect(result.pageShareAssets[0]!.bytes).toBe(source.length);
   const graph=await measureRouteRuntime(folder,route,fixture);expect(graph.assets).toEqual([]);expect(graph.pageShareAssets).toEqual(result.pageShareAssets);
   await writeFile(join(folder,'scripts/page-share.js'),Buffer.concat([source,Buffer.from('\nfetch("https://bad.invalid");')]));await expect(measurePageShareRuntime(folder,fixture,route)).rejects.toThrow('source/budget');
  }finally{await rm(folder,{recursive:true,force:true});}
 });
});
