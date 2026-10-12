import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fingerprint} from './site-integrity-monitor.mjs';
import {prepareFiniteTrialGate,createFiniteHistoryReader} from './site-monitor-finite.mjs';
import {reserveArmedMetadataAttempt,createArmedMetadataAdmission,writeArmedPermit,readAndConsumeArmedPermit,observeArmedPermit} from './site-monitor-armed.mjs';
import {reserveEvidenceAttempt,collectTrialEnvelope,encodeTrialEnvelope,writeTrialEnvelope,makeSavedReceipt} from './site-monitor-evidence.mjs';
import {armedFixture,source,T,E,at} from './site-monitor-armed-fixture.mjs';
const context=f=>({gate:f.gate,audit:f.audit,sourceSha:source,baselineSha256:f.gate.baselineSha256});
const temp=()=>mkdtempSync(join(tmpdir(),'armed-'));
const current=(f,n=10,t=0)=>{const r={...f.raw(1000+n,n,source,'schedule',at(t),at(t+3),null),status:'in_progress'};f.rows.push(r);f.setNow(at(t+3));return r};
async function admission(f,r,dir){const reservation=await reserveArmedMetadataAttempt({...context(f),currentRunId:String(r.id),currentRunNumber:r.run_number,runAttempt:1,controlDirectory:dir});return createArmedMetadataAdmission({...context(f),credentialProvider:f.credentialProvider,fetchImpl:f.fetchImpl,clock:f.clock}).check({currentRunId:String(r.id),currentRunNumber:r.run_number,reservation})}
async function permit(f,r,dir){const result=await admission(f,r,dir);assert.equal(result.status,'ADMITTED');const expectedSha256=await writeArmedPermit({directory:dir,permit:result.permit,gate:f.gate,clock:f.clock});return readAndConsumeArmedPermit({directory:dir,expectedSha256,gate:f.gate,currentRunId:String(r.id),currentRunNumber:r.run_number,sourceSha:source,clock:f.clock})}
const observe=(f,r,p,extra={})=>observeArmedPermit({...context(f),permit:p,currentRunId:String(r.id),currentRunNumber:r.run_number,baselineJsonProvider:async()=>JSON.stringify(f.b),githubCredentialProvider:f.credentialProvider,providerCredentialProvider:async()=> 'synthetic-provider-token',fetchImpl:f.fetchImpl,clock:f.clock,...extra});
async function evidence(f,dir){f.setNow(at(7201));f.collector.updated_at=at(7201);const permit=await reserveEvidenceAttempt({...context(f),currentRunId:'9000',currentRunNumber:6,runAttempt:1,controlDirectory:dir,clock:f.clock});return collectTrialEnvelope({...context(f),currentRunId:'9000',currentRunNumber:6,permit,credentialProvider:f.credentialProvider,fetchImpl:f.fetchImpl,clock:f.clock})}

test('schema5 exact registration rejects predicted, widened, changed-number and unapproved records',()=>{
 const f=armedFixture();assert.equal(prepareFiniteTrialGate(context(f)).status,'ARMED');
 for(const patch of [{status:'ACTIVE'},{status:'PROPOSED'},{registration:{...f.gate.registration,afterRunId:'0'}},{registration:{...f.gate.registration,afterRunNumber:10}},{registration:{...f.gate.registration,registeredAt:at(-1801)}},{registration:{...f.gate.registration,maxMetadataRuns:49}}])assert.throws(()=>prepareFiniteTrialGate({...context(f),gate:{...f.gate,...patch}}));
});
test('pre-T, expiry and frame overflow return NO_IO before token or GET; attempt2 cannot reserve',async()=>{
 for(const [n,t] of [[10,-1],[10,7200],[58,1]]){const f=armedFixture();f.setNow(at(t));const reader=createArmedMetadataAdmission({...context(f),credentialProvider:f.credentialProvider,fetchImpl:f.fetchImpl,clock:f.clock});assert.equal((await reader.check({currentRunId:'1000',currentRunNumber:n})).status,'NO_IO');assert.equal(f.lookups(),0);assert.equal(f.calls.length,0);await assert.rejects(reader.check({currentRunId:'1000',currentRunNumber:n}));}
 const f=armedFixture(),dir=temp();try{await assert.rejects(reserveArmedMetadataAttempt({...context(f),currentRunId:'1000',currentRunNumber:10,runAttempt:2,controlDirectory:dir}));assert.equal(f.calls.length,0)}finally{rmSync(dir,{recursive:true,force:true})}
});
test('delayed pre-T current uses one public GET and never authorizes the body',async()=>{
 const f=armedFixture(),r=current(f,10,-1),dir=temp();f.setNow(at(3));r.updated_at=at(3);try{const result=await admission(f,r,dir);assert.equal(result.status,'NO_IO');assert.equal(result.metadataGets,1);assert.equal(f.calls.length,1)}finally{rmSync(dir,{recursive:true,force:true})}
});
test('synthetic E2E: pre-T and delayed pre-T NoIo, 24 natural observations, full jobs, one immutable save and receipt',async()=>{
 const f=armedFixture(),root=temp(),audit=JSON.stringify(f.audit);let totalGH=0;
 try{
  const pre=f.raw(1010,10,source,'schedule',at(-300),at(-290));f.rows.push(pre);f.complete(pre,{noIo:true});
  const delayed=f.raw(1011,11,source,'schedule',at(-1),at(10));f.rows.push(delayed);f.complete(delayed,{noIo:true,startedAt:at(0)});
  // Collector reserves once before T, then waits without obtaining any credential.
  f.setNow(at(-599));const collectorDir=join(root,'collector'),collectorPermit=await reserveEvidenceAttempt({...context(f),currentRunId:'9000',currentRunNumber:6,runAttempt:1,controlDirectory:collectorDir,clock:f.clock});assert.equal(f.lookups(),0);
  for(let i=0;i<24;i++){
   const r=current(f,12+i,30+i*300),dir=join(root,'run-'+r.id),p=await permit(f,r,dir);assert.equal(p.windowOrdinal,i+1);assert.ok(p.metadataGets<=4);
   const receipt=await observe(f,r,p);assert.equal(receipt.status,'OBSERVED_MATCH');assert.equal(receipt.trialOrdinal,i+1);assert.ok(receipt.githubGets<=60);totalGH+=receipt.githubGets;
   await assert.rejects(observe(f,r,p));f.complete(r);
  }
  f.setNow(at(7201));f.collector.updated_at=at(7201);
  const e=await collectTrialEnvelope({...context(f),currentRunId:'9000',currentRunNumber:6,permit:collectorPermit,credentialProvider:f.credentialProvider,fetchImpl:f.fetchImpl,clock:f.clock});
  assert.equal(e.schemaVersion,2);assert.equal(e.complete,true);assert.equal(e.trialCoverageStatus,'CONDITIONS_MET');assert.equal(e.windowObservedRuns,24);assert.equal(e.runs.filter(r=>r.classification==='ARMED_PRETRIAL_NO_IO_RETAINED').length,2);assert.equal(e.runs.find(r=>r.id==='38166551243').classification,'UNRESOLVED_PRETRIAL_INCIDENT_RETAINED');
  assert.equal(e.liveFreshness,'NOT_ASSESSED');assert.equal(e.schedulerProvenanceVerified,false);assert.equal(e.deployAllowed,false);assert.equal(e.acceptance,false);assert.equal(JSON.stringify(f.audit),audit);
  const encoded=encodeTrialEnvelope(e),path=await writeTrialEnvelope({directory:collectorDir,envelope:e});assert.ok(encoded.bytes.length<=131072);assert.ok(totalGH+e.githubGets<=1600);
  const saved=makeSavedReceipt({envelope:e,jsonBytes:readFileSync(path),artifactId:'17',artifactDigest:'4'.repeat(64),expectedGateSha256:fingerprint(f.gate),expectedJsonSha256:encoded.sha256,currentRunId:'9000',currentRunNumber:6,sourceSha:source,clock:f.clock});assert.equal(saved.jsonSha256,encoded.sha256);
  for(const secret of [f.b.accountId,f.b.workerTag,f.b.credentialId,'synthetic-provider-token','synthetic-github-token','fixture-only'])assert.ok(!encoded.bytes.toString().includes(secret));
  await assert.rejects(writeTrialEnvelope({directory:collectorDir,envelope:e}));await assert.rejects(collectTrialEnvelope({...context(f),currentRunId:'9000',currentRunNumber:6,permit:collectorPermit,credentialProvider:f.credentialProvider,fetchImpl:f.fetchImpl,clock:f.clock}));
  const bad=structuredClone(e);bad.runs.at(-1).windowOrdinal=1;assert.throws(()=>encodeTrialEnvelope(bad));
  writeFileSync(new URL('../../../armed-synthetic-envelope.json',import.meta.url),encoded.bytes);
 }finally{rmSync(root,{recursive:true,force:true})}
});
for(const fault of ['missing prefix','source drift','count drift','wrong registration','metadata quota'])test('public admission rejects '+fault+' without any body permit',async()=>{
 const f=armedFixture(),pre=f.raw(1010,10,source,'schedule',at(-10),at(-5),'skipped');f.rows.push(pre);f.jobs[pre.id]={total_count:0,jobs:[]};const r=current(f,11,10),dir=temp();
 if(fault==='missing prefix')f.rows.splice(f.rows.indexOf(pre),1);
 if(fault==='source drift')pre.head_sha='f'.repeat(40);
 if(fault==='wrong registration')f.gate.registration.afterRunId='38147019542';

 const original=f.fetchImpl;f.fetchImpl=async(u,i)=>{const response=await original(u,i);if(fault==='metadata quota'&&u.includes('/workflows/')&&new URL(u).searchParams.get('created').startsWith('2026-10-12')){return Response.json({total_count:201,workflow_runs:Array.from({length:100},(_,i)=>f.raw(5000+i+100*Number(new URL(u).searchParams.get('page')),1,source,'schedule',at(-599),at(-598),'skipped'))})}if(fault==='count drift'&&u.includes('/workflows/')){const json=await response.json();json.total_count++;return Response.json(json)}return response};
 try{await assert.rejects(admission(f,r,dir));assert.ok(f.calls.length<=4);if(fault==='metadata quota')assert.equal(f.calls.length,4);assert.ok(f.calls.every(u=>u.startsWith('https://api.github.com/')))}finally{rmSync(dir,{recursive:true,force:true})}
});
for(const fault of ['pre-T unknown failure','cancelled alone','wrong scope digest','pending predecessor','ordinal changes','current time drift','registration drift','shared deadline','proven NoIo failure'])test('body fails closed before CF: '+fault,async()=>{
 const f=armedFixture(),pre=f.raw(1010,10,source,'schedule',at(-10),at(-5),'skipped');f.rows.push(pre);f.jobs[pre.id]={total_count:0,jobs:[]};const r=current(f,11,10),dir=temp();let baseline=0,cf=0;
 try{
  const p=await permit(f,r,dir);
  if(fault==='pre-T unknown failure'){pre.conclusion='failure';f.jobs[pre.id]={total_count:0,jobs:[]}}
  if(fault==='cancelled alone'){pre.conclusion='cancelled';f.jobs[pre.id]={total_count:0,jobs:[]}}
  if(fault==='wrong scope digest'){f.complete(pre,{noIo:true});f.jobs[pre.id].jobs[1].steps[1].name='Monitor armed scope '+'0'.repeat(64)}
  if(fault==='pending predecessor'){pre.status='in_progress';pre.conclusion=null}
  if(fault==='ordinal changes'){pre.created_at=T;pre.updated_at=at(1)}
  if(fault==='current time drift')r.created_at=at(11);
  if(fault==='registration drift')pre.run_number=9;
  if(fault==='proven NoIo failure'){f.complete(pre,{noIo:true});pre.conclusion='failure'}
  if(fault==='shared deadline')f.setNow(new Date(Date.parse(p.deadlineAt)).toISOString());
  await assert.rejects(observe(f,r,p,{baselineJsonProvider:async()=>{baseline++;return JSON.stringify(f.b)},providerCredentialProvider:async()=>{cf++;return 'synthetic-provider-token'}}));assert.equal(cf,0);if(fault==='shared deadline')assert.equal(baseline,0);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('new trial failure, 25th ordinal and duplicate/crash markers cannot obtain further provider authority',async()=>{
 const f=armedFixture();for(let i=0;i<24;i++){const r=f.raw(1010+i,10+i,source,'schedule',at(i*100),at(i*100+10),'failure');f.rows.push(r);f.jobs[r.id]={total_count:0,jobs:[]}}const r=current(f,34,2500),dir=temp();try{const result=await admission(f,r,dir);assert.equal(result.status,'NO_IO');assert.ok(result.metadataGets<=4);await assert.rejects(admission(f,r,dir));}finally{rmSync(dir,{recursive:true,force:true})}
 const g=armedFixture(),bad=g.raw(1010,10,source,'schedule',T,at(10),'failure');g.rows.push(bad);g.jobs[bad.id]={total_count:0,jobs:[]};const later=current(g,11,300),d=temp();let cf=0;try{const p=await permit(g,later,d);await assert.rejects(observe(g,later,p,{providerCredentialProvider:async()=>{cf++;return 'synthetic-provider-token'}}));assert.equal(cf,0)}finally{rmSync(d,{recursive:true,force:true})}
});
test('complete collector preserves natural coverage gaps and never counts manual successes',async()=>{
 for(const kind of ['601 gap','manual']){const f=armedFixture(),dir=temp();try{for(let i=0;i<13;i++){const time=i===10&&kind==='601 gap'?5551:i*550;const r=f.raw(1010+i,10+i,source,kind==='manual'?'workflow_dispatch':'schedule',at(time),at(time+10));f.rows.push(r);f.complete(r)}const e=await evidence(f,dir);assert.equal(e.complete,true);assert.equal(e.trialCoverageStatus,'NOT_CONFIRMED');if(kind==='manual'){assert.equal(e.windowObservedRuns,0);assert.equal(e.reason,'TRIAL_INCIDENT_RETAINED')}}finally{rmSync(dir,{recursive:true,force:true})}}
});
test('split quotas remain GH1600 / CF768 / public72 without retries or refill',()=>{assert.equal(48*4+24*56+64,1600);assert.equal(24*32,768);assert.equal(24*3,72)});
test('old actual registration anchor admits from A..now; cross-midnight uses exactly 4 GETs',async()=>{
 for(const T2 of ['2026-10-15T01:00:00Z','2026-10-15T00:10:00Z']){const f=armedFixture(),dir=temp(),v=n=>new Date(Date.parse(T2)+n*1000).toISOString();Object.assign(f.gate.trial,{startedAt:T2,expiresAt:v(7200)});f.gate.transition.effectiveAt=T2;f.gate.registration.registeredAt=v(-1200);Object.assign(f.gate.evidence,{notBefore:v(7200),expiresAt:v(10800)});const r={...f.raw(1000,10,source,'schedule',T2,v(3),null),status:'in_progress'};f.rows.push(r);f.setNow(v(3));try{const a=await admission(f,r,dir);assert.equal(a.status,'ADMITTED');assert.equal(a.permit.windowOrdinal,1);assert.equal(a.permit.metadataGets,T2.includes('00:10')?4:3);assert.ok(f.calls.filter(u=>u.includes('/workflows/')).every(u=>!u.includes('2026-10-11')))}finally{rmSync(dir,{recursive:true,force:true})}}
});
test('metadata rejects inverted registration time before prefix query or body permit; equality remains valid',async()=>{
 for(const inverted of [true,false]){const f=armedFixture(),root=f.rows.find(r=>String(r.id)===f.gate.registration.afterRunId),r=current(f),dir=temp();root.updated_at=new Date(Date.parse(root.created_at)-(inverted?1000:0)).toISOString();
  try{if(inverted){await assert.rejects(admission(f,r,dir));assert.equal(f.calls.length,2);assert.ok(f.calls.every(u=>u.startsWith('https://api.github.com/')&&!u.includes('/workflows/')));assert.throws(()=>readFileSync(join(dir,'admission.json')));await assert.rejects(admission(f,r,dir));assert.equal(f.calls.length,2)}else assert.equal((await admission(f,r,dir)).status,'ADMITTED');}
  finally{rmSync(dir,{recursive:true,force:true})}
 }
});
test('body GH56 ceiling prevents 57th call and CF when full immutable history exceeds it',async()=>{
 const f=armedFixture(),dir=temp(),T2='2026-12-31T01:00:00Z',v=n=>new Date(Date.parse(T2)+n*1000).toISOString();Object.assign(f.gate.trial,{startedAt:T2,expiresAt:v(7200)});f.gate.transition.effectiveAt=T2;f.gate.registration.registeredAt=v(-600);Object.assign(f.gate.evidence,{notBefore:v(7200),expiresAt:v(10800)});const r={...f.raw(1000,10,source,'schedule',T2,v(3),null),status:'in_progress'};f.rows.push(r);f.setNow(v(3));let cf=0;
 try{const p=await permit(f,r,dir),before=f.calls.length;await assert.rejects(observe(f,r,p,{providerCredentialProvider:async()=>{cf++;return 'synthetic-provider-token'}}));assert.equal(f.calls.length-before,56);assert.equal(cf,0)}finally{rmSync(dir,{recursive:true,force:true})}
});
test('a phase consuming 120 seconds cannot reset deadline or reference provider credential',async()=>{
 const f=armedFixture(),r=current(f),dir=temp();let cf=0;try{const p=await permit(f,r,dir);await assert.rejects(observe(f,r,p,{baselineJsonProvider:async()=>{f.setNow(p.deadlineAt);return JSON.stringify(f.b)},providerCredentialProvider:async()=>{cf++;return 'synthetic-provider-token'}}));assert.equal(cf,0)}finally{rmSync(dir,{recursive:true,force:true})}
});
