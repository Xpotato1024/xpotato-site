import assert from 'node:assert/strict';
import {parse,serialize} from 'parse5';
import {verifyMobileProjectCarousel} from './project-carousel-mobile-interaction.mjs';

// A fresh QA browser has a deterministic desktop baseline even without a physical mouse.
// Chromium ui/base/pointer/pointer_device.h: fine=4, hover=2. CDP touch overrides it below.
export const carouselBrowserArgs=['--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4'];

/** Served only by the local QA host; never written into dist. */
export function carouselFixture(html,count){
 const doc=parse(html),walk=n=>[n,...(n.childNodes??[]).flatMap(walk)],nodes=walk(doc);
 const attr=(n,key)=>n.attrs?.find(a=>a.name===key),root=nodes.find(n=>attr(n,'data-project-carousel'));
 const track=walk(root).find(n=>attr(n,'class')?.value==='project-track');
 track.childNodes=track.childNodes.filter(n=>n.tagName==='li').slice(0,count);
 if(!count){const parent=root.parentNode;parent.childNodes.splice(parent.childNodes.indexOf(root),1);}
 else track.childNodes.forEach((n,i)=>{attr(n,'aria-label').value=`${i+1} / ${count}`;});
 return serialize(doc);
}

export function assertHomeCarouselScripts(scripts){
 assert.equal(scripts.length,2,'Homepage has only the header synchronizer and bounded carousel module');
 assert.equal(scripts[0],'/scripts/mobile-menu.js');
 assert.match(scripts[1],/^\/_astro\/ProjectCarousel\.astro_astro_type_script_index_0_lang\.[A-Za-z0-9_-]+\.js$/);
}

export async function verifyProjectCarouselInteraction({send,evaluate,until,origin,audit,screenshot}){
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const click=async selector=>{if(await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});return Boolean(b?.closest('.project-controls')&&!b.getClientRects().length);})()`))await evaluate(`document.querySelector('[data-controls-toggle]').click()`);return evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);};
 const current=()=>evaluate(`Array.from(document.querySelectorAll('.project-slide:not([data-loop-copy])')).findIndex(n=>n.getAttribute('aria-hidden')==='false')`);
 const ready=()=>until(()=>evaluate(`Boolean(document.querySelector('.project-carousel-enhanced'))`),'Carousel enhanced');
 const navigate=async(path='/')=>{await send('Page.navigate',{url:origin+path});await until(()=>evaluate(`document.readyState==='complete'`),'Carousel document');};
 const settle=()=>wait(500);
 const layout=()=>evaluate(`(()=>{const root=document.querySelector('[data-project-carousel]'),viewport=root.querySelector('.project-viewport'),v=viewport.getBoundingClientRect(),cards=[...root.querySelectorAll('.project-slide')],active=cards.find(n=>n.getAttribute('aria-hidden')==='false'),r=active.getBoundingClientRect(),siblings=[active.previousElementSibling,active.nextElementSibling].map(n=>{const b=n.getBoundingClientRect();return Math.max(0,Math.min(v.right,b.right)-Math.max(v.left,b.left))/b.width;}),fade=getComputedStyle(root,'::before');return{overflow:document.documentElement.scrollWidth>innerWidth,centerError:Math.abs((r.left+r.right-v.left-v.right)/2),cardWidth:r.width,viewportWidth:v.width,siblings,clipped:[...root.querySelectorAll('.project-slide h3,.project-slide p,.project-slide small')].some(n=>n.scrollWidth>n.clientWidth+1),lastBorders:[...document.querySelectorAll('.home-article-list')].map(n=>getComputedStyle(n.lastElementChild).borderBottomWidth),numericChoices:document.querySelectorAll('.carousel-pagination').length,originals:cards.filter(n=>!n.hasAttribute('data-loop-copy')).length,focusableOriginals:cards.filter(n=>!n.hasAttribute('data-loop-copy')&&!n.inert).length,fade:fade.display!=='none'&&fade.backgroundImage.includes('linear-gradient'),fadeClearOfCenter:parseFloat(fade.width)<=r.left-v.left+1,mobileOpen:root.dataset.controlsOpen==='true',buttons:[...root.querySelectorAll('.project-controls button,[data-controls-toggle]')].filter(b=>b.getClientRects().length&&getComputedStyle(b).visibility!=='hidden').map(b=>{const x=b.getBoundingClientRect();return{disclosure:b.hasAttribute('data-controls-toggle'),name:b.getAttribute('aria-label'),title:b.title,text:b.textContent.trim(),width:x.width,height:x.height,opacity:getComputedStyle(b).opacity,visibleIcons:[...b.querySelectorAll('svg')].filter(s=>getComputedStyle(s).display!=='none').length,onSide:b.hasAttribute('data-rotation')||((x.right<r.left||x.left>r.right)&&Math.abs((x.top+x.bottom-v.top-v.bottom)/2)<2),below:x.top>=v.bottom-1};})};})()`);
 const assertLayout=(g,width)=>{
  assert.equal(g.overflow,false);assert.ok(g.centerError<=2);assert.equal(g.clipped,false);assert.ok(g.lastBorders.every(b=>b==='0px'));assert.equal(g.numericChoices,0);assert.equal(g.focusableOriginals,1);
  assert.ok(g.buttons.every(b=>b.width>=44&&b.height>=44&&b.opacity==='1'&&b.name&&b.title===b.name&&(b.disclosure||b.text==='')&&b.visibleIcons===1),'Compact icon controls retain names, contrast and 44px targets');
  if(width>760){assert.ok(g.siblings.every(r=>r>.3&&r<.6));assert.equal(g.fade,true);assert.equal(g.fadeClearOfCenter,true);assert.ok(g.buttons.every(b=>b.onSide),'Previous/next flank the central card');}
  else{assert.equal(g.buttons.length,g.mobileOpen?4:1);assert.ok(g.siblings.every(r=>r<.01));assert.ok(Math.abs(g.cardWidth-g.viewportWidth)<=1);assert.equal(g.fade,false);assert.ok(g.buttons.every(b=>b.below),'Mobile controls leave the full-width card unobstructed');}
 };
 const records=[];
 const rotationPresentation=()=>evaluate(`(()=>{const root=document.querySelector('[data-project-carousel]'),button=root.querySelector('[data-rotation]'),r=root.getBoundingClientRect();return{visibility:getComputedStyle(button).visibility,state:button.dataset.state,rootHeight:r.height,viewportHeight:root.querySelector('.project-viewport').getBoundingClientRect().height,fineHover:matchMedia('(hover: hover) and (pointer: fine)').matches,hover:matchMedia('(hover: hover)').matches,pointer:matchMedia('(pointer: fine)').matches?'fine':matchMedia('(pointer: coarse)').matches?'coarse':'none',maxTouchPoints:navigator.maxTouchPoints,focused:document.activeElement===button};})()`);
 const rotationKey=async()=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32,text:' ',unmodifiedText:' '});await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});};
  const boundary=async(delta,width)=>{
   await click(delta<0?'[data-previous]':'[data-next]');
   const frames=await evaluate(`(()=>{const root=document.querySelector('[data-project-carousel]'),track=root.querySelector('.project-track'),v=root.querySelector('.project-viewport').getBoundingClientRect(),animation=track.getAnimations().find(a=>a.transitionProperty==='transform');if(!animation)return null;animation.pause();const duration=Number(animation.effect.getTiming().duration),frames=[];for(const fraction of [.25,.5,.75,.98]){animation.currentTime=duration*fraction;const first=track.firstElementChild.getBoundingClientRect(),last=track.lastElementChild.getBoundingClientRect();frames.push({fraction,leftBlank:Math.max(0,first.left-v.left),rightBlank:Math.max(0,v.right-last.right)});}animation.play();return frames;})()`);
   assert.ok(frames,'Animated boundary is inspected before it settles');
   assert.ok(frames.every(f=>f.leftBlank<=2&&f.rightBlank<=2),'Loop has no empty edge during transition: '+JSON.stringify({width,delta,frames}));
   await settle();return frames;
  };

 await send('Emulation.setTouchEmulationEnabled',{enabled:false});
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 await send('Emulation.setDeviceMetricsOverride',{width:1487,height:1000,deviceScaleFactor:1,mobile:false});await navigate();await ready();
 await evaluate(`document.querySelector('.home-projects').scrollIntoView();document.activeElement?.blur()`);await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});
 await evaluate(`document.fonts.ready`);const quiet=await rotationPresentation();assert.equal(quiet.fineHover,true,'QA desktop input: '+JSON.stringify(quiet));assert.equal(quiet.pointer,'fine');assert.equal(quiet.visibility,'hidden');await screenshot('home-carousel-1487-quiet.png');
 await evaluate(`document.querySelector('[data-rotation]').focus()`);assert.equal((await rotationPresentation()).focused,false,'Hidden rotation control is not an invisible focus target');
 const hoverPoint=await evaluate(`(()=>{const r=document.querySelector('.project-viewport').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+20};})()`);
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',...hoverPoint});const revealed=await rotationPresentation();assert.equal(revealed.visibility,'visible');assert.equal(revealed.rootHeight,quiet.rootHeight);assert.equal(revealed.viewportHeight,quiet.viewportHeight);await screenshot('home-carousel-1487-hover.png');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});assert.equal((await rotationPresentation()).visibility,'hidden');
 await evaluate(`document.querySelector('[data-previous]').focus()`);assert.equal((await rotationPresentation()).visibility,'visible');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 assert.equal(await evaluate(`document.activeElement===document.querySelector('[data-rotation]')&&document.activeElement.matches(':focus-visible')`),true,'Previous then rotation is a visible keyboard path');
 await rotationKey();await evaluate(`document.activeElement.blur()`);const stopped=await rotationPresentation();assert.equal(stopped.state,'paused');assert.equal(stopped.visibility,'visible');assert.equal(stopped.rootHeight,quiet.rootHeight);await screenshot('home-carousel-1487-paused.png');
 await evaluate(`document.querySelector('[data-rotation]').focus()`);await rotationKey();assert.equal((await rotationPresentation()).visibility,'visible','Focused rotation control does not disappear when resuming');await evaluate(`document.activeElement.blur()`);const resumedPresentation=await rotationPresentation();assert.equal(resumedPresentation.visibility,'hidden');assert.equal(resumedPresentation.rootHeight,quiet.rootHeight);
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});await navigate();await ready();await evaluate(`document.querySelector('.home-projects').scrollIntoView()`);const largeTouch=await rotationPresentation();assert.equal(largeTouch.hover,false);assert.equal(largeTouch.pointer,'coarse');assert.equal(largeTouch.maxTouchPoints,1);assert.equal(largeTouch.visibility,'visible','Large touch screens retain the stop control without hover');
 await send('Emulation.setTouchEmulationEnabled',{enabled:false});await navigate();await ready();const restoredDesktop=await rotationPresentation();assert.equal(restoredDesktop.fineHover,true,'PC mode is restored after the isolated touch case: '+JSON.stringify(restoredDesktop));
 for(const width of [1487,390,320]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<760});
  await navigate();await ready();await evaluate(`document.fonts.ready`);
  assertHomeCarouselScripts(await evaluate(`Array.from(document.querySelectorAll('script[src]')).map(s=>s.getAttribute('src'))`));
  await evaluate(`document.querySelector('.home-projects').scrollIntoView()`);if(width<=760){const rest=await layout();assertLayout(rest,width);assert.equal(rest.mobileOpen,false);await screenshot('home-carousel-'+width+'-resting.png');}await click('[data-rotation]');if(width<=760)await click('[data-controls-toggle]'); // Pause explicitly, then return to the compact mobile view.
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});await settle();
  const geometry=await layout();assertLayout(geometry,width);
  await screenshot(`home-carousel-${width}.png`);await audit(`project carousel ${width}`);records.push({width,...geometry});
  const backwardFrames=await boundary(-1,width);assert.equal(await current(),geometry.originals-1,'Backward boundary wraps');
  const forwardFrames=await boundary(1,width);assert.equal(await current(),0,'Forward boundary wraps');
  records.at(-1).boundaryFrames={backward:backwardFrames,forward:forwardFrames};
  await evaluate(`document.querySelector('.project-viewport').focus()`);
  for(const [key,expected]of [['End',geometry.originals-1],['Home',0],['ArrowRight',1],['ArrowLeft',0]]){await send('Input.dispatchKeyEvent',{type:'keyDown',key});await send('Input.dispatchKeyEvent',{type:'keyUp',key});await settle();assert.equal(await current(),expected,key);}
  if(width===390){
   const point=await evaluate(`(()=>{const r=document.querySelector('.project-viewport').getBoundingClientRect();return{x:r.x+r.width*.75,y:r.y+Math.min(80,r.height/2)};})()`);
   await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
   for(let dx=15;dx<=100;dx+=15)await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x-dx,y:point.y}]});
   await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();assert.equal(await current(),1,'Touch swipe');
  }
  await evaluate(`document.documentElement.style.fontSize='200%'`);await settle();
  const enlarged=await layout();assertLayout(enlarged,width);await audit('project carousel '+width+' / 200%');await screenshot('home-carousel-'+width+'-text-200.png');records.push({width,textScale:200,...enlarged});
  await evaluate(`document.documentElement.style.removeProperty('font-size')`);await settle();
 }
 // Keep the same active link and index across both responsive modes.
 await send('Emulation.setDeviceMetricsOverride',{width:1487,height:1000,deviceScaleFactor:1,mobile:false});await navigate();await ready();await click('[data-rotation]');await click('[data-next]');await settle();
 await evaluate(`document.querySelector('.project-slide[aria-hidden="false"] a').focus();window.carouselFocusTarget=document.activeElement`);
 const resizeReports=[];
 for(const width of [390,320,760,761,1487]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<=760});await settle();
  assert.equal(await current(),1);assert.equal(await evaluate(`document.activeElement===window.carouselFocusTarget && !document.activeElement.closest('.project-slide').inert`),true,'Responsive changes preserve the active link focus');
  const g=await layout();assertLayout(g,width);resizeReports.push({width,centerError:g.centerError});
 }
 await click('[data-previous]');await send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});await settle();assert.equal(await current(),0);assertLayout(await layout(),390);
 // Real elapsed time proves timer behavior, rather than only changing state flags.
 await send('Emulation.setDeviceMetricsOverride',{width:1487,height:1000,deviceScaleFactor:1,mobile:false});await navigate();await ready();
 await evaluate(`document.querySelector('.home-projects').scrollIntoView();document.activeElement?.blur()`);await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});await wait(6600);assert.equal(await current(),1,'Automatic next card');
 const hover=await evaluate(`(()=>{const r=document.querySelector('.project-viewport').getBoundingClientRect();return{x:r.x+10,y:r.y+10};})()`);
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',...hover});const hovered=await current();await wait(6300);assert.equal(await current(),hovered,'Hover pauses');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});await evaluate(`document.querySelector('.project-viewport').focus()`);await wait(6300);assert.equal(await current(),hovered,'Focus pauses');
 await click('[data-rotation]');await evaluate(`document.activeElement?.blur()`);await wait(6300);assert.equal(await current(),hovered,'Explicit pause survives blur');
 assert.equal(await evaluate(`document.querySelector('[data-rotation]').dataset.state`),'paused');
 await click('[data-rotation]');await evaluate(`document.activeElement?.blur()`);assert.equal(await evaluate(`document.querySelector('[data-rotation]').dataset.state`),'playing');await wait(6600);assert.equal(await current(),(hovered+1)%6,'Compact play control resumes persistent rotation');
 const mobileReport=await verifyMobileProjectCarousel({send,evaluate,navigate,ready,current,wait,settle,screenshot,audit,layout,assertLayout,rotationKey});
 await send('Emulation.setDeviceMetricsOverride',{width:1487,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await navigate();await ready();await evaluate(`document.querySelector('.home-projects').scrollIntoView()`);assert.equal(await evaluate(`document.querySelector('[data-rotation]').disabled`),true);await click('[data-next]');assert.equal(await current(),1,'Reduced motion keeps manual next without animation');
 for(const count of [0,1,2]){
  if(count===2)await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await navigate(`/__carousel-fixture__/${count}/`);
  if(count===0){assert.equal(await evaluate(`document.querySelector('[data-project-carousel]')===null`),true);continue;}
  await until(()=>evaluate(`document.querySelector('.project-carousel-static,.project-carousel-enhanced')!==null`),'Few-item carousel');
  if(count===1){assert.equal(await evaluate(`document.querySelector('.project-controls').hidden`),true);assert.equal(await evaluate(`document.querySelectorAll('[data-loop-copy]').length`),0);}
  else{await click('[data-rotation]');for(const width of [1487,390,320]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<760});await evaluate(`document.querySelector('.home-projects').scrollIntoView()`);await settle();assertLayout(await layout(),width);const backward=await boundary(-1,width);assert.equal(await current(),1);const forward=await boundary(1,width);assert.equal(await current(),0);records.push({count:2,width,boundaryFrames:{backward,forward}});}}
 }
 await send('Emulation.setEmulatedMedia',{features:[]});
 return{status:'PASS',viewports:records,resizeReports,mobileReport,rotationPresentation:{quiet,revealed,stopped,largeTouch,restoredDesktop},loop:true,keyboard:true,touch:true,auto:true,hover:true,focus:true,pause:true,resume:true,reducedMotion:true,fewItems:[0,1,2]};
}
