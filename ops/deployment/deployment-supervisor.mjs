// This controller must run on an independently owned operator host, outside the
// deployment job. A finally block in that job is not an independent supervisor.
import {validateSelection,validateRevocation,authority} from './deployment-policy.mjs';
const fail=code=>{throw Error(code)};
const id=v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
export function createIndependentSupervisor({selection,tokenId,runId,workflowSha,deadlineAt,authorizeArm,verifyReady,readRun,verifySuccess,revokeToken,containEndpoints,clock=Date.now,callbackTimeoutMs=120000}){
 validateSelection(selection);
 if(!id(tokenId)||typeof runId!=='string'||!/^[1-9][0-9]*$/.test(runId)||!sha(workflowSha)||typeof deadlineAt!=='string'||!Number.isFinite(Date.parse(deadlineAt))||Date.parse(deadlineAt)<=clock()||Date.parse(deadlineAt)-clock()>900000||!Number.isSafeInteger(callbackTimeoutMs)||callbackTimeoutMs<1||callbackTimeoutMs>120000||[authorizeArm,verifyReady,readRun,verifySuccess,revokeToken,containEndpoints,clock].some(fn=>typeof fn!=='function'))fail('INVALID_SUPERVISOR_CONFIGURATION');
 const immutableSelection=Object.freeze({...selection}),identity=Object.freeze({repository:authority.repository,runId,runAttempt:1,workflowSha,tokenId,selection:immutableSelection});
 let state='UNARMED',busy=false,terminal;
 async function bounded(callback,limit=callbackTimeoutMs){let timer;const controller=new AbortController(),operation=Object.freeze({signal:controller.signal,deadlineAt:clock()+Math.max(1,limit)});try{return await Promise.race([Promise.resolve().then(()=>callback(identity,operation)),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('SUPERVISOR_CALLBACK_TIMEOUT'))},Math.max(1,limit))})])}finally{clearTimeout(timer);controller.abort()}}
 async function emergency(reason){
  // Both actions are attempted even when revoke fails or its response is unknown.
  // No mutation retry. Unknown remains unresolved for explicit operator recovery.
  let revoke=false,contain=false;
  try {const r=await bounded(revokeToken);revoke=validateRevocation(r,tokenId,clock())}catch{}
  try {const r=await bounded(containEndpoints);const observed=Date.parse(r?.observedAt);contain=r?.worker===authority.worker&&r.workersDev===false&&r.previewUrls===false&&r.readbackVerified===true&&Number.isFinite(observed)&&observed<=clock()&&clock()-observed<=120000}catch{}
  state=revoke&&contain?'FAILED_CONTAINED':'FAILED_UNRESOLVED';
  terminal={state,reason,revocationVerified:revoke,containmentVerified:contain,rollbackAuthorization:false};
  return {...terminal};
 }
 async function arm(){
  if(state!=='UNARMED'||busy)fail('SUPERVISOR_ARM_STATE');busy=true;
  try {
   let allowed=false,ready;try{allowed=await bounded(authorizeArm);if(allowed===true)ready=await bounded(verifyReady)}catch{fail('SUPERVISOR_AUTHORIZATION_OR_CAPABILITY')}
   const observed=Date.parse(ready?.observedAt);
   if(allowed!==true||ready?.independentHost!==true||ready.capabilityVerified!==true||!id(ready.revokeCredentialId)||!id(ready.containmentCredentialId)||ready.revokeCredentialId===tokenId||ready.containmentCredentialId===tokenId||!Number.isFinite(observed)||observed>clock()||clock()-observed>120000||clock()>=Date.parse(deadlineAt))fail('SUPERVISOR_AUTHORIZATION_OR_CAPABILITY');
   state='ARMED';return {state,runId,deadlineAt};
  }finally{busy=false}
 }
 async function poll(){
  if(terminal)return {...terminal};if(state!=='ARMED'||busy)fail('SUPERVISOR_POLL_STATE');busy=true;
  try {
   if(clock()>=Date.parse(deadlineAt))return await emergency('DEADLINE_EXCEEDED');
   let run;try{run=await bounded(readRun,Math.min(10000,callbackTimeoutMs,Date.parse(deadlineAt)-clock()))}catch{return await emergency('RUN_READBACK_UNKNOWN')}
   if(run?.repository!==authority.repository||run.id!==runId||run.runAttempt!==1||run.sourceSha!==workflowSha||run.event!=='workflow_dispatch'||run.headBranch!=='main'||run.path!=='.github/workflows/deploy-site.yml'||run.actor!=='Xpotato1024')return await emergency('RUN_IDENTITY_CHANGED');
   if(['queued','in_progress','waiting','pending','requested'].includes(run.status)&&run.conclusion===null)return {state:'ARMED',runId,deadlineAt};
   if(run.status!=='completed'||run.conclusion!=='success')return await emergency('RUN_FAILED_OR_UNKNOWN');
   let verified=false;try{verified=await bounded(verifySuccess,Math.min(callbackTimeoutMs,Date.parse(deadlineAt)-clock()))}catch{return await emergency('INDEPENDENT_POSTCHECK_UNKNOWN')}
   if(verified!==true||clock()>=Date.parse(deadlineAt))return await emergency('INDEPENDENT_POSTCHECK_FAILED');
   state='SUCCEEDED_VERIFIED';terminal={state,tokenId,credentialLifecycle:'ACTIVE_UNTIL_REVIEWED_ROTATION',acceptance:false,limitations:'Controller result only. Independent host, authenticated callback wiring and live acceptance remain separately required.'};return {...terminal};
  }finally{busy=false}
 }
 async function stop(){if(terminal)return {...terminal};if(state!=='ARMED'||busy)fail('SUPERVISOR_STOP_STATE');busy=true;try{return await emergency('SUPERVISOR_STOP_REQUESTED')}finally{busy=false}}
 return Object.freeze({arm,poll,stop,state:()=>state});
}

// Explicitly invoked by an independently owned host, never at module import.
export async function runSupervisorLoop(supervisor,{wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),pollIntervalMs=10000}={}){
 if(typeof wait!=='function'||!Number.isSafeInteger(pollIntervalMs)||pollIntervalMs<1||pollIntervalMs>10000)fail('INVALID_SUPERVISOR_LOOP');
 await supervisor.arm();
 for(;;){const result=await supervisor.poll();if(result.state!=='ARMED')return result;try{await wait(pollIntervalMs)}catch{return await supervisor.stop()}}
}
