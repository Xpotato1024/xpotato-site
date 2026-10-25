import {selectStagedPlan} from '../engine/staged-plan.mjs';
import {verifyStagedResult,verifyStagedSnapshot} from '../engine/staged-result.mjs';
import {makeStagedWorker} from './staged-factory.mjs';
export async function runStagedRequest(text,options={},{
 createWorker=makeStagedWorker,signal,onProgress=()=>{},now=()=>performance.now(),schedule=setTimeout,unschedule=clearTimeout,verifyResult=verifyStagedResult
}={}) {
 const began=now(),plan=selectStagedPlan(text,options),deadline=began+plan.options.timeBudgetMs;
 let worker=null,closed=false,disposed=true,timer=null,loadTimer=null,initializationMs=null,computeStarted=null,audit=null;
 let snapshot={input:plan.input,factors:[],remaining:plan.input,operations:0,elapsedMs:0};
 const algorithm=plan.mode.startsWith('p')?'staged':plan.mode==='ecm'?'gmp-ecm':plan.mode;
 const metadata=result=>({...result,mode:plan.mode,engineMode:plan.engineMode,requestWallMs:Math.max(0,now()-began),initializationMs,
  computeWallMs:computeStarted===null?null:Math.max(0,now()-computeStarted),workers:worker?1:0,
  linearMemoryBytes:plan.linearMemoryBytes,allWorkersDisposed:disposed,audit});
 const partial=(reason,status='incomplete')=>({...snapshot,status,reason,algorithm,seed:plan.options.seed,policy:plan.mode,
  primality:snapshot.factors.length?'composite':'unknown',origin:'host',traceAvailable:false,stages:null,grants:null});
 if(BigInt(plan.input)<2n){closed=true;return metadata({...partial(null,'neither'),primality:'neither'});}
 return await new Promise((resolve,reject)=>{
  function finish(result,error){
   if(closed)return;closed=true;
   if(timer!==null)unschedule(timer);if(loadTimer!==null)unschedule(loadTimer);signal?.removeEventListener('abort',cancel);
   if(worker){
    worker.onmessage=worker.onerror=worker.onmessageerror=null;
    try{worker.releaseSource?.();}catch{error=Error('Worker disposal failed');}
    try{worker.terminate();disposed=true;}catch{error=Error('Worker disposal failed');}
   }
   if(error){Object.assign(error,{audit,allWorkersDisposed:disposed,requestWallMs:Math.max(0,now()-began)});reject(error);}else resolve(metadata(result));
  }
  const fail=code=>finish(null,Error(code));
  function cancel(){finish(partial('cancelled','cancelled'));}
  const timeout=()=>finish(partial('host-timeout'));
  if(plan.options.operationBudget===0){finish(partial('operation-budget'));return;}
  if(now()>=deadline){timeout();return;}
  timer=schedule(timeout,Math.max(0,deadline-now()));
  if(plan.initializationDeadlineMs<plan.options.timeBudgetMs)loadTimer=schedule(()=>fail('initialization-timeout'),Math.max(0,began+plan.initializationDeadlineMs-now()));
  signal?.addEventListener('abort',cancel,{once:true});
  if(signal?.aborted){cancel();return;}
  let ready=false;
  try{
   worker=createWorker(plan);disposed=false;
   worker.onerror=event=>{event.preventDefault?.();fail('worker-error');};
   worker.onmessageerror=()=>fail('message-error');
   worker.onmessage=({data})=>{
    if(closed)return;
    try{
     if(new TextEncoder().encode(JSON.stringify(data)).length>262144||data?.protocolVersion!==2)throw Error('Worker protocol');
     if(data.type==='audit-csp')throw Error('worker-csp-violation');
     if(data.type==='error'){
      if(ready&&data.jobId!==1)return;audit=data.audit??null;throw Error(data.code??'worker-error');
     }
     if(data.type==='ready'){
      if(ready)return;
      if(data.mode!==plan.mode||data.engineMode!==plan.engineMode||data.linearMemoryBytes!==plan.linearMemoryBytes)throw Error('Worker ready profile');
      ready=true;if(loadTimer!==null){unschedule(loadTimer);loadTimer=null;}worker.releaseSource?.();initializationMs=now()-began;
      if(now()>=deadline){timeout();return;}
      if(now()>=began+plan.initializationDeadlineMs){fail('initialization-timeout');return;}
      const remaining=Math.max(0,Math.floor(deadline-now()-plan.deliveryGraceMs));
      computeStarted=now();
      worker.postMessage({protocolVersion:2,type:'run',jobId:1,input:plan.input,options:{...plan.options,timeBudgetMs:remaining}});
      return;
     }
     if(!ready||data.jobId!==1)return;
     if(now()>=deadline){timeout();return;}
     if(data.type==='progress'){
      const next=verifyStagedSnapshot(data.snapshot,plan.input);
      if(next.operations<snapshot.operations||next.operations>plan.options.operationBudget)throw Error('Progress operations');
      snapshot=next;onProgress(structuredClone(next));return;
     }
     if(data.type!=='result')throw Error('Worker result type');
     const result=verifyResult(data.result,plan.input);
     if(now()>=deadline){timeout();return;}
     if(result.policy!==plan.mode||result.seed!==plan.options.seed||result.operations<snapshot.operations||result.operations>plan.options.operationBudget)throw Error('Worker result identity');
     audit=data.audit??null;finish({...result,origin:'worker',traceAvailable:true});
    }catch(error){finish(null,error);}
   };
  }catch(error){finish(null,error);}
 });
}
