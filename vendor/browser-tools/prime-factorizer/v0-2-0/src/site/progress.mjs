// SPDX-License-Identifier: AGPL-3.0-only
// Presentation state only: never imports an engine, verifies factors, or changes budgets.
export const routingStageLabels=Object.freeze({staged128:'小入力の分解',native:'前処理・Brent',ecm:'ECM・小因子探索',siqs332:'SIQS・関係収集',siqsWide332:'大メモリSIQS・関係収集',siqs400:'実験SIQS400・関係収集'});
const stages={
 running:['計算中','この工程の割合は未計測です。'],
 collecting:['関係収集','収集量の割合です。計算全体の完了率ではありません。'],
 verifying:['結果の検算','因子と積・確度・資源解放を確認しています。割合は未計測です。'],
 cancelling:['中止処理','計算停止と資源解放を待っています。'],
 settled:['実行記録','完了・未完了と因子の確度は結果本文を確認してください。'],
 stopped:['処理停止','結果の検証または資源解放を確認できませんでした。']
};
function snapshot(state){
 if(!state)return null;
 const [label,summary]=stages[state.stage],atTarget=state.stage==='collecting'&&state.relations>=state.target;
 return {...state,factorCandidates:(state.factorCandidates??[]).map(f=>({...f})),summary:atTarget?'収集目標に到達。検算を含む後続処理は未完了です。':summary,
  label:atTarget?'収集目標到達・後続処理':state.stage==='running'&&state.engineLabel?state.engineLabel:label,value:state.stage==='collecting'&&!atTarget?state.relations/state.target:null};
}
export function createProgressTracker(){
 let state=null,closed=false,lastJob=0;
 const current=job=>!closed&&state?.job===job&&!['settled','stopped'].includes(state.stage);
 return{
  get:()=>snapshot(state),
  begin(job){if(closed||!Number.isSafeInteger(job)||job<=lastJob)return false;lastJob=job;state={job,stage:'running',families:null,relations:null,target:null,factorCandidates:[]};return true;},
  engine(job,stageJob,stage){if(!current(job)||state.stage==='cancelling'||!Number.isSafeInteger(stageJob)||stageJob<1||stageJob<=(state.stageJob??0)||!Object.hasOwn(routingStageLabels,stage))return false;state={...state,job,stage:'running',stageJob,engineLabel:routingStageLabels[stage],families:null,relations:null,target:null};return true;},
  prefix(job,factors){
   if(!current(job)||!['running','collecting'].includes(state.stage)||!Array.isArray(factors)||factors.length>1024)return false;
   if(factors.some(f=>typeof f?.value!=='string'||f.value.length>309||!/^[1-9][0-9]*$/.test(f.value)||!Number.isSafeInteger(f.exponent)||f.exponent<1||f.exponent>1023))return false;
   const next=factors.map(f=>({value:f.value,exponent:f.exponent}));if(JSON.stringify(next)===JSON.stringify(state.factorCandidates??[]))return false;
   state={...state,factorCandidates:next};return true;
  },
  collect(job,data){
   if(!current(job)||!['running','collecting'].includes(state.stage)||!data)return false;
   const {families,relations,target}=data;
   if(![families,relations,target].every(x=>Number.isSafeInteger(x)&&x>=0&&x<=1000000)||target<1)return false;
   if(state.target!==null&&(target!==state.target||relations<state.relations||families<state.families))return false;
   state={...state,job,stage:'collecting',families,relations,target};return true;
  },
  verify(job){if(!current(job)||!['running','collecting'].includes(state.stage))return false;state={...state,stage:'verifying'};return true;},
  cancel(job){if(!current(job)||state.stage==='cancelling')return false;state={...state,stage:'cancelling'};return true;},
  finish(job,outcome){if(!current(job))return false;state={...state,stage:outcome==='result'?'settled':'stopped'};return true;},
  reset(){if(!closed)state=null;},
  close(){closed=true;state=null;}
 };
}
const reasons={
 'job-time-budget':['time','設定した計算全体の時間上限に達しました。'],
 'phase-time-budget':['time','この工程に割り当てた時間上限に達しました。'],
 'proof-time-budget':['verification-budget','最終確認の時間上限に達しました。未確認の項は確定因子として表示しません。'],
 'proof-operation-budget':['verification-budget','素数性確認の計算量上限に達しました。'],
 'memory-budget':['memory','計算側のメモリ保護条件により停止しました。端末全体のRAM不足とは限りません。'],
 'gnfs-unavailable':['range','残る合成数は現在のエンジンの対応範囲外です。GNFSは未実装です。'],
 'enabled-engines-exhausted':['search','利用可能な方式の有限探索を終了しました。'],
 'stage-count-budget':['work','段階数の上限に達しました。'],
 'simd-unavailable':['capability','このブラウザでは必要なWASM SIMDを利用できません。'],
 'invalid-result':['verification','返却された結果の整合性を確認できませんでした。'],
 'factor-proof-required':['verification','因子の最終確認が必要です。'],
 'verification-time-budget':['verification-budget','検算の時間上限に達しました。検算済みの結果だけを表示しています。'],
 'verification-work-budget':['verification-budget','検算の計算量上限に達しました。検算済みの結果だけを表示しています。'],
 'worker-create-error':['worker','Workerを準備できませんでした。原因がメモリ不足かは確認できません。'],
 'computation-error':['worker','計算処理がエラーを報告しました。検算済みの結果だけを表示しています。'],
 'worker-csp-violation':['worker','Workerのセキュリティ方針違反が報告されたため停止しました。'],
 'invalid-clock':['clock','経過時間の測定に異常があったため停止しました。'],
 'scope-busy':['resource','同じページの計算が終了してから実行してください。'],
 'scope-quarantined':['cleanup','資源解放を確認できないため、このページでは再実行できません。'],
 'time-budget':['time','設定した実行時間の上限に達しました。'],
 'host-timeout':['time','初期化を含む実行時間の上限に達しました。'],
 'initialization-timeout':['initialization','Workerの初期化時間の上限に達しました。'],
 'coordinator-memory-soft-stop':['memory-soft-stop','観測したWASM保持量・linear memoryが保護停止の閾値に達しました。端末全体の空きRAMの測定ではありません。'],
 'native-memory-budget':['memory-allocation-refused','Native処理で設定された割当予算による拒否を確認しました。'],
 'wasm-oom':['wasm-allocation-failure-reported','WASMから割当失敗が報告されました。停止の直接原因や端末全体のRAM不足は未確定です。'],
 'fatal-unknown':['worker','Worker内の処理で異常が発生しました。原因がメモリ不足かは確認できません。'],
 'native-unknown':['native','Native処理の停止理由を特定できませんでした。'],
 'missing-session':['protocol','Native計算のsessionを確認できませんでした。'],
 'composite-divisor':['verification','候補の因子が合成数で、分解を完了できませんでした。'],
 'operation-budget':['work','設定した計算量の上限に達しました。'],
 'family-budget':['work','関係収集の計算量上限に達しました。'],
 'fixed-family-bound':['work','指定した関係収集範囲を終了しました。'],
 'algorithm-range':['range','この計算経路の対応範囲を超えています。'],
 'algorithm-resource':['resource','計算資源の制限で停止しました。メモリ不足とは特定していません。'],
 'algorithm-exhausted':['search','有限の探索範囲で因子が見つかりませんでした。'],
 'insufficient-relations':['search','検算へ進むための関係が不足しています。'],
 'no-dependency':['search','利用できる依存関係が見つかりませんでした。'],
 'no-factor':['search','この探索では因子が得られませんでした。'],
 'cancelled':['cancelled','ユーザーの操作により計算を中止しました。'],
 'verification-failed':['verification','結果の検算を完了できませんでした。'],
 'invalid-dependency':['verification','依存関係の検証に失敗しました。'],
 'worker-retirement':['cleanup','Workerまたは生成資源の解放を確認できませんでした。'],
 'worker-error':['worker','Worker異常で停止しました。原因がメモリ不足かは確認できません。'],
 'worker-creation':['worker','Workerの生成に失敗しました。原因がメモリ不足かは確認できません。'],
 'worker-outcome-unknown':['worker','計算処理が正常な結果を返しませんでした。原因と資源解放は未確認です。'],
 'message-error':['protocol','Workerからのデータを受信できませんでした。'],
 'protocol-failure':['protocol','Workerからの応答が契約に一致しませんでした。'],
 'audit-retention-cap':['resource','検証用データの保持上限に達しました。']
};
export function stopReasonPresentation(code){
 if(code===null||code===undefined||code==='')return null;
 const [category,text]=typeof code==='string'&&Object.hasOwn(reasons,code)?reasons[code]:['unknown','計算が停止しました。原因は特定できていません。'];
 return {category,text};
}
