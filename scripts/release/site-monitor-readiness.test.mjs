import test from 'node:test';
import assert from 'node:assert/strict';
import {probeWorkerMetadata} from './site-monitor-readiness.mjs';
const accountId='a'.repeat(32),version='11111111-2222-3333-4444-555555555555';
const fixture=path=>path.endsWith('/deployments')?{deployments:[{id:version,strategy:'percentage',versions:[{version_id:version,percentage:100}]}]}:path.includes('/versions/')?{id:version,resources:{bindings:{}}}:path.endsWith('/script-settings')?{}:path.endsWith('/settings')?{bindings:[]}:path.endsWith('/scripts')?[{id:'xpotato-site',tag:'b'.repeat(32)}]:path.endsWith('/domains')?[]:path.endsWith('/tokens/verify')?{id:'c'.repeat(32),status:'active'}:path.includes('/scripts/')?{enabled:false,previews_enabled:false}:{subdomain:'existing-account'};
const credentialProvider=async()=>'fixture-token-not-a-secret';
test('scope probe only sends fixed GETs, emits no raw values and never grants authority',async()=>{
 const calls=[];const receipt=await probeWorkerMetadata({accountId,credentialProvider,fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json({success:true,errors:[],result:fixture(new URL(url).pathname)})}});
 assert.equal(receipt.status,'REQUIRED_GET_ACCESSIBLE_NO_LIVE_ACCEPTANCE');assert.equal(calls.length,9);
 assert.ok(calls.every(c=>new URL(c.url).origin==='https://api.cloudflare.com'&&c.options.method==='GET'&&c.options.redirect==='manual'&&!c.options.body));
 assert.equal(receipt.deployAllowed,false);assert.equal(receipt.providerMutations,0);assert.equal(receipt.acceptance,false);assert.equal(receipt.baselineUpdated,false);assert.equal(receipt.completePaginationVerified,false);
 assert.ok(!JSON.stringify(receipt).includes(accountId));assert.ok(!JSON.stringify(receipt).includes(version));
});
test('403 stops without broadening permissions or printing the error body',async()=>{
 let calls=0;const receipt=await probeWorkerMetadata({accountId,credentialProvider,fetchImpl:async()=>{calls++;return Response.json({secret:'do-not-print'},{status:403})}});
 assert.equal(receipt.status,'SCOPE_OR_RESPONSE_BLOCKED');assert.equal(calls,1);assert.equal(receipt.receipts[0].status,'REMOTE_HTTP_403');assert.ok(!JSON.stringify(receipt).includes('do-not-print'));
});
test('unknown deployment identity stops before using provider-controlled URL fields',async()=>{
 let calls=0;const receipt=await probeWorkerMetadata({accountId,credentialProvider,fetchImpl:async()=>{calls++;return Response.json({success:true,errors:[],result:{deployments:[{versions:[{version_id:'../../other'}]}]}})}});
 assert.equal(calls,1);assert.equal(receipt.status,'SCOPE_OR_RESPONSE_BLOCKED');
});
test('invalid account input performs no credential lookup or network',async()=>{
 const forbidden=()=>{throw Error('must not run')};const receipt=await probeWorkerMetadata({accountId:'https://other',credentialProvider:forbidden,fetchImpl:forbidden});assert.equal(receipt.status,'INVALID_ACCOUNT');assert.deepEqual(receipt.receipts,[]);
});

test('a rerun by another triggering actor is rejected before Secret/provider access',async()=>{
 const {spawnSync}=await import('node:child_process');
 const response=spawnSync(process.execPath,[new URL('./site-monitor-readiness-cli.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')],{encoding:'utf8',env:{SITE_MONITOR_AUTHORIZATION:'owner-approved-fixed-get-probe',GITHUB_REPOSITORY:'Xpotato1024/xpotato-site',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_ACTOR:'Xpotato1024',GITHUB_TRIGGERING_ACTOR:'other-user',PROBE_ACCOUNT_ID:accountId,CLOUDFLARE_SITE_MONITOR_READ_TOKEN:'fixture-only-token'}});
 assert.equal(response.status,1);assert.equal(response.stdout,'');assert.match(response.stderr,/Readiness probe blocked/);
});

async function probeVersion(body,{status=200,raw}={}){
 const calls=[];
 const receipt=await probeWorkerMetadata({accountId,credentialProvider,fetchImpl:async(url,options)=>{
  const path=new URL(url).pathname;calls.push({path,options});
  return path.includes('/versions/')?(raw===undefined?Response.json(body,{status}):new Response(raw,{status,headers:{'Content-Type':'application/json'}})):Response.json({success:true,errors:[],result:fixture(path)});
 }});
 return {receipt,calls,versionReceipt:receipt.receipts.find(r=>r.endpoint==='worker-version')};
}
const envelope=result=>({success:true,errors:[],result});
const versionResult=resources=>({id:version,resources});
const types=new Set(['MISSING','NULL','ARRAY','OBJECT','STRING','NUMBER','BOOLEAN','OTHER']);
function assertFixedDiagnostics(diagnostics){
 assert.deepEqual(Object.keys(diagnostics),['fields','checks']);
 assert.deepEqual(Object.keys(diagnostics.fields),['success','errors','result','id','resources','bindings']);
 assert.deepEqual(Object.keys(diagnostics.checks),['envelope','result','identity','resources','bindings']);
 assert.ok(Object.values(diagnostics.fields).every(v=>types.has(v)));
 assert.ok(Object.values(diagnostics.checks).every(v=>v==='PASS'||v==='FAIL'));
}
function assertNoAuthority(receipt){
 for(const key of ['deployAllowed','acceptance','baselineUpdated','routesTested','completePaginationVerified'])assert.equal(receipt[key],false);
 assert.equal(receipt.providerMutations,0);
}
for(const [label,resources,type] of [
 ['omitted',{},'MISSING'],['empty list',{bindings:[]},'ARRAY'],
 ['binding list',{bindings:[{name:'fixture-binding',type:'plain_text',text:'fixture-value'}]},'ARRAY'],
 ['example object',{bindings:{}},'OBJECT'],['nonempty object',{bindings:{fixture:'fixture-value'}},'OBJECT']
])test(`worker version accepts documented bindings shape: ${label}`,async()=>{
 const {receipt,calls,versionReceipt}=await probeVersion(envelope(versionResult(resources)));
 assert.equal(receipt.status,'REQUIRED_GET_ACCESSIBLE_NO_LIVE_ACCEPTANCE');assert.equal(calls.length,9);
 assert.equal(versionReceipt.status,'READABLE');assertFixedDiagnostics(versionReceipt.diagnostics);
 assert.equal(versionReceipt.diagnostics.fields.bindings,type);
 assert.ok(Object.values(versionReceipt.diagnostics.checks).every(v=>v==='PASS'));
 assertNoAuthority(receipt);
});
for(const [label,bindings,type] of [
 ['null',null,'NULL'],['string','fixture-value','STRING'],['number',42,'NUMBER'],['boolean',false,'BOOLEAN'],
 ['null item',[null],'ARRAY'],['string item',['fixture-value'],'ARRAY'],['nested list',[[]],'ARRAY'],
 ['mixed list',[{},42],'ARRAY']
])test(`malformed bindings stop at worker version: ${label}`,async()=>{
 const {receipt,calls,versionReceipt}=await probeVersion(envelope(versionResult({bindings})));
 assert.equal(receipt.status,'SCOPE_OR_RESPONSE_BLOCKED');assert.equal(calls.length,2);
 assert.equal(versionReceipt.status,'PROVIDER_SHAPE_UNKNOWN');assertFixedDiagnostics(versionReceipt.diagnostics);
 assert.equal(versionReceipt.diagnostics.fields.bindings,type);assert.equal(versionReceipt.diagnostics.checks.bindings,'FAIL');
 assertNoAuthority(receipt);
});
for(const [label,body,check,field,type] of [
 ['null envelope',null,'envelope','result','MISSING'],
 ['array envelope',[],'envelope','result','MISSING'],
 ['missing success',{errors:[],result:versionResult({})},'envelope','success','MISSING'],
 ['false success',{success:false,errors:[],result:versionResult({})},'envelope','success','BOOLEAN'],
 ['string success',{success:'true',errors:[],result:versionResult({})},'envelope','success','STRING'],
 ['missing errors',{success:true,result:versionResult({})},'envelope','errors','MISSING'],
 ['wrong errors type',{success:true,errors:{},result:versionResult({})},'envelope','errors','OBJECT'],
 ['provider errors',{success:true,errors:[{message:'fixture-private-error'}],result:versionResult({})},'envelope','errors','ARRAY'],
 ['missing result',envelope(undefined),'result','result','MISSING'],
 ['null result',envelope(null),'result','result','NULL'],
 ['array result',envelope([]),'result','result','ARRAY'],
 ['missing id',envelope({resources:{}}),'identity','id','MISSING'],
 ['wrong id type',envelope({id:42,resources:{}}),'identity','id','NUMBER'],
 ['mismatched id',envelope({id:'66666666-7777-8888-9999-000000000000',resources:{}}),'identity','id','STRING'],
 ['missing resources',envelope({id:version}),'resources','resources','MISSING'],
 ['null resources',envelope(versionResult(null)),'resources','resources','NULL'],
 ['array resources',envelope(versionResult([])),'resources','resources','ARRAY'],
 ['string resources',envelope(versionResult('fixture-private-resources')),'resources','resources','STRING']
])test(`required envelope and identity remain fail closed: ${label}`,async()=>{
 const {receipt,calls,versionReceipt}=await probeVersion(body);
 assert.equal(receipt.status,'SCOPE_OR_RESPONSE_BLOCKED');assert.equal(calls.length,2);
 assert.equal(versionReceipt.status,'PROVIDER_SHAPE_UNKNOWN');assertFixedDiagnostics(versionReceipt.diagnostics);
 assert.equal(versionReceipt.diagnostics.checks[check],'FAIL');assert.equal(versionReceipt.diagnostics.fields[field],type);
 assertNoAuthority(receipt);
});
test('diagnostics never copy provider keys, binding values, IDs, errors or credentials',async()=>{
 const marker='fixture-private-marker';
 for(const body of [
  envelope({...versionResult({bindings:[{name:marker,type:marker,text:marker,token:marker}]}),[marker]:marker}),
  {success:marker,errors:[{[marker]:marker}],result:{id:marker,resources:{bindings:marker},[marker]:marker}}
 ]){
  const {receipt,versionReceipt}=await probeVersion(body);
  assertFixedDiagnostics(versionReceipt.diagnostics);assertNoAuthority(receipt);
  const output=JSON.stringify(receipt);
  for(const value of [marker,accountId,version,'fixture-token-not-a-secret'])assert.ok(!output.includes(value));
 }
});
for(const [label,options,code] of [
 ['403',{status:403},'REMOTE_HTTP_403'],['invalid JSON',{raw:'fixture-private-invalid-json'},'REMOTE_INVALID_JSON']
])test(`transport failure keeps static code without shape diagnostics: ${label}`,async()=>{
 const {receipt,calls,versionReceipt}=await probeVersion({secret:'fixture-private-body'},options);
 assert.equal(receipt.status,'SCOPE_OR_RESPONSE_BLOCKED');assert.equal(calls.length,2);
 assert.deepEqual(versionReceipt,{endpoint:'worker-version',status:code});assertNoAuthority(receipt);
 assert.ok(!JSON.stringify(receipt).includes('fixture-private'));
});
