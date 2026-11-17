import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export async function editorShellInventory(dist){
 const files=[];async function walk(directory,prefix=''){for(const entry of await readdir(directory,{withFileTypes:true})){if(entry.isSymbolicLink())throw Error('EDITOR_ASSET_SYMLINK');const name=prefix+entry.name;if(entry.isDirectory())await walk(join(directory,entry.name),name+'/');else if(entry.isFile()&&name!=='sw.js'){if(!/^(?:index\.html|manifest\.webmanifest|icon\.svg|assets\/[a-zA-Z0-9_.-]+\.(?:js|css)|fonts\/[a-zA-Z0-9_.-]+\.woff2)$/u.test(name))throw Error('EDITOR_ASSET_NOT_ALLOWED: '+name);const bytes=await readFile(join(directory,entry.name));files.push({path:'/editor/'+name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}}}
 await walk(dist);files.sort((a,b)=>a.path.localeCompare(b.path));if(!files.some(f=>f.path==='/editor/index.html'))throw Error('EDITOR_SHELL_MISSING');return files;
}
export function editorWorkerSource(files){
 const digest=createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0,20),paths=files.map(item=>item.path);
 return '// Generated from the exact static editor shell. Never caches auth, drafts or media.\n'+
 'const VERSION='+JSON.stringify('xpotato-editor-'+digest)+';\nconst FILES='+JSON.stringify(paths)+';\nconst ALLOWED=new Set(FILES);\n'+
 "self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(VERSION);await cache.addAll(FILES.map(path=>new Request(path,{cache:'reload',credentials:'same-origin'})));})()));\n"+
 "self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE')self.skipWaiting();});\n"+
 "self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('xpotato-editor-')&&key!==VERSION)await caches.delete(key);await self.clients.claim();})()));\n"+
 "self.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin||url.search||request.headers.has('Authorization'))return;const path=url.pathname==='/editor/'?'/editor/index.html':url.pathname;if(!ALLOWED.has(path))return;event.respondWith((async()=>{const cache=await caches.open(VERSION);if(request.mode==='navigate'){try{const response=await fetch(request);if(response.ok)await cache.put(path,response.clone());return response;}catch{return await cache.match(path)||Response.error();}}return await cache.match(path)||fetch(request);})());});\n";
}
export async function buildEditorPwa(dist){const files=await editorShellInventory(dist);await writeFile(join(dist,'sw.js'),editorWorkerSource(files));return {files:files.length,bytes:files.reduce((sum,item)=>sum+item.bytes,0)};}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(await buildEditorPwa(resolve(process.argv[2]??'apps/editor/dist'))));
