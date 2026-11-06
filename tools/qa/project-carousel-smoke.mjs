import {publicMediaOrigin} from '../../packages/content-contracts/src/profiles/public-media-origin.mjs';
import {verifyMobileMenuInteraction} from './mobile-menu-interaction.mjs';
import {verifyNavigationInteraction} from './navigation-interaction.mjs';
import {verifyProjectCarouselInteraction,carouselFixture,carouselBrowserArgs} from './project-carousel-interaction.mjs';
import {parseStaticHeaderRules,headersForPath} from '../../packages/site-validators/src/delivery/static-headers.mjs';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,mkdtemp,stat} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve,join,extname,sep,isAbsolute,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),dist=join(root,'apps/site/dist'),temp=process.env.XPOTATO_RELEASE_TEMP;
if(!temp||!isAbsolute(temp))throw Error('XPOTATO_RELEASE_TEMP absolute task temp required');
await mkdir(temp,{recursive:true});const profile=await mkdtemp(join(temp,'carousel-browser-'));
const rules=parseStaticHeaderRules(await readFile(join(dist,'_headers'),'utf8'));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.avif':'image/avif','.webp':'image/webp','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname,fixture=/^\/__carousel-fixture__\/([012])\/$/.exec(pathname);
 if(fixture){res.writeHead(200,{...headersForPath('/',rules),'content-type':mime['.html']});res.end(carouselFixture(await readFile(join(dist,'index.html'),'utf8'),Number(fixture[1])));return;}
 let p=resolve(dist,'.'+decodeURIComponent(pathname));assert.ok(p===dist||p.startsWith(dist+sep));if((await stat(p)).isDirectory())p=join(p,'index.html');res.writeHead(200,{...headersForPath(pathname,rules),'content-type':mime[extname(p)]??'application/octet-stream'});res.end(await readFile(p));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const child=spawn(process.env.CHROME_PATH??(process.platform==='win32'?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':'google-chrome'),[...carouselBrowserArgs,'--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--disable-background-networking','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const until=async(fn,label)=>{const end=Date.now()+20000;while(Date.now()<end){try{const result=await fn();if(result)return result;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+label);};let socket;
try{
 const port=await until(async()=>(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0],'Browser startup');
 const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
 let id=0;const pending=new Map(),requests=[],exceptions=[];
 socket.addEventListener('message',e=>{const m=JSON.parse(String(e.data)),p=pending.get(m.id);if(m.method==='Network.requestWillBeSent')requests.push({url:m.params.request.url,type:m.params.type});if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.text);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject,timer:setTimeout(()=>{pending.delete(key);reject(Error(method+' timeout'));},20000)});socket.send(JSON.stringify({id:key,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
 const axe=await readFile(join(root,'node_modules/axe-core/axe.min.js'),'utf8'),audits=[];
 const audit=async label=>{await evaluate(axe);const result=await evaluate(`axe.run(document).then(r=>r.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})))`);assert.deepEqual(result.filter(v=>['serious','critical'].includes(v.impact)),[]);audits.push({label,violations:result});};
 const result=await verifyProjectCarouselInteraction({send,evaluate,until,origin,audit,screenshot:async name=>{const png=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(temp,name),Buffer.from(png.data,'base64'));}});
 const unexpected=requests.filter(r=>!r.url.startsWith(origin+'/')&&!r.url.startsWith('data:')&&!(r.type==='Image'&&r.url.startsWith(publicMediaOrigin+'/media/v1/objects/sha256/')));
 assert.deepEqual(unexpected,[],'Only local executable assets and existing public media images are allowed');

 await send('Page.navigate',{url:origin+'/'});await until(()=>evaluate("document.readyState==='complete'"),'Menu page');
 const menu=await verifyMobileMenuInteraction({send,evaluate,until,audit,screenshot:async name=>{const png=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(temp,name),Buffer.from(png.data,'base64'));}});
 await writeFile(join(temp,'menu-animation-browser.json'),JSON.stringify(menu,null,2)+'\n');
 const navigation=await verifyNavigationInteraction({send,evaluate,until,origin,audit,screenshot:async name=>{const png=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(temp,name),Buffer.from(png.data,'base64'));}});
 await writeFile(join(temp,'navigation-browser.json'),JSON.stringify(navigation,null,2)+'\n');
 assert.deepEqual(exceptions,[]);
 await writeFile(join(temp,'project-carousel-browser.json'),JSON.stringify({...result,audits,exceptions,unexpectedRequests:0,publicImageRequests:requests.filter(r=>r.url.startsWith(publicMediaOrigin)).length},null,2)+'\n');console.log(JSON.stringify(result,null,2));await send('Browser.close');
}finally{socket?.close();child.kill();server.closeAllConnections();server.close();}
