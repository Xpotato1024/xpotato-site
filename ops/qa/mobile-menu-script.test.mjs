import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const source=await readFile(new URL('../../apps/site/public/scripts/mobile-menu.js',import.meta.url),'utf8');
function fixture({observer=true,popover=true,present=true}={}){
  const events=new Map(),properties=new Map(),observed=[];let height=84,observeCallback;
  const control=()=>({attributes:new Map(),setAttribute(key,value){this.attributes.set(key,value);},focus(){this.focused=true;}});
  const summary=control(),button=control(),fallback={open:false,events:new Map(),addEventListener(name,callback){this.events.set(name,callback);},querySelector:selector=>selector==='summary'?summary:nav};
  const menu=()=>({active:false,opacity:'0',height:300,events:new Map(),addEventListener(name,callback){this.events.set(name,callback);},matches(selector){assert.equal(popover,true);assert.equal(selector,':popover-open');return this.active;},getBoundingClientRect(){return{top:height,bottom:height+this.height,height:this.height};}});
  const panel=menu(),nav=menu();if(popover)panel.hidePopover=()=>{panel.active=false;};
  const header={dataset:{},getBoundingClientRect:()=>({top:0,height,bottom:height})};
  const viewport={matches:true,addEventListener:(name,callback)=>events.set('viewport',callback)};
  const context={document:{querySelector:selector=>present?({'.mobile-menu-toggle':button,'#site-menu':panel,'.mobile-menu-fallback':fallback,'.header-band':header}[selector]):null,documentElement:{style:{setProperty:(key,value)=>properties.set(key,value)}},addEventListener:(name,callback)=>events.set(name,callback)},window:{matchMedia:()=>viewport,addEventListener:(name,callback)=>events.set(name,callback)},getComputedStyle:menu=>({opacity:menu.opacity})};
  if(observer)context.ResizeObserver=class{constructor(callback){observeCallback=callback;}observe(element){observed.push(element);}};
  vm.runInNewContext(source,context);
  return{header,panel,nav,button,summary,fallback,viewport,events,properties,observed,
    resize:value=>{height=value;observeCallback?.();},observe:()=>observeCallback?.(),
    toggle:(menu,active)=>{if(menu===panel){panel.active=active;panel.events.get('toggle')();}else{fallback.open=active;fallback.events.get('toggle')();}}};
}
test('Shared header enhancement is inert when native menu markup is absent',()=>{assert.equal(fixture({present:false}).events.size,0);});
test('Shared geometry is initialized on any route, without a Home class',()=>{
  const f=fixture();assert.equal(f.header.dataset.menuSurface,'shared');assert.equal(f.header.dataset.menuVisible,'false');assert.equal(f.properties.get('--site-header-height'),'84px');assert.equal(f.properties.get('--site-glass-height'),'84px');assert.deepEqual(f.observed,[f.header,f.panel,f.nav]);
});
test('One shared plane covers native and fallback menus without summing their boxes',()=>{
  const f=fixture();f.toggle(f.panel,true);assert.equal(f.properties.get('--site-glass-height'),'384px');f.nav.height=500;f.toggle(f.nav,true);assert.equal(f.properties.get('--site-glass-height'),'584px');f.toggle(f.nav,false);assert.equal(f.properties.get('--site-glass-height'),'384px');f.toggle(f.panel,false);assert.equal(f.properties.get('--site-glass-height'),'84px');
});
test('Exit retains common timing and geometry until opacity reaches zero',()=>{
  for(const kind of ['panel','nav']){const f=fixture(),menu=f[kind];f.toggle(menu,true);menu.opacity='.6';f.toggle(menu,false);assert.equal(menu.inert,true);assert.equal(f.header.dataset.menuVisible,'true');assert.equal(f.properties.get('--site-glass-height'),'384px');menu.opacity='0';menu.events.get('transitionend')();assert.equal(f.header.dataset.menuVisible,'false');assert.equal(f.properties.get('--site-glass-height'),'84px');}
});
test('Interrupted closing cannot collapse an already reopened native or fallback menu',()=>{
  for(const kind of ['panel','nav']){const f=fixture(),menu=f[kind];f.toggle(menu,true);menu.opacity='.4';f.toggle(menu,false);f.toggle(menu,true);menu.opacity='0';menu.events.get('transitionend')();assert.equal(f.header.dataset.menuVisible,'true');assert.equal(f.properties.get('--site-glass-height'),'384px');}
});
test('Fractional resize, reflow, pageshow and short viewports update the same plane',()=>{
  const f=fixture();f.toggle(f.panel,true);f.panel.height=180.5;f.resize(138.25);assert.equal(f.properties.get('--site-header-height'),'138.25px');assert.equal(f.properties.get('--site-glass-height'),'318.75px');f.panel.height=42.5;f.events.get('pageshow')();assert.equal(f.properties.get('--site-glass-height'),'180.75px');
});
test('Viewport change closes menus without reopening them on return',()=>{
  const f=fixture();f.toggle(f.panel,true);f.toggle(f.nav,true);f.viewport.matches=false;f.events.get('viewport')();assert.equal(f.panel.active,false);assert.equal(f.fallback.open,false);f.viewport.matches=true;f.events.get('viewport')();assert.equal(f.header.dataset.menuVisible,'false');
});
test('Fallback without Popover API or ResizeObserver never evaluates the unsupported selector',()=>{
  const f=fixture({popover:false,observer:false});f.toggle(f.nav,true);assert.equal(f.properties.get('--site-glass-height'),'384px');f.nav.height=160;f.events.get('resize')();assert.equal(f.properties.get('--site-glass-height'),'244px');f.toggle(f.nav,false);assert.equal(f.header.dataset.menuVisible,'false');
});
