// SPDX-License-Identifier: AGPL-3.0-only
// Engine-free DOM surface. Updates never focus, scroll, recreate nodes, or run timers.
export function createProgressView(doc,prefix,{stageElement=null}={}){
 const make=(tag,attrs={})=>{const n=doc.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 const root=make('section',{'class':'bt-progress','aria-label':'工程ごとの進捗'});
 const stage=stageElement??make('p',{id:prefix+'progress-stage','class':'bt-progress-stage','aria-live':'polite','aria-atomic':'true'});
 const bar=make('progress',{max:'1','aria-labelledby':prefix+'progress-stage'});
 const counts=make('p',{'class':'bt-progress-counts'}),summary=make('p',{'class':'bt-progress-summary'});
 const partial=make('details',{'class':'bt-progress-partial'}),partialTitle=make('summary',{}),partialText=make('p',{'class':'bt-progress-partial-value'});partial.append(partialTitle,partialText);partial.hidden=true;
  if(stageElement)stage.setAttribute('id',prefix+'progress-stage');
 root.append(...(stageElement?[]:[stage]),bar,counts,summary,partial);root.hidden=true;let closed=false;
 const text=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
 return{root,update(snapshot){
  if(closed)return;root.hidden=!snapshot;if(!snapshot){if(stageElement)stage.setAttribute('aria-live','polite');return;}
  const terminal=['settled','stopped'].includes(snapshot.stage);
  bar.setAttribute('data-terminal',String(terminal));stage.setAttribute('aria-live',terminal?'off':'polite');
  text(stage,snapshot.label);
  text(counts,snapshot.relations===null?'':snapshot.relations+' / '+snapshot.target+' 関係・'+snapshot.families+' family');
  text(summary,snapshot.summary);
   const candidates=snapshot.factorCandidates??[];partial.hidden=terminal||!candidates.length;
   text(partialTitle,'因子候補 '+candidates.length+'項（最終確認前）');text(partialText,candidates.map(f=>f.value+(f.exponent===1?'':'^'+f.exponent)).join(' × ')+' — 素数性は最終確認で判定します。');
  if(snapshot.value===null){bar.removeAttribute('value');bar.setAttribute('aria-valuetext',snapshot.summary);}
  else{bar.setAttribute('value',String(snapshot.value));bar.setAttribute('aria-valuetext','関係収集 '+(Math.floor(snapshot.value*1000)/10).toFixed(1)+'%（計算全体の完了率ではありません）');}
 },dispose(){closed=true;root.hidden=true;}};
}
