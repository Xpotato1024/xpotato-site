import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve,sep,extname} from 'node:path';
import {parseStaticHeaderRules,headersForPath} from '../../packages/site-validators/src/delivery/static-headers.mjs';
import {assertToolQuiet} from './browser-tool-interaction.mjs';
/** Actual common installer + actual Site build, under the emitted CSP. */
export async function verifyCommonToolInteraction({root,temp,send,evaluate,until,socket}){
 await new Promise((done,reject)=>{const child=spawn(process.execPath,['--import','tsx',join(root,'tools/qa/common-tool-fixture.ts')],{cwd:root,windowsHide:true,env:process.env,stdio:['ignore','pipe','pipe']});let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',b=>output+=b);child.on('error',reject);child.on('exit',c=>c===0?done():reject(Error('Common Tool fixture: '+output)));});
 const receipt=JSON.parse(await readFile(join(root,'.local/common-tool-workflows.json'),'utf8')),dist=resolve(root,receipt.dist),rules=parseStaticHeaderRules(await readFile(join(dist,'_headers'),'utf8')),http=[],events=[];
 const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml'};
 const server=createServer(async(req,res)=>{http.push(req.url);try{const u=new URL(req.url,'http://localhost'),path=resolve(dist,'.'+decodeURIComponent(u.pathname));if(path!==dist&&!path.startsWith(dist+sep))throw Error();const file=(await stat(path)).isDirectory()?join(path,'index.html'):path;res.writeHead(200,{...headersForPath(u.pathname,rules),'Content-Type':mime[extname(file)]??'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const listener=event=>{const m=JSON.parse(String(event.data));if(m.method==='Network.requestWillBeSent')events.push({kind:'request',url:m.params.request.url,resourceType:m.params.type});if(['Runtime.exceptionThrown','Network.webSocketCreated','Page.windowOpen','Page.navigatedWithinDocument'].includes(m.method))events.push({kind:m.method});};socket.addEventListener('message',listener);
 let preload;const reports=[],observations=[];
 const safeUrl=value=>{try{const u=new URL(value);return ['http:','https:','blob:'].includes(u.protocol)?{protocol:u.protocol,origin:u.origin,path:u.pathname,hasQuery:Boolean(u.search)}:{protocol:u.protocol};}catch{return {invalidUrl:true};}};
 const quiet=async(toolId,phase)=>{
  observations.push({toolId,phase,events:events.map(({url,...event})=>({...event,...(url?{url:safeUrl(url)}:{})})),http:http.map(p=>safeUrl(origin+p))});
  await writeFile(join(temp,'common-tool-workflows-browser.json'),JSON.stringify({status:'incomplete',receipt,reports,observations,productionEligible:false},null,2)+'\n');
  assertToolQuiet(events,http,'common-local-canary');
 };
 try{
  preload=await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__commonTool={created:0,retired:0,urls:0,revoked:0,csp:[],rejected:[]};const BaseWorker=Worker;window.Worker=class extends BaseWorker{constructor(...a){super(...a);__commonTool.created++;}terminate(){__commonTool.retired++;return super.terminate();}};const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=(...a)=>{__commonTool.urls++;return create(...a)};URL.revokeObjectURL=(...a)=>{__commonTool.revoked++;return revoke(...a)};addEventListener('securitypolicyviolation',e=>__commonTool.csp.push(e.violatedDirective));addEventListener('unhandledrejection',()=>__commonTool.rejected.push('rejection'));`});
  for(const {toolId}of receipt.tools){
   const worker=toolId==='synthetic-transformer';await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
   await send('Page.navigate',{url:origin+'/tools/'+toolId+'/'});
   await until(()=>evaluate(worker?'document.querySelector("[data-bounded-tool]")?.dataset.phase==="ready"':'document.querySelector("[data-browser-tool]")?.dataset.toolState==="ready"'),'common Tool ready');
   await evaluate('document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))');
   // Same initial-asset boundary as the existing Site Tool acceptance: browser
   // icons/font slices may start after fonts.ready. No computation occurs here,
   // and no request is ignored after the subsequent operation interval begins.
   await until(async()=>{const e=events.length,h=http.length;await new Promise(r=>setTimeout(r,1000));return e===events.length&&h===http.length;},'common Tool initial assets settled');
   events.length=0;http.length=0;
   const act=async value=>{
    const over=new TextEncoder().encode(value).length>4096,count=[...value].length;
    const expected=over?(worker?'入力上限':'入力は4096 bytes以内にしてください'):(worker?'コードポイント数: '+count:'文字数: '+count+' / '+value);
    await evaluate(`(()=>{const n=document.querySelector('[data-interactive-module="${toolId}"] textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(n,${JSON.stringify(value)});n.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await evaluate(`document.querySelector('[data-interactive-module="${toolId}"] form').requestSubmit()`);
    await until(()=>evaluate((worker&&!over?'document.querySelector("[data-bounded-tool]").dataset.phase==="result" && ':'')+'document.querySelector("[data-interactive-module] output").textContent==='+JSON.stringify(expected)),'common Tool deterministic result');
   };
   await act('abc');await act('<img src=x onerror=alert(1)>');
   // Astro's two checked hydration scripts belong to the outer host section;
   // this assertion checks only the tool-owned input/output DOM for injection.
   const selector=worker?'[data-bounded-tool]':'[data-browser-tool]';
   assert.equal(await evaluate('document.querySelector('+JSON.stringify(selector+' img,'+selector+' script')+')===null'),true);
   const created=await evaluate('__commonTool.created');await act('x'.repeat(4097));assert.equal(await evaluate('__commonTool.created'),created);await act('abc');
   if(worker){await evaluate('document.querySelector("[data-bounded-tool] form").requestSubmit()');await until(()=>evaluate('document.querySelector("[data-bounded-tool]").dataset.phase==="running"'),'common cancel starts');await evaluate('document.querySelectorAll("[data-bounded-tool] button")[1].click()');await until(()=>evaluate('document.querySelector("[data-bounded-tool] output").textContent.includes("中止")'),'common cancel');await act('abc');}
   await new Promise(r=>setTimeout(r,200));await quiet(toolId,'online-computation');
   await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await act('abc');await new Promise(r=>setTimeout(r,200));await quiet(toolId,'offline-computation');
   const life=await evaluate('__commonTool');assert.deepEqual(life.csp,[]);assert.deepEqual(life.rejected,[]);assert.equal(life.created,life.retired);assert.equal(life.urls,life.revoked);assert.equal(life.created>0,worker);
   for(const width of [1200,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width===390});await evaluate('scrollTo(0,0)');const png=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(temp,'common-tool-'+toolId+'-'+width+'.png'),Buffer.from(png.data,'base64'));}
   await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
   if(worker){await evaluate('document.querySelector("[data-bounded-tool] form").requestSubmit()');await send('Page.navigate',{url:origin+'/about/'});await until(async()=>!(await send('Target.getTargets')).targetInfos.some(t=>t.type==='worker'&&t.url.startsWith('blob:'+origin)),'common Tool navigation retires Worker');}
   reports.push({toolId,online:true,offline:true,readyAfterRequests:0,lifecycle:life,desktopAndNarrowScreenshots:true,physicalMobile:false});
  }
  await writeFile(join(temp,'common-tool-workflows-browser.json'),JSON.stringify({status:'passed',receipt,reports,observations,providerCalls:0,productionEligible:false},null,2)+'\n');return reports;
 }finally{if(preload)await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:preload.identifier});await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});socket.removeEventListener('message',listener);await new Promise(r=>server.close(r));}
}
