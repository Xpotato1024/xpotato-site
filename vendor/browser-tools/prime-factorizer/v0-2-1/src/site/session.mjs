// SPDX-License-Identifier: AGPL-3.0-only
import {createProgressTracker} from './progress.mjs';
import {makeComputeScope} from './document-scope.mjs';
import {validateSiteInput,siteInputErrorMessage,selectSitePlan} from './policy.mjs';
import * as lightModule from '../resources/light-adapter.mjs';
import * as optimizedModule from '../optimized/index.mjs';
import * as wideModule from '../selected-wide/index.mjs';
import * as experimentalModule from '../siqs400/index.mjs';
import * as extendedModule from '../extended/runner.mjs';
import {createSiteRouter,siteRoutingOptions,verifyRoutingResult} from './routing.mjs';
import {makeRoutingView} from './routing-view.mjs';
export function createSiteSession({scope=makeComputeScope(),hints={},loadLight=async()=>lightModule,loadHeavy=async name=>name==='wide'?wideModule:optimizedModule,loadExtended=async()=>extendedModule,load400=async()=>experimentalModule,createRouter=createSiteRouter,onChange=()=>{},now=()=>performance.now()}={}){
 let light=null,heavy=null,extended=null,experimental=null,engine='standard',preparing=false,active=null,closed=false,blocked=false,generation=0;
 const progress=createProgressTracker();
 let state={phase:'unprepared',engine,input:null,view:null,error:null,errorField:null,resources:null};
 const emit=next=>{state={...next,progress:progress.get()};if(!closed)onChange(structuredClone(state));};
 return{
  getState:()=>structuredClone(state),
  getElapsedMs:()=>active?Math.max(0,now()-active.startedAt):state.resources?.elapsedMs??0,
  async prepare(next='standard'){
   if(closed||blocked||active||preparing)return false;
   if(scope.isQuarantined()){blocked=true;emit({...state,phase:'blocked',errorField:'runtime',error:'資源解放を確認できません。ページを再読み込みしてください。'});return false;}
   if(!['standard','optimized','wide'].includes(next))throw Error('Named engine required');
   progress.reset();preparing=true;const id=++generation;emit({...state,phase:'loading',view:null,error:null,errorField:null});
   try{
    light??=await loadLight();extended??={...extendedModule,...await loadExtended()};heavy=await loadHeavy(next);if(next==='wide')experimental??=await load400();
    if(closed||id!==generation)return false;engine=next;emit({phase:'ready',engine,input:null,view:null,error:null,errorField:null,resources:null});return true;
   }catch{if(!closed&&id===generation)emit({...state,phase:'error',errorField:'load',error:'必要ファイルを準備できませんでした。準備をやり直してください。'});return false;}
   finally{preparing=false;}
  },
  async start(raw,settings={}){
   if(closed||blocked||active||preparing||!light||!heavy)return false;
   let input,plan,router,options;
   try{input=validateSiteInput(raw,engine);}catch(error){emit({...state,phase:'invalid',input:null,view:null,resources:null,error:siteInputErrorMessage(error,engine),errorField:'input'});return false;}
   try{plan=selectSitePlan(engine,settings,hints);options=siteRoutingOptions(engine,plan);router=createRouter({scope,now,engine,light,extended,heavy,experimental});}
   catch{emit({...state,phase:'invalid',input:null,view:null,resources:null,error:'Worker数・WASM予算・時間上限の設定の組み合わせを見直してください。',errorField:'settings'});return false;}
   const probeToken={};if(!scope.acquire(probeToken)){blocked=scope.isQuarantined();emit({phase:blocked?'blocked':'invalid',engine,input:null,view:null,resources:null,errorField:'runtime',error:blocked?'資源解放を確認できません。ページを再読み込みしてください。':'同じページの別の計算が終了してから実行してください。'});return false;}scope.release(probeToken);
   const id=++generation,control=new AbortController(),startedAt=now();
   const resources={configuredPlan:plan,plan,route:'共通ルーティング',actualWorkers:0,actualWasmBytes:0,actualTimeBudgetMs:options.jobTimeMs,elapsedMs:0,experimental400:engine==='wide'&&BigInt(input).toString(2).length>332};
   progress.begin(id);active={id,control,router,startedAt};emit({phase:'running',engine,input,view:null,error:null,errorField:null,resources});let terminal;
   try{
    const rawResult=await router.run(input,{...options,signal:control.signal,onChange:event=>{
     if(closed||active?.id!==id||control.signal.aborted)return;
     if(event.phase==='starting'){
      progress.engine(id,event.jobId,event.stage);resources.activeStage=event.stage;
      resources.actualWorkers=Math.max(resources.actualWorkers,event.workerLimit??0);resources.actualWasmBytes=Math.max(resources.actualWasmBytes,event.wasmAllocationBytes??0);
      emit({...state,resources});
     }else if(event.phase==='accepted-prefix'&&progress.prefix(id,event.factors)){emit({...state,resources});}
     else if(event.phase==='collecting'&&progress.collect(id,event)){emit({...state,resources});}
    }});
    if(rawResult.reason==='scope-busy'){terminal={phase:'invalid',engine,input:null,view:null,error:'同じページの別の計算が終了してから実行してください。',errorField:'runtime',resources:null};}
    else{
     progress.verify(id);if(!closed)emit({...state});
     const result=verifyRoutingResult(rawResult,{now,signal:control.signal});blocked=rawResult.status==='blocked'||!rawResult.allStagesDisposed||scope.isQuarantined();
     const view=makeRoutingView(result,input);resources.trace=rawResult.trace;resources.workRemaining=rawResult.workRemaining;
     terminal={phase:blocked?'blocked':'result',engine,input,view,error:blocked?'Workerまたは生成資源の解放を確認できないため、再読み込みが必要です。':null,errorField:blocked?'runtime':null,resources};
    }
   }catch{blocked=true;scope.quarantine();terminal={phase:'blocked',engine,input,view:null,errorField:'runtime',error:'計算結果と資源解放を確認できませんでした。ページを再読み込みしてください。',resources};}
   finally{progress.finish(id,terminal?.phase);resources.elapsedMs=Math.max(0,now()-startedAt);if(!closed&&id===generation){active=null;emit(terminal);}}
   return true;
  },
  cancel(){if(closed||!active||active.control.signal.aborted)return false;progress.cancel(active.id);emit({...state,phase:'cancelling'});active.control.abort();active.router.cancel();return true;},
  dispose(){if(closed)return;closed=true;generation++;progress.close();active?.control.abort();active?.router.cancel();active=null;state={...state,phase:'disposed',view:null,progress:null};}
 };
}
