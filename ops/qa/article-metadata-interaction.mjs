import assert from 'node:assert/strict';

// Exercise the real final-dist article. Longer labels are browser-only probes.
export async function verifyArticleMetadata({origin,send,evaluate,until,screenshot}) {
  const route='/articles/77arj41r5z8amrn46pdx71mknr/';
  const reports=[];
  for(const [width,scale] of [[320,100],[390,100],[768,100],[1440,100],[320,200],[390,200]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:'about:blank'});
    await until(()=>evaluate('location.href==="about:blank"'),'Fresh metadata document');
    await send('Page.navigate',{url:origin+route});
    await until(()=>evaluate(`location.pathname===${JSON.stringify(route)} && document.readyState==='complete'`),'Article metadata');
    await evaluate('document.fonts.ready');
    await evaluate(`document.documentElement.style.fontSize='${scale}%'`);
    for(const longLabel of [false,true]) {
      if(longLabel)await evaluate(`document.querySelector('.article-purposes li:last-child a').textContent='トラブルシューティングと非常に長い目的タグの折り返し確認'`);
      const state=await evaluate(`(()=>{
        const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}};
        const purposes=document.querySelector('.article-purposes'),dates=document.querySelector('.article-dates');
        return {purposes:rect(purposes),dates:rect(dates),items:[...dates.children].map(e=>({box:rect(e),whiteSpace:getComputedStyle(e).whiteSpace,time:e.querySelector('time')?.getAttribute('datetime')})),overflow:document.documentElement.scrollWidth>innerWidth+1,purposeOverflow:purposes.scrollWidth>purposes.clientWidth+1};
      })()`);
      assert.equal(state.overflow,false,'No page overflow');
      assert.equal(state.purposeOverflow,false,'Long purpose remains within its row');
      assert.ok(state.dates.top>=state.purposes.bottom,'Dates always follow the purpose row');
      assert.equal(state.items.length,2,'Publication and distinct update retained');
      assert.ok(state.items.every(i=>i.whiteSpace==='nowrap'&&i.time),'Each label/date pair remains intact');
      if(scale===100)assert.ok(Math.abs(state.items[0].box.top-state.items[1].box.top)<1,'Both dates share a row at normal text size');
      await evaluate(`document.querySelector('.blog-metadata').scrollIntoView({block:'center'})`);
      await screenshot(`article-metadata-${width}-${scale}${longLabel?'-long':''}.png`);
      reports.push({width,scale,longLabel,...state});
    }
  }
  await evaluate('document.documentElement.style.removeProperty("font-size")');
  return {status:'PASS',reports};
}
