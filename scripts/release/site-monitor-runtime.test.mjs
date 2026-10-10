import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {fingerprint,assessMonitorHistory} from './site-integrity-monitor.mjs';
import {prepareApprovedBaseline,prepareRuntimeGate,prepareObservationContext,validateRuntimeContext,boundedRuntimeJson} from './site-monitor-runtime.mjs';
import {createRuntimeHistoryPreflight,createRuntimeObservation} from './site-monitor-runtime-history.mjs';
const sha='e'.repeat(40),repo='Xpotato1024/xpotato-site',now=Date.parse('2026-10-10T00:10:00Z');
const baseline=()=>({schemaVersion:2,status:'OWNER_APPROVED',selection:{runId:'1',runAttempt:1,artifactId:'2',sourceSha:'f'.repeat(40),digest:'sha256:'+'a'.repeat(64)},accountId:'a'.repeat(32),workerTag:'b'.repeat(32),credentialId:'c'.repeat(32),deploymentId:'20000000-0000-0000-0000-000000000000',versionId:'10000000-0000-0000-0000-000000000000',settingsSha256:'1'.repeat(64),scriptSettingsSha256:'2'.repeat(64),versionResourcesSha256:'3'.repeat(64),accountSubdomainSha256:'4'.repeat(64),zoneIds:['d'.repeat(32)],samples:[{path:'/',sha256:'5'.repeat(64)}],checkpointRunId:null});
const approval=()=>({schemaVersion:1,status:'OWNER_APPROVED_BASELINE',baselineSha256:fingerprint(baseline())});
const gate=()=>({schemaVersion:1,status:'ACTIVE',owner:'Xpotato1024',sourceSha:sha,baselineSha256:approval().baselineSha256,actionsEmailConfirmed:true,slackConfirmed:true,checkpoint:{runId:'10',runAttempt:1,event:'workflow_dispatch',sourceSha:sha,createdAt:'2026-10-10T00:00:00Z',completedAt:'2026-10-10T00:00:30Z'}});
const env=()=>({SITE_MONITOR_AUTHORIZATION:'separately-approved-readonly-monitor',GITHUB_REPOSITORY:repo,GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'schedule',GITHUB_ACTOR:'Xpotato1024',GITHUB_TRIGGERING_ACTOR:'Xpotato1024',GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'30',GITHUB_SHA:sha});
const run=(id,created,event='schedule')=>({id,run_attempt:1,repository:{full_name:repo},path:'.github/workflows/site-integrity-monitor.yml',head_branch:'main',head_sha:sha,event,actor:{login:'Xpotato1024'},triggering_actor:{login:'Xpotato1024'},status:'completed',conclusion:'success',created_at:created,updated_at:created});
function historyFixture(){
 const checkpoint={...run('10','2026-10-10T00:00:00Z','workflow_dispatch'),updated_at:'2026-10-10T00:00:30Z'},previous=run('20','2026-10-10T00:05:00Z'),current={...run('30','2026-10-10T00:10:00Z'),status:'in_progress',conclusion:null};
 const job=(run_id,name,conclusion,stamp)=>({run_id,head_sha:sha,name,status:'completed',conclusion,started_at:stamp,completed_at:stamp});
 const calls=[],f={checkpoint,previous,current,runs:[checkpoint,previous,current],jobs:{total_count:2,jobs:[job('10','bootstrap','success',checkpoint.created_at),job('10','observe','skipped',checkpoint.created_at)]},previousJobs:{total_count:2,jobs:[job('20','observe','success',previous.created_at),job('20','bootstrap','skipped',previous.created_at)]},override:()=>undefined,githubLookups:0,now};
 const fetchImpl=async(url,options)=>{calls.push(url);assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');assert.equal(new URL(url).origin,'https://api.github.com');const replacement=f.override(new URL(url));if(replacement)return replacement;const p=new URL(url).pathname;return Response.json(p.endsWith('/runs/10/attempts/1/jobs')?f.jobs:p.endsWith('/jobs')?f.previousJobs:p.endsWith('/runs/30')?f.current:p.endsWith('/runs/10')?f.checkpoint:{total_count:f.runs.length,workflow_runs:f.runs})};
 f.preflight=createRuntimeHistoryPreflight({credentialProvider:async()=>{f.githubLookups++;return 'synthetic-github-token'},fetchImpl,clock:()=>f.now});f.calls=calls;return f;
}
test('bounded Secret accepts reordered/whitespace JSON with unchanged digest and never edits checkpoint or artifact executor SHA',()=>{
 const b=baseline(),text='\n '+JSON.stringify(Object.fromEntries(Object.entries(b).reverse()))+'\n';
 const prepared=prepareApprovedBaseline(text,approval());assert.deepEqual(prepared,b);assert.equal(prepared.checkpointRunId,null);assert.notEqual(prepared.selection.sourceSha,gate().sourceSha);assert.deepEqual(b,baseline());
});
for(const value of [undefined,null,42,{},'','private-marker','[]','null',' '.repeat(8193),'あ'.repeat(2731)])test('bounded Secret rejects missing/type/malformed/oversized value '+typeof value+':'+String(value).length,()=>{
 assert.throws(()=>prepareApprovedBaseline(value,approval()),/^Error: MONITOR_RUNTIME_BLOCKED$/);
});
for(const patch of [{checkpointRunId:'10'},{status:'UNINITIALIZED'},{schemaVersion:1},{unexpected:'private-marker'},{samples:[{path:'/other/',sha256:'a'.repeat(64)}]}])test('hash approval cannot admit incompatible private baseline '+Object.keys(patch),()=>{
 const b={...baseline(),...patch};assert.throws(()=>prepareApprovedBaseline(JSON.stringify(b),{...approval(),baselineSha256:fingerprint(b)}),/RUNTIME_BLOCKED/);
});
test('private baseline mutation fails digest while mutable runtime checkpoint leaves baseline digest unchanged',()=>{
 const b=baseline();assert.throws(()=>prepareApprovedBaseline(JSON.stringify({...b,workerTag:'0'.repeat(32)}),approval()),/BLOCKED/);
 const g=gate();g.checkpoint.runId='11';prepareRuntimeGate({runtimeGateJson:JSON.stringify(g),approval:approval(),sourceSha:sha,phase:'ACTIVE'});assert.equal(fingerprint(b),approval().baselineSha256);
});
for(const patch of [{status:'DISABLED'},{status:'BOOTSTRAP_APPROVED'},{sourceSha:'f'.repeat(40)},{owner:'other'},{actionsEmailConfirmed:false},{slackConfirmed:false},{baselineSha256:'0'.repeat(64)},{checkpoint:null},{unexpected:true}])test('continuous runtime gate refuses '+Object.keys(patch),()=>{
 assert.throws(()=>prepareObservationContext({env:env(),approval:approval(),checkedOutSha:sha,runtimeGateJson:JSON.stringify({...gate(),...patch})}),/BLOCKED/);
});
for(const patch of [{runId:'0'},{runAttempt:2},{event:'schedule'},{sourceSha:'f'.repeat(40)},{createdAt:'2026-02-30T00:00:00Z'},{completedAt:'2026-10-09T00:00:00Z'},{token:'private-marker'}])test('separate checkpoint rejects '+Object.keys(patch),()=>{
 assert.throws(()=>prepareRuntimeGate({runtimeGateJson:JSON.stringify({...gate(),checkpoint:{...gate().checkpoint,...patch}}),approval:approval(),sourceSha:sha,phase:'ACTIVE'}),/BLOCKED/);
});
test('runtime gate parser is bounded UTF8 and default closed',()=>{for(const text of ['',undefined,'{}','null','[]',' '.repeat(4097),'あ'.repeat(1366)])assert.throws(()=>prepareRuntimeGate({runtimeGateJson:text,approval:approval(),sourceSha:sha,phase:'ACTIVE'}),/BLOCKED/);assert.throws(()=>boundedRuntimeJson('あ'.repeat(2),5),/BLOCKED/)});
test('history validates current run and successful bootstrap job, excludes only current in-progress run; baseline remains frozen',async()=>{
 const f=historyFixture(),b=baseline(),before=JSON.stringify(b);assert.deepEqual(await f.preflight({baseline:b,gate:gate(),currentRunId:'30'}),{status:'MONITOR_RUNTIME_HISTORY_CONSISTENT'});assert.equal(JSON.stringify(b),before);assert.equal(f.calls.length,6);assert.ok(f.calls.every(v=>v.startsWith('https://api.github.com/')));
});
const historyFaults=[
 ['past failure',f=>{f.previous.conclusion='failure'}],['past skip',f=>{f.previous.conclusion='skipped'}],['past cancelled',f=>{f.previous.conclusion='cancelled'}],['past pending',f=>{f.previous.status='in_progress';f.previous.conclusion=null}],['past rerun',f=>{f.previous.run_attempt=2}],
 ['workflow success but observe skipped',f=>{f.previousJobs.jobs[0].conclusion='skipped'}],['workflow success but observe missing',f=>{f.previousJobs={total_count:1,jobs:[f.previousJobs.jobs[1]]}}],['workflow success but observe failed',f=>{f.previousJobs.jobs[0].conclusion='failure'}],['prior jobs wrong run',f=>{f.previousJobs.jobs[0].run_id='10'}],['prior jobs wrong source',f=>{f.previousJobs.jobs[0].head_sha='f'.repeat(40)}],['prior jobs duplicated',f=>{f.previousJobs.jobs[1]={...f.previousJobs.jobs[0]}}],['prior jobs unknown timestamp',f=>{f.previousJobs.jobs[0].completed_at=null}],['prior jobs truncated',f=>{f.previousJobs.total_count=3}],['later manual bootstrap',f=>{f.previous.event='workflow_dispatch'}],
 ['current rerun',f=>{f.current.run_attempt=2}],['current wrong event',f=>{f.current.event='workflow_dispatch'}],['current wrong source',f=>{f.current.head_sha='f'.repeat(40)}],['current wrong owner',f=>{f.current.actor.login='other'}],['current wrong triggering owner',f=>{f.current.triggering_actor.login='other'}],['current missing',f=>{f.runs=f.runs.filter(v=>v.id!=='30')}],
 ['history current rerun race',f=>{f.runs=[f.checkpoint,f.previous,{...f.current,run_attempt:2}]}],['history other source',f=>{f.previous.head_sha='f'.repeat(40)}],['history duplicate',f=>{f.runs.push(f.previous)}],
 ['bootstrap failure',f=>{f.checkpoint.conclusion='failure'}],['bootstrap rerun',f=>{f.checkpoint.run_attempt=2}],['bootstrap wrong event',f=>{f.checkpoint.event='schedule'}],['bootstrap timestamp drift',f=>{f.checkpoint.updated_at='2026-10-10T00:00:31Z'}],['bootstrap job failure',f=>{f.jobs.jobs[0].conclusion='failure'}],['bootstrap jobs truncated',f=>{f.jobs.total_count=3}],['unexpected job',f=>{f.jobs.jobs[1].name='other'}],
 ['gap exactly over600 seconds',f=>{f.runs=[{...f.checkpoint,created_at:'2026-10-09T23:59:59Z'},f.current];f.checkpoint.created_at='2026-10-09T23:59:59Z'}],['github403',f=>{f.override=()=>new Response('private-body-marker',{status:403})}],['github malformed',f=>{f.override=()=>new Response('private-body-marker',{headers:{'content-type':'application/json'}})}]
];
for(const [name,mutate] of historyFaults)test('history '+name+' blocks CF credential and provider IO; sole attempt consumed',async()=>{
 const f=historyFixture();mutate(f);let cf=0,gets=0;
 const monitor=createRuntimeObservation({baseline:baseline(),gate:gate(),currentRunId:'30',historyPreflight:f.preflight,credentialProvider:()=>{cf++},fetchImpl:()=>{gets++},clock:()=>now});
 await assert.rejects(monitor.check());assert.equal(cf,0);assert.equal(gets,0);await assert.rejects(monitor.check(),/ALREADY_ATTEMPTED/);
});
test('600-second inclusive boundary accepted; older latest run or latched gap fails despite later success',()=>{
 const normalize=v=>({id:String(v.id),runAttempt:v.run_attempt,repository:repo,path:v.path,headBranch:v.head_branch,event:v.event,status:v.status,conclusion:v.conclusion,createdAt:v.created_at,completedAt:v.updated_at});
 const runs=[run('10','2026-10-10T00:00:00Z','workflow_dispatch')].map(normalize),e={baseline:baseline(),checkpointRunId:'10',runs,totalCount:1,observedAt:new Date(now).toISOString()};assert.equal(assessMonitorHistory(e,now).deployAllowed,true);assert.throws(()=>assessMonitorHistory({...e,observedAt:new Date(now+1).toISOString()},now+1),/STALE/);
 const gap=[run('10','2026-10-09T23:49:59Z','workflow_dispatch'),run('20','2026-10-10T00:00:00Z'),run('40','2026-10-10T00:10:00Z')].map(normalize);assert.throws(()=>assessMonitorHistory({...e,runs:gap,totalCount:3},now),/COVERAGE_GAP/);
});
test('same timestamp selects greatest run ID as predecessor, so its hidden job skip cannot be bypassed by API ordering',async()=>{
 const f=historyFixture(),skipped={...f.previous,id:'25'};f.runs=[f.checkpoint,skipped,f.previous,f.current];
 f.override=url=>url.pathname.endsWith('/runs/25/attempts/1/jobs')?Response.json({total_count:1,jobs:[{...f.previousJobs.jobs[0],run_id:'25',conclusion:'skipped'}]}):undefined;
 await assert.rejects(f.preflight({baseline:baseline(),gate:gate(),currentRunId:'30'}),/BLOCKED/);
 assert.ok(f.calls.some(v=>v.includes('/runs/25/attempts/1/jobs')));assert.ok(!f.calls.some(v=>v.includes('/runs/20/attempts/1/jobs')));
});
test('one day of complete pinned history reuses predecessor proof with only two jobs GETs',async()=>{
 const f=historyFixture(),start=Date.parse(f.checkpoint.created_at),iso=t=>new Date(t).toISOString().replace('.000Z','Z');
 const prior=Array.from({length:287},(_,i)=>run(String(11+i),iso(start+(i+1)*300000)));
 f.previous=prior.at(-1);f.current={...run('1000',iso(start+86400000)),status:'in_progress',conclusion:null};f.now=start+86400000;f.runs=[f.checkpoint,...prior,f.current];
 f.previousJobs={total_count:1,jobs:[{...f.previousJobs.jobs[0],run_id:f.previous.id,started_at:f.previous.created_at,completed_at:f.previous.updated_at}]};
 f.override=url=>{
  if(url.pathname.endsWith('/runs/1000'))return Response.json(f.current);
  if(url.pathname.endsWith('/site-integrity-monitor.yml/runs')){
   const [lower,upper]=url.searchParams.get('created').split('..').map(Date.parse),page=Number(url.searchParams.get('page')),rows=f.runs.filter(v=>Date.parse(v.created_at)>=lower&&Date.parse(v.created_at)<=upper);
   return Response.json({total_count:rows.length,workflow_runs:rows.slice((page-1)*100,page*100)});
  }
 };
 const result=await f.preflight({baseline:baseline(),gate:gate(),currentRunId:'1000'});assert.equal(result.status,'MONITOR_RUNTIME_HISTORY_CONSISTENT');assert.equal(f.calls.filter(v=>v.includes('/attempts/1/jobs')).length,2);assert.equal(f.calls.length,9);
});
test('equal UTC timestamps with different fractional representation still reject current run behind predecessor ID',async()=>{
 const f=historyFixture();f.current={...f.current,id:'15',created_at:'2026-10-10T00:05:00.000Z'};f.runs=[f.checkpoint,f.previous,f.current];f.override=url=>url.pathname.endsWith('/runs/15')?Response.json(f.current):undefined;
 await assert.rejects(f.preflight({baseline:baseline(),gate:gate(),currentRunId:'15'}),/RUNTIME_HISTORY_BLOCKED/);
});
test('hidden predecessor skip makes next actual CLI fail, and that failure stays latched after later success',async()=>{
 const skipped=await cliRun({mutateHistory:f=>{f.previousJobs.jobs[0].conclusion='skipped'}});
 assert.equal(skipped.exitCode,1);assert.equal(skipped.cfReads,0);assert.equal(skipped.providerGets,0);
 const f=historyFixture(),failed={...f.current,status:'completed',conclusion:skipped.exitCode===1?'failure':'success'};f.current={...f.current,id:'40'};f.runs=[f.checkpoint,f.previous,failed,run('35','2026-10-10T00:10:00Z'),f.current];f.override=url=>url.pathname.endsWith('/runs/40')?Response.json(f.current):undefined;
 let cf=0;const monitor=createRuntimeObservation({baseline:baseline(),gate:gate(),currentRunId:'40',historyPreflight:f.preflight,credentialProvider:()=>{cf++},fetchImpl:()=>{cf++},clock:()=>now});await assert.rejects(monitor.check(),/INCIDENT_LATCHED/);assert.equal(cf,0);
});
async function cliRun({patchEnv={},runtimeGateJson=JSON.stringify(gate()),baselineJson=JSON.stringify(baseline()),checkedOutSha=sha,mutateHistory=()=>{},approvalJson=JSON.stringify(approval()),args}={}){
 const f=historyFixture();mutateHistory(f);let baselineReads=0,cfReads=0,githubReads=0,providerGets=0;const logs=[],errors=[];
 const environment={...env(),SITE_MONITOR_RUNTIME_GATE_JSON:runtimeGateJson,...patchEnv};
 Object.defineProperty(environment,'SITE_MONITOR_APPROVED_BASELINE_JSON',{get(){baselineReads++;return baselineJson}});
 Object.defineProperty(environment,'CLOUDFLARE_SITE_MONITOR_READ_TOKEN',{get(){cfReads++;return 'synthetic-cloudflare-token'}});
 Object.defineProperty(environment,'GITHUB_TOKEN',{get(){githubReads++;return 'synthetic-github-token'}});
 const code=readFileSync(new URL('./site-integrity-monitor-cli.mjs',import.meta.url),'utf8').replace(/^import .+;\r?$/gm,'').replaceAll('import.meta.url',JSON.stringify(new URL('./site-integrity-monitor-cli.mjs',import.meta.url).href));
 const fakeProcess={env:environment,argv:args??['node','cli','approval'],exitCode:0};
 await runInNewContext(code,{process:fakeProcess,Buffer,URL,fileURLToPath,prepareObservationContext,prepareApprovedBaseline,validateRuntimeContext,
  createRuntimeHistoryPreflight:options=>createRuntimeHistoryPreflight({...options,clock:()=>now,fetchImpl:async(url,init)=>{
   f.githubLookups++;f.calls.push(url);assert.equal(init.method,'GET');const replacement=f.override(new URL(url));if(replacement)return replacement;
   const p=new URL(url).pathname;return Response.json(p.endsWith('/runs/10/attempts/1/jobs')?f.jobs:p.endsWith('/jobs')?f.previousJobs:p.endsWith('/runs/30')?f.current:p.endsWith('/runs/10')?f.checkpoint:{total_count:f.runs.length,workflow_runs:f.runs});
  }}),createRuntimeObservation:options=>createRuntimeObservation({...options,clock:()=>now}),
  stat:async()=>({isFile:()=>true,size:Buffer.byteLength(approvalJson)}),readFile:async()=>Buffer.from(approvalJson),execFileSync:()=>checkedOutSha+'\n',fetch:async()=>{providerGets++;return new Response('private-body-marker',{status:403})},console:{log:v=>logs.push(v),error:v=>errors.push(v)}
 },{timeout:1000});return {baselineReads,cfReads,githubReads,providerGets,logs,errors,exitCode:fakeProcess.exitCode};
}
test('actual continuous CLI reads private baseline once, then GitHub evidence, then one synthetic CF GET; outputs only fixed receipt',async()=>{
 const r=await cliRun();assert.equal(r.baselineReads,1);assert.equal(r.githubReads,6);assert.equal(r.cfReads,1);assert.equal(r.providerGets,1);assert.equal(r.exitCode,1);assert.equal(r.errors.length,0);const receipt=JSON.parse(r.logs[0]);assert.equal(receipt.stage,'CONTINUOUS_READONLY');assert.deepEqual(receipt.requests,{providerGets:1,publicGets:0});assert.equal(receipt.deployAllowed,false);for(const marker of [baseline().accountId,baseline().workerTag,'private-body-marker','synthetic-cloudflare-token'])assert.ok(!r.logs.join('').includes(marker));
});
for(const [name,options] of [
 ['gate missing',{runtimeGateJson:''}],['gate malformed',{runtimeGateJson:'private-marker'}],['checkout moved',{checkedOutSha:'f'.repeat(40)}],['actor changed',{patchEnv:{GITHUB_ACTOR:'other'}}],['triggering actor changed',{patchEnv:{GITHUB_TRIGGERING_ACTOR:'other'}}],['rerun',{patchEnv:{GITHUB_RUN_ATTEMPT:'2'}}],['manual trigger',{patchEnv:{GITHUB_EVENT_NAME:'workflow_dispatch'}}],['missing runID',{patchEnv:{GITHUB_RUN_ID:undefined}}],['missing argv',{args:['node','cli']}],['oversized approval',{approvalJson:' '.repeat(1025)}]
])test('actual continuous CLI '+name+' stops before baseline/GitHub/CF credentials',async()=>{const r=await cliRun(options);assert.equal(r.baselineReads,0);assert.equal(r.githubReads,0);assert.equal(r.cfReads,0);assert.equal(r.providerGets,0);assert.equal(r.logs.length,0);assert.equal(r.exitCode,1);assert.equal(r.errors.length,1);assert.ok(!r.errors[0].includes('private-marker'))});
for(const value of [null,'private-marker',' '.repeat(8193),JSON.stringify({...baseline(),workerTag:'0'.repeat(32)})])test('actual continuous CLI Secret missing/malformed/oversized/hash mismatch stops before GitHub and CF',async()=>{const r=await cliRun({baselineJson:value});assert.equal(r.baselineReads,1);assert.equal(r.githubReads,0);assert.equal(r.cfReads,0);assert.equal(r.providerGets,0);assert.equal(r.logs.length,0);assert.equal(r.exitCode,1)});
for(const [name,mutate] of historyFaults)test('actual continuous CLI history '+name+' stops before CF and does not disclose private response',async()=>{const r=await cliRun({mutateHistory:mutate});assert.equal(r.cfReads,0);assert.equal(r.providerGets,0);assert.equal(r.logs.length,0);assert.equal(r.exitCode,1);assert.deepEqual(r.errors,['MONITOR_RUNTIME_BLOCKED: STOP deployment; no retry, checkpoint reset or automatic rebootstrap; owner review required.'])});
test('actual workflow observation defaults closed, requires ACTIVE/source/context and has no private dispatch input or artifact',()=>{
 const text=readFileSync(new URL('../../.github/workflows/site-integrity-monitor.yml',import.meta.url),'utf8').replaceAll('\r\n','\n'),observe=text.split('  observe:\n')[1],expression=observe.match(/^    if: \$\{\{ (.+) \}\}$/m)[1];
 const github={repository:repo,event_name:'schedule',ref:'refs/heads/main',actor:'Xpotato1024',triggering_actor:'Xpotato1024',run_attempt:1,sha};
 const allows=(g={},value=JSON.stringify(gate()))=>runInNewContext(expression,{github:{...github,...g},vars:{SITE_MONITOR_RUNTIME_GATE_JSON:value},fromJSON:JSON.parse},{timeout:100});
 assert.equal(allows(),true);for(const value of ['', '{}',JSON.stringify({status:'BOOTSTRAP_APPROVED',sourceSha:sha}),JSON.stringify({status:'ACTIVE',sourceSha:'f'.repeat(40)})])assert.equal(allows({},value),false);
 for(const patch of [{repository:'other'},{event_name:'workflow_dispatch'},{ref:'refs/heads/other'},{actor:'other'},{triggering_actor:'other'},{run_attempt:2},{sha:'f'.repeat(40)}])assert.equal(allows(patch),false);
 assert.match(observe,/ref: \$\{\{ github.sha \}\}/);assert.match(observe,/secrets.SITE_MONITOR_APPROVED_BASELINE_JSON/);assert.match(observe,/GITHUB_TOKEN: \$\{\{ github.token \}\}/);assert.doesNotMatch(text,/approved_baseline:|upload-artifact|download-artifact|contents: write|actions: write|id-token:|pull_request_target:/);
});
