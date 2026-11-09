import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source=await readFile(new URL('../../apps/site/public/scripts/home-header.js',import.meta.url),'utf8');
function fixture({present=true,scrollY=0,observer=true}={}) {
  const events=new Map(),frames=[],properties=new Map();let height=84,observeCallback,observed;
  const header={dataset:{},getBoundingClientRect:()=>({height})};
  const window={scrollY,addEventListener:(name,callback,options)=>events.set(name,{callback,options})};
  const context={document:{querySelector:selector=>{assert.equal(selector,'.home-header-layout .header-band');return present?header:null;},body:{style:{setProperty:(key,value)=>properties.set(key,value)}}},window,requestAnimationFrame:callback=>frames.push(callback)};
  if(observer)context.ResizeObserver=class {constructor(callback){observeCallback=callback;}observe(element){observed=element;}};
  vm.runInNewContext(source,context);
  return{header,window,events,frames,properties,get observed(){return observed;},resize:value=>{height=value;observeCallback?.();},flush:()=>{while(frames.length)frames.shift()();}};
}
test('Home-only enhancement is inert when the route header is absent',()=>{
  const f=fixture({present:false});assert.equal(f.events.size,0);assert.equal(f.properties.size,0);assert.equal(f.observed,undefined);
});
test('Initial state and measured reservation support top and restored scroll',()=>{
  for(const [y,state] of [[0,'top'],[24,'top'],[25,'scrolled'],[500,'scrolled']]){
    const f=fixture({scrollY:y});assert.equal(f.header.dataset.homeHeaderState,state);assert.equal(f.properties.get('--home-header-height'),'84px');assert.equal(f.observed,f.header);
  }
});
test('Scroll is passive and one animation frame coalesces repeated events',()=>{
  const f=fixture(),scroll=f.events.get('scroll');assert.equal(scroll.options.passive,true);
  f.window.scrollY=25;for(let i=0;i<12;i++)scroll.callback();assert.equal(f.frames.length,1);assert.equal(f.header.dataset.homeHeaderState,'top');f.flush();assert.equal(f.header.dataset.homeHeaderState,'scrolled');
  f.window.scrollY=24;scroll.callback();assert.equal(f.frames.length,1);f.flush();assert.equal(f.header.dataset.homeHeaderState,'top');
});
test('ResizeObserver, resize and pageshow resynchronize geometry and state',()=>{
  const f=fixture();f.resize(120);assert.equal(f.properties.get('--home-header-height'),'120px');
  f.window.scrollY=300;f.events.get('pageshow').callback();assert.equal(f.header.dataset.homeHeaderState,'scrolled');
  f.window.scrollY=0;f.events.get('resize').callback();assert.equal(f.header.dataset.homeHeaderState,'top');
});
test('Resize and pageshow still work without ResizeObserver',()=>{
  const f=fixture({observer:false});assert.equal(f.properties.get('--home-header-height'),'84px');f.window.scrollY=200;f.events.get('resize').callback();assert.equal(f.header.dataset.homeHeaderState,'scrolled');
});
