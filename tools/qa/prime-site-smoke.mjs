// Site integration only. Product algorithms, input matrices and resource limits
// are certified by the exact admitted upstream release, not repeated per site CI.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

export function primeLicenseSource(root,pin,version) {
 return version==='0.1.0'
  ? join(root,'vendor/browser-tool-license-supplements/prime-factorizer-v0-1-0/MUSL-COPYRIGHT.txt')
  : join(root,'vendor/browser-tools',pin.toolId,pin.releaseId,'vendor/emscripten/MUSL-COPYRIGHT.txt');
}

export function observeSiteWorkerLifecycle(socket) {
 const workerSessions=new Set();
 const workerListener=event=>{
  const message=JSON.parse(String(event.data));
  if(message.method==='Target.attachedToTarget'&&message.params.targetInfo.type==='worker')workerSessions.add(message.params.sessionId);
  if(message.method==='Target.detachedFromTarget')workerSessions.delete(message.params.sessionId);
 };
 socket.addEventListener('message',workerListener);
 return {workerSessions,dispose:()=>socket.removeEventListener('message',workerListener)};
}

export async function verifyPrimeSiteSmoke({root,temp,origin,send,evaluate,until,httpTrace,socket}) {
 const {pin}=JSON.parse(await readFile(join(root,'config/browser-tools/installations.json'),'utf8')).installations.find(x=>x.pin.toolId==='prime-factorizer');
 const manifest=JSON.parse(await readFile(join(root,'vendor/browser-tools',pin.toolId,pin.releaseId,'browser-tool.json'),'utf8'));
 const selector="document.querySelector('.bt-prime-factorizer')";
 const report={scope:'site integration only; upstream product tests are not rerun',releaseId:pin.releaseId,sourceCommit:pin.sourceCommit,artifactSha256:pin.artifactSha256,layouts:[]};
 const lifecycle=observeSiteWorkerLifecycle(socket),workerSessions=lifecycle.workerSessions;
 const hook=await send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
  const state={token:Math.random().toString(36),active:0,urls:0};window.__siteToolLifecycle=state;
  const Original=Worker;window.Worker=class extends Original{constructor(...args){super(...args);state.active++;let done=false;const end=this.terminate.bind(this);this.terminate=()=>{const value=end();if(!done){done=true;state.active--;}return value;};}};
  const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL),urls=new Set();
  URL.createObjectURL=(...args)=>{const url=create(...args);urls.add(url);state.urls=urls.size;return url;};
  URL.revokeObjectURL=url=>{revoke(url);urls.delete(url);state.urls=urls.size;};
 })();`});
 const navigate=async()=>{
  const previous=await evaluate('window.__siteToolLifecycle?.token??null');
  await send('Page.navigate',{url:origin+'/tools/prime-factorizer/'});
  await until(()=>evaluate(`window.__siteToolLifecycle?.token!==${JSON.stringify(previous)}&&Boolean(window.__siteToolLifecycle)&&location.pathname==='/tools/prime-factorizer/'&&document.readyState==='complete'&&Boolean(document.querySelector('astro-island'))`),'site Tool document');
  await evaluate("document.querySelector('astro-island').firstElementChild.scrollIntoView()");
  await until(()=>evaluate(`${selector}?.dataset.phase==='ready'`),'installed Tool hydration');
  await evaluate('document.fonts.ready');
 };
 const submit=async input=>evaluate(`(()=>{const r=${selector},input=r.querySelector('input');input.value=${JSON.stringify(input)};input.dispatchEvent(new Event('input',{bubbles:true}));r.querySelector('form').requestSubmit();})()`);
 const retired=()=>until(()=>evaluate('window.__siteToolLifecycle.active===0&&window.__siteToolLifecycle.urls===0'),'host unmount retires Worker/Blob');
 try {
  // Observe lifecycle events without pausing Workers or instrumenting their
  // Runtime/Network domains. Constructor completion is not target discovery.
  await send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:true});
  await send('Network.setBypassServiceWorker',{bypass:true});
  await navigate();
  assert.equal(await evaluate("document.querySelector('[data-tool-version]').textContent"),manifest.version);
  assert.equal(await evaluate("document.querySelector('[data-prime-tool-version]').dataset.primeToolVersion"),manifest.version);
  assert.equal(await evaluate("document.querySelector('.tool-release > p a').href"),pin.source.repository+'/tree/'+pin.sourceCommit);
  assert.equal(await evaluate("document.querySelector('[data-tool-capabilities]').dataset.capabilityManifest"),pin.manifestSha256);
  // Static readiness checks all pinned/license bytes. Check the actual HTTP path too.
  const licensePath='/tool-licenses/prime-factorizer-v'+manifest.version+'/MUSL-COPYRIGHT.txt';
  const response=await fetch(origin+licensePath);
  assert.equal(response.status,200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),await readFile(primeLicenseSource(root,pin,manifest.version)));
  await until(async()=>{const n=httpTrace.length;await new Promise(resolve=>setTimeout(resolve,1000));return n===httpTrace.length;},'initial host assets settle');
  const before=httpTrace.length;
  await submit('360');
  await until(()=>evaluate(`${selector}.dataset.phase==='result'`),'one installed bundle operation');
  assert.match(await evaluate(`${selector}.querySelector('.bt-equation').textContent`),/360 = 2\^3 × 3\^2 × 5/u);
  await retired();
  assert.deepEqual(httpTrace.slice(before),[],'ready Tool operation makes no HTTP requests');
  report.operation='one small input: hydrate/submit/result under the final bundle and CSP';
  assert.equal(await evaluate("fetch('/search/search-index.json').then(()=>false,()=>true)"),true,'host page connect-src enforcement');
  const cspStart=httpTrace.length;
  assert.equal(await evaluate(`new Promise((resolve,reject)=>{const url=URL.createObjectURL(new Blob(["fetch('"+location.origin+"/xpotato-logo.svg?site-worker-csp').then(()=>postMessage('unexpected'),()=>postMessage('blocked'));"],{type:'text/javascript'}));const worker=new Worker(url);worker.onmessage=e=>{worker.terminate();URL.revokeObjectURL(url);resolve(e.data);};worker.onerror=reject;})`),'blocked','host Worker inherits connect-src');
  assert.equal(httpTrace.slice(cspStart).some(x=>x.path.includes('site-worker-csp')),false);
  report.csp='page and Blob Worker fetch denied by the final host headers';
  // Only wrapper integration: start one job and unmount it. No factor result,
  // engine choice, time budget, concurrency policy or cancellation matrix here.
  const hard='1522605027922533360535618378132637429718068114961380688657908494580122963258952897654000350692006139';
  await submit(hard);
  await until(()=>evaluate('window.__siteToolLifecycle.active>0'),'job before Astro unmount');
  await until(()=>Promise.resolve(workerSessions.size>0),'actual owned Worker attachment before unmount');
  await evaluate("document.querySelector('astro-island').dispatchEvent(new Event('astro:unmount'))");
  await retired();
  await until(()=>Promise.resolve(workerSessions.size===0),'unmounted Worker sessions retire');
  await navigate();
  await submit(hard);
  await until(()=>evaluate('window.__siteToolLifecycle.active>0'),'job before site navigation');
  await until(()=>Promise.resolve(workerSessions.size>0),'actual owned Worker attachment before navigation');
  await send('Page.navigate',{url:origin+'/search/'});
  await until(()=>evaluate("location.pathname==='/search/'&&document.readyState==='complete'"),'ordinary site navigation');
  await until(()=>Promise.resolve(workerSessions.size===0),'old document Worker sessions retire');
  report.lifecycle='Astro wrapper unmount and ordinary document navigation retire owned Workers';
  await navigate();
  // Host layout only; product interaction and theme matrices stay upstream.
  for(const [width,scale] of [[1440,100],[320,200]]) {
   await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
   await evaluate(`document.documentElement.style.fontSize='${scale}%';${selector}.scrollIntoView({block:'start'})`);
   await evaluate('document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))');
   const layout=await evaluate(`(()=>{const r=${selector};return{document:document.documentElement.scrollWidth,viewport:innerWidth,tool:r.getBoundingClientRect().width,scroll:r.scrollWidth,font:getComputedStyle(r).fontFamily,hostFont:getComputedStyle(document.querySelector('.tool-release')).fontFamily}})()`);
   assert.ok(layout.document<=width+1&&layout.scroll<=layout.tool+1);assert.equal(layout.font,layout.hostFont);
   await evaluate(`${selector}.querySelector('[data-action=settings]').click()`);
   assert.equal(await evaluate(`${selector}.querySelector('dialog.bt-settings').matches(':modal')`),true);
   assert.equal(await evaluate(`(()=>{const d=${selector}.querySelector('dialog.bt-settings');return d.scrollWidth<=d.getBoundingClientRect().width+1&&document.documentElement.scrollWidth<=innerWidth+1})()`),true);
   await evaluate(`${selector}.querySelector('[data-action=cancel-settings]').click()`);
   assert.equal(await evaluate(`document.activeElement===${selector}.querySelector('[data-action=settings]')`),true);
   const screenshot=`prime-site-${width}-${scale}.png`,png=await send('Page.captureScreenshot',{format:'png'});
   await writeFile(join(temp,screenshot),Buffer.from(png.data,'base64'));report.layouts.push({width,textScale:scale,...layout,screenshot});
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1487,height:1058,deviceScaleFactor:1,mobile:false});
  await navigate();
  await writeFile(join(temp,'prime-site-smoke.json'),JSON.stringify(report,null,2)+'\n');return report;
 } finally {
  await send('Target.setAutoAttach',{autoAttach:false,waitForDebuggerOnStart:false,flatten:true});
  lifecycle.dispose();
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:hook.identifier});
 }
}
