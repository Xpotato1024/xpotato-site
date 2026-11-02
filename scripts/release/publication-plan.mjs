// One public, artifact-bound projection. No provider access or deployment authority.
import {readFile,readdir,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {publicationMediaManifestPath,publicationMediaReferences} from './publication-media-policy.mjs';
import {parseStaticHeaderRules,headersForPath} from '../static-headers.mjs';
import {assertPublicTargetPlan} from './public-readback-policy.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const metric=(path,body)=>({path,bytes:body.length,sha256:hash(body)});
export const publicationProtocol='xpotato-publication-v1';
export async function readPublicationFiles(dist){
 const files=new Map();
 async function walk(directory,prefix=''){
  if((await lstat(directory)).isSymbolicLink())throw Error('PUBLICATION_PATH_ESCAPE');
  for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
   const name=prefix+entry.name,path=join(directory,entry.name);
   if(entry.isSymbolicLink())throw Error('PUBLICATION_PATH_ESCAPE');
   if(entry.isDirectory())await walk(path,name+'/');
   else if(entry.isFile()&&name!==publicationMediaManifestPath)files.set('/'+name,await readFile(path));
   else if(!entry.isFile())throw Error('PUBLICATION_NONREGULAR_FILE');
  }
 }
 await walk(dist);return files;
}
export function compilePublicationPlan({files,sourceSha,media,headers,publishedRoutes=[]}){
 if(!/^[a-f0-9]{40}$/.test(sourceSha))throw Error('PUBLICATION_SOURCE_REQUIRED');
 const mediaRefs=publicationMediaReferences(media,sourceSha),rules=parseStaticHeaderRules(headers);
 const origin='https://xpotato.net',selected=new Map(),routes=[];
 const add=(path,body)=>{if(!body)throw Error('PUBLICATION_REFERENCE_MISSING: '+path);selected.set(path,metric(path,body));};
 for(const [path,body] of files){
  if(path.endsWith('.html')&&path!=='/404.html'){
   const route=path==='/index.html'?'/':path.endsWith('/index.html')?path.slice(0,-10):path;
   routes.push(route);add(route,body);
   for(const [,value] of body.toString('utf8').matchAll(/(?:src|href)=["']([^"']+)["']/g)){
    const url=new URL(value,origin+route);
    if(url.origin===origin&&/\.(css|js|svg|ico|woff2?)$/.test(url.pathname)){
     if(url.search||url.hash)throw Error('PUBLICATION_ASSET_QUERY');
     add(url.pathname,files.get(url.pathname));
    }
   }
  }
  if(path.startsWith('/_astro/')&&/\.(css|js)$/.test(path)||/\.(xml|json)$/.test(path)&&!path.startsWith('/_')||path==='/robots.txt'
    ||/\.(png|jpe?g|webp|avif|gif|ico)$/.test(path))add(path,body);
 }
 for(const route of publishedRoutes)if(!routes.includes(route))throw Error('PUBLICATION_ROUTE_MISSING: '+route);
 for(const row of mediaRefs.values())selected.set(row.url,{path:row.url,bytes:row.bytes,sha256:row.sha256});
 const targets=[...selected.values()].sort((a,b)=>a.path.localeCompare(b.path));
 const budgets=assertPublicTargetPlan(targets);
 for(const route of routes)if(!headersForPath(route,rules)['content-security-policy'])throw Error('PUBLICATION_CSP_MISSING');
 return {protocol:publicationProtocol,sourceSha,media,routes:routes.sort(),headers,
  files:[...files].filter(([path])=>path!=='/_headers').map(([path,body])=>metric(path,body)).sort((a,b)=>a.path.localeCompare(b.path)),targets,budgets};
}
export async function assertPublicationPlan(dist,sourceSha){
 const text=await readFile(join(dist,publicationMediaManifestPath),'utf8');
 if(Buffer.byteLength(text)>524288)throw Error('PUBLICATION_MANIFEST_LIMIT');
 const manifest=JSON.parse(text);
 if(manifest.protocol!==publicationProtocol||manifest.sourceSha!==sourceSha)throw Error('PUBLICATION_MANIFEST_IDENTITY');
 const files=await readPublicationFiles(dist),headers=await readFile(join(dist,'_headers'),'utf8');
 const expected=compilePublicationPlan({files,sourceSha,media:manifest.media,headers});
 if(JSON.stringify(expected)!==JSON.stringify(manifest))throw Error('PUBLICATION_MANIFEST_CHANGED');
 return expected;
}
