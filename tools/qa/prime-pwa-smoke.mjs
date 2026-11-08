// Real Chromium / final dist. Local fault injection never enters the public artifact.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,writeFile,stat} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {join,resolve,extname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {parseStaticHeaderRules,headersForPath} from '../../packages/site-validators/src/delivery/static-headers.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),dist=join(root,'apps/site/dist');
const temp=await mkdtemp(join(process.env.RUNNER_TEMP??tmpdir(),'prime-pwa-'));
const rules=parseStaticHeaderRules(await readFile(join(dist,'_headers'),'utf8'));
const scope='/tools/prime-factorizer/',swPath=scope+'sw.js';
const sw=await readFile(join(dist,swPath),'utf8');
const release=JSON.parse(/const RELEASE = (.+);/u.exec(sw)[1]);
const manifest=JSON.parse(await readFile(join(dist,scope,'manifest.webmanifest'),'utf8'));
assert.equal(manifest.id,scope);assert.equal(manifest.start_url,scope);assert.equal(manifest.scope,scope);
assert.deepEqual(manifest.icons.map(i=>i.sizes),['192x192','512x512']);
let offline=false,workerSource=sw,broken=false;const requests=[],overrides=new Map();
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.ico':'image/x-icon','.png':'image/png','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;requests.push(pathname);
 if(offline){res.destroy();return;}
 try{
  let file=resolve(dist,'.'+decodeURIComponent(pathname));if(file!==dist&&!file.startsWith(dist+sep))throw Error('outside');
  if((await stat(file)).isDirectory())file=join(file,'index.html');
  let bytes=pathname===swPath?workerSource:overrides.get(pathname)??await readFile(file);
  if(broken&&pathname===release.entries.find(e=>e.path.endsWith('.js'))?.path)bytes='corrupt';
  res.writeHead(200,{...headersForPath(pathname,rules),'Content-Type':types[extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const chrome=process.env.CHROME_PATH??(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'google-chrome');
const launch=()=>spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+join(temp,'profile'),'about:blank'],{stdio:'ignore',windowsHide:true});
let child=launch();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,ms=30000){const end=Date.now()+ms;while(Date.now()<end){try{if(await fn())return;}catch{}await pause(100);}throw Error('Timed out: '+label);}
const browserErrors=[];let socket,id=0;const pending=new Map();
const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));});
const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
const navigate=async path=>{await send('Page.navigate',{url:path==='blank'?'about:blank':origin+path});await until(()=>evaluate(path==='blank'?"location.href==='about:blank'":`location.origin===${JSON.stringify(origin)}&&location.pathname===${JSON.stringify(path)}&&document.readyState==='complete'`),'navigation '+path);};
const ready=async()=>{await until(()=>evaluate("Boolean(document.querySelector('astro-island'))"),'island');await evaluate("document.querySelector('astro-island').firstElementChild.scrollIntoView()");await until(()=>evaluate("document.querySelector('.bt-prime-factorizer')?.dataset.phase==='ready'"),'tool ready');};
const saved=()=>evaluate(`new Promise((resolve,reject)=>{navigator.serviceWorker.getRegistration(${JSON.stringify(scope)}).then(reg=>{const worker=reg?.waiting||reg?.active;if(!worker)return resolve(false);const channel=new MessageChannel();channel.port1.onmessage=e=>resolve(e.data.complete);worker.postMessage('PRIME_OFFLINE_STATUS',[channel.port2]);setTimeout(()=>reject(Error('status timeout')),3000);});})`);
const save=async()=>{await evaluate("document.querySelector('[data-prime-offline]').open=true;document.querySelector('[data-prime-offline-save]').click()");await until(()=>saved(),'complete offline cache',120000);};
const cacheNames=()=>evaluate("caches.keys()");
const report={scope:'Desktop Chromium restart and cold document with HTTP cache disabled. Not physical iOS/Android installation.',cases:[],version:release.version};
async function connect(){
 let target;await until(async()=>{const port=(await readFile(join(temp,'profile/DevToolsActivePort'),'utf8')).split('\n')[0];target=(await (await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.type==='page');return target;},'Chrome start');
 socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
 socket.addEventListener('message',e=>{const m=JSON.parse(String(e.data));if(!m.id){if(['Runtime.exceptionThrown','Log.entryAdded','Network.loadingFailed'].includes(m.method))browserErrors.push(m);return;}const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(Error(JSON.stringify(m.error)));else p?.resolve(m.result);});
 await send('Log.enable');await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
}
try{
 await connect();
 await navigate(scope);await ready();
 assert.equal(await evaluate("navigator.serviceWorker.controller"),null);assert.deepEqual(await cacheNames(),[]);
 assert.equal(await evaluate("new URL(document.querySelector('link[rel=manifest]').href).pathname"),scope+'manifest.webmanifest');
 broken=true;await evaluate("document.querySelector('[data-prime-offline-save]').click()");await until(()=>evaluate("document.querySelector('[data-prime-offline-status]').textContent.includes('できませんでした')"),'failed install');assert.deepEqual(await cacheNames(),[]);broken=false;
 report.cases.push('Corrupt initial asset rejects install and removes partial cache');
 await save();assert.equal((await cacheNames()).length,1);report.cases.push('Explicit save pins the complete closure');
 await send('Browser.close');await until(()=>child.exitCode!==null,'browser shutdown');socket.close();
 offline=true;child=launch();await connect();
 await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await navigate(scope);await ready();
 assert.equal(await evaluate('Boolean(navigator.serviceWorker.controller)'),true);
 await evaluate("const r=document.querySelector('.bt-prime-factorizer');const i=r.querySelector('input');i.value='171';i.dispatchEvent(new Event('input',{bubbles:true}));r.querySelector('form').requestSubmit()");
 await until(()=>evaluate("document.querySelector('.bt-prime-factorizer').dataset.phase==='result'"),'offline factorization');
 assert.match(await evaluate("document.querySelector('.bt-equation').textContent"),/19/u);
 assert.deepEqual(await evaluate('({local:Object.keys(localStorage),session:Object.keys(sessionStorage),cookie:document.cookie})'),{local:[],session:[],cookie:''});
 report.cases.push('Full browser restart offline, hydration and factorization; no input/result storage');
 offline=false;await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 const next=structuredClone(release);next.version='b'.repeat(64);
 overrides.set(scope,Buffer.from((await readFile(join(dist,scope,'index.html'),'utf8')).replace('<html','<html data-pwa-fixture="next"')));
 overrides.set('/scripts/prime-pwa.js',Buffer.from((await readFile(join(dist,'scripts/prime-pwa.js'),'utf8'))+'\n// next release fixture\n'));
 for(const entry of next.entries)if(overrides.has(entry.path)){const body=overrides.get(entry.path);entry.bytes=body.length;entry.sha256=createHash('sha256').update(body).digest('hex');}
 workerSource=sw.replace(JSON.stringify(release),JSON.stringify(next));
 await evaluate("document.documentElement.dataset.pwaDocument='original'");
 await evaluate("(()=>{const r=document.querySelector('.bt-prime-factorizer');r.querySelector('[data-action=settings]').click();const t=r.querySelector('select[id$=\"-time\"]');t.value='60000';t.dispatchEvent(new Event('change',{bubbles:true}));r.querySelector('[data-action=apply-settings]').click();})()");
 await evaluate("(()=>{const r=document.querySelector('.bt-prime-factorizer'),i=r.querySelector('input');i.value='1522605027922533360535618378132637429718068114961380688657908494580122963258952897654000350692006139';i.dispatchEvent(new Event('input',{bubbles:true}));r.querySelector('form').requestSubmit();})()");
 await until(()=>evaluate("document.querySelector('.bt-prime-factorizer').dataset.phase==='running'"),'long calculation running');
 assert.equal(await evaluate("document.querySelector('[data-prime-offline-save]').disabled"),true);
 await evaluate(`navigator.serviceWorker.getRegistration(${JSON.stringify(scope)}).then(r=>r.update())`);
 await until(()=>evaluate(`navigator.serviceWorker.getRegistration(${JSON.stringify(scope)}).then(r=>Boolean(r.waiting))`),'waiting update',120000);
 assert.equal(await evaluate("document.documentElement.dataset.pwaDocument"),'original');assert.equal(await evaluate("document.querySelector('.bt-prime-factorizer').dataset.phase"),'running');
 await evaluate("document.querySelector('.bt-prime-factorizer [data-action=cancel],.bt-prime-factorizer [data-action=stop]').click()");
 await until(()=>evaluate("!['running','cancelling'].includes(document.querySelector('.bt-prime-factorizer').dataset.phase)"),'calculation cancels normally');
 assert.equal((await cacheNames()).length,2);report.cases.push('Updated release waits without claiming/reloading; active calculation and cancellation survive');
 await navigate('blank');await until(async()=>{await navigate(scope);const v=await evaluate(`navigator.serviceWorker.getRegistration(${JSON.stringify(scope)}).then(r=>r.active?.state)`);if(v==='activated'&&(await cacheNames()).length===1)return true;await navigate('blank');return false;},'natural update activation');await ready();
 assert.ok((await cacheNames())[0].endsWith('b'.repeat(64)));
 assert.equal(await evaluate('document.documentElement.dataset.pwaFixture'),'next');
 workerSource=sw;overrides.clear();await evaluate(`navigator.serviceWorker.getRegistration(${JSON.stringify(scope)}).then(r=>r.update())`);await until(()=>evaluate(`navigator.serviceWorker.getRegistration(${JSON.stringify(scope)}).then(r=>Boolean(r.waiting))`),'rollback waiting',120000);
 await navigate('blank');await pause(500);await navigate(scope);await ready();await until(async()=>(await cacheNames()).length===1&&(await cacheNames())[0].endsWith(release.version),'rollback active');assert.equal(await evaluate('document.documentElement.dataset.pwaFixture'),undefined);report.cases.push('Synthetic changed HTML/JS update and exact prior artifact rollback stay consistent');
 await evaluate("caches.keys().then(keys=>caches.open(keys[0])).then(cache=>cache.delete('/icon-prime-512.png'))");
 await evaluate("document.querySelector('[data-prime-offline-save]').click()");
 await until(()=>evaluate("document.querySelector('[data-prime-offline-status]').textContent.includes('オフライン機能を解除しました')"),'partial eviction recovery');
 assert.equal(await evaluate("document.querySelector('[data-prime-offline-save]').disabled"),true);
 assert.equal(await evaluate(`navigator.serviceWorker.getRegistration(${JSON.stringify(scope)}).then(Boolean)`),false);
 await navigate('blank');await pause(500);await navigate(scope);await ready();await save();assert.equal(await saved(),true);
 report.cases.push('Evicted non-navigation icon invalidates broken registration; close/reopen and explicit same-version save repairs it');
 await evaluate("caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k))))");await evaluate("document.querySelector('[data-prime-offline-save]').click()");await until(()=>evaluate("document.querySelector('[data-prime-offline-status]').textContent.includes('オフライン機能を解除しました')"),'honest fully evicted status');report.cases.push('Full eviction is reported and unregistered without immediate replacement');
 await navigate('/');assert.equal(await evaluate('navigator.serviceWorker.controller'),null);assert.equal(await evaluate("document.querySelector('link[rel=manifest]')"),null);report.cases.push('Homepage stays outside manifest and SW control');
 await writeFile(join(temp,'prime-pwa-final-dist.json'),JSON.stringify({...report,status:'PASS'},null,2)+'\n');console.log(JSON.stringify({...report,status:'PASS',reportPath:join(temp,'prime-pwa-final-dist.json')},null,2));
}catch(error){console.error('PWA diagnostic',JSON.stringify({error:String(error),browserErrors,state:await evaluate("({url:location.href,phase:document.querySelector('.bt-prime-factorizer')?.dataset.phase,text:document.querySelector('.bt-prime-factorizer')?.textContent.slice(0,800),status:document.querySelector('[data-prime-offline-status]')?.textContent,ready:document.readyState})").catch(()=>null)}));throw error;}finally{
 socket?.close();if(child.pid&&child.exitCode===null){if(process.platform==='win32')execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});else child.kill('SIGTERM');}
 await new Promise(r=>server.close(r));
}
