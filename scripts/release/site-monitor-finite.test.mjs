import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fingerprint} from './site-integrity-monitor.mjs';
import {prepareFiniteTrialGate,createFiniteTrialPreflight,createFiniteTrialObservation} from './site-monitor-finite.mjs';
import {collectTrialEnvelope,reserveEvidenceAttempt,reserveFiniteReadAttempt,encodeTrialEnvelope,writeTrialEnvelope,makeSavedReceipt} from './site-monitor-evidence.mjs';

import {source,T,E,at,fixture} from './site-monitor-finite-fixture.mjs';
import {createPublicWorkflowHistoryReader} from './site-monitor-history.mjs';
const context=f=>({gate:f.gate,audit:f.audit,sourceSha:source,baselineSha256:f.gate.baselineSha256});
const preflight=f=>createFiniteTrialPreflight({...context(f),credentialProvider:f.credentialProvider,fetchImpl:f.fetchImpl,clock:f.clock});
async function evidence(f){const dir=mkdtempSync(join(tmpdir(),'finite-coverage-'));try{f.setNow(at(7201));f.collector.updated_at=at(7201);const permit=await reserveEvidenceAttempt({...context(f),currentRunId:'9000',currentRunNumber:6,runAttempt:1,controlDirectory:dir,clock:f.clock});return await collectTrialEnvelope({...context(f),currentRunId:'9000',currentRunNumber:6,permit,credentialProvider:f.credentialProvider,fetchImpl:f.fetchImpl,clock:f.clock});}finally{rmSync(dir,{recursive:true,force:true})}}
function addSuccesses(f,times){for(const [i,time] of times.entries()){const r=f.raw(1000+i,10+i,source,'schedule',at(time),at(time+10));f.rows.push(r);f.complete(r)}}
test('exact 13 successes spanning fixed 2h window pass, single successful hour does not',async()=>{
 const f=fixture();addSuccesses(f,Array.from({length:13},(_,i)=>i*550));const e=await evidence(f);assert.equal(e.trialCoverageStatus,'CONDITIONS_MET');assert.equal(e.windowObservedRuns,13);assert.equal(e.windowSpanSeconds,6600);assert.equal(e.history.totalCount,e.runs.length);assert.ok(e.runs.every(r=>Array.isArray(r.jobSummary)));
 const short=fixture();addSuccesses(short,Array.from({length:13},(_,i)=>i*300));assert.equal((await evidence(short)).trialCoverageStatus,'NOT_CONFIRMED');
});
test('last creation 601s from E fails even when completion reaches E-600s',async()=>{
 const f=fixture();addSuccesses(f,Array.from({length:14},(_,i)=>i*480).concat(6599));const last=f.rows.at(-1);last.updated_at=at(6601);f.jobs[last.id].jobs[0].completed_at=last.updated_at;f.jobs[last.id].jobs[0].steps[0].completed_at=at(6600);assert.equal((await evidence(f)).trialCoverageStatus,'NOT_CONFIRMED');
});
for(const [gap,expected] of [[600,'CONDITIONS_MET'],[601,'NOT_CONFIRMED']])test('created gap '+gap+' is retained in fixed coverage',async()=>{
 const f=fixture();const times=Array.from({length:24},(_,i)=>i*300);times[10]=2700+gap;times.splice(11,1);addSuccesses(f,times);assert.equal((await evidence(f)).trialCoverageStatus,expected);
});
test('cutoff boundary is counted in history but excluded from trial success; missing jobs cannot be complete',async()=>{
 const f=fixture();addSuccesses(f,Array.from({length:13},(_,i)=>i*550));const boundary=f.raw(2000,23,source,'schedule',E,at(7200));f.rows.push(boundary);f.jobs[2000]={total_count:0,jobs:[]};const e=await evidence(f);assert.equal(e.trialCoverageStatus,'CONDITIONS_MET');assert.equal(e.windowObservedRuns,13);assert.equal(e.runs.at(-1).classification,'CUTOFF_BOUNDARY_EXCLUDED');
 delete f.jobs[38166551243];assert.equal((await evidence(f)).trialCoverageStatus,'UNKNOWN');
});
test('new unfinished or late run cannot become CONDITIONS_MET; fake envelope labels/counts are rejected',async()=>{
 const f=fixture();addSuccesses(f,Array.from({length:24},(_,i)=>i*300));const e=await evidence(f);for(const fault of ['partition','jobs','classification','unknown-key']){const bad=structuredClone(e);if(fault==='partition')bad.history.partitions[0].totalCount++;if(fault==='jobs')bad.runs.at(-1).jobSummary=[];if(fault==='classification')bad.runs[2].classification='TRIAL_OBSERVED_MATCH';if(fault==='unknown-key')bad.rawProvider='forbidden';assert.throws(()=>encodeTrialEnvelope(bad));}
 f.rows.at(-1).status='in_progress';f.rows.at(-1).conclusion=null;assert.equal((await evidence(f)).trialCoverageStatus,'UNKNOWN');
});
test('reader retains UTC-day completeness and rejects page count drift',async()=>{
 let calls=0;const checkpoint={id:1,created_at:'2026-10-11T23:59:59Z',repository:{full_name:'Xpotato1024/xpotato-site'},path:'.github/workflows/site-integrity-monitor.yml',head_branch:'main'};
 const reader=createPublicWorkflowHistoryReader({credentialProvider:async()=> 'synthetic-github-token',clock:()=>Date.parse('2026-10-12T01:00:00Z'),fetchImpl:async u=>{calls++;return Response.json(u.includes('?')?{total_count:0,workflow_runs:[]}:checkpoint)}});
 const h=await reader({checkpointRunId:'1',throughAt:'2026-10-12T00:00:00.123Z'});assert.equal(h.partitions.length,2);assert.equal(h.partitions[0].throughAt,'2026-10-11T23:59:59Z');assert.equal(h.partitions[1].fromAt,'2026-10-12T00:00:00Z');assert.equal(calls,3);
});

test('RED contract: runtime explicit read approval accepts tracked PROPOSED unchanged; no synthetic closure',()=>{
 const f=fixture();assert.equal(prepareFiniteTrialGate(context(f)).schemaVersion,4);
 assert.equal(JSON.parse(readFileSync(new URL('../../docs/operations/site-monitor-closed-gate-recovery.json',import.meta.url))).status,'PROPOSED');
 for(const patch of [{status:'PROPOSED'},{readApproval:{...f.gate.readApproval,status:'PROPOSED'}},{readApproval:{...f.gate.readApproval,deployAllowed:true}},{sourceSha:'a'.repeat(40)}])assert.throws(()=>prepareFiniteTrialGate({...context(f),gate:{...f.gate,...patch}}));
});
test('synthetic E2E: start, retain unknown run9, 24 real fake-transport scans, fixed cutoff, one safe save and receipt',async()=>{
 const f=fixture(),before=JSON.stringify(f.audit);
 for(let i=0;i<24;i++){
  const r={...f.raw(1000+i,10+i,source,'schedule',at(i*300),at(i*300),null),status:'in_progress'};f.rows.push(r);f.setNow(at(i*300+1));
  const monitor=createFiniteTrialObservation({...context(f),baseline:f.b,currentRunId:String(r.id),currentRunNumber:r.run_number,historyPreflight:preflight(f),credentialProvider:async()=> 'synthetic-provider-token',fetchImpl:f.fetchImpl,clock:f.clock});
  const observed=await monitor.check();assert.equal(observed.status,'OBSERVED_MATCH');assert.equal(observed.historicalIncidentRetained,true);assert.equal(observed.deployAllowed,false);assert.equal(observed.retainedHistoricalRuns,2);f.complete(r);
 }
 f.setNow(at(7201));f.collector.updated_at=at(7201);
 const dir=mkdtempSync(join(tmpdir(),'finite-e2e-'));
 try{
  const permit=await reserveEvidenceAttempt({...context(f),currentRunId:String(f.collector.id),currentRunNumber:6,runAttempt:1,controlDirectory:dir,clock:f.clock});
  const e=await collectTrialEnvelope({...context(f),currentRunId:String(f.collector.id),currentRunNumber:6,permit,credentialProvider:f.credentialProvider,fetchImpl:f.fetchImpl,clock:f.clock});
  assert.equal(e.trialCoverageStatus,'CONDITIONS_MET');assert.equal(e.windowObservedRuns,24);assert.equal(e.historicalIncidentRetained,true);assert.equal(e.runs.find(r=>r.id==='38166551243').conclusion,'skipped');
  const encoded=encodeTrialEnvelope(e);assert.ok(encoded.bytes.length<=131072);
  const path=await writeTrialEnvelope({directory:dir,envelope:e});assert.equal(readFileSync(path,'utf8'),encoded.bytes.toString());
  const receipt=makeSavedReceipt({envelope:e,jsonBytes:readFileSync(path),artifactId:'17',artifactDigest:'4'.repeat(64),expectedGateSha256:fingerprint(f.gate),expectedJsonSha256:encoded.sha256,currentRunId:'9000',currentRunNumber:6,sourceSha:source,clock:f.clock});
  assert.equal(receipt.jsonSha256,encoded.sha256);assert.equal(receipt.status,'EVIDENCE_SAVED');assert.equal(receipt.sourceSha,source);
  assert.equal(JSON.stringify(f.audit),before);
  for(const secret of [f.b.accountId,f.b.workerTag,f.b.credentialId,'synthetic-provider-token','synthetic-github-token','fixture-only','signedUploadUrl'])assert.ok(!encoded.bytes.toString().includes(secret));
  await assert.rejects(reserveEvidenceAttempt({...context(f),currentRunId:'9000',currentRunNumber:6,runAttempt:1,controlDirectory:dir,clock:f.clock}));
  await assert.rejects(writeTrialEnvelope({directory:dir,envelope:e}));
 }finally{rmSync(dir,{recursive:true,force:true})}
});
for(const fault of ['source','actor','repository','path','attempt','number','checkpoint','bootstrap proof','truncated','duplicate','403','redirect','malformed','deadline'])test('v4 identity/transport failure prevents provider and never reflects raw data: '+fault,async()=>{
 const f=fixture(),r={...f.raw(1000,10,source,'schedule',T,at(1),null),status:'in_progress'};f.rows.push(r);
 if(fault==='source')r.head_sha='f'.repeat(40);
 if(fault==='actor')r.actor.login='other';
 if(fault==='repository')r.repository.full_name='other/repo';
 if(fault==='path')r.path='.github/workflows/other.yml';
 if(fault==='attempt')r.run_attempt=2;
 if(fault==='number')r.run_number=11;
 if(fault==='checkpoint')f.rows[0].created_at=at(0);
 if(fault==='bootstrap proof')f.jobs[f.rows[0].id].jobs[0].conclusion='failure';
 const original=f.fetchImpl;
 f.fetchImpl=async(u,i)=>{
  if(fault==='403')return Response.json({secret:'synthetic-never-reflect'},{status:403});
  if(fault==='redirect')return new Response('',{status:302,headers:{location:'https://private.invalid/?token=synthetic'}});
  if(fault==='malformed')return new Response('synthetic-never-reflect',{headers:{'content-type':'application/json'}});
  const response=await original(u,i);
  if(fault==='deadline')f.setNow(E);
  if(u.includes('/workflows/')){const value=await response.json();if(fault==='truncated')value.total_count++;if(fault==='duplicate'){value.workflow_runs.push(value.workflow_runs[0]);value.total_count++;}return Response.json(value)}
  return response;
 };
 let provider=0;const monitor=createFiniteTrialObservation({...context(f),baseline:f.b,currentRunId:'1000',currentRunNumber:10,historyPreflight:preflight(f),credentialProvider:()=>{provider++},fetchImpl:()=>{provider++},clock:f.clock});
 await assert.rejects(monitor.check(),error=>!error.message.includes('synthetic-never-reflect'));assert.equal(provider,0);
});
test('read reservation is consumed before IO and cannot refill after crash or changed digest',async()=>{
 const f=fixture(),dir=mkdtempSync(join(tmpdir(),'finite-read-budget-'));try{
  const options={...context(f),currentRunId:'1000',currentRunNumber:10,runAttempt:1,controlDirectory:dir,clock:f.clock};await reserveFiniteReadAttempt(options);
  await assert.rejects(reserveFiniteReadAttempt(options));f.gate.readApproval.ownerDecisionSha256='6'.repeat(64);await assert.rejects(reserveFiniteReadAttempt({...options,...context(f)}));assert.equal(f.lookups(),0);assert.equal(f.calls.length,0);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('partial evidence marker is not repaired, removed or reinitialized',async()=>{
 const f=fixture(),dir=mkdtempSync(join(tmpdir(),'finite-partial-'));try{
  writeFileSync(join(dir,'consumed-9000'),'partial');await assert.rejects(reserveEvidenceAttempt({...context(f),currentRunId:'9000',currentRunNumber:6,runAttempt:1,controlDirectory:dir,clock:f.clock}));assert.equal(readFileSync(join(dir,'consumed-9000'),'utf8'),'partial');assert.equal(f.lookups(),0);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('64 GET ceiling ends incomplete history UNKNOWN with no 65th call',async()=>{
 const f=fixture();f.gate.trial.startedAt='2026-12-31T01:00:00Z';f.gate.transition.effectiveAt=f.gate.trial.startedAt;f.gate.trial.expiresAt='2026-12-31T03:00:00Z';f.gate.evidence.notBefore=f.gate.trial.expiresAt;f.gate.evidence.expiresAt='2026-12-31T04:00:00Z';f.collector.created_at=f.gate.trial.startedAt;f.collector.updated_at='2026-12-31T03:00:01Z';f.setNow(f.collector.updated_at);
 const dir=mkdtempSync(join(tmpdir(),'finite-64-'));try{
  const permit=await reserveEvidenceAttempt({...context(f),currentRunId:'9000',currentRunNumber:6,runAttempt:1,controlDirectory:dir,clock:f.clock});const e=await collectTrialEnvelope({...context(f),currentRunId:'9000',currentRunNumber:6,permit,credentialProvider:f.credentialProvider,fetchImpl:f.fetchImpl,clock:f.clock});assert.equal(e.githubGets,64);assert.equal(e.trialCoverageStatus,'UNKNOWN');assert.equal(e.complete,false);assert.equal(f.calls.length,64);assert.deepEqual(e.runs,[]);
  const before=f.lookups();await assert.rejects(collectTrialEnvelope({...context(f),currentRunId:'9000',currentRunNumber:6,permit,credentialProvider:f.credentialProvider,fetchImpl:f.fetchImpl,clock:f.clock}));assert.equal(f.lookups(),before);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('new trial failure stops subsequent provider work; unknown old run does not',async()=>{
 const f=fixture(),bad=f.raw(1000,10,source,'schedule',T,at(10),'failure'),current={...f.raw(1001,11,source,'schedule',at(300),at(300),null),status:'in_progress'};f.rows.push(bad,current);f.setNow(at(301));let cf=0;
 const m=createFiniteTrialObservation({...context(f),baseline:f.b,currentRunId:'1001',currentRunNumber:11,historyPreflight:preflight(f),credentialProvider:async()=>{cf++;return 'synthetic-provider-token'},fetchImpl:async()=>{cf++},clock:f.clock});await assert.rejects(m.check());assert.equal(cf,0);
});
test('scope, expiry, 25th slot and evidence attempt2 reject before credential/GET',async()=>{
 for(const number of [9,34]){const f=fixture();await assert.rejects(preflight(f)({baseline:f.b,currentRunId:'1000',currentRunNumber:number}));assert.equal(f.lookups(),0);assert.equal(f.calls.length,0);}
 const f=fixture();f.setNow(E);await assert.rejects(preflight(f)({baseline:f.b,currentRunId:'1000',currentRunNumber:10}));assert.equal(f.lookups(),0);
 const dir=mkdtempSync(join(tmpdir(),'finite-deny-'));try{await assert.rejects(reserveEvidenceAttempt({...context(f),currentRunId:'9000',currentRunNumber:6,runAttempt:2,controlDirectory:dir,clock:f.clock}));}finally{rmSync(dir,{recursive:true,force:true})}
});
