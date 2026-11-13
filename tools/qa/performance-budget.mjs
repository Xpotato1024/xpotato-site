import { searchIndexPath } from "../../apps/site/src/search/index-path.mjs";
import {articleMotionBudget} from "../../packages/site-validators/src/delivery/article-motion-runtime.ts";
import {homeUpdatesBudget} from "../../packages/site-validators/src/delivery/home-updates-runtime.ts";
import {homeHeaderBudget} from "../../packages/site-validators/src/delivery/home-header-runtime.ts";
import {homeCarouselBudget} from "../../packages/site-validators/src/delivery/home-carousel-runtime.ts";
import {contactIssuesBudget} from "../../packages/site-validators/src/delivery/contact-issues-runtime.ts";
import { readRegisteredToolRoutes } from "../../packages/site-validators/src/browser-tools/tool-runtime-policy.ts";
import { measureRouteRuntime } from "../../packages/site-validators/src/migration/phase8-runtime.ts";
import assert from 'node:assert/strict';
import {readFile,readdir,realpath} from 'node:fs/promises';
import {resolve,join,sep,relative} from 'node:path';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {parse} from 'parse5';
const repo=fileURLToPath(new URL("../../",import.meta.url));
const dist=await realpath(resolve(process.argv[2]??join(repo,'apps/site/dist')));
const budget=JSON.parse(await readFile(join(repo,"config/performance/budget-v1.json"),'utf8'));
const errors=[],rows=[],cache=new Map();
const registeredTools=await readRegisteredToolRoutes();
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const coreInputBytes=(await readFile(join(repo,"config/fonts/core-input-v1.json"),'utf8')).replaceAll('\r\n','\n');
const coreManifest=JSON.parse(await readFile(join(repo,"config/fonts/core-output-v1.json"),'utf8'));
assert.equal(sha256(coreInputBytes),coreManifest.inputSha256,'Core font input provenance changed');
const coreInput=JSON.parse(coreInputBytes);
assert.equal(sha256((await readFile(join(repo,'apps/site/src/styles/fonts.css'),'utf8')).replaceAll('\r\n','\n')),coreInput.sourceStylesheetSha256,'Original font stylesheet changed');
for(const group of coreInput.groups)for(const font of group.files){assert.match(font.filename,/^font-[a-f0-9]{16}\.woff2$/u);assert.equal(sha256(await readFile(join(repo,'apps/site/public/fonts',font.filename))),font.sha256,'Original font input changed');}
assert.equal(sha256((await readFile(join(repo,'apps/site/src/styles/fonts-core.css'),'utf8')).replaceAll('\r\n','\n')),coreManifest.stylesSha256,'Core font CSS changed without regeneration');
for(const font of coreManifest.fonts){assert.match(font.filename,/^font-[a-f0-9]{16}\.woff2$/u);const bytes=await readFile(join(repo,'apps/site/public/fonts',font.filename));assert.equal(sha256(bytes),font.sha256,'Core font binary changed');assert.equal(font.filename,`font-${font.sha256.slice(0,16)}.woff2`);assert.equal(sha256(await readFile(join(dist,'fonts',font.filename))),font.sha256,'Built core font differs from reviewed binary');}
const check=(label,size,limit)=>{for(const metric of ['raw','gzip'])if(size[metric]>limit[metric])errors.push(`${label}: ${metric} ${size[metric]} > ${limit[metric]}`);};
async function asset(url){const pathname=new URL(url,'https://local.invalid').pathname;const p=await realpath(resolve(dist,'.'+pathname));if(!p.startsWith(dist+sep))throw Error('Outside dist');if(!cache.has(p)){const bytes=await readFile(p);cache.set(p,{raw:bytes.length,gzip:gzipSync(bytes).length,source:bytes.toString('utf8'),path:pathname});}return cache.get(p);}
const total=items=>({raw:items.reduce((n,a)=>n+a.raw,0),gzip:items.reduce((n,a)=>n+a.gzip,0)});
const htmlPaths=[];async function walk(folder){for(const e of await readdir(folder,{withFileTypes:true})){const p=join(folder,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&e.name.endsWith('.html'))htmlPaths.push(p);}}await walk(dist);
for(const path of htmlPaths.sort()){
 const route='/'+relative(dist,path).replaceAll('\\','/').replace(/index\.html$/u,'');const html=await readFile(path,'utf8'),css=[],inlineCss=[],jsRoots=[],images=[];let island=false,code=false;
 const visit=node=>{const attrs=Object.fromEntries((node.attrs??[]).map(a=>[a.name,a.value]));if(node.tagName==='link'&&attrs.rel==='stylesheet'){if(!attrs.href?.startsWith('/'))errors.push(`${route}: external CSS`);else css.push(attrs.href);}
  if(node.tagName==='script'&&attrs.src){if(!attrs.src.startsWith('/'))errors.push(`${route}: external script`);else jsRoots.push(attrs.src);}
  if(node.tagName==='style'){const source=(node.childNodes??[]).filter(child=>child.nodeName==='#text').map(child=>child.value).join('');inlineCss.push({path:`(inline style ${inlineCss.length+1})`,raw:Buffer.byteLength(source),gzip:gzipSync(source).length,source});}
  if(node.tagName==='astro-island'){island=true;for(const key of ['component-url','renderer-url'])if(attrs[key])jsRoots.push(attrs[key]);}
  if(node.tagName==='div'&&'data-code-block' in attrs)code=true;
  if(node.tagName==='img')images.push(attrs);
  for(const child of node.childNodes??[])visit(child);
 };visit(parse(html));
 const cssAssets=[...await Promise.all([...new Set(css)].map(asset)),...inlineCss];
 const runtime=await measureRouteRuntime(dist,route,html);
 const size=assets=>total(assets.map(item=>({raw:item.bytes,gzip:item.gzipBytes})));
 const routeAssets=[...runtime.assets,...(runtime.codeCopyAssets??[])];
 if(route==='/search/')assert.ok((await Promise.all(routeAssets.map(item=>asset(item.path)))).some(item=>item.source.includes(searchIndexPath)),'Current search client must fetch the measured index path');
 const shareAssets=runtime.pageShareAssets??[];
 const motionAssets=runtime.articleMotionAssets??[]; check(route+" article motion JS",size(motionAssets),articleMotionBudget);
 const kind=route==='/search/'?'search':registeredTools.some(tool=>tool.route===route)?'tool':code?'code':'static';
 if(island&&kind!=='tool')errors.push(`${route}: unexpected framework island`);
 if(kind==='code'&&jsRoots.some(url=>url!=='/scripts/code-copy.js'&&url!==budget.sharedMenuJs.path&&!shareAssets.some(asset=>asset.path===url)&&!motionAssets.some(asset=>asset.path===url)))errors.push(`${route}: unapproved code runtime`);
 const homeHeaderAssets=runtime.homeHeaderAssets??[]; check(route+" home header JS",size(homeHeaderAssets),homeHeaderBudget);
 const homeAssets=runtime.homeCarouselAssets??[]; check(route+" home carousel JS",size(homeAssets),homeCarouselBudget);
 const updatesAssets=runtime.homeUpdatesAssets??[]; check(route+" home updates JS",size(updatesAssets),homeUpdatesBudget);
 const contactAssets=runtime.contactIssuesAssets??[]; check(route+' contact picker JS',size(contactAssets),contactIssuesBudget);
 const allJsBytes=size([...routeAssets,...runtime.sharedMenuAssets,...shareAssets,...motionAssets,...homeHeaderAssets,...homeAssets,...updatesAssets,...contactAssets,...(runtime.primePwaAssets??[])]),menuBytes=size(runtime.sharedMenuAssets),shareBytes=size(shareAssets);
 assert.deepEqual(budget.pageShareJs,{path:'/scripts/page-share.js',raw:4096,gzip:1800},'Only the bounded conditional page-sharing enhancement is admitted');
 check(route+' conditional page sharing JS',shareBytes,budget.pageShareJs);
 assert.equal(budget.sharedMenuJs.path,'/scripts/mobile-menu.js','Only the explicit menu synchronizer may be shared');
 check(route+' shared menu JS',menuBytes,budget.sharedMenuJs);
 const htmlBytes={raw:Buffer.byteLength(html),gzip:gzipSync(html).length},cssBytes=total(cssAssets),jsBytes=size(routeAssets);check(route+' HTML',htmlBytes,budget.html);check(route+' CSS',cssBytes,budget.routeCss);check(route+' route-specific JS',jsBytes,registeredTools.some(tool=>tool.route===route&&tool.asyncCompute)?budget.boundedToolJs:budget.routeJs[kind]);
 for(const image of images){if(!(Number(image.width)>0&&Number(image.height)>0))errors.push(`${route}: image dimensions missing`);if(image.fetchpriority==='high'&&image.loading==='lazy')errors.push(`${route}: hero is lazy`);if(image.src!=='/xpotato-logo.svg'&&image.fetchpriority!=='high'&&image.loading!=='lazy')errors.push(`${route}: non-hero image is not lazy`);}
 rows.push({route,kind,html:htmlBytes,css:cssBytes,cssAssets:cssAssets.map(({path,raw,gzip})=>({path,raw,gzip})),js:allJsBytes,routeSpecificJs:jsBytes,sharedMenuJs:menuBytes,...(shareAssets.length?{pageShareJs:shareBytes}:{}),...(motionAssets.length?{articleMotionJs:size(motionAssets)}:{}),...(homeHeaderAssets.length?{homeHeaderJs:size(homeHeaderAssets)}:{}),...(homeAssets.length?{homeCarouselJs:size(homeAssets)}:{}),...(updatesAssets.length?{homeUpdatesJs:size(updatesAssets)}:{}),...(contactAssets.length?{contactIssuesJs:size(contactAssets)}:{}),images:images.length});
}
const index=await asset(searchIndexPath);check('search index',index,budget.searchIndex);
assert.equal(errors.length,0,errors.join('\n'));
console.log(JSON.stringify({status:'PASS',rows,searchIndex:{path:searchIndexPath,raw:index.raw,gzip:index.gzip}},null,2));
