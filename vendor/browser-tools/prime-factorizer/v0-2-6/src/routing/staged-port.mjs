// SPDX-License-Identifier: AGPL-3.0-only
import {runSelectedStagedRequest} from '../worker/staged-selected.mjs';
import {makeStagedWorker} from '../worker/staged-factory.mjs';
import {selectValidatedStagedPlan} from '../engine/staged-selected.mjs';
import {RoutingStop} from './session.mjs';
export function createStagedPort({run=runSelectedStagedRequest,createWorker=makeStagedWorker,now=()=>performance.now()}={}){
 return Object.freeze({start(request,{signal,onSnapshot=()=>{}}={}){
  if(!Number.isSafeInteger(request.jobId)||request.jobId<1||!Number.isFinite(request.deadline)||request.stage!=='staged128'||request.workKey!=='staged'||!Number.isSafeInteger(request.timeBudgetMs)||request.timeBudgetMs<1||request.timeBudgetMs>60000||!Number.isSafeInteger(request.workBudget)||request.workBudget<1||request.workBudget>50000000)throw Error('Staged routing request');
  const plan=selectValidatedStagedPlan(request.input,{seed:1,timeBudgetMs:request.timeBudgetMs,operationBudget:request.workBudget});
  if(!Number.isSafeInteger(request.jobWasmBudgetMiB)||request.jobWasmBudgetMiB<0||request.jobWasmBudgetMiB>1536||plan.linearMemoryBytes>request.jobWasmBudgetMiB*1048576)throw Error('Staged memory');
  const control=new AbortController(),owners=[];let raw=null,seq=0,work=0,bad=false,constructionFailed=false;
  const cancel=()=>control.abort();signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
  const makePacket=r=>{
   if(r.input!==request.input||!Number.isSafeInteger(r.operations)||r.operations<work||r.operations>request.workBudget)throw Error('Staged result work');
   work=r.operations;const counts=new Map();for(const f of r.factors)counts.set(f.value,(counts.get(f.value)??0)+1);
   let factors=[...counts].sort(([a],[b])=>BigInt(a)<BigInt(b)?-1:1).map(([value,exponent])=>Object.freeze({value,exponent})),remaining=r.remaining,reportedPrimality='unknown';
   if(factors.length===1&&factors[0].value===request.input&&factors[0].exponent===1&&remaining==='1'){factors=[];remaining=request.input;reportedPrimality=r.factors[0].certainty;}
   return Object.freeze({version:1,jobId:request.jobId,stage:'staged128',input:request.input,seq:++seq,work,snapshot:Object.freeze({factors:Object.freeze(factors),remaining}),reportedPrimality});
  };
  const probe=plan=>{
   let worker;try{worker=createWorker(plan);}catch(error){constructionFailed=true;throw error;}const owner={worker,terminated:false,released:false,termTried:false,releaseTried:false};owners.push(owner);
   const terminate=worker.terminate.bind(worker),release=worker.releaseSource?.bind(worker);
   worker.terminate=()=>{if(owner.termTried){if(!owner.terminated)throw Error('Staged retirement failed');return;}owner.termTried=true;terminate();owner.terminated=true;};
   worker.releaseSource=()=>{if(owner.releaseTried){if(!owner.released)throw Error('Staged source release failed');return;}owner.releaseTried=true;if(!release)throw Error('Staged source owner missing');release();owner.released=true;};
   if(control.signal.aborted){try{worker.releaseSource();}catch{}try{worker.terminate();}catch{}}
   return worker;
  };
  const promise=Promise.resolve().then(async()=>{
   const ms=Math.min(request.timeBudgetMs,Math.floor(request.deadline-now()));if(ms<1)throw new RoutingStop('phase-time-budget');
   raw=await run(request.input,{seed:1,timeBudgetMs:ms,operationBudget:request.workBudget},{signal:control.signal,now,createWorker:probe,onProgress:r=>{
    try{onSnapshot(makePacket(r));}catch{bad=true;control.abort();}
   }});
   if(bad)throw new RoutingStop('invalid-result');
   if(raw.status==='cancelled')throw new RoutingStop('cancelled');
   if(raw.origin==='host')throw new RoutingStop(raw.reason==='operation-budget'?'operation-budget':'phase-time-budget');
   if(raw.policy!=='p64'||raw.seed!==1||raw.origin!=='worker')throw new RoutingStop('invalid-result');
   if(!['complete','probable','neither','incomplete'].includes(raw.status))throw new RoutingStop('invalid-result');
   const map={null:'exhausted','operation-budget':'operation-budget','time-budget':'phase-time-budget','algorithm-exhausted':'exhausted','algorithm-resource':'algorithm-resource','algorithm-range':'algorithm-resource'};
   if(!Object.hasOwn(map,String(raw.reason)))throw new RoutingStop('invalid-result');
   const packet=makePacket(raw);onSnapshot(packet);return Object.freeze({reason:map[String(raw.reason)],packet});
  }).catch(error=>{if(error instanceof RoutingStop)throw error;throw new RoutingStop(error?.message==='initialization-timeout'?'phase-time-budget':'worker-error');})
   .finally(()=>{try{signal?.removeEventListener('abort',cancel);}catch{}});
  promise.catch(()=>{});
  return Object.freeze({result:promise,async dispose(){
   control.abort();try{await promise;}catch{}
   for(const o of owners){try{o.worker.releaseSource();}catch{}try{o.worker.terminate();}catch{}}
   return Object.freeze({allWorkersDisposed:!constructionFailed&&owners.every(o=>o.terminated),allWorkerSourcesReleased:!constructionFailed&&owners.every(o=>o.released)});
  }});
 }});
}
