import test from 'node:test';
import assert from 'node:assert/strict';
import {createVersionStructureProbe,versionStructureReceipt} from './site-monitor-version-structure.mjs';
const accountId='a'.repeat(32),versionId='22222222-2222-2222-2222-222222222222';
const marker='fixture-private-marker',token='fixture-only-token-marker';
const body=()=>({success:true,errors:[],result:{id:versionId,resources:{bindings:[],script:{etag:marker,handlers:null,last_deployed_from:marker},script_runtime:{compatibility_date:'2026-08-26',usage_model:'standard'}},metadata:{author_id:marker}}});
function safe(r){
 const text=JSON.stringify(r);for(const value of [marker,token,accountId,versionId])assert.ok(!text.includes(value));assert.ok(Buffer.byteLength(text)<=8192);
 for(const key of ['acceptance','adopted','baselineUpdated','monitorActivated','deployAllowed'])assert.equal(r[key],false);assert.equal(r.providerMutations,0);
}
test('one exact version GET only, including second acquire after success',async()=>{
 const calls=[];let lookups=0;
 const probe=createVersionStructureProbe({accountId,versionId,credentialProvider:async()=>{lookups++;return token},fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json(body())}});
 const r=await probe.acquire();safe(r);assert.equal(r.status,'STRUCTURE_OBSERVED_NO_ACCEPTANCE');assert.equal(lookups,1);assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://api.cloudflare.com/client/v4/accounts/'+accountId+'/workers/scripts/xpotato-site/versions/'+versionId);
 assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.redirect,'manual');assert.equal(calls[0].options.body,undefined);
 assert.deepEqual(r.checks,{etagWithin256:'PASS',deploySourceWithin256:'PASS',authorIdWithin128:'PASS'});
 assert.equal(r.scopes.script.fields.handlers,'NULL');assert.equal((await probe.acquire()).status,'ALREADY_ATTEMPTED');assert.equal(calls.length,1);
});
for(const [name,response] of [['403',()=>new Response(marker,{status:403})],['redirect',()=>new Response(marker,{status:302})],['invalid JSON',()=>new Response(marker,{headers:{'content-type':'application/json'}})],['throw',()=>{throw Error(marker)}],['body budget',()=>new Response(marker,{headers:{'content-type':'application/json','content-length':'1048577'}})]])test('no retry or private errors after '+name,async()=>{
 let calls=0;const p=createVersionStructureProbe({accountId,versionId,credentialProvider:async()=>token,fetchImpl:async()=>{calls++;return response()}});
 const r=await p.acquire();safe(r);assert.equal(r.status,'TRANSPORT_BLOCKED');safe(await p.acquire());assert.equal(calls,1);
});
test('invalid context never looks up authentication or performs GET',async()=>{
 let calls=0;for(const context of [{accountId:marker},{versionId:marker},{fetchImpl:null},{credentialProvider:null}]){
  const p=createVersionStructureProbe({accountId,versionId,fetchImpl:()=>{calls++;throw Error(marker)},credentialProvider:()=>{calls++;throw Error(marker)},...context});
  const r=await p.acquire();safe(r);assert.equal(r.status,'CONFIGURATION_BLOCKED');assert.equal((await p.acquire()).status,'ALREADY_ATTEMPTED');
 }assert.equal(calls,0);
});
test('public field names at unmodeled paths are structure evidence only',()=>{
 const b=body();b.result.annotations={[marker]:marker};b.result.resources.script_runtime.placement={region:marker};b.result.metadata.annotations={[marker]:marker};
 const before=JSON.stringify(b),r=versionStructureReceipt(b,versionId);safe(r);assert.equal(JSON.stringify(b),before);
 assert.equal(r.scopes.version.fields.annotations,'OBJECT');assert.equal(r.scopes.runtime.fields.placement,'OBJECT');assert.equal(r.scopes.metadata.fields.annotations,'OBJECT');
 assert.ok(!JSON.stringify(r).includes('region'));
});
test('unknown names are withheld even if they look like harmless identifiers',()=>{
 const b=body();b.result[marker]=marker;b.result.resources.script_runtime.OwnerPrivateAccountAlias={nested:marker};b.result.metadata['a'.repeat(32)]=null;
 const r=versionStructureReceipt(b,versionId);safe(r);assert.equal(r.status,'STRUCTURE_PARTIAL_UNLISTED_FIELDS');
 for(const scope of ['version','runtime','metadata'])assert.equal(r.scopes[scope].unlistedFields,'PRESENT_WITHHELD');
 assert.deepEqual(r.scopes.version.unlistedFieldTypes,['STRING']);assert.deepEqual(r.scopes.runtime.unlistedFieldTypes,['OBJECT']);assert.deepEqual(r.scopes.metadata.unlistedFieldTypes,['NULL']);
 assert.ok(!JSON.stringify(r).includes('OwnerPrivateAccountAlias'));assert.ok(!JSON.stringify(r).includes('nested'));
});
for(const mutate of [b=>b.success=false,b=>delete b.errors,b=>b.errors=[{message:marker}],b=>b.messages=[{message:marker}],b=>b.result.id=marker,b=>b.result.resources.bindings=[{text:marker}],b=>b.result.resources.bindings={[marker]:marker},b=>b.result.resources=null,b=>b.result.metadata=null,b=>b.result.resources.script_runtime=[]])test('malformed or unsafe identity/envelope/container stays blocked '+String(mutate),()=>{
 const b=body();mutate(b);const r=versionStructureReceipt(b,versionId);safe(r);assert.ok(r.status.endsWith('BLOCKED'));assert.equal(r.scopes,undefined);
});
test('accessors, hidden/symbol keys and prototypes cannot leak or execute getters',()=>{
 let reads=0;
 for(const key of ['metadata',marker]){
  const b=body();Object.defineProperty(b.result,key,{enumerable:true,get(){reads++;throw Error(marker)}});const r=versionStructureReceipt(b,versionId);safe(r);assert.ok(r.status.endsWith('BLOCKED'));
 }
 for(const value of [Object.create({[marker]:marker}),Object.defineProperty({},marker,{value:marker}),{[Symbol(marker)]:marker}]){
  const b=body();b.result.metadata=value;const r=versionStructureReceipt(b,versionId);safe(r);assert.equal(r.status,'SCOPE_STRUCTURE_BLOCKED');assert.equal(r.blockedScope,'metadata');
 }assert.equal(reads,0);
});
test('bounds are fixed checks without bytes, values or hashes',()=>{
 for(const [key,max,scope,label] of [['etag',256,'script','etagWithin256'],['last_deployed_from',256,'script','deploySourceWithin256'],['author_id',128,'metadata','authorIdWithin128']]){
  for(const [value,verdict] of [['あ'.repeat(Math.floor(max/3))+'x'.repeat(max%3),'PASS'],['x'.repeat(max+1),'FAIL'],[null,'FAIL']]){
   const b=body(),v=scope==='script'?b.result.resources.script:b.result.metadata;v[key]=value;const r=versionStructureReceipt(b,versionId);safe(r);assert.equal(r.checks[label],verdict);assert.ok(!JSON.stringify(r).includes('Sha256'));
  }
 }
});
test('fixed field budget blocks arbitrary names without printing them',()=>{
 const b=body();for(let i=0;i<129;i++)b.result.metadata[marker+i]=marker;
 const r=versionStructureReceipt(b,versionId);safe(r);assert.equal(r.status,'FIELD_BUDGET_BLOCKED');assert.equal(r.blockedScope,'metadata');
});
test('nested private containers are never traversed',()=>{
 const b=body();const nested={};Object.defineProperty(nested,marker,{enumerable:true,get(){throw Error(marker)}});
 b.result.annotations=nested;b.result.resources.script_runtime.exports=nested;b.result.metadata[marker]=nested;
 const r=versionStructureReceipt(b,versionId);safe(r);assert.equal(r.status,'STRUCTURE_PARTIAL_UNLISTED_FIELDS');
});
test('page info accessor is rejected without invoking it',()=>{
 let reads=0;const b=body();b.result_info={};Object.defineProperty(b.result_info,'page',{enumerable:true,get(){reads++;throw Error(marker)}});
 const r=versionStructureReceipt(b,versionId);safe(r);assert.equal(r.status,'ENVELOPE_OR_RESULT_BLOCKED');assert.equal(reads,0);
});
for(const key of ['bindings','errors','messages'])test('nonempty '+key+' array accessor is never traversed',()=>{
 let reads=0;const b=body(),array=[];Object.defineProperty(array,'0',{enumerable:true,get(){reads++;throw Error(marker)}});
 if(key==='bindings')b.result.resources.bindings=array;else b[key]=array;
 const r=versionStructureReceipt(b,versionId);safe(r);assert.equal(r.status,key==='bindings'?'RESOURCES_OR_BINDINGS_BLOCKED':'ENVELOPE_OR_RESULT_BLOCKED');assert.equal(reads,0);
});
test('valid optional pagination and explicit empty object bindings remain readable',()=>{
 const b=body();b.messages=[];b.result_info={page:1,count:1,per_page:100,total_count:1,total_pages:1};b.result.resources.bindings={};
 const r=versionStructureReceipt(b,versionId);safe(r);assert.equal(r.status,'STRUCTURE_OBSERVED_NO_ACCEPTANCE');
});
test('pre-aborted caller cancels before authentication and GET, with no retry',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 const p=createVersionStructureProbe({accountId,versionId,signal:controller.signal,credentialProvider:()=>{calls++;return token},fetchImpl:()=>{calls++;return Response.json(body())}});
 const r=await p.acquire();safe(r);assert.equal(r.status,'TRANSPORT_BLOCKED');assert.equal(r.transportCode,'REMOTE_TIMEOUT');assert.equal(calls,0);assert.equal((await p.acquire()).status,'ALREADY_ATTEMPTED');
});
test('caller abort during noncooperative body read cannot yield an observed receipt',async()=>{
 const controller=new AbortController();let calls=0,reads=0,cancels=0,unlocks=0;
 const p=createVersionStructureProbe({accountId,versionId,signal:controller.signal,credentialProvider:async()=>token,fetchImpl:async()=>{
  calls++;
  return {status:200,headers:new Headers({'content-type':'application/json'}),body:{getReader:()=>({read(){reads++;return new Promise(resolve=>setTimeout(()=>{controller.abort();resolve({done:false,value:new TextEncoder().encode(JSON.stringify(body()))})},10))},cancel(){cancels++;return new Promise(()=>{})},releaseLock(){unlocks++}})}};
 }});
 const r=await p.acquire();safe(r);assert.equal(r.status,'TRANSPORT_BLOCKED');assert.equal(r.transportCode,'REMOTE_TIMEOUT');assert.equal(calls,1);assert.equal(reads,1);assert.ok(cancels>=1);assert.equal(unlocks,1);assert.equal((await p.acquire()).status,'ALREADY_ATTEMPTED');assert.equal(calls,1);
});
test('operation deadline expiring during body read cannot yield an observed receipt',async()=>{
 let now=0,calls=0;
 const p=createVersionStructureProbe({accountId,versionId,clock:()=>now,credentialProvider:async()=>token,fetchImpl:async()=>{
  calls++;return new Response(new ReadableStream({start(stream){setTimeout(()=>{now=10000;stream.enqueue(new TextEncoder().encode(JSON.stringify(body())));stream.close()},10)}}),{headers:{'content-type':'application/json'}});
 }});
 const r=await p.acquire();safe(r);assert.equal(r.status,'TRANSPORT_BLOCKED');assert.equal(r.transportCode,'REMOTE_TIMEOUT');assert.equal(calls,1);assert.equal((await p.acquire()).status,'ALREADY_ATTEMPTED');
});
