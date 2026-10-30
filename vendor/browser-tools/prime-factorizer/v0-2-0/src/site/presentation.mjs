// SPDX-License-Identifier: AGPL-3.0-only
import {stopReasonPresentation} from './progress.mjs';
// Presentation only. Mathematical verification remains in session/result-view.
export function formatElapsed(ms){
 if(!Number.isFinite(ms)||ms<0)return '計測なし';
 if(ms===0)return '0 ms';
 if(ms<1)return '<1 ms';
 if(ms<1000)return Math.round(ms)+' ms';
 return (ms/1000).toFixed(2)+' 秒';
}
export function sitePresentation(view){
 const factorRows=(view.groups??[]).map(g=>({value:g.base,exponent:g.exponent,certainty:g.certainty,
  text:g.base+(g.exponent===1?'':'（'+g.exponent+'乗）')+': '+(g.certainty==='proven'?'確定判定':g.certainty==='probable'?'未証明（probable）':'判定未確認'),
  reason:g.certainty==='proven'?'小素数との照合、または64bit未満で確定できる素数判定の対象です。':g.certainty==='probable'?'固定基底の判定に通った素数候補です。素数証明はしていません。':'素数であることを確認できていません。'}));
 const residual=view.residual??null,reasonText=stopReasonPresentation(view.reasonCode)?.text??view.reasonText??'';
 return {equation:view.equation,reasonText,details:view.certaintyText??'',factorRows,residual,
  copyText:[view.equation,view.statusText,reasonText,factorRows.length?'因子の判定:\n'+factorRows.map(r=>r.text+' — '+r.reason).join('\n'):view.certaintyText?'因子の確度: '+view.certaintyText:'',residual!==null?'未解決の余因子: '+residual:''].filter(Boolean).join('\n')};
}
export function executionPresentation(resources,elapsedMs){
 if(!resources)return null;
 const configured=resources.configuredPlan??resources.plan;
 return {elapsed:formatElapsed(elapsedMs),
  measurementNote:'この計算のWorker初期化・結果検証・解放処理を含みます。ページ初回の読込・準備時間は含みません。',
  limits:[...(configured?[['選択したWASM予算',configured.budgetBytes/1048576+' MiB']]:[]),['時間上限',resources.actualTimeBudgetMs/1000+'秒'],['計算経路',resources.route==='extended-brent'?'大きい入力（有限Brent）':resources.route],['経路のWorker上限',resources.actualWorkers?String(resources.actualWorkers):'この計算では使わない'],['経路のWASM上限',resources.actualWasmBytes?resources.actualWasmBytes/1048576+' MiB':'この計算では使わない'],...(resources.actualOperationBudget!==undefined?[['計算量上限',String(resources.actualOperationBudget)+' 操作']]:[])],
  limitsNote:'設定予算と、入力に応じた計算経路の上限を分けて表示しています。WASMを使わない経路でも設定予算は保持します。いずれも実メモリ使用量の測定値ではありません。'};
}
// Selection changes input only. No engine/resource setting or auto-start.
export const sampleInputs=Object.freeze([
 Object.freeze({value:'360',label:'360 — 入門・小因子と指数の表示'}),
 Object.freeze({value:'104729',label:'104729 — 小さな素数の確定判定'}),
 Object.freeze({value:'9007199254740993',label:'9007199254740993 — 整数精度の確認（小因子あり）'}),
 Object.freeze({value:'1000036000099',label:'1000036000099 — 釣り合った半素数（端末で所要時間が変わります）'})
]);
export async function copyResult(text,clipboard){
 try{if(typeof clipboard?.writeText!=='function')return false;await clipboard.writeText(text);return true;}
 catch{return false;}
}
