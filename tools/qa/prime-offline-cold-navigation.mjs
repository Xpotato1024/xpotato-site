import assert from 'node:assert/strict';

// Hold the actual calculator module, not a synthetic replacement DOM. The site
// script and native fragment navigation remain unchanged while hydration waits.
export async function verifyColdPrimeGuideNavigation({send,evaluate,until,socket,origin,screenshot}) {
  const reports=[],pending=new Set();
  let preload,currentCase='setup';
  const state=()=>evaluate(`(()=>{const rect=s=>document.querySelector(s)?.getBoundingClientRect().toJSON(),r=rect('[data-prime-offline-save]');return {hash:location.hash,open:document.querySelector('.prime-offline details')?.open,button:r,headerBottom:Math.max(0,rect('.header-band')?.bottom??0),height:innerHeight,scrollY,hydrating:Boolean(document.querySelector('astro-island[ssr]')),phase:document.querySelector('.bt-prime-factorizer')?.dataset.phase??null,corrections:window.__primeGuideCorrections??0};})()`);
  const listener=event=>{const message=JSON.parse(String(event.data));if(message.method==='Fetch.requestPaused')pending.add(message.params.requestId);};
  const release=async()=>{for(const requestId of [...pending]){pending.delete(requestId);await send('Fetch.continueRequest',{requestId});}};
  const arrived=async()=>until(async()=>{const s=await state();return s.open&&s.hash==='#prime-offline-guide'&&s.button.top>=s.headerBottom&&s.button.bottom<=s.height;},'Cold guide stays visible: '+currentCase);
  socket.addEventListener('message',listener);
  try {
    preload=await send('Page.addScriptToEvaluateOnNewDocument',{source:`new MutationObserver((_,observer)=>{if(document.documentElement){document.documentElement.style.fontSize='200%';observer.disconnect();}}).observe(document,{childList:true});window.__primeGuideCorrections=0;const scroll=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(...args){if(this.id==='prime-offline-guide')window.__primeGuideCorrections++;return scroll.apply(this,args);};`});
    await send('Network.setCacheDisabled',{cacheDisabled:true});
    for(const action of ['click','fragment','manual-scroll']) {
      currentCase='320px-200percent-'+action;
      console.log('Prime cold guidance START: '+currentCase);
      await send('Emulation.setDeviceMetricsOverride',{width:320,height:1000,deviceScaleFactor:1,mobile:false});
      await send('Page.navigate',{url:'about:blank'});
      await until(()=>evaluate('location.href==="about:blank"'),'Cold guidance fresh document');
      await send('Fetch.enable',{patterns:[{urlPattern:'*/_astro/PrimeFactorizer.*.js',resourceType:'Script',requestStage:'Request'}]});
      await send('Page.navigate',{url:origin+'/tools/prime-factorizer/'+(action==='fragment'?'#prime-offline-guide':'')});
      await until(()=>evaluate('document.readyState==="complete" && Boolean(document.querySelector("[data-prime-offline-guide-link]"))'),'Cold guidance markup');
      await evaluate("document.fonts.ready");
      // Text size is set before document layout. Direct fragments use the native initial navigation.
      assert.equal(await evaluate('getComputedStyle(document.documentElement).fontSize'),'32px','Initial 200% text size is active');
      if(action!=='fragment') {
        await evaluate("document.querySelector('[data-prime-offline-guide-link]').scrollIntoView({block:'center'})");
        const point=await evaluate("(()=>{const r=document.querySelector('[data-prime-offline-guide-link]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
        await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
        await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
      }
      await until(()=>pending.size>0,'Actual Prime module is held: '+currentCase);
      await arrived();
      const before=await state();assert.equal(before.hydrating,true,'The click must precede calculator hydration');
      if(action==='manual-scroll') {
        await send('Input.dispatchMouseEvent',{type:'mouseWheel',x:160,y:700,deltaX:0,deltaY:180});
        await until(async()=>(await state()).scrollY!==before.scrollY,'User wheel scroll reaches the page');
      }
      await release();
      await until(()=>evaluate("document.querySelector('.bt-prime-factorizer')?.dataset.phase==='ready'"),'Actual cold calculator ready: '+currentCase);
      await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      if(action!=='manual-scroll')await arrived();
      const after=await state();
      if(action==='manual-scroll')assert.equal(after.corrections,0,'No correction after manual scrolling');
      else assert.ok(after.corrections<=1,'At most one hydration correction; native anchoring may already preserve the target');
      assert.equal(after.open,true);assert.equal(after.hash,'#prime-offline-guide');
      reports.push({case:currentCase,before,after});
      await screenshot('prime-offline-cold-'+action+'.png');
      await send('Fetch.disable');
    }
    return reports;
  } catch(error) {
    const observed=await state().catch(()=>null);
    await screenshot('prime-offline-cold-failure.png').catch(()=>{});
    throw new Error('Cold Prime guidance failed: '+JSON.stringify({case:currentCase,pending:pending.size,state:observed}),{cause:error});
  } finally {
    await release();await send('Fetch.disable');
    if(preload)await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:preload.identifier});
    socket.removeEventListener('message',listener);
  }
}
