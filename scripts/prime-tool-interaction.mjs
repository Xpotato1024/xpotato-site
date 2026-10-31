// Actual fixed release in the one final dist; test-only instrumentation never enters the artifact.
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function verifyPrimeToolInteraction({root,temp,origin,send,evaluate,until,socket,httpTrace,candidate}){
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
  // Actual host font subsets can start ~0.9s after fonts.ready even while idle.
  // Settle initial assets only; every subsequent calculation interval still rejects all HTTP.
  await until(async()=>{const e=events.length,h=httpTrace.length;await new Promise(r=>setTimeout(r,1000));return e===events.length&&h===httpTrace.length;},'initial assets including browser icon settled');
 };
 const submit=async(raw,n=0)=>{
  await evaluate(`(()=>{const root=${select(n)},input=root.querySelector('input');input.value=${JSON.stringify(raw)};input.dispatchEvent(new Event('input',{bubbles:true}));root.querySelector('form').requestSubmit();})()`);
 };
 const phase=async(n=0)=>evaluate(`${select(n)}?.dataset.phase`);
 const output=async(n=0)=>evaluate(`(()=>{const r=${select(n)};return ['.bt-equation','.bt-result-status','.bt-stop-reason'].map(s=>r.querySelector(s)?.textContent??'').filter(Boolean).join('\\n');})()`);
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
 const selected=candidate?null:JSON.parse(await readFile(join(root,'config/browser-tools/installations.json'),'utf8')).installations.find(x=>x.pin.toolId==='prime-factorizer')?.pin;
 assert.ok(candidate||selected,'selected Prime pin required');
 const manifest=JSON.parse(await readFile(join(candidate?.artifactRoot??join(root,'vendor/browser-tools/prime-factorizer',selected?.releaseId??''),'browser-tool.json'),'utf8'));
 const report={version:candidate?.version??manifest.version,scope:(candidate?'private candidate dist; ':'actual final dist; ')+'viewport emulation, not physical mobile hardware',cases:[],intervals:[]};
 const revisedUi=report.version==='0.2.1';
 const editBetweenRuns=async()=>{
  if(!revisedUi){await evaluate(`${select()}.querySelector('[data-action=reset]').click()`);await waitReady();return;}
  const previous=await output();
  const editing=await evaluate(`(()=>{const r=${select()},i=r.querySelector('input'),focused=document.activeElement;i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));return{focusRetained:document.activeElement===focused,noteVisible:!r.querySelector('.bt-draft-note').hidden,previous:r.querySelector('.bt-result-title').textContent.startsWith('前回：'),progress:r.querySelector('.bt-progress').dataset.state,reset:r.querySelector('[data-action=reset]')!==null}})()`);
  assert.deepEqual(editing,{focusRetained:true,noteVisible:true,previous:true,progress:'idle',reset:false});assert.equal(await output(),previous);
  await evaluate(`${select()}.querySelector('[data-action=examples]').click()`);assert.equal(await evaluate(`${select()}.querySelector('dialog.bt-samples').matches(':modal')`),true);
  const sample=await evaluate(`${select()}.querySelector('[data-sample-value]').dataset.sampleValue`);await evaluate(`${select()}.querySelector('[data-sample-value]').click()`);
  assert.equal(await evaluate(`${select()}.querySelector('input').value`),sample);assert.equal(await evaluate(`${select()}.querySelector('dialog.bt-samples').open`),false);
  assert.equal(await evaluate(`document.activeElement===${select()}.querySelector('[data-action=start]')`),true);assert.equal(await output(),previous);
 };
 try{
  await navigate();await waitReady();
  report.environment=await evaluate('({userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory??null})');
  const fixed=candidate??JSON.parse(await readFile(join(root,'docs/acceptance/browser-tools/prime-factorizer',selected.releaseId+'-source-review.json'),'utf8'));report.sourceCommit=fixed.sourceCommit;report.artifactSha256=fixed.artifactSha256;
  const html=await readFile(join(candidate?.dist??join(root,'apps/site/dist'),'tools/prime-factorizer/index.html'),'utf8');
  const island=html.match(/<astro-island\b[\s\S]*?<\/astro-island>/u)?.[0];assert.ok(island);
  assert.equal(await evaluate("document.querySelector('[data-tool-version]').textContent"),report.version);
  assert.equal(await evaluate("document.querySelector('[data-prime-tool-version]').dataset.primeToolVersion"),report.version);
  if(!candidate){
   assert.equal(await evaluate("document.querySelector('.tool-release > p a').href"),fixed.source.repository+'/tree/'+fixed.sourceCommit,'rendered corresponding source must match selected pin');
   assert.equal(await evaluate("document.querySelector('[data-tool-capabilities]').dataset.capabilityManifest"),fixed.manifestSha256,'rendered capabilities must match selected manifest');
   const noticeOrder=await evaluate(`(()=>{const notices=[...document.querySelectorAll('.tool-release')],notice=notices[0],body=document.querySelector('.article-body'),tool=${select()};return {count:notices.length,insideDemo:Boolean(notice?.closest('[data-interactive-module]')),afterTool:Boolean(tool?.compareDocumentPosition(notice)&Node.DOCUMENT_POSITION_FOLLOWING),afterHelp:[...body.querySelectorAll('details')].filter(d=>!notice.contains(d)).every(d=>Boolean(d.compareDocumentPosition(notice)&Node.DOCUMENT_POSITION_FOLLOWING)),repeatedInputLimits:notice.textContent.includes('採用版の対応モードと入力範囲')}})()`);
   assert.deepEqual(noticeOrder,{count:1,insideDemo:false,afterTool:true,afterHelp:true,repeatedInputLimits:false},'one legal notice follows the GUI and all supplemental help in DOM order');
  }
   if(revisedUi){
    const initial=await evaluate(`(()=>{const r=${select()},p=r.querySelector('.bt-progress'),bar=p?.querySelector('progress');return{reset:r.querySelector('[data-action=reset]')!==null,visible:Boolean(p&&!p.hidden&&p.getBoundingClientRect().height>0),state:p?.dataset.state,value:bar?.getAttribute('value'),label:bar?.getAttribute('aria-valuetext')}})()`);
    assert.deepEqual(initial,{reset:false,visible:true,state:'idle',value:'0',label:'待機中。計算は開始していません。'});report.initialUi=initial;
   }
  assert.ok(await evaluate("Array.from(document.querySelectorAll('a')).some(a=>a.href.endsWith('/SOURCE_OFFER.md'))"));
  report.siteSourceCommit=await evaluate("document.querySelector('[data-site-source-commit]').dataset.siteSourceCommit");
  assert.match(report.siteSourceCommit,/^[a-f0-9]{40}$/u);
  assert.ok(await evaluate(`Array.from(document.querySelectorAll('a')).some(a=>a.href===${JSON.stringify('https://github.com/Xpotato1024/xpotato-site/blob/')}+${JSON.stringify(report.siteSourceCommit)}+'/SITE_SOURCE_OFFER.md')`));
  assert.ok(await evaluate(`Array.from(document.querySelectorAll('a')).some(a=>a.pathname===${JSON.stringify('/tool-licenses/prime-factorizer-v'+report.version+'/MUSL-COPYRIGHT.txt')})`));
  for(const offline of [false,true]){
   await send('Network.emulateNetworkConditions',{offline,latency:0,downloadThroughput:offline?0:-1,uploadThroughput:offline?0:-1});
   for(const [raw,expected]of [['32','32 = 2^5'],['3.2e1','32 = 2^5'],['97','97 = 97'],['0','素数でも合成数でも'],['1','素数でも合成数でも'],['9007199254740993','9007199254740993 =']]){
    await quiet(async()=>{await submit(raw);await until(async()=>await phase()==='result','exact integer result');assert.ok((await output()).includes(expected));},'exact '+raw);
    report.cases.push({raw,offline,status:'verified by shipped result verifier'});
   }
   if(manifest.uiCapabilities?.modes.find(m=>m.id==='standard')?.maxBits===1024){
    // Easy powers/products exercise acceptance and the 2^128 route boundary.
    // They make no claim about hard balanced semiprime completion.
    for(const raw of [(1n<<127n).toString(),(1n<<128n).toString(),(9n<<1020n).toString()]){
     await quiet(async()=>{await submit(raw);await until(async()=>await phase()==='result','standard boundary result');assert.ok((await output()).startsWith(raw+' ='));assert.match(await output(),/分解完了/u);},'standard acceptance '+raw.length+' digits');
     report.cases.push({raw,offline,status:'easy-input acceptance; not a general completion guarantee'});
    }
   }
   const previous=await output();
   const standardBits=manifest.uiCapabilities?.modes?.find(x=>x.id==='standard')?.maxBits??332;
   for(const raw of ['2.5','-4','<img src=x onerror=alert(1)>','1e10000',(1n<<BigInt(standardBits)).toString()]){
    await quiet(async()=>{await submit(raw);assert.equal(await phase(),'invalid');assert.equal(await output(),previous);assert.ok(await evaluate(`${select()}.querySelector('[role=alert]:not([hidden])')?.textContent.length>0`));assert.ok(await evaluate(`${select()}.querySelector('.bt-result-title').textContent.startsWith('前回：')`));},'invalid preserves clearly previous result');
   }
    await quiet(editBetweenRuns,revisedUi?'input edit and sample keep previous result':'reset');
  }
  await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
   if(revisedUi)await quiet(async()=>{
    await submit('360');await until(async()=>await phase()==='result','copy result');
    await evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__primeCopiedText=text;}}});${select()}.querySelector('[data-action=copy]').focus();${select()}.querySelector('[data-action=copy]').click()`);
    await until(()=>evaluate(`${select()}.querySelector('.bt-copy-status').textContent==='この結果と計算状態をコピーしました。'`),'copy feedback');assert.match(await evaluate('window.__primeCopiedText'),/360 = 2\^3 × 3\^2 × 5/u);
    assert.equal(await evaluate(`document.activeElement===${select()}.querySelector('[data-action=copy]')`),true);
    await evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('clipboard fixture denied');}}});${select()}.querySelector('[data-action=copy]').click()`);
    await until(()=>evaluate(`${select()}.querySelector('.bt-copy-status').textContent.includes('手動でコピー')`),'manual copy feedback');
    assert.equal(await evaluate(`document.activeElement===${select()}.querySelector('.bt-result-body')`),true);assert.match(await evaluate('getSelection().toString()'),/360 = 2\^3 × 3\^2 × 5/u);
    report.clipboard={injectedAdapter:true,osClipboard:false,successFocus:'copy button',fallbackFocus:'selectable result body'};
   },'copy success and fallback focus');
  const configure=async(engine,time='1000')=>{
   await evaluate(`${select()}.querySelector('[data-action=settings]').click()`);
   assert.equal(await evaluate(`${select()}.querySelector('dialog.bt-settings').matches(':modal')`),true);
   await evaluate(`(()=>{const r=${select()},e=r.querySelector('select[id$="-engine"]');e.value=${JSON.stringify(engine)};e.dispatchEvent(new Event('change'));})()`);
   await evaluate(`(()=>{const r=${select()},t=r.querySelector('select[id$="-time"]');t.value=${JSON.stringify(time)};t.dispatchEvent(new Event('change'));})()`);
   await evaluate(`${select()}.querySelector('[data-action=apply-settings]').click()`);
   await waitReady();
   assert.equal(await evaluate(`${select()}.querySelector('dialog.bt-settings').open`),false);
  };
  for(const engine of ['optimized','wide']){
   await configure(engine);
   await quiet(async()=>{
    await submit(rsa);await until(()=>evaluate('window.__primeLifecycle.active>0'),'heavy Worker creation');
    await until(()=>Promise.resolve(readySessions.size>0),'Worker network observation');
     if(candidate?.focusContract||revisedUi)await evaluate(`${select()}.querySelector('[data-action=cancel]').focus()`);
    await evaluate(`${select()}.querySelector('[data-action=cancel]').click()`);
     if(candidate?.focusContract||revisedUi)assert.equal(await evaluate(`(()=>{const r=${select()};return document.activeElement===r.querySelector(r.dataset.phase==='result'?'.bt-result-status':'.bt-status')})()`),true,'cancel focus follows its current phase');
    await until(async()=>await phase()==='result','cancel result');assert.match(await output(),/中止|未完了/u);
     if(revisedUi)assert.equal(await evaluate(`document.activeElement===${select()}.querySelector('.bt-result-status')`),true,'terminal cancellation focus');
   },engine+' cancellation');
  }
  await configure('optimized');
  await quiet(async()=>{await submit(rsa);await until(async()=>await phase()==='result','finite 1-second outcome');assert.match(await output(),/未完了/u);},'finite timeout');
   await editBetweenRuns();
  // A second real SSR island from this exact artifact, not another implementation.
  await evaluate(`(()=>{const parsed=new DOMParser().parseFromString(${JSON.stringify(island)},'text/html').querySelector('astro-island');const node=document.importNode(parsed,true);node.setAttribute('uid','prime-acceptance-second');document.querySelector('main').append(node);node.scrollIntoView();})()`);
  await waitReady(2);
  const ids=await evaluate("Array.from(document.querySelectorAll('.bt-prime-factorizer [id]'),n=>n.id)");assert.equal(ids.length,new Set(ids).size);
  await quiet(async()=>{await submit('32',1);await until(async()=>await phase(1)==='result','second instance result');assert.match(await output(1),/32 = 2\^5/u);},'second instance');
  await quiet(async()=>{
   await submit(rsa,0);await until(()=>evaluate('window.__primeLifecycle.active>0'),'first active');
   await submit('97',1);assert.equal(await phase(1),'invalid');
   assert.ok(await evaluate(`${select(1)}.querySelector('[role=alert]:not([hidden])').textContent.includes('別の計算')`));
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
  report.siteLayouts=[];
  for(const colorScheme of ['light','dark'])for(const width of [320,390,1440])for(const textScale of [1,2]){
    if(revisedUi){await navigate();await waitReady();}
   await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:colorScheme}]});
   await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
   await evaluate(`document.documentElement.style.fontSize=${JSON.stringify(textScale*100+'%')}`);
   await evaluate(`${select()}.scrollIntoView({block:'start'})`);
   await evaluate('document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))');
    if(revisedUi){
     assert.equal(await evaluate(`${select()}.querySelector('.bt-progress').hidden`),false);
     const initialLayout=await evaluate(`(()=>{const r=${select()},c=getComputedStyle(r),host=getComputedStyle(document.querySelector('.tool-release'));return{viewport:innerWidth,document:document.documentElement.scrollWidth,tool:r.getBoundingClientRect().width,scroll:r.scrollWidth,font:c.fontFamily,hostFont:host.fontFamily,color:c.color,background:c.backgroundColor}})()`);
     assert.ok(initialLayout.document<=width+1&&initialLayout.scroll<=initialLayout.tool+1,JSON.stringify(initialLayout));assert.equal(initialLayout.font,initialLayout.hostFont);
     const initialImage=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}),initialFile='prime-initial-'+colorScheme+'-'+width+(textScale===1?'':'-text-200')+'.png';await writeFile(join(temp,initialFile),Buffer.from(initialImage.data,'base64'));
     report.siteLayouts.push({colorScheme,width,textScale,state:'ready',...initialLayout,screenshot:initialFile,physicalMobile:false});
     await quiet(async()=>{await submit('360');await until(async()=>await phase()==='result','layout result');},'layout '+colorScheme+' '+width+' '+textScale);
    }
   const layout=await evaluate(`(()=>{const r=${select()},c=getComputedStyle(r),host=getComputedStyle(document.querySelector('.tool-release'));return {viewport:innerWidth,document:document.documentElement.scrollWidth,tool:r.getBoundingClientRect().width,scroll:r.scrollWidth,font:c.fontFamily,hostFont:host.fontFamily,color:c.color,background:c.backgroundColor}})()`);
   assert.ok(layout.document<=width+1&&layout.scroll<=layout.tool+1,JSON.stringify(layout));assert.equal(layout.font,layout.hostFont);
   const image=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
   const suffix=textScale===1?'':'-text-200',file='prime-'+colorScheme+'-'+width+suffix+'.png';await writeFile(join(temp,file),Buffer.from(image.data,'base64'));
   report.siteLayouts.push({colorScheme,width,textScale,...layout,screenshot:file,physicalMobile:false});
   await evaluate(`${select()}.querySelector('[data-action=settings]').click()`);
   const dialog=await evaluate(`(()=>{const d=${select()}.querySelector('dialog.bt-settings');return {modal:d.matches(':modal'),width:d.getBoundingClientRect().width,scroll:d.scrollWidth,viewport:innerWidth,document:document.documentElement.scrollWidth}})()`);
   assert.ok(dialog.modal&&dialog.document<=width+1&&dialog.scroll<=dialog.width+1,JSON.stringify(dialog));
   const modalImage=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
   const modalFile='prime-settings-'+colorScheme+'-'+width+suffix+'.png';await writeFile(join(temp,modalFile),Buffer.from(modalImage.data,'base64'));
   let keyboardApplyVisible=null;
   if(textScale===2){
    for(let i=0;i<20&&!await evaluate(`document.activeElement===${select()}.querySelector('[data-action=apply-settings]')`);i++){
     await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    }
    keyboardApplyVisible=await evaluate(`(()=>{const r=${select()},b=r.querySelector('[data-action=apply-settings]'),d=r.querySelector('dialog.bt-settings'),x=b.getBoundingClientRect(),y=d.getBoundingClientRect();return document.activeElement===b&&x.top>=y.top&&x.bottom<=y.bottom&&x.bottom<=innerHeight})()`);
    assert.equal(keyboardApplyVisible,true,'200% dialog footer remains reachable by keyboard scrolling');
   }
   await evaluate(`${select()}.querySelector('[data-action=cancel-settings]').click()`);
   assert.equal(await evaluate(`document.activeElement===${select()}.querySelector('[data-action=settings]')`),true,'dialog cancellation restores opener focus');
   report.siteLayouts.push({colorScheme,requestedWidth:width,textScale,state:'settings',...dialog,keyboardApplyVisible,screenshot:modalFile,physicalMobile:false});
  }
  await send('Emulation.setEmulatedMedia',{features:[]});
  await evaluate("document.documentElement.style.fontSize=''");
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
