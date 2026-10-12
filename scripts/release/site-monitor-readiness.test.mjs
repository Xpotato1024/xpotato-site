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
const types=new Set(['MISSING','NULL','ARRAY','OBJECT','STRING','NUMBER','BOOLEAN','OTHER','UNAVAILABLE']);
const layouts={
 'worker-deployments':[['deployments','deploymentId','strategy','versions','versionId','percentage'],['deployments','identity','traffic']],
 'worker-version':[['id','resources','bindings'],['identity','resources','bindings']],
 'worker-settings':[['bindings'],['bindings']],
 'worker-script-settings':[['logpush','observability','tags','tail_consumers'],['optionalFields']],
 'worker-subdomain':[['enabled','previews_enabled'],['flags']],
 'account-worker-identities':[['id','tag'],['items','identity']],
 'account-worker-domains':[['id','service','hostname','environment'],['items','identity','service','domainFields']],
 'account-worker-subdomain':[['subdomain'],['dnsLabel']],
 'own-account-token-verify':[['id','status','expires_on','not_before'],['identity','tokenStatus','active','optionalFields']]
};
const labels=Object.keys(layouts),paged=new Set([labels[0],labels[5],labels[6]]);
function assertFixedDiagnostics(diagnostics,label='worker-version'){
 const [fields,checks]=layouts[label];
 assert.deepEqual(Object.keys(diagnostics),['fields','checks']);
 assert.deepEqual(Object.keys(diagnostics.fields),['envelope','success','errors','result',...fields,...(paged.has(label)?['result_info','page','per_page','count','total_count','total_pages']:[])]);
 assert.deepEqual(Object.keys(diagnostics.checks),['transport','envelope','success','errors','result',...checks,...(paged.has(label)?['pagination']:[])]);
 assert.ok(Object.values(diagnostics.fields).every(v=>types.has(v)));
 assert.ok(Object.values(diagnostics.checks).every(v=>['PASS','FAIL','NOT_CHECKED'].includes(v)));
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
])test(`transport failure emits static unavailable diagnostics: ${label}`,async()=>{
 const {receipt,calls,versionReceipt}=await probeVersion({secret:'fixture-private-body'},options);
 assert.equal(receipt.status,'SCOPE_OR_RESPONSE_BLOCKED');assert.equal(calls.length,2);
 assert.equal(versionReceipt.status,code);assertFixedDiagnostics(versionReceipt.diagnostics);assert.equal(versionReceipt.diagnostics.checks.transport,'FAIL');assert.ok(Object.values(versionReceipt.diagnostics.fields).every(v=>v==='UNAVAILABLE'));assert.ok(Object.entries(versionReceipt.diagnostics.checks).every(([k,v])=>k==='transport'||v==='NOT_CHECKED'));assertNoAuthority(receipt);
 assert.ok(!JSON.stringify(receipt).includes('fixture-private'));
});

const paths=[
 `/accounts/${accountId}/workers/scripts/xpotato-site/deployments`,
 `/accounts/${accountId}/workers/scripts/xpotato-site/versions/${version}`,
 `/accounts/${accountId}/workers/scripts/xpotato-site/settings`,
 `/accounts/${accountId}/workers/scripts/xpotato-site/script-settings`,
 `/accounts/${accountId}/workers/scripts/xpotato-site/subdomain`,
 `/accounts/${accountId}/workers/scripts`,`/accounts/${accountId}/workers/domains`,
 `/accounts/${accountId}/workers/subdomain`,`/accounts/${accountId}/tokens/verify`
];
async function probeEndpoint(index,body,options={}){
 const calls=[];
 const receipt=await probeWorkerMetadata({accountId,credentialProvider,fetchImpl:async(url,request)=>{
  const position=calls.length;calls.push({url,request});
  if(position===index)return options.raw!==undefined?new Response(options.raw,{status:options.status||200,headers:{'Content-Type':'application/json'}}):Response.json(body,{status:options.status||200});
  return Response.json(envelope(fixture(new URL(url).pathname)));
 }});
 const endpointReceipt=receipt.receipts[index];
 assertNoAuthority(receipt);assertFixedDiagnostics(endpointReceipt.diagnostics,labels[index]);
 return {receipt,calls,endpointReceipt};
}
async function checkEndpoint(index,body,pass,check){
 const result=await probeEndpoint(index,body);
 assert.equal(result.receipt.status,pass?'REQUIRED_GET_ACCESSIBLE_NO_LIVE_ACCEPTANCE':'SCOPE_OR_RESPONSE_BLOCKED');
 assert.equal(result.calls.length,pass?9:index+1);
 if(check)assert.equal(result.endpointReceipt.diagnostics.checks[check],pass?'PASS':'FAIL');
 return result;
}
test('all nine diagnostics use fixed keys and exact fixed GET requests',async()=>{
 const {receipt,calls}=await probeEndpoint(8,envelope(fixture(paths[8])));
 assert.equal(calls.length,9);
 calls.forEach(({url,request},i)=>{
  const expected=new URL(paths[i],'https://api.cloudflare.com/client/v4');
  // An absolute pathname drops /client/v4; expected requests keep the fixed prefix.
  expected.pathname='/client/v4'+paths[i];
  if(i===0){expected.searchParams.set('page','1');expected.searchParams.set('per_page','100');}
  assert.equal(url,expected.href);assert.equal(request.method,'GET');assert.equal(request.redirect,'manual');assert.equal(request.body,undefined);
  assertFixedDiagnostics(receipt.receipts[i].diagnostics,labels[i]);
 });
});
for(const [index,label] of labels.entries()){
 for(const [name,make] of [
  ['null',()=>null],['array',()=>[]],['missing success',r=>({errors:[],result:r})],
  ['false success',r=>({success:false,errors:[],result:r})],['string success',r=>({success:'true',errors:[],result:r})],
  ['missing errors',r=>({success:true,result:r})],
  ['object errors',r=>({success:true,errors:{},result:r})],['provider error',r=>({success:true,errors:[{message:'private-marker'}],result:r})],
  ['missing result',()=>({success:true,errors:[]})],['null result',()=>envelope(null)],
  ['primitive result',()=>envelope(true)],['wrong result container',()=>envelope([5,6].includes(index)?{}:[])]
 ])test(`${label} rejects ${name} and stops`,async()=>{
  const {receipt}=await checkEndpoint(index,make(fixture(paths[index])),false);
  assert.ok(!JSON.stringify(receipt).includes('private-marker'));
 });
 for(const [name,options,code] of [['HTTP403',{status:403},'REMOTE_HTTP_403'],['invalidJSON',{raw:'private-marker'},'REMOTE_INVALID_JSON']])
 test(`${label} transport ${name} has unavailable diagnostics`,async()=>{
  const {receipt,calls,endpointReceipt}=await probeEndpoint(index,{private:'private-marker'},options);
  assert.equal(calls.length,index+1);assert.equal(endpointReceipt.status,code);
  assert.ok(Object.values(endpointReceipt.diagnostics.fields).every(v=>v==='UNAVAILABLE'));
  assert.ok(Object.entries(endpointReceipt.diagnostics.checks).every(([k,v])=>v===(k==='transport'?'FAIL':'NOT_CHECKED')));
  assert.ok(!JSON.stringify(receipt).includes('private-marker'));
 });
 test(`${label} suppresses malicious provider keys and values`,async()=>{
  const marker='private-marker:https://evil.invalid/token';
  const body={success:marker,errors:[{[marker]:marker}],result:{[marker]:marker,id:marker,subdomain:marker,bindings:{[marker]:marker}}};
  const {receipt}=await checkEndpoint(index,body,false);
  for(const value of [marker,accountId,version,'fixture-token-not-a-secret'])assert.ok(!JSON.stringify(receipt).includes(value));
 });
}
for(const [name,value,pass] of [['omitted',{},true],['empty',{bindings:[]},true],['list',{bindings:[{}]},true],['object',{bindings:{}},false],['null',{bindings:null},false],['boolean',{bindings:true},false],['number',{bindings:42},false],['badlist',{bindings:[null]},false]])
 test(`settings bindings ${name}`,()=>checkEndpoint(2,envelope(value),pass,'bindings'));
for(const [name,value,pass] of [
 ['omitted',{},true],['valid',{logpush:true,observability:{},tags:['x'],tail_consumers:[{}]},true],
 ['nullable',{observability:null,tags:null,tail_consumers:null},true],
 ['badlogpush',{logpush:null},false],['badobservability',{observability:[]},false],
 ['badtags',{tags:[42]},false],['badtail',{tail_consumers:[null]},false]
])test(`script settings optional fields ${name}`,()=>checkEndpoint(3,envelope(value),pass,'optionalFields'));
const domain={id:'fixture-domain',service:'xpotato-site',hostname:'xpotato.net',environment:'production'};
for(const [name,value,pass,check] of [
 ['empty',[],true,'items'],['row',[domain],true,'identity'],['wrapper',{domains:[domain]},false,'result'],
 ['primitive row',[42],false,'items'],['missing id',[{...domain,id:undefined}],false,'identity'],
 ['duplicate',[domain,domain],false,'identity'],['foreign service',[{...domain,service:'other'}],true,'service'],
 ['bad hostname',[{...domain,hostname:null}],false,'domainFields'],['bad environment',[{...domain,environment:42}],false,'domainFields']
])test(`domains response ${name}`,()=>checkEndpoint(6,envelope(value),pass,check));
for(const [name,value] of [['empty',[]],['duplicate',[{id:'xpotato-site',tag:'b'.repeat(32)},{id:'xpotato-site',tag:null}]],['tag',[{id:'xpotato-site',tag:42}]],['bad row',[null]]])
 test(`worker identity rejects ${name}`,()=>checkEndpoint(5,envelope(value),false));
for(const index of [0,5,6]){
 const rows=index===6?[]:index===0?fixture(paths[0]).deployments:fixture(paths[5]),result=index===6?rows:fixture(paths[index]);
 for(const [name,info,pass] of [
  ['absent',undefined,true],['partial',{count:rows.length},true],
  ['consistent',{page:1,per_page:100,count:rows.length,total_count:rows.length,total_pages:1},true],
  ['null',null,false],['boolean',false,false],['array',[],false],['string','private-marker',false],
  ['bad count',{count:'1'},false],['negative',{total_count:-1},false],['page two',{page:2},false],
  ['contradictory count',{count:rows.length+1},false],
  ['contradictory pages',{per_page:100,total_count:rows.length,total_pages:2},false],
  ...(index===0?[['wrong requested size',{per_page:50},false]]:[['partial inventory',{total_count:rows.length+1},false],['more pages',{total_pages:2},false]])
 ])test(`${labels[index]} pagination ${name}`,()=>{
  const body=envelope(result);if(info!==undefined)body.result_info=info;
  return checkEndpoint(index,body,pass,'pagination');
 });
}
for(const value of ['a','a-b','a'.repeat(63)])test(`DNS label accepts length ${value.length}`,()=>checkEndpoint(7,envelope({subdomain:value}),true,'dnsLabel'));
for(const [name,value] of [['empty',''],['leading hyphen','-a'],['trailing hyphen','a-'],['long','a'.repeat(64)],['uppercase','A'],['dot','a.b'],['slash','a/b'],['percent','a%20'],['space','a b'],['number',42],['null',null],['bool',true]])
 test(`DNS label rejects ${name}`,()=>checkEndpoint(7,envelope({subdomain:value}),false,'dnsLabel'));
for(const status of ['disabled','expired'])test(`token recognized ${status} remains inactive`,async()=>{
 const {endpointReceipt}=await checkEndpoint(8,envelope({id:'c'.repeat(32),status}),false,'active');
 assert.equal(endpointReceipt.diagnostics.checks.identity,'PASS');assert.equal(endpointReceipt.diagnostics.checks.tokenStatus,'PASS');
});
for(const [name,value,check] of [
 ['missingid',{status:'active'},'identity'],['numericid',{id:42,status:'active'},'identity'],
 ['unknownstatus',{id:'c'.repeat(32),status:'other'},'tokenStatus'],
 ['missingstatus',{id:'c'.repeat(32)},'tokenStatus'],
 ['nulltime',{id:'c'.repeat(32),status:'active',expires_on:null},'optionalFields'],
 ['badtime',{id:'c'.repeat(32),status:'active',not_before:'private-marker'},'optionalFields']
])test(`token rejects ${name}`,()=>checkEndpoint(8,envelope(value),false,check));
test('token optional timestamps have valid string shape',()=>checkEndpoint(8,envelope({id:'c'.repeat(32),status:'active',expires_on:'2027-01-01T00:00:00Z',not_before:'2026-01-01T00:00:00Z'}),true,'optionalFields'));

for(const [name,rows] of [
 ['mixed',[domain,{...domain,id:'other-id',service:'other-worker',hostname:'other.example.invalid'}]],
 ['reassigned',[{...domain,service:'other-worker'}]],['empty',[]]
])test(`unfiltered domains ${name} prove readability only`,async()=>{
 const {receipt,calls}=await checkEndpoint(6,{...envelope(rows),result_info:{page:1,per_page:100,count:rows.length,total_count:rows.length,total_pages:1}},true);
 assert.equal(new URL(calls[6].url).search,'');assertNoAuthority(receipt);
});
for(const [name,rows,info] of [
 ['site count',[domain,{...domain,id:'other-id',service:'other-worker',hostname:'other.example.invalid'}],{count:1,total_count:2}],
 ['site total',[domain,{...domain,id:'other-id',service:'other-worker',hostname:'other.example.invalid'}],{count:2,total_count:1}],
 ['hidden row',[domain],{count:1,total_count:2}]
])test(`unfiltered domains reject contradictory ${name}`,()=>checkEndpoint(6,{...envelope(rows),result_info:info},false,'pagination'));
test('unfiltered domains require nonempty string service shape, not site ownership',()=>checkEndpoint(6,envelope([{...domain,service:null}]),false,'service'));

for(const [index,label] of labels.entries()){
 test(`${label} explicit null errors compatibility is scoped to domains`,async()=>{
  const marker='private-null-envelope-marker',body={success:true,errors:null,result:fixture(paths[index]),[marker]:marker};
  const pass=index===6,{receipt,endpointReceipt}=await checkEndpoint(index,body,pass,'errors');
  assert.equal(endpointReceipt.diagnostics.fields.errors,'NULL');assert.equal(endpointReceipt.diagnostics.checks.errors,pass?'PASS':'FAIL');assert.equal(endpointReceipt.diagnostics.checks.envelope,pass?'PASS':'FAIL');
  assert.ok(!JSON.stringify(receipt).includes(marker));
 });
 for(const [name,success] of [['missing',undefined],['false',false],['string','true'],['number',1],['null',null]])
 test(`${label} null errors cannot override ${name} success`,async()=>{
  const {endpointReceipt}=await checkEndpoint(index,{success,errors:null,result:fixture(paths[index])},false,'envelope');
  assert.equal(endpointReceipt.diagnostics.checks.errors,'FAIL');
 });
 for(const [name,errors] of [['missing',undefined],['string','private-error-marker'],['number',0],['false',false],['true',true],['object',{}],['nonempty null list',[null]],['nonempty string list',['private-error-marker']]])
 test(`${label} rejects unsupported errors marker ${name}`,async()=>{
  const {receipt}=await checkEndpoint(index,{success:true,errors,result:fixture(paths[index])},false,'errors');
  assert.ok(!JSON.stringify(receipt).includes('private-error-marker'));
 });
 for(const [name,result] of [['missing',undefined],['null',null],['primitive',true],['wrong container',[5,6].includes(index)?{}:[]]])
 test(`${label} null errors do not bypass ${name} result`,()=>checkEndpoint(index,{success:true,errors:null,result},false,'result'));
}
test('observed safe envelope field types with synthetic values prove readability only',async()=>{
 const calls=[],marker='private-observed-shape-marker';
 const receipt=await probeWorkerMetadata({accountId,credentialProvider,fetchImpl:async(url,options)=>{
  calls.push({url,options});const path=new URL(url).pathname;
  let result=fixture(path);
  if(path.includes('/versions/'))result={id:version,resources:{bindings:[]}};
  if(path.endsWith('/script-settings'))result={logpush:false,observability:null,tags:null,tail_consumers:null};
  const isDomain=path.endsWith('/domains');
  const body={success:true,errors:isDomain?null:[],result:isDomain?[{id:'synthetic-domain',service:'xpotato-site',hostname:'xpotato.net',environment:'production'}]:result,[marker]:marker};
  if(path.endsWith('/deployments')||isDomain)body.result_info={page:1,per_page:100,count:1,total_count:1,...(!isDomain?{total_pages:1}:{})};
  return Response.json(body);
 }});
 assert.equal(receipt.status,'REQUIRED_GET_ACCESSIBLE_NO_LIVE_ACCEPTANCE');assert.equal(calls.length,9);assertNoAuthority(receipt);
 const domainReceipt=receipt.receipts[6];assertFixedDiagnostics(domainReceipt.diagnostics,labels[6]);
 assert.equal(domainReceipt.diagnostics.fields.errors,'NULL');assert.equal(domainReceipt.diagnostics.fields.total_pages,'MISSING');
 assert.ok(Object.values(domainReceipt.diagnostics.checks).every(v=>v==='PASS'));
 assert.equal(new URL(calls[6].url).search,'');
 for(const value of [marker,accountId,version,'synthetic-domain','xpotato.net','existing-account','fixture-token-not-a-secret'])assert.ok(!JSON.stringify(receipt).includes(value));
});
for(const [index,result,check] of [
 [0,{deployments:[{id:version,strategy:'percentage',versions:[{version_id:'../../private-path',percentage:100}]}]},'identity'],
 [1,{id:'66666666-7777-8888-9999-000000000000',resources:{bindings:[]}},'identity'],
 [2,{bindings:true},'bindings'],[3,{logpush:'private-marker'},'optionalFields'],
 [4,{enabled:'false',previews_enabled:false},'flags'],
 [5,[{id:'xpotato-site',tag:'private-marker'}],'identity'],
 [6,[{id:'synthetic-domain',service:true,hostname:'xpotato.net',environment:'production'}],'service'],
 [7,{subdomain:'private.invalid'},'dnsLabel'],[8,{id:'c'.repeat(32),status:'disabled'},'active']
])test(`${labels[index]} null errors preserve security/identity check ${check}`,async()=>{
 const {receipt}=await checkEndpoint(index,{success:true,errors:null,result},false,check);
 for(const marker of ['private-marker','private-path','private.invalid'])assert.ok(!JSON.stringify(receipt).includes(marker));
});
test('successful null-errors body cannot override HTTP failure',async()=>{
 const {receipt,calls,endpointReceipt}=await probeEndpoint(6,{success:true,errors:null,result:[]},{status:403});
 assert.equal(calls.length,7);assert.equal(endpointReceipt.status,'REMOTE_HTTP_403');
 assert.ok(Object.values(endpointReceipt.diagnostics.fields).every(v=>v==='UNAVAILABLE'));assertNoAuthority(receipt);
});
