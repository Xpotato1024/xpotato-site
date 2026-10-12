import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {readFile,lstat,stat,appendFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {boundedRuntimeJson,validateRuntimeContext,prepareApprovedBaseline} from './site-monitor-runtime.mjs';
import {prepareFiniteTrialGate,fail} from './site-monitor-finite.mjs';
import {fingerprint} from './site-integrity-monitor.mjs';
import {reserveArmedMetadataAttempt,createArmedMetadataAdmission,writeArmedPermit,readAndConsumeArmedPermit,observeArmedPermit} from './site-monitor-armed.mjs';
import {armedFixture,source,T,E,at} from './site-monitor-armed-fixture.mjs';
async function cli(f,dir,{body=false,patch={},crossT=false}={}){
 const url=new URL(body?'./site-integrity-monitor-cli.mjs':'./site-monitor-armed-cli.mjs',import.meta.url),code=readFileSync(url,'utf8').replace(/^import[^\n]*\n/gm,'').replaceAll('import.meta.url',JSON.stringify(url.href));
 const reads={baseline:0,github:0,cf:0},outputs=[],logs=[];
 const env=new Proxy({SITE_MONITOR_AUTHORIZATION:body?'separately-approved-readonly-monitor':'separately-approved-armed-public-admission',GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'Xpotato1024/xpotato-site',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'schedule',GITHUB_ACTOR:'Xpotato1024',GITHUB_TRIGGERING_ACTOR:'Xpotato1024',GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'1000',GITHUB_RUN_NUMBER:'10',GITHUB_SHA:source,GITHUB_WORKFLOW_SHA:source,GITHUB_WORKFLOW_REF:'Xpotato1024/xpotato-site/.github/workflows/site-integrity-monitor.yml@refs/heads/main',GITHUB_OUTPUT:'fake-output',RUNNER_TEMP:dir,SITE_MONITOR_RUNTIME_GATE_JSON:JSON.stringify(f.gate),SITE_MONITOR_APPROVED_BASELINE_JSON:JSON.stringify(f.b),GITHUB_TOKEN:'synthetic-github-token',CLOUDFLARE_SITE_MONITOR_READ_TOKEN:'synthetic-provider-token',...patch},{get:(t,k)=>{if(k==='SITE_MONITOR_APPROVED_BASELINE_JSON')reads.baseline++;if(k==='GITHUB_TOKEN')reads.github++;if(k==='CLOUDFLARE_SITE_MONITOR_READ_TOKEN')reads.cf++;if(!body)assert.ok(!['SITE_MONITOR_APPROVED_BASELINE_JSON','CLOUDFLARE_SITE_MONITOR_READ_TOKEN'].includes(k));return t[k]}});
 const process={argv:['node','cli','public-approval'],env,exitCode:0};class Clock extends Date{static now(){return f.clock()}}
 const json=p=>String(p).includes('site-monitor-executor-audit.json')?f.audit:{schemaVersion:1,status:'OWNER_APPROVED_BASELINE',baselineSha256:f.gate.baselineSha256};
 const publicPath=p=>p==='public-approval'||String(p).includes('/docs/operations/');
 await runInNewContext(code,{process,Date:Clock,JSON,URL,Buffer,console:{log:v=>logs.push(v),error:v=>logs.push(v)},fileURLToPath,resolve,join,stat:async p=>publicPath(p)?{isFile:()=>true,size:1024}:stat(p),lstat:async p=>publicPath(p)?{isFile:()=>true,isSymbolicLink:()=>false,size:Buffer.byteLength(JSON.stringify(json(p)))}:lstat(p),readFile:async p=>publicPath(p)?Buffer.from(JSON.stringify(json(p))):readFile(p),appendFile:async(p,v)=>{if(p==='fake-output')outputs.push(v);else await appendFile(p,v)},execFileSync:()=>source,boundedRuntimeJson,validateRuntimeContext,prepareApprovedBaseline,prepareFiniteTrialGate,fail,fingerprint,reserveArmedMetadataAttempt:async o=>{const r=await reserveArmedMetadataAttempt(o);if(crossT)f.setNow(at(1));return r},createArmedMetadataAdmission:o=>createArmedMetadataAdmission({...o,clock:f.clock}),writeArmedPermit:o=>writeArmedPermit({...o,clock:f.clock}),readAndConsumeArmedPermit:o=>readAndConsumeArmedPermit({...o,clock:f.clock}),observeArmedPermit:o=>observeArmedPermit({...o,clock:f.clock}),fetch:f.fetchImpl});
 return {exitCode:process.exitCode,reads,outputs,logs};
}
test('actual public admission CLI before T/after E touches neither private values nor GH; direct body has no permit',async()=>{
 for(const t of [-1,7200]){const f=armedFixture(),dir=mkdtempSync(join(tmpdir(),'armed-cli-'));f.setNow(at(t));try{const result=await cli(f,dir);assert.equal(result.exitCode,0);assert.ok(result.outputs[0].includes('status=NO_IO'));assert.deepEqual(result.reads,{baseline:0,github:0,cf:0});const direct=await cli(f,dir,{body:true});assert.equal(direct.exitCode,1);assert.deepEqual(direct.reads,{baseline:0,github:0,cf:0});assert.equal(f.calls.length,0)}finally{rmSync(dir,{recursive:true,force:true})}}
});
test('actual CLI admission file → secret-bearing body → receipt; duplicate body and admission denied before credentials',async()=>{
 const f=armedFixture(),dir=mkdtempSync(join(tmpdir(),'armed-cli-e2e-'));f.rows.push({...f.raw(1000,10,source,'schedule',T,at(3),null),status:'in_progress'});f.setNow(at(3));
 try{const a=await cli(f,dir);assert.equal(a.exitCode,0);assert.ok(a.outputs[0].includes('status=ADMITTED'));assert.equal(a.reads.cf,0);assert.equal(a.reads.baseline,0);const hash=a.outputs[0].match(/permit_sha256=([a-f0-9]{64})/)[1];const body=await cli(f,dir,{body:true,patch:{SITE_MONITOR_PERMIT_SHA256:hash}});assert.equal(body.exitCode,0);assert.equal(body.reads.baseline,1);assert.ok(body.reads.cf>0);assert.deepEqual(body.outputs,['status=OBSERVED_MATCH\n']);
  const duplicate=await cli(f,dir,{body:true,patch:{SITE_MONITOR_PERMIT_SHA256:hash}});assert.equal(duplicate.exitCode,1);assert.deepEqual(duplicate.reads,{baseline:0,github:0,cf:0});const again=await cli(f,dir);assert.equal(again.exitCode,1);assert.equal(again.reads.github,0);
  for(const secret of [f.b.accountId,'synthetic-provider-token','synthetic-github-token'])assert.ok(!body.logs.join().includes(secret));
 }finally{rmSync(dir,{recursive:true,force:true})}
});
for(const patch of [{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_WORKFLOW_SHA:'f'.repeat(40)},{GITHUB_ACTOR:'other'},{RUNNER_DEBUG:'1'},{SITE_MONITOR_RUNTIME_GATE_JSON:'private-never-reflect'}])test('actual schema5 public CLI context denied before credential '+JSON.stringify(patch),async()=>{
 const f=armedFixture(),dir=mkdtempSync(join(tmpdir(),'armed-cli-deny-'));try{const result=await cli(f,dir,{patch});assert.equal(result.exitCode,1);assert.deepEqual(result.reads,{baseline:0,github:0,cf:0});assert.equal(f.calls.length,0)}finally{rmSync(dir,{recursive:true,force:true})}
});
test('workflow gives no private env to admission/NoIo, preserves cron, and gates the private body on ADMITTED',()=>{
 const s=readFileSync(new URL('../../.github/workflows/site-integrity-monitor.yml',import.meta.url),'utf8'),admit=s.split('      - name: Armed public admission')[1].split('      - name: Trial readonly observation')[0];
 assert.ok(!admit.includes('secrets.'));assert.ok(s.includes("cron: '2-57/5 * * * *'"));assert.ok(s.includes("steps.armed.outputs.status == 'ADMITTED'"));assert.ok(s.includes('Monitor receipt ARMED_NO_IO ${{ steps.armed.outputs.gate_sha256 }}'));assert.ok(s.includes('SITE_MONITOR_PERMIT_SHA256:'));assert.equal(s.match(/CLOUDFLARE_SITE_MONITOR_READ_TOKEN: /g).length,2);
});

test('actual CLI reserves across T and retains delayed pre-T NoIo instead of unknown failure',async()=>{const f=armedFixture(),dir=mkdtempSync(join(tmpdir(),'armed-race-'));f.rows.push({...f.raw(1000,10,source,'schedule',at(-1),at(1),null),status:'in_progress'});f.setNow(at(-1));try{const result=await cli(f,dir,{crossT:true});assert.equal(result.exitCode,0);assert.ok(result.outputs[0].includes('status=NO_IO'));assert.equal(f.calls.length,1);assert.equal(result.reads.cf,0);assert.equal(result.reads.baseline,0)}finally{rmSync(dir,{recursive:true,force:true})}});
