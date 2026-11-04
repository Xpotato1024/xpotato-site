// Explicitly approved manual bootstrap only. No scheduler, writes or ambient IO.
import {createIntegrityMonitor} from './site-integrity-monitor.mjs';
import {prepareApprovedBaseline,prepareRuntimeGate,validateRuntimeContext,runId} from './site-monitor-runtime.mjs';
const fail=()=>{throw Error('MONITOR_BOOTSTRAP_BLOCKED')};
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...keys].sort().join('|');
export function validateBootstrapContext(env){
 if(env.SITE_MONITOR_AUTHORIZATION!=='owner-approved-single-monitor-bootstrap'||env.GITHUB_REPOSITORY!=='Xpotato1024/xpotato-site'||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||env.GITHUB_ACTOR!=='Xpotato1024'||env.GITHUB_TRIGGERING_ACTOR!=='Xpotato1024'||env.GITHUB_RUN_ATTEMPT!=='1'||!sha(env.GITHUB_SHA)||!runId(env.GITHUB_RUN_ID))fail();
}
export function prepareBootstrapContext({env,event,approval,checkedOutSha,runtimeGateJson}){
 validateBootstrapContext(env);
 validateRuntimeContext(env,'workflow_dispatch',checkedOutSha);
 const inputs=event?.inputs;
 if(!exact(inputs,['mode','expected_source_sha'])||inputs.mode!=='bootstrap'||!sha(inputs.expected_source_sha)||inputs.expected_source_sha!==env.GITHUB_SHA)fail();
 return prepareRuntimeGate({runtimeGateJson,approval,sourceSha:env.GITHUB_SHA,phase:'BOOTSTRAP_APPROVED'});
}
export function prepareMonitorBootstrap(options){
 try{prepareBootstrapContext(options);return prepareApprovedBaseline(options.baselineJson,options.approval)}catch{fail()}
}
export function createMonitorBootstrap({credentialProvider,fetchImpl,clock,...options}){
 const baseline=prepareMonitorBootstrap(options);
 const monitor=createIntegrityMonitor({baseline,credentialProvider,fetchImpl,clock,maxPublicGets:3});
 return Object.freeze({check:async()=>({stage:'BOOTSTRAP_NO_SCHEDULE',...await monitor.check()})});
}
