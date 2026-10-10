// Host-only dispatch boundary. API, ledger and dispatch are injected for offline tests.
import {createHash} from 'node:crypto';
import {prepareApprovedBaseline,prepareRuntimeGate} from './site-monitor-runtime.mjs';
export const bootstrapSourcePaths=Object.freeze([
 '.github/workflows/site-integrity-monitor.yml',
 'docs/operations/site-monitor-bootstrap-approval.json',
 'scripts/release/site-monitor-bootstrap.mjs',
 'scripts/release/site-monitor-bootstrap-cli.mjs',
 'scripts/release/site-monitor-bootstrap-once.mjs',
 'scripts/release/site-monitor-bootstrap-once-cli.mjs',
 'scripts/release/site-integrity-monitor.mjs',
 'scripts/release/site-integrity-monitor-cli.mjs',
 'scripts/release/site-monitor-runtime.mjs',
 'scripts/release/site-monitor-runtime-history.mjs',
 'scripts/release/site-monitor-history.mjs',
 'scripts/release/deployment-http.mjs',
 'scripts/release/deployment-policy.mjs'
]);
const repo='Xpotato1024/xpotato-site',workflow='site-integrity-monitor.yml';
const fail=()=>{throw Error('MONITOR_BOOTSTRAP_DISPATCH_BLOCKED')};
export const sourceDigest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function dispatchMonitorBootstrapOnce({expectedSourceSha,baselineJson,approval,reviewedSourceHashes,alreadyReserved,api,reserve,update,dispatch,clock=()=>new Date().toISOString()}){
 if(alreadyReserved)fail();
 if(typeof expectedSourceSha!=='string'||!/^[a-f0-9]{40}$/.test(expectedSourceSha))fail();
 const inputs={mode:'bootstrap',expected_source_sha:expectedSourceSha};
 prepareApprovedBaseline(baselineJson,approval);
 if(!reviewedSourceHashes||Object.keys(reviewedSourceHashes).sort().join('|')!==[...bootstrapSourcePaths].sort().join('|')||!Object.values(reviewedSourceHashes).every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)))fail();
 if((await api('user'))?.login!=='Xpotato1024'||(await api(`repos/${repo}/branches/main`))?.commit?.sha!==expectedSourceSha)fail();
 const identity=await api(`repos/${repo}/actions/workflows/${workflow}`);
 if(identity?.path!==`.github/workflows/${workflow}`||identity.state!=='active')fail();
 const variable=await api(`repos/${repo}/actions/variables/SITE_MONITOR_RUNTIME_GATE_JSON`);
 if(variable?.name!=='SITE_MONITOR_RUNTIME_GATE_JSON')fail();
 prepareRuntimeGate({runtimeGateJson:variable.value,approval,sourceSha:expectedSourceSha,phase:'BOOTSTRAP_APPROVED'});
 for(const path of bootstrapSourcePaths){
  const file=await api(`repos/${repo}/contents/${path}?ref=${expectedSourceSha}`);
  if(file?.type!=='file'||file.path!==path||file.encoding!=='base64'||typeof file.content!=='string'||file.content.length>1500000||sourceDigest(Buffer.from(file.content,'base64'))!==reviewedSourceHashes[path])fail();
 }
 for(const ci of ['ci.yml','production-path-review.yml']){
  const result=await api(`repos/${repo}/actions/workflows/${ci}/runs?branch=main&event=push&per_page=20`);
  if(!Array.isArray(result?.workflow_runs))fail();
  const run=result.workflow_runs.find(v=>v?.head_sha===expectedSourceSha);
  if(!run||run.head_branch!=='main'||run.event!=='push'||run.status!=='completed'||run.conclusion!=='success')fail();
 }
 if((await api(`repos/${repo}/branches/main`))?.commit?.sha!==expectedSourceSha)fail();
 let receipt={schemaVersion:1,state:'BOOTSTRAP_DISPATCH_RESERVED',mainSha:expectedSourceSha,workflowPath:`.github/workflows/${workflow}`,baselineSha256:approval.baselineSha256,reservedAt:clock(),dispatchAttempts:1,approvalConsumed:true,bootstrapBudgetRemaining:0,maximumProviderGets:32,maximumPublicGets:3,checkpointAdopted:false,scheduleEnabled:false};
 // reserve must use exclusive creation and durable flush; a competing process loses here.
 await reserve(receipt);
 let sent=false;try{const result=await dispatch(inputs);sent=result?.status===0}catch{}
 receipt={...receipt,state:sent?'BOOTSTRAP_DISPATCH_SENT_ONCE_NO_RETRY':'BOOTSTRAP_DISPATCH_UNKNOWN_NO_RETRY'};
 // A failed update still leaves the durable RESERVED record consuming the approval.
 await update(receipt);
 return receipt;
}
