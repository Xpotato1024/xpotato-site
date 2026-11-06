import assert from 'node:assert/strict';
import {parse,serialize} from 'parse5';

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
 const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
 const current=()=>evaluate(`Array.from(document.querySelectorAll('.project-slide:not([data-loop-copy])')).findIndex(n=>n.getAttribute('aria-hidden')==='false')`);
 const ready=()=>until(()=>evaluate(`Boolean(document.querySelector('.project-carousel-enhanced'))`),'Carousel enhanced');
 const navigate=async(path='/')=>{await send('Page.navigate',{url:origin+path});await until(()=>evaluate(`document.readyState==='complete'`),'Carousel document');};
 const settle=()=>wait(500);
 const records=[];
  const boundary=async(delta,width)=>{
   await click(delta<0?'[data-previous]':'[data-next]');
   const frames=await evaluate(`(()=>{const root=document.querySelector('[data-project-carousel]'),track=root.querySelector('.project-track'),v=root.querySelector('.project-viewport').getBoundingClientRect(),animation=track.getAnimations().find(a=>a.transitionProperty==='transform');if(!animation)return null;animation.pause();const duration=Number(animation.effect.getTiming().duration),frames=[];for(const fraction of [.25,.5,.75,.98]){animation.currentTime=duration*fraction;const first=track.firstElementChild.getBoundingClientRect(),last=track.lastElementChild.getBoundingClientRect();frames.push({fraction,leftBlank:Math.max(0,first.left-v.left),rightBlank:Math.max(0,v.right-last.right)});}animation.play();return frames;})()`);
   assert.ok(frames,'Animated boundary is inspected before it settles');
   assert.ok(frames.every(f=>f.leftBlank<=2&&f.rightBlank<=2),'Loop has no empty edge during transition: '+JSON.stringify({width,delta,frames}));
   await settle();return frames;
  };

 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 for(const width of [1487,390,320]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<760});
  await navigate();await ready();await evaluate(`document.fonts.ready`);
  assertHomeCarouselScripts(await evaluate(`Array.from(document.querySelectorAll('script[src]')).map(s=>s.getAttribute('src'))`));
  await evaluate(`document.querySelector('.home-projects').scrollIntoView();document.querySelector('[data-rotation]').click()`); // Explicitly pause for geometry/manual checks.
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});await settle();
  const geometry=await evaluate(`(()=>{const root=document.querySelector('[data-project-carousel]'),v=root.querySelector('.project-viewport').getBoundingClientRect(),cards=[...root.querySelectorAll('.project-slide')],active=cards.find(n=>n.getAttribute('aria-hidden')==='false'),r=active.getBoundingClientRect(),siblings=[active.previousElementSibling,active.nextElementSibling].map(n=>{const b=n.getBoundingClientRect();return Math.max(0,Math.min(v.right,b.right)-Math.max(v.left,b.left))/b.width;});return{overflow:document.documentElement.scrollWidth>innerWidth,centerError:Math.abs((r.left+r.right-v.left-v.right)/2),siblings,clipped:[...root.querySelectorAll('.project-slide h3,.project-slide p,.project-slide small')].some(n=>n.scrollWidth>n.clientWidth+1),lastBorders:[...document.querySelectorAll('.home-article-list')].map(n=>getComputedStyle(n.lastElementChild).borderBottomWidth),numericChoices:document.querySelectorAll('.carousel-pagination').length,originals:cards.filter(n=>!n.hasAttribute('data-loop-copy')).length,focusableOriginals:cards.filter(n=>!n.hasAttribute('data-loop-copy')&&!n.inert).length};})()`);
  assert.equal(geometry.overflow,false);assert.ok(geometry.centerError<=2);assert.ok(geometry.siblings.every(r=>r>.3&&r<.6));assert.equal(geometry.clipped,false);assert.ok(geometry.lastBorders.every(b=>b==='0px'));assert.equal(geometry.numericChoices,0);assert.equal(geometry.focusableOriginals,1);
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
 }
 // Real elapsed time proves timer behavior, rather than only changing state flags.
 await send('Emulation.setDeviceMetricsOverride',{width:1487,height:1000,deviceScaleFactor:1,mobile:false});await navigate();await ready();
 await evaluate(`document.querySelector('.home-projects').scrollIntoView();document.activeElement?.blur()`);await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});await wait(6600);assert.equal(await current(),1,'Automatic next card');
 const hover=await evaluate(`(()=>{const r=document.querySelector('.project-viewport').getBoundingClientRect();return{x:r.x+10,y:r.y+10};})()`);
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',...hover});const hovered=await current();await wait(6300);assert.equal(await current(),hovered,'Hover pauses');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});await evaluate(`document.querySelector('.project-viewport').focus()`);await wait(6300);assert.equal(await current(),hovered,'Focus pauses');
 await click('[data-rotation]');await evaluate(`document.activeElement?.blur()`);await wait(6300);assert.equal(await current(),hovered,'Explicit pause survives blur');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await navigate();await ready();await evaluate(`document.querySelector('.home-projects').scrollIntoView()`);assert.equal(await evaluate(`document.querySelector('[data-rotation]').disabled`),true);await click('[data-next]');assert.equal(await current(),1,'Reduced motion keeps manual next without animation');
 for(const count of [0,1,2]){
  if(count===2)await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await navigate(`/__carousel-fixture__/${count}/`);
  if(count===0){assert.equal(await evaluate(`document.querySelector('[data-project-carousel]')===null`),true);continue;}
  await until(()=>evaluate(`document.querySelector('.project-carousel-static,.project-carousel-enhanced')!==null`),'Few-item carousel');
  if(count===1){assert.equal(await evaluate(`document.querySelector('.project-controls').hidden`),true);assert.equal(await evaluate(`document.querySelectorAll('[data-loop-copy]').length`),0);}
  else{await click('[data-rotation]');for(const width of [1487,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<760});await evaluate(`document.querySelector('.home-projects').scrollIntoView()`);await settle();const backward=await boundary(-1,width);assert.equal(await current(),1);const forward=await boundary(1,width);assert.equal(await current(),0);records.push({count:2,width,boundaryFrames:{backward,forward}});}}
 }
 await send('Emulation.setEmulatedMedia',{features:[]});
 return{status:'PASS',viewports:records,loop:true,keyboard:true,touch:true,auto:true,hover:true,focus:true,pause:true,reducedMotion:true,fewItems:[0,1,2]};
}
