import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {transform} from '@astrojs/compiler-rs';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const siteRequire=createRequire(new URL('../../apps/site/package.json',import.meta.url));
const runtime=await import(pathToFileURL(siteRequire.resolve('astro/runtime/server/index.js')).href);
const {experimental_AstroContainer}=await import(pathToFileURL(siteRequire.resolve('astro/container')).href);
import {chromium} from 'playwright';
import {barChartModulePropsSchema,barChartRowsSchema} from '@xpotato/content-contracts';
import {analyzeBuiltHtml,renderSecurityHeaderArtifact} from '../../packages/site-validators/src/delivery/security-headers.ts';
import {parseStaticHeaderRules,headersForPath} from '../../packages/site-validators/src/delivery/static-headers.mjs';
// Exercise the real Astro renderer and actual production header compiler, not permissive preview headers.
const source=await readFile('apps/site/src/components/content/BarChart.astro','utf8');
const compiled=transform(source,{filename:'BarChart.astro',resultScopedSlot:true});
const code=ts.transpileModule(compiled.code,{compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.CommonJS}}).outputText;
const mod={exports:{}};
new Function('require','exports',code)(id=>{
 if(id==='astro/runtime/server/index.js')return {...runtime,createMetadata:()=>({})};
 if(id==='node:crypto')return {createHash};
 if(id==='@xpotato/content-contracts')return {barChartModulePropsSchema,barChartRowsSchema};
 throw Error('Unexpected dependency '+id);
},mod.exports);
const container=await experimental_AstroContainer.create();
const rows=[{label:'予測OFF・20 ms',value:8930,note:'すり抜けあり',tone:'muted'},{label:'予測ON・20 ms',value:4790,note:'すり抜けなし'},{label:'予測OFF・2 ms',value:1060,note:'すり抜けなし'}];
const props={title:'すり抜け対策と計算の速さ',unit:'RTF',max:'9000',rows:JSON.stringify(rows)};
const chart=await container.renderToString(mod.exports.default,{props});
const second=await container.renderToString(mod.exports.default,{props:{...props,max:'18000'}});
const html='<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/chart.css"><body><main class="prose">'+chart+second+'</main></body></html>';
const css=':root{--accent:rgb(116,83,153);--text-muted:rgb(98,94,110);--text-primary:#222;--border-divider:#ddd}body{margin:24px}.prose{max-width:832px;margin:auto}'+await readFile('apps/site/src/styles/article-bar-chart.css','utf8');
const analysis=analyzeBuiltHtml([{path:'chart/index.html',html}]);assert.deepEqual(analysis.errors,[]);
const headers=renderSecurityHeaderArtifact(analysis),rules=parseStaticHeaderRules(headers);
assert.ok(!/unsafe-inline|unsafe-hashes|style-src-attr/.test(headers));assert.ok(!/ style=/.test(html));
const server=createServer((req,res)=>{for(const [k,v]of Object.entries(headersForPath(req.url,rules)))res.setHeader(k,v);res.setHeader('Content-Type',req.url==='/chart.css'?'text/css':'text/html; charset=utf-8');res.end(req.url==='/chart.css'?css:html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.ARTICLE_PREVIEW_BROWSER??(process.platform==='win32'?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':undefined),headless:true});
const results=[];try{
 const page=await browser.newPage();await page.addInitScript(()=>{window.violations=[];addEventListener('securitypolicyviolation',e=>window.violations.push(e.violatedDirective));});
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:1000});const response=await page.goto('http://127.0.0.1:'+server.address().port+'/chart/');assert.ok((await response.allHeaders())['content-security-policy'].includes('style-src'));
  const result=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,violations:window.violations,bars:[...document.querySelectorAll('.article-bar-chart__bar')].map(b=>({width:b.getBoundingClientRect().width,track:b.parentElement.getBoundingClientRect().width,color:getComputedStyle(b).backgroundColor})),text:document.querySelector('.article-bar-chart').innerText}));
  assert.equal(result.overflow,false);assert.deepEqual(result.violations,[]);assert.equal(result.bars.length,6);
  for(const [i,b]of result.bars.entries())assert.ok(Math.abs(b.width/(b.track-1)-rows[i%3].value/(i<3?9000:18000))<.001);
  results.push(result);
 }
 await mkdir('.local/chart-validation',{recursive:true});await writeFile('.local/chart-validation/csp-browser.json',JSON.stringify({status:'PASS',styleHashes:analysis.styleHashes,results},null,2));console.log(JSON.stringify({status:'PASS',results}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
