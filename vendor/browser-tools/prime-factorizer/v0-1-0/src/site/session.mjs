// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Xpotato.net / Xpotato1024
import {makeComputeScope} from './document-scope.mjs';
import {parseSiteInput,selectSitePlan} from './policy.mjs';
import * as lightModule from '../resources/light-adapter.mjs';
import * as optimizedModule from '../optimized/index.mjs';
import * as wideModule from '../selected-wide/index.mjs';
import {makeResultView} from '../ui/result-view.mjs';
import {assessPrime} from '../engine/arithmetic.mjs';
import {UINT64_CEILING} from '../engine/options.mjs';
const boundary=1n<<128n;
export const heavyView=(r,input,{now,deadline})=>{
 let ticks=0;const budget={tick(){if(++ticks>100000||now()>=deadline)throw Error('Display proof budget');}};
 if(!r||r.input!==input||!['factorized','probable','partial','incomplete','timeout','cancelled'].includes(r.kind)||r.allWorkersDisposed!==true||r.allWorkerSourcesReleased!==true||!Array.isArray(r.factors)||r.factors.length>2||typeof r.remaining!=='string'||r.remaining.length>100||!/^[1-9][0-9]*$/.test(r.remaining))throw Error('Result contract');
 let product=BigInt(r.remaining),previous=1n;const n=BigInt(input),terms=[];
 for(const f of r.factors){
  if(typeof f.value!=='string'||f.value.length>100||!/^[1-9][0-9]*$/.test(f.value)||!['proven','probable'].includes(f.certainty))throw Error('Factor contract');
  const d=BigInt(f.value);if(d<=1n||d>=n||n%d)throw Error('Proper divisor');
  if(d<previous||f.certainty==='proven'&&d>=UINT64_CEILING||f.certainty==='probable'&&d<UINT64_CEILING||assessPrime(d,budget)!==f.certainty)throw Error('Prime certainty');previous=d;
  product*=d;terms.push(f.value+(f.certainty==='probable'?'（未証明）':''));
 }
 if(r.factors.length===2&&r.factors[0].value===r.factors[1].value)terms.splice(0,terms.length,r.factors[0].value+'^2'+(r.factors[0].certainty==='probable'?'（未証明）':''));
 if(product!==n||['factorized','probable'].includes(r.kind)&&(r.remaining!=='1'||r.factors.length!==2)||r.kind==='factorized'&&r.factors.some(f=>f.certainty!=='proven')||r.kind==='probable'&&!r.factors.some(f=>f.certainty==='probable'))throw Error('Factor product');
 if(r.factors.length&&now()>=deadline)throw Error('Display proof deadline');
 const complete=['factorized','probable'].includes(r.kind);
 const status=r.kind==='cancelled'?'中止しました。':complete?r.kind==='probable'?'未証明の因子を含みます。素数証明ではありません。':'分解完了（確定判定）。':'未完了です。未解決部分は素数とは限りません。';
 if(r.remaining!=='1')terms.push('[未解決: '+r.remaining+']');
 const equation=input+' = '+terms.join(' × ');
 return{copyText:[equation,status,r.reason?'停止理由: '+String(r.reason).slice(0,80):''].filter(Boolean).join('\n'),statusText:status};
};
export function createSiteSession({scope=makeComputeScope(),hints={},loadLight=async()=>lightModule,loadHeavy=async name=>name==='wide'?wideModule:optimizedModule,onChange=()=>{},now=()=>performance.now()}={}){
 let light=null,heavy=null,engine='standard',preparing=false,active=null,closed=false,blocked=false,generation=0;
 let state={phase:'unprepared',engine,input:null,view:null,error:null,resources:null};
 const emit=next=>{state=next;if(!closed)onChange(structuredClone(state));};
 return{
  getState:()=>structuredClone(state),
  async prepare(next='standard'){
   if(closed||blocked||active||preparing)return false;
   if(scope.isQuarantined()){blocked=true;emit({...state,phase:'blocked',error:'Workerの解放を確認できないため、このページでは再実行できません。ページを再読み込みしてください。'});return false;}
   if(!['standard','optimized','wide'].includes(next))throw Error('Named engine required');
   preparing=true;const id=++generation;emit({...state,phase:'loading',view:null,error:null});
   try{
    light??=await loadLight();if(next!=='standard')heavy=await loadHeavy(next);
    if(closed||id!==generation)return false;engine=next;emit({phase:'ready',engine,input:null,view:null,error:null,resources:null});return true;
   }catch{if(!closed&&id===generation)emit({...state,phase:'error',error:'必要ファイルを準備できませんでした。準備をやり直してください。'});return false;}
   finally{preparing=false;}
  },
  async start(raw,settings={}){
   if(closed||blocked||active||preparing||!light||engine!=='standard'&&!heavy)return false;
   let input,resourcePlan,stagedPlan,experimental,options,resources;
   try{
    input=parseSiteInput(raw);
    const n=BigInt(input);experimental=n>=boundary;resourcePlan=selectSitePlan(engine,settings,hints,!experimental);
    if(experimental&&(engine==='standard'||input.length>100||n.toString(2).length>332))throw Error('Experimental input range');
    options={seed:1,timeBudgetMs:Math.min(60000,resourcePlan.timeBudgetMs),operationBudget:resourcePlan.operationBudget};
    if(!experimental)stagedPlan=light.selectValidatedStagedPlan(input,options);
    resources={plan:resourcePlan,route:experimental?engine:stagedPlan.engineMode,actualWorkers:experimental?resourcePlan.workers:n<2n?0:1,actualWasmBytes:experimental?resourcePlan.totalWasmBytes:stagedPlan.linearMemoryBytes,actualTimeBudgetMs:experimental?resourcePlan.timeBudgetMs:options.timeBudgetMs};
   }catch{emit({...state,phase:'invalid',input:null,view:null,resources:null,error:'入力範囲または資源設定を確認してください。通常は2^128未満、高難度は最大332bit・100桁です。Worker数とWASM予算の組合せにも上限があります。'});return false;}
   const id=++generation,control=new AbortController(),token={};
   if(!scope.acquire(token)){emit({phase:scope.isQuarantined()?'blocked':'invalid',engine,input:null,view:null,resources:null,error:scope.isQuarantined()?'Workerの解放を確認できません。ページを再読み込みしてください。':'同じページの別の計算が終了してから実行してください。'});return false;}
   active={id,control};emit({phase:'running',engine,input,view:null,error:null,resources});let terminal,runReturned=false;const deadline=now()+resources.actualTimeBudgetMs;
   try{
    let view;
    if(experimental){
     const result=await heavy.runRusqsieve(input,{resourcePlan,signal:control.signal});runReturned=true;if(result?.allWorkersDisposed!==true||result?.allWorkerSourcesReleased!==true)blocked=true;view=heavyView(result,input,{now,deadline});
    }else{
     const result=await light.runSelectedStagedRequest(input,options,{signal:control.signal});runReturned=true;
     if(result.policy!==stagedPlan.mode||result.seed!==1)throw Error('Result identity');
     view=makeResultView(result,input);if(['complete','probable'].includes(view.status)&&now()>=deadline)throw Error('Display proof deadline');
    }
    terminal={phase:'result',engine,input,view,error:null,resources};
   }catch{if(!runReturned)blocked=true;terminal={phase:blocked?'blocked':'error',engine,input,view:null,error:blocked?'Workerの解放を確認できませんでした。この画面では次の計算を開始できません。タブを閉じて開き直してください。':'計算結果の検証を完了できませんでした。新しい計算を開始できます。',resources};}
   finally{if(blocked)scope.quarantine();else scope.release(token);if(!closed&&id===generation){active=null;emit(terminal);}}
   return true;
  },
  cancel(){if(closed||!active||active.control.signal.aborted)return false;emit({...state,phase:'cancelling'});active.control.abort();return true;},
  dispose(){if(closed)return;closed=true;generation++;active?.control.abort();active=null;state={...state,phase:'disposed',view:null};}
 };
}
