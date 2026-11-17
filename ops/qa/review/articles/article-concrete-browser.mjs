import {createServer} from 'node:http';
import {readFile,stat,mkdtemp} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute,extname} from 'node:path';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
export const pause=ms=>new Promise(r=>setTimeout(r,ms));
export async function browserSession(root,startPath,virtual={}){
 const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
 const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(Object.hasOwn(virtual,path)){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(virtual[path]);return}let p=resolve(root,'.'+path);const r=relative(root,p);if(r.startsWith('..')||isAbsolute(r))throw Error('outside');if((await stat(p)).isDirectory())p=join(p,'index.html');res.setHeader('Content-Type',mime[extname(p)]??'application/octet-stream');res.end(await readFile(p))}catch{res.statusCode=404;res.end('Not found')}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,url=origin+startPath;
 const profile=await mkdtemp(join(tmpdir(),'xpotato-concrete-browser-'));
 const executable=process.env.ARTICLE_PREVIEW_BROWSER??(process.platform==='win32'?'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe':'google-chrome');
 const child=spawn(executable,['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-proxy-server','--disable-extensions','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,url],{stdio:['ignore','ignore','pipe']});
 let diagnostic='',launchError;child.stderr.on('data',b=>{diagnostic=(diagnostic+b.toString()).slice(-4000)});child.on('error',e=>{launchError=e});
 let socket,target,targets=[];
 try{
  for(let i=0;i<400;i++){
   if(launchError)throw launchError;
   // Windows Edge may hand off to its owned browser process and exit 0.
   // Only a nonzero launch failure is decisive; still require this unique
   // profile's DevTools port and the exact local test URL within the deadline.
   if(child.exitCode!==null&&child.exitCode!==0)throw Error('Browser exited '+child.exitCode+': '+diagnostic);
   try{const port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];targets=await fetch('http://127.0.0.1:'+port+'/json',{signal:AbortSignal.timeout(1500)}).then(r=>r.json());target=targets.find(t=>t.type==='page'&&t.url===url);if(target)break}catch{}
   await pause(150);
  }
  if(!target)throw Error('No article browser tab: '+JSON.stringify(targets.map(t=>({type:t.type,url:t.url})))+' '+diagnostic);
  socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j});let id=0;const pending=new Map();socket.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout '+method))},45000);pending.set(n,{resolve,reject,timer});socket.send(JSON.stringify({id:n,method,params}))});
  const js=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
  await send('Page.enable');await send('Runtime.enable');await send('DOM.enable');await send('CSS.enable');
  return {send,js,origin,close:async()=>{
   // Close the exact dedicated browser, including a Windows launcher handoff.
   // Killing an already-exited launcher alone leaves its owned browser alive.
   await Promise.race([send('Browser.close'),pause(1500)]).catch(()=>{});
   socket.close();child.kill();server.closeAllConnections();await new Promise(r=>server.close(r));
  }};
 }catch(e){socket?.close();child.kill();server.close();throw e}
}
export async function loaded(session,selector){for(let i=0;i<120;i++){if(await session.js('document.readyState==="complete" && !!document.querySelector('+JSON.stringify(selector)+')')){await session.js('(async()=>{for(const i of document.images)i.loading="eager";await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));return true})()');return}await pause(150)}throw Error('Page not ready '+selector)}
