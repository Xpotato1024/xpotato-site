// Actual fixed release in the one final dist; test-only instrumentation never enters the artifact.
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function verifyPrimeToolInteraction({root,temp,origin,send,evaluate,until,socket,httpTrace}){
 const events=[],setups=[],setupErrors=[],workerSessions=new Set(),readySessions=new Set(),detached=new Set();
 const listener=event=>{
  const m=JSON.parse(String(event.data));
  if(m.method==='Target.attachedToTarget'&&m.params.targetInfo.type==='worker'){
   const id=m.params.sessionId;workerSessions.add(id);
   const setup=(async()=>{
    await send('Network.enable',{},id);await send('Network.setCacheDisabled',{cacheDisabled:true},id);
    await send('Runtime.enable',{},id);readySessions.add(id);await send('Runtime.runIfWaitingForDebugger',{},id);
   })().catch(error=>{if(!detached.has(id))setupErrors.push(String(error));});setups.push(setup);
  }
  if(m.method==='Target.detachedFromTarget'){detached.add(m.params.sessionId);workerSessions.delete(m.params.sessionId);}
  if(['Network.requestWillBeSent','Network.webSocketCreated','Page.frameRequestedNavigation','Page.windowOpen','Runtime.exceptionThrown'].includes(m.method))
   events.push({method:m.method,session:m.sessionId??'page',url:m.params.request?.url??m.params.url??null});
 };
 socket.addEventListener('message',listener);
 await send('Network.setBypassServiceWorker',{bypass:true});
 const hook=await send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
  const state={documentToken:Math.random().toString(36),created:0,terminated:0,active:0,urls:0,blobs:[],csp:[]};window.__primeLifecycle=state;
  const Original=Worker;window.Worker=class extends Original{constructor(...args){super(...args);state.created++;state.active++;const end=this.terminate.bind(this);let done=false;this.terminate=()=>{const r=end();if(!done){done=true;state.terminated++;state.active--;}return r;};}};
  const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL),urls=new Set();
  URL.createObjectURL=(...a)=>{const u=create(...a);urls.add(u);state.urls=urls.size;state.blobs.push(u);return u;};
  URL.revokeObjectURL=u=>{revoke(u);urls.delete(u);state.urls=urls.size;};
  document.addEventListener('securitypolicyviolation',e=>state.csp.push(e.violatedDirective));
 })();`});
 await send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});
 const select=(n=0)=>`document.querySelectorAll('.bt-prime-factorizer')[${n}]`;
 const navigate=async()=>{const prior=await evaluate('window.__primeLifecycle?.documentToken??null');await send('Page.navigate',{url:origin+'/tools/prime-factorizer/'});await until(()=>evaluate(`Boolean(window.__primeLifecycle)&&window.__primeLifecycle.documentToken!==${JSON.stringify(prior)}&&document.readyState==='complete'`),'fresh prime document');};
 const waitReady=async(count=1)=>{
  await evaluate(`document.querySelectorAll('astro-island')[${count-1}]?.firstElementChild?.scrollIntoView()`);
  await until(()=>evaluate(`document.querySelectorAll('.bt-prime-factorizer[data-phase="ready"]').length===${count}`),'prime ready');
  await evaluate('document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))');
  await until(async()=>{const e=events.length,h=httpTrace.length;await new Promise(r=>setTimeout(r,300));return e===events.length&&h===httpTrace.length;},'initial assets including browser icon settled');
 };
 const submit=async(raw,n=0)=>{
  await evaluate(`(()=>{const root=${select(n)};root.querySelector('input').value=${JSON.stringify(raw)};root.querySelector('form').requestSubmit();})()`);
 };
 const phase=async(n=0)=>evaluate(`${select(n)}?.dataset.phase`);
 const output=async(n=0)=>evaluate(`${select(n)}.querySelector('textarea').value`);
 const retired=async()=>until(()=>evaluate('window.__primeLifecycle.active===0 && window.__primeLifecycle.urls===0'),'all Worker/Blob retirement');
 const quiet=async(action,label)=>{
  const a=events.length,h=httpTrace.length,c=await evaluate('window.__primeLifecycle.csp.length');
  await action();await retired();await new Promise(r=>setTimeout(r,80));
  const allowed=await evaluate('window.__primeLifecycle.blobs');
  const observed=events.slice(a);assert.ok(observed.filter(e=>e.url?.startsWith('blob:')).every(e=>allowed.includes(e.url)),label+' owned Blob sources');
  assert.deepEqual(observed.filter(e=>!e.url?.startsWith('blob:')),[],label+' request/socket/navigation/exception');
  assert.deepEqual(httpTrace.slice(h),[],label+' HTTP trace');
  assert.equal(await evaluate('window.__primeLifecycle.csp.length'),c,label+' CSP');
  const life=await evaluate('window.__primeLifecycle');report.intervals.push({label,networkRequests:0,httpRequests:0,cspViolations:0,createdWorkers:life.created,terminatedWorkers:life.terminated,activeWorkers:life.active,blobUrls:life.urls});
 };
 const rsa='1522605027922533360535618378132637429718068114961380688657908494580122963258952897654000350692006139';
 const report={version:'0.1.0',scope:'actual final dist; viewport emulation, not physical mobile hardware',cases:[],intervals:[]};
 try{
  await navigate();await waitReady();
  report.environment=await evaluate('({userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory??null})');
  const fixed=JSON.parse(await readFile(join(root,'docs/acceptance/browser-tools/prime-factorizer-v0.1.0-source-review.json'),'utf8'));report.sourceCommit=fixed.sourceCommit;report.artifactSha256=fixed.artifactSha256;
  const html=await readFile(join(root,'apps/site/dist/tools/prime-factorizer/index.html'),'utf8');
  const island=html.match(/<astro-island\b[\s\S]*?<\/astro-island>/u)?.[0];assert.ok(island);
  assert.equal(await evaluate("document.querySelector('[data-tool-version]').textContent"),'0.1.0');
  assert.ok(await evaluate("Array.from(document.querySelectorAll('a')).some(a=>a.href.endsWith('/SOURCE_OFFER.md'))"));
  report.siteSourceCommit=await evaluate("document.querySelector('[data-site-source-commit]').dataset.siteSourceCommit");
  assert.match(report.siteSourceCommit,/^[a-f0-9]{40}$/u);
  assert.ok(await evaluate(`Array.from(document.querySelectorAll('a')).some(a=>a.href===${JSON.stringify('https://github.com/Xpotato1024/xpotato-site/blob/')}+${JSON.stringify(report.siteSourceCommit)}+'/SITE_SOURCE_OFFER.md')`));
  for(const offline of [false,true]){
   await send('Network.emulateNetworkConditions',{offline,latency:0,downloadThroughput:offline?0:-1,uploadThroughput:offline?0:-1});
   for(const [raw,expected]of [['32','32 = 2^5'],['3.2e1','32 = 2^5'],['97','97 = 97'],['0','素数でも合成数でも'],['1','素数でも合成数でも'],['9007199254740993','9007199254740993 =']]){
    await quiet(async()=>{await submit(raw);await until(async()=>await phase()==='result','exact integer result');assert.ok((await output()).includes(expected));},'exact '+raw);
    report.cases.push({raw,offline,status:'verified by shipped result verifier'});
   }
   for(const raw of ['2.5','-4','<img src=x onerror=alert(1)>','1e10000','9'.repeat(101)]){
    await quiet(async()=>{await submit(raw);assert.equal(await phase(),'invalid');assert.equal(await output(),'');},'invalid');
   }
   await quiet(async()=>{await evaluate(`${select()}.querySelector('[data-action=reset]').click()`);await waitReady();},'reset');
  }
  await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  const configure=async(engine,time='1000')=>{
   await evaluate(`(()=>{const r=${select()},e=r.querySelector('select[id$="-engine"]');e.value=${JSON.stringify(engine)};e.dispatchEvent(new Event('change'));})()`);
   await waitReady();
   await evaluate(`(()=>{const r=${select()},t=r.querySelector('select[id$="-time"]');t.value=${JSON.stringify(time)};t.dispatchEvent(new Event('change'));})()`);
  };
  for(const engine of ['optimized','wide']){
   await configure(engine);
   await quiet(async()=>{
    await submit(rsa);await until(()=>evaluate('window.__primeLifecycle.active>0'),'heavy Worker creation');
    await until(()=>Promise.resolve(readySessions.size>0),'Worker network observation');
    await evaluate(`${select()}.querySelector('[data-action=cancel]').click()`);
    await until(async()=>await phase()==='result','cancel result');assert.match(await output(),/中止|未完了/u);
   },engine+' cancellation');
  }
  await configure('optimized');
  await quiet(async()=>{await submit(rsa);await until(async()=>await phase()==='result','finite 1-second outcome');assert.match(await output(),/未完了/u);},'finite timeout');
  await evaluate(`${select()}.querySelector('[data-action=reset]').click()`);await waitReady();
  // A second real SSR island from this exact artifact, not another implementation.
  await evaluate(`(()=>{const parsed=new DOMParser().parseFromString(${JSON.stringify(island)},'text/html').querySelector('astro-island');const node=document.importNode(parsed,true);node.setAttribute('uid','prime-acceptance-second');document.querySelector('main').append(node);node.scrollIntoView();})()`);
  await waitReady(2);
  const ids=await evaluate("Array.from(document.querySelectorAll('.bt-prime-factorizer [id]'),n=>n.id)");assert.equal(ids.length,new Set(ids).size);
  await quiet(async()=>{await submit('32',1);await until(async()=>await phase(1)==='result','second instance result');assert.match(await output(1),/32 = 2\^5/u);},'second instance');
  await quiet(async()=>{
   await submit(rsa,0);await until(()=>evaluate('window.__primeLifecycle.active>0'),'first active');
   await submit('97',1);assert.equal(await phase(1),'invalid');
   assert.ok(await evaluate(`${select(1)}.querySelector('[role=alert]').textContent.includes('別の計算')`));
   await evaluate("document.querySelector('astro-island').dispatchEvent(new Event('astro:unmount'))");
   await retired();
  },'shared lease and React unmount');
  await Promise.all(setups);assert.deepEqual(setupErrors,[]);
  assert.ok(detached.size>0,'real Worker target detachment observed');
  await navigate();await waitReady();await configure('optimized','60000');
  await submit(rsa);await until(()=>evaluate('window.__primeLifecycle.active>0'),'active job before ordinary navigation');
  const beforeNavigation=await evaluate('window.__primeLifecycle.active');
  await send('Page.navigate',{url:origin+'/search/'});
  await until(()=>evaluate("location.pathname==='/search/'&&document.readyState==='complete'"),'ordinary site navigation');
  await until(()=>Promise.resolve(workerSessions.size===0),'Worker targets retired after navigation');
  report.navigation={activeWorkersBefore:beforeNavigation,activeWorkerTargetsAfter:0,path:'/search/',recovery:'fresh document tested below; BFCache round-trip not claimed'};
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await navigate();await waitReady();
  await quiet(async()=>{await submit('360');await until(async()=>await phase()==='result','mobile low digits');assert.match(await output(),/360 = 2\^3 × 3\^2 × 5/u);},'mobile viewport');
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true,'mobile horizontal layout');
  assert.deepEqual(await evaluate('({local:Object.keys(localStorage),session:Object.keys(sessionStorage),cookie:document.cookie})'),{local:[],session:[],cookie:''});
  // Self-tests occur outside the computation intervals.
  const requestBefore=events.length,httpBefore=httpTrace.length;
  await evaluate(`new Promise(resolve=>{const img=new Image();img.onload=img.onerror=()=>resolve(true);img.src=${JSON.stringify(origin+'/xpotato-logo.svg?prime-network-self-test')};})`);
  assert.ok(events.slice(requestBefore).some(e=>e.url?.includes('prime-network-self-test')));
  assert.ok(httpTrace.slice(httpBefore).some(e=>e.path.includes('prime-network-self-test')));
  const cspBefore=await evaluate('window.__primeLifecycle.csp.length');
  assert.equal(await evaluate("fetch('/search/search-index.json').then(()=>false,()=>true)"),true);
  await until(()=>evaluate(`window.__primeLifecycle.csp.length>${cspBefore}`),'CSP detector self-test');
  const workerBefore=events.length,workerHttp=httpTrace.length;
  await evaluate(`new Promise((resolve,reject)=>{const url=URL.createObjectURL(new Blob([${JSON.stringify("fetch('"+origin+"/xpotato-logo.svg?prime-worker-self-test').then(()=>postMessage('unexpected'),()=>postMessage('blocked'));")}],{type:'text/javascript'}));const w=new Worker(url);w.onmessage=e=>{w.terminate();URL.revokeObjectURL(url);e.data==='blocked'?resolve(true):reject(Error('Worker CSP'));};w.onerror=reject;})`);

  assert.equal(httpTrace.slice(workerHttp).some(e=>e.path.includes('prime-worker-self-test')),false);
  await retired();await Promise.all(setups);assert.deepEqual(setupErrors,[]);
  report.blockedWorkerFetch={httpRequests:0,result:"connect-src denied"};
  await send('Page.navigate',{url:origin+'/__prime-observer-self-test__/'});
  await until(()=>evaluate("location.pathname==='/__prime-observer-self-test__/'&&document.readyState==='complete'"),'observer fixture navigation');
  const allowedWorkerBefore=events.length,allowedHttpBefore=httpTrace.length;
  await evaluate(`new Promise((resolve,reject)=>{const url=URL.createObjectURL(new Blob([${JSON.stringify("fetch('"+origin+"/xpotato-logo.svg?prime-worker-allowed-self-test').then(r=>postMessage(r.status),()=>postMessage('failed'));")}],{type:'text/javascript'}));const w=new Worker(url);w.onmessage=e=>{w.terminate();URL.revokeObjectURL(url);e.data===200?resolve(true):reject(Error('observer fixture fetch'));};w.onerror=reject;})`);
  assert.ok(events.slice(allowedWorkerBefore).some(e=>e.session!=='page'&&e.url?.includes('prime-worker-allowed-self-test')),'Worker CDP network detector allowed-request self-test');
  assert.ok(httpTrace.slice(allowedHttpBefore).some(e=>e.path.includes('prime-worker-allowed-self-test')),'Worker HTTP detector self-test');
  await retired();await Promise.all(setups);assert.deepEqual(setupErrors,[]);
  report.lifecycle=await evaluate('window.__primeLifecycle');report.detachedWorkerTargets=detached.size;report.detectors='page/Worker CDP + HTTP + CSP self-tests passed';
  await writeFile(join(temp,'prime-tool-acceptance.json'),JSON.stringify(report,null,2)+'\n');
  await send('Emulation.setDeviceMetricsOverride',{width:1487,height:1058,deviceScaleFactor:1,mobile:false});
  await navigate();await waitReady();
  return report;
 }catch(error){
  console.error('Prime acceptance diagnostic',JSON.stringify(await evaluate("({islands:Array.from(document.querySelectorAll('astro-island'),n=>({uid:n.getAttribute('uid'),ssr:n.hasAttribute('ssr'),child:n.firstElementChild?.outerHTML.slice(0,300)})),roots:Array.from(document.querySelectorAll('.bt-prime-factorizer'),n=>({phase:n.dataset.phase,alert:n.querySelector('[role=alert]')?.textContent})),lifecycle:window.__primeLifecycle})")));
  console.error('Worker observer',JSON.stringify({setupErrors,events:events.slice(-8)}));throw error;
 }finally{
  await send('Target.setAutoAttach',{autoAttach:false,waitForDebuggerOnStart:false,flatten:true}).catch(()=>{});
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:hook.identifier}).catch(()=>{});
  socket.removeEventListener('message',listener);
 }
}
