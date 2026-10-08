import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createIntegrityMonitor,validateMonitorBaseline,fingerprint,assessMonitorHistory,assessOwnerRecovery} from './site-integrity-monitor.mjs';
import {createMonitorHistoryReader} from './site-monitor-history.mjs';
const now=Date.parse('2026-10-06T15:00:00Z'),at=n=>new Date(now+n).toISOString();
const versionId='10000000-0000-0000-0000-000000000000',deploymentId='20000000-0000-0000-0000-000000000000',accountId='a'.repeat(32),workerTag='b'.repeat(32),credentialId='c'.repeat(32),zoneId='d'.repeat(32);
const settings={bindings:[],compatibility_date:'2026-09-23'},scriptSettings={logpush:false,tail_consumers:[]},resources={bindings:{},script:{etag:'synthetic-only'}};
const baseline=()=>({schemaVersion:1,status:'OWNER_APPROVED',selection:{runId:'1',runAttempt:1,artifactId:'2',sourceSha:'e'.repeat(40),digest:'sha256:'+'f'.repeat(64)},accountId,workerTag,credentialId,deploymentId,versionId,settingsSha256:fingerprint(settings),scriptSettingsSha256:fingerprint(scriptSettings),versionResourcesSha256:fingerprint(resources),accountSubdomain:'fixture-only',zoneIds:[zoneId],samples:[{path:'/',sha256:createHash('sha256').update('synthetic-public-only').digest('hex')}],checkpointRunId:'10'});
const cf=result=>new Response(JSON.stringify({success:true,errors:[],result}),{headers:{'content-type':'application/json'}});
const paged=(rows,extract=false,info={})=>new Response(JSON.stringify({success:true,errors:[],result:extract?{deployments:rows}:rows,result_info:{page:1,per_page:100,count:rows.length,total_count:rows.length,total_pages:1,...info}}),{headers:{'content-type':'application/json'}});
function fixture(fault=()=>undefined,options={}){const calls=[];let lookups=0;const b=baseline();
 const fetchImpl=async(url,init)=>{calls.push({url,method:init.method,headers:init.headers});const override=await fault(new URL(url),init,calls.length);if(override!==undefined)return override;const p=new URL(url).pathname;
  if(!url.startsWith('https://api.cloudflare.com/'))return new Response(url.startsWith('https://xpotato.net/')?'synthetic-public-only':'not found',{status:url.startsWith('https://xpotato.net/')?200:404});
  if(p.endsWith('/tokens/verify'))return cf({id:credentialId,status:'active'});
  if(p.endsWith('/workers/scripts'))return cf([{id:'xpotato-site',tag:workerTag}]);
  if(p.endsWith('/deployments'))return paged([{id:deploymentId,strategy:'percentage',versions:[{version_id:versionId,percentage:100}]}],true);
  if(p.endsWith('/script-settings'))return cf(scriptSettings);
  if(p.endsWith('/settings'))return cf(settings);
  if(p.includes('/versions/'))return cf({id:versionId,resources});
  if(p.endsWith('/workers/domains'))return paged([{id:'fixture-domain',service:'xpotato-site',environment:'production',hostname:'xpotato.net'}]);
  if(p==='/client/v4/zones')return paged([{id:zoneId,account:{id:accountId}}]);
  if(p.endsWith('/workers/routes'))return cf([]);
  if(p.endsWith('/workers/subdomain'))return cf({subdomain:'fixture-only'});
  if(p.endsWith('/subdomain'))return cf({enabled:false,previews_enabled:false});
  throw Error('synthetic-secret-never-reflect');
 };
 const monitor=createIntegrityMonitor({baseline:b,credentialProvider:async()=>{lookups++;return 'synthetic-not-real-credential'},fetchImpl:async(...args)=>{const r=await fetchImpl(...args);return options.responseTransform?options.responseTransform(r,args[0]):r},clock:()=>now,...options});return {monitor,calls,b,lookups:()=>lookups};
}
test('monitor construction performs no IO; healthy fixed version and HTTP sample match without mutation',async()=>{const f=fixture();assert.equal(f.calls.length,0);assert.equal(f.lookups(),0);const r=await f.monitor.check();assert.equal(r.status,'OBSERVED_MATCH');assert.equal(r.acceptance,false);assert.ok(f.calls.every(c=>c.method==='GET'));assert.ok(f.calls.filter(c=>!c.url.startsWith('https://api.cloudflare.com/')).every(c=>!c.headers.Authorization));assert.ok(!f.calls.some(c=>/\/tokens\/(?!verify)|\/tokens$|\/r2\//.test(c.url)))});
test('baseline is frozen by cloning; no observed drift auto-promotes a new baseline',async()=>{const f=fixture();f.b.versionId='30000000-0000-0000-0000-000000000000';assert.equal((await f.monitor.check()).status,'OBSERVED_MATCH');assert.equal((await fixture(u=>u.pathname.endsWith('/deployments')?paged([{id:deploymentId,strategy:'percentage',versions:[{version_id:'30000000-0000-0000-0000-000000000000',percentage:100}]}],true):undefined).monitor.check()).status,'INCIDENT_OWNER_ACTION_REQUIRED')});
test('bindings, settings, script settings, endpoint, domain and route drift all stop',async()=>{for(const [suffix,value] of [['/settings',{...settings,bindings:[{type:'r2_bucket',name:'fixture'}]}],['/script-settings',{logpush:true,tail_consumers:[]}],['/subdomain',{enabled:true,previews_enabled:true}],['/workers/routes',[{id:'fixture',script:'xpotato-site',pattern:'*'}]],['/versions/'+versionId,{id:versionId,resources:{...resources,bindings:{secret_text:[{name:'fixture'}]}}}]]){const f=fixture(u=>u.pathname.endsWith(suffix)?cf(value):undefined);assert.equal((await f.monitor.check()).status,'INCIDENT_OWNER_ACTION_REQUIRED',suffix)}const f=fixture(u=>u.pathname.endsWith('/workers/domains')?paged([]):undefined);assert.equal((await f.monitor.check()).status,'INCIDENT_OWNER_ACTION_REQUIRED')});
test('403, redirect, incomplete pagination, duplicated identities and secret-bearing errors fail safely',async()=>{for(const fault of [()=>new Response('synthetic-secret',{status:403}),()=>new Response('',{status:302}),u=>u.pathname.endsWith('/workers/domains')?paged([],false,{total_count:1}):undefined,u=>u.pathname.endsWith('/workers/domains')?paged([{id:'duplicate'},{id:'duplicate'}]):undefined,()=>{throw Error('synthetic-secret')}]){const r=await fixture(fault).monitor.check();assert.equal(r.status,'INCIDENT_OWNER_ACTION_REQUIRED');assert.ok(!JSON.stringify(r).includes('synthetic-secret'));assert.equal(r.providerMutations,0)}});
test('real HTTP byte drift, redirect and alternate exposure stop despite healthy provider metadata',async()=>{for(const fault of [u=>u.hostname==='xpotato.net'?new Response('tampered'):undefined,u=>u.hostname==='xpotato.net'?new Response('',{status:302}):undefined,u=>u.hostname.endsWith('.workers.dev')?new Response('malicious',{status:200}):undefined])assert.equal((await fixture(fault).monitor.check()).status,'INCIDENT_OWNER_ACTION_REQUIRED')});
test('multi-read setting change cannot pass a snapshot',async()=>{let reads=0;const f=fixture(u=>u.pathname.endsWith('/settings')&&++reads===2?cf({...settings,compatibility_date:'changed'}):undefined);assert.equal((await f.monitor.check()).status,'INCIDENT_OWNER_ACTION_REQUIRED')});
test('snapshot deadline aborts further requests and one observation cannot silently restart after a terminal result',async()=>{let time=now;const f=fixture(()=>{time+=120001;return cf({id:credentialId,status:'active'})},{clock:()=>time});assert.equal((await f.monitor.check()).status,'INCIDENT_OWNER_ACTION_REQUIRED');assert.equal(f.calls.length,1);await assert.rejects(f.monitor.check(),/ALREADY_ATTEMPTED/)});
test('uninitialized, secret-bearing, path escaping and broad zone baseline cannot start',()=>{for(const patch of [{status:'UNINITIALIZED'},{credentialId:'token-value'},{samples:[{path:'//evil.invalid/',sha256:'f'.repeat(64)}]},{samples:[{path:'/../',sha256:'f'.repeat(64)}]},{zoneIds:[zoneId,'a'.repeat(32)]},{secret:'never-accept'}])assert.throws(()=>validateMonitorBaseline({...baseline(),...patch}),/MONITOR_/)});
test('unrelated zones are outside the site monitor and no account zone enumeration is requested',async()=>{const f=fixture(u=>u.pathname==='/client/v4/zones'?new Response('',{status:403}):undefined);assert.equal((await f.monitor.check()).status,'OBSERVED_MATCH');assert.ok(!f.calls.some(c=>new URL(c.url).pathname==='/client/v4/zones'));assert.doesNotThrow(()=>validateMonitorBaseline({...baseline(),zoneIds:[]}))});
const run=(id,offset,patch={})=>({id:String(id),runAttempt:1,repository:'Xpotato1024/xpotato-site',path:'.github/workflows/site-integrity-monitor.yml',headBranch:'main',event:'schedule',status:'completed',conclusion:'success',createdAt:at(offset),completedAt:at(offset+10000),...patch});
const history=(runs=[run(10,-300000),run(11,-60000)])=>({baseline:baseline(),runs,totalCount:runs.length,observedAt:at(0)});
test('fresh authenticated complete history enables only evidence consistency, never live acceptance',()=>{const r=assessMonitorHistory(history(),now);assert.equal(r.deployAllowed,true);assert.equal(r.acceptance,false)});
test('incident latches across later success; skipped/cancelled/pending and outage gaps remain stopped',()=>{for(const conclusion of ['failure','cancelled','skipped','timed_out',null])assert.throws(()=>assessMonitorHistory(history([run(10,-300000,{conclusion}),run(11,-60000)]),now),/LATCHED/);assert.throws(()=>assessMonitorHistory(history([run(10,-900000),run(11,-60000)]),now),/COVERAGE_GAP/);assert.throws(()=>assessMonitorHistory(history([run(10,-900000)]),now),/STALE/);assert.throws(()=>assessMonitorHistory(history([run(10,-300000),run(11,-60000,{status:'in_progress'})]),now),/LATCHED/)});
test('missing checkpoint, incomplete history, wrong workflow/branch/repository and stale read cannot open deploy gate',()=>{for(const h of [{...history(),totalCount:3},history([run(11,-60000)]),history([run(10,-60000,{headBranch:'feature'})]),history([run(10,-60000,{repository:'other'})]),{...history(),observedAt:at(-120001)}])assert.throws(()=>assessMonitorHistory(h,now),/MONITOR_/)});
test('rerunning a failed monitor cannot erase its incident; fresh dispatch and owner checkpoint are needed',()=>{const h=history([run(10,-300000,{runAttempt:2}),run(11,-60000)]);assert.throws(()=>assessMonitorHistory(h,now),/LATCHED/);h.baseline.checkpointRunId='11';assert.equal(assessMonitorHistory(h,now).deployAllowed,true)});
test('authenticated history reader paginates exact workflow and refuses hidden failures or partial history',async()=>{
 const raw=r=>({id:Number(r.id),run_attempt:r.runAttempt,repository:{full_name:r.repository},path:r.path,head_branch:r.headBranch,event:r.event,status:r.status,conclusion:r.conclusion,created_at:r.createdAt,updated_at:r.completedAt});
 const create=rows=>createMonitorHistoryReader({credentialProvider:async()=>'synthetic-github-readonly',fetchImpl:async(url,init)=>{assert.equal(init.method,'GET');const payload=new URL(url).pathname.endsWith('/actions/runs/10')?raw(rows.find(r=>r.id==='10')):{total_count:rows.length,workflow_runs:rows.map(raw)};return new Response(JSON.stringify(payload),{headers:{'content-type':'application/json'}})},clock:()=>now});
 assert.equal((await create(history().runs)(baseline())).runs.length,2);
 await assert.rejects(create([run(10,-300000,{conclusion:'failure'}),run(11,-60000)])(baseline()),/LATCHED/);
 const partial=createMonitorHistoryReader({credentialProvider:async()=>'synthetic-github-readonly',fetchImpl:async url=>new Response(JSON.stringify(new URL(url).pathname.endsWith('/actions/runs/10')?raw(run(10,-300000)):{total_count:3,workflow_runs:[]}),{headers:{'content-type':'application/json'}}),clock:()=>now});await assert.rejects(partial(baseline()),/UNKNOWN/);
 assert.throws(()=>assessMonitorHistory({...history(),baseline:{...baseline(),checkpointRunId:null}},now),/CHECKPOINT/);
});
test('more than 10,000 checkpoint-era runs are complete through bounded daily searches; older lifetime history is never requested',async()=>{
 const rows=Array.from({length:10081},(_,i)=>run(10+i,-3024000000+i*300000-60000));let requests=0;
 const raw=r=>({id:Number(r.id),run_attempt:1,repository:{full_name:r.repository},path:r.path,head_branch:r.headBranch,event:r.event,status:r.status,conclusion:r.conclusion,created_at:r.createdAt,updated_at:r.completedAt});
 const reader=createMonitorHistoryReader({credentialProvider:async()=>'synthetic-github-readonly',clock:()=>now,fetchImpl:async url=>{requests++;const u=new URL(url);let payload;if(u.pathname.endsWith('/actions/runs/10'))payload=raw(rows[0]);else{assert.ok(u.searchParams.has('created'));const [from,to]=u.searchParams.get('created').split('..').map(Date.parse),slice=rows.filter(r=>Date.parse(r.createdAt)>=from&&Date.parse(r.createdAt)<=to),page=Number(u.searchParams.get('page'));payload={total_count:slice.length,workflow_runs:slice.slice((page-1)*100,page*100).map(raw)}}return new Response(JSON.stringify(payload),{headers:{'content-type':'application/json'}})}});
 const evidence=await reader(baseline());assert.equal(evidence.totalCount,10081);assert.ok(requests<120);assert.equal(assessMonitorHistory(evidence,now).deployAllowed,true);
});
const recovery=()=>({baseline:baseline(),observedAt:at(0),owner:'Xpotato1024',incidentRunId:'10',revokedTokenId:'1'.repeat(32),expectedTokenId:'1'.repeat(32),dashboardRevocationConfirmed:true,endpointsStopped:true,knownGoodArtifactVerified:true,restoredSelection:baseline().selection,restoredSettingsConfirmed:true,restoredBindingsEmpty:true,restoredEndpointsSuppressed:true,restoredHttpMatches:true,freshMonitorMatch:true,ownerResumeApproved:true});
test('history reader refuses truncated search partitions, wrong checkpoint and out-of-range results',async()=>{
 const raw={id:10,run_attempt:1,repository:{full_name:'Xpotato1024/xpotato-site'},path:'.github/workflows/site-integrity-monitor.yml',head_branch:'main',event:'schedule',status:'completed',conclusion:'success',created_at:at(-300000),updated_at:at(-290000)};
 for(const [checkpoint,payload,code] of [[raw,{total_count:1001,workflow_runs:[raw]},/PARTITION_LIMIT/],[{...raw,id:9},{total_count:1,workflow_runs:[raw]},/CHECKPOINT_IDENTITY/],[raw,{total_count:1,workflow_runs:[{...raw,created_at:at(-600000)}]},/HISTORY_IDENTITY/]]){
  const reader=createMonitorHistoryReader({credentialProvider:async()=>'synthetic-github-readonly',clock:()=>now,fetchImpl:async url=>new Response(JSON.stringify(new URL(url).pathname.endsWith('/actions/runs/10')?checkpoint:payload),{headers:{'content-type':'application/json'}})});await assert.rejects(reader(baseline()),code);
 }
});
test('revocation alone never proves recovery; known-good artifact/settings/bindings/endpoints/HTTP/owner readback all required',()=>{assert.equal(assessOwnerRecovery(recovery(),now).acceptance,false);for(const key of ['dashboardRevocationConfirmed','endpointsStopped','knownGoodArtifactVerified','restoredSettingsConfirmed','restoredBindingsEmpty','restoredEndpointsSuppressed','restoredHttpMatches','freshMonitorMatch','ownerResumeApproved'])assert.throws(()=>assessOwnerRecovery({...recovery(),[key]:false},now),/RECOVERY_INCOMPLETE/);assert.throws(()=>assessOwnerRecovery({...recovery(),restoredSelection:{...baseline().selection,digest:'sha256:'+'0'.repeat(64)}},now),/ARTIFACT/);assert.throws(()=>assessOwnerRecovery({...recovery(),revokedTokenId:'2'.repeat(32)},now),/IDENTITY/)});
test('monitor template has no active schedule, live execution, deploy credential, privileged GitHub writes or provider mutation',()=>{const w=readFileSync(new URL('../../.github/workflows/site-integrity-monitor.yml',import.meta.url),'utf8');assert.match(w,/if: \$\{\{ false \}\}/);assert.ok(!/^  schedule:/m.test(w));assert.ok(!/contents: write|actions: write|issues: write|self-hosted|pull_request_target|CLOUDFLARE_SITE_API_TOKEN|wrangler|workflow_run:/.test(w));assert.match(w,/permissions:\s+contents: read\s+actions: read/)});
test('CLI refuses PR/other actor/ref/repository and uninitialized live baseline without reflecting credential values',()=>{
 const env={SITE_MONITOR_AUTHORIZATION:'separately-approved-readonly-monitor',CLOUDFLARE_SITE_MONITOR_READ_TOKEN:'synthetic-secret-never-real',GITHUB_REPOSITORY:'Xpotato1024/xpotato-site',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'schedule',GITHUB_ACTOR:'Xpotato1024'};
 for(const patch of [{GITHUB_REF:'refs/heads/feature'},{GITHUB_EVENT_NAME:'pull_request'},{GITHUB_REPOSITORY:'other/repo'},{GITHUB_ACTOR:'other'},{}]){const r=spawnSync(process.execPath,[fileURLToPath(new URL('./site-integrity-monitor-cli.mjs',import.meta.url)),fileURLToPath(new URL('../../docs/operations/site-monitor-baseline.json',import.meta.url))],{env:{...env,...patch},encoding:'utf8',windowsHide:true,timeout:5000});assert.equal(r.status,1);assert.equal(r.stdout,'');assert.ok(!r.stderr.includes('synthetic-secret'));assert.match(r.stderr,/STOP deployment/)}
});

for(const [name,bindings,pass] of [['object',{},true],['list',[],true],['omitted',undefined,false],['null',null,false],['boolean',true,false],['number',42,false],['string','private-marker',false],['nonempty object',{binding:{}},false],['nonempty list',[{}],false],['invalid list',[null],false]])
 test(`monitor rejects invalid bindings despite matching fingerprint: ${name}`,async()=>{
  const observed=bindings===undefined?{script:resources.script}:{...resources,bindings};
  const b={...baseline(),versionResourcesSha256:fingerprint(observed)};
  const f=fixture(u=>u.pathname.includes('/versions/')?cf({id:versionId,resources:observed}):undefined,{baseline:b});
  const before=JSON.stringify(b),result=await f.monitor.check();
  assert.equal(result.status,pass?'OBSERVED_MATCH':'INCIDENT_OWNER_ACTION_REQUIRED');
  assert.equal(result.acceptance,false);assert.equal(result.deployAllowed,false);assert.equal(result.providerMutations,0);
  assert.equal(JSON.stringify(b),before);assert.ok(f.calls.every(c=>c.method==='GET'));
  if(!pass)assert.ok(f.calls.every(c=>c.url.startsWith('https://api.cloudflare.com/')));
 });
for(const [name,observed] of [['omitted',{}],['object',{bindings:{}}],['null',{bindings:null}],['number',{bindings:42}],['boolean',{bindings:true}]])
 test(`monitor settings invalid even with matching baseline: ${name}`,async()=>{
  const f=fixture(u=>u.pathname.endsWith('/settings')?cf(observed):undefined,{baseline:{...baseline(),settingsSha256:fingerprint(observed)}});
  assert.equal((await f.monitor.check()).status,'INCIDENT_OWNER_ACTION_REQUIRED');
  assert.ok(f.calls.every(c=>c.url.startsWith('https://api.cloudflare.com/')));
 });
test('monitor rejects primitive script settings with matching fingerprint',async()=>{
 const f=fixture(u=>u.pathname.endsWith('/script-settings')?cf(true):undefined,{baseline:{...baseline(),scriptSettingsSha256:fingerprint(true)}});
 assert.equal((await f.monitor.check()).status,'INCIDENT_OWNER_ACTION_REQUIRED');
});
const shapeDomain={id:'fixture-domain',service:'xpotato-site',environment:'production',hostname:'xpotato.net'};
for(const [name,info,pass] of [
 ['absent',undefined,false],['partial',{count:1},false],['null',null,false],['false',false,false],['array',[],false],
 ['complete',{page:1,per_page:100,count:1,total_count:1,total_pages:1},true],
 ['contradictory',{page:1,per_page:100,count:1,total_count:2,total_pages:1},false],
 ['multiple pages',{page:1,per_page:1,count:1,total_count:2,total_pages:2},false]
])test(`monitor domains completeness evidence ${name}`,async()=>{
 const body={success:true,errors:[],result:[shapeDomain]};if(info!==undefined)body.result_info=info;
 const f=fixture(u=>u.pathname.endsWith('/workers/domains')?new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}}):undefined);
 const result=await f.monitor.check();assert.equal(result.status,pass?'OBSERVED_MATCH':'INCIDENT_OWNER_ACTION_REQUIRED');
 assert.equal(result.acceptance,false);assert.equal(result.deployAllowed,false);assert.equal(result.providerMutations,0);
 const domains=f.calls.filter(c=>new URL(c.url).pathname.endsWith('/workers/domains'));
 assert.equal(domains.length,1);assert.equal(new URL(domains[0].url).search,'');
 if(!pass)assert.ok(f.calls.every(c=>c.url.startsWith('https://api.cloudflare.com/')));
});
for(const value of [42,null,true,'-bad','bad-','bad.label','A','a'.repeat(64)]){
 test(`baseline DNS label requires safe string ${typeof value}`,()=>assert.throws(()=>validateMonitorBaseline({...baseline(),accountSubdomain:value}),/MONITOR_/));
 test(`monitor provider DNS label requires safe string ${typeof value}`,async()=>{
  const f=fixture(u=>u.pathname.endsWith('/workers/subdomain')?cf({subdomain:value}):undefined);
  assert.equal((await f.monitor.check()).status,'INCIDENT_OWNER_ACTION_REQUIRED');assert.ok(f.calls.every(c=>c.url.startsWith('https://api.cloudflare.com/')));
 });
}

const unrelatedDomain={id:'unrelated-domain',service:'other-worker',environment:'production',hostname:'other.example.invalid'};
const fullDomainBody=(rows,info={})=>({success:true,errors:[],result:rows,result_info:{page:1,per_page:100,count:rows.length,total_count:rows.length,total_pages:1,...info}});
const domainTamperCases=[
 ['complete mixed inventory',[shapeDomain,unrelatedDomain],{},true],
 ['hostname reassigned',[{...shapeDomain,service:'other-worker'}],{},false],
 ['reassigned with other site domain',[{...shapeDomain,service:'other-worker'},{...shapeDomain,id:'extra-site',hostname:'extra.example.invalid'}],{},false],
 ['duplicate hostname across workers',[shapeDomain,{...unrelatedDomain,hostname:'xpotato.net'}],{},false],
 ['duplicate hostname same worker',[shapeDomain,{...shapeDomain,id:'second-id'}],{},false],
 ['case duplicate',[shapeDomain,{...unrelatedDomain,hostname:'XPOTATO.NET'}],{},false],
 ['absolute DNS duplicate',[shapeDomain,{...unrelatedDomain,hostname:'xpotato.net.'}],{},false],
 ['duplicate ID',[shapeDomain,{...unrelatedDomain,id:shapeDomain.id}],{},false],
 ['additional site domain',[shapeDomain,{...shapeDomain,id:'extra-site',hostname:'extra.example.invalid'}],{},false],
 ['expected host missing',[unrelatedDomain],{},false],
 ['empty inventory',[],{},false],
 ['wrong environment',[{...shapeDomain,environment:'staging'}],{},false],
 ['malformed unrelated row',[shapeDomain,{...unrelatedDomain,service:null}],{},false],
 ['site count instead of full count',[shapeDomain,unrelatedDomain],{count:1},false],
 ['site total instead of full total',[shapeDomain,unrelatedDomain],{total_count:1},false],
 ['hidden row counted',[shapeDomain],{total_count:2},false],
 ['per-page below returned rows',[shapeDomain,unrelatedDomain],{per_page:1},false],
 ['missing total_pages',[shapeDomain],{total_pages:undefined},true],
 ['mixed inventory without total_pages',[shapeDomain,unrelatedDomain],{total_pages:undefined},true],
 ...['page','per_page','count','total_count'].map(key=>['missing '+key,[shapeDomain],{[key]:undefined},false]),
 ...['page','per_page','count','total_count','total_pages'].flatMap(key=>[null,'1',0,-1,1.5,Number.MAX_SAFE_INTEGER+1].map(value=>[`${key} invalid ${String(value)}`,[shapeDomain],{[key]:value},false])),
 ['later page',[shapeDomain],{page:2},false],
 ['multiple pages with matching counts',[shapeDomain],{total_pages:2},false],
 ['returned count mismatch',[shapeDomain],{count:2},false],
 ['empty inventory without total_pages',[],{total_pages:undefined},false],
 ['hidden row without total_pages',[shapeDomain],{total_pages:undefined,total_count:2},false],
 ['missing count without total_pages',[shapeDomain],{total_pages:undefined,count:undefined},false],
 ['missing total without total_pages',[shapeDomain],{total_pages:undefined,total_count:undefined},false]
];

for(const [name,rows,info,pass] of domainTamperCases)test(`unfiltered monitor domains: ${name}`,async()=>{
 const b=baseline(),before=JSON.stringify(b);
 const f=fixture(u=>u.pathname.endsWith('/workers/domains')?new Response(JSON.stringify(fullDomainBody(rows,info)),{headers:{'content-type':'application/json'}}):undefined,{baseline:b});
 const result=await f.monitor.check();
 assert.equal(result.status,pass?'OBSERVED_MATCH':'INCIDENT_OWNER_ACTION_REQUIRED');
 assert.equal(result.deployAllowed,false);assert.equal(result.acceptance,false);assert.equal(result.providerMutations,0);assert.equal(JSON.stringify(b),before);
 const domainCalls=f.calls.filter(c=>new URL(c.url).pathname.endsWith('/workers/domains'));
 assert.equal(domainCalls.length,1);assert.equal(new URL(domainCalls[0].url).search,'');assert.ok(f.calls.every(c=>c.method==='GET'));
 if(!pass)assert.ok(f.calls.every(c=>c.url.startsWith('https://api.cloudflare.com/')&&!new URL(c.url).pathname.endsWith('/workers/routes')));
});

const nullSuccessErrors=async r=>r.status===200&&r.headers.get('content-type')?.includes('application/json')?Response.json({...await r.json(),errors:null}):r;
test('monitor shared parser accepts successful explicit null while retaining baseline and no authority',async()=>{
 const b=baseline(),before=JSON.stringify(b),f=fixture(()=>undefined,{baseline:b,responseTransform:(r,url)=>new URL(url).pathname.endsWith('/workers/domains')?nullSuccessErrors(r):r});
 const result=await f.monitor.check();assert.equal(result.status,'OBSERVED_MATCH');
 assert.equal(result.deployAllowed,false);assert.equal(result.acceptance,false);assert.equal(result.providerMutations,0);assert.equal(JSON.stringify(b),before);assert.ok(f.calls.every(c=>c.method==='GET'));
});
for(const [name,success,errors] of [
 ['absent errors',true,undefined],['object errors',true,{}],['string errors',true,'private-error-marker'],['number errors',true,0],['boolean errors',true,false],['nonempty errors',true,[{message:'private-error-marker'}]],
 ['false success',false,null],['missing success',undefined,null],['string success','true',null],['null success',null,null]
])test(`monitor envelope rejects ${name} without exposing values`,async()=>{
 const f=fixture(u=>u.pathname.endsWith('/workers/domains')?Response.json({success,errors,result:[shapeDomain],private:'private-error-marker'}):undefined);
 const result=await f.monitor.check();assert.equal(result.status,'INCIDENT_OWNER_ACTION_REQUIRED');
 assert.equal(result.providerMutations,0);assert.equal(result.deployAllowed,false);assert.equal(result.acceptance,false);assert.ok(!JSON.stringify(result).includes('private-error-marker'));
 assert.ok(f.calls.every(c=>c.url.startsWith('https://api.cloudflare.com/')));
});
for(const [name,rows,info,pass] of domainTamperCases)test(`null-errors monitor retains full inventory/domain check: ${name}`,async()=>{
 const f=fixture(u=>u.pathname.endsWith('/workers/domains')?Response.json({...fullDomainBody(rows,info),errors:null}):undefined);
 const result=await f.monitor.check();assert.equal(result.status,pass?'OBSERVED_MATCH':'INCIDENT_OWNER_ACTION_REQUIRED');
 assert.equal(result.deployAllowed,false);assert.equal(result.providerMutations,0);assert.equal(result.acceptance,false);
 const domains=f.calls.filter(c=>new URL(c.url).pathname.endsWith('/workers/domains'));assert.equal(domains.length,1);assert.equal(new URL(domains[0].url).search,'');
 if(!pass)assert.ok(f.calls.every(c=>c.url.startsWith('https://api.cloudflare.com/')));
});
test('null-errors monitor proves counted inventory without total_pages',async()=>{
 const b=baseline(),before=JSON.stringify(b),f=fixture(u=>u.pathname.endsWith('/workers/domains')?Response.json({success:true,errors:null,result:[shapeDomain],result_info:{page:1,per_page:100,count:1,total_count:1}}):undefined,{baseline:b});
 const result=await f.monitor.check();assert.equal(result.status,'OBSERVED_MATCH');assert.equal(result.deployAllowed,false);assert.equal(result.acceptance,false);assert.equal(result.providerMutations,0);assert.equal(JSON.stringify(b),before);
 assert.ok(f.calls.some(c=>c.url.startsWith('https://xpotato.net/')));assert.equal(new URL(f.calls.find(c=>new URL(c.url).pathname.endsWith('/workers/domains')).url).search,'');assert.ok(f.calls.every(c=>c.method==='GET'));
});
test('monitor domains null errors do not bypass result or version endpoint scope',async()=>{
 for(const result of [undefined,null,true,{}]){
  const f=fixture(u=>u.pathname.endsWith('/workers/domains')?Response.json({success:true,errors:null,result}):undefined);
  assert.equal((await f.monitor.check()).status,'INCIDENT_OWNER_ACTION_REQUIRED');assert.ok(f.calls.every(c=>c.url.startsWith('https://api.cloudflare.com/')));
 }
 const observed={...resources,bindings:true},f=fixture(u=>u.pathname.includes('/versions/')?Response.json({success:true,errors:null,result:{id:versionId,resources:observed}}):undefined,{baseline:{...baseline(),versionResourcesSha256:fingerprint(observed)}});
 assert.equal((await f.monitor.check()).status,'INCIDENT_OWNER_ACTION_REQUIRED');assert.ok(f.calls.every(c=>c.url.startsWith('https://api.cloudflare.com/')));
});

for(const suffix of ['/tokens/verify','/workers/scripts','/deployments','/settings','/script-settings','/versions/'+versionId,'/scripts/xpotato-site/subdomain','/workers/routes','/workers/subdomain'])test(`monitor rejects unobserved null errors scope ${suffix}`,async()=>{
 const f=fixture(()=>undefined,{responseTransform:(r,url)=>new URL(url).pathname.endsWith(suffix)?nullSuccessErrors(r):r});
 const result=await f.monitor.check();assert.equal(result.status,'INCIDENT_OWNER_ACTION_REQUIRED');
 assert.equal(result.deployAllowed,false);assert.equal(result.acceptance,false);assert.equal(result.providerMutations,0);
 assert.ok(f.calls.every(c=>c.url.startsWith('https://api.cloudflare.com/')&&c.method==='GET'));
});
