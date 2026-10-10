// Public execution approval is separate from the immutable private baseline.
import {fingerprint,validateMonitorBaseline} from './site-integrity-monitor.mjs';
const fail=()=>{throw Error('MONITOR_RUNTIME_BLOCKED')};
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...keys].sort().join('|');
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export const runId=v=>typeof v==='string'&&/^[1-9][0-9]*$/.test(v);
export const utc=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v.replace(/Z$/,v.includes('.')?'Z':'.000Z');
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
export function prepareRuntimeGate({runtimeGateJson,approval,sourceSha,phase}){
 validateBaselineApproval(approval);
 const gate=boundedRuntimeJson(runtimeGateJson,4096);
 if(!exact(gate,['schemaVersion','status','owner','sourceSha','baselineSha256','actionsEmailConfirmed','slackConfirmed','checkpoint'])||gate.schemaVersion!==1||gate.status!==phase||gate.owner!=='Xpotato1024'||!sha(sourceSha)||gate.sourceSha!==sourceSha||gate.baselineSha256!==approval.baselineSha256||gate.actionsEmailConfirmed!==true||gate.slackConfirmed!==true)fail();
 const c=gate.checkpoint;
 if(phase==='BOOTSTRAP_APPROVED'){if(c!==null)fail()}
 else if(phase==='ACTIVE'){
  if(!exact(c,['runId','runAttempt','event','sourceSha','createdAt','completedAt'])||!runId(c.runId)||c.runAttempt!==1||c.event!=='workflow_dispatch'||c.sourceSha!==sourceSha||!utc(c.createdAt)||!utc(c.completedAt)||Date.parse(c.completedAt)<Date.parse(c.createdAt))fail();
 }else fail();
 return structuredClone(gate);
}
export function prepareObservationContext({env,approval,checkedOutSha,runtimeGateJson}){
 if(env.SITE_MONITOR_AUTHORIZATION!=='separately-approved-readonly-monitor')fail();
 validateRuntimeContext(env,'schedule',checkedOutSha);
 return prepareRuntimeGate({runtimeGateJson,approval,sourceSha:env.GITHUB_SHA,phase:'ACTIVE'});
}
