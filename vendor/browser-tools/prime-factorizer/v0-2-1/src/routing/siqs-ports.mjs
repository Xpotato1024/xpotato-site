// SPDX-License-Identifier: AGPL-3.0-only
import * as normal from '../optimized/index.mjs';
import * as wide from '../selected-wide/index.mjs';
import * as extended from '../siqs400/index.mjs';
import {RoutingStop} from './session.mjs';
const apis=Object.freeze({siqs332:normal,siqsWide332:wide,siqs400:extended});
export function createSiqsPort(stage,{api=apis[stage],now=()=>performance.now()}={}){
 if(!api||!Object.hasOwn(apis,stage))throw Error('SIQS port profile');
 return Object.freeze({start(request,{signal,onSnapshot=()=>{},onProgress=()=>{}}={}){
  if(request.stage!==stage||request.workKey!=='siqs'||!request.resourcePlan||!Number.isSafeInteger(request.workBudget)||request.workBudget<1||request.workBudget>4096)throw Error('SIQS routing request');
  const run=stage==='siqs400'?api.runSiqs400:api.runRusqsieve;
  if(typeof run!=='function')throw Error('SIQS entry');
  const control=new AbortController();let raw=null,seq=0,work=0,latest=null,bad=false;
  const cancel=()=>control.abort();signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
  const packet=snapshot=>Object.freeze({version:1,jobId:request.jobId,stage,input:request.input,seq:++seq,work,snapshot,reportedPrimality:'unknown'});
  const empty=()=>Object.freeze({factors:Object.freeze([]),remaining:request.input});
  const promise=Promise.resolve().then(async()=>{
   if(now()>=request.deadline)throw new RoutingStop('phase-time-budget');
   raw=await run(request.input,{resourcePlan:request.resourcePlan,signal:control.signal,familyLimit:request.workBudget,onProgress:p=>{
    try{
     if(!Number.isSafeInteger(p.families)||p.families<work||p.families>request.workBudget)throw Error('SIQS progress work');
     work=p.families;latest=packet(empty());onSnapshot(latest);
      if([p.relations,p.target].every(x=>Number.isSafeInteger(x)&&x>=0&&x<=1000000)&&p.target>0)onProgress({families:work,relations:p.relations,target:p.target});
    }catch{bad=true;control.abort();}
   }});
   if(bad||raw?.input!==request.input||!Number.isSafeInteger(raw.familiesSubmitted)||raw.familiesSubmitted<work||raw.familiesSubmitted>request.workBudget)throw new RoutingStop('invalid-result');
   if(!['cancelled','timeout','incomplete','partial','factorized','probable'].includes(raw.kind))throw new RoutingStop('invalid-result');
   if(raw.kind==='cancelled'||raw.reason==='cancelled')throw new RoutingStop('cancelled');
   if(['time-budget','initialization-timeout'].includes(raw.reason))throw new RoutingStop('phase-time-budget');
   if(['coordinator-memory-soft-stop','native-memory-budget','wasm-oom'].includes(raw.reason))throw new RoutingStop('memory-budget');
   if(['worker-error','worker-creation','message-error','fatal-unknown'].includes(raw.reason))throw new RoutingStop('worker-error');
   if(['protocol-failure','verification-failed','invalid-dependency'].includes(raw.reason))throw new RoutingStop('invalid-result');
   if(['algorithm-resource','audit-retention-cap'].includes(raw.reason))throw new RoutingStop('algorithm-resource');
   if(['native-unknown','missing-session','worker-retirement'].includes(raw.reason))throw new RoutingStop('worker-error');
   if(![null,'insufficient-relations','no-dependency','no-factor','family-budget','fixed-family-bound','composite-divisor'].includes(raw.reason))throw new RoutingStop('worker-error');
   if(!Number.isSafeInteger(raw.familiesIssued)||raw.familiesIssued!==raw.familiesSubmitted)throw new RoutingStop('worker-error');
   if(['partial','factorized','probable'].includes(raw.kind)&&typeof raw.divisor!=='string')throw new RoutingStop('invalid-result');
   work=raw.familiesSubmitted;let snapshot=empty();
   if(raw.divisor!==null&&raw.divisor!==undefined){
    if(typeof raw.divisor!=='string'||raw.divisor.length>121||!/^[1-9][0-9]*$/.test(raw.divisor))throw new RoutingStop('invalid-result');
    const n=BigInt(request.input),d=BigInt(raw.divisor);if(d<=1n||d>=n||n%d)throw new RoutingStop('invalid-result');
    snapshot=Object.freeze({factors:Object.freeze([Object.freeze({value:d.toString(),exponent:1})]),remaining:(n/d).toString()});
   }
   latest=packet(snapshot);onSnapshot(latest);return Object.freeze({reason:'exhausted',packet:latest});
  }).finally(()=>{signal?.removeEventListener('abort',cancel);});
  promise.catch(()=>{});
  return Object.freeze({result:promise,async dispose(){control.abort();try{await promise;}catch{}return Object.freeze({allWorkersDisposed:raw?.allWorkersDisposed===true,allWorkerSourcesReleased:raw?.allWorkerSourcesReleased===true});}});
 }});
}
