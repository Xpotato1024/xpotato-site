import assert from 'node:assert/strict';

export async function verifySharedHeaderInteraction({send,evaluate,until,origin}) {
  const records=[];
  const routes=['/about/','/search/','/tools/prime-factorizer/','/articles/77arj41r5z8amrn46pdx71mknr/','/privacy/'];
  const snapshot=()=>evaluate(`(()=>{const h=document.querySelector('.header-band'),s=getComputedStyle(h,'::before');return{surface:h.dataset.menuSurface,position:getComputedStyle(h).position,background:s.backgroundColor,blur:s.backdropFilter,plane:parseFloat(s.height),height:h.getBoundingClientRect().height,home:document.body.classList.contains('home-header-layout'),homeScript:!!document.querySelector('script[src="/scripts/home-header.js"]')}})()`);
  for(const route of routes){
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:origin+route});
    await until(()=>evaluate(`document.readyState==='complete'&&document.querySelector('.header-band')?.dataset.menuSurface==='shared'`),'Shared header '+route);
    const closed=await snapshot();assert.equal(closed.home,false);assert.equal(closed.homeScript,false);assert.equal(closed.position,'sticky');assert.notEqual(closed.blur,'none');assert.ok(Math.abs(closed.plane-closed.height)<1);
    for(const mode of ['popover','details'])for(const scroll of [0,300]){
      await evaluate(`window.scrollTo({top:${scroll},behavior:'instant'});new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
      const selector=mode==='popover'?'#site-menu':'.mobile-menu-fallback nav';
      if(mode==='details')await evaluate(`document.querySelector('.mobile-menu-toggle').style.display='none';document.querySelector('.mobile-menu-fallback').style.display='block'`);
      await evaluate(mode==='popover'?`document.querySelector('#site-menu').showPopover()`:`document.querySelector('.mobile-menu-fallback').open=true`);
      await until(()=>evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector+' > ul')})).opacity==='1'&&document.querySelector('.header-band').dataset.menuVisible==='true'`),'Shared menu opens '+route+'/'+mode);
      const open=await snapshot(),panel=await evaluate(`(()=>{const p=document.querySelector(${JSON.stringify(selector)}),s=getComputedStyle(p);return{background:s.backgroundColor,blur:s.backdropFilter,top:p.getBoundingClientRect().top,bottom:p.getBoundingClientRect().bottom,shadow:s.boxShadow}})()`);
      assert.equal(open.background,closed.background);assert.equal(open.blur,closed.blur);assert.equal(panel.background,'rgba(0, 0, 0, 0)');assert.equal(panel.blur,'none');assert.equal(panel.shadow,'none');assert.ok(Math.abs(panel.top-open.height)<1);assert.ok(Math.abs(open.plane-panel.bottom)<1,'Every route uses one seamless plane');
      for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      const exit=await evaluate(`(()=>{const h=document.querySelector('.header-band'),p=document.querySelector(${JSON.stringify(selector)});window.__sharedExit=h.getAnimations({subtree:true});for(const a of window.__sharedExit){a.pause();a.currentTime=100;}return{panel:Number(getComputedStyle(p).opacity),list:Number(getComputedStyle(p.querySelector('ul')).opacity),plane:parseFloat(getComputedStyle(h,'::before').height),height:h.getBoundingClientRect().height,top:h.getBoundingClientRect().top,scrollY};})()`);
      assert.ok(exit.panel>0&&exit.panel<1,'Every route has a real intermediate menu exit');assert.equal(exit.list,1);assert.ok(exit.plane>exit.height);assert.equal(exit.top,0);
      await evaluate(`(()=>{for(const a of window.__sharedExit)a.finish();delete window.__sharedExit})()`);
      await until(()=>evaluate(`document.querySelector('.header-band').dataset.menuVisible==='false'`),'Shared menu closes '+route+'/'+mode);
      const end=await snapshot();assert.equal(end.background,closed.background);assert.ok(Math.abs(end.plane-end.height)<1);records.push({route,mode,scroll,closed,open,panel,exit,end});
    }
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:844,deviceScaleFactor:1,mobile:false});
    await until(()=>evaluate(`document.querySelector('.header-band').dataset.menuVisible==='false'`),'Desktop shared header');
    const desktop=await snapshot();assert.equal(desktop.background,closed.background);assert.equal(desktop.blur,closed.blur);
  }
  return records;
}
