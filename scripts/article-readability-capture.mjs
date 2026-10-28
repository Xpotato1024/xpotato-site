import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat,access} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const repo=fileURLToPath(new URL('../',import.meta.url));
const record=JSON.parse(await readFile(join(repo,'.local/article-readability/preview.json'),'utf8'));
assert.equal(record.productionEligible,false);assert.equal(record.scope,'synthetic_fixture');
const root=resolve(record.output);await access(join(root,'.private-draft-preview'));
const shots=join(repo,'.local/article-readability/screenshots');await mkdir(shots,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=resolve(root,'.'+pathname);const rel=relative(root,file);if(rel.startsWith('..')||isAbsolute(rel))throw Error('outside root');if((await stat(file)).isDirectory())file=join(file,'index.html');const ext=file.slice(file.lastIndexOf('.'));res.setHeader('Content-Type',mime[ext]??'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port+record.route;
const profile=join(repo,'.local/article-readability/edge-profile');await mkdir(profile,{recursive:true});
const executable=process.env.ARTICLE_PREVIEW_BROWSER??(process.platform==='win32'?'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe':'google-chrome');
const browser=spawn(executable,['--headless','--disable-gpu','--disable-extensions','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,url],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let socket;
try{
 let port,target;
 for(let i=0;i<80;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];const targets=await fetch('http://127.0.0.1:'+port+'/json').then(r=>r.json());target=targets.find(t=>t.type==='page'&&t.url===url);if(target)break;}catch{}await delay(200);}
 assert(target,'Article tab unavailable');socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j});
 let id=0;const pending=new Map();socket.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout '+method))},20000);pending.set(n,{resolve,reject,timer});socket.send(JSON.stringify({id:n,method,params}))});
 await send('Page.enable');await send('Runtime.enable');await send('DOM.enable');await send('CSS.enable');
 const js=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 for(let i=0;i<100;i++){if(await js('!!document.querySelector(".prose h2")'))break;await delay(150);}
 await js('document.fonts.ready.then(()=>true)');
 const evidence=[];
 for(const width of [1440,390,320]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
  await js('(async()=>{window.scrollTo(0,0);for(const image of document.images)image.loading="eager";await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));return true})()');
  await delay(150);
  const observation=await js(`(()=>{const style=s=>{const c=getComputedStyle(document.querySelector(s));return {family:c.fontFamily,size:c.fontSize,weight:c.fontWeight,lineHeight:c.lineHeight}};return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,tocDisplay:getComputedStyle(document.querySelector('.table-of-contents ol')).display,tocHierarchy:[...document.querySelectorAll('.table-of-contents>ol>li')].map(li=>({label:li.querySelector('a').textContent,children:li.querySelectorAll(':scope > ol a').length})),figures:document.querySelectorAll('.prose figure').length,captionSizes:[...document.querySelectorAll('figcaption')].map(e=>parseFloat(getComputedStyle(e).fontSize)),body:style('.prose >p'),heading:style('.prose h2'),meta:style('.article-meta'),reasonLabels:[...document.querySelectorAll('.article-diagnostic-label')].filter(x=>x.textContent==='理由').length,allImagesLoaded:[...document.images].every(i=>i.naturalWidth>0),privateNotice:document.querySelector('.candidate-preview-notice')?.textContent}})()`);
  assert(observation.scrollWidth<=width,'Horizontal overflow');assert.equal(observation.tocDisplay,'block');assert.deepEqual(observation.tocHierarchy.map(h=>h.children),[1,0,0]);assert.equal(observation.figures,4);assert.equal(observation.reasonLabels,1);assert(observation.captionSizes.every(n=>n>=14));assert(observation.allImagesLoaded);
  const doc=await send('DOM.getDocument');const fonts={};for(const selector of ['.prose > p','.prose h2','.article-meta span','.table-of-contents > p']){const q=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector});assert(q.nodeId,'Missing font target '+selector);fonts[selector]=(await send('CSS.getPlatformFontsForNode',{nodeId:q.nodeId})).fonts;}
  assert(fonts['.prose h2'].some(f=>/Noto.*Serif.*JP/i.test(f.familyName)&&f.isCustomFont));
  assert(fonts['.article-meta span'].some(f=>/Zen.*Kaku/i.test(f.familyName)&&f.isCustomFont),'Japanese metadata must use selected webfont');
  const dimensions=await send('Page.getLayoutMetrics');
  const full=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:Math.ceil(dimensions.cssContentSize.height),scale:1}});
  await writeFile(join(shots,width+'-full.png'),Buffer.from(full.data,'base64'));
  const top=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(shots,width+'-top.png'),Buffer.from(top.data,'base64'));
  await js('document.querySelector(".article-diagnostics").scrollIntoView({block:"start"})');await delay(100);
  const diag=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(shots,width+'-diagnostics.png'),Buffer.from(diag.data,'base64'));
  evidence.push({observation,fonts});
 }
 const isolation=await js(`(()=>{const host=document.createElement('div');host.setAttribute('data-bt','');host.innerHTML='<div class="article-diagnostic"><span class="article-diagnostic-label">検証</span></div>';document.querySelector('.prose').append(host);const display=getComputedStyle(host.firstElementChild).display;host.remove();return display})()`);assert.equal(isolation,'block');
 const linksResolve=await js("[...document.querySelectorAll('.table-of-contents a')].every(a=>!!document.getElementById(decodeURIComponent(a.hash.slice(1))))");assert(linksResolve);
 const enlargement=await js("(()=>{document.documentElement.style.fontSize='200%';const r={viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth};document.documentElement.style.removeProperty('font-size');return r})()");assert(enlargement.scrollWidth<=enlargement.viewport);
 const results={isolation,linksResolve,textSize200:enlargement,kind:'browser-layout-and-font-check',browser:await send('Browser.getVersion'),sourceIdentity:record.identity,evidence,limits:['Windows Edge, not iOS Safari','No independent editorial audit or user comprehension test','No human approval or production deployment']};
 await writeFile(join(shots,'verification.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(evidence.map(e=>({width:e.observation.width,figures:e.observation.figures,toc:e.observation.tocHierarchy,captionSizes:e.observation.captionSizes,metadataFonts:e.fonts['.article-meta span']})),null,2));
}finally{if(socket)socket.close();browser.kill();await new Promise(r=>server.close(r));}