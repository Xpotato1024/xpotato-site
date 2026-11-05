import assert from 'node:assert/strict';

export async function verifySearchLayoutInteraction({send,evaluate,until,origin,audit,screenshot,socket}) {
 const reports=[];
 const go=async path=>{await send('Page.navigate',{url:origin+path});await until(()=>evaluate('document.readyState==="complete"&&Boolean(document.querySelector(".tag-search-form:not([hidden])"))'),'Search page ready');await evaluate('document.fonts.ready');};
 const enter=async()=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});};
 const query=async value=>{await evaluate('document.querySelector("#search-query").value="";document.querySelector("#search-query").focus()');await send('Input.insertText',{text:value});await enter();};
 for(const width of [320,390,1440])for(const scale of [100,200]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  await go('/search/');await evaluate('document.documentElement.style.fontSize='+JSON.stringify(scale+'%'));
  const initial=await evaluate(`(()=>{const form=document.querySelector('#search-form'),input=form.querySelector('input'),submit=form.querySelector('[type=submit]'),clear=form.querySelector('[type=reset]'),r=n=>{const a=n.getBoundingClientRect();return {top:a.top,bottom:a.bottom,left:a.left,right:a.right,width:a.width,height:a.height};};return {font:getComputedStyle(document.documentElement).fontSize,overflow:document.documentElement.scrollWidth>innerWidth,input:r(input),submit:r(submit),clear:r(clear),form:r(form),results:r(document.querySelector('.search-results-section')),tags:r(document.querySelector('#tags')),disabled:clear.disabled,headings:[...document.querySelectorAll('main h2')].map(n=>n.textContent),entry:document.querySelector('.search-page-heading a').getAttribute('href')};})()`);
  assert.equal(initial.font,scale===200?'32px':'16px');assert.equal(initial.overflow,false);
  assert.ok(Math.abs(initial.input.top-initial.submit.top)<1,'Input and primary operation share a row');
  assert.ok(initial.input.width>=80);assert.ok([initial.input,initial.submit,initial.clear].every(r=>r.height>=44));
  assert.ok(initial.clear.bottom<=initial.input.top+1,'Clear remains with the field label');
  assert.ok(initial.results.top>initial.form.bottom&&initial.tags.top>initial.results.bottom,'Controls, results and tag exploration remain distinct');
  assert.equal(initial.disabled,true);assert.deepEqual(initial.headings,['検索結果','タグから探す']);assert.equal(initial.entry,'#tags');
  await audit(`search initial ${width}/${scale}`);await screenshot(`search-layout-initial-${width}-${scale}.png`);
  await query('3Dプリンタ');await until(()=>evaluate('Boolean(document.querySelector("#search-results .search-result-thumbnail"))'),'Enter searches');
  assert.equal(await evaluate('document.querySelector("#search-results").getAttribute("aria-busy")'),'false');
  await evaluate('scrollTo(0,0)');await audit(`search results ${width}/${scale}`);await screenshot(`search-layout-results-${width}-${scale}.png`);
  await evaluate('document.querySelector("#search-form [type=reset]").click()');
  await until(()=>evaluate('document.querySelector("#search-query").value===""&&!document.querySelector("#search-results a")'),'Clear search');
  assert.equal(await evaluate('document.activeElement.id'),'search-query');assert.equal(await evaluate('document.querySelector("#search-form [type=reset]").disabled'),true);
  await query('zzzz-no-match-987654321');await until(()=>evaluate('document.querySelector("#search-status").textContent.includes("一致する結果はありません")'),'Zero matches');
  assert.equal(await evaluate('document.querySelectorAll("#search-results a").length'),0);
  await screenshot(`search-layout-zero-${width}-${scale}.png`);
  await go('/search/?q=3Dプリンタ&tag=fdm#tags');await evaluate('document.documentElement.style.fontSize='+JSON.stringify(scale+'%'));
  await until(()=>evaluate('document.querySelectorAll("#tag-results li").length===1'),'Alias deep link');
  assert.equal(await evaluate('document.querySelector("#tag-query").value'),'fdm');
  assert.equal(await evaluate('new URL(location.href).searchParams.get("q")'),'3Dプリンタ');
  await evaluate('document.querySelector("#tags").scrollIntoView()');
  const tags=await evaluate(`(()=>{const heading=document.querySelector('#tag-heading').getBoundingClientRect();return {top:heading.top,header:document.querySelector('.header-band').getBoundingClientRect().bottom,overflow:document.documentElement.scrollWidth>innerWidth,targets:[...document.querySelectorAll('#tags input,#tags button:not([hidden]),#tags a')].filter(n=>n.getBoundingClientRect().width).map(n=>n.getBoundingClientRect().height)};})()`);
  assert.ok(tags.top>=tags.header-1,'Tag anchor remains clear of sticky header');assert.equal(tags.overflow,false);assert.ok(tags.targets.every(h=>h>=44));
  await audit(`search tags ${width}/${scale}`);await screenshot(`search-layout-tags-${width}-${scale}.png`);
  reports.push({width,scale,initial,tags});
 }
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:false});await go('/search/');
 await query('3Dプリンタ');await until(()=>evaluate('Boolean(document.querySelector("#search-results img"))'),'Image query');
 await query('素因数');await until(()=>evaluate('[...document.querySelectorAll("#search-results a")].some(a=>a.pathname==="/tools/prime-factorizer/")'),'Second query');
 await evaluate('history.back()');await until(()=>evaluate('document.querySelector("#search-query").value==="3Dプリンタ"&&Boolean(document.querySelector("#search-results img"))'),'Back restores results');
 await evaluate('history.forward()');await until(()=>evaluate('document.querySelector("#search-query").value==="素因数"&&!document.querySelector("#search-results img")'),'Forward restores results');
 let request;const listener=event=>{const message=JSON.parse(event.data);if(message.method==='Fetch.requestPaused')request=message.params.requestId;};
 socket.addEventListener('message',listener);
 try{
  await send('Fetch.enable',{patterns:[{urlPattern:'*/search/search-index.json',requestStage:'Request'}]});
  await go('/search/?q=3Dプリンタ');await until(()=>Boolean(request),'Paused search index');
  assert.equal(await evaluate('document.querySelector("#search-status").textContent'),'検索しています…');assert.equal(await evaluate('document.querySelector("#search-results").getAttribute("aria-busy")'),'true');
  await screenshot('search-layout-loading.png');await send('Fetch.failRequest',{requestId:request,errorReason:'Failed'});request=undefined;
  await until(()=>evaluate('document.querySelector("#search-status").textContent.includes("読み込めませんでした")'),'Network error state');
  assert.equal(await evaluate('document.querySelector("#search-results").getAttribute("aria-busy")'),'false');await screenshot('search-layout-unavailable.png');
 }finally{await send('Fetch.disable');socket.removeEventListener('message',listener);}
 await query('3Dプリンタ');await until(()=>evaluate('Boolean(document.querySelector("#search-results img"))'),'Retry after error');
 return {reports,history:'back/forward PASS',states:'initial/loading/result/zero/clear/error/retry PASS'};
}
