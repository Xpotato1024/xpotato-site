// SPDX-License-Identifier: AGPL-3.0-only
// Engine-free DOM surface. Updates never focus, scroll, recreate nodes, or run timers.
export function createProgressView(doc,prefix,{stageElement=null}={}){
 const make=(tag,attrs={})=>{const n=doc.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 const root=make('section',{'class':'bt-progress','aria-label':'工程の進捗'});
 const stage=stageElement??make('p',{id:prefix+'progress-stage','class':'bt-progress-stage','aria-live':'polite','aria-atomic':'true'});
 const bar=make('progress',{max:'1','aria-labelledby':prefix+'progress-stage','aria-describedby':prefix+'progress-counts'});
 const readout=make('div',{'class':'bt-progress-readout'}),counts=make('p',{id:prefix+'progress-counts','class':'bt-progress-counts'}),summary=make('p',{'class':'bt-progress-summary'});
 const partial=make('details',{'class':'bt-progress-partial'}),partialTitle=make('summary',{}),partialText=make('p',{'class':'bt-progress-partial-value'});partial.append(partialTitle,partialText);partial.hidden=true;
 if(stageElement)stage.setAttribute('id',prefix+'progress-stage');
 readout.append(counts,summary);root.append(...(stageElement?[]:[stage]),bar,readout,partial);root.hidden=false;let closed=false;
 const text=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
 function update(snapshot,{phase='ready'}={}){
  if(closed)return;root.hidden=false;
  const terminal=!!snapshot&&['settled','stopped'].includes(snapshot.stage);
  const state=snapshot?.stage??(phase==='loading'?'preparing':['error','blocked'].includes(phase)?'stopped':phase==='invalid'?'invalid':'idle');
  root.setAttribute('data-state',state);bar.setAttribute('data-state',state);bar.setAttribute('data-terminal',String(terminal||state==='stopped'));
  stage.setAttribute('aria-live',terminal?'off':'polite');
  if(!snapshot){
   const label=state==='preparing'?'準備中':state==='invalid'?'入力を確認':state==='stopped'?'処理停止':'待機中';
   text(stage,label);text(counts,'');text(summary,'');partial.hidden=true;text(partialText,'');
   if(state==='preparing')bar.removeAttribute('value');else bar.setAttribute('value','0');
   bar.setAttribute('aria-valuetext',state==='idle'?'待機中。計算は開始していません。':label);return;
  }
  text(stage,snapshot.stage==='settled'?'処理終了':snapshot.stage==='verifying'?'結果を確認中':snapshot.label);
  const measured=snapshot.stage==='collecting'&&snapshot.value!==null;
  text(counts,snapshot.relations===null?'':snapshot.relations+' / '+snapshot.target+' 関係式');
  text(summary,measured?'この工程の進捗':snapshot.stage==='collecting'?'後続の処理中':snapshot.stage==='cancelling'?'停止と解放を確認中':'');
  if(terminal){text(counts,'');text(summary,'');}
  const candidates=snapshot.factorCandidates??[];partial.hidden=terminal||!candidates.length;
  text(partialTitle,'因子候補 '+candidates.length+'項（最終確認前）');text(partialText,candidates.map(f=>f.value+(f.exponent===1?'':'^'+f.exponent)).join(' × ')+' — 素数性は最終確認で判定します。');
  if(terminal){bar.setAttribute('value','0');bar.setAttribute('aria-valuetext',snapshot.stage==='settled'?'処理終了。結果を確認してください。':snapshot.summary);}
  else if(snapshot.value===null){bar.removeAttribute('value');bar.setAttribute('aria-valuetext',snapshot.summary);}
  else{bar.setAttribute('value',String(snapshot.value));bar.setAttribute('aria-valuetext','関係収集 '+(Math.floor(snapshot.value*1000)/10).toFixed(1)+'%（計算全体の完了率ではありません）');}
 }
 update(null);
 return{root,update,dispose(){closed=true;root.hidden=true;}};
}
