import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFileSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {readFile,lstat,open} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {fingerprint} from './site-integrity-monitor.mjs';
import {boundedRuntimeJson,validateRuntimeContext} from './site-monitor-runtime.mjs';
import {prepareFiniteTrialGate,fail} from './site-monitor-finite.mjs';
import {reserveEvidenceAttempt,collectTrialEnvelope,writeTrialEnvelope,encodeTrialEnvelope,makeSavedReceipt} from './site-monitor-evidence.mjs';
import {source,T,E,at,fixture} from './site-monitor-finite-fixture.mjs';
import {armedFixture} from './site-monitor-armed-fixture.mjs';
const url=new URL('./site-monitor-evidence-cli.mjs',import.meta.url),code=readFileSync(url,'utf8').replace(/^import[^\n]*\n/gm,'').replaceAll('import.meta.url',JSON.stringify(url.href));
function completeFixture(){const f=fixture();for(let i=0;i<24;i++){const r=f.raw(1000+i,10+i,source,'schedule',at(i*300),at(i*300+10));f.rows.push(r);f.complete(r)}return f}
async function cli(f,directory,mode,patch={}){
 const messages=[],outputs=[],summaries=[];let tokenReads=0;
 const env=new Proxy({GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'Xpotato1024/xpotato-site',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_ACTOR:'Xpotato1024',GITHUB_TRIGGERING_ACTOR:'Xpotato1024',GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'9000',GITHUB_RUN_NUMBER:'6',GITHUB_SHA:source,GITHUB_WORKFLOW_REF:'Xpotato1024/xpotato-site/.github/workflows/site-monitor-trial-evidence.yml@refs/heads/main',GITHUB_WORKFLOW_SHA:source,RUNNER_TEMP:directory,SITE_MONITOR_AUTHORIZATION:'separately-approved-finite-evidence',SITE_MONITOR_RUNTIME_GATE_JSON:JSON.stringify(f.gate),SITE_MONITOR_EXPECTED_GATE_SHA256:fingerprint(f.gate),GITHUB_TOKEN:'synthetic-github-token',GITHUB_OUTPUT:'fake-output',GITHUB_STEP_SUMMARY:'fake-summary',SITE_MONITOR_ARTIFACT_ID:'17',SITE_MONITOR_ARTIFACT_DIGEST:'4'.repeat(64),...patch},{get:(target,key)=>{if(key==='GITHUB_TOKEN')tokenReads++;assert.ok(!['CLOUDFLARE_SITE_MONITOR_READ_TOKEN','SITE_MONITOR_APPROVED_BASELINE_JSON','ACTIONS_RUNTIME_TOKEN'].includes(key));return target[key]}});
 env.GITHUB_RETENTION_DAYS=patch.GITHUB_RETENTION_DAYS??'90';const process={argv:['node','cli',mode],env,exitCode:0};
 class Clock extends Date{static now(){return f.clock()}}
 const auditPath=p=>String(p).includes('site-monitor-executor-audit.json');
 await runInNewContext(code,{process,Date:Clock,performance,Buffer,JSON,URL,Number,console:{log:m=>messages.push(m),error:m=>messages.push(m)},fileURLToPath,resolve,join,open,lstat:async p=>auditPath(p)?{isFile:()=>true,size:Buffer.byteLength(JSON.stringify(f.audit))}:lstat(p),readFile:async p=>auditPath(p)?Buffer.from(JSON.stringify(f.audit)):readFile(p),appendFile:async(p,text)=>{if(p==='fake-output')outputs.push(text);else if(p==='fake-summary')summaries.push(text);else throw Error('unexpected-output')},execFileSync:()=>source,fingerprint,boundedRuntimeJson,validateRuntimeContext,prepareFiniteTrialGate,fail,reserveEvidenceAttempt:options=>reserveEvidenceAttempt({...options,clock:f.clock}),collectTrialEnvelope:options=>collectTrialEnvelope({...options,clock:f.clock}),writeTrialEnvelope,encodeTrialEnvelope,makeSavedReceipt:options=>makeSavedReceipt({...options,clock:f.clock}),setTimeout:(callback,ms)=>{assert.ok(ms<=30000);assert.equal(f.calls.length,0);f.setNow(new Date(f.clock()+ms).toISOString());callback();return 0},fetch:f.fetchImpl});
 return {exitCode:process.exitCode,messages,outputs,summaries,tokenReads};
}
test('actual CLI stages wait without GET, collect one file, reserve upload and bind native action output',async()=>{
 const f=completeFixture(),dir=mkdtempSync(join(tmpdir(),'evidence-cli-'));try{
  assert.equal((await cli(f,dir,'collect')).exitCode,0);assert.ok(f.clock()>=Date.parse(E));assert.ok(f.calls.length<=64);
  const admission=await cli(f,dir,'upload-admission');assert.equal(admission.exitCode,0);assert.equal(admission.tokenReads,0);
  // Native action is modelled only by its successful outputs; no actual upload.
  const saved=await cli(f,dir,'saved-receipt');assert.equal(saved.exitCode,0);assert.equal(saved.tokenReads,0);const receipt=JSON.parse(saved.summaries[0]);assert.equal(receipt.trialCoverageStatus,'CONDITIONS_MET');assert.equal(receipt.historicalIncidentRetained,true);assert.equal(receipt.jsonSha256,encodeTrialEnvelope(JSON.parse(readFileSync(join(dir,'site-trial-evidence','9000','evidence.json'),'utf8'))).sha256);
  assert.equal((await cli(f,dir,'collect')).exitCode,1);assert.equal((await cli(f,dir,'upload-admission')).exitCode,1);assert.equal((await cli(f,dir,'saved-receipt')).exitCode,1);
  for(const secret of ['synthetic-github-token','synthetic-provider-token','fixture-only',f.b.accountId])assert.ok(!JSON.stringify(saved).includes(secret));
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('actual schema5 evidence CLI dispatch before T waits without GET and saves envelope2 once',async()=>{
 const f=armedFixture(),dir=mkdtempSync(join(tmpdir(),'armed-evidence-cli-'));for(let i=0;i<24;i++){const r=f.raw(1000+i,10+i,source,'schedule',at(i*300),at(i*300+10));f.rows.push(r);f.complete(r)}f.setNow(at(-599));
 try{const collect=await cli(f,dir,'collect');assert.equal(collect.exitCode,0);const e=JSON.parse(readFileSync(join(dir,'site-trial-evidence','9000','evidence.json'),'utf8'));assert.equal(e.schemaVersion,2);assert.equal(e.trialCoverageStatus,'CONDITIONS_MET');assert.equal((await cli(f,dir,'upload-admission')).exitCode,0);const saved=await cli(f,dir,'saved-receipt');assert.equal(saved.exitCode,0);assert.equal(saved.tokenReads,0);assert.equal(JSON.parse(saved.summaries[0]).trialCoverageStatus,'CONDITIONS_MET');assert.equal((await cli(f,dir,'collect')).exitCode,1)}finally{rmSync(dir,{recursive:true,force:true})}
});
for(const patch of [{SITE_MONITOR_EXPECTED_GATE_SHA256:'0'.repeat(64)},{GITHUB_SHA:'f'.repeat(40)},{GITHUB_WORKFLOW_SHA:'f'.repeat(40)},{GITHUB_WORKFLOW_REF:'other'},{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_RUN_NUMBER:'7'},{GITHUB_ACTOR:'other'},{RUNNER_DEBUG:'1'},{SITE_MONITOR_RUNNER_DEBUG:'1'},{SITE_MONITOR_RUNTIME_GATE_JSON:'synthetic-private-never-reflect'}])test('actual evidence CLI context rejects before token: '+JSON.stringify(patch),async()=>{
 const f=completeFixture(),dir=mkdtempSync(join(tmpdir(),'evidence-context-'));try{const result=await cli(f,dir,'collect',patch);assert.equal(result.exitCode,1);assert.equal(result.tokenReads,0);assert.equal(f.calls.length,0);assert.ok(!result.messages.join().includes('synthetic-private-never-reflect'))}finally{rmSync(dir,{recursive:true,force:true})}
});
test('tampered source/JSON or failed upload cannot create a saved receipt',async()=>{
 const f=completeFixture(),dir=mkdtempSync(join(tmpdir(),'evidence-tamper-'));try{
  await cli(f,dir,'collect');assert.equal((await cli(f,dir,'saved-receipt')).exitCode,1);
  await cli(f,dir,'upload-admission');const failed=await cli(f,dir,'saved-receipt',{SITE_MONITOR_ARTIFACT_ID:'',SITE_MONITOR_ARTIFACT_DIGEST:''});assert.equal(failed.exitCode,1);assert.deepEqual(failed.summaries,[]);
  const path=join(dir,'site-trial-evidence','9000','evidence.json'),e=JSON.parse(readFileSync(path,'utf8'));e.collector.sourceSha='f'.repeat(40);writeFileSync(path,JSON.stringify(e)+'\n');const tampered=await cli(f,dir,'saved-receipt');assert.equal(tampered.exitCode,1);assert.deepEqual(tampered.summaries,[]);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('manual-only workflow pins action, one JSON,7d,no overwrite,finite upload timeout, and no provider secret',()=>{
 const workflow=readFileSync(new URL('../../.github/workflows/site-monitor-trial-evidence.yml',import.meta.url),'utf8');
 // runner context is available in step env, never in job-level env.
 assert.ok(!workflow.split('    steps:')[0].includes('runner.debug'));
 assert.equal(workflow.match(/SITE_MONITOR_RUNNER_DEBUG: \$\{\{ runner.debug \}\}/g).length,3);
 assert.ok(!workflow.includes('schedule:'));assert.ok(!workflow.includes('secrets.'));assert.ok(!/:\s*write\s*$/m.test(workflow));assert.equal(workflow.match(/uses: actions\/upload-artifact@/g).length,1);assert.ok(workflow.includes('ea165f8d65b6e75b540449e92b4886f43607fa02'));for(const field of ['retention-days: 7','overwrite: false','timeout-minutes: 2','/evidence.json','saved-receipt','expected_gate_sha256','runner.debug'])assert.ok(workflow.includes(field));
});
