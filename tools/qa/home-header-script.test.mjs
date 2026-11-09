import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const source=await readFile(new URL('../../apps/site/public/scripts/home-header.js',import.meta.url),'utf8');
function fixture({present=true,scrollY=0}={}) {
  const events=new Map(),frames=[],header={dataset:{}};
  const window={scrollY,addEventListener:(name,callback,options)=>events.set(name,{callback,options})};
  vm.runInNewContext(source,{document:{querySelector:selector=>{assert.equal(selector,'.home-header-layout .header-band');return present?header:null;}},window,requestAnimationFrame:callback=>frames.push(callback)});
  return{header,window,events,frames,flush:()=>{while(frames.length)frames.shift()();}};
}
test('Photo fusion is inert without the Home opt-in',()=>{assert.equal(fixture({present:false}).events.size,0);});
test('Initial state preserves the 24px threshold and restored scroll',()=>{
  for(const [scrollY,state]of[[0,'top'],[24,'top'],[25,'scrolled'],[500,'scrolled']])assert.equal(fixture({scrollY}).header.dataset.homeHeaderState,state);
});
test('Passive scroll coalesces a burst to one frame',()=>{
  const f=fixture(),scroll=f.events.get('scroll');assert.equal(scroll.options.passive,true);
  f.window.scrollY=25;for(let i=0;i<12;i++)scroll.callback();assert.equal(f.frames.length,1);f.flush();assert.equal(f.header.dataset.homeHeaderState,'scrolled');
  f.window.scrollY=24;scroll.callback();f.flush();assert.equal(f.header.dataset.homeHeaderState,'top');
});
test('Pageshow restores photo fusion without owning shared header geometry',()=>{
  const f=fixture();f.window.scrollY=300;f.events.get('pageshow').callback();assert.equal(f.header.dataset.homeHeaderState,'scrolled');
  assert.deepEqual([...f.events.keys()],['scroll','pageshow']);
});
