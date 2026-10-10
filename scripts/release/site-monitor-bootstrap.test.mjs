import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createMonitorBootstrap,prepareMonitorBootstrap,prepareBootstrapContext} from './site-monitor-bootstrap.mjs';
import {createIntegrityMonitor,fingerprint} from './site-integrity-monitor.mjs';
const source='e'.repeat(40),version='10000000-0000-0000-0000-000000000000',deployment='20000000-0000-0000-0000-000000000000';
const settings={bindings:[]},scriptSettings={},resources={bindings:[]},subdomain={subdomain:'synthetic-only'};
const baseline=()=>({schemaVersion:2,status:'OWNER_APPROVED',selection:{runId:'1',runAttempt:1,artifactId:'2',sourceSha:'f'.repeat(40),digest:'sha256:'+'a'.repeat(64)},accountId:'a'.repeat(32),workerTag:'b'.repeat(32),credentialId:'c'.repeat(32),deploymentId:deployment,versionId:version,settingsSha256:fingerprint(settings),scriptSettingsSha256:fingerprint(scriptSettings),versionResourcesSha256:fingerprint(resources),accountSubdomainSha256:fingerprint(subdomain),zoneIds:['d'.repeat(32)],samples:[{path:'/',sha256:createHash('sha256').update('synthetic-public').digest('hex')}],checkpointRunId:null});
const env=()=>({SITE_MONITOR_AUTHORIZATION:'owner-approved-single-monitor-bootstrap',GITHUB_REPOSITORY:'Xpotato1024/xpotato-site',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_ACTOR:'Xpotato1024',GITHUB_TRIGGERING_ACTOR:'Xpotato1024',GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'20',GITHUB_SHA:source});
const context=(b=baseline())=>({env:env(),event:{inputs:{mode:'bootstrap',expected_source_sha:source}},baselineJson:JSON.stringify(b),runtimeGateJson:JSON.stringify({schemaVersion:1,status:'BOOTSTRAP_APPROVED',owner:'Xpotato1024',sourceSha:source,baselineSha256:fingerprint(b),actionsEmailConfirmed:true,slackConfirmed:true,checkpoint:null}),approval:{schemaVersion:1,status:'OWNER_APPROVED_BASELINE',baselineSha256:fingerprint(b)},checkedOutSha:source});
function fixture(options={},fault=()=>undefined){let lookups=0;const calls=[],c=context();const monitor=createMonitorBootstrap({...c,...options,credentialProvider:async()=>{lookups++;return 'synthetic-token-never-real'},fetchImpl:async(url,init)=>{
 calls.push({url,init});const u=new URL(url),override=fault(u);if(override)return override;
 if(u.origin!=='https://api.cloudflare.com')return new Response(u.hostname==='xpotato.net'?'synthetic-public':'not found',{status:u.hostname==='xpotato.net'?200:404});
 const p=u.pathname;let result;
 if(p.endsWith('/tokens/verify'))result={id:baseline().credentialId,status:'active'};
 else if(p.endsWith('/workers/scripts'))result=[{id:'xpotato-site',tag:baseline().workerTag}];
 else if(p.endsWith('/deployments'))return Response.json({success:true,errors:[],result:{deployments:[{id:deployment,strategy:'percentage',versions:[{version_id:version,percentage:100}]}]},result_info:{page:1,per_page:100,count:1,total_count:1,total_pages:1}});
 else if(p.endsWith('/script-settings'))result=scriptSettings;
 else if(p.endsWith('/settings'))result=settings;
 else if(p.includes('/versions/'))result={id:version,resources};
 else if(p.endsWith('/workers/domains'))return Response.json({success:true,errors:[],result:[{id:'synthetic-domain',service:'xpotato-site',hostname:'xpotato.net',environment:'production'}],result_info:{page:1,per_page:100,count:1,total_count:1,total_pages:1}});
 else if(p.endsWith('/workers/routes'))result=[];
 else if(p.endsWith('/workers/subdomain'))result=subdomain;
 else if(p.endsWith('/subdomain'))result={enabled:false,previews_enabled:false};
 else throw Error('private-marker');
 return Response.json({success:true,errors:[],result});
 }});return {monitor,calls,lookups:()=>lookups,c};}
test('approved bootstrap keeps baseline frozen, dispatches only 14 provider/3 public GET and never promotes checkpoint or schedule',async()=>{
 const f=fixture(),before=JSON.stringify(f.c);assert.equal(f.calls.length,0);assert.equal(f.lookups(),0);
 const r=await f.monitor.check();assert.equal(r.stage,'BOOTSTRAP_NO_SCHEDULE');assert.equal(r.status,'OBSERVED_MATCH');assert.deepEqual(r.requests,{providerGets:14,publicGets:3});assert.equal(r.deployAllowed,false);assert.equal(r.acceptance,false);assert.equal(r.providerMutations,0);assert.equal(JSON.stringify(f.c),before);
 assert.ok(f.calls.every(c=>c.init.method==='GET'&&c.init.redirect==='manual'));assert.ok(f.calls.filter(c=>!c.url.startsWith('https://api.cloudflare.com/')).every(c=>!c.init.headers.Authorization));assert.ok(!JSON.stringify(r).includes('synthetic-only'));
 await assert.rejects(f.monitor.check(),/ALREADY_ATTEMPTED/);assert.equal(f.calls.length,17);
});
for(const [key,value] of [['SITE_MONITOR_AUTHORIZATION','other'],['GITHUB_REPOSITORY','other/repo'],['GITHUB_REF','refs/heads/feature'],['GITHUB_EVENT_NAME','schedule'],['GITHUB_ACTOR','other'],['GITHUB_TRIGGERING_ACTOR','other'],['GITHUB_RUN_ATTEMPT','2'],['GITHUB_SHA','BAD']])test(`bootstrap context rejects ${key} before credentials or fetch`,()=>{
 let io=0;const c=context();c.env[key]=value;
 assert.throws(()=>createMonitorBootstrap({...c,credentialProvider:()=>{io++},fetchImpl:()=>{io++}}),/BOOTSTRAP_BLOCKED/);assert.equal(io,0);
});
for(const value of [undefined,null,42,'f'.repeat(40),'E'.repeat(40),'e'.repeat(39)])test(`bootstrap approved source rejects ${String(value)}`,()=>{
 const c=context();c.event.inputs.expected_source_sha=value;assert.throws(()=>prepareMonitorBootstrap(c),/BOOTSTRAP_BLOCKED/);
});
test('checkout mismatch, missing/extra input and malformed/budgeted JSON are rejected',()=>{
 for(const c of [{...context(),checkedOutSha:'f'.repeat(40)},{...context(),event:null},{...context(),event:{inputs:{...context().event.inputs,token:'private-marker'}}},{...context(),baselineJson:'{'},{...context(),baselineJson:' '.repeat(8193)}])assert.throws(()=>prepareMonitorBootstrap(c),/BOOTSTRAP_BLOCKED/);
});
for(const patch of [{status:'UNINITIALIZED'},{schemaVersion:1},{checkpointRunId:'10'},{samples:[...baseline().samples,{path:'/extra/',sha256:'f'.repeat(64)}]},{samples:[{path:'/extra/',sha256:'f'.repeat(64)}]},{credentialId:'private-token-marker'},{unexpected:'private-marker'}])test('bootstrap refuses incompatible baseline even if fingerprint is approved '+Object.keys(patch).join(','),()=>{
 const c=context({...baseline(),...patch});assert.throws(()=>prepareMonitorBootstrap(c),/BOOTSTRAP_BLOCKED/);
});
test('baseline mutation after owner hash adoption cannot reach credentials',()=>{
 const c=context();c.baselineJson=JSON.stringify({...baseline(),workerTag:'d'.repeat(32)});assert.throws(()=>prepareMonitorBootstrap(c),/BOOTSTRAP_BLOCKED/);
 for(const approval of [{...c.approval,status:'COMPARISON_REFERENCE_OWNER_APPROVED'},{...c.approval,baselineSha256:'0'.repeat(64)},{...c.approval,token:'private-marker'},null])assert.throws(()=>prepareMonitorBootstrap({...context(),approval}),/BOOTSTRAP_BLOCKED/);
});
test('public cap3 rejects a second sample before any authentication or IO',()=>{
 let io=0;const b=baseline();b.samples.push({path:'/extra/',sha256:'f'.repeat(64)});
 assert.throws(()=>createIntegrityMonitor({baseline:b,maxPublicGets:3,credentialProvider:()=>{io++},fetchImpl:()=>{io++}}),/CONFIGURATION/);assert.equal(io,0);
 for(const maxPublicGets of [null,0,2,11,3.5,'3'])assert.throws(()=>createIntegrityMonitor({baseline:baseline(),maxPublicGets,credentialProvider:()=>{},fetchImpl:()=>{}}),/CONFIGURATION/);
});
test('403 consumes the sole factory attempt, reflects no body and does not retry or adopt',async()=>{
 const f=fixture({},()=>new Response('private-marker',{status:403})),r=await f.monitor.check();assert.equal(r.status,'INCIDENT_OWNER_ACTION_REQUIRED');assert.deepEqual(r.requests,{providerGets:1,publicGets:0});assert.ok(!JSON.stringify(r).includes('private-marker'));assert.equal(r.providerMutations,0);await assert.rejects(f.monitor.check(),/ALREADY_ATTEMPTED/);assert.equal(f.calls.length,1);
});
test('workflow preregisters cron but both jobs require the owner runtime gate and pinned source',()=>{
 const w=readFileSync(new URL('../../.github/workflows/site-integrity-monitor.yml',import.meta.url),'utf8').replaceAll('\r\n','\n');
 const boot=w.split('  bootstrap:\n')[1].split('  observe:\n')[0],observe=w.split('  observe:\n')[1];
 const guard=boot.match(/^    if: \$\{\{ (.+) \}\}$/m)[1];
 const github={repository:'Xpotato1024/xpotato-site',event_name:'workflow_dispatch',ref:'refs/heads/main',actor:'Xpotato1024',triggering_actor:'Xpotato1024',run_attempt:1,sha:source},inputs={mode:'bootstrap',expected_source_sha:source};
 const allows=(g={},i={},gate=context().runtimeGateJson)=>runInNewContext(guard,{github:{...github,...g},inputs:{...inputs,...i},vars:{SITE_MONITOR_RUNTIME_GATE_JSON:gate},fromJSON:JSON.parse},{timeout:100});
 assert.equal(allows(),true);for(const patch of [{repository:'other'},{event_name:'schedule'},{ref:'refs/heads/feature'},{actor:'other'},{triggering_actor:'other'},{run_attempt:2},{sha:'f'.repeat(40)}])assert.equal(allows(patch),false);
 for(const patch of [{mode:'other'},{expected_source_sha:undefined},{expected_source_sha:'f'.repeat(40)}])assert.equal(allows({},patch),false);
 assert.equal(allows({}, {}, ''),false);assert.equal(allows({}, {}, JSON.stringify({status:'ACTIVE',sourceSha:source})),false);
 assert.match(boot,/ref: \$\{\{ github.sha \}\}/);assert.match(observe,/event_name == 'schedule'/);assert.match(observe,/status == 'ACTIVE'/);assert.match(w,/cron: '2-57\/5 \* \* \* \*'/);assert.doesNotMatch(w,/contents: write|actions: write|wrangler|self-hosted|CLOUDFLARE_SITE_API_TOKEN|upload-artifact|approved_baseline:/);
 assert.ok(!boot.includes('${{ inputs.approved_baseline }}'));assert.match(boot,/site-monitor-bootstrap-cli.mjs/);
 const approval=JSON.parse(readFileSync(new URL('../../docs/operations/site-monitor-bootstrap-approval.json',import.meta.url),'utf8'));assert.deepEqual(Object.keys(approval).sort(),['baselineSha256','schemaVersion','status']);
});
async function cliRun({patchEnv={},patchEvent={},patchApproval={},checkedOutSha=source,eventBytes,approvalBytes,args,baselineJson=context().baselineJson,runtimeGateJson=context().runtimeGateJson}={}){
 const c=context(),environment={...c.env,GITHUB_EVENT_PATH:'event',SITE_MONITOR_RUNTIME_GATE_JSON:runtimeGateJson,...patchEnv};let lookups=0,baselineLookups=0,gets=0,gitReads=0;const out=[],err=[];
 Object.defineProperty(environment,'SITE_MONITOR_APPROVED_BASELINE_JSON',{get(){baselineLookups++;return baselineJson}});
 Object.defineProperty(environment,'CLOUDFLARE_SITE_MONITOR_READ_TOKEN',{get(){lookups++;return 'synthetic-token-never-real'}});
 const files={event:eventBytes??JSON.stringify({inputs:{...c.event.inputs,...patchEvent}}),approval:approvalBytes??JSON.stringify({...c.approval,...patchApproval})};
 const script=readFileSync(new URL('./site-monitor-bootstrap-cli.mjs',import.meta.url),'utf8').replace(/^import .+;\r?$/gm,'').replaceAll('import.meta.url',JSON.stringify(new URL('./site-monitor-bootstrap-cli.mjs',import.meta.url).href));
 const process={env:environment,argv:args??['node','cli','approval'],exitCode:0};
 await runInNewContext(script,{process,Buffer,URL,fileURLToPath,validateBootstrapContext:createContextValidator,prepareBootstrapContext,createMonitorBootstrap,
  stat:async path=>({isFile:()=>true,size:Buffer.byteLength(files[path])}),readFile:async path=>Buffer.from(files[path]),
  execFileSync:(command,args,options)=>{gitReads++;assert.equal(command,'git');assert.deepEqual(Array.from(args),['rev-parse','HEAD']);assert.equal(options.windowsHide,true);return checkedOutSha+'\n'},
  fetch:async()=>{gets++;return new Response('private-marker',{status:403})},console:{log:s=>out.push(s),error:s=>err.push(s)}
 },{timeout:1000});return {lookups,baselineLookups,gets,gitReads,out,err,exitCode:process.exitCode};
}
// Use the real validator and library with a mocked filesystem, Git and fetch.
import {validateBootstrapContext as createContextValidator} from './site-monitor-bootstrap.mjs';
test('actual CLI reaches one synthetic GET only after approved context, checkout and baseline hash',async()=>{
 const r=await cliRun();assert.equal(r.lookups,1);assert.equal(r.gets,1);assert.equal(r.gitReads,1);assert.equal(r.exitCode,1);assert.equal(r.err.length,0);
 const receipt=JSON.parse(r.out[0]);assert.equal(receipt.stage,'BOOTSTRAP_NO_SCHEDULE');assert.equal(receipt.status,'INCIDENT_OWNER_ACTION_REQUIRED');assert.deepEqual(receipt.requests,{providerGets:1,publicGets:0});assert.ok(!r.out.join('').includes('private-marker'));
});
for(const [name,options] of [
 ['other actor',{patchEnv:{GITHUB_ACTOR:'other'}}],['other triggering actor',{patchEnv:{GITHUB_TRIGGERING_ACTOR:'other'}}],['schedule',{patchEnv:{GITHUB_EVENT_NAME:'schedule'}}],['rerun',{patchEnv:{GITHUB_RUN_ATTEMPT:'2'}}],
 ['changed source',{patchEvent:{expected_source_sha:'f'.repeat(40)}}],['omitted source',{patchEvent:{expected_source_sha:undefined}}],['wrong source type',{patchEvent:{expected_source_sha:42}}],['changed checkout',{checkedOutSha:'f'.repeat(40)}],
 ['changed approval',{patchApproval:{baselineSha256:'0'.repeat(64)}}],['malformed baseline',{baselineJson:'private-marker'}],['extra baseline input',{patchEvent:{approved_baseline:'private-marker'}}],
 ['missing baseline',{baselineJson:null}],['oversized baseline',{baselineJson:' '.repeat(8193)}],['closed runtime gate',{runtimeGateJson:''}],['missing run ID',{patchEnv:{GITHUB_RUN_ID:undefined}}],
 ['oversized event',{eventBytes:' '.repeat(1048577)}],['oversized approval',{approvalBytes:' '.repeat(1025)}],['missing argv',{args:['node','cli']}]
])test('actual CLI blocks '+name+' before secret getter/fetch without exposing values',async()=>{
 const r=await cliRun(options);assert.equal(r.lookups,0);assert.equal(r.gets,0);assert.equal(r.exitCode,1);assert.equal(r.out.length,0);assert.deepEqual(r.err,['MONITOR_BOOTSTRAP_BLOCKED: no retry, no schedule, owner review required.']);
});
