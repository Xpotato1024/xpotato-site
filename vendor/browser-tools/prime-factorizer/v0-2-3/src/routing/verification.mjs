// SPDX-License-Identifier: AGPL-3.0-only
import {inspectExtendedDecomposition} from '../core/extended-input-contract.mjs';
import {assessPrime} from '../engine/arithmetic.mjs';
import {SMALL_PRIMES} from '../engine/options.mjs';
import {isRoutingOutcome,createRoutingSession,RoutingStop} from './session.mjs';
const verified=new WeakSet(),presentable=new WeakSet(),contexts=new WeakMap();
export const isRoutingPresentationResult=(result,input)=>presentable.has(result)&&result.input===input;
export const isVerifiedRoutingResult=(result,input)=>verified.has(result)&&result.input===input;

export function createRoutingTargetSelector({input,deadline,now,signal}){
 const context={input,deadline,operations:0,cache:new Map(SMALL_PRIMES.map(p=>[p.toString(),'proven']))};
 const select=(state,{skipValues=new Set()}={})=>{
  const started=now(),limit=Math.min(deadline,started+25);
  const budget={tick(){if(signal.aborted)throw new RoutingStop('cancelled');const t=now();if(t>=limit)throw new RoutingStop('proof-time-budget');if(context.operations>=100000)throw new RoutingStop('proof-operation-budget');context.operations++;}};
  const candidates=state.factors.map(f=>({kind:'factor',...f}));
  if(state.remaining!=='1')candidates.push({kind:'remaining',value:state.remaining,exponent:1});
  candidates.sort((a,b)=>BigInt(a.value)<BigInt(b.value)?-1:1);
  for(const target of candidates){
   if(skipValues.has(target.value))continue;
   budget.tick();let certainty=context.cache.get(target.value);
   if(!certainty){
    const n=BigInt(target.value);
    for(const p of SMALL_PRIMES){budget.tick();if(n%p===0n){certainty='composite';break;}}
    certainty??=assessPrime(n,budget);budget.tick();
    if(context.cache.size>=4096)throw new RoutingStop('proof-operation-budget');
    context.cache.set(target.value,certainty);
   }
   if(certainty==='composite')return Object.freeze(target);
  }
  return null;
 };
 select.bindOutcome=outcome=>{if(isRoutingOutcome(outcome,input))contexts.set(outcome,context);};
 return select;
}
export const createVerifiedRoutingSession=options=>createRoutingSession({...options,createTargetSelector:createRoutingTargetSelector});

export function verifyRoutingResult(raw,{now=()=>performance.now(),signal,maxMs=25,maxOperations=100000}={}){
 if(!isRoutingOutcome(raw,raw?.input))throw Error('Routing result provenance');
 if(!Number.isSafeInteger(maxMs)||maxMs<1||maxMs>100||!Number.isSafeInteger(maxOperations)||maxOperations<1||maxOperations>100000)throw Error('Routing proof limits');
 const stop=(reason)=>{const result=Object.freeze({...raw,executionStatus:raw.status,executionReason:raw.reason,verificationReason:reason,status:raw.status==='blocked'?'blocked':raw.status==='cancelled'||reason==='cancelled'?'cancelled':'incomplete',reason,certaintyVerified:false,allFactorsProven:false,primalityVerified:false,factorizationComplete:false,decompositionComplete:false,verifiedFactors:Object.freeze([]),pendingGroups:Object.freeze([...raw.snapshot.factors,...(raw.snapshot.remaining!=='0'&&raw.snapshot.remaining!=='1'?[Object.freeze({value:raw.snapshot.remaining,exponent:1,certainty:'unknown'})]:[])])});presentable.add(result);return result;};
 if(raw.status==='blocked'||!raw.allStagesDisposed)return stop(raw.reason??'worker-retirement');
 if(signal?.aborted||raw.status==='cancelled')return stop('cancelled');
 const started=now();if(!Number.isFinite(started)||started<0)throw Error('Proof clock');
 const context=contexts.get(raw),deadline=Math.min(raw.deadline,started+maxMs);let last=started,operations=context?.operations??0;
 const clock=()=>{const t=now();if(!Number.isFinite(t)||t<last)throw Error('proof-clock');last=t;if(signal?.aborted)throw Error('cancelled');if(t>=deadline)throw Error('proof-time-budget');return t;};
 const budget={tick(){clock();if(operations>=maxOperations)throw Error('proof-operation-budget');operations++;if(context)context.operations=operations;}};
 try{
  const checked=inspectExtendedDecomposition(raw.input,raw.snapshot,{now:clock,budgetMs:maxMs}),n=BigInt(raw.input);
  if(n<2n){const result=Object.freeze({...raw,status:'neither',reason:null,executionStatus:raw.status,executionReason:raw.reason,certaintyVerified:true,allFactorsProven:false,primalityVerified:false,factorizationComplete:false,decompositionComplete:false,verifiedFactors:Object.freeze([]),pendingGroups:Object.freeze([]),proofOperations:operations});verified.add(result);presentable.add(result);return result;}
  const terms=[...checked.factors];if(checked.remaining!=='1')terms.push({value:checked.remaining,exponent:1});
  const groups=new Map();for(const f of terms)groups.set(f.value,(groups.get(f.value)??0)+f.exponent);
  const prime=[],pending=[];
  for(const[value,exponent]of groups){
   budget.tick();const d=BigInt(value);let certainty=context?.cache.get(value)??null;
   for(const p of certainty?[]:SMALL_PRIMES){budget.tick();if(d===p){certainty='proven';break;}if(d%p===0n){certainty='composite';break;}}
   certainty??=assessPrime(d,budget);budget.tick();
   (certainty==='composite'?pending:prime).push(Object.freeze({value,exponent,certainty}));
  }
  prime.sort((a,b)=>BigInt(a.value)<BigInt(b.value)?-1:1);pending.sort((a,b)=>BigInt(a.value)<BigInt(b.value)?-1:1);clock();
  const complete=!pending.length,allProven=complete&&prime.every(f=>f.certainty==='proven');
  const result=Object.freeze({...raw,status:allProven?'complete':complete?'probable':'incomplete',reason:complete?null:raw.reason,
   executionStatus:raw.status,executionReason:raw.reason,certaintyVerified:true,allFactorsProven:allProven,primalityVerified:allProven,factorizationComplete:allProven,decompositionComplete:complete,
   verifiedFactors:Object.freeze(prime),pendingGroups:Object.freeze(pending),proofOperations:operations,proofElapsedMs:last-started});
  verified.add(result);presentable.add(result);return result;
 }catch(error){return stop(['proof-time-budget','proof-operation-budget','cancelled','proof-clock'].includes(error.message)?error.message:error.code==='VALIDATION_TIME_BUDGET'?'proof-time-budget':'verification-failed');}
}
