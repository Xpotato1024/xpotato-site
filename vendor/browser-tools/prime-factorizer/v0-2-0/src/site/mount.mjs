// SPDX-License-Identifier: AGPL-3.0-only
import {createProgressView} from './progress-view.mjs';
import {documentComputeScope} from './document-scope.mjs';
import {createSiteSession} from './session.mjs';
import {SITE_CAPABILITIES} from './capabilities.mjs';
import {siteInputLimit} from './policy.mjs';
import {executionPresentation,sitePresentation,sampleInputs,copyResult} from './presentation.mjs';
import {createSettingsState} from './settings-state.mjs';
import {createModal} from './modal.mjs';
import {inputGuidance} from './guidance.mjs';
import {prepareSiteFonts} from './fonts.mjs';
import * as lightModule from '../resources/light-adapter.mjs';
let serial=0;
export function mountSiteFactorizer(root,{hints={hardwareConcurrency:globalThis.navigator?.hardwareConcurrency,deviceMemory:globalThis.navigator?.deviceMemory},sessionOptions={}}={}){
 if(!root?.ownerDocument)throw TypeError('DOM root required');
 root.setAttribute('data-bt','');
 const doc=root.ownerDocument,scope=documentComputeScope(doc),prefix='bt-prime-'+(++serial)+'-',listeners=[],settingsState=createSettingsState(hints);
 const el=(tag,attrs={})=>{const n=doc.createElement(tag);for(const[k,v]of Object.entries(attrs))k==='text'?n.textContent=v:n.setAttribute(k,k==='id'?prefix+v:v);return n;};
 const setText=(n,text)=>{if(n.textContent!==text)n.textContent=text;};
 const listen=(n,event,fn)=>{n.addEventListener(event,fn);listeners.push(()=>n.removeEventListener(event,fn));};
 const select=(id,items)=>{const n=el('select',{id});for(const[v,t]of items)n.append(el('option',{value:String(v),text:t}));return n;};
 const field=(parent,text,node)=>{const p=el('div',{'class':'bt-field'});p.append(el('label',{for:node.id,text}),node);parent.append(p);return p;};
 const layout=el('div',{'class':'bt-layout'}),form=el('form'),fields=el('fieldset');form.noValidate=true;form.append(fields);
 const input=el('input',{id:'input',type:'text',inputmode:'decimal',autocomplete:'off',spellcheck:'false','aria-label':'0以上の整数',placeholder:'整数を入力'});input.required=true;
 const inputArea=el('div',{'class':'bt-input-area'}),inputLimit=el('p',{id:'input-limit','class':'bt-input-limit'}),inputLimitNote=el('p',{'class':'bt-help',text:'受付上限です。難しい半素数の分解完了を保証する値ではありません。'});
 const inputField=el('div',{'class':'bt-field'});inputArea.append(input,inputLimit,inputLimitNote);inputField.append(el('label',{for:input.id,text:'分解する整数（0以上）'}),inputArea);fields.append(inputField);
 const inputError=el('p',{id:'input-error',role:'alert','class':'bt-error'}),draftNote=el('p',{'class':'bt-draft-note',role:'status'});inputError.hidden=draftNote.hidden=true;fields.append(inputError,draftNote);
 const samples=el('dialog',{id:'examples-dialog','class':'bt-samples'}),sampleSummary=el('button',{type:'button',text:'入力例','data-action':'examples','aria-haspopup':'dialog','aria-controls':samples.id}),sampleTitle=el('h2',{id:'examples-title',text:'入力例を選ぶ',tabindex:'-1'}),sampleClose=el('button',{type:'button',text:'閉じる','data-action':'close-examples'}),sampleHeader=el('div',{'class':'bt-modal-header'}),sampleList=el('ul',{'class':'bt-sample-list'});samples.setAttribute('aria-labelledby',sampleTitle.id);sampleHeader.append(sampleTitle,sampleClose);
 samples.append(sampleHeader,el('p',{'class':'bt-help',text:'選ぶと共通の入力欄へ入ります。計算は「分解する」を押したときだけ始まります。'}),sampleList);const sampleButtons=sampleInputs.map(x=>{const button=el('button',{type:'button','class':'bt-sample-choice','data-sample-value':x.value,text:x.label}),item=el('li');item.append(button);sampleList.append(item);return button;});
 const engine=select('engine',SITE_CAPABILITIES.modes.map(m=>[m.id,m.uiLabel])),mode=select('mode',[['auto','自動（保守的）'],['manual','手動設定']]);
 const workers=select('workers',[1,2,3,4,5,6].map(x=>[x,String(x)])),memory=select('memory',[128,256,384,512,768,1536].map(x=>[x,x+' MiB']));
 const time=select('time',[[1000,'1秒'],[5000,'5秒'],[15000,'15秒'],[60000,'1分'],[300000,'5分'],[600000,'10分'],[1800000,'30分'],[3600000,'1時間']]);
 const details=el('dialog',{id:'settings-dialog','class':'bt-settings'}),settingsSummary=el('button',{type:'button',text:'実行条件','data-action':'settings','aria-haspopup':'dialog','aria-controls':details.id}),settingsTitle=el('h2',{id:'settings-title',text:'実行条件を変更',tabindex:'-1'}),settingsClose=el('button',{type:'button',text:'閉じる','data-action':'close-settings'}),settingsHeader=el('div',{'class':'bt-modal-header'}),settingsError=el('p',{id:'settings-error',role:'alert','class':'bt-error',tabindex:'-1'});settingsError.hidden=true;details.setAttribute('aria-labelledby',settingsTitle.id);settingsHeader.append(settingsTitle,settingsClose);details.append(settingsHeader,el('p',{'class':'bt-help',text:'変更は「適用する」まで反映されません。適用しても計算は始まりません。'}),settingsError);
 field(details,'計算モード',engine);field(details,'時間上限',time);const modeField=field(details,'資源設定',mode),workerField=field(details,'総Worker数（集約役を含む）',workers),memoryField=field(details,'WASM予算',memory),applicability=el('p',{'class':'bt-help'});details.append(applicability);
 const estimate=el('p',{'class':'bt-estimate'}),nextPlan=el('p',{'class':'bt-next-plan'}),settingsApply=el('button',{type:'button',text:'適用する','data-action':'apply-settings'}),settingsCancel=el('button',{type:'button',text:'取消','data-action':'cancel-settings'}),settingsActions=el('div',{'class':'bt-modal-footer'}),menu=el('div',{'class':'bt-menu'});settingsActions.append(settingsCancel,settingsApply);details.append(estimate,settingsActions);menu.append(sampleSummary,settingsSummary);fields.append(menu,nextPlan);
 const start=el('button',{type:'submit',text:'分解する','data-action':'start'}),reset=el('button',{type:'button',text:'入力・結果を消去','data-action':'reset'}),actions=el('div',{'class':'bt-actions'});
 const work=el('section',{'class':'bt-work','aria-label':'実行状況と結果'}),status=el('p',{role:'status','aria-live':'polite','aria-atomic':'true','class':'bt-status',tabindex:'-1'}),cancel=el('button',{type:'button',text:'計算を中止','data-action':'cancel'}),runtimeError=el('p',{role:'alert','class':'bt-error'}),retry=el('button',{type:'button',text:'ファイルの準備をやり直す','data-action':'retry'});
 const result=el('section',{'class':'bt-result','aria-label':'計算結果'}),resultTitle=el('h3',{'class':'bt-result-title'}),resultStatus=el('p',{'class':'bt-result-status',role:'status','aria-live':'off','aria-atomic':'true',tabindex:'-1'}),equation=el('p',{'class':'bt-equation'}),residualText=el('p',{'class':'bt-residual'}),reasonText=el('p',{'class':'bt-stop-reason'});
 const copy=el('button',{type:'button',text:'結果をコピー','data-action':'copy'}),copyActions=el('div',{'class':'bt-copy-actions'}),copyStatus=el('p',{role:'status','class':'bt-help bt-copy-status'}),resultBody=el('div',{'class':'bt-result-body',role:'group',tabindex:'-1','aria-label':'結果本文（全桁・計算状態・因子判定）'});copyActions.append(copy);copyStatus.hidden=true;

 const progressView=createProgressView(doc,prefix,{stageElement:status});
 const proof=el('details',{'class':'bt-proof'}),factorList=el('ul',{'class':'bt-factor-list'});proof.append(el('summary',{text:'因子ごとの判定理由'}),factorList);
 const metrics=el('section',{'class':'bt-metrics','aria-label':'実測結果'}),metricList=el('dl'),metricRow=el('div'),elapsedLabel=el('dt',{id:'elapsed-label',text:'実経過'}),elapsed=el('dd',{'data-elapsed':'','aria-labelledby':elapsedLabel.id});metricRow.append(elapsedLabel,elapsed);metricList.append(metricRow);metrics.append(metricList);
 const execution=el('details',{'class':'bt-execution'}),measurementNote=el('p',{'class':'bt-help'}),limits=el('dl',{'class':'bt-execution-limits'}),limitsNote=el('p',{'class':'bt-help'});execution.append(el('summary',{text:'実経過の測定範囲・今回の設定上限'}),measurementNote,limits,limitsNote);
 resultBody.append(resultStatus,equation,residualText,reasonText,proof);result.append(resultTitle,resultBody,copyActions,copyStatus,execution);work.append(status,runtimeError,retry,progressView.root,metrics,result);actions.append(start,cancel,reset);fields.append(actions);form.append(work);layout.append(form);
 const note=el('details',{id:'input-rules','class':'bt-limits'}),guidanceList=el('ul',{'class':'bt-guidance-list'});note.append(el('summary',{text:'入力の表記・計算範囲・端末の負荷について'}),guidanceList);
 for(const group of inputGuidance){const item=el('li');item.append(el('strong',{text:group.title}));if(group.items){const list=el('ul');list.append(...group.items.map(text=>el('li',{text})));item.append(list);}item.append(el('p',{text:group.text}));guidanceList.append(item);}

 input.setAttribute('aria-details',note.id);
 root.replaceChildren(layout,note,samples,details);
 let disposed=false,busy=false,prepared=false,session,clock=null,compositionEndTimer=null,currentResources=null,currentCopy='',copyGeneration=0,limitsKey='',lastOutcome=null,activeJob=null,navigateStart=false,composing=false,finishingComposition=false,suppressSubmit=false;
 const samplesModal=createModal(samples),settingsModal=createModal(details,{onClose:reason=>{if(disposed)return;if(reason!=='apply')settingsState.cancel();updateControls();}});
 const clearCompositionTimer=()=>{if(compositionEndTimer!==null){doc.defaultView.clearTimeout(compositionEndTimer);compositionEndTimer=null;}};
 const settings=()=>settingsState.effective();
 const settingsKey=()=>JSON.stringify([settingsState.applied().engine,settings()]);
 const changed=()=>!!lastOutcome&&(input.value!==lastOutcome.raw||settingsKey()!==lastOutcome.settingsKey);
 const updateDraft=()=>{const dirty=!busy&&changed();draftNote.hidden=!dirty;setText(draftNote,dirty?'入力・設定の変更は未実行です。表示中の結果は前回の計算です。':'');if(lastOutcome)resultTitle.textContent=(dirty?'前回：':'')+lastOutcome.input+' の結果';};
 const updateGuidance=()=>{inputLimit.textContent=siteInputLimit(settingsState.applied().engine).text;input.setAttribute('aria-describedby',[inputLimit.id,...(!inputError.hidden?[inputError.id]:[])].join(' '));};
 const updateSummary=()=>{const p=settingsState.plan(),engine=settingsState.applied().engine,name=engine==='standard'?'通常':engine==='wide'?'大メモリ':'高精度';nextPlan.textContent='次の計算：'+name+'・時間上限 '+p.timeBudgetMs/1000+'秒'+(engine==='standard'?'（残る値に応じて方式を選択）':'')+(p.timeBudgetMs>60000?'（小入力は最大60秒）':'');updateGuidance();};
 const updateControls=()=>{const d=settingsState.draft();engine.value=d.engine;mode.value=d.mode;workers.value=d.workers;memory.value=d.memory;time.value=d.time;try{const p=settingsState.validateDraft();estimate.textContent='設定予算：WASM '+p.budgetBytes/1048576+' MiB。計画上限 '+p.workers+' Worker・WASM '+p.totalWasmBytes/1048576+' MiB。小入力は通常経路を使い、WASMを使わない場合もあります。使用量の測定値ではありません。';}catch{estimate.textContent=settingsModal.isOpen()?'Worker数・WASM予算・時間上限の組み合わせを確認してください。':'';}
  for(const option of time.children)option.hidden=option.disabled=Number(option.value)>(d.engine==='wide'?3600000:d.engine==='optimized'?600000:60000);for(const option of memory.children)option.hidden=option.disabled=d.engine!=='wide'&&Number(option.value)===1536;for(const option of workers.children)option.hidden=option.disabled=d.engine==='wide'&&Number(option.value)>5;
  modeField.hidden=d.engine==='standard'||d.engine==='wide';workerField.hidden=memoryField.hidden=d.engine==='standard'||d.mode==='auto';memoryField.hidden=memoryField.hidden||d.engine==='wide';mode.disabled=busy||d.engine==='standard'||d.engine==='wide';workers.disabled=memory.disabled=busy||d.engine==='standard'||d.mode!=='manual';applicability.textContent=d.engine==='standard'?'通常は自動配分の共通探索です。残る値と予算で方式を選びます。手動配分は高精度・大メモリで選べます。':d.engine==='wide'?'大メモリはWASM予算1536 MiB固定です。333〜400bitのSIQSは実験的・全分解未検証です。':d.mode==='auto'?'自動配分中です。手動配分に切り替えると保存済みのWorker数・WASM予算を変更できます。':'手動配分です。自動へ切り替えても入力した設定を保持します。';
 };
 const modalOpen=()=>samplesModal.isOpen()||settingsModal.isOpen();
 const openSettings=(error=null)=>{if(busy||modalOpen())return;copyGeneration++;settingsState.begin();settingsError.hidden=!error;settingsError.textContent=error??'';updateControls();if(!settingsModal.show(settingsSummary,settingsTitle)){settingsState.cancel();status.textContent='このブラウザでは設定画面を開けません。';}else if(error)settingsError.focus({preventScroll:true});};
 const stopClock=()=>{if(clock!==null){doc.defaultView.clearInterval(clock);clock=null;}};
 const showActual=()=>{const p=executionPresentation(currentResources,busy?session?.getElapsedMs()??0:currentResources?.elapsedMs??0);metrics.hidden=execution.hidden=!p;if(!p)return;elapsed.textContent=p.elapsed;measurementNote.textContent=p.measurementNote;const key=JSON.stringify(p.limits);if(key!==limitsKey){limitsKey=key;limits.replaceChildren(...p.limits.map(([label,value])=>{const row=el('div');row.append(el('dt',{text:label}),el('dd',{text:value}));return row;}));limitsNote.textContent=p.limitsNote;}};

 const render=s=>{
  if(disposed)return;const cancelFocused=doc.activeElement===cancel,statusFocused=doc.activeElement===status;if(s.phase==='loading')prepared=false;if(s.phase==='ready')prepared=true;busy=['loading','running','cancelling','blocked'].includes(s.phase);
  input.readOnly=busy;for(const n of [...sampleButtons,engine,time,sampleSummary,settingsSummary,settingsApply])n.disabled=busy;updateControls();
  start.disabled=busy||!prepared||s.phase==='unprepared';reset.disabled=busy;cancel.disabled=s.phase!=='running';cancel.hidden=!['running','cancelling'].includes(s.phase);retry.hidden=s.errorField!=='load';
  start.textContent=s.phase==='loading'?'準備中…':s.phase==='running'?'計算中…':s.phase==='cancelling'?'中止中…':'分解する';
  inputError.hidden=s.errorField!=='input';runtimeError.hidden=!s.error||!['load','runtime'].includes(s.errorField);inputError.textContent=inputError.hidden?'':s.error;runtimeError.textContent=runtimeError.hidden?'':s.error;input.setAttribute('aria-invalid',String(!inputError.hidden));
  for(const n of [engine,mode,workers,memory,time])n.setAttribute('aria-describedby',settingsError.id);
  if(['error','blocked','invalid','ready'].includes(s.phase))activeJob=null;
  if(s.phase==='running')activeJob={raw:input.value,settingsKey:settingsKey()};
  if(s.view){lastOutcome={input:s.input,view:s.view,...activeJob??{raw:input.value,settingsKey:settingsKey()},resources:s.resources};activeJob=null;}
  const progressSnapshot=['running','cancelling','result','blocked','error'].includes(s.phase)?s.progress:null;
  progressView.update(progressSnapshot??null);
  if(!progressSnapshot)setText(status,s.phase==='loading'?'必要なファイルを準備しています。':s.phase==='running'?'計算しています。':s.phase==='cancelling'?'中止してWorkerを解放しています。':s.phase==='blocked'?'解放を確認できないため次の計算を開始できません。':s.phase==='invalid'?(s.errorField==='input'?'実行していません。入力を修正してください。':s.errorField==='settings'?'実行していません。実行条件を修正してください。':'まだ開始できません。下の実行状況を確認してください。'):s.phase==='error'?'計算または準備を完了できませんでした。':'');
  const stoppedView=s.phase==='blocked'&&!!s.view;
  root.dataset.phase=s.phase;result.hidden=busy&&!stoppedView||!lastOutcome;
  if(lastOutcome){const p=sitePresentation(lastOutcome.view);resultTitle.textContent=lastOutcome.input+' の結果';resultStatus.setAttribute('aria-live',s.phase==='result'?'polite':'off');setText(resultStatus,result.hidden?'':lastOutcome.view.statusText);equation.textContent=p.equation;currentCopy=p.copyText;factorList.replaceChildren(...p.factorRows.map(row=>{const item=el('li');item.append(el('span',{text:row.text}),el('p',{'class':'bt-factor-reason',text:row.reason}));return item;}));proof.hidden=!p.factorRows.length;residualText.textContent=p.residual!==null?'未解決の余因子：'+p.residual:'';residualText.hidden=!residualText.textContent;reasonText.textContent=p.reasonText;reasonText.hidden=!reasonText.textContent;}else currentCopy='';
  copy.disabled=!currentCopy||busy&&!stoppedView;copyGeneration++;copyStatus.textContent='';copyStatus.hidden=true;currentResources=['running','cancelling'].includes(s.phase)?s.resources:busy&&!stoppedView?null:lastOutcome?.resources??null;showActual();updateSummary();updateDraft();
  if(['running','cancelling'].includes(s.phase)){if(clock===null&&doc.defaultView)clock=doc.defaultView.setInterval(showActual,100);}else stopClock();
  if(navigateStart&&s.phase==='running'){navigateStart=false;status.focus({preventScroll:true});status.scrollIntoView({block:'center',behavior:'instant'});}
  else if(navigateStart&&s.phase==='invalid'){navigateStart=false;if(s.errorField==='settings')openSettings(s.error);else if(!inputError.hidden){input.focus({preventScroll:true});inputError.scrollIntoView({block:'center',behavior:'instant'});}else{status.focus({preventScroll:true});runtimeError.scrollIntoView({block:'center',behavior:'instant'});}}
  else if(s.phase==='result'&&(statusFocused||cancelFocused))resultStatus.focus({preventScroll:true});
  else if((cancel.hidden||s.phase==='cancelling')&&cancelFocused)status.focus({preventScroll:true});
 };
 const prepare=()=>session.prepare(settingsState.applied().engine);
 const makeSession=(restoreReset=false)=>{prepared=false;session=createSiteSession({...sessionOptions,loadLight:async()=>{await prepareSiteFonts(root);return sessionOptions.loadLight?sessionOptions.loadLight():lightModule;},scope,hints,onChange:render});render(session.getState());void prepare().then(()=>{if(restoreReset&&!disposed&&!reset.disabled)reset.focus({preventScroll:true});});};
 listen(form,'submit',e=>{e.preventDefault();if(modalOpen()||composing||suppressSubmit||busy||!prepared)return;navigateStart=true;void session.start(input.value,settings()).then(()=>{navigateStart=false;});});
 listen(input,'compositionstart',()=>{composing=true;});listen(input,'compositionend',()=>{clearCompositionTimer();finishingComposition=composing;composing=false;if(finishingComposition)compositionEndTimer=doc.defaultView.setTimeout(()=>{finishingComposition=false;compositionEndTimer=null;},0);});
 listen(input,'keydown',e=>{if(e.key==='Enter'){suppressSubmit=composing||finishingComposition||e.isComposing||e.keyCode===229||e.repeat;if(suppressSubmit)e.preventDefault();}else finishingComposition=false;});listen(input,'keyup',e=>{if(e.key==='Enter')suppressSubmit=finishingComposition=false;});listen(input,'blur',()=>{clearCompositionTimer();composing=finishingComposition=suppressSubmit=false;});
 listen(input,'input',()=>{if(!busy){inputError.hidden=true;input.setAttribute('aria-invalid','false');updateGuidance();updateDraft();}});
 sampleButtons.forEach((button,i)=>listen(button,'click',()=>{if(!busy&&samplesModal.isOpen()){input.value=sampleInputs[i].value;inputError.hidden=true;input.setAttribute('aria-invalid','false');updateGuidance();updateDraft();samplesModal.close('select',start);start.scrollIntoView({block:'nearest',behavior:'instant'});}}));
 listen(copy,'click',async()=>{if(!currentCopy)return;const generation=++copyGeneration,text=currentCopy;let clipboard;try{clipboard=doc.defaultView?.navigator?.clipboard;}catch{}const ok=await copyResult(text,clipboard);if(disposed||generation!==copyGeneration)return;copyStatus.hidden=false;if(ok)copyStatus.textContent='この結果と計算状態をコピーしました。';else{proof.open=!proof.hidden;resultBody.focus({preventScroll:true});const selection=doc.defaultView?.getSelection?.();if(selection&&doc.createRange){const range=doc.createRange();range.selectNodeContents(resultBody);selection.removeAllRanges();selection.addRange(range);copyStatus.textContent='自動コピーを利用できません。選択した結果本文を手動でコピーしてください。';}else copyStatus.textContent='自動コピーを利用できません。結果本文を長押し、または選択して手動でコピーしてください。';}});
 listen(cancel,'click',()=>session.cancel());listen(retry,'click',()=>{const restore=doc.activeElement===retry;void prepare().then(()=>{if(restore&&!disposed)(prepared?start:retry).focus({preventScroll:true});});});
 listen(reset,'click',()=>{session.dispose();lastOutcome=activeJob=null;currentCopy='';input.value='';makeSession(true);});

 listen(sampleSummary,'click',()=>{if(!busy&&!modalOpen()){copyGeneration++;if(!samplesModal.show(sampleSummary,sampleTitle))status.textContent='このブラウザでは入力例を開けません。';}});listen(sampleClose,'click',()=>samplesModal.close());listen(settingsSummary,'click',()=>openSettings());listen(settingsClose,'click',()=>settingsModal.close());listen(settingsCancel,'click',()=>settingsModal.close());
 listen(settingsApply,'click',()=>{if(busy||!settingsModal.isOpen())return;try{settingsState.apply();}catch{settingsError.hidden=false;settingsError.textContent='Worker数・WASM予算・時間上限の組み合わせを修正してください。まだ適用していません。';settingsError.focus({preventScroll:true});return;}settingsError.hidden=true;updateSummary();updateDraft();settingsModal.close('apply',status);void prepare().then(()=>{if(!disposed&&prepared&&doc.activeElement===status)start.focus({preventScroll:true});});});
 listen(engine,'change',()=>{if(settingsModal.isOpen()){settingsState.edit('engine',engine.value);settingsError.hidden=true;updateControls();}});
 for(const[key,n]of [['mode',mode],['workers',workers],['memory',memory],['time',time]])listen(n,'change',()=>{if(settingsModal.isOpen()){settingsState.edit(key,n.value);settingsError.hidden=true;updateControls();}});
 updateControls();makeSession();
 const dispose=()=>{if(disposed)return;disposed=true;copyGeneration++;progressView.dispose();stopClock();clearCompositionTimer();samplesModal.dispose();settingsModal.dispose();session.dispose();lastOutcome=activeJob=null;currentCopy='';for(const remove of listeners)remove();root.replaceChildren();root.dataset.phase='disposed';};
 if(doc.defaultView)listen(doc.defaultView,'pagehide',dispose);
 return{dispose,getState:()=>session.getState()};
}
