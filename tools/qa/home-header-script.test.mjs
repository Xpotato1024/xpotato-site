import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source=await readFile(new URL('../../apps/site/public/scripts/home-header.js',import.meta.url),'utf8');
function fixture({present=true,scrollY=0,observer=true,popover=true}={}) {
  const events=new Map(),frames=[],properties=new Map(),observed=[];let height=84,observeCallback;
  const fallback={events:new Map(),addEventListener(name,callback){this.events.set(name,callback);}};
  const menu=(kind)=>({kind,active:false,opacity:'0',height:300,events:new Map(),
    addEventListener(name,callback){this.events.set(name,callback);},
    matches(selector){
      if(selector===':popover-open'){assert.equal(popover,true,'Unsupported popover selectors must not be evaluated');return this.active;}
      assert.equal(selector,'.mobile-menu-fallback[open] nav');return this.kind==='details'&&this.active;
    },
    closest(selector){assert.equal(selector,'.mobile-menu-fallback');return this.kind==='details'?fallback:null;},
    getBoundingClientRect(){return{top:height,bottom:height+this.height,height:this.height};}
  });
  const panel=menu('popover'),nav=menu('details');
  if(popover)panel.hidePopover=()=>{};
  const menus=[panel,nav];
  const header={dataset:{},getBoundingClientRect:()=>({top:0,height,bottom:height}),querySelectorAll:selector=>{assert.equal(selector,'.mobile-menu-panel, .mobile-menu-fallback nav');return menus;}};
  const window={scrollY,addEventListener:(name,callback,options)=>events.set(name,{callback,options})};
  const context={document:{querySelector:selector=>{assert.equal(selector,'.home-header-layout .header-band');return present?header:null;},body:{style:{setProperty:(key,value)=>properties.set(key,value)}}},window,requestAnimationFrame:callback=>frames.push(callback),getComputedStyle:element=>({opacity:element.opacity})};
  if(observer)context.ResizeObserver=class {constructor(callback){observeCallback=callback;}observe(element){observed.push(element);}};
  vm.runInNewContext(source,context);
  return{header,panel,nav,fallback,window,events,frames,properties,observed,
    resize:value=>{height=value;observeCallback?.();},
    observe:()=>observeCallback?.(),
    toggle:(element,active)=>{element.active=active;(element===nav?fallback:element).events.get('toggle')();},
    flush:()=>{while(frames.length)frames.shift()();}};
}
test('Home-only enhancement is inert when the route header is absent',()=>{
  const f=fixture({present:false});assert.equal(f.events.size,0);assert.equal(f.properties.size,0);assert.equal(f.observed.length,0);
});
test('Initial state and measured reservation support top and restored scroll',()=>{
  for(const [y,state] of [[0,'top'],[24,'top'],[25,'scrolled'],[500,'scrolled']]){
    const f=fixture({scrollY:y});assert.equal(f.header.dataset.homeHeaderState,state);assert.equal(f.properties.get('--home-header-height'),'84px');assert.equal(f.properties.get('--home-glass-height'),'84px');assert.deepEqual(f.observed,[f.header,f.panel,f.nav]);
  }
});
test('Scroll is passive and one animation frame coalesces repeated events',()=>{
  const f=fixture(),scroll=f.events.get('scroll');assert.equal(scroll.options.passive,true);
  f.window.scrollY=25;for(let i=0;i<12;i++)scroll.callback();assert.equal(f.frames.length,1);assert.equal(f.header.dataset.homeHeaderState,'top');f.flush();assert.equal(f.header.dataset.homeHeaderState,'scrolled');
  f.window.scrollY=24;scroll.callback();assert.equal(f.frames.length,1);f.flush();assert.equal(f.header.dataset.homeHeaderState,'top');
});
test('ResizeObserver, resize and pageshow resynchronize geometry and state',()=>{
  const f=fixture();f.resize(120);assert.equal(f.properties.get('--home-header-height'),'120px');assert.equal(f.properties.get('--home-glass-height'),'120px');
  f.window.scrollY=300;f.events.get('pageshow').callback();assert.equal(f.header.dataset.homeHeaderState,'scrolled');
  f.window.scrollY=0;f.events.get('resize').callback();assert.equal(f.header.dataset.homeHeaderState,'top');
});
test('Resize and pageshow still work without ResizeObserver',()=>{
  const f=fixture({observer:false});assert.equal(f.properties.get('--home-header-height'),'84px');f.window.scrollY=200;f.events.get('resize').callback();assert.equal(f.header.dataset.homeHeaderState,'scrolled');
  f.toggle(f.panel,true);assert.equal(f.properties.get('--home-glass-height'),'384px');f.panel.height=160;f.events.get('pageshow').callback();assert.equal(f.properties.get('--home-glass-height'),'244px');
});
test('One measured plane spans native and fallback menus without summing hidden layout boxes',()=>{
  const f=fixture();f.toggle(f.panel,true);assert.equal(f.properties.get('--home-glass-height'),'384px','Opening opacity zero still gets a plane before fading in');
  f.nav.height=500;f.toggle(f.nav,true);assert.equal(f.properties.get('--home-glass-height'),'584px','The farthest visible bottom defines one plane');
  f.toggle(f.nav,false);assert.equal(f.properties.get('--home-glass-height'),'384px','Closed details may retain layout boxes but must not extend glass');
  f.toggle(f.panel,false);assert.equal(f.properties.get('--home-glass-height'),'84px');
});
test('Both exit fades retain glass until their opacity transition ends',()=>{
  for(const kind of ['panel','nav']){
    const f=fixture(),menu=f[kind];f.toggle(menu,true);menu.opacity='.6';f.toggle(menu,false);assert.equal(f.properties.get('--home-glass-height'),'384px');
    menu.opacity='0';menu.events.get('transitionend')();assert.equal(f.properties.get('--home-glass-height'),'84px');
  }
});
test('Rapid interrupted toggles use actual state and keep an already reopened menu covered',()=>{
  for(const kind of ['panel','nav']){
    const f=fixture(),menu=f[kind];f.toggle(menu,true);menu.opacity='.4';f.toggle(menu,false);f.toggle(menu,true);
    menu.opacity='0';menu.events.get('transitionend')();assert.equal(f.properties.get('--home-glass-height'),'384px');
    f.toggle(menu,false);assert.equal(f.properties.get('--home-glass-height'),'84px');
  }
});
test('Plane follows fractional, enlarged-text and short-viewport geometry',()=>{
  const f=fixture();f.toggle(f.panel,true);f.panel.height=180.5;f.resize(138.25);assert.equal(f.properties.get('--home-header-height'),'138.25px');assert.equal(f.properties.get('--home-glass-height'),'318.75px');
  f.panel.height=42.5;f.observe();assert.equal(f.properties.get('--home-glass-height'),'180.75px');
  f.panel.height=0;f.observe();assert.equal(f.properties.get('--home-glass-height'),'138.25px');
});
test('Details fallback works without Popover API and never parses its unsupported selector',()=>{
  const f=fixture({popover:false});f.toggle(f.nav,true);assert.equal(f.properties.get('--home-glass-height'),'384px');f.toggle(f.nav,false);assert.equal(f.properties.get('--home-glass-height'),'84px');
});
