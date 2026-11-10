// SPDX-License-Identifier: AGPL-3.0-only
// Split-only ECM port: no primality claim or arithmetic.js import.
import {makeWorkerFromSource} from '../worker/source-factory.mjs';
import {ECM_WORKER_SOURCE} from './ecm-source.mjs';
import {RoutingStop} from './session.mjs';
export function createEcmPort({createWorker=()=>makeWorkerFromSource(ECM_WORKER_SOURCE),now=()=>performance.now()}={}){
 return Object.freeze({start(request,{signal,onSnapshot=()=>{}}={}){
  const n=typeof request.input==='string'&&request.input.length<=78&&/^[1-9][0-9]*$/.test(request.input)?BigInt(request.input):0n;
  if(request.stage!=='ecm'||request.workKey!=='ecm'||n<5n||n>=(1n<<256n)||n%2n===0n||!Number.isSafeInteger(request.jobId)||request.jobId<1||!Number.isSafeInteger(request.workBudget)||request.workBudget<1||request.workBudget>50000000||!Number.isSafeInteger(request.timeBudgetMs)||request.timeBudgetMs<1||request.timeBudgetMs>60000||!Number.isFinite(request.deadline)||!Number.isSafeInteger(request.jobWasmBudgetMiB)||request.jobWasmBudgetMiB<64||request.jobWasmBudgetMiB>1536)throw Error('ECM routing request');
  let worker=null,done=false,factoryAttempted=false,retired=false,sourceReleased=false,timer,operations=0,resolveResult,rejectResult,constructing=false,cancelQueued=false,posted=false,workKnown=false,lastClock=null;
  let snapshot={factors:[],remaining:request.input},flags=null;
  const result=new Promise((resolve,reject)=>{resolveResult=resolve;rejectResult=reject;});result.catch(()=>{});
  const clock=()=>{const t=now();if(!Number.isFinite(t)||t<0||lastClock!==null&&t<lastClock)throw Error('ECM clock');lastClock=t;return t;};
  const packet=()=>Object.freeze({version:1,jobId:request.jobId,stage:'ecm',input:request.input,seq:1,work:operations,snapshot,reportedPrimality:'unknown'});
  const finish=reason=>{
   if(done)return;done=true;clearTimeout(timer);try{signal?.removeEventListener('abort',cancel);}catch{}
   if(worker){
    try{worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;}catch{}
    try{worker.releaseSource();sourceReleased=true;}catch{}
    try{worker.terminate();retired=true;}catch{}
   }else{retired=!factoryAttempted;sourceReleased=!factoryAttempted;}
   flags=Object.freeze({allWorkersDisposed:retired,allWorkerSourcesReleased:sourceReleased});
   if(workKnown||!posted)resolveResult(Object.freeze({reason,packet:packet()}));
   else rejectResult(new RoutingStop(reason));
  };
  const cancel=()=>{if(constructing){cancelQueued=true;return;}finish('cancelled');};
  const lease=Object.freeze({result,dispose(){finish(signal?.aborted?'cancelled':'worker-error');return flags;}});
  if(signal?.aborted){finish('cancelled');return lease;}
  let remaining;try{remaining=Math.min(request.timeBudgetMs,Math.floor(request.deadline-clock()));}catch{finish('invalid-result');return lease;}
  if(remaining<1){finish('phase-time-budget');return lease;}
  try{signal?.addEventListener('abort',cancel,{once:true});}catch{finish('worker-error');return lease;}
  timer=setTimeout(()=>finish('phase-time-budget'),remaining);
  try{
   factoryAttempted=true;constructing=true;try{worker=createWorker();}finally{constructing=false;}
   if(cancelQueued||signal?.aborted){finish('cancelled');return lease;}
   worker.onmessage=({data:d})=>{
    if(done||d?.jobId!==request.jobId)return;
    try{
     if(clock()>=request.deadline){finish('phase-time-budget');return;}
     if(d.version!==1||d.input!==request.input)throw Error('ECM identity');
     if(d.type==='ready'){if(d.wasmBytes!==67108864)throw Error('ECM memory');return;}
     if(d.type!=='result'||!['exhausted','phase-time-budget','operation-budget','worker-error'].includes(d.reason)||!Number.isSafeInteger(d.operations)||d.operations<0||d.operations>request.workBudget)throw Error('ECM result');
     operations=d.operations;
     if(d.divisor!==null){
      if(d.reason!=='exhausted'||d.wasmBytes!==67108864||typeof d.divisor!=='string'||d.divisor.length>78||!/^[1-9][0-9]*$/.test(d.divisor))throw Error('ECM divisor encoding');
      const divisor=BigInt(d.divisor);if(divisor<=1n||divisor>=n||n%divisor!==0n)throw Error('ECM proper divisor');
      snapshot=Object.freeze({factors:Object.freeze([Object.freeze({value:d.divisor,exponent:1})]),remaining:(n/divisor).toString()});
     }
     workKnown=true;onSnapshot(packet());finish(d.reason);
    }catch{finish('invalid-result');}
   };
   worker.onerror=()=>finish('worker-error');worker.onmessageerror=()=>finish('worker-error');
   const timeBudgetMs=Math.min(remaining,Math.floor(request.deadline-clock()));
   if(timeBudgetMs<1){finish('phase-time-budget');return lease;}
   posted=true;worker.postMessage({version:1,type:'start',jobId:request.jobId,input:request.input,timeBudgetMs,operationBudget:request.workBudget});
  }catch{finish('worker-error');}
  return lease;
 }});
}
