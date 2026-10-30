import {describe,it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {derivePageShare} from '../../../apps/site/src/lib/page-share.js';
import {inspectPageShareMarkup,measurePageShareRuntime,validatePageShareSource} from './page-share-runtime.js';
import {analyzeBuiltHtml,renderSecurityHeaderArtifact,validateBuiltHtmlAgainstSecurityHeaders} from './security-headers.js';
import {measureRouteRuntime} from './phase8-runtime.js';
const title='共有 & 計算',route='/articles/0h248h248h848r248h248h248h/',share=derivePageShare({collection:'blog',title,canonical:'https://xpotato.net'+route,canonicalOrigin:'https://xpotato.net/',published:true,noindex:false,preview:false})!;
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('"','&quot;');
const fixture=`<html><head><link rel="canonical" href="${share.url}"></head><body><main data-search-collection="blog"><h1>${escape(title)}</h1><section class="page-share" data-page-share data-share-title="${escape(title)}" data-share-url="${share.url}"><div class="page-share-heading"><h2>Share</h2><p id="share-x-hint" role="tooltip">X</p><p id="share-line-hint" role="tooltip">LINE</p><p id="share-copy-hint" role="tooltip">Copy link</p><p id="share-native-hint" role="tooltip">Share menu</p></div><div class="page-share-actions"><a aria-label="Share destination" aria-describedby="share-x-hint" href="${escape(share.x)}" target="_blank" rel="noopener noreferrer nofollow" referrerpolicy="no-referrer">X</a><a aria-label="Share destination" aria-describedby="share-line-hint" href="${escape(share.line)}" target="_blank" rel="noopener noreferrer nofollow" referrerpolicy="no-referrer">LINE</a><button aria-label="Copy public URL" aria-describedby="share-copy-hint" data-share-copy type="button" hidden>Copy</button><button aria-label="Open share menu" aria-describedby="share-native-hint" data-share-native type="button" hidden>Share</button></div><div class="page-share-manual"><input value="${share.url}" readonly></div><p class="page-share-status" role="status" aria-live="polite" aria-atomic="true"></p></section><script type="module" src="/scripts/page-share.js"></script></main></body></html>`;
describe('bounded conditional page sharing runtime',()=>{
 it.each(['fetch("/collect")','navigator.sendBeacon("/collect","input")','navigator.clipboard.readText()','location.href','import("other")','new Function("return 0")'])('rejects network/state collection/dependencies in shared source: %s',source=>expect(()=>validatePageShareSource(source)).toThrow('forbidden'));
 it('requires the actual bounded source at the built security gate',async()=>{
  const pages=[{path:'articles/0h248h248h848r248h248h248h/index.html',html:fixture},{path:'notes/infrastructure-foundation/index.html',html:'<main><h1>Static note</h1></main>'},{path:'search/index.html',html:'<main><h1>Search</h1></main><script type="module" src="/_astro/search.js"></script>'}],headers=renderSecurityHeaderArtifact(analyzeBuiltHtml(pages));
  const source=await readFile(new URL('../../../apps/site/public/scripts/page-share.js',import.meta.url),'utf8');
  expect(validateBuiltHtmlAgainstSecurityHeaders(headers,pages,[{path:'scripts/page-share.js',source}])).toEqual([]);
  expect(validateBuiltHtmlAgainstSecurityHeaders(headers,pages,[])).toContain('Page sharing runtime asset is missing');
  expect(validateBuiltHtmlAgainstSecurityHeaders(headers,pages,[{path:'scripts/page-share.js',source:'fetch("/collect")'}]).join(' ')).toContain('forbidden');
 });
 it('admits a matching static article and preserves the ordinary unknown-script rejection',()=>{
  expect(inspectPageShareMarkup(fixture,route).pageShareScripts).toBe(1);
  expect(analyzeBuiltHtml([{path:'articles/0h248h248h848r248h248h248h/index.html',html:fixture}]).errors).toEqual([]);
  expect(analyzeBuiltHtml([{path:'articles/0h248h248h848r248h248h248h/index.html',html:fixture+'<script src="/scripts/unknown.js"></script>'}]).errors.length).toBeGreaterThan(0);
  expect(inspectPageShareMarkup('<main>no enhancement</main>','/about/').pageShareScripts).toBe(0);
 });
 it.each([
  fixture.replace('class="page-share-manual"','class="page-share-manual page-share-status" role="status" aria-live="polite" aria-atomic="true"').replace('<p class="page-share-status" role="status" aria-live="polite" aria-atomic="true"></p>',''),
  fixture.replace('<input value=','<input type="number" value='),
  fixture.replace('class="page-share"',''),
  fixture.replace('class="page-share-manual"',''),
  fixture.replace('class="page-share-status"',''),
  fixture.replace('aria-atomic="true"',''),
  fixture.replace('</section>','<p class="page-share-status"></p></section>'),
  fixture.replace('</section>','<span data-share-copy></span></section>'),
  fixture.replace('<div class="page-share-manual">','<div class="page-share-manual"></div>'),
  fixture.replace('</head>','<meta name="robots" content="noindex"></head>'),
  fixture.replace('</head>','<meta name="xpotato-private-draft-preview-v1" content="candidate"></head>'),
  fixture.replace('data-search-collection="blog"','data-search-collection="pages"'),
  fixture.replace('data-share-title="共有 &amp; 計算"','data-share-title="private input"'),
  fixture.replace('data-share-url="'+share.url+'"','data-share-url="http://100.110.169.96:21120/"'),
  fixture.replace('src="/scripts/page-share.js"','src="https://foreign.invalid/scripts/page-share.js"'),
  fixture.replace('src="/scripts/page-share.js"','src="/scripts/page-share.js?alias=1"'),
  fixture.replace('type="module" src','async type="module" src'),
  fixture.replace('readonly',''),fixture.replace('noreferrer',''),
  fixture.replace('class="page-share-manual"','class="page-share-manual" hidden'),
  fixture.replace('<input value=','<input hidden value='),
  fixture.replace('aria-label="Copy public URL"',''),
  fixture.replace('class="page-share-actions"',''),
  fixture.replace('class="page-share-manual"','class="page-share-manual page-share-actions"'),
  fixture.replace('</a>','</a></div>'),
  fixture.replace('aria-describedby="share-copy-hint"',''),
  fixture.replace('aria-describedby="share-native-hint"','aria-describedby="missing-hint"'),
  fixture.replace('id="share-native-hint"','id="share-copy-hint"'),
  fixture.replace('role="tooltip"','role="note"'),
  fixture.replace('class="page-share-heading"',''),
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
