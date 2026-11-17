import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {existsSync} from 'node:fs';
import {parseStaticHeaderRules,headersForPath} from '../../packages/site-validators/src/delivery/static-headers.mjs';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json','.png':'image/png'};
export async function editorStaticServer(root,api){
 const integrated=resolve(root,'apps/site/dist/editor'),dist=existsSync(join(integrated,'index.html'))?integrated:resolve(root,'apps/editor/dist');
 const headersPath=resolve(root,'apps/site/dist/_headers'),rules=existsSync(headersPath)?parseStaticHeaderRules(await readFile(headersPath,'utf8')):[];
 const server=createServer(async(req,res)=>{
  try{const url=new URL(req.url,'http://127.0.0.1');
   if(url.pathname.startsWith('/editor-api/')){if(api){await api(req,res);return;}res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({authenticated:false,configured:false,repository:'Xpotato1024/xpotato-site'}));return;}
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
   let file;if(url.pathname==='/icon-apple-touch.png')file=join(root,'apps/site/public/icon-apple-touch.png');else{if(!url.pathname.startsWith('/editor/')){res.writeHead(404);res.end();return;}const item=decodeURIComponent(url.pathname.slice('/editor/'.length))||'index.html';file=resolve(dist,item);const within=relative(dist,file);if(!within||within.startsWith('..')||isAbsolute(within))throw Error('PATH_DENIED');}
   const info=await stat(file);if(!info.isFile())throw Error('NOT_FILE');const body=await readFile(file),ext=/\.[^.]+$/u.exec(file)?.[0];res.writeHead(200,{'Content-Type':types[ext]??'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headersForPath(url.pathname,rules)});res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404);res.end('Not found');}
 });await new Promise((accept,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',accept)});const address=server.address();return {server,origin:'http://127.0.0.1:'+address.port,close:()=>new Promise((accept,reject)=>{server.closeAllConnections();server.close(error=>error?reject(error):accept());})};
}
