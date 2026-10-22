// SPDX-License-Identifier: AGPL-3.0-only
import {documentComputeScope} from './document-scope.mjs';
import {createSiteSession} from './session.mjs';
import {selectSitePlan} from './policy.mjs';
let serial=0;
export function mountSiteFactorizer(root,{hints={hardwareConcurrency:globalThis.navigator?.hardwareConcurrency,deviceMemory:globalThis.navigator?.deviceMemory},sessionOptions={}}={}){
 if(!root?.ownerDocument)throw TypeError('DOM root required');
 const doc=root.ownerDocument,scope=documentComputeScope(doc),prefix='bt-prime-'+(++serial)+'-',listeners=[];
 const el=(tag,attrs={})=>{const n=doc.createElement(tag);for(const[k,v]of Object.entries(attrs))k==='text'?n.textContent=v:n.setAttribute(k,k==='id'?prefix+v:v);return n;};
 const listen=(target,event,fn)=>{target.addEventListener(event,fn);listeners.push(()=>target.removeEventListener(event,fn));};
 const select=(id,items)=>{const n=el('select',{id});for(const[v,t]of items)n.append(el('option',{value:String(v),text:t}));return n;};
 const field=(parent,text,node)=>{const p=el('p');p.append(el('label',{for:node.id,text}),node);parent.append(p);};
 const form=el('form'),fields=el('fieldset');form.noValidate=true;fields.append(el('legend',{text:'整数の素因数分解'}));
 const input=el('input',{id:'input',type:'text',inputmode:'decimal',autocomplete:'off',spellcheck:'false',maxlength:'4096','aria-label':'0以上の整数'});input.required=true;
 field(fields,'0以上の整数',input);
 fields.append(el('p',{text:'例: 32、3.2e1。整数を丸めず扱います。最大332bit・100桁。桁数だけでは難易度は決まりません。通常は2^128未満です。'}));
 const engine=select('engine',[['standard','通常（小さい入力）'],['optimized','高難度（有限SIQS）'],['wide','大メモリ（明示実験）']]);field(fields,'計算モード',engine);
 const mode=select('mode',[['auto','自動（保守的）'],['manual','手動設定']]);field(fields,'資源設定',mode);
 const details=el('details');details.append(el('summary',{text:'Worker・WASM予算・時間'}));
 const workers=select('workers',[1,2,3,4,5,6].map(x=>[x,String(x)]));
 const memory=select('memory',[128,256,384,512,768,1536].map(x=>[x,x+' MiB']));
 const time=select('time',[[1000,'1秒'],[5000,'5秒'],[15000,'15秒'],[60000,'1分'],[300000,'5分'],[600000,'10分'],[1800000,'30分'],[3600000,'1時間']]);
 field(details,'総Worker数（集約役を含む）',workers);field(details,'WASM予算',memory);field(details,'計算時間（初期化を含む）',time);
 const estimate=el('p');details.append(estimate);fields.append(details);
 const start=el('button',{type:'submit',text:'分解する','data-action':'start'}),cancel=el('button',{type:'button',text:'計算を中止','data-action':'cancel'}),reset=el('button',{type:'button',text:'リセット','data-action':'reset'});
 fields.append(start,' ',cancel,' ',reset);form.append(fields);
 const error=el('p',{role:'alert'}),status=el('p',{role:'status','aria-live':'polite','aria-atomic':'true'}),actual=el('p');
 const output=el('textarea',{readonly:'',rows:'8','aria-label':'全桁の検証済み結果（未解決部分を含む）',wrap:'soft'});
 const note=el('p',{text:'計算は準備済みファイルだけでブラウザ内で行い、入力・結果を保存・送信しません。通常経路は最大1 Worker・WASM128 MiB・60秒。自動設定は最大2 Worker。大メモリは明示手動・WASM予算1536 MiB・最大5 Worker・1時間です。WASM上限はJavaScriptやブラウザ全体のRAM上限ではなく、端末によるタブ終了を防ぐ保証はありません。未完了・未証明を区別して表示します。同じページでは同時計算を1件に制限します。'}); 
 root.replaceChildren(form,error,status,actual,output,note);
 let disposed=false,busy=false,session;
 const settings=()=>({mode:mode.value,workers:Number(workers.value),memoryMiB:Number(memory.value),timeBudgetMs:Number(time.value),...(engine.value==='wide'?{outstandingSlots:8}:{})});
 const estimateNext=()=>{try{const p=selectSitePlan(engine.value,settings(),hints);estimate.textContent=p.workers+' Worker、WASM上限合計 '+p.totalWasmBytes/1048576+' MiB（予算 '+p.budgetBytes/1048576+' MiB）、'+p.timeBudgetMs/1000+'秒。';}catch{estimate.textContent='この設定の組合せは実行できません。';}};
 const render=s=>{
  if(disposed)return;busy=['loading','running','cancelling','blocked'].includes(s.phase);
  for(const n of [input,engine,mode,time])n.disabled=busy;
  workers.disabled=memory.disabled=busy||mode.value!=='manual';
  start.disabled=busy||s.phase==='unprepared';cancel.disabled=s.phase!=='running';reset.disabled=busy;
  error.textContent=s.error??'';input.setAttribute('aria-invalid',String(s.phase==='invalid'));
  status.textContent=s.phase==='loading'?'ファイルを準備しています。':s.phase==='ready'?'準備完了。以後の計算に通信は不要です。':s.phase==='running'?'計算しています。':s.phase==='cancelling'?'中止してWorkerを解放しています。':s.view?.statusText??'入力と設定を確認してください。';
  root.dataset.phase=s.phase;output.value=s.view?.copyText??'';
  const r=s.resources;actual.textContent=r?'今回: '+r.route+'、'+r.actualWorkers+' Worker、WASM上限 '+r.actualWasmBytes/1048576+' MiB、'+r.actualTimeBudgetMs/1000+'秒。':'';
  estimateNext();
 };
 const prepare=()=>{void session.prepare(engine.value);};
 const makeSession=()=>{session=createSiteSession({...sessionOptions,scope,hints,onChange:render});render(session.getState());prepare();};
 listen(form,'submit',e=>{e.preventDefault();void session.start(input.value,settings());});
 listen(cancel,'click',()=>session.cancel());
 listen(reset,'click',()=>{session.dispose();input.value='';makeSession();});
 listen(engine,'change',()=>{
  if(engine.value==='wide'){mode.value='manual';memory.value='1536';workers.value=String(Math.min(5,Math.max(1,(hints.hardwareConcurrency??2)-1)));time.value='60000';details.open=true;}
  else{mode.value='auto';memory.value='128';workers.value='1';time.value=engine.value==='standard'?'1000':'60000';}
  prepare();
 });
 for(const n of [mode,workers,memory,time])listen(n,'change',()=>{details.open=mode.value==='manual';render(session.getState());});
 makeSession();
 const dispose=()=>{if(disposed)return;disposed=true;session.dispose();for(const remove of listeners)remove();root.replaceChildren();root.dataset.phase='disposed';};
 if(doc.defaultView)listen(doc.defaultView,'pagehide',dispose);
 return{dispose,getState:()=>session.getState()};
}
