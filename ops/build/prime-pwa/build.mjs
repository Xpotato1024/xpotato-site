import {readFile,writeFile,realpath} from 'node:fs/promises';
import {join,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {parse} from 'parse5';
import {parseStaticHeaderRules,headersForPath} from '../../../packages/site-validators/src/delivery/static-headers.mjs';
import {measureRouteRuntime} from '../../../packages/site-validators/src/migration/phase8-runtime.ts';
const route='/tools/prime-factorizer/',origin='https://xpotato.net';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const manifest = {id:route,name:'素因数分解機 | Xpotato',short_name:'素因数分解機',lang:'ja',start_url:route,scope:route,display:'standalone',background_color:'#ffffff',theme_color:'#ffffff',icons:[192,512].map(size=>({src:`/icon-prime-${size}.png`,sizes:`${size}x${size}`,type:'image/png',purpose:'any'}))};
export async function buildPrimePwa(dist,{check=false}={}) {
  const root=await realpath(dist),html=await readFile(join(root,route,'index.html'),'utf8');
  const runtime=await measureRouteRuntime(root,route,html);
  if(runtime.islands!==1||!html.includes('data-prime-offline'))throw Error('PRIME_OFFLINE_SHELL_REQUIRED');
  const rules=parseStaticHeaderRules(await readFile(join(root,'_headers'),'utf8'));
  const pending=[route,route+'manifest.webmanifest','/icon-prime-192.png','/icon-prime-512.png'];
  for(const rows of [runtime.assets,runtime.sharedMenuAssets,runtime.pageShareAssets,runtime.contactIssuesAssets,runtime.primePwaAssets])for(const row of rows??[])pending.push(row.path);
  const visit=node=>{
    const attrs=Object.fromEntries((node.attrs??[]).map(a=>[a.name,a.value]));
    if(node.tagName==='link'&&['stylesheet','icon','apple-touch-icon','preload'].includes(attrs.rel))pending.push(attrs.href);
    if(node.tagName==='img'&&attrs.src?.startsWith('/'))pending.push(attrs.src);
    if(node.tagName==='style')for(const [,url] of (node.childNodes??[]).map(n=>n.value??'').join('').matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/gu))pending.push(url);
    for(const child of node.childNodes??[])visit(child);
  };visit(parse(html));
  const manifestText=JSON.stringify(manifest)+'\n';
  const manifestFile=join(root,route,'manifest.webmanifest');
  if(check){if(await readFile(manifestFile,'utf8')!==manifestText)throw Error('PRIME_MANIFEST_CHANGED');}else await writeFile(manifestFile,manifestText);
  const entries=new Map();
  while(pending.length){
    const raw=pending.shift();if(!raw||raw.startsWith('data:'))continue;
    const url=new URL(raw,origin+route),path=url.pathname;
    if(url.origin!==origin||url.search||url.hash||raw.includes('\\')||/%/u.test(raw))throw Error('PRIME_OFFLINE_UNSAFE_ASSET '+raw);
    if(entries.has(path))continue;
    if(!(path===route||path===route+'manifest.webmanifest'||/^\/(?:_astro\/[^/]+\.(?:m?js|css)|fonts\/font-[a-f0-9]+\.woff2|scripts\/(?:mobile-menu|page-share|contact-issues|prime-pwa)\.js|(?:icons\/share-x\.svg|favicon\.(?:svg|ico)|xpotato-logo\.svg|icon-(?:apple-touch|share-line|prime-(?:192|512))\.png))$/u.test(path)))throw Error('PRIME_OFFLINE_UNAPPROVED_ASSET '+path);
    const local=await realpath(join(root,path===route?path+'index.html':path));if(!local.startsWith(root+sep))throw Error('PRIME_OFFLINE_PATH_ESCAPE');
    const body=await readFile(local);entries.set(path,{path,bytes:body.length,sha256:hash(body),csp:headersForPath(path,rules)['content-security-policy']});
    if(path.endsWith('.css')&&/@import\b/u.test(body.toString('utf8')))throw Error('PRIME_OFFLINE_CSS_IMPORT');
    if(path.endsWith('.css'))for(const [,url] of body.toString('utf8').matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/gu)){
      if(!url.startsWith('data:'))pending.push(new URL(url,origin+path).href);
    }
  }
  const list=[...entries.values()].sort((a,b)=>a.path.localeCompare(b.path));
  if(list.length>128||list.reduce((n,e)=>n+e.bytes,0)>12*1024*1024)throw Error('PRIME_OFFLINE_BUDGET');
  const template=await readFile(new URL('sw-template.js',import.meta.url),'utf8');
  const release={version:hash(JSON.stringify(list)+template),entries:list};
  const source=template.replace('__PRIME_PWA_RELEASE__',JSON.stringify(release));
  const output=join(root,route,'sw.js');
  if(check){if(await readFile(output,'utf8')!==source)throw Error('PRIME_OFFLINE_RELEASE_CHANGED');}else await writeFile(output,source);
  return {version:release.version,files:list.length,bytes:list.reduce((n,e)=>n+e.bytes,0)};
}
