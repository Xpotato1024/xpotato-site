// SPDX-License-Identifier: AGPL-3.0-only
// Internal bounded controller. SIQS limits are independent of input acceptance.
import {inspectExtendedInput,inspectExtendedDecomposition} from '../core/extended-input-contract.mjs';
import {makeNativeWorker} from '../worker/native-factory.mjs';
import {verifySnapshot,verifyFactorResult,resolvedPrimality} from '../engine/result.mjs';
import {assessPrime} from '../engine/arithmetic.mjs';
import {SMALL_PRIMES} from '../engine/options.mjs';
import {makeComputeScope} from '../site/document-scope.mjs';
import {EXTENDED_RUNNER_LIMITS as limits} from './policy.mjs';
class ExtendedBudgetStop extends Error{constructor(reason){super(reason);this.reason=reason;}}
const privateScope=makeComputeScope(),outcomes=new WeakSet(),progressOutcomes=new WeakSet();
function certify(result){
 const outcome=Object.freeze({...result,factors:Object.freeze(result.factors.map(f=>Object.freeze({...f})))});
 outcomes.add(outcome);return outcome;
}
// Certifies this module's verified prefix/status, not successful completion.
export const isVerifiedExtendedOutcome=(result,input)=>outcomes.has(result)&&result.input===input;
export const isVerifiedExtendedProgress=(result,input)=>progressOutcomes.has(result)&&result.input===input;
export async function runExtendedInput(raw,options={},{
 createWorker=makeNativeWorker,scope=privateScope,scopeToken,now=()=>performance.now()
}={}){
 const {canonical:input}=inspectExtendedInput(raw);
 if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['timeBudgetMs','operationBudget','signal','onProgress','onAccepted'].includes(k)))throw TypeError('Extended options');
 const {timeBudgetMs=limits.defaultTimeMs,operationBudget=limits.defaultOperations,signal,onProgress=()=>{},onAccepted=()=>{}}=options;
 if(!Number.isSafeInteger(timeBudgetMs)||timeBudgetMs<1||timeBudgetMs>limits.maxTimeMs||!Number.isSafeInteger(operationBudget)||operationBudget<1||operationBudget>limits.maxOperations)throw RangeError('Finite extended budget');
 if(typeof createWorker!=='function'||typeof now!=='function'||typeof onProgress!=='function'||typeof onAccepted!=='function'||signal&&(typeof signal.aborted!=='boolean'||typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'))throw TypeError('Extended dependencies');
 const started=now();if(!Number.isFinite(started)||started<0)throw TypeError('Clock');
 let lastTime=started;
 const clock=()=>{const t=now();if(!Number.isFinite(t)||t<lastTime)throw Error('Clock');lastTime=t;return t;};
 const deadline=started+timeBudgetMs,borrowed=scopeToken!==undefined,token=scopeToken??{};
 let accepted={input,factors:[],remaining:input,operations:0,elapsedMs:0},inspection=null;
 const bare=(status,reason)=>({...accepted,inspection,status,reason,primality:status==='neither'?'neither':accepted.primality??(accepted.factors.length?resolvedPrimality(accepted):'unknown'),profile:'private-extended-brent-v1',wasmBytes:0,
  allWorkersDisposed:true,allWorkerSourcesReleased:true,requestWallMs:Math.max(0,lastTime-started)});
 if(signal?.aborted)return certify(bare('cancelled','cancelled'));
 if(BigInt(input)<2n)return certify(bare('neither',null));
 if(borrowed?!scope.owns?.(token):!scope.acquire(token))return certify(bare('blocked',scope.isQuarantined()?'scope-quarantined':'scope-busy'));
 return new Promise(resolve=>{
  let worker=null,done=false,ready=false,timer,sourceReleased=false,sourceAttempted=false,factoryAttempted=false,constructing=false,cancelQueued=false;
  const reportAccepted=()=>{
   const snapshot=Object.freeze({...accepted,factors:Object.freeze(accepted.factors.map(f=>Object.freeze({...f})))});
   progressOutcomes.add(snapshot);try{onAccepted(snapshot);}catch{}
  };
  const notify=stage=>onProgress({stage,fraction:null,acceptedFactors:accepted.factors.length});
  const release=()=>{
   if(sourceAttempted)return sourceReleased;sourceAttempted=true;
   try{if(typeof worker.releaseSource!=='function')throw Error('Source ownership missing');worker.releaseSource();sourceReleased=true;}catch{}
   return sourceReleased;
  };
  const finish=(status,reason)=>{
   if(done)return;const calculationStatus=status,stopCause=reason;done=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);
   let retired=!factoryAttempted,released=!factoryAttempted;
   if(worker){
    worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;released=release();
    try{worker.terminate();retired=true;}catch{}
   }
   if(!retired||!released){status='blocked';reason='worker-retirement';scope.quarantine();}else if(!borrowed)scope.release(token);
   try{clock();}catch{if(status!=='blocked'){status='error';reason='invalid-clock';}}
   const result={...bare(status,reason),calculationStatus,stopCause,allWorkersDisposed:retired,allWorkerSourcesReleased:released};
   try{notify('finished');}catch{}
   resolve(certify(result));
  };
  const cancel=()=>{if(constructing){cancelQueued=true;return;}finish('cancelled','cancelled');};
  function checkSnapshot(snapshot,final=false){
   if(!snapshot||snapshot.input!==input||!Array.isArray(snapshot.factors)||snapshot.factors.length>1023)throw Error('Snapshot shape');
   const proofStart=clock(),proofDeadline=Math.min(deadline,proofStart+25);
   let ticks=0;
   const budget={tick(){
    const t=clock();if(t>=deadline)throw new ExtendedBudgetStop('time-budget');
    if(++ticks>100000)throw new ExtendedBudgetStop('verification-work-budget');
    if(t>=proofDeadline)throw new ExtendedBudgetStop('verification-time-budget');
   }};
   const groups=[],claims=new Map();
   for(const factor of snapshot.factors){
    budget.tick();
    if(!factor||typeof factor.value!=='string'||factor.value.length>309||!/^[1-9][0-9]*$/.test(factor.value))throw Error('Factor encoding');
    const previous=groups.at(-1);
    if(previous?.value===factor.value)previous.exponent++;else groups.push({value:factor.value,exponent:1});
    const priorClaim=claims.get(factor.value);
    if(priorClaim&&(priorClaim.certainty!==factor.certainty||priorClaim.method!==factor.method))throw Error('Conflicting certainty');
    claims.set(factor.value,{certainty:factor.certainty,method:factor.method});
   }
   let checked;
   try{checked=inspectExtendedDecomposition(input,{factors:groups,remaining:snapshot.remaining},{now:clock,budgetMs:Math.max(1,Math.min(25,Math.ceil(proofDeadline-clock())))});}
   catch(error){
    if(error.code==='VALIDATION_TIME_BUDGET')throw new ExtendedBudgetStop(clock()>=deadline?'time-budget':'verification-time-budget');
    throw error;
   }
   for(const group of groups){
    budget.tick();const value=BigInt(group.value),claim=claims.get(group.value);
    let certainty;
    if(SMALL_PRIMES.includes(value))certainty='proven';
    else{
     if(SMALL_PRIMES.some(p=>{budget.tick();return value%p===0n;}))throw Error('Composite claim');
     certainty=assessPrime(value,budget);
    }
    if(certainty!==claim.certainty||certainty==='composite')throw Error('Prime certainty');
   }
   budget.tick();const result=final?verifyFactorResult(snapshot,input):verifySnapshot(snapshot,input);budget.tick();
   if(final&&(result.algorithm!=='brent'||result.seed!==1))throw Error('Result identity');
   if(result.operations<accepted.operations||result.operations>operationBudget)throw Error('Work counter');
   const currentCounts=new Map(groups.map(g=>[g.value,g.exponent]));
   for(const previous of inspection?.factors??[]){
    budget.tick();if((currentCounts.get(previous.value)??0)<previous.exponent)throw Error('Accepted prefix rollback');
   }
   budget.tick();return{result,checked};
  }
  try{
   signal?.addEventListener('abort',cancel,{once:true});
   timer=setTimeout(()=>finish('incomplete',ready?'time-budget':'initialization-timeout'),timeBudgetMs);
   notify('preparing');if(signal?.aborted){cancel();return;}
   factoryAttempted=true;constructing=true;
   try{worker=createWorker();}finally{constructing=false;}
   if(cancelQueued||signal?.aborted){cancel();return;}
   worker.onerror=event=>{event.preventDefault?.();finish('error','worker-error');};
   worker.onmessageerror=()=>finish('error','message-error');
   worker.onmessage=({data})=>{
    if(done)return;
    try{
     if(clock()>=deadline){finish('incomplete',ready?'time-budget':'initialization-timeout');return;}
     if(data?.protocolVersion!==1)throw Error('Protocol');
     if(data.type==='audit-csp'){finish('error','worker-csp-violation');return;}
     if(data.type==='ready'){
      if(ready)throw Error('Duplicate ready');ready=true;
      if(!release()){finish('blocked','worker-retirement');return;}
      notify('computing');if(done)return;
      const remaining=Math.floor(deadline-clock());if(remaining<1){finish('incomplete','time-budget');return;}
      worker.postMessage({protocolVersion:1,type:'run',jobId:1,input,options:{algorithm:'brent',seed:1,timeBudgetMs:remaining,operationBudget}});return;
     }
     if(!ready||data.jobId!==1)throw Error('Job identity');
     if(data.type==='error'){finish('error','computation-error');return;}
     if(!['progress','result'].includes(data.type))throw Error('Message');
     if(data.type==='result'){notify('verifying');if(done)return;}
     const candidate=data.type==='result'?data.result:data.snapshot;
     const checked=checkSnapshot(candidate,data.type==='result');
     if(data.type==='progress'){accepted=checked.result;inspection=checked.checked;reportAccepted();if(done)return;notify('computing');return;}
     const result=checked.result;
     if(clock()>=deadline){finish('incomplete','time-budget');return;}
     accepted={...checked.result,primality:result.primality};inspection=checked.checked;reportAccepted();if(done)return;finish(result.status,result.reason);
    }catch(error){finish(error instanceof ExtendedBudgetStop?'incomplete':'error',error instanceof ExtendedBudgetStop?error.reason:'verification-failed');}
   };
  }catch{finish('error','worker-create-error');}
 });
}
