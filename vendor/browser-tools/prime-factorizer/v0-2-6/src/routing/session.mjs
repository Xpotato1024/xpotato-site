// SPDX-License-Identifier: AGPL-3.0-only
// Engine-free orchestration. Real ports and bounded prime classification are separate modules.
import {inspectExtendedInput,inspectExtendedDecomposition} from '../core/extended-input-contract.mjs';
import {makeComputeScope} from '../site/document-scope.mjs';
import {makeRoutingPolicy,chooseStage,ENGINE_CAPABILITIES} from './plan.mjs';
export class RoutingStop extends Error{constructor(reason){super(reason);this.reason=reason;}}
function inspectSnapshot(input,snapshot,options){
 try{return inspectExtendedDecomposition(input,snapshot,options);}
 catch(error){if(error.code==='VALIDATION_TIME_BUDGET')throw new RoutingStop('proof-time-budget');if(error.code==='VALIDATION_CLOCK')throw new RoutingStop('invalid-clock');throw error;}
}
const outcomes=new WeakSet();
export const isRoutingOutcome=(result,input)=>outcomes.has(result)&&result.input===input;
const reasons=new Set(['algorithm-resource','exhausted','phase-time-budget','operation-budget','memory-budget','worker-error','cancelled']);
const snapshotKey=s=>JSON.stringify({factors:s.factors,remaining:s.remaining});
function joinFactors(base,next){
 const counts=new Map();
 for(const f of [...base,...next])counts.set(f.value,(counts.get(f.value)??0)+f.exponent);
 return [...counts].sort(([a],[b])=>BigInt(a)<BigInt(b)?-1:1).map(([value,exponent])=>({value,exponent}));
}
function dataRecord(value,keys){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Routing record');
 const descriptors=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(descriptors).length!==keys.length||keys.some(k=>!Object.hasOwn(descriptors,k)||!Object.hasOwn(descriptors[k],'value')))throw Error('Routing record shape');
 return Object.freeze(Object.fromEntries(keys.map(k=>[k,descriptors[k].value])));
}
function retirementOkay(r){return r?.allWorkersDisposed===true&&r?.allWorkerSourcesReleased===true;}
export function createRoutingSession({ports={},scope=makeComputeScope(),now=()=>performance.now(),createTargetSelector=null}={}){
 if(createTargetSelector!==null&&typeof createTargetSelector!=='function')throw TypeError('Routing target selector');
 if(typeof now!=='function')throw TypeError('Routing clock');
 if(!ports||Object.keys(ports).some(k=>!Object.hasOwn(ENGINE_CAPABILITIES,k)||typeof ports[k]?.start!=='function'))throw TypeError('Routing ports');
 const registry=Object.freeze(Object.fromEntries(Object.entries(ports).map(([key,port])=>[key,Object.freeze({start:port.start.bind(port)})])));
 let active=null,nextJob=0;
 const run=async(raw,options={})=>{
  const {signal,onChange=()=>{},...settings}=options,policy=makeRoutingPolicy(settings),input=inspectExtendedInput(raw).canonical;
  if(typeof onChange!=='function'||signal&&(typeof signal.aborted!=='boolean'||typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'))throw TypeError('Routing observer/signal');
  const token={};if(active||!scope.acquire(token)){
   const blocked=Object.freeze({status:'blocked',reason:scope.isQuarantined()?'scope-quarantined':'scope-busy',input,snapshot:Object.freeze({factors:Object.freeze([]),remaining:input}),factorizationComplete:false,primalityVerified:false,allStagesDisposed:false,trace:Object.freeze([]),workRemaining:policy.work,deadline:null,elapsedMs:0});
   outcomes.add(blocked);return blocked;
  }
  let start;try{start=now();}catch(error){scope.release(token);throw error;}let last=start;
  const clock=()=>{const t=now();if(!Number.isFinite(t)||t<last)throw new RoutingStop('invalid-clock');last=t;return t;};
  if(!Number.isFinite(start)||start<0){scope.release(token);throw Error('Routing clock');}
  const deadline=start+policy.jobTimeMs,control=new AbortController();active=control;
  const cancel=()=>control.abort();
  try{signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();}
  catch(error){try{signal?.removeEventListener('abort',cancel);}catch{}active=null;scope.release(token);throw error;}
  let state;try{state=inspectSnapshot(input,{factors:[],remaining:input},{now:clock});}catch(error){try{signal?.removeEventListener('abort',cancel);}catch{}active=null;scope.release(token);throw error;}
  let status='incomplete',reason=null,reportedPrimality='unknown',stages=0;
  const attempted=[],trace=[],work={...policy.work};let blocked=false,selectTarget=null,decompositions=new Map();const skippedTargets=new Set();let targetStop=null;
  const emit=event=>{try{onChange(Object.freeze({...event,input,remaining:state.remaining,factors:state.factors,primalityVerified:false,factorizationComplete:false}));}catch{}};
  try{
   if(BigInt(input)<2n){status='neither';return finish();}
   if(createTargetSelector){selectTarget=createTargetSelector({input,deadline,now:clock,signal:control.signal});if(typeof selectTarget!=='function')throw Error('Target selector');}
   while(stages<policy.maxStages){
    if(control.signal.aborted){status='cancelled';reason='cancelled';break;}
    const left=deadline-clock();if(left<=0){reason='job-time-budget';break;}
    let target=selectTarget?selectTarget(state,{skipValues:skippedTargets}):Object.freeze({kind:'remaining',value:state.remaining,exponent:1});
    if(target===null){status=skippedTargets.size?'incomplete':'factor-proof-required';reason=skippedTargets.size?targetStop:'factor-proof-required';break;}
    if(!target||skippedTargets.has(target.value)||!['remaining','factor'].includes(target.kind)||typeof target.value!=='string'||!Number.isSafeInteger(target.exponent)||target.exponent<1||target.kind==='remaining'&&(target.value!==state.remaining||target.exponent!==1)||target.kind==='factor'&&!state.factors.some(f=>f.value===target.value&&f.exponent===target.exponent))throw Error('Invalid residual target');
    target=Object.freeze({...target});
    const afterSelection=deadline-clock();if(afterSelection<1){reason='job-time-budget';break;}
    const plan=chooseStage({remaining:target.value,available:Object.keys(registry),attempted,policy,remainingMs:afterSelection,work});
    if(plan.terminal){const lastStop=trace.at(-1)?.stop;const terminal=plan.terminal==='enabled-engines-exhausted'&&['phase-time-budget','operation-budget'].includes(lastStop)?lastStop:plan.terminal;if(selectTarget){skippedTargets.add(target.value);targetStop=terminal;continue;}reason=terminal;status=reason==='factor-proof-required'?'factor-proof-required':'incomplete';break;}
    const jobId=++nextJob,request=Object.freeze({...plan,jobId,deadline:Math.min(deadline,clock()+plan.timeBudgetMs)});
    const base=state,stageInput=target.value,stageControl=new AbortController();let lease=null,live=true,seq=0,accepted=null,spent=0,acceptedPrimality='unknown',packetError=null,failSnapshot;
    const closeStage=()=>{live=false;stageControl.abort();};
    const checkDeadline=()=>{const t=clock();if(t>=deadline)throw new RoutingStop('job-time-budget');if(t>=request.deadline)throw new RoutingStop('phase-time-budget');};
    const proofClock=()=>{checkDeadline();return last;};
    const accept=(packet,final=false)=>{
     if(!live||control.signal.aborted)return false;
     checkDeadline();
     const keys=['version','jobId','stage','input','seq','work','snapshot','reportedPrimality'];
     packet=dataRecord(packet,keys);
     if(packet.version!==1||packet.jobId!==jobId||packet.stage!==plan.stage||packet.input!==stageInput)return false;
     if(!Number.isSafeInteger(packet.seq)||packet.seq<1||packet.seq>1000000||!Number.isSafeInteger(packet.work)||packet.work<spent||packet.work>plan.workBudget||!['unknown','probable','proven'].includes(packet.reportedPrimality))throw Error('Routing packet identity/work');
     const checked=inspectSnapshot(stageInput,packet.snapshot,{now:proofClock});
     if(checked.factors.some(f=>BigInt(f.value)>=BigInt(stageInput)))throw Error('Whole input is not a proper split');
     if(packet.reportedPrimality!=='unknown'&&(checked.factors.length||checked.remaining!==stageInput))throw Error('Primality claim must preserve unsplit residual');
     if(final&&packet.seq<seq)throw Error('Stale final result');
     if(packet.seq<=seq){
      if(packet.seq===seq&&(snapshotKey(checked)!==snapshotKey(accepted)||packet.work!==spent||packet.reportedPrimality!==acceptedPrimality))throw Error('Duplicate packet changed');
      return true;
     }
     if(accepted&&accepted.factors.some(f=>(checked.factors.find(g=>g.value===f.value)?.exponent??0)<f.exponent))throw Error('Accepted prefix rollback');
     const inherited=target.kind==='factor'?base.factors.filter(f=>f.value!==target.value):base.factors;
     const pieces=checked.factors.map(f=>({value:f.value,exponent:f.exponent*target.exponent}));
     if(target.kind==='factor'&&checked.remaining!=='1')pieces.push({value:checked.remaining,exponent:target.exponent});
     let mergedFactors=joinFactors(inherited,pieces),mergedRemaining=target.kind==='factor'?base.remaining:checked.remaining;
     let memo=decompositions;
     if(selectTarget&&checked.factors.length){
      memo=new Map(decompositions);memo.set(stageInput,checked);
      let expansions=0;
      const expand=terms=>{
       const queue=[...terms],out=[];
       while(queue.length){
        proofClock();if(++expansions>4096)throw new RoutingStop('proof-operation-budget');
        const term=queue.pop(),known=memo.get(term.value);
        if(!known){out.push(term);continue;}
        for(const f of known.factors)queue.push({value:f.value,exponent:f.exponent*term.exponent});
        if(known.remaining!=='1')queue.push({value:known.remaining,exponent:term.exponent});
       }
       return joinFactors([],out);
      };
      mergedFactors=expand(mergedFactors);
      if(memo.has(mergedRemaining)){mergedFactors=joinFactors(mergedFactors,expand([{value:mergedRemaining,exponent:1}]));mergedRemaining='1';}
     }
     const merged=inspectSnapshot(input,{factors:mergedFactors,remaining:mergedRemaining},{now:proofClock});
     checkDeadline();
     accepted=checked;seq=packet.seq;spent=packet.work;state=merged;decompositions=memo;reportedPrimality=packet.reportedPrimality;acceptedPrimality=reportedPrimality;
     emit({stage:plan.stage,phase:'accepted-prefix',jobId,workObserved:spent,progressFraction:null});return true;
    };
    const onSnapshot=packet=>{try{accept(packet);}catch(e){if(!(e instanceof RoutingStop))packetError=e;closeStage();failSnapshot?.({stop:e instanceof RoutingStop?e.reason:'invalid-result'});}};
    let timeout,abortListener,outcome=null,stop=null,startAttempted=false,finalValidated=false;
    try{
     emit({stage:plan.stage,phase:'starting',jobId,workerLimit:plan.maxWorkers,wasmAllocationBytes:plan.wasmAllocationBytes,progressFraction:null});
     if(control.signal.aborted){stop='cancelled';throw new Error('Cancelled before start');}
     checkDeadline();
     const stopped=new Promise(resolve=>{
      timeout=setTimeout(()=>{closeStage();resolve({stop:'phase-time-budget'});},Math.max(1,request.deadline-clock()));
      abortListener=()=>{closeStage();resolve({stop:'cancelled'});};control.signal.addEventListener('abort',abortListener,{once:true});
     });
     const snapshotFailed=new Promise(resolve=>{failSnapshot=resolve;});
     startAttempted=true;lease=registry[plan.stage].start(request,{signal:stageControl.signal,onSnapshot,scope,scopeToken:token,onProgress:data=>{if(!plan.stage.startsWith('siqs')||!live||control.signal.aborted)return;try{checkDeadline();if(!data||![data.families,data.relations,data.target].every(x=>Number.isSafeInteger(x)&&x>=0&&x<=1000000)||data.families>plan.workBudget||data.target<1)return;emit({stage:plan.stage,phase:'collecting',jobId,families:data.families,relations:data.relations,target:data.target,progressFraction:null});}catch{}}});
     if(!lease||typeof lease.dispose!=='function'||!lease.result||typeof lease.result.then!=='function')throw Error('Routing port lease');
     const result=Promise.resolve(lease.result).then(value=>({value}),error=>({stop:error instanceof RoutingStop&&['cancelled','phase-time-budget','job-time-budget','operation-budget','proof-time-budget','proof-operation-budget','algorithm-resource','memory-budget','invalid-result','worker-error'].includes(error.reason)?error.reason:'worker-error'}));
     const raced=await Promise.race([result,stopped,snapshotFailed]);
     outcome=raced.value;stop=raced.stop;
     if(!stop){
      if(control.signal.aborted)stop='cancelled';
      else if(clock()>=request.deadline)stop='phase-time-budget';
      else{
       outcome=dataRecord(outcome,['reason','packet']);
       if(!reasons.has(outcome.reason))throw Error('Routing outcome reason');
       if(!accept(outcome.packet,true))throw Error('Final result identity/deadline');finalValidated=true;stop=outcome.reason;
      }
     }
    }catch(error){stop=control.signal.aborted?'cancelled':error instanceof RoutingStop?error.reason:stop??'invalid-result';}
    finally{
     clearTimeout(timeout);control.signal.removeEventListener('abort',abortListener);closeStage();
     let cleanupTimer;
     try{
      const retired=await Promise.race([Promise.resolve().then(()=>startAttempted?lease?.dispose():{allWorkersDisposed:true,allWorkerSourcesReleased:true}),new Promise(resolve=>{cleanupTimer=setTimeout(()=>resolve(null),policy.retirementGraceMs);})]);
      if(!retirementOkay(retired)){blocked=true;scope.quarantine();}
     }catch{blocked=true;scope.quarantine();}
     finally{clearTimeout(cleanupTimer);}
    }
    stages++;const charged=!startAttempted?0:finalValidated&&!packetError?spent:plan.workBudget;work[plan.workKey]-=charged;
    attempted.push(plan.stage+':'+stageInput);
    // A staged macro already exercised its Brent/ECM prefixes on this exact value.
    if(plan.stage==='staged128')attempted.push('native:'+stageInput,'ecm:'+stageInput);
    trace.push(Object.freeze({jobId,stage:plan.stage,input:stageInput,targetKind:target.kind,targetMultiplicity:target.exponent,remaining:state.remaining,deadline:request.deadline,timeBudgetMs:plan.timeBudgetMs,workKey:plan.workKey,workChargedUpperBound:charged,workObserved:accepted?spent:null,stop:packetError?'invalid-result':stop,disposed:!blocked}));
    emit({stage:plan.stage,phase:'retired',jobId,stop,progressFraction:null});
    if(blocked){status='blocked';reason='worker-retirement';break;}
    if(control.signal.aborted||stop==='cancelled'){status='cancelled';reason='cancelled';break;}
    if(packetError){reason='invalid-result';break;}
    if(['invalid-result','worker-error','memory-budget','proof-time-budget','proof-operation-budget','algorithm-resource','job-time-budget','invalid-clock'].includes(stop)){reason=stop;break;}
    if(clock()>=deadline){reason='job-time-budget';break;}
    if(!selectTarget&&reportedPrimality!=='unknown'){status='factor-proof-required';reason='reported-primality-unverified';break;}
   }
   if(!reason){const lastStop=trace.at(-1)?.stop;reason=['phase-time-budget','operation-budget'].includes(lastStop)?lastStop:'stage-count-budget';}
   return finish();
  }catch(error){reason=error instanceof RoutingStop?error.reason:'invalid-clock-or-contract';return finish();}
  finally{try{signal?.removeEventListener('abort',cancel);}catch{}active=null;if(!blocked)scope.release(token);}
  function finish(){
   let elapsedMs=null;try{elapsedMs=Math.max(0,clock()-start);}catch{}
   const outcome=Object.freeze({input,status,reason,snapshot:Object.freeze({factors:state.factors,remaining:state.remaining}),reportedPrimality,primalityVerified:false,factorizationComplete:false,deadline,elapsedMs,clockValid:elapsedMs!==null,workRemaining:Object.freeze({...work}),trace:Object.freeze([...trace]),allStagesDisposed:!blocked});outcomes.add(outcome);try{selectTarget?.bindOutcome?.(outcome);}catch{}return outcome;
  }
 };
 return Object.freeze({run,cancel(){if(!active)return false;active.abort();return true;},isQuarantined:scope.isQuarantined});
}
