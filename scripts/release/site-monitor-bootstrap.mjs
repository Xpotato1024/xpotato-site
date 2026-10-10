// Explicitly approved manual bootstrap only. No scheduler, writes or ambient IO.
import {fingerprint,validateMonitorBaseline,createIntegrityMonitor} from './site-integrity-monitor.mjs';
const fail=()=>{throw Error('MONITOR_BOOTSTRAP_BLOCKED')};
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...keys].sort().join('|');
export function validateBootstrapContext(env){
 if(env.SITE_MONITOR_AUTHORIZATION!=='owner-approved-single-monitor-bootstrap'||env.GITHUB_REPOSITORY!=='Xpotato1024/xpotato-site'||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||env.GITHUB_ACTOR!=='Xpotato1024'||env.GITHUB_TRIGGERING_ACTOR!=='Xpotato1024'||env.GITHUB_RUN_ATTEMPT!=='1'||!sha(env.GITHUB_SHA))fail();
}
export function prepareMonitorBootstrap({env,event,approval,checkedOutSha}){
 validateBootstrapContext(env);
 const inputs=event?.inputs;
 if(!exact(inputs,['mode','expected_source_sha','approved_baseline'])||inputs.mode!=='bootstrap'||!sha(inputs.expected_source_sha)||inputs.expected_source_sha!==env.GITHUB_SHA||checkedOutSha!==env.GITHUB_SHA||typeof inputs.approved_baseline!=='string'||Buffer.byteLength(inputs.approved_baseline)>8192)fail();
 if(!exact(approval,['schemaVersion','status','baselineSha256'])||approval.schemaVersion!==1||approval.status!=='OWNER_APPROVED_BOOTSTRAP_ONLY'||typeof approval.baselineSha256!=='string'||!/^[a-f0-9]{64}$/.test(approval.baselineSha256))fail();
 let baseline;try{baseline=JSON.parse(inputs.approved_baseline);validateMonitorBaseline(baseline)}catch{fail()}
 if(baseline.schemaVersion!==2||baseline.checkpointRunId!==null||baseline.samples.length!==1||baseline.samples[0].path!=='/'||fingerprint(baseline)!==approval.baselineSha256)fail();
 return structuredClone(baseline);
}
export function createMonitorBootstrap({env,event,approval,checkedOutSha,credentialProvider,fetchImpl,clock}){
 const baseline=prepareMonitorBootstrap({env,event,approval,checkedOutSha});
 const monitor=createIntegrityMonitor({baseline,credentialProvider,fetchImpl,clock,maxPublicGets:3});
 return Object.freeze({check:async()=>({stage:'BOOTSTRAP_NO_SCHEDULE',...await monitor.check()})});
}
