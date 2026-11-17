import assert from 'node:assert/strict';

// Sample actual CSS transitions, not timer estimates. Called on the final dist.
export async function verifyHomeMenuTransition({evaluate, until, navigate}) {
  const records=[];
  for(const mode of ['popover','details'])for(const openingTime of [null,100,25]){
    const interrupted=openingTime!==null;
    await navigate();
    await evaluate(`window.scrollTo({top:0,behavior:'instant'});${mode==='details'?"document.querySelector('.mobile-menu-toggle').style.display='none';document.querySelector('.mobile-menu-fallback').style.display='block';":''}`);
    await until(()=>evaluate(`document.querySelector('.header-band').dataset.homeHeaderState==='top'`),'Top header before menu transition');
    const selector=mode==='popover'?'#site-menu':'.mobile-menu-fallback nav';
    const open=mode==='popover'?"document.querySelector('#site-menu').showPopover()":"document.querySelector('.mobile-menu-fallback').open=true";
    const close=mode==='popover'?"document.querySelector('#site-menu').hidePopover()":"document.querySelector('.mobile-menu-fallback').open=false";
    // The top-state attribute can precede its style update. Flush and observe
    // the closed surface before opening, otherwise both changes can coalesce
    // and the glass has no transition while the panel uses @starting-style.
    await until(()=>evaluate(`(()=>{const h=document.querySelector('.header-band'),p=document.querySelector(${JSON.stringify(selector)});return Number(getComputedStyle(h,'::before').backgroundColor.match(/[\\d.]+/g)[3])===0&&Number(getComputedStyle(p).opacity)===0&&h.getAnimations({subtree:true}).every(a=>a.playState==='finished'||a.playState==='idle')})()`),'Closed glass and panel baseline before opening');
    await evaluate(open);
    await evaluate(`(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);window.__menuEntry=document.querySelector('.header-band').getAnimations({subtree:true});for(const a of window.__menuEntry){a.pause();a.currentTime=0;}})()`);
    const opening=[];
    if(!interrupted){
      for(const elapsed of [0,25,50,100,150,200]){
        const sample=await evaluate(`(async()=>{for(const a of window.__menuEntry)a.currentTime=${elapsed};await new Promise(requestAnimationFrame);const p=document.querySelector(${JSON.stringify(selector)}),ul=getComputedStyle(p.querySelector('ul'));return{elapsed:${elapsed},panel:Number(getComputedStyle(p).opacity),list:Number(ul.opacity),delay:ul.transitionDelay,duration:ul.transitionDuration}})()`);
        assert.equal(sample.list,1,'Labels have no separate opacity animation');
        assert.equal(parseFloat(sample.delay),0);assert.equal(parseFloat(sample.duration),0);
        if(elapsed===25)assert.ok(sample.panel>.05,'Choices begin appearing in the first 25ms');
        if(elapsed===100)assert.ok(sample.panel>.75,'Choices are legible by 100ms');
        if(elapsed===200)assert.equal(sample.panel,1,'Opening finishes within 200ms');
        opening.push(sample);
      }
      await evaluate(`(()=>{for(const a of window.__menuEntry)a.finish();delete window.__menuEntry})()`);
    }else await evaluate(`(async()=>{for(const a of window.__menuEntry)a.currentTime=${openingTime};await new Promise(requestAnimationFrame);delete window.__menuEntry;})()`);
    const start=await evaluate(`(()=>{const h=document.querySelector('.header-band'),p=document.querySelector(${JSON.stringify(selector)});return{alpha:Number(getComputedStyle(h,'::before').backgroundColor.match(/[\\d.]+/g)[3]),panel:Number(getComputedStyle(p).opacity),list:Number(getComputedStyle(p.querySelector('ul')).opacity)}})()`);
    assert.equal(start.list,1,'Labels are ready throughout the shared panel animation');
    if(interrupted)assert.ok(start.panel>0&&start.panel<1,'Close interrupts the shared surface while labels are already visible');
    // Capture and pause in the close task: a reversal can finish in only 27ms.
    const animations=await evaluate(`(async()=>{${close};getComputedStyle(document.querySelector('.header-band'),'::before').backgroundColor;window.__menuExit=document.querySelector('.header-band').getAnimations({subtree:true});for(const a of window.__menuExit){a.pause();a.currentTime=0;}await new Promise(requestAnimationFrame);return window.__menuExit.map(a=>({property:a.transitionProperty,pseudo:a.effect.pseudoElement,duration:a.effect.getTiming().duration,delay:a.effect.getTiming().delay}));})()`);
    const glass=animations.find(a=>a.property==='background-color'),fade=animations.find(a=>a.property==='opacity'&&a.duration>0);
    assert.ok(glass&&fade&&glass.delay===0&&fade.delay===0&&Math.abs(glass.duration-fade.duration)<.001,'Glass and panel share duration, including CSS reversal shortening');
    assert.ok(fade.duration>0&&fade.duration<=200);
    if(!interrupted)assert.equal(fade.duration,200);
    const samples=[];
    try{
      for(const elapsed of [0,.25,.5,.75,.995].map(fraction=>fraction*fade.duration)){
        const sample=await evaluate(`(async()=>{for(const a of window.__menuExit)a.currentTime=${elapsed};await new Promise(requestAnimationFrame);const h=document.querySelector('.header-band'),p=document.querySelector(${JSON.stringify(selector)}),glass=getComputedStyle(h,'::before');return{elapsed:${elapsed},panel:Number(getComputedStyle(p).opacity),list:Number(getComputedStyle(p.querySelector('ul')).opacity),alpha:Number(glass.backgroundColor.match(/[\\d.]+/g)[3]),plane:parseFloat(glass.height),header:h.getBoundingClientRect().height,menuBottom:p.getBoundingClientRect().bottom,visible:h.dataset.menuVisible};})()`);
        assert.equal(sample.visible,'true','Exit keeps menu timing selected');
        assert.ok(Math.abs(sample.alpha/start.alpha-sample.panel/start.panel)<.015,'Glass and panel fade at the same pace');
        assert.ok(Math.abs(sample.list-start.list)<.015,'Links use only the panel opacity without a second fade');
        assert.ok(sample.plane>sample.header,'Glass plane does not collapse mid-fade');
        samples.push(sample);
      }
    }finally{await evaluate(`(()=>{for(const a of window.__menuExit??[])a.finish();delete window.__menuExit})()`);}
    await until(()=>evaluate(`document.querySelector('.header-band').dataset.menuVisible==='false'`),'Closed menu releases motion timing');
    const end=await evaluate(`(()=>{const h=document.querySelector('.header-band'),s=getComputedStyle(h,'::before');return{alpha:Number(s.backgroundColor.match(/[\\d.]+/g)[3]),plane:parseFloat(s.height),header:h.getBoundingClientRect().height,duration:s.transitionDuration}})()`);
    assert.equal(end.alpha,0);assert.ok(Math.abs(end.plane-end.header)<1);assert.ok(end.duration.split(',').every(value=>parseFloat(value)===.7),'Normal scroll keeps its 700ms transition');
    // A new open during an exit must not be collapsed by the old completion.
    await evaluate(open);await until(()=>evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).opacity==='1'`),'Reopen after sampled close');
    await evaluate(`(async()=>{${close};await new Promise(requestAnimationFrame);${open};})()`);
    await until(()=>evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).opacity==='1'&&document.querySelector('.header-band').dataset.menuVisible==='true'&&document.querySelector('.header-band').getAnimations({subtree:true}).every(a=>a.playState==='finished'||a.playState==='idle')`),'Interrupted close reopens and settles');
    const reopened=await evaluate(`(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const h=document.querySelector('.header-band'),p=document.querySelector(${JSON.stringify(selector)});return{visible:h.dataset.menuVisible,plane:parseFloat(getComputedStyle(h,'::before').height),header:h.getBoundingClientRect().height,bottom:p.getBoundingClientRect().bottom}})()`);
    assert.equal(reopened.visible,'true');assert.ok(reopened.plane>reopened.header&&Math.abs(reopened.plane-reopened.bottom)<1,'Completed reopen keeps the whole glass plane');
    records.push({mode,openingTime,opening,animations,start,samples,end,reopened});
  }
  await navigate();
  return {method:'Opening measured at 0/25/50/100/150/200ms with immediate labels; closing actual paused CSS transitions sampled at 0/25/50/75/99.5% of the full or reversal-shortened duration, plus completion and interrupted reopen',records};
}
