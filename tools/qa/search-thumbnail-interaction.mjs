import assert from 'node:assert/strict';

export async function verifySearchThumbnailInteraction({send,evaluate,until,origin,audit,screenshot}) {
 const reports=[];
 for(const width of [320,390,1440])for(const scale of [100,200]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:origin+'/search/?q='+encodeURIComponent('3Dプリンタ')});
  await until(()=>evaluate('Boolean(document.querySelector("#search-results .search-result-thumbnail"))'),'Search image result');
  await evaluate('document.documentElement.style.fontSize='+JSON.stringify(scale+'%'));
  await evaluate('document.fonts.ready');
  await evaluate('document.querySelector("#search-results").scrollIntoView()');
  const state=await evaluate(`(()=>{const item=document.querySelector('#search-results li'),link=item.querySelector('a'),img=item.querySelector('img'),box=item.querySelector('.search-result-thumbnail'),heading=item.querySelector('h2'),r=box.getBoundingClientRect();return {links:item.querySelectorAll('a').length,alt:img?.alt,width:img?.width,height:img?.height,hidden:box.getAttribute('aria-hidden'),name:link.textContent,title:heading.textContent,align:getComputedStyle(heading).textAlign,overflow:document.documentElement.scrollWidth>innerWidth,target:link.getBoundingClientRect().height,frame:{width:r.width,height:r.height},picture:item.querySelectorAll('picture source').length};})()`);
  assert.equal(state.links,1);assert.equal(state.alt,'');assert.equal(state.hidden,'true');assert.ok(state.name.includes(state.title));
  assert.ok(state.width>0&&state.height>0&&state.picture>0);assert.ok(state.target>=44);assert.equal(state.overflow,false,`${width}/${scale} search overflow`);
  assert.ok(['start','left'].includes(state.align));assert.ok(Math.abs(state.frame.width/state.frame.height-16/9)<.02);
  await evaluate('document.querySelector("#search-results a").focus()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await audit(`search thumbnail ${width}/${scale}`);
  await screenshot(`search-thumbnail-${width}-${scale}.png`);
  reports.push({width,scale,...state});
 }
 // An actual failed network request exercises fallback while preserving reserved geometry.
 await send('Network.setBlockedURLs',{urls:['*media.xpotato.net/*']});
 await send('Page.navigate',{url:origin+'/search/?q='+encodeURIComponent('3Dプリンタ')});
 await until(()=>evaluate('Boolean(document.querySelector("#search-results .search-result-thumbnail"))'),'Failure result ready');
 const imageUrl=await evaluate('document.querySelector("#search-results img")?.src');
 await send('Network.setBlockedURLs',{urls:[new URL(imageUrl).origin+'/*']});
 await send('Page.reload');
 await until(()=>evaluate('document.querySelector("#search-results .search-result-thumbnail")?.textContent==="画像なし"'),'Unavailable image fallback');
 assert.equal(await evaluate('document.querySelectorAll("#search-results a").length'),1);
 await screenshot('search-thumbnail-unavailable.png');
 await send('Network.setBlockedURLs',{urls:[]});
 await send('Page.navigate',{url:origin+'/search/?q='+encodeURIComponent('素因数')});
 await until(()=>evaluate('[...document.querySelectorAll("#search-results a")].some(a=>a.pathname==="/tools/prime-factorizer/")'),'Non-article result');
 assert.equal(await evaluate('document.querySelectorAll("#search-results img").length'),0);
 await evaluate('document.querySelector("#search-query").value="3Dプリンタ";document.querySelector("#search-form").requestSubmit()');
 await until(()=>evaluate('Boolean(document.querySelector("#search-results .search-result-thumbnail"))'),'Submit image search');
 await evaluate('history.back()');
 await until(()=>evaluate('document.querySelector("#search-query").value==="素因数"&&![...document.querySelectorAll("#search-results img")].length'),'Search history back');
 await evaluate('history.forward()');
 await until(()=>evaluate('document.querySelector("#search-query").value==="3Dプリンタ"&&Boolean(document.querySelector("#search-results .search-result-thumbnail"))'),'Search history forward');
 return {reports,failure:'HTTP blocked image preserves frame and single named link',history:'back/forward PASS',nonArticle:'text only PASS'};
}
