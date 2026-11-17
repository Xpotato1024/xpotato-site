// Run only after technical-visual-preview.ts. No public route is added.
import {readFile,writeFile,mkdir,lstat,stat,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,join,relative,isAbsolute,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {localBrowser} from '../../../media/visuals/browser.mjs';
import {noLinks} from '../../../media/visuals/cli.mjs';
import {hash} from '../../../media/visuals/theme.mjs';
import {privateDraftOutputErrors} from '../../../../packages/portable-content/src/private-output.ts';
const repo=fileURLToPath(new URL('../../../../',import.meta.url));
const target=resolve(repo,'.local/technical-visual-preview');
await noLinks(target);
const record=JSON.parse(await readFile(join(target,'preview.json'),'utf8'));
assert.equal(record.scope,'synthetic_fixture');assert.equal(record.productionEligible,false);assert.equal(record.approval,false);
const root=resolve(record.output);assert.equal(root,join(target,'preview'));await noLinks(root);
assert.match(await readFile(join(root,'.private-draft-preview'),'utf8'),/xpotato-private-draft-preview-v1/u);
const html=await readFile(join(root,record.route,'index.html'),'utf8');
assert.ok(privateDraftOutputErrors(record.route,html).length,'Public boundary must reject this preview');
assert.doesNotMatch(html,/astro-island|vega(?:-lite)?(?:\.min)?\.js|mermaid(?:\.min)?\.js|<iframe/u);
for(const path of ['rss.xml','sitemap-index.xml','_publication.json','search/search-index.json']) {
  try {await lstat(join(root,path));throw Error('Private preview must not generate public discovery artifact: '+path);} catch(error) {if(error.code!=='ENOENT') throw error;}
}
const shots=join(target,'screenshots');await mkdir(shots,{mode:0o700});
const runtime=join(shots,'runtime');await mkdir(runtime,{mode:0o700});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
let origin,session;
const server=createServer(async(req,res)=>{
  try {
    if (!['GET','HEAD'].includes(req.method) || req.headers.host!==new URL(origin).host || req.headers.origin&&req.headers.origin!==origin) throw Error('Private host/origin boundary');
    const pathname=decodeURIComponent(new URL(req.url,origin).pathname);
    let file=resolve(root,'.'+pathname);const rel=relative(root,file);
    if (!rel || rel.startsWith('..') || isAbsolute(rel) || rel.split(/[\\/]/u).some(part=>part.startsWith('.'))) throw Error('Private path boundary');
    await noLinks(file);
    if ((await stat(file)).isDirectory()) file=join(file,'index.html');
    const contentType=mime[extname(file)];if (!contentType) throw Error('Private file type boundary');
    res.setHeader('Content-Type',contentType);res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
    res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
    // Existing generated ops/ci/styles only; this is an isolated reference preview, not a release CSP audit.
    const body=await readFile(file);res.end(req.method==='HEAD'?undefined:body);
  } catch {res.statusCode=404;res.end('Not found');}
});
let success=false;
try {
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
  session=await localBrowser(runtime);
  const context=await session.browser.newContext({serviceWorkers:'block',locale:'ja-JP'});
  const external=[],errors=[],failed=[];
  await context.route('**/*',route=>{const url=route.request().url();if(url.startsWith(origin+'/'))return route.continue();external.push(url);return route.abort();});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)failed.push({url:response.url(),status:response.status()});});
  const evidence=[];
  for(const width of [1440,390,320]) {
    await page.setViewportSize({width,height:1000});
    await page.goto(origin+record.route,{waitUntil:'networkidle',timeout:30000});
    await page.evaluate(async()=>{for(const image of document.images)image.loading='eager';await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode()));});
    const observation=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
      private:!!document.querySelector('meta[name="xpotato-private-draft-preview-v1"]'),noindex:document.querySelector('meta[name="robots"]')?.content,
      math:document.querySelectorAll('.math-block math').length,figures:document.querySelectorAll('figure.article-figure').length,
      chart:document.querySelectorAll('.article-bar-chart').length,endnote:document.querySelectorAll('.article-endnote').length,
      imageAlt:[...document.querySelectorAll('.article-figure img')].map(image=>({alt:image.alt,loaded:image.naturalWidth>0,width:image.clientWidth,naturalWidth:image.naturalWidth})),
      tables:document.querySelectorAll('.prose table').length,bodyFont:getComputedStyle(document.querySelector('.prose')).fontFamily,
      mathFont:getComputedStyle(document.querySelector('math')).fontFamily,
      scrollGroups:[...document.querySelectorAll('.math-block')].map(el=>({label:el.getAttribute('aria-label'),tabindex:el.tabIndex,width:el.clientWidth,scrollWidth:el.scrollWidth}))}));
    assert.equal(observation.width,width);assert.ok(observation.scrollWidth<=width,'Page overflow');
    assert.ok(observation.private);assert.match(observation.noindex,/noindex/u);assert.equal(observation.math,4);
    assert.equal(observation.figures,4);assert.equal(observation.chart,1);assert.equal(observation.endnote,1);
    assert.equal(observation.tables,2);assert.ok(observation.imageAlt.every(image=>image.loaded&&image.alt.length>10));
    assert.ok(observation.scrollGroups.every(group=>group.tabindex===0&&group.label));
    assert.match(observation.bodyFont,/Zen Kaku/u);
    await page.screenshot({path:join(shots,width+'-full.png'),fullPage:true});
    await page.locator('.math-block').last().focus();
    const before=await page.locator('.math-block').last().evaluate(el=>el.scrollLeft);
    await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelectorAll('.math-block')[3].scrollLeft>0||document.querySelectorAll('.math-block')[3].scrollWidth<=document.querySelectorAll('.math-block')[3].clientWidth);
    const after=await page.locator('.math-block').last().evaluate(el=>el.scrollLeft);
    assert.ok(after>before || observation.scrollGroups[3].scrollWidth<=observation.scrollGroups[3].width);
    await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
    const zoom=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
    assert.ok(zoom.scrollWidth<=zoom.width,'200% text overflows page');
    await page.screenshot({path:join(shots,width+'-text200.png'),fullPage:true});
    await page.evaluate(()=>document.documentElement.style.removeProperty('font-size'));
    await page.addScriptTag({content:await readFile(join(repo,'node_modules/axe-core/axe.min.js'),'utf8')});
    const accessibility=await page.evaluate(async()=>{const result=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return {violations:result.violations,incomplete:result.incomplete.map(item=>({id:item.id,impact:item.impact}))};});
    assert.deepEqual(accessibility.violations,[],'WCAG A/AA violations');
    evidence.push({observation,keyboard:{before,after},text200:zoom,accessibility});
  }
  await page.emulateMedia({media:'print'});
  const print=await page.evaluate(()=>({fallback:[...document.querySelectorAll('.math-source-print .math-print-source')].map(el=>getComputedStyle(el).display),
    math:[...document.querySelectorAll('.math-source-print > .katex')].map(el=>getComputedStyle(el).display)}));
  assert.ok(print.fallback.length>=2&&print.fallback.every(display=>display!=='none'));assert.ok(print.math.every(display=>display==='none'));
  await page.pdf({path:join(shots,'print.pdf'),format:'A4',printBackground:true});
  await page.screenshot({path:join(shots,'print.png'),fullPage:true});
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  const version=session.browser.version();await context.close();const browserCleanup=await session.close();session=undefined;
  await rm(runtime,{recursive:true});
  await writeFile(join(shots,'verification.json'),JSON.stringify({protocol:'xpotato-private-technical-visual-browser-check-v1',kind:'local-technical-visual-browser-check',status:'PASS',productionEligible:false,
    approval:false,previewIdentity:record.identity,htmlSha256:hash(html),browser:version,browserCleanup,evidence,print,external,errors,failed,
    limits:['Reference fixture only, not release artifact or public discovery approval','No independent editorial/visual approval','No iOS Safari or real assistive-technology acceptance']},null,2),{flag:'wx'});
  success=true;console.log(JSON.stringify({screenshots:shots,status:'PASS',browser:version}));
} finally {
  let browserClosed=!session;
  try {await session?.close();browserClosed=true;}
  finally {
    server.closeAllConnections();if(server.listening) await new Promise(r=>server.close(r));
    if(!success&&browserClosed) {await noLinks(shots);await rm(runtime,{recursive:true,force:true});await writeFile(join(shots,'failure.json'),JSON.stringify({status:'FAIL',approval:false,productionEligible:false,reason:'Capture failed; retained screenshots are diagnostic only'}),{flag:'wx'});}
    if(!browserClosed) console.error(JSON.stringify({status:'FAIL',reason:'Browser shutdown was not verified; runtime retained',runtime,pid:session?.pid}));
  }
}
