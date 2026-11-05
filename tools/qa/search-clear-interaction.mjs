import assert from 'node:assert/strict';

export async function verifySearchClearInteraction({send,evaluate,until,origin,audit,screenshot,socket}) {
 // The shared release tab may already be at Chromium's bounded history size after tag pagination.
 // Isolate this scenario while keeping the strict push/replace and real back/forward assertions.
 await send('Page.resetNavigationHistory');
 const frames=[],actions=[];
 const paint=()=>evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
 const go=async(path='/search/?q=3Dプリンタ&tag=fdm')=>{await send('Page.navigate',{url:origin+path});await until(()=>evaluate('document.readyState==="complete"&&Boolean(document.querySelector(".tag-search-form:not([hidden])"))'),'Clear page ready');await evaluate('document.fonts.ready');await paint();};
 const key=async(key,code,vk,text='')=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,text});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk});};
 const state=()=>evaluate(`(()=>{const u=new URL(location.href);return {q:u.searchParams.get('q'),tag:u.searchParams.get('tag'),tagPage:u.searchParams.get('tagPage'),keyword:document.querySelector('#search-query').value,tagValue:document.querySelector('#tag-query').value,resultCount:document.querySelectorAll('#search-results a').length,tagCount:document.querySelectorAll('#tag-results li').length,history:history.length,focus:document.activeElement.id,busy:document.querySelector('#search-results').getAttribute('aria-busy'),headerValue:document.querySelector('#header-search-query')?.value};})()`);
 const buttonSelector=id=>`#${id} + button[type=reset]`;
 const pointer=async id=>{const point=await evaluate(`(()=>{const button=document.querySelector(${JSON.stringify(buttonSelector(id))});button.scrollIntoView({block:'center'});const r=button.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});};
 const clearState=async id=>{await until(()=>evaluate(`document.querySelector('#${id}').value===''&&document.activeElement.id==='${id}'`),'Clear and return focus');const s=await state();if(id==='search-query'){assert.equal(s.q,null);assert.equal(s.resultCount,0);assert.equal(s.busy,'false');assert.equal(s.headerValue,'');}else{assert.equal(s.tag,null);assert.equal(s.tagPage,null);}return s;};
 const nodes=node=>[node,...(node.children??[]).flatMap(nodes),...(node.shadowRoots??[]).flatMap(nodes)];
 const attr=(node,name)=>{const i=node.attributes?.indexOf(name)??-1;return i<0?undefined:node.attributes[i+1];};
 for(const width of [320,390,1440])for(const scale of [100,200]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await go();await until(()=>evaluate('Boolean(document.querySelector("#search-results img"))'),'Current query results');
  await evaluate('document.documentElement.style.fontSize='+JSON.stringify(scale+'%'));await paint();
  const dom=nodes((await send('DOM.getDocument',{depth:-1,pierce:true})).root),ax=await send('Accessibility.getFullAXTree');
  const fields=[];
  for(const[id,name,clearName]of [['search-query','キーワード','検索語をクリア'],['tag-query','タグ名・別名','タグの絞り込みをクリア']]){
   const node=dom.find(n=>attr(n,'id')===id);assert.equal(attr(node,'type'),'text');assert.equal(attr(node,'role'),'searchbox');
   assert.ok(!/search-cancel-button|search-clear/u.test(JSON.stringify(node.shadowRoots??[])),'No native search cancel control in user-agent DOM');
   const accessible=ax.nodes.find(n=>n.backendDOMNodeId===node.backendNodeId&&!n.ignored);assert.equal(accessible?.role?.value,'searchbox');assert.equal(accessible?.name?.value,name);
   assert.equal(ax.nodes.filter(n=>!n.ignored&&n.role?.value==='button'&&n.name?.value===clearName).length,1,'Exactly one named clear operation');
   const box=await evaluate(`(()=>{const input=document.querySelector('#${id}'),button=input.nextElementSibling,r=input.getBoundingClientRect(),b=button.getBoundingClientRect(),s=getComputedStyle(input);return{buttons:input.parentElement.querySelectorAll('button').length,labelText:button.textContent.trim(),name:button.getAttribute('aria-label'),width:b.width,height:b.height,inside:b.left>=r.left&&b.right<=r.right+1&&b.top>=r.top-1&&b.bottom<=r.bottom+1,contentWidth:r.width-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight)-2,visible:getComputedStyle(button).visibility};})()`);
   assert.equal(box.buttons,1);assert.equal(box.labelText,'');assert.equal(box.name,clearName);assert.ok(box.width>=44&&box.height>=44&&box.inside);assert.ok(box.contentWidth>=32,'Input text remains readable beside clear');assert.equal(box.visible,'visible');fields.push({id,...box});
  }
  assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);await audit(`single clear ${width}/${scale}`);
  await evaluate('scrollTo(0,0)');await screenshot(`search-single-clear-${width}-${scale}.png`);
  await evaluate('document.querySelector("#tag-query").scrollIntoView({block:"center"})');await screenshot(`tag-single-clear-${width}-${scale}.png`);
  const before=await state();await pointer('search-query');const cleared=await clearState('search-query');assert.equal(cleared.tag,'fdm');assert.equal(cleared.history,before.history+1);
  await evaluate('history.back()');await until(()=>evaluate('document.querySelector("#search-query").value==="3Dプリンタ"&&Boolean(document.querySelector("#search-results a"))'),'Back restores cleared keyword');
  await evaluate('history.forward()');await until(()=>evaluate('document.querySelector("#search-query").value===""&&!document.querySelector("#search-results a")'),'Forward restores cleared keyword');
  frames.push({width,scale,fields});
 }
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:false});
 for(const id of ['search-query','tag-query'])for(const action of ['pointer','Enter','Space','Escape']){
  await go('/search/?q=3Dプリンタ&tag=fdm&tagPage=2#tags');await until(()=>evaluate('Boolean(document.querySelector("#search-results a"))'),'Result before clear');
  await evaluate(`window.__clearEvents=[];for(const input of document.querySelectorAll('#search-query,#tag-query'))for(const type of ['input','search','compositionstart','compositionend'])input.addEventListener(type,event=>window.__clearEvents.push({type,id:input.id,value:input.value,trusted:event.isTrusted}));for(const form of document.querySelectorAll('#search-form,.tag-search-form'))form.addEventListener('reset',event=>window.__clearEvents.push({type:'reset',id:form.id||'tag-form',trusted:event.isTrusted}));`);
  const before=await state();
  if(action==='pointer')await pointer(id);else{await evaluate(`document.querySelector('#${id}').focus()`);if(action!=='Escape'){await key('Tab','Tab',9);assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'),id==='search-query'?'検索語をクリア':'タグの絞り込みをクリア');assert.equal(await evaluate('document.activeElement.matches(":focus-visible")&&getComputedStyle(document.activeElement).outlineWidth==="3px"'),true);if(action==='Enter')await screenshot('clear-focus-'+id+'.png');}await key(action==='Space'?' ':action,action,action==='Space'?32:action==='Escape'?27:13,action==='Space'?' ':action==='Enter'?'\r':'');}
  const after=await clearState(id);if(id==='tag-query'){assert.equal(after.q,'3Dプリンタ');assert.equal(after.resultCount,1);assert.equal(after.history,before.history);}else assert.equal(after.tag,'fdm');
  const button=await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(buttonSelector(id))});return {disabled:b.disabled,visibility:getComputedStyle(b).visibility};})()`);assert.equal(button.disabled,true);assert.equal(button.visibility,'hidden');
  const ax=await send('Accessibility.getFullAXTree');assert.equal(ax.nodes.some(n=>!n.ignored&&n.role?.value==='button'&&n.name?.value===(id==='search-query'?'検索語をクリア':'タグの絞り込みをクリア')),false);
  const events=await evaluate('window.__clearEvents');assert.equal(events.filter(e=>e.type==='reset').length,1,'One reset per clear action');actions.push({id,action,before,after,events});
 }
 // Actual Chromium composition, rather than assuming Enter/Escape are ordinary keystrokes during IME.
 for(const[id,text]of [['search-query','素因数'],['tag-query','設計']]){
  await go(id==='search-query'?'/search/?tag=fdm':'/search/?q=3Dプリンタ');await evaluate(`window.__imeResets=0;document.querySelector('#${id}').form.addEventListener('reset',()=>window.__imeResets++);document.querySelector('#${id}').focus()`);
  await send('Input.imeSetComposition',{text,selectionStart:text.length,selectionEnd:text.length});await key('Escape','Escape',27);assert.equal(await evaluate('window.__imeResets'),0,'Active composition Escape does not invoke clear');
  await go(id==='search-query'?'/search/?tag=fdm':'/search/?q=3Dプリンタ');await evaluate(`window.__imeResets=0;document.querySelector('#${id}').form.addEventListener('reset',()=>window.__imeResets++);document.querySelector('#${id}').focus()`);
  await send('Input.imeSetComposition',{text,selectionStart:text.length,selectionEnd:text.length});await key('Enter','Enter',13,'\r');assert.equal(await evaluate('window.__imeResets'),0);
  assert.equal(await evaluate(`new URL(location.href).searchParams.get('${id==='search-query'?'q':'tag'}')`),null,'Preedit Enter does not submit');
  await send('Input.insertText',{text});await until(()=>evaluate(`new URL(location.href).searchParams.get('${id==='search-query'?'q':'tag'}')===${JSON.stringify(text)}`),'IME commit updates only the committed query');
  await key('Escape','Escape',27);await clearState(id);assert.equal(await evaluate('window.__imeResets'),1);
 }
 let paused,networkId,finished=false;const listener=event=>{const m=JSON.parse(event.data);if(m.method==='Fetch.requestPaused'){paused=m.params.requestId;networkId=m.params.networkId;}if(m.method==='Network.loadingFinished'&&m.params.requestId===networkId)finished=true;};socket.addEventListener('message',listener);
 try{await send('Fetch.enable',{patterns:[{urlPattern:'*/search/search-index.json',requestStage:'Request'}]});await go('/search/?q=3Dプリンタ&tag=fdm');await until(()=>Boolean(paused),'Pending index');await pointer('search-query');await clearState('search-query');await send('Fetch.continueRequest',{requestId:paused});await until(()=>finished,'Cancelled query load completes');await paint();assert.equal((await state()).resultCount,0);assert.equal((await state()).q,null);}finally{await send('Fetch.disable');socket.removeEventListener('message',listener);}
 return {frames,actions,ime:'Chromium composition Enter/commit/Escape PASS',pending:'Clearing pending keyword prevents late results',native:'Text input + searchbox role; no UA search cancel button'};
}
