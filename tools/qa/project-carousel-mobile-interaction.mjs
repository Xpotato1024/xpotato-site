import assert from 'node:assert/strict';

export async function verifyMobileProjectCarousel({send,evaluate,navigate,ready,current,wait,settle,screenshot,audit,layout,assertLayout,rotationKey}) {
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});
  await navigate();await ready();await evaluate(`document.fonts.ready;document.querySelector('.home-projects').scrollIntoView();document.activeElement?.blur()`);
  const point=()=>evaluate(`(()=>{const r=document.querySelector('.project-viewport').getBoundingClientRect();return{x:r.x+r.width*.65,y:r.y+Math.min(120,r.height-20)};})()`);
  const touch=(type,touchPoints=[])=>send('Input.dispatchTouchEvent',{type,touchPoints});
  const tap=async selector=>{const p=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await touch('touchStart',[p]);await touch('touchEnd');await wait(80);};
  const swipe=async(dx,dy=0)=>{const p=await point();await touch('touchStart',[p]);for(let i=1;i<=6;i++)await touch('touchMove',[{x:p.x+dx*i/6,y:p.y+dy*i/6}]);await touch('touchEnd');await settle();};
  const resting=await layout();assertLayout(resting,390);assert.equal(resting.buttons.length,7);
  await screenshot('home-carousel-390-resting.png');await audit('mobile carousel resting');
  assert.equal(await evaluate(`document.querySelector('[data-controls-toggle]')`),null,'No disclosure menu remains');
  // Screenshots/axe/header settling may consume the original autoplay interval.
  // Start this timing assertion from a supported current-dot activation, not load.
  await settle();
  const resetStarted=performance.now();
  await tap('[data-project-dot][aria-current="true"]');
  const initial=await current();
  await wait(5000);
  assert.equal(await current(),initial,'Hold setup has not crossed the renewed autoplay deadline');
  const holdPoint=await point(),beforeContactMs=performance.now()-resetStarted;
  assert.ok(beforeContactMs<6000,'Hold setup must reach contact before the renewed 6000ms deadline; elapsed='+beforeContactMs);
  await touch('touchStart',[holdPoint]);await wait(6600);
  assert.equal(await current(),initial,'Contact holds across the original autoplay deadline');
  await touch('touchEnd');await wait(5200);assert.equal(await current(),initial,'Release starts a full display interval');
  await wait(1600);assert.equal(await current(),(initial+1)%6,'Ordinary touch resumes without a stuck hover/focus pause');
  console.log('Mobile contact hold and full-timer reset PASS');
  let index=await current();
  for(const direction of [1,1,1,1,1,-1,-1]){await swipe(-110*direction);index=(index+direction+6)%6;assert.equal(await current(),index,'Repeated swipe and wrap');}
  await wait(5200);assert.equal(await current(),index,'Swipe restarts the display interval');
  await wait(1600);index=(index+1)%6;assert.equal(await current(),index,'Swipe resumes autoplay despite synthesized mouse/focus events');
  await evaluate(`document.querySelector('.project-slide[aria-hidden="false"] a').focus()`);await wait(6600);assert.equal(await current(),index,'A new intentional assistive/keyboard focus still pauses after touch');await evaluate(`document.activeElement.blur()`);
  const beforeScroll=await evaluate('scrollY'),verticalPoint=await point();await touch('touchStart',[verticalPoint]);for(let i=1;i<=6;i++)await touch('touchMove',[{x:verticalPoint.x,y:verticalPoint.y-120*i/6}]);await wait(6600);assert.equal(await current(),index,'Vertical scroll pointer cancellation retains contact pause');await touch('touchEnd');await settle();assert.equal(await current(),index,'Vertical scroll is not a horizontal swipe');
  assert.ok(await evaluate(`scrollY>${beforeScroll}+10`),'Vertical browser scrolling remains usable');
  await evaluate(`document.querySelector('.home-projects').scrollIntoView()`);await settle();
  await touch('touchStart',[await point()]);await wait(200);await touch('touchCancel');await wait(5200);assert.equal(await current(),index,'Cancelled touch does not advance or use an expired timer');
  await wait(1600);index=(index+1)%6;assert.equal(await current(),index,'Cancelled touch releases its pause');
  console.log('Mobile repeated swipes, vertical scroll and cancelled touch PASS');

  const dotsReport=await verifyProjectDots({send,evaluate,current,wait,settle,rotationKey,tap});index=await current();
  await tap('[data-rotation]');assert.equal(await evaluate(`document.querySelector('[data-rotation]').dataset.state`),'paused');
  await evaluate(`document.activeElement.blur()`);await wait(6600);assert.equal(await current(),index,'Explicit stop survives touch release and blur');
  await tap('[data-rotation]');await wait(5200);assert.equal(await current(),index,'Resume starts a full interval');await wait(1600);index=(index+1)%6;assert.equal(await current(),index,'Explicit play resumes');
  await swipe(-110);index=(index+1)%6;assert.equal(await current(),index);await wait(5200);assert.equal(await current(),index);await wait(1600);index=(index+1)%6;assert.equal(await current(),index,'Swipe after touching a control has no sticky focus pause');
  console.log('Mobile persistent stop, explicit resume and post-control swipe PASS');
  await evaluate(`document.querySelector('[data-project-dot]').focus()`);await rotationKey();await settle();index=0;
  await wait(6600);assert.equal(await current(),index,'Intentional keyboard focus continues to pause');
  const focused=await evaluate(`document.activeElement.dataset.projectDot`);
  for(const width of [760,761,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<=760});await settle();assert.equal(await evaluate(`document.activeElement.dataset.projectDot`),focused,'Visible dot focus survives responsive mode changes');assertLayout(await layout(),width);}
  await send('Emulation.setDeviceMetricsOverride',{width:761,height:1000,deviceScaleFactor:1,mobile:false});await settle();await evaluate(`document.querySelector('[data-previous]').focus()`);await send('Emulation.setDeviceMetricsOverride',{width:760,height:1000,deviceScaleFactor:1,mobile:true});await settle();assert.equal(await evaluate(`document.activeElement===document.querySelector('[data-project-dot="0"]')`),true,'Focus leaves the desktop-only arrow for the current dot');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await navigate();await ready();await evaluate(`document.querySelector('.home-projects').scrollIntoView()`);
  const reduced=await current();await wait(6600);assert.equal(await current(),reduced,'Reduced motion disables mobile autoplay');assert.equal(await evaluate(`document.querySelector('[data-rotation]').disabled`),true);
  await tap('[data-project-dot="4"]');assert.equal(await current(),4,'Reduced motion preserves distant direct navigation');await swipe(110);assert.equal(await current(),3,'Reduced motion preserves swipe');assert.equal(await evaluate(`document.querySelector('.project-track').getAnimations().length`),0);
  await send('Emulation.setTouchEmulationEnabled',{enabled:false});
  return {holdPastDeadline:true,fullTimerReset:true,repeatedSwipes:true,verticalScroll:true,cancelledTouch:true,persistentStop:true,explicitResume:true,dotsReport,responsiveDotFocus:true,reducedMotion:true};
}

export async function verifyProjectDots({send,evaluate,current,wait,settle,rotationKey,tap}) {
  const activate=tap??(selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`));
  await activate('[data-rotation]');
  let previous=await current();
  for(const target of [5,1,4,0,3,3,2,5,0]){
    const before=await evaluate(`document.querySelector('.carousel-status').textContent`);
    await activate('[data-project-dot="'+target+'"]');
    if(Math.abs(target-previous)>1){assert.equal(await current(),target,'Distant dot jumps settle immediately');assert.equal(await evaluate(`document.querySelector('.project-track').getAnimations().length`),0,'No high-speed multi-slide sweep or boundary risk');}
    await settle();assert.equal(await current(),target,'Direct dot navigation in both directions');
    if(target===previous){assert.equal(await evaluate(`document.querySelector('.carousel-status').textContent`),before);assert.equal(await evaluate(`document.querySelector('.project-track').getAnimations().length`),0,'Repeated current dot is stable');}
    previous=target;
  }
  await activate('[data-project-dot="1"]');await activate('[data-project-dot="1"]');await settle();assert.equal(await current(),1,'Repeated dot during its transition settles safely');
  for(const target of [5,2,4,0])await activate('[data-project-dot="'+target+'"]');await settle();assert.equal(await current(),0,'Rapid distant selections retain the final requested destination');
  const key=async key=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key});await send('Input.dispatchKeyEvent',{type:'keyUp',key});await settle();};
  await evaluate(`document.querySelector('[data-project-dot="0"]').focus()`);
  for(const [name,target]of [['ArrowRight',1],['End',5],['ArrowLeft',4],['Home',0]]){await key(name);assert.equal(await current(),target);assert.equal(await evaluate(`document.activeElement.dataset.projectDot`),String(target),'Keyboard follows dot selection');}
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  assert.equal(await evaluate(`document.activeElement.dataset.projectDot==='1'&&document.activeElement.matches(':focus-visible')`),true);await rotationKey();await settle();assert.equal(await current(),1,'Native Space activates the focused dot');
  const ax=await send('Accessibility.getFullAXTree'),names=ax.nodes.filter(n=>!n.ignored&&n.role?.value==='button').map(n=>n.name?.value),labels=await evaluate(`[...document.querySelectorAll('[data-project-dot]')].map(b=>b.getAttribute('aria-label'))`);
  assert.equal(labels.length,6);assert.ok(labels.every((name,i)=>name.startsWith((i+1)+' / 6')&&name.length>12&&names.includes(name)));assert.ok(names.includes('自動送りを再開'));
  await evaluate(`document.activeElement.blur()`);await activate('[data-rotation]');
  // Re-activating the current position must also renew the complete interval.
  await wait(5000);await activate('[data-project-dot="1"]');await wait(5200);assert.equal(await current(),1,'Current-dot activation resets the timer');await wait(1600);assert.equal(await current(),2,'Dot touch does not leave a sticky focus pause');
  console.log((tap?'Mobile':'Desktop')+' dots: distant/adjacent/repeat, keyboard, AX names and timer PASS');
  return {directBothDirections:true,distantSnap:true,repeatedActive:true,keyboardAndAccessibleNames:true,fullIntervalAfterDot:true};
}
