// SPDX-License-Identifier: AGPL-3.0-only
import * as native from '../extended/runner.mjs';
import {RoutingStop} from './session.mjs';
const group=factors=>{
 const counts=new Map();for(const f of factors)counts.set(f.value,(counts.get(f.value)??0)+1);
 return [...counts].sort(([a],[b])=>BigInt(a)<BigInt(b)?-1:1).map(([value,exponent])=>Object.freeze({value,exponent}));
};
export function createNativePort({api=native,now=()=>performance.now()}={}){
 return Object.freeze({start(request,{signal,onSnapshot=()=>{},scope,scopeToken}={}){
  if(request.stage!=='native'||request.workKey!=='native'||!scope?.owns(scopeToken)||!Number.isSafeInteger(request.jobId)||request.jobId<1||!Number.isSafeInteger(request.timeBudgetMs)||request.timeBudgetMs<1||request.timeBudgetMs>5000||!Number.isSafeInteger(request.workBudget)||request.workBudget<1||request.workBudget>1000000||!Number.isFinite(request.deadline)||typeof api.runExtendedInput!=='function'||typeof api.isVerifiedExtendedOutcome!=='function'||typeof api.isVerifiedExtendedProgress!=='function')throw Error('Native routing binding');
  const control=new AbortController();let raw=null,acceptedWork=0,finalCertified=false;
  const cancel=()=>control.abort();signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
  const makePacket=r=>{
   if(!Number.isSafeInteger(r.operations)||r.operations<acceptedWork||r.operations>request.workBudget)throw Error('Native work');
   acceptedWork=r.operations;let factors=group(r.factors),remaining=r.remaining,reportedPrimality='unknown';
   if(factors.length===1&&factors[0].value===request.input&&factors[0].exponent===1&&remaining==='1'){
    reportedPrimality=r.factors[0].certainty;factors=[];remaining=request.input;
   }
   return Object.freeze({version:1,jobId:request.jobId,stage:'native',input:request.input,seq:++sequence,work:acceptedWork,snapshot:Object.freeze({factors:Object.freeze(factors),remaining}),reportedPrimality});
  };
  let sequence=0,latest=null,mappingFailed=false;
  const reason=r=>r.status==='cancelled'?'cancelled':['complete','probable','neither'].includes(r.status)?'exhausted':r.reason==='operation-budget'?'operation-budget':['time-budget','initialization-timeout'].includes(r.reason)?'phase-time-budget':['verification-time-budget','proof-time-budget'].includes(r.reason)?'proof-time-budget':['verification-work-budget','proof-operation-budget'].includes(r.reason)?'proof-operation-budget':r.reason?.includes('verification')?'invalid-result':'worker-error';
  const promise=Promise.resolve().then(async()=>{
   const ms=Math.min(request.timeBudgetMs,Math.floor(request.deadline-now()));
   if(ms<1)throw new RoutingStop('phase-time-budget');
   raw=await api.runExtendedInput(request.input,{timeBudgetMs:ms,operationBudget:request.workBudget,signal:control.signal,onAccepted:r=>{
    try{if(!api.isVerifiedExtendedProgress(r,request.input))throw Error('Native progress provenance');latest=makePacket(r);onSnapshot(latest);}
    catch{mappingFailed=true;control.abort();}
   }},{scope,scopeToken,now});
   if(!api.isVerifiedExtendedOutcome(raw,request.input)||mappingFailed)throw new RoutingStop('invalid-result');
   finalCertified=true;
   const mapped=reason(raw);
   if(!['complete','probable','neither'].includes(raw.status)&&!(raw.reason==='operation-budget'&&raw.operations===request.workBudget))throw new RoutingStop(mapped);
   const finalPacket=makePacket(raw);latest=finalPacket;
   return Object.freeze({reason:mapped,packet:finalPacket});
  }).finally(()=>{signal?.removeEventListener('abort',cancel);});
  promise.catch(()=>{});
  return Object.freeze({result:promise,async dispose(){
   control.abort();try{await promise;}catch{}
   return Object.freeze({allWorkersDisposed:finalCertified&&raw?.allWorkersDisposed===true,allWorkerSourcesReleased:finalCertified&&raw?.allWorkerSourcesReleased===true});
  }});
 }});
}
