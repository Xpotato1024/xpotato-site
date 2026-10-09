import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {probeMonitorCandidate,candidateTokenDiagnostics,validConditionSeed,safeSettings,safeScriptSettings,safeResources,safeSubdomain,safeCandidateEnvelope,safeTokenEnvelope} from './site-monitor-candidate.mjs';
import {probeMonitorConditions} from './site-monitor-conditions.mjs';
import {fingerprint} from './site-integrity-monitor.mjs';
const now=Date.parse('2026-10-09T00:00:00Z'),secret='candidate-private-marker';
const seed=()=>({schemaVersion:2,selection:{runId:'123',runAttempt:1,artifactId:'456',sourceSha:'e'.repeat(40),digest:'sha256:'+'f'.repeat(64)},accountId:'a'.repeat(32),credentialId:'b'.repeat(32),workerTag:'c'.repeat(32),deploymentId:'11111111-1111-1111-1111-111111111111',versionId:'22222222-2222-2222-2222-222222222222',zoneId:'d'.repeat(32),homeSha256:'f'.repeat(64)});
const source=()=>({sourceSha:'9'.repeat(40),runId:'789',runAttempt:1});
const envelope=result=>({success:true,errors:[],result});
const fixtures=()=>[envelope({id:seed().credentialId,status:'active'}),envelope({bindings:[]}),envelope({logpush:false,observability:null}),envelope({id:seed().versionId,resources:{bindings:[]}}),envelope({subdomain:'fixture-account'})];
function safe(r){
 assert.ok(['CANDIDATE_REVIEW_REQUIRED','CANDIDATE_BLOCKED'].includes(r.status));assert.equal(r.adopted,false);
 for(const k of ['deployAllowed','acceptance','baselineUpdated','monitorActivated'])assert.equal(r[k],false);
 assert.equal(r.providerMutations,0);assert.ok(Buffer.byteLength(JSON.stringify(r))<=8192);
 assert.ok(Object.values(r.checks).every(v=>['PASS','FAIL','NOT_CHECKED'].includes(v)));
 for(const v of [secret,seed().accountId,seed().credentialId,seed().workerTag,seed().deploymentId,seed().versionId,seed().zoneId,'fixture-account','evil.invalid'])assert.ok(!JSON.stringify(r).includes(v));
 if(r.status==='CANDIDATE_BLOCKED'){assert.equal(r.candidate,null);assert.equal(r.source,null);assert.ok(Object.values(r.summary).every(v=>v==='UNAVAILABLE'))}
}
async function run({bodies=fixtures(),mutate,override={},response}={}){
 const calls=[];let lookups=0;
 const result=await probeMonitorCandidate({seed:seed(),source:source(),clock:()=>now,credentialProvider:async()=>{lookups++;return secret},fetchImpl:async(url,options)=>{
  calls.push({url:new URL(url),options});const i=calls.length-1,b=structuredClone(bodies[i]);mutate?.(i,b);
  return response?.(i,b,options)??Response.json(b);
 },...override});safe(result);return {result,calls,lookups};
}
test('five exact metadata GETs yield only an unadopted review candidate',async()=>{
 const r=await run();assert.equal(r.result.status,'CANDIDATE_REVIEW_REQUIRED');assert.equal(r.calls.length,5);assert.equal(r.lookups,1);
 assert.deepEqual(r.calls.map(c=>c.url.pathname.split(seed().accountId)[1]),['/tokens/verify','/workers/scripts/xpotato-site/settings','/workers/scripts/xpotato-site/script-settings','/workers/scripts/xpotato-site/versions/'+seed().versionId,'/workers/subdomain']);
 for(const {url,options} of r.calls){assert.equal(url.origin,'https://api.cloudflare.com');assert.equal(url.search,'');assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');assert.equal(options.body,undefined);assert.equal(options.headers.Authorization,'Bearer '+secret)}
 const b=fixtures();assert.deepEqual(r.result.candidate,{settingsSha256:fingerprint(b[1].result),scriptSettingsSha256:fingerprint(b[2].result),versionResourcesSha256:fingerprint(b[3].result.resources),accountSubdomainSha256:fingerprint(b[4].result)});
 assert.deepEqual(r.result.source,{...source(),contextSha256:fingerprint(seed())});
 // A receipt or its four hashes alone is never a comparison configuration.
 for(const expected of [r.result,r.result.candidate]){const x=await probeMonitorConditions({expected,credentialProvider:()=>{throw Error(secret)},fetchImpl:()=>{throw Error(secret)}});assert.equal(x.checks.configuration,'FAIL')}
});
for(const key of Object.keys(seed()))for(const v of [undefined,null,42,secret])test('bad seed before credential/I/O '+key+' '+String(v),async()=>{
 const s=seed();s[key]=v;const r=await run({override:{seed:s}});assert.equal(r.calls.length,0);assert.equal(r.lookups,0);
});
for(const bad of [s=>s.extra=secret,s=>s.schemaVersion=1,s=>s.accountSubdomain='fixture-account',s=>s.settingsSha256='f'.repeat(64),s=>s.selection.extra=secret,s=>s.selection.runAttempt=0])test('exact seed gate',async()=>{
 const s=seed();bad(s);assert.equal(validConditionSeed(s),false);assert.equal((await run({override:{seed:s}})).calls.length,0);
});
for(const s of [null,{}, {...source(),extra:secret},{...source(),sourceSha:secret},{...source(),runId:'0'},{...source(),runAttempt:0}])test('bad receipt source before I/O '+JSON.stringify(s),async()=>{assert.equal((await run({override:{source:s}})).calls.length,0)});
for(const key of ['credentialProvider','fetchImpl','clock','signal'])test('bad dependency '+key,async()=>{assert.equal((await run({override:{[key]:null}})).calls.length,0)});
const cases=[
 [0,b=>b.result.id='f'.repeat(32),'tokenIdentity'],[0,b=>b.result.status='expired','tokenActive'],[0,b=>b.result.extra=secret,'tokenResultFields'],[0,b=>b.result.expires_on=new Date(now).toISOString(),'tokenTimes'],[0,b=>b.result.not_before=new Date(now+1).toISOString(),'tokenTimes'],[0,b=>b.result.expires_on=null,'tokenExpiresShape'],
 [1,b=>delete b.result.bindings,'settingsBindingsEmpty'],[1,b=>b.result.bindings={},'settingsBindingsEmpty'],[1,b=>b.result.bindings=null,'settingsBindingsEmpty'],[1,b=>b.result.bindings=[{type:'secret_text',text:secret}],'settingsBindingsEmpty'],
 [1,b=>b.result.extra=secret,'settingsSafe'],[1,b=>b.result.tags=[secret],'settingsSafe'],[1,b=>b.result.annotations={secret},'settingsSafe'],[1,b=>b.result.compatibility_date='2026-01-01','settingsSafe'],[1,b=>b.result.compatibility_flags=[secret],'settingsSafe'],[1,b=>b.result.placement={mode:'smart',host:secret},'settingsSafe'],[1,b=>b.result.limits={cpu_ms:-1},'settingsSafe'],[1,b=>b.result.limits={cpu_ms:Infinity},'settingsSafe'],[1,b=>b.result.cache_options={enabled:true},'settingsSafe'],
 [2,b=>b.result.extra=secret,'scriptSettingsSafe'],[2,b=>b.result.tail_consumers=[{service:secret}],'scriptSettingsSafe'],[2,b=>b.result.observability={enabled:true,logs:{enabled:true,invocation_logs:true,destinations:[secret]}},'scriptSettingsSafe'],[2,b=>b.result.observability={enabled:true,head_sampling_rate:2},'scriptSettingsSafe'],[2,b=>b.result.observability={enabled:true,logs:{enabled:true}},'scriptSettingsSafe'],[2,b=>b.result.observability={enabled:true,traces:{propagation_policy:secret}},'scriptSettingsSafe'],
 [3,b=>b.result.id='33333333-3333-3333-3333-333333333333','versionIdentity'],[3,b=>delete b.result.resources,'versionBindingsEmpty'],[3,b=>delete b.result.resources.bindings,'versionBindingsEmpty'],[3,b=>b.result.resources.bindings=null,'versionBindingsEmpty'],[3,b=>b.result.resources.bindings=[{name:secret}],'versionBindingsEmpty'],[3,b=>b.result.resources.bindings={secret},'versionBindingsEmpty'],[3,b=>b.result.resources.extra=secret,'resourcesSafe'],[3,b=>b.result.resources.script={handlers:[secret]},'resourcesSafe'],[3,b=>b.result.resources.script={named_handlers:[{name:secret}]},'resourcesSafe'],[3,b=>b.result.resources.script_runtime={exports:{secret}},'resourcesSafe'],[3,b=>b.result.resources.script_runtime={migration_tag:secret},'resourcesSafe'],
 [4,b=>b.result.subdomain='A','accountSubdomain'],[4,b=>b.result.subdomain='bad.label','accountSubdomain'],[4,b=>b.result.extra=secret,'accountSubdomain']
];
for(const [index,make,key] of cases)test('unsafe field stops without any hashes '+index+' '+key+' '+String(make),async()=>{
 const r=await run({mutate:(i,b)=>{if(i===index)make(b)}});assert.equal(r.result.status,'CANDIDATE_BLOCKED');assert.equal(r.result.checks[key],'FAIL');assert.equal(r.calls.length,index+1);
});
for(let index=0;index<5;index++)for(const make of [b=>delete b.success,b=>b.success=false,b=>delete b.errors,b=>b.errors=[{message:secret}],b=>delete b.result,b=>b.messages=[{message:secret}],b=>b[secret]=secret,b=>b.result_info={cursor:secret}])test('strict envelope '+index+' '+String(make),async()=>{
 const r=await run({mutate:(i,b)=>{if(i===index)make(b)}});assert.equal(r.result.status,'CANDIDATE_BLOCKED');assert.equal(r.calls.length,index+1);
});
test('every allowed setting is summarized by scope; null, missing and differences are preserved',async()=>{
 const b=fixtures(),o={enabled:true,redact_query_string:false,head_sampling_rate:0.25,logs:{enabled:true,invocation_logs:false,persist:true,head_sampling_rate:null,destinations:[]},traces:{enabled:false,persist:false,head_sampling_rate:1,destinations:[],propagation_policy:'authenticated'},issues:{enabled:false}};
 b[1].result={bindings:[],compatibility_date:'2026-08-26',compatibility_flags:[],usage_model:'standard',limits:{cpu_ms:100,subrequests:50},placement:{mode:'smart',status:'SUCCESS',last_analyzed_at:'2026-10-08T00:00:00Z'},logpush:true,observability:o,tags:[],tail_consumers:[],annotations:{},exports_reconciliation:{},cache_options:{enabled:false}};
 b[2].result={logpush:false,observability:null,tags:null,tail_consumers:null};
 b[3].result.resources={bindings:{},script:{etag:'a'.repeat(32),handlers:['fetch'],last_deployed_from:'wrangler',named_handlers:[]},script_runtime:{compatibility_date:'2026-08-26',compatibility_flags:[],usage_model:'bundled',limits:{cpu_ms:200},exports:{},migration_tag:''}};
 const r=await run({bodies:b});assert.equal(r.result.status,'CANDIDATE_REVIEW_REQUIRED');const s=r.result.summary;
 assert.equal(s.settings.logpush,'ON');assert.equal(s.scriptSettings.logpush,'OFF');assert.equal(s.scriptSettings.observability,'NULL');assert.equal(s.settings.observability,'PRESENT');
 assert.equal(s.settings.logSamplingRate,null);assert.equal(s.settings.headSamplingRate,0.25);assert.equal(s.settings.invocationLogs,'OFF');assert.equal(s.settings.redactQueryString,'OFF');assert.equal(s.settings.issuesEnabled,'OFF');
 assert.equal(s.settings.cpuLimitMs,100);assert.equal(s.versionRuntime.cpuLimitMs,200);assert.equal(s.versionRuntime.subrequestLimit,'UNSET');assert.equal(s.versionScript.handlers,'FETCH');
 assert.notEqual(r.result.candidate.scriptSettingsSha256,fingerprint({logpush:false}));
 assert.ok(!JSON.stringify(s).includes(b[1].result.placement.last_analyzed_at));assert.ok(!JSON.stringify(s).includes(b[3].result.resources.script.etag));
});
for(const bindings of [[],{}])test('documented empty resources representation '+JSON.stringify(bindings),async()=>{
 const b=fixtures();b[3].result.resources.bindings=bindings;assert.equal((await run({bodies:b})).result.status,'CANDIDATE_REVIEW_REQUIRED');
});
for(const [validator,good] of [[safeSettings,{bindings:[]}],[safeScriptSettings,{}],[safeResources,{bindings:{}}],[safeSubdomain,{subdomain:'fixture-account'}],[safeCandidateEnvelope,envelope({})]])test('validators reject unknown keys, arrays, null',()=>{
 assert.equal(validator(good),true);for(const bad of [null,[],{...good,[secret]:secret}])assert.equal(validator(bad),false);
});
for(const response of [()=>Response.json({message:secret},{status:403}),()=>new Response('',{status:302}),()=>new Response(secret,{headers:{'content-type':'application/json'}}),()=>new Response('x'.repeat(1048577),{headers:{'content-type':'application/json'}})])test('bounded transport rejects without retry',async()=>{
 const r=await run({response});assert.equal(r.result.status,'CANDIDATE_BLOCKED');assert.equal(r.calls.length,1);
});
test('signal and deadline stop before credential; cancellation stops next GET',async()=>{
 const c=new AbortController();c.abort();let r=await run({override:{signal:c.signal}});assert.equal(r.calls.length,0);assert.equal(r.lookups,0);
 let ticks=0;r=await run({override:{clock:()=>ticks++===0?now:now+60000}});assert.equal(r.calls.length,0);
 const d=new AbortController();r=await run({override:{signal:d.signal},response:()=>{d.abort()}});assert.equal(r.calls.length,1);
});
test('clone seed/source and freeze credential before async completion',async()=>{
 const e=seed(),s=source();let count=0;
 const r=await run({override:{seed:e,source:s,credentialProvider:async()=>{count++;e.versionId=secret;s.runId=secret;return secret}}});assert.equal(r.result.status,'CANDIDATE_REVIEW_REQUIRED');assert.equal(count,1);assert.deepEqual(r.result.source,{...source(),contextSha256:fingerprint(seed())});
});
test('late credentials cannot send GET or change returned receipt',async()=>{
 const realTimeout=globalThis.setTimeout;globalThis.setTimeout=(fn,ms,...args)=>realTimeout(fn,ms===10000?1:ms,...args);
 let calls=0;
 try{const r=await probeMonitorCandidate({seed:seed(),source:source(),clock:()=>now,credentialProvider:()=>new Promise(resolve=>realTimeout(()=>resolve(secret),25)),fetchImpl:()=>{calls++;throw Error(secret)}});safe(r);const saved=JSON.stringify(r);await new Promise(resolve=>realTimeout(resolve,40));assert.equal(calls,0);assert.equal(JSON.stringify(r),saved)}finally{globalThis.setTimeout=realTimeout}
});
const cli=fileURLToPath(new URL('./site-monitor-conditions-cli.mjs',import.meta.url));
function cliRun({env={},event,raw,args=[]}={}){
 const root=mkdtempSync(join(tmpdir(),'monitor-candidate-test-')),eventPath=join(root,'event.json'),hitPath=join(root,'hits'),hookPath=join(root,'hook.mjs');
 writeFileSync(eventPath,raw??JSON.stringify(event??{inputs:{mode:'readonly-monitor-candidate',expected_conditions:JSON.stringify(seed())}}));
 writeFileSync(hookPath,"import {writeFileSync} from 'node:fs';const b="+JSON.stringify(fixtures())+";let count=0;process.on('exit',()=>writeFileSync("+JSON.stringify(hitPath)+",String(count)));globalThis.fetch=async(url,options)=>{if(options.method!=='GET'||options.redirect!=='manual'||!String(url).startsWith('https://api.cloudflare.com/'))throw Error('private-marker');return Response.json(b[count++])};");
 try{
  const result=spawnSync(process.execPath,['--import',hookPath,cli,...args],{encoding:'utf8',env:{...process.env,SITE_MONITOR_CONDITIONS_AUTHORIZATION:'owner-approved-readonly-monitor-conditions',GITHUB_REPOSITORY:'Xpotato1024/xpotato-site',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_ACTOR:'Xpotato1024',GITHUB_TRIGGERING_ACTOR:'Xpotato1024',GITHUB_EVENT_PATH:eventPath,GITHUB_SHA:source().sourceSha,GITHUB_RUN_ID:source().runId,GITHUB_RUN_ATTEMPT:'1',CLOUDFLARE_SITE_MONITOR_READ_TOKEN:secret,...env}});
  return {result,calls:existsSync(hitPath)?Number(readFileSync(hitPath,'utf8')):0};
 }finally{rmSync(root,{recursive:true,force:true})}
}
test('candidate CLI returns review required, never comparison success',()=>{
 const {result,calls}=cliRun();assert.equal(result.status,0,result.stderr);assert.equal(calls,5);const r=JSON.parse(result.stdout);safe(r);assert.equal(r.status,'CANDIDATE_REVIEW_REQUIRED');
});
for(const [key,value] of [['SITE_MONITOR_CONDITIONS_AUTHORIZATION',''],['GITHUB_REPOSITORY','other/site'],['GITHUB_REF','refs/heads/other'],['GITHUB_EVENT_NAME','pull_request'],['GITHUB_ACTOR','other'],['GITHUB_TRIGGERING_ACTOR','other'],['GITHUB_SHA',secret],['GITHUB_RUN_ID','0'],['GITHUB_RUN_ATTEMPT','0']])test('candidate CLI gate '+key,()=>{
 const {result,calls}=cliRun({env:{[key]:value}});assert.equal(result.status,1);assert.equal(calls,0);assert.ok(!result.stderr.includes(secret));
});
test('candidate CLI rejects comparison hashes, malformed JSON and args before GET',()=>{
 const e={...seed(),settingsSha256:'a'.repeat(64)};
 for(const options of [{event:{inputs:{mode:'readonly-monitor-candidate',expected_conditions:JSON.stringify(e)}}},{raw:secret},{raw:'x'.repeat(1048577)},{args:[secret]}]){
  const {result,calls}=cliRun(options);assert.equal(result.status,1);assert.equal(calls,0);assert.ok(!result.stderr.includes(secret));
 }
});
test('workflow offers candidate on existing guarded job and does not adopt or schedule',()=>{
 const w=readFileSync(new URL('../../.github/workflows/site-monitor-readiness.yml',import.meta.url),'utf8');assert.match(w,/readonly-monitor-candidate/);assert.ok(!w.includes('schedule:'));assert.ok(!w.includes('upload-artifact'));
 const cliSource=readFileSync(new URL('./site-monitor-conditions-cli.mjs',import.meta.url),'utf8');assert.ok(!cliSource.includes('writeFile'));assert.match(cliSource,/candidateMode\?await probeMonitorCandidate/);
});

test('explicitly adopted hashes need a separate complete observation and detect later drift',async()=>{
 const e=seed(),home='approved-fixture-home';const {createHash}=await import('node:crypto');e.homeSha256=createHash('sha256').update(home).digest('hex');
 const captured=await run({override:{seed:e}});assert.equal(captured.calls.length,5);assert.equal(captured.result.adopted,false);
 const expected={...e,...captured.result.candidate};let count=0;
 const fresh=drift=>probeMonitorConditions({expected,clock:()=>now,credentialProvider:async()=>secret,fetchImpl:async(raw)=>{
  count++;const u=new URL(raw),p=u.pathname;
  if(u.hostname!=='api.cloudflare.com')return new Response(u.hostname==='xpotato.net'?home:'not-found',{status:u.hostname==='xpotato.net'?200:404});
  if(p.endsWith('/tokens/verify'))return Response.json(fixtures()[0]);
  if(p.endsWith('/workers/scripts'))return Response.json(envelope([{id:'xpotato-site',tag:e.workerTag}]));
  if(p.endsWith('/deployments'))return Response.json({...envelope({deployments:[{id:e.deploymentId,strategy:'percentage',versions:[{version_id:e.versionId,percentage:100}]}]}),result_info:{page:1,per_page:100,count:1,total_count:1,total_pages:1}});
  if(p.endsWith('/settings'))return Response.json(fixtures()[1]);
  if(p.endsWith('/script-settings'))return Response.json(drift?envelope({logpush:true,observability:null}):fixtures()[2]);
  if(p.includes('/versions/'))return Response.json(fixtures()[3]);
  if(p.endsWith('/scripts/xpotato-site/subdomain'))return Response.json(envelope({enabled:false,previews_enabled:false}));
  if(p.endsWith('/workers/subdomain'))return Response.json(fixtures()[4]);
  if(p.endsWith('/workers/domains'))return Response.json({...envelope([{id:'fixture-domain',service:'xpotato-site',hostname:'xpotato.net',environment:'production'}]),result_info:{page:1,per_page:100,count:1,total_count:1}});
  if(p.endsWith('/workers/routes'))return Response.json(envelope([]));
  throw Error(secret);
 }});
 const matched=await fresh(false);assert.equal(matched.status,'CONDITIONS_MATCH_NO_LIVE_ACCEPTANCE');assert.equal(count,21);
 count=0;const changed=await fresh(true);assert.equal(changed.checks.scriptSettingsFingerprint,'FAIL');assert.equal(changed.status,'CONDITIONS_BLOCKED');assert.ok(count<21);assert.equal(changed.baselineUpdated,false);
});

for(const make of [b=>b.result.extra=secret,b=>b.result.metadata={author_email:secret},b=>b.result.metadata={author_id:secret},b=>b.result.metadata={extra:secret},b=>b.result.metadata={source:'unknown'},b=>b.result.number=-1])test('version outer metadata rejects unknown and freeform values without hashes '+String(make),async()=>{
 const r=await run({mutate:(i,b)=>{if(i===3)make(b)}});assert.equal(r.result.checks.resourcesSafe,'FAIL');assert.equal(r.calls.length,4);
});

const tokenDiagnosticKeys=['tokenEnvelope','tokenEnvelopeFields','tokenSuccess','tokenErrorsEmpty','tokenMessagesAllowed','tokenPageInfoShape','tokenResultShape','tokenResultFields','tokenIdShape','tokenIdentity','tokenStatusShape','tokenExpiresShape','tokenNotBeforeShape'];
const tokenTypeKeys=['envelope','success','errors','result','messages','result_info','id','status','expires_on','not_before','name','issued_on','modified_on'];
function safeTokenDiagnostics(d){
 assert.deepEqual(Object.keys(d.fields),tokenTypeKeys);assert.deepEqual(Object.keys(d.checks),tokenDiagnosticKeys);
 assert.ok(Object.values(d.fields).every(v=>['MISSING','NULL','ARRAY','OBJECT','STRING','NUMBER','BOOLEAN','OTHER','UNAVAILABLE'].includes(v)));
 assert.ok(Object.values(d.checks).every(v=>['PASS','FAIL','NOT_CHECKED'].includes(v)));
 for(const value of [secret,seed().credentialId,'private-marker','evil.invalid'])assert.ok(!JSON.stringify(d).includes(value));
}
const tokenFaults=[
 ['root unknown',b=>b[secret]=secret,'tokenEnvelopeFields'],
 ['success missing',b=>delete b.success,'tokenSuccess'],
 ['success false',b=>b.success=false,'tokenSuccess'],
 ['errors missing',b=>delete b.errors,'tokenErrorsEmpty'],
 ['errors null',b=>b.errors=null,'tokenErrorsEmpty'],
 ['errors nonempty',b=>b.errors=[{message:secret}],'tokenErrorsEmpty'],
 ['messages nonempty',b=>b.messages=[{message:secret}],'tokenMessagesAllowed'],
 ['messages null',b=>b.messages=null,'tokenMessagesAllowed'],
 ['pageinfo unknown',b=>b.result_info={secret},'tokenPageInfoShape'],
 ['pageinfo malformed',b=>b.result_info={page:'1'},'tokenPageInfoShape'],
 ['result missing',b=>delete b.result,'tokenResultShape'],
 ['result null',b=>b.result=null,'tokenResultShape'],
 ['result array',b=>b.result=[],'tokenResultShape'],
 ['result unknown',b=>b.result[secret]=secret,'tokenResultFields'],
 ['id missing',b=>delete b.result.id,'tokenIdShape'],
 ['id wrong type',b=>b.result.id=42,'tokenIdShape'],
 ['id malformed',b=>b.result.id='https://evil.invalid/'+secret,'tokenIdShape'],
 ['id mismatch',b=>b.result.id='f'.repeat(32),'tokenIdentity'],
 ['status missing',b=>delete b.result.status,'tokenStatusShape'],
 ['status unknown',b=>b.result.status=secret,'tokenStatusShape'],
 ['expires null',b=>b.result.expires_on=null,'tokenExpiresShape'],
 ['expires unparsable',b=>b.result.expires_on=secret,'tokenExpiresShape'],
 ['expires permissive Date.parse only',b=>b.result.expires_on='2027-01-01','tokenExpiresShape'],
 ['notbefore null',b=>b.result.not_before=null,'tokenNotBeforeShape'],
 ['notbefore non-ISO',b=>b.result.not_before='2026/01/01','tokenNotBeforeShape']
];
for(const [name,mutate,key] of tokenFaults)test('fixed detailed token reason '+name+' before further GET',async()=>{
 const r=await run({mutate:(i,b)=>{if(i===0)mutate(b)}});assert.equal(r.calls.length,1);assert.equal(r.result.candidate,null);
 assert.equal(r.result.transportCode,'OK');assert.equal(r.result.checks[key],'FAIL');
 assert.equal(r.result.checks.tokenActive,'NOT_CHECKED');assert.equal(r.result.checks.tokenTimes,'NOT_CHECKED');
 safeTokenDiagnostics({fields:r.result.tokenFields,checks:Object.fromEntries(tokenDiagnosticKeys.map(k=>[k,r.result.checks[k]]))});
 if(key!=='tokenIdentity'&&key!=='tokenIdShape'&&key!=='tokenResultShape')assert.equal(r.result.checks.tokenIdentity,'PASS');
 if(key==='tokenIdShape'||key==='tokenResultShape')assert.equal(r.result.checks.tokenIdentity,'NOT_CHECKED');
});
test('multiple schema failures are classified without printing values or suggesting adoption',async()=>{
 const r=await run({mutate:(i,b)=>{if(i===0){b.messages=[{message:secret}];b.result.id='f'.repeat(32);b.result.expires_on=secret}}});
 assert.equal(r.result.checks.tokenMessagesAllowed,'FAIL');assert.equal(r.result.checks.tokenIdentity,'FAIL');assert.equal(r.result.checks.tokenExpiresShape,'FAIL');
 assert.equal(r.result.adopted,false);assert.equal(r.result.candidate,null);assert.equal(r.calls.length,1);
});
for(const field of ['name','issued_on','modified_on'])test('known metadata type is visible but remains rejected '+field,async()=>{
 const r=await run({mutate:(i,b)=>{if(i===0)b.result[field]=secret}});
 assert.equal(r.result.tokenFields[field],'STRING');assert.equal(r.result.checks.tokenResultFields,'FAIL');assert.equal(r.result.checks.tokenIdentity,'PASS');assert.equal(r.calls.length,1);
 assert.ok(!JSON.stringify(r.result).includes(secret));
});
test('token diagnostics are unchanged by irrelevant values and use fixed output keys',()=>{
 const a=fixtures()[0],b=fixtures()[0];a.result[secret]=secret;b.result['another-private-provider-key']='other-private-provider-value';
 const da=candidateTokenDiagnostics(a,seed().credentialId),db=candidateTokenDiagnostics(b,seed().credentialId);
 assert.deepEqual(da,db);safeTokenDiagnostics(da);
});
// Frozen predecessor predicate: diagnostics must not broaden the admitted set.
function predecessorTokenGate(body){
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),t=object(body)?body.result:undefined;
 const time=v=>typeof v==='string'&&v.length<=40&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
 return safeCandidateEnvelope(body)&&object(t)&&Object.keys(t).every(k=>['id','status','expires_on','not_before'].includes(k))&&Object.hasOwn(t,'id')&&Object.hasOwn(t,'status')&&t.id===seed().credentialId&&['active','disabled','expired'].includes(t.status)&&['expires_on','not_before'].every(k=>!Object.hasOwn(t,k)||time(t[k]));
}
test('token gate matches predecessor for valid, malformed and multiple-failure fixtures',()=>{
 const cases=[fixtures()[0],null,[],{},envelope({}),envelope(null)];
 for(const [,mutate] of tokenFaults){const b=fixtures()[0];mutate(b);cases.push(b)}
 for(const expires of [undefined,null,'2027-01-01T00:00:00Z','2027-01-01T09:00:00+09:00','2027-01-01','private-marker'])
  for(const status of ['active','disabled','expired',null,'private-marker']){
   const b=fixtures()[0];b.result.status=status;if(expires!==undefined)b.result.expires_on=expires;cases.push(b);
  }
 for(const messages of [undefined,[],null,[{message:secret}]]){const b=fixtures()[0];if(messages!==undefined)b.messages=messages;cases.push(b)}
 for(const info of [{},{page:0,count:0},{page:1,total_count:1},{page:1,extra:secret},null]){const b=fixtures()[0];b.result_info=info;cases.push(b)}
 for(const b of cases){
  const d=candidateTokenDiagnostics(b,seed().credentialId);safeTokenDiagnostics(d);
  assert.equal(['tokenEnvelope','tokenResultShape','tokenResultFields','tokenIdShape','tokenIdentity','tokenStatusShape','tokenExpiresShape','tokenNotBeforeShape'].every(k=>d.checks[k]==='PASS'),predecessorTokenGate(b));
 }
});
test('temporal predicates keep separate reasons and preserve aggregate stop',async()=>{
 for(const [field,value,key] of [['expires_on',new Date(now).toISOString(),'tokenExpiresFuture'],['not_before',new Date(now+1).toISOString(),'tokenNotBeforeElapsed']]){
  const r=await run({mutate:(i,b)=>{if(i===0)b.result[field]=value}});
  assert.equal(r.result.checks[key],'FAIL');assert.equal(r.result.checks.tokenTimes,'FAIL');assert.equal(r.result.checks.tokenActive,'PASS');assert.equal(r.calls.length,1);
 }
});
for(const [response,code] of [
 [()=>Response.json({message:secret},{status:401}),'REMOTE_HTTP_401'],
 [()=>Response.json({message:secret},{status:403}),'REMOTE_HTTP_403'],
 [()=>Response.json({message:secret},{status:404}),'REMOTE_HTTP_404'],
 [()=>Response.json({message:secret},{status:429}),'REMOTE_HTTP_429'],
 [()=>new Response('',{status:302}),'REMOTE_REDIRECT_REJECTED'],
 [()=>new Response(secret,{headers:{'content-type':'application/json'}}),'REMOTE_INVALID_JSON'],
 [()=>new Response(secret,{headers:{'content-type':'text/plain'}}),'REMOTE_CONTENT_TYPE'],
 [()=>{throw Error(secret)},'REMOTE_REQUEST_FAILED']
])test('fixed transport code '+code+' without response access or retry',async()=>{
 const r=await run({response});assert.equal(r.result.transportCode,code);assert.equal(r.result.checks.transport,'FAIL');assert.equal(r.calls.length,1);
 assert.equal(r.result.checks.tokenEnvelope,'NOT_CHECKED');assert.ok(Object.values(r.result.tokenFields).every(v=>v==='UNAVAILABLE'));assert.equal(r.result.candidate,null);
});
test('not-yet-read token fields stay unavailable on configuration block',async()=>{
 const r=await run({override:{seed:{}}});assert.equal(r.result.transportCode,'NOT_CHECKED');assert.ok(Object.values(r.result.tokenFields).every(v=>v==='UNAVAILABLE'));
});

const documentedTokenInfo=()=>({code:10000,message:'This API Token is valid and active',type:null});
for(const withType of [true,false])test('documented token success info is narrow and leaves all gates passing '+withType,async()=>{
 const info=documentedTokenInfo();if(!withType)delete info.type;
 const b=fixtures()[0];b.messages=[info];assert.equal(predecessorTokenGate(b),false);assert.equal(safeTokenEnvelope(b),true);assert.equal(safeCandidateEnvelope(b),false);
 const r=await run({mutate:(i,b)=>{if(i===0)b.messages=[info]}});
 assert.equal(r.result.status,'CANDIDATE_REVIEW_REQUIRED');assert.equal(r.calls.length,5);assert.equal(r.lookups,1);
 assert.ok(Object.values(r.result.checks).every(v=>v==='PASS'));assert.ok(!JSON.stringify(r.result).includes(info.message));assert.ok(!JSON.stringify(r.result).includes('10000'));
});
const messageFaults=[
 ['wrong code',m=>m.code=10001],['string code',m=>m.code='10000'],['missing code',m=>delete m.code],
 ['unknown text',m=>m.message=secret],['different case',m=>m.message=m.message.toLowerCase()],['extra whitespace',m=>m.message+=' '],
 ['missing message',m=>delete m.message],['wrong message type',m=>m.message=null],['non-null type',m=>m.type='info'],
 ['unknown key',m=>m[secret]=secret],['documentation URL',m=>m.documentation_url='https://evil.invalid/'+secret],['source metadata',m=>m.source={pointer:secret}]
];
for(const [name,change] of messageFaults)test('unknown token info rejected without text output '+name,async()=>{
 const m=documentedTokenInfo();change(m);
 const r=await run({mutate:(i,b)=>{if(i===0)b.messages=[m]}});
 assert.equal(r.result.status,'CANDIDATE_BLOCKED');assert.equal(r.result.checks.tokenMessagesAllowed,'FAIL');assert.equal(r.result.checks.tokenEnvelope,'FAIL');assert.equal(r.calls.length,1);
 assert.equal(r.result.checks.tokenActive,'NOT_CHECKED');assert.equal(r.result.candidate,null);
});
for(const messages of [[documentedTokenInfo(),documentedTokenInfo()],[documentedTokenInfo(),{code:10001,message:secret}],[null],[secret],[[]]])
 test('multiple or malformed token info remains rejected '+JSON.stringify(messages),async()=>{
  const r=await run({mutate:(i,b)=>{if(i===0)b.messages=messages}});assert.equal(r.result.checks.tokenMessagesAllowed,'FAIL');assert.equal(r.calls.length,1);
 });
for(const index of [1,2,3,4])test('token info exception does not reach metadata endpoint '+index,async()=>{
 const r=await run({mutate:(i,b)=>{if(i===index)b.messages=[documentedTokenInfo()]}});
 assert.equal(r.result.status,'CANDIDATE_BLOCKED');assert.equal(r.calls.length,index+1);assert.equal(r.result.candidate,null);
});
for(const [name,change,key] of [
 ['identity',b=>b.result.id='f'.repeat(32),'tokenIdentity'],['success',b=>b.success=false,'tokenEnvelope'],
 ['errors',b=>b.errors=[{code:10000,message:secret}],'tokenEnvelope'],['active',b=>b.result.status='disabled','tokenActive'],
 ['expiry',b=>b.result.expires_on=new Date(now).toISOString(),'tokenTimes'],['notbefore',b=>b.result.not_before=new Date(now+1).toISOString(),'tokenTimes'],
 ['timestamp shape',b=>b.result.expires_on='2027-01-01','tokenExpiresShape'],['result keys',b=>b.result.extra=secret,'tokenResultFields']
])test('documented info never overrides token gate '+name,async()=>{
 const r=await run({mutate:(i,b)=>{if(i===0){b.messages=[documentedTokenInfo()];change(b)}}});
 assert.equal(r.result.status,'CANDIDATE_BLOCKED');assert.equal(r.result.checks[key],'FAIL');assert.equal(r.calls.length,1);assert.equal(r.result.candidate,null);
});
