// Public execution approval is separate from the immutable private baseline.
import {fingerprint,validateMonitorBaseline,monitorTimestamp} from './site-integrity-monitor.mjs';
const fail=()=>{throw Error('MONITOR_RUNTIME_BLOCKED')};
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...keys].sort().join('|');
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export const runId=v=>typeof v==='string'&&/^[1-9][0-9]*$/.test(v);
export const utc=monitorTimestamp;
export function boundedRuntimeJson(value,maxBytes){
 if(typeof value!=='string'||!value.length||Buffer.byteLength(value,'utf8')>maxBytes)fail();
 try{return JSON.parse(value)}catch{fail()}
}
export function validateBaselineApproval(approval){
 if(!exact(approval,['schemaVersion','status','baselineSha256'])||approval.schemaVersion!==1||approval.status!=='OWNER_APPROVED_BASELINE'||!digest(approval.baselineSha256))fail();
}
export function prepareApprovedBaseline(baselineJson,approval){
 validateBaselineApproval(approval);
 const baseline=boundedRuntimeJson(baselineJson,8192);
 try{validateMonitorBaseline(baseline)}catch{fail()}
 if(baseline.schemaVersion!==2||baseline.checkpointRunId!==null||baseline.samples.length!==1||baseline.samples[0].path!=='/'||fingerprint(baseline)!==approval.baselineSha256)fail();
 return structuredClone(baseline);
}
export function validateRuntimeContext(env,eventName,checkedOutSha){
 if(env.GITHUB_REPOSITORY!=='Xpotato1024/xpotato-site'||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_EVENT_NAME!==eventName||env.GITHUB_ACTOR!=='Xpotato1024'||env.GITHUB_TRIGGERING_ACTOR!=='Xpotato1024'||env.GITHUB_RUN_ATTEMPT!=='1'||!runId(env.GITHUB_RUN_ID)||!sha(env.GITHUB_SHA)||checkedOutSha!==env.GITHUB_SHA)fail();
}
export function validateExecutorAudit(audit,baselineSha256){
 if(!exact(audit,['schemaVersion','status','baselineSha256','sourceSha','records'])||audit.schemaVersion!==1||audit.status!=='RECORDED_STOPPED_HISTORY'||audit.baselineSha256!==baselineSha256||!sha(audit.sourceSha)||!Array.isArray(audit.records)||audit.records.length!==2)fail();
 let previous;
 for(const r of audit.records){
  if(!exact(r,['checkpoint','activeAt','stoppedAt','ledgerSha256','receiptSha256','stopReceiptSha256','consumedOnce'])||r.consumedOnce!==true||![r.ledgerSha256,r.receiptSha256,r.stopReceiptSha256].every(digest)||!utc(r.activeAt)||!utc(r.stoppedAt))fail();
  const c=r.checkpoint;if(!exact(c,['runId','runAttempt','event','sourceSha','createdAt','completedAt'])||!runId(c.runId)||c.runAttempt!==1||c.event!=='workflow_dispatch'||c.sourceSha!==audit.sourceSha||!utc(c.createdAt)||!utc(c.completedAt)||Date.parse(c.completedAt)<Date.parse(c.createdAt)||Date.parse(r.activeAt)<Date.parse(c.completedAt)||Date.parse(r.stoppedAt)<Date.parse(r.activeAt)||Date.parse(r.stoppedAt)-Date.parse(c.createdAt)<=600000||previous&&(Date.parse(c.createdAt)<=Date.parse(previous.stoppedAt)||BigInt(c.runId)<=BigInt(previous.checkpoint.runId)))fail();
  previous=r;
 }
 return structuredClone(audit);
}
export function prepareRuntimeGate({runtimeGateJson,approval,sourceSha,phase,executorAudit}){
 validateBaselineApproval(approval);
 const gate=boundedRuntimeJson(runtimeGateJson,4096);
 const v2=gate?.schemaVersion===2;
 if(!exact(gate,['schemaVersion','status','owner','sourceSha','baselineSha256','actionsEmailConfirmed','slackConfirmed','checkpoint',...(v2?['transition']:[])])||![1,2].includes(gate.schemaVersion)||gate.status!==phase||gate.owner!=='Xpotato1024'||!sha(sourceSha)||gate.sourceSha!==sourceSha||gate.baselineSha256!==approval.baselineSha256||gate.actionsEmailConfirmed!==true||gate.slackConfirmed!==true)fail();
 if(v2){
  const audit=validateExecutorAudit(executorAudit,approval.baselineSha256),t=gate.transition;
  if(phase!=='ACTIVE'||!exact(t,['status','auditSha256','effectiveAt'])||t.status!=='OWNER_APPROVED_EXECUTOR_TRANSITION'||t.auditSha256!==fingerprint(audit)||!utc(t.effectiveAt)||Date.parse(t.effectiveAt)<=Date.parse(audit.records.at(-1).stoppedAt)||sourceSha===audit.sourceSha||fingerprint(gate.checkpoint)!==fingerprint(audit.records.at(-1).checkpoint))fail();
 }
 const c=gate.checkpoint;
 if(phase==='BOOTSTRAP_APPROVED'){if(c!==null)fail()}
 else if(phase==='ACTIVE'){
  if(!exact(c,['runId','runAttempt','event','sourceSha','createdAt','completedAt'])||!runId(c.runId)||c.runAttempt!==1||c.event!=='workflow_dispatch'||c.sourceSha!==(v2?executorAudit.sourceSha:sourceSha)||!utc(c.createdAt)||!utc(c.completedAt)||Date.parse(c.completedAt)<Date.parse(c.createdAt))fail();
 }else fail();
 return structuredClone(gate);
}
export function prepareObservationContext({env,approval,checkedOutSha,runtimeGateJson,executorAudit}){
 if(env.SITE_MONITOR_AUTHORIZATION!=='separately-approved-readonly-monitor')fail();
 validateRuntimeContext(env,'schedule',checkedOutSha);
 return prepareRuntimeGate({runtimeGateJson,approval,sourceSha:env.GITHUB_SHA,phase:'ACTIVE',executorAudit});
}
