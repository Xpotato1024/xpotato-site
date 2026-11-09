import assert from 'node:assert/strict';

// Sample actual CSS transitions, not timer estimates. Called on the final dist.
export async function verifyHomeMenuTransition({evaluate, until, navigate}) {
  const records=[];
  for(const mode of ['popover','details'])for(const openingTime of [null,450,100]){
    const interrupted=openingTime!==null;
    await navigate();
    await evaluate(`window.scrollTo({top:0,behavior:'instant'});${mode==='details'?"document.querySelector('.mobile-menu-toggle').style.display='none';document.querySelector('.mobile-menu-fallback').style.display='block';":''}`);
    await until(()=>evaluate(`document.querySelector('.header-band').dataset.homeHeaderState==='top'`),'Top header before menu transition');
    const selector=mode==='popover'?'#site-menu':'.mobile-menu-fallback nav';
    const open=mode==='popover'?"document.querySelector('#site-menu').showPopover()":"document.querySelector('.mobile-menu-fallback').open=true";
    const close=mode==='popover'?"document.querySelector('#site-menu').hidePopover()":"document.querySelector('.mobile-menu-fallback').open=false";
    await evaluate(open);
    if(interrupted){
      await evaluate(`(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);for(const a of document.querySelector('.header-band').getAnimations({subtree:true})){a.pause();a.currentTime=${openingTime};}await new Promise(requestAnimationFrame);})()`);
    }else{
      await until(()=>evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector+' > ul')})).opacity==='1'&&document.querySelector('.header-band').getAnimations({subtree:true}).every(a=>a.playState==='finished'||a.playState==='idle')`),'Open menu settles');
    }
    const start=await evaluate(`(()=>{const h=document.querySelector('.header-band'),p=document.querySelector(${JSON.stringify(selector)});return{alpha:Number(getComputedStyle(h,'::before').backgroundColor.match(/[\\d.]+/g)[3]),panel:Number(getComputedStyle(p).opacity),list:Number(getComputedStyle(p.querySelector('ul')).opacity)}})()`);
    if(openingTime===450)assert.ok(start.list>0&&start.list<1,'Link entrance is genuinely interrupted');
    if(openingTime===100)assert.ok(start.panel>0&&start.panel<1&&start.list===0,'Close interrupts the shared surface before links appear');
    const animations=await evaluate(`(async()=>{${close};await new Promise(requestAnimationFrame);getComputedStyle(document.querySelector('.header-band'),'::before').backgroundColor;window.__menuExit=document.querySelector('.header-band').getAnimations({subtree:true});for(const a of window.__menuExit){a.pause();a.currentTime=0;}return window.__menuExit.map(a=>({property:a.transitionProperty,pseudo:a.effect.pseudoElement,duration:a.effect.getTiming().duration,delay:a.effect.getTiming().delay}));})()`);
    const glass=animations.find(a=>a.property==='background-color'),fade=animations.find(a=>a.property==='opacity'&&a.duration>0);
    assert.ok(glass&&fade&&glass.delay===0&&fade.delay===0&&Math.abs(glass.duration-fade.duration)<.001,'Glass and panel share duration, including CSS reversal shortening');
    assert.ok(fade.duration>0&&fade.duration<=200);
    if(openingTime!==100)assert.equal(fade.duration,200);
    const samples=[];
    try{
      for(const elapsed of [0,.25,.5,.75,.995].map(fraction=>fraction*fade.duration)){
        const sample=await evaluate(`(async()=>{for(const a of window.__menuExit)a.currentTime=${elapsed};await new Promise(requestAnimationFrame);const h=document.querySelector('.header-band'),p=document.querySelector(${JSON.stringify(selector)}),glass=getComputedStyle(h,'::before');return{elapsed:${elapsed},panel:Number(getComputedStyle(p).opacity),list:Number(getComputedStyle(p.querySelector('ul')).opacity),alpha:Number(glass.backgroundColor.match(/[\\d.]+/g)[3]),plane:parseFloat(glass.height),header:h.getBoundingClientRect().height,menuBottom:p.getBoundingClientRect().bottom,visible:h.dataset.menuVisible};})()`);
        assert.equal(sample.visible,'true','Exit keeps menu timing selected');
        assert.ok(Math.abs(sample.alpha/start.alpha-sample.panel/start.panel)<.015,'Glass and panel fade at the same pace');
        assert.ok(Math.abs(sample.list-start.list)<.015,'Links hold their current opacity instead of fading twice or flashing');
        assert.ok(sample.plane>sample.header,'Glass plane does not collapse mid-fade');
        samples.push(sample);
      }
    }finally{await evaluate(`(()=>{for(const a of window.__menuExit??[])a.finish();delete window.__menuExit})()`);}
    await until(()=>evaluate(`document.querySelector('.header-band').dataset.menuVisible==='false'`),'Closed menu releases motion timing');
    const end=await evaluate(`(()=>{const h=document.querySelector('.header-band'),s=getComputedStyle(h,'::before');return{alpha:Number(s.backgroundColor.match(/[\\d.]+/g)[3]),plane:parseFloat(s.height),header:h.getBoundingClientRect().height,duration:s.transitionDuration}})()`);
    assert.equal(end.alpha,0);assert.ok(Math.abs(end.plane-end.header)<1);assert.ok(end.duration.split(',').every(value=>parseFloat(value)===.7),'Normal scroll keeps its 700ms transition');
    // A new open during an exit must not be collapsed by the old completion.
    await evaluate(open);await until(()=>evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector+' > ul')})).opacity==='1'`),'Reopen after sampled close');
    await evaluate(`(async()=>{${close};await new Promise(requestAnimationFrame);${open};})()`);
    await until(()=>evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector+' > ul')})).opacity==='1'&&document.querySelector('.header-band').dataset.menuVisible==='true'`),'Interrupted close reopens');
    records.push({mode,openingTime,animations,start,samples,end});
  }
  await navigate();
  return {method:'Actual paused CSS transitions sampled at 0/25/50/75/99.5% of the full or reversal-shortened duration, plus completion and interrupted reopen',records};
}
