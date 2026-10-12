import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {stat,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareApprovedBaseline,validateRuntimeContext,boundedRuntimeJson} from './site-monitor-runtime.mjs';
import {prepareTrialGate,trialAdmission,createTrialPreflight,createTrialObservation} from './site-monitor-trial.mjs';
import {prepareFiniteTrialGate,createFiniteTrialPreflight,createFiniteTrialObservation} from './site-monitor-finite.mjs';
import {reserveFiniteReadAttempt} from './site-monitor-evidence.mjs';
import {source,T,E,at,fixture} from './site-monitor-finite-fixture.mjs';
const url=new URL('./site-integrity-monitor-cli.mjs',import.meta.url);
const code=readFileSync(url,'utf8').replace(/^import[^\n]*\n/gm,'').replaceAll('import.meta.url',JSON.stringify(url.href));
async function cli(f,dir,patch={}){
 const reads={baseline:0,github:0,cf:0},outputs=[],logs=[];
 const env=new Proxy({SITE_MONITOR_AUTHORIZATION:'separately-approved-readonly-monitor',GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'Xpotato1024/xpotato-site',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'schedule',GITHUB_ACTOR:'Xpotato1024',GITHUB_TRIGGERING_ACTOR:'Xpotato1024',GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'1000',GITHUB_RUN_NUMBER:'10',GITHUB_SHA:source,GITHUB_WORKFLOW_SHA:source,GITHUB_WORKFLOW_REF:'Xpotato1024/xpotato-site/.github/workflows/site-integrity-monitor.yml@refs/heads/main',GITHUB_OUTPUT:'fake-output',RUNNER_TEMP:dir,SITE_MONITOR_RUNTIME_GATE_JSON:JSON.stringify(f.gate),SITE_MONITOR_APPROVED_BASELINE_JSON:JSON.stringify(f.b),GITHUB_TOKEN:'synthetic-github-token',CLOUDFLARE_SITE_MONITOR_READ_TOKEN:'synthetic-provider-token',...patch},{get:(t,k)=>{if(k==='SITE_MONITOR_APPROVED_BASELINE_JSON')reads.baseline++;if(k==='GITHUB_TOKEN')reads.github++;if(k==='CLOUDFLARE_SITE_MONITOR_READ_TOKEN')reads.cf++;return t[k]}});
 const process={argv:['node','cli','public-approval'],env,exitCode:0};
 class Clock extends Date{static now(){return f.clock()}}
 await runInNewContext(code,{process,Date:Clock,JSON,URL,Buffer,console:{log:v=>logs.push(v),error:v=>logs.push(v)},fileURLToPath,resolve,join,stat:async()=>({isFile:()=>true,size:1024}),readFile:async p=>Buffer.from(JSON.stringify(p instanceof URL?f.audit:{schemaVersion:1,status:'OWNER_APPROVED_BASELINE',baselineSha256:f.gate.baselineSha256})),appendFile:async(p,v)=>outputs.push(v),execFileSync:()=>source,prepareApprovedBaseline,validateRuntimeContext,boundedRuntimeJson,prepareTrialGate,trialAdmission,createTrialPreflight,createTrialObservation,prepareFiniteTrialGate,reserveFiniteReadAttempt:o=>reserveFiniteReadAttempt({...o,clock:f.clock}),createFiniteTrialPreflight:o=>createFiniteTrialPreflight({...o,clock:f.clock}),createFiniteTrialObservation:o=>createFiniteTrialObservation({...o,clock:f.clock}),fetch:f.fetchImpl});
 return {exitCode:process.exitCode,reads,outputs,logs};
}
test('actual observation CLI enters schema4 despite tracked PROPOSED, then denies duplicate before credentials',async()=>{
 const f=fixture(),dir=mkdtempSync(join(tmpdir(),'finite-cli-'));
 f.rows.push({...f.raw(1000,10,source,'schedule',T,at(1),null),status:'in_progress'});
 try{const r=await cli(f,dir);assert.equal(r.exitCode,0);assert.deepEqual(r.outputs,['status=OBSERVED_MATCH\n']);assert.equal(r.reads.baseline,1);assert.ok(r.reads.github>0&&r.reads.cf>0);
  const again=await cli(f,dir);assert.equal(again.exitCode,1);assert.deepEqual(again.reads,{baseline:0,github:0,cf:0});
  for(const s of [f.b.accountId,f.b.workerTag,'synthetic-provider-token','synthetic-github-token'])assert.ok(!r.logs.join().includes(s));
 }finally{rmSync(dir,{recursive:true,force:true})}
});
for(const patch of [{GITHUB_RUN_NUMBER:'34'},{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_WORKFLOW_REF:'other'},{GITHUB_WORKFLOW_SHA:'f'.repeat(40)},{GITHUB_ACTOR:'other'},{SITE_MONITOR_RUNTIME_GATE_JSON:'private-never-reflect'}])test('actual schema4 CLI rejects before baseline and credentials '+JSON.stringify(patch),async()=>{
 const f=fixture(),dir=mkdtempSync(join(tmpdir(),'finite-cli-deny-'));try{const r=await cli(f,dir,patch);assert.equal(r.exitCode,1);assert.deepEqual(r.reads,{baseline:0,github:0,cf:0});assert.equal(f.calls.length,0)}finally{rmSync(dir,{recursive:true,force:true})}
});
test('actual schema4 CLI expiry rejects before private baseline and credentials',async()=>{
 const f=fixture(),dir=mkdtempSync(join(tmpdir(),'finite-cli-expiry-'));f.setNow(E);try{const r=await cli(f,dir);assert.equal(r.exitCode,1);assert.deepEqual(r.reads,{baseline:0,github:0,cf:0})}finally{rmSync(dir,{recursive:true,force:true})}
});
