import assert from 'node:assert/strict';
import {readFile,readdir,realpath} from 'node:fs/promises';
import {resolve,join,sep,relative} from 'node:path';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {parse} from 'parse5';
const repo=fileURLToPath(new URL('../',import.meta.url));
const dist=await realpath(resolve(process.argv[2]??join(repo,'apps/site/dist')));
const budget=JSON.parse(await readFile(join(repo,'docs/performance/budget-v1.json'),'utf8'));
const errors=[],rows=[],cache=new Map();
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const coreInputBytes=(await readFile(join(repo,'docs/performance/font-core-input-v1.json'),'utf8')).replaceAll('\r\n','\n');
const coreManifest=JSON.parse(await readFile(join(repo,'docs/performance/font-core-output-v1.json'),'utf8'));
assert.equal(sha256(coreInputBytes),coreManifest.inputSha256,'Core font input provenance changed');
const coreInput=JSON.parse(coreInputBytes);
assert.equal(sha256((await readFile(join(repo,'apps/site/src/styles/fonts.css'),'utf8')).replaceAll('\r\n','\n')),coreInput.sourceStylesheetSha256,'Original font stylesheet changed');
for(const group of coreInput.groups)for(const font of group.files){assert.match(font.filename,/^font-[a-f0-9]{16}\.woff2$/u);assert.equal(sha256(await readFile(join(repo,'apps/site/public/fonts',font.filename))),font.sha256,'Original font input changed');}
assert.equal(sha256((await readFile(join(repo,'apps/site/src/styles/fonts-core.css'),'utf8')).replaceAll('\r\n','\n')),coreManifest.stylesSha256,'Core font CSS changed without regeneration');
for(const font of coreManifest.fonts){assert.match(font.filename,/^font-[a-f0-9]{16}\.woff2$/u);const bytes=await readFile(join(repo,'apps/site/public/fonts',font.filename));assert.equal(sha256(bytes),font.sha256,'Core font binary changed');assert.equal(font.filename,`font-${font.sha256.slice(0,16)}.woff2`);}
const check=(label,size,limit)=>{for(const metric of ['raw','gzip'])if(size[metric]>limit[metric])errors.push(`${label}: ${metric} ${size[metric]} > ${limit[metric]}`);};
async function asset(url){const pathname=new URL(url,'https://local.invalid').pathname;const p=await realpath(resolve(dist,'.'+pathname));if(!p.startsWith(dist+sep))throw Error('Outside dist');if(!cache.has(p)){const bytes=await readFile(p);cache.set(p,{raw:bytes.length,gzip:gzipSync(bytes).length,source:bytes.toString('utf8'),path:pathname});}return cache.get(p);}
async function graph(url,seen=new Map()){const a=await asset(url);if(seen.has(a.path))return seen;seen.set(a.path,a);for(const match of a.source.matchAll(/(?:from\s*|import\s*\(?\s*)["'](\.[^"']+\.js)["']/gu))await graph(new URL(match[1],'https://local.invalid'+a.path).pathname,seen);return seen;}
const total=items=>({raw:items.reduce((n,a)=>n+a.raw,0),gzip:items.reduce((n,a)=>n+a.gzip,0)});
const htmlPaths=[];async function walk(folder){for(const e of await readdir(folder,{withFileTypes:true})){const p=join(folder,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&e.name.endsWith('.html'))htmlPaths.push(p);}}await walk(dist);
for(const path of htmlPaths.sort()){
 const route='/'+relative(dist,path).replaceAll('\\','/').replace(/index\.html$/u,'');const html=await readFile(path,'utf8'),css=[],jsRoots=[],images=[];let island=false,code=false;
 const visit=node=>{const attrs=Object.fromEntries((node.attrs??[]).map(a=>[a.name,a.value]));if(node.tagName==='link'&&attrs.rel==='stylesheet'){if(!attrs.href?.startsWith('/'))errors.push(`${route}: external CSS`);else css.push(attrs.href);}
  if(node.tagName==='script'&&attrs.src){if(!attrs.src.startsWith('/'))errors.push(`${route}: external script`);else jsRoots.push(attrs.src);}
  if(node.tagName==='astro-island'){island=true;for(const key of ['component-url','renderer-url'])if(attrs[key])jsRoots.push(attrs[key]);}
  if(node.tagName==='div'&&'data-code-block' in attrs)code=true;
  if(node.tagName==='img')images.push(attrs);
  for(const child of node.childNodes??[])visit(child);
 };visit(parse(html));
 const cssAssets=await Promise.all([...new Set(css)].map(asset));const js=new Map();for(const url of jsRoots)await graph(url,js);
 const kind=route==='/search/'?'search':route==='/tools/prime-factorizer/'?'tool':code?'code':'static';
 if(island&&kind!=='tool')errors.push(`${route}: unexpected framework island`);
 if(kind==='code'&&jsRoots.some(url=>url!=='/scripts/code-copy.js'))errors.push(`${route}: unapproved code runtime`);
 const htmlBytes={raw:Buffer.byteLength(html),gzip:gzipSync(html).length},cssBytes=total(cssAssets),jsBytes=total([...js.values()]);check(route+' HTML',htmlBytes,budget.html);check(route+' CSS',cssBytes,budget.routeCss);check(route+' JS',jsBytes,budget.routeJs[kind]);
 for(const image of images){if(!(Number(image.width)>0&&Number(image.height)>0))errors.push(`${route}: image dimensions missing`);if(image.fetchpriority==='high'&&image.loading==='lazy')errors.push(`${route}: hero is lazy`);if(image.src!=='/xpotato-logo.svg'&&image.fetchpriority!=='high'&&image.loading!=='lazy')errors.push(`${route}: non-hero image is not lazy`);}
 rows.push({route,kind,html:htmlBytes,css:cssBytes,js:jsBytes,images:images.length});
}
const index=await asset('/search/search-index.json');check('search index',index,budget.searchIndex);
assert.equal(errors.length,0,errors.join('\n'));
console.log(JSON.stringify({status:'PASS',rows,searchIndex:{raw:index.raw,gzip:index.gzip}},null,2));
