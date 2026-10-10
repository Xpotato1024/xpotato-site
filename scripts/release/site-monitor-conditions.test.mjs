import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {probeMonitorConditions} from './site-monitor-conditions.mjs';
import {fingerprint} from './site-integrity-monitor.mjs';

const now=Date.parse('2026-10-09T00:00:00Z'),secret='fixture-private-token-value';
const home='<html>fixture-approved-public-home</html>',hash=v=>createHash('sha256').update(v).digest('hex');
const account='a'.repeat(32),tag='b'.repeat(32),credential='c'.repeat(32),zone='d'.repeat(32);
const deployment='11111111-1111-1111-1111-111111111111',version='22222222-2222-2222-2222-222222222222';
const settings={bindings:[]},scriptSettings={logpush:false,observability:null},resources={bindings:[]};
const baseExpected=()=>({schemaVersion:2,selection:{runId:'123',runAttempt:1,artifactId:'456',sourceSha:'e'.repeat(40),digest:'sha256:'+'f'.repeat(64)},accountId:account,credentialId:credential,workerTag:tag,deploymentId:deployment,versionId:version,accountSubdomainSha256:fingerprint({subdomain:'fixture-account'}),zoneId:zone,settingsSha256:fingerprint(settings),scriptSettingsSha256:fingerprint(scriptSettings),versionResourcesSha256:fingerprint(resources),homeSha256:hash(home)});
const envelope=result=>({success:true,errors:[],result});
const domain={id:'fixture-domain',service:'xpotato-site',hostname:'xpotato.net',environment:'production'};
const inventory=rows=>({...envelope(rows),result_info:{page:1,per_page:100,count:rows.length,total_count:rows.length}});
const deploymentRow=(index=0)=>({id:index===0?deployment:index.toString(16).padStart(8,'0')+'-aaaa-aaaa-aaaa-aaaaaaaaaaaa',strategy:'percentage',versions:[{version_id:version,percentage:100}]});
const checkKeys=['configuration','boundedOperation','transport','tokenIdentity','tokenActive','tokenTimes','workerIdentity','deploymentInventory','deploymentIdentity','versionIdentity','settingsBindingsEmpty','versionBindingsEmpty','settingsFingerprint','scriptSettingsFingerprint','versionResourcesFingerprint','endpointFlagsSuppressed','domainInventory','domainOwnership','routeInventory','routesObservedAbsent','accountSubdomain','homeHttp','homeBytes','workersDev404','versionPreview404','alternateNoHomeBytes','snapshotStable'];
function safe(r){
 assert.deepEqual(Object.keys(r),['status','checks','transportCode','coverage','warnings','deployAllowed','acceptance','providerMutations','baselineUpdated','monitorActivated','routeScopeIndependentlyVerified']);
 assert.ok(['CONDITIONS_MATCH_NO_LIVE_ACCEPTANCE','CONDITIONS_BLOCKED'].includes(r.status));
 assert.deepEqual(Object.keys(r.checks),checkKeys);assert.ok(Object.values(r.checks).every(v=>['PASS','FAIL','NOT_CHECKED'].includes(v)));
 for(const k of ['deployAllowed','acceptance','baselineUpdated','monitorActivated','routeScopeIndependentlyVerified'])assert.equal(r[k],false);
 assert.equal(r.providerMutations,0);
 for(const s of [secret,account,tag,credential,zone,deployment,version,'fixture-domain','xpotato.net','fixture-account','evil.invalid','private-marker',baseExpected().homeSha256])assert.ok(!JSON.stringify(r).includes(s));
}
function responseBody(url,{rows=[deploymentRow()],versionResources=resources}={}){
 const path=url.pathname;
 if(path.endsWith('/tokens/verify'))return envelope({id:credential,status:'active'});
 if(path.endsWith('/workers/scripts'))return envelope([{id:'xpotato-site',tag}]);
 if(path.endsWith('/deployments')){const page=Number(url.searchParams.get('page')),slice=rows.slice((page-1)*100,page*100);return {...envelope({deployments:slice}),result_info:{page,per_page:100,count:slice.length,total_count:rows.length,total_pages:Math.max(1,Math.ceil(rows.length/100))}}}
 if(path.endsWith('/versions/'+version))return envelope({id:version,resources:versionResources});
 if(path.endsWith('/script-settings'))return envelope(scriptSettings);
 if(path.endsWith('/settings'))return envelope(settings);
 if(path.endsWith('/scripts/xpotato-site/subdomain'))return envelope({enabled:false,previews_enabled:false});
 if(path.endsWith('/workers/domains'))return inventory([domain]);
 if(path.endsWith('/workers/subdomain'))return envelope({subdomain:'fixture-account'});
 if(path.endsWith('/workers/routes'))return envelope([]);
 throw Error('UNEXPECTED_MOCK_PATH');
}
async function run({expected=baseExpected(),override={},rows,mutate,respond}={}){
 const calls=[],hits=new Map();let lookups=0;
 const config={expected,clock:()=>now,credentialProvider:async()=>{lookups++;return secret},fetchImpl:async(input,options)=>{
  const url=new URL(input),key=url.pathname,hit=(hits.get(key)||0)+1;hits.set(key,hit);calls.push({url,options,hit});
  if(respond){const custom=await respond(url,options,hit,calls.length);if(custom)return custom}
  if(url.hostname==='api.cloudflare.com'){const body=structuredClone(responseBody(url,{rows}));mutate?.(key,body,hit,url);return Response.json(body)}
  return new Response(url.hostname==='xpotato.net'?home:'fixture-not-found',{status:url.hostname==='xpotato.net'?200:404});
 },...override};
 const result=await probeMonitorConditions(config);safe(result);return {result,calls,lookups};
}
async function block(mutate,check){const r=await run({mutate});assert.equal(r.result.status,'CONDITIONS_BLOCKED');assert.equal(r.result.checks[check],'FAIL');return r}
test('bounded metadata/public read, one frozen credential, safe labels and no authority',async()=>{
 const r=await run();assert.equal(r.result.status,'CONDITIONS_MATCH_NO_LIVE_ACCEPTANCE');assert.ok(Object.values(r.result.checks).every(v=>v==='PASS'));
 assert.equal(r.lookups,1);assert.equal(r.calls.length,21);assert.equal(r.calls.filter(c=>c.url.hostname==='api.cloudflare.com').length,18);
 for(const {url,options} of r.calls){assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');assert.equal(options.body,undefined);assert.ok(options.signal instanceof AbortSignal);
  if(url.hostname==='api.cloudflare.com'){assert.equal(options.headers.Authorization,'Bearer '+secret);if(url.pathname.endsWith('/deployments'))assert.equal(url.search,'?page=1&per_page=100');else assert.equal(url.search,'')}
  else{assert.equal(options.headers.Authorization,undefined);assert.equal(options.credentials,'omit');assert.equal(options.headers['Accept-Encoding'],'identity')}
 }
 assert.deepEqual(r.calls.filter(c=>c.url.hostname!=='api.cloudflare.com').map(c=>c.url.href),['https://xpotato.net/','https://xpotato-site.fixture-account.workers.dev/','https://22222222-xpotato-site.fixture-account.workers.dev/']);
});
test('independent comparison preserves empty and explicit placement without adopting a baseline',async()=>{
 for(const placement of [{},{mode:'smart'}]){
  const value={bindings:[],placement},expected=baseExpected();expected.settingsSha256=fingerprint(value);
  const r=await run({expected,mutate:(path,b)=>{if(path.endsWith('/settings'))b.result=structuredClone(value)}});
  assert.equal(r.result.status,'CONDITIONS_MATCH_NO_LIVE_ACCEPTANCE');assert.equal(r.calls.length,21);assert.ok(Object.values(r.result.checks).every(v=>v==='PASS'));
 }
});
test('opaque runtime matches only the original expected hash; later changes fail closed',async()=>{
 const value={bindings:[],script:{handlers:null,etag:secret},script_runtime:{compatibility_date:'2026-08-26',usage_model:'standard',[secret]:{nested:[null,true,secret]}}},expected=baseExpected();expected.versionResourcesSha256=fingerprint(value);
 const observe=change=>run({expected,mutate:(path,b)=>{if(path.endsWith('/versions/'+version)){b.result.resources=structuredClone(value);b.result.metadata={author_id:secret,[secret]:true};b.result.annotations={[secret]:secret};change?.(b.result)}}});
 const matched=await observe();assert.equal(matched.result.status,'CONDITIONS_MATCH_NO_LIVE_ACCEPTANCE');assert.equal(matched.calls.length,21);assert.ok(matched.result.warnings.includes('OPAQUE_RUNTIME_SEMANTICS'));assert.ok(matched.result.warnings.includes('VERSION_METADATA_OUTSIDE_HASH'));assert.equal(matched.result.coverage.unknownSemantics,'NOT_PROVEN');
 for(const change of [v=>v.resources.script_runtime[secret].nested.push(false),v=>delete v.resources.script.handlers,v=>v.resources.script.handlers=[]]){
  const changed=await observe(change);assert.equal(changed.result.status,'CONDITIONS_BLOCKED');assert.equal(changed.result.checks.versionResourcesFingerprint,'FAIL');assert.equal(changed.calls.length,4);
 }
});
test('empty etag comparison binds exact version and original resources; absent and nonempty drift stop',async()=>{
 const value={bindings:[],script:{etag:'',handlers:null,last_deployed_from:secret},script_runtime:{compatibility_date:'2026-08-26',usage_model:'standard',[secret]:{opaque:[null,true]}}},expected=baseExpected();expected.versionResourcesSha256=fingerprint(value);
 const observe=change=>run({expected,mutate:(path,b)=>{if(path.endsWith('/versions/'+version)){b.result.resources=structuredClone(value);change?.(b.result)}}});
 const matched=await observe();assert.equal(matched.result.status,'CONDITIONS_MATCH_NO_LIVE_ACCEPTANCE');assert.equal(matched.calls.length,21);
 for(const change of [v=>delete v.resources.script.etag,v=>v.resources.script.etag=secret,v=>v.resources.script_runtime[secret].opaque.push(false)]){
  const changed=await observe(change);assert.equal(changed.result.status,'CONDITIONS_BLOCKED');assert.equal(changed.result.checks.versionResourcesFingerprint,'FAIL');assert.equal(changed.calls.length,4);
 }
 const wrongVersion=await observe(v=>v.id='33333333-3333-3333-3333-333333333333');assert.equal(wrongVersion.result.checks.versionIdentity,'FAIL');assert.equal(wrongVersion.calls.length,4);
});
for(const [name,change] of [['binding',v=>v.bindings=[{name:secret}]],['handler',v=>v.script={handlers:[secret]}],['container',v=>v.script_runtime={containers:[{image:secret}]}],['date',v=>v.script_runtime={compatibility_date:'2026-01-01'}],['flag',v=>v.script_runtime={compatibility_flags:[secret]}],['export',v=>v.script_runtime={exports:{[secret]:secret}}]])test('matching expected hash cannot bypass known critical version setting '+name,async()=>{
 const value=structuredClone(resources);change(value);const expected=baseExpected();expected.versionResourcesSha256=fingerprint(value);
 const r=await run({expected,mutate:(path,b)=>{if(path.endsWith('/versions/'+version))b.result.resources=structuredClone(value)}});assert.equal(r.result.status,'CONDITIONS_BLOCKED');assert.equal(r.calls.length,4);assert.equal(r.result.checks[name==='binding'?'versionBindingsEmpty':'versionResourcesFingerprint'],'FAIL');
});
for(const [response,code] of [[()=>Response.json({message:secret},{status:403}),'REMOTE_HTTP_403'],[()=>new Response(secret,{headers:{'content-type':'application/json'}}),'REMOTE_INVALID_JSON'],[()=>{throw Error(secret)},'REMOTE_REQUEST_FAILED']])test('conditions transport failure remains visible without provider content '+code,async()=>{
 const r=await run({respond:response});assert.equal(r.result.status,'CONDITIONS_BLOCKED');assert.equal(r.result.transportCode,code);assert.equal(r.result.checks.transport,'FAIL');assert.equal(r.calls.length,1);
});
for(const [name,value] of [['omitted',{bindings:[]}],['explicit mode',{bindings:[],placement:{mode:'smart'}}],['unknown field',{bindings:[],placement:{extra:secret}}],['null',{bindings:[],placement:null}],['nonempty missing mode',{bindings:[],placement:{status:'SUCCESS'}}]])for(const at of [1,2])test('empty placement fingerprint stops on '+name+' at settings read '+at,async()=>{
 const initial={bindings:[],placement:{}},expected=baseExpected();expected.settingsSha256=fingerprint(initial);
 const r=await run({expected,mutate:(path,b,hit)=>{if(path.endsWith('/settings'))b.result=structuredClone(hit===at?value:initial)}});
 assert.equal(r.result.status,'CONDITIONS_BLOCKED');assert.equal(r.result.checks.settingsFingerprint,'FAIL');assert.equal(r.calls.length,at===1?5:15);
});
for(const count of [101,800])test('complete multi-page inventories at both reads: '+count,async()=>{
 const r=await run({rows:Array.from({length:count},(_,i)=>deploymentRow(i))});
 assert.equal(r.result.status,'CONDITIONS_MATCH_NO_LIVE_ACCEPTANCE');assert.equal(r.lookups,1);
 const provider=r.calls.filter(c=>c.url.hostname==='api.cloudflare.com');assert.equal(provider.length,16+2*Math.ceil(count/100));assert.ok(provider.length<=32);
});
test('inventory larger than page/request budget stops at first response',async()=>{
 const r=await run({rows:Array.from({length:801},(_,i)=>deploymentRow(i))});assert.equal(r.result.checks.deploymentInventory,'FAIL');assert.equal(r.calls.length,3);
});
for(const key of ['accountId','credentialId','workerTag','zoneId','deploymentId','versionId','accountSubdomainSha256','settingsSha256','scriptSettingsSha256','versionResourcesSha256','homeSha256'])
 for(const value of [undefined,null,42,'','https://evil.invalid/private-marker'])
 test('bad independent expected '+key+' before credential/I/O '+String(value),async()=>{
  const e=baseExpected();e[key]=value;const r=await run({expected:e});assert.equal(r.result.checks.configuration,'FAIL');assert.equal(r.lookups,0);assert.equal(r.calls.length,0);
 });
for(const make of [e=>e.extra=secret,e=>e.schemaVersion=1,e=>delete e.selection,e=>e.selection.runAttempt=0,e=>e.selection.digest='bad',e=>e.selection.extra=secret,e=>e.accountSubdomainSha256='bad.label',e=>e.accountSubdomainSha256='A',e=>e.accountSubdomain='a'.repeat(64)])
 test('invalid expected schema cannot become baseline or authority',async()=>{const e=baseExpected();make(e);const r=await run({expected:e});assert.equal(r.lookups,0);assert.equal(r.calls.length,0)});
for(const key of ['credentialProvider','fetchImpl','clock','signal'])test('invalid dependency '+key,async()=>{const r=await run({override:{[key]:null}});assert.equal(r.calls.length,0);assert.equal(r.result.checks.configuration,'FAIL')});
for(const [suffix,make,check] of [
 ['/tokens/verify',b=>b.result.id='f'.repeat(32),'tokenIdentity'],
 ['/tokens/verify',b=>b.result.status='disabled','tokenActive'],
 ['/tokens/verify',b=>b.result.expires_on=new Date(now).toISOString(),'tokenTimes'],
 ['/tokens/verify',b=>b.result.not_before=new Date(now+1).toISOString(),'tokenTimes'],
 ['/tokens/verify',b=>b.result.expires_on=null,'tokenTimes'],
 ['/workers/scripts',b=>b.result[0].tag='f'.repeat(32),'workerIdentity'],
 ['/workers/scripts',b=>b.result.push({id:'other',tag}),'workerIdentity'],
 ['/deployments',b=>b.result.deployments[0].id='33333333-3333-3333-3333-333333333333','deploymentIdentity'],
 ['/deployments',b=>b.result.deployments[0].versions[0].percentage=99,'deploymentIdentity'],
 ['/deployments',b=>b.result.deployments[0].versions.push({version_id:version,percentage:1}),'deploymentIdentity'],
 ['/versions/'+version,b=>b.result.id='33333333-3333-3333-3333-333333333333','versionIdentity'],
 ['/settings',b=>delete b.result.bindings,'settingsBindingsEmpty'],
 ['/settings',b=>b.result.bindings=null,'settingsBindingsEmpty'],
 ['/settings',b=>b.result.bindings=[{type:'plain_text',text:secret}],'settingsBindingsEmpty'],
 ['/settings',b=>b.result.bindings={},'settingsBindingsEmpty'],
 ['/settings',b=>b.result.extra=secret,'settingsFingerprint'],
 ['/script-settings',b=>b.result.logpush=true,'scriptSettingsFingerprint'],
 ['/versions/'+version,b=>delete b.result.resources.bindings,'versionBindingsEmpty'],
 ['/versions/'+version,b=>b.result.resources.bindings=null,'versionBindingsEmpty'],
 ['/versions/'+version,b=>b.result.resources.bindings=[{type:'secret_text',name:secret}],'versionBindingsEmpty'],
 ['/versions/'+version,b=>b.result.resources.extra=secret,'versionResourcesFingerprint'],
 ['/scripts/xpotato-site/subdomain',b=>b.result.enabled=true,'endpointFlagsSuppressed'],
 ['/scripts/xpotato-site/subdomain',b=>b.result.previews_enabled=true,'endpointFlagsSuppressed'],
 ['/workers/domains',b=>delete b.result_info,'domainInventory'],
 ['/workers/domains',b=>b.result_info.total_count=2,'domainInventory'],
 ['/workers/domains',b=>b.result[0].service='other','domainOwnership'],
 ['/workers/domains',b=>b.result[0].environment='staging','domainOwnership'],
 ['/workers/routes',b=>b.result.push({id:'f'.repeat(32),pattern:'xpotato.net/*',script:'xpotato-site'}),'routesObservedAbsent'],
 ['/workers/routes',b=>b.result.push({id:'f'.repeat(32),pattern:'other.example/*',script:null}),'routeInventory'],
 ['/workers/routes',b=>b.result_info={page:1,per_page:100,count:0,total_count:1},'routeInventory'],
 ['/workers/subdomain',b=>b.result.subdomain='other-account','accountSubdomain']
])test('strong condition rejection '+suffix+' '+check+' '+String(make),()=>block((path,b)=>{if(path.endsWith(suffix))make(b)},check));
for(const make of [b=>delete b.result_info,b=>b.result_info.page=2,b=>b.result_info.per_page=99,b=>b.result_info.count=2,b=>b.result_info.total_count=null,b=>b.result_info.total_pages=2,b=>b.result.deployments=[],b=>b.result.deployments.push({...b.result.deployments[0]})])
 test('partial/malformed deployments never claim complete',()=>block((p,b)=>{if(p.endsWith('/deployments'))make(b)},'deploymentInventory'));
test('pagination total changes and duplicate across pages stop without next request',async()=>{
 for(const duplicate of [false,true]){const r=await run({rows:Array.from({length:101},(_,i)=>deploymentRow(i)),mutate:(p,b,h,u)=>{if(p.endsWith('/deployments')&&u.searchParams.get('page')==='2'){if(duplicate)b.result.deployments[0].id=deployment;else b.result_info.total_count=102}}});assert.equal(r.result.checks.deploymentInventory,'FAIL');assert.equal(r.calls.length,4)}
});
test('optional pages missing is not invented; full count still required',async()=>{
 const r=await run({mutate:(p,b)=>{if(p.endsWith('/deployments'))delete b.result_info.total_pages}});assert.equal(r.result.status,'CONDITIONS_MATCH_NO_LIVE_ACCEPTANCE');
});
test('empty object version bindings is supported with independently matching hash',async()=>{
 const e=baseExpected();e.versionResourcesSha256=fingerprint({bindings:{}});
 const r=await run({expected:e,mutate:(p,b)=>{if(p.endsWith('/versions/'+version))b.result.resources.bindings={}}});assert.equal(r.result.status,'CONDITIONS_MATCH_NO_LIVE_ACCEPTANCE');
});
test('documented unfiltered routes accepts omitted optional script and absent pagination, without global scope claim',async()=>{
 const r=await run({mutate:(p,b)=>{if(p.endsWith('/workers/routes'))b.result=[{id:'f'.repeat(32),pattern:'other.example/*'}]}});
 assert.equal(r.result.status,'CONDITIONS_MATCH_NO_LIVE_ACCEPTANCE');assert.equal(r.result.routeScopeIndependentlyVerified,false);
});
test('unrelated Worker/domain/route changes do not falsely become site drift',async()=>{
 const r=await run({mutate:(p,b,h)=>{
  if(p.endsWith('/workers/scripts'))b.result.push({id:'other-'+h,tag:'f'.repeat(32)});
  if(p.endsWith('/workers/domains')){b.result.push({...domain,id:'other-'+h,service:'other',hostname:'other-'+h+'.example'});b.result_info.count=2;b.result_info.total_count=2}
  if(p.endsWith('/workers/routes'))b.result.push({id:(h===1?'e':'f').repeat(32),pattern:'other.example/*',script:'other-'+h});
 }});assert.equal(r.result.status,'CONDITIONS_MATCH_NO_LIVE_ACCEPTANCE');
});
for(const [suffix,make,check] of [
 ['/tokens/verify',b=>b.result.status='expired','tokenActive'],
 ['/workers/scripts',b=>b.result[0].tag='f'.repeat(32),'workerIdentity'],
 ['/deployments',b=>b.result.deployments[0].versions[0].percentage=99,'snapshotStable'],
 ['/settings',b=>b.result.extra=secret,'settingsFingerprint'],
 ['/script-settings',b=>b.result.logpush=true,'scriptSettingsFingerprint'],
 ['/scripts/xpotato-site/subdomain',b=>b.result.enabled=true,'endpointFlagsSuppressed'],
 ['/workers/domains',b=>b.result[0].service='other','domainOwnership'],
 ['/workers/routes',b=>b.result.push({id:'f'.repeat(32),pattern:'xpotato.net/*',script:'xpotato-site'}),'routesObservedAbsent']
])test('terminal '+suffix+' drift cannot be cleared by prior success',async()=>{
 const r=await run({mutate:(p,b,h)=>{if(p.endsWith(suffix)&&h===2)make(b)}});
 assert.equal(r.result.status,'CONDITIONS_BLOCKED');assert.equal(r.result.checks[check],'FAIL');
});
for(const [name,fn] of [
 ['home mismatch',u=>u.hostname==='xpotato.net'?new Response('private-marker',{status:200}):undefined],
 ['home redirect',u=>u.hostname==='xpotato.net'?new Response('',{status:302,headers:{Location:'https://evil.invalid/'}}):undefined],
 ['alternate200',u=>u.hostname.endsWith('workers.dev')?new Response(home,{status:200}):undefined],
 ['alternate404 home bytes',u=>u.hostname.endsWith('workers.dev')?new Response(home,{status:404}):undefined],
 ['public oversize',u=>u.hostname==='xpotato.net'?new Response('x'.repeat(1048577),{status:200}):undefined],
 ['API403',u=>u.hostname==='api.cloudflare.com'?Response.json({message:secret},{status:403}):undefined],
 ['APIredirect',u=>u.hostname==='api.cloudflare.com'?new Response('',{status:302}):undefined],
 ['API malformed',u=>u.hostname==='api.cloudflare.com'?new Response(secret,{headers:{'content-type':'application/json'}}):undefined],
 ['API oversize',u=>u.hostname==='api.cloudflare.com'?new Response('x'.repeat(1048577),{headers:{'content-type':'application/json'}}):undefined]
])test('transport/public '+name+' fixed failure and no retries',async()=>{
 const r=await run({respond:fn});assert.equal(r.result.status,'CONDITIONS_BLOCKED');
 assert.ok(r.calls.length<=13);assert.ok(r.calls.filter(c=>c.url.hostname==='xpotato.net').length<=1);
});
test('provider keys/errors never become output or navigation',async()=>{
 const r=await run({mutate:(p,b)=>{b['private-marker']=secret;b.url='https://evil.invalid/'}});
 assert.equal(r.result.status,'CONDITIONS_MATCH_NO_LIVE_ACCEPTANCE');assert.ok(r.result.warnings.includes('ENVELOPE_METADATA_ADVISORY'));assert.ok(r.calls.every(c=>!c.url.href.includes('evil.invalid')));
});
test('cancel and clock deadline stop before credentials or further GET',async()=>{
 const c=new AbortController();c.abort();let r=await run({override:{signal:c.signal}});assert.equal(r.calls.length,0);assert.equal(r.lookups,0);
 let ticks=0;r=await run({override:{clock:()=>ticks++===0?now:now+120000}});assert.equal(r.calls.length,0);
 const c2=new AbortController();r=await run({override:{signal:c2.signal},respond:()=>{c2.abort()}});assert.equal(r.calls.length,1);assert.equal(r.result.status,'CONDITIONS_BLOCKED');
});
test('expected object is cloned before asynchronous credential lookup',async()=>{
 const e=baseExpected();const r=await run({expected:e,override:{credentialProvider:async()=>{e.versionId='33333333-3333-3333-3333-333333333333';e.homeSha256='f'.repeat(64);return secret}}});
 assert.equal(r.result.status,'CONDITIONS_MATCH_NO_LIVE_ACCEPTANCE');
});
test('one frozen credential survives caller environment change',async()=>{
 let value=secret;const r=await run({override:{credentialProvider:async()=>value},respond:(u,o)=>{if(u.hostname==='api.cloudflare.com'){assert.equal(o.headers.Authorization,'Bearer '+secret);value='changed-fixture-token'}}});assert.equal(r.result.status,'CONDITIONS_MATCH_NO_LIVE_ACCEPTANCE');assert.equal(r.lookups,0);
});

const cli=fileURLToPath(new URL('./site-monitor-conditions-cli.mjs',import.meta.url));
function cliRun({env={},event,raw,args=[]}={}){
 const root=mkdtempSync(join(tmpdir(),'monitor-conditions-test-')),eventPath=join(root,'event.json'),hitPath=join(root,'hits'),hookPath=join(root,'hook.mjs');
 const e=baseExpected(),mock={};
 for(const path of ['tokens/verify','workers/scripts','workers/scripts/xpotato-site/deployments?page=1&per_page=100','workers/scripts/xpotato-site/versions/'+version,'workers/scripts/xpotato-site/settings','workers/scripts/xpotato-site/script-settings','workers/scripts/xpotato-site/subdomain','workers/domains','workers/subdomain']){
  const url='https://api.cloudflare.com/client/v4/accounts/'+account+'/'+path;mock[url]=responseBody(new URL(url));
 }
 mock['https://api.cloudflare.com/client/v4/zones/'+zone+'/workers/routes']=envelope([]);
 const input=event===undefined?{inputs:{mode:'readonly-monitor-conditions',expected_conditions:JSON.stringify(e)}}:event;
 writeFileSync(eventPath,raw??JSON.stringify(input));
 writeFileSync(hookPath,`import {writeFileSync} from 'node:fs';const mock=${JSON.stringify(mock)};let count=0;process.on('exit',()=>writeFileSync(${JSON.stringify(hitPath)},String(count)));globalThis.fetch=async(url,options)=>{count++;if(options.method!=='GET'||options.redirect!=='manual')throw Error('private-marker');if(String(url).startsWith('https://api.cloudflare.com/')){if(options.headers.Authorization!==${JSON.stringify('Bearer '+secret)}||!Object.hasOwn(mock,String(url)))throw Error('private-marker');return Response.json(mock[String(url)])}if(String(url)==='https://xpotato.net/')return new Response(${JSON.stringify(home)},{status:200});if(['https://xpotato-site.fixture-account.workers.dev/','https://22222222-xpotato-site.fixture-account.workers.dev/'].includes(String(url)))return new Response('not-found',{status:404});throw Error('private-marker')};`);
 try{
  const result=spawnSync(process.execPath,['--import',hookPath,cli,...args],{encoding:'utf8',env:{...process.env,SITE_MONITOR_CONDITIONS_AUTHORIZATION:'owner-approved-readonly-monitor-conditions',GITHUB_REPOSITORY:'Xpotato1024/xpotato-site',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_ACTOR:'Xpotato1024',GITHUB_TRIGGERING_ACTOR:'Xpotato1024',GITHUB_EVENT_PATH:eventPath,CLOUDFLARE_SITE_MONITOR_READ_TOKEN:secret,...env}});
  return {result,calls:existsSync(hitPath)?Number(readFileSync(hitPath,'utf8')):0};
 }finally{rmSync(root,{recursive:true,force:true})}
}
test('CLI uses guarded event JSON with synthetic fetch only and fixed output',()=>{
 const {result,calls}=cliRun();assert.equal(result.status,0,result.stderr);const r=JSON.parse(result.stdout.trim());safe(r);assert.equal(r.status,'CONDITIONS_MATCH_NO_LIVE_ACCEPTANCE');assert.equal(calls,21);
});
for(const [key,value] of [['SITE_MONITOR_CONDITIONS_AUTHORIZATION',''],['GITHUB_REPOSITORY','other/site'],['GITHUB_REF','refs/heads/other'],['GITHUB_EVENT_NAME','pull_request'],['GITHUB_ACTOR','other'],['GITHUB_TRIGGERING_ACTOR','other']])
 test('CLI guard '+key+' before input/secret/fetch',()=>{
  const {result,calls}=cliRun({env:{[key]:value,GITHUB_EVENT_PATH:'/missing/private-marker'}});assert.equal(result.status,1);assert.equal(calls,0);assert.ok(!result.stdout.includes(secret));assert.ok(!result.stderr.includes('private-marker'));
 });
for(const event of [null,[],{inputs:null},{inputs:[]},{inputs:{mode:'readonly-get',expected_conditions:JSON.stringify(baseExpected())}},{inputs:{mode:'readonly-monitor-conditions',expected_conditions:42}},{inputs:{mode:'readonly-monitor-conditions',expected_conditions:secret}},{inputs:{mode:'readonly-monitor-conditions',expected_conditions:'{}'}}])
 test('CLI malformed event/expectations deny without fetch '+JSON.stringify(event),()=>{const {result,calls}=cliRun({event});assert.equal(result.status,1);assert.equal(calls,0);assert.ok(!result.stderr.includes(secret))});
test('CLI huge/invalid JSON and extra argv never execute GET',()=>{
 for(const options of [{raw:'x'.repeat(1048577)},{raw:'private-marker'},{args:['private-marker']}]){const {result,calls}=cliRun(options);assert.equal(result.status,1);assert.equal(calls,0);assert.ok(!result.stderr.includes('private-marker'))}
});
test('workflow isolates new opt-in and keeps monitor/baseline/deploy disabled',()=>{
 const workflow=readFileSync(new URL('../../.github/workflows/site-monitor-readiness.yml',import.meta.url),'utf8');
 const block=workflow.split('  monitor-conditions:\n')[1].split('  synthetic-notification:')[0];
 for(const text of ["github.repository == 'Xpotato1024/xpotato-site'","github.event_name == 'workflow_dispatch'","github.ref == 'refs/heads/main'","github.actor == 'Xpotato1024'","github.triggering_actor == 'Xpotato1024'","inputs.mode == 'readonly-monitor-conditions'",'persist-credentials: false','owner-approved-readonly-monitor-conditions'])assert.ok(block.includes(text));
 assert.ok(!block.includes('inputs.expected_conditions'));assert.ok(!block.includes('account_id'));assert.ok(!workflow.includes('schedule:'));
 assert.match(readFileSync(new URL('../../.github/workflows/site-integrity-monitor.yml',import.meta.url),'utf8'),/if: \$\{\{ false \}\}/);
 assert.match(readFileSync(new URL('../../.github/workflows/deploy-site.yml',import.meta.url),'utf8'),/BLOCKED_CREDENTIAL_AND_LIVE_ACCEPTANCE/);
 assert.equal(JSON.parse(readFileSync(new URL('../../docs/operations/site-monitor-baseline.json',import.meta.url),'utf8')).status,'UNINITIALIZED_LIVE_AND_OWNER_APPROVAL_REQUIRED');
});

for(const suffix of ['/tokens/verify','/workers/scripts','/deployments','/versions/'+version,'/settings','/script-settings','/scripts/xpotato-site/subdomain','/workers/domains','/workers/routes','/workers/subdomain'])
 for(const [name,change] of [['success missing',b=>delete b.success],['success false',b=>b.success=false],['errors missing',b=>delete b.errors],['provider error',b=>b.errors=[{message:secret}]],['result missing',b=>delete b.result]])
 test('required envelope '+suffix+' '+name,async()=>{
  const r=await run({mutate:(p,b)=>{if(p.endsWith(suffix))change(b)}});
  assert.equal(r.result.status,'CONDITIONS_BLOCKED');assert.ok(Object.values(r.result.checks).includes('FAIL'));
 });
test('token lookup timeout cannot send GET after late credential resolution',async()=>{
 const realTimeout=globalThis.setTimeout;globalThis.setTimeout=(fn,ms,...args)=>realTimeout(fn,ms===10000?1:ms,...args);
 let calls=0;
 try{
  const r=await probeMonitorConditions({expected:baseExpected(),clock:()=>now,credentialProvider:()=>new Promise(resolve=>realTimeout(()=>resolve(secret),25)),fetchImpl:async()=>{calls++;return Response.json(envelope({}))}});
  safe(r);assert.equal(r.status,'CONDITIONS_BLOCKED');assert.equal(r.checks.transport,'FAIL');assert.equal(r.checks.boundedOperation,'FAIL');
  await new Promise(resolve=>realTimeout(resolve,40));assert.equal(calls,0);
 }finally{globalThis.setTimeout=realTimeout}
});
test('stalled public stream stops and late completion cannot mutate receipt or trigger GET',async()=>{
 const realTimeout=globalThis.setTimeout;globalThis.setTimeout=(fn,ms,...args)=>realTimeout(fn,ms===10000?1:ms,...args);
 let stream;
 try{
  const r=await run({respond:u=>u.hostname==='xpotato.net'?new Response(new ReadableStream({start:c=>stream=c}),{status:200}):undefined});
  assert.equal(r.result.status,'CONDITIONS_BLOCKED');assert.equal(r.result.checks.homeHttp,'FAIL');const saved=JSON.stringify(r.result),calls=r.calls.length;
  stream.enqueue(new TextEncoder().encode(home));stream.close();await new Promise(resolve=>realTimeout(resolve,10));
  assert.equal(r.calls.length,calls);assert.equal(JSON.stringify(r.result),saved);
 }finally{globalThis.setTimeout=realTimeout}
});

const documentedTokenInfo=()=>({code:10000,message:'This API Token is valid and active',type:null});
test('conditions accepts only documented token info at both snapshot token reads',async()=>{
 const r=await run({mutate:(path,b)=>{if(path.endsWith('/tokens/verify'))b.messages=[documentedTokenInfo()]}});
 assert.equal(r.result.status,'CONDITIONS_MATCH_NO_LIVE_ACCEPTANCE');assert.equal(r.calls.length,21);assert.equal(r.lookups,1);
 assert.equal(r.calls.filter(c=>c.url.pathname.endsWith('/tokens/verify')).length,2);assert.ok(Object.values(r.result.checks).every(v=>v==='PASS'));
 assert.ok(!JSON.stringify(r.result).includes(documentedTokenInfo().message));
});
for(const [name,change] of [['code',m=>m.code=10001],['text',m=>m.message=secret],['type',m=>m.type='info'],['extra key',m=>m[secret]=secret]])
 test('conditions records advisory token info '+name,async()=>{
  const m=documentedTokenInfo();change(m);
  const r=await run({mutate:(path,b)=>{if(path.endsWith('/tokens/verify'))b.messages=[m]}});
  assert.equal(r.result.status,'CONDITIONS_MATCH_NO_LIVE_ACCEPTANCE');assert.equal(r.result.checks.tokenIdentity,'PASS');assert.equal(r.calls.length,21);assert.ok(r.result.warnings.includes('ENVELOPE_METADATA_ADVISORY'));
 });
test('conditions does not confuse final info metadata with authority',async()=>{
 const r=await run({mutate:(path,b,hit)=>{if(path.endsWith('/tokens/verify'))b.messages=hit===1?[documentedTokenInfo()]:[{code:10001,message:secret}]}});
 assert.equal(r.result.status,'CONDITIONS_MATCH_NO_LIVE_ACCEPTANCE');assert.equal(r.result.checks.tokenIdentity,'PASS');assert.equal(r.calls.length,21);
});
for(const [name,change,key] of [
 ['identity',b=>b.result.id='f'.repeat(32),'tokenIdentity'],['success',b=>b.success=false,'tokenIdentity'],
 ['errors',b=>b.errors=[{code:10000,message:secret}],'tokenIdentity'],['active',b=>b.result.status='expired','tokenActive'],
 ['expiry',b=>b.result.expires_on=new Date(now).toISOString(),'tokenTimes'],['notbefore',b=>b.result.not_before=new Date(now+1).toISOString(),'tokenTimes']
])test('conditions documented info never overrides token gate '+name,async()=>{
 const r=await run({mutate:(path,b)=>{if(path.endsWith('/tokens/verify')){b.messages=[documentedTokenInfo()];change(b)}}});
 assert.equal(r.result.status,'CONDITIONS_BLOCKED');assert.equal(r.result.checks[key],'FAIL');assert.equal(r.calls.length,1);
});
for(const path of ['/settings','/script-settings','/versions/'+version,'/workers/subdomain'])test('conditions records endpoint info metadata '+path,async()=>{
 const r=await run({mutate:(key,b)=>{if(key.endsWith(path))b.messages=[documentedTokenInfo()]}});
 assert.equal(r.result.status,'CONDITIONS_MATCH_NO_LIVE_ACCEPTANCE');assert.equal(r.calls.length,21);assert.ok(r.result.warnings.includes('ENVELOPE_METADATA_ADVISORY'));
});
