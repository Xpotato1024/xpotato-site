import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {compilePublicationPlan,assertPublicationPlan,readPublicationFiles} from './publication-plan.mjs';
import {publicationMediaManifestPath,publicationMediaOrigin} from './publication-media-policy.mjs';
import {createPublicReadback,publicReadbackReport} from './manual-deployment-public.mjs';
import {hashBytes} from './manual-deployment.mjs';
const sha='a'.repeat(40),versionId='11111111-1111-4111-8111-111111111111';
const media={protocol:'xpotato-built-publication-media-v1',sourceSha:sha,objects:[]};
const headers="/*\n  Content-Security-Policy: default-src 'self'; img-src 'self' data: "+publicationMediaOrigin+"\n  X-Content-Type-Options: nosniff\n";
const html=title=>Buffer.from('<!doctype html><title>'+title+'</title><link href="/_astro/site.css" rel="stylesheet"><h1>'+title+'</h1>');
test('article, tool, fixed page, discovery and style output share one finite artifact plan',async()=>{
 const files=new Map([
  ['/index.html',html('ホーム')],['/articles/automatic-id/index.html',html('記事ダミー')],
  ['/tools/example/index.html',html('ツールダミー')],['/example/index.html',html('固定ページダミー')],
  ['/_astro/site.css',Buffer.from('body{color:purple}')],['/rss.xml',Buffer.from('<rss/>')],
  ['/sitemap-0.xml',Buffer.from('<urlset/>')],['/search/search-index.json',Buffer.from('{}')],['/_headers',Buffer.from(headers)],
 ]);
 const plan=compilePublicationPlan({files,sourceSha:sha,media,headers,publishedRoutes:['/articles/automatic-id/','/tools/example/','/example/']});
 for(const path of ['/articles/automatic-id/','/tools/example/','/example/','/rss.xml','/sitemap-0.xml','/search/search-index.json','/_astro/site.css'])assert.ok(plan.targets.some(t=>t.path===path));
 assert.ok(!plan.routes.includes('/private-draft/'));
 const root=await mkdtemp(join(tmpdir(),'public-plan-'));
 try{
  for(const [path,body] of files){const file=join(root,path);await mkdir(join(file,'..'),{recursive:true});await writeFile(file,body);}
  await writeFile(join(root,publicationMediaManifestPath),JSON.stringify(plan));
  assert.equal((await assertPublicationPlan(root,sha)).routes.length,4);
  await writeFile(join(root,'_astro/site.css'),'body{color:rebeccapurple}');
  await assert.rejects(()=>assertPublicationPlan(root,sha),/PUBLICATION_MANIFEST_CHANGED/);
  const changed=compilePublicationPlan({files:await readPublicationFiles(root),sourceSha:sha,media,headers});
  assert.notEqual(changed.targets.find(t=>t.path==='/_astro/site.css').sha256,plan.targets.find(t=>t.path==='/_astro/site.css').sha256);
  const altered=structuredClone(changed);altered.targets.pop();await writeFile(join(root,publicationMediaManifestPath),JSON.stringify(altered));
  await assert.rejects(()=>assertPublicationPlan(root,sha),/PUBLICATION_MANIFEST_CHANGED/);
  await assert.rejects(()=>assertPublicationPlan(root,'b'.repeat(40)),/PUBLICATION_MANIFEST_IDENTITY/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('missing linked assets and published routes stop before artifact admission',()=>{
 assert.throws(()=>compilePublicationPlan({files:new Map([['/index.html',html('missing')]]),sourceSha:sha,media,headers}),/PUBLICATION_REFERENCE_MISSING/);
 assert.throws(()=>compilePublicationPlan({files:new Map([['/index.html',Buffer.from('<p>home</p>')]]),sourceSha:sha,media,headers,publishedRoutes:['/missing/']}),/PUBLICATION_ROUTE_MISSING/);
});
test('readback re-observes old bytes with GET only and checks response headers',async()=>{
 const body='current',old='older response is longer',calls=[];let observations=0,versionChecks=0;
 const target={path:'/articles/automatic-id/',bytes:body.length,sha256:hashBytes(body)};
 const readback=createPublicReadback({wait:async()=>{},fetchImpl:async(url,options)=>{
  calls.push({url,method:options.method});
  return new Response(url.includes('workers.dev')?'missing':++observations===1?old:body,{status:url.includes('workers.dev')?404:200,headers:{'Content-Security-Policy':"default-src 'self'; img-src 'self' data: "+publicationMediaOrigin,'X-Content-Type-Options':'nosniff'}});
 }});
 const report=await readback.published({targets:[target],headers},{versionId,accountSubdomain:'example'},async()=>{versionChecks++;});
 assert.equal(report.status,'verified');assert.equal(report.attempts,2);assert.ok(versionChecks>=2);
 assert.equal(report.observations[0].matches,false);assert.equal(report.observations[1].matches,true);
 assert.ok(calls.every(c=>c.method==='GET'));assert.ok(!JSON.stringify(report).includes(old));
});
test('persistent mismatch retains bounded diagnostics without body or arbitrary error text',async()=>{
 const target={path:'/example/',bytes:7,sha256:hashBytes('current')};
 const readback=createPublicReadback({wait:async()=>{},fetchImpl:async()=>new Response('private-secret-body',{status:200})});
 await assert.rejects(()=>readback.published({targets:[target]},{versionId,accountSubdomain:'example'}),error=>{
  const report=publicReadbackReport(error);assert.equal(error.message,'PUBLIC_BYTES_MISMATCH');
  assert.equal(report.attempts,3);assert.equal(report.observations.length,3);assert.equal(report.observations[0].path,'/example/');
  assert.equal(report.observations[0].actual.bytes,19);assert.ok(!JSON.stringify(report).includes('private-secret-body'));return true;
 });
});
test('redirects and a changed provider version do not become retry success',async()=>{
 let calls=0;
 const redirect=createPublicReadback({wait:async()=>{},fetchImpl:async()=>{calls++;return new Response('redirect',{status:302});}});
 await assert.rejects(()=>redirect.published({targets:[{path:'/',bytes:1,sha256:hashBytes('a')}]},{versionId,accountSubdomain:'example'}),/PUBLIC_HTTP_OR_REDIRECT/);
 assert.equal(calls,1);
 const changed=createPublicReadback({wait:async()=>{},fetchImpl:async()=>new Response('old',{status:200})});
 await assert.rejects(()=>changed.published({targets:[{path:'/',bytes:3,sha256:hashBytes('new')}]},{versionId,accountSubdomain:'example'},async()=>{throw Error('VERSION_CHANGED');}),/VERSION_CHANGED/);
});
for(const [name,errorCode,respond] of [
 ['timeout','PUBLIC_TIMEOUT',(_url,options)=>new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Error('private-transport https://private.invalid/?X-Amz-Signature=secret')),{once:true}))],
 ['redirect','PUBLIC_HTTP_OR_REDIRECT',()=>new Response('private-body',{status:302,headers:{Location:'https://private.invalid/?X-Amz-Signature=secret'}})],
 ['oversized body','PUBLIC_BODY_LIMIT',()=>new Response(Buffer.alloc(2097153,97),{status:200})],
 ['transport exception','PUBLIC_READ_FAILED',()=>{throw Error('private-transport https://private.invalid/?X-Amz-Signature=secret');}],
])test('failed public observation records its admitted path and safe classification: '+name,async()=>{
 let calls=0;
 const target={path:'/articles/automatic-id/',bytes:7,sha256:hashBytes('current')};
 const readback=createPublicReadback({fetchImpl:async(url,options)=>{calls++;assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');return respond(url,options);}});
 await assert.rejects(()=>readback.published({targets:[target]},{versionId,accountSubdomain:'example'}),error=>{
  assert.equal(error.message,errorCode);
  const report=publicReadbackReport(error),row=report.observations[0];
  assert.equal(report.observations.length,1);assert.equal(report.requests,1);assert.equal(report.attempts,1);
  assert.equal(row.path,target.path);assert.equal(row.errorCode,errorCode);assert.equal(row.matches,false);
  assert.deepEqual(row.expected,{status:200,bytes:target.bytes,sha256:target.sha256});assert.ok(!Object.hasOwn(row,'actual'));
  assert.equal(new Date(row.observedAt).toISOString(),row.observedAt);
  const serialized=JSON.stringify(report);
  for(const privateValue of ['private-transport','private-body','private.invalid','X-Amz-Signature','secret'])assert.ok(!serialized.includes(privateValue));
  return true;
 });
 assert.equal(calls,1,'an exception must not add another GET or trigger a deploy');
});
