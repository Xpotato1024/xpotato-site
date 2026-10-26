// SPDX-License-Identifier: AGPL-3.0-only
// Presentation only. Mathematical verification remains in session/result-view.
export function formatElapsed(ms){
 if(!Number.isFinite(ms)||ms<0)return '計測なし';
 if(ms===0)return '0 ms';
 if(ms<1)return '<1 ms';
 if(ms<1000)return Math.round(ms)+' ms';
 return (ms/1000).toFixed(2)+' 秒';
}
export function sitePresentation(view){
 return {equation:view.equation,details:view.certaintyText??'',
  copyText:[view.equation,view.statusText,view.reasonText,view.certaintyText?'因子の確度: '+view.certaintyText:''].filter(Boolean).join('\n')};
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
