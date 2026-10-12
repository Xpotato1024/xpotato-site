import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fingerprint} from './site-integrity-monitor.mjs';
import {createFiniteHistoryReader} from './site-monitor-finite.mjs';
import {reserveEvidenceAttempt,prepareEvidenceWait,restoreEvidenceWait,collectTrialEnvelope} from './site-monitor-evidence.mjs';
import {assessEvidenceWaitReadiness} from './site-monitor-evidence-ready.mjs';
import {armedFixture,source,T,at} from './site-monitor-armed-fixture.mjs';
const setup=()=>{const f=armedFixture(),dir=mkdtempSync(join(tmpdir(),'finite-ready-'));f.setNow(at(-599));return {f,dir,options:{gate:f.gate,audit:f.audit,sourceSha:source,baselineSha256:f.gate.baselineSha256,currentRunId:'9000',currentRunNumber:6,runAttempt:1,controlDirectory:dir,clock:f.clock}}};
async function prepare(s){const permit=await reserveEvidenceAttempt(s.options);return {...await prepareEvidenceWait({...s.options,permit,credentialProvider:s.f.credentialProvider,fetchImpl:s.f.fetchImpl,waitImpl:async ms=>s.f.setNow(new Date(s.f.clock()+ms).toISOString())}),permit}}
function assessment(s,r){const stamp=r.receipt.firstWaitCompletedAt,job={name:'evidence',run_id:9000,head_sha:source,status:'in_progress',conclusion:null,started_at:at(-599),steps:[{name:'Reserve and begin finite wait',number:3,status:'completed',conclusion:'success',started_at:at(-599),completed_at:stamp},{name:'Evidence wait started '+r.sha256,number:4,status:'completed',conclusion:'success',started_at:stamp,completed_at:stamp},{name:'Collect finite complete evidence',number:5,status:'in_progress',conclusion:null,started_at:stamp}]};return {receipt:r.receipt,gate:s.f.gate,audit:s.f.audit,sourceSha:source,run:structuredClone(s.f.collector),job,clock:s.f.clock,readinessDeadline:at(-1)}}
test('reservation + public identity + prefix + first wait has a verifiable allowlisted receipt; in_progress alone is insufficient',async()=>{
 const s=setup();try{const r=await prepare(s),a=assessment(s,r);assert.equal(r.receipt.githubGetsSpent,3);assert.equal(r.receipt.githubGetsRemaining,61);assert.equal(readFileSync(join(s.dir,'consumed-9000'),'utf8').includes('"logicalUploadsReserved":1'),true);assert.equal(assessEvidenceWaitReadiness(a).ready,true);assert.equal(assessEvidenceWaitReadiness({...a,job:{...a.job,steps:a.job.steps.slice(-1)}}).ready,false);
 for(const secret of [s.f.b.accountId,s.f.b.workerTag,'synthetic-github-token','synthetic-provider-token','Authorization','https://'])assert.ok(!JSON.stringify(r.receipt).includes(secret));
 for(const patch of [{run:{...a.run,run_attempt:2}},{run:{...a.run,head_sha:'f'.repeat(40)}},{run:{...a.run,status:'completed',conclusion:'failure'}},{job:{...a.job,status:'completed',conclusion:'cancelled'}},{receipt:{...r.receipt,githubGetsSpent:0}},{receipt:{...r.receipt,raw:'forbidden'}},{gate:{...a.gate,readApproval:{...a.gate.readApproval,ownerDecisionSha256:'0'.repeat(64)}}},{audit:{...a.audit,baselineSha256:'0'.repeat(64)}},{job:{...a.job,steps:a.job.steps.slice(0,2)}},{readinessDeadline:r.receipt.firstWaitCompletedAt}])assert.equal(assessEvidenceWaitReadiness({...a,...patch}).ready,false);
 await assert.rejects(prepareEvidenceWait({...s.options,permit:r.permit}));await assert.rejects(reserveEvidenceAttempt(s.options));
 }finally{rmSync(s.dir,{recursive:true,force:true})}
});
test('GitHub second-precision completion contains the receipt millisecond; previous bucket and exact earlier time reject',async()=>{
 const s=setup();try{s.f.setNow(new Date(s.f.clock()+500).toISOString());const r=await prepare(s),a=assessment(s,r),floor=r.receipt.firstWaitCompletedAt.replace(/\.\d{3}Z$/,'Z');
 a.job.steps[0].completed_at=floor;a.job.steps[1].started_at=floor;a.job.steps[1].completed_at=floor;a.job.steps[2].started_at=floor;assert.equal(assessEvidenceWaitReadiness(a).ready,true);
 a.job.steps[0].completed_at=new Date(Date.parse(floor)-1000).toISOString().replace('.000Z','Z');assert.equal(assessEvidenceWaitReadiness(a).ready,false);
 a.job.steps[0].completed_at=new Date(Date.parse(floor)).toISOString();assert.equal(assessEvidenceWaitReadiness(a).ready,false);
 }finally{rmSync(s.dir,{recursive:true,force:true})}
});
for(const fault of ['wrong actual run','source drift','pending prefix','missing prefix','count drift','root time inversion','deadline','failed first wait'])test('preparation fail closed without retry: '+fault,async()=>{
 const s=setup();try{const pre=s.f.raw(1000,10,source,'schedule',at(-600),at(-599),'skipped');s.f.rows.push(pre);
 if(fault==='wrong actual run')s.f.collector.run_number++;
 if(fault==='source drift')pre.head_sha='f'.repeat(40);
 if(fault==='pending prefix'){pre.status='in_progress';pre.conclusion=null}
 if(fault==='missing prefix')pre.run_number++;
 if(fault==='root time inversion'){const root=s.f.rows.find(r=>String(r.id)===s.f.gate.registration.afterRunId);root.updated_at=new Date(Date.parse(root.created_at)-1000).toISOString()}
 if(fault==='deadline')s.f.setNow(T);
 const permit=await reserveEvidenceAttempt(s.options),original=s.f.fetchImpl,fetchImpl=async(...args)=>{const response=await original(...args);if(fault==='count drift'&&args[0].includes('/workflows/')){const value=await response.json();value.total_count++;return Response.json(value)}return response};
 await assert.rejects(prepareEvidenceWait({...s.options,permit,credentialProvider:s.f.credentialProvider,fetchImpl,waitImpl:async ms=>{if(fault==='failed first wait')throw Error('synthetic-private-never-reflect');s.f.setNow(new Date(s.f.clock()+ms).toISOString())}}));
 assert.ok(s.f.calls.length<=4);assert.throws(()=>readFileSync(join(s.dir,'wait-ready.json')));await assert.rejects(prepareEvidenceWait({...s.options,permit}));if(fault==='deadline'){assert.equal(s.f.lookups(),0);assert.equal(s.f.calls.length,0)}
 }finally{rmSync(s.dir,{recursive:true,force:true})}
});
test('crash after reservation has no receipt; crash after restore cannot recover, duplicate or refill',async()=>{
 const s=setup();try{await reserveEvidenceAttempt(s.options);await assert.rejects(restoreEvidenceWait({...s.options,expectedSha256:'0'.repeat(64)}));assert.equal(s.f.lookups(),0);await assert.rejects(reserveEvidenceAttempt(s.options))}finally{rmSync(s.dir,{recursive:true,force:true})}
 const t=setup();try{const r=await prepare(t);await assert.rejects(collectTrialEnvelope({...t.options,permit:r.permit}));const p=await restoreEvidenceWait({...t.options,expectedSha256:r.sha256});await assert.rejects(restoreEvidenceWait({...t.options,expectedSha256:r.sha256}));t.f.setNow(at(7201));t.f.collector.created_at=at(-598);t.f.collector.updated_at=at(7201);const e=await collectTrialEnvelope({...t.options,permit:p,credentialProvider:t.f.credentialProvider,fetchImpl:t.f.fetchImpl});assert.equal(e.complete,false);assert.equal(e.githubGets,4);await assert.rejects(collectTrialEnvelope({...t.options,permit:p}));}finally{rmSync(t.dir,{recursive:true,force:true})}
});
test('tampered or changed-context receipt cannot restore a budget; expired restore references no credential',async()=>{
 for(const fault of ['bytes','digest','run','gate','expiry']){const s=setup();try{const r=await prepare(s),before=s.f.lookups();if(fault==='bytes')writeFileSync(join(s.dir,'wait-ready.json'),'{}');if(fault==='expiry')s.f.setNow(s.f.gate.evidence.expiresAt);
 await assert.rejects(restoreEvidenceWait({...s.options,expectedSha256:fault==='digest'?'0'.repeat(64):r.sha256,...(fault==='run'?{currentRunId:'9001'}:{}),...(fault==='gate'?{gate:{...s.f.gate,readApproval:{...s.f.gate.readApproval,ownerDecisionSha256:'0'.repeat(64)}}}:{})}));assert.equal(s.f.lookups(),before)}finally{rmSync(s.dir,{recursive:true,force:true})}}
});
test('preparation and collector share GH64: spent4 means only 60 subsequent GETs, never a 65th',async()=>{
 const s=setup();try{s.f.setNow(at(7201));s.f.collector.updated_at=at(7201);let calls=0;const reader=createFiniteHistoryReader({...s.options,initialGithubGets:4,credentialProvider:s.f.credentialProvider,fetchImpl:async(...args)=>{calls++;return s.f.fetchImpl(...args)}});const T2='2026-12-31T01:00:00Z',v=n=>new Date(Date.parse(T2)+n*1000).toISOString();Object.assign(s.f.gate.trial,{startedAt:T2,expiresAt:v(7200)});s.f.gate.transition.effectiveAt=T2;s.f.gate.registration.registeredAt=v(-600);Object.assign(s.f.gate.evidence,{notBefore:v(7200),expiresAt:v(10800)});s.f.collector.created_at=v(-599);s.f.collector.updated_at=v(7201);s.f.setNow(v(7201));
 const limited=createFiniteHistoryReader({...s.options,initialGithubGets:4,credentialProvider:s.f.credentialProvider,fetchImpl:async(...args)=>{calls++;return s.f.fetchImpl(...args)}});await assert.rejects(limited.read({currentRunId:'9000',currentRunNumber:6,collector:true,expectedCurrentCreatedAt:v(-599)}));assert.equal(calls,60);assert.equal(limited.gets(),64);
 assert.throws(()=>createFiniteHistoryReader({...s.options,initialGithubGets:5}));
 }finally{rmSync(s.dir,{recursive:true,force:true})}
});
