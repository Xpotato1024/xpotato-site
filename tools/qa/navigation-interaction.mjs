import assert from 'node:assert/strict';
const names=['記事','メモ','教育資料','制作物','ツール','サイト紹介'];
const paths=['/articles/','/notes/','/education/','/projects/','/tools/','/about/'];

/** One section hierarchy at normal/200% text, including a browser-only future page. */
export async function verifyNavigationInteraction({send,evaluate,until,origin,audit,screenshot=async()=>{}}){
 const headerReports=[];
 for(const width of [320,390,760,761,1000,1092,1093,1094,1180,1181,1440])for(const scale of [100,200]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1033,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:origin+'/about/'});await until(()=>evaluate('document.readyState==="complete"'),'Header document');await evaluate('document.fonts.ready');await evaluate('document.documentElement.style.fontSize='+JSON.stringify(scale+'%'));
  const geometry=await evaluate(`(()=>{const pick=s=>{const n=document.querySelector(s),r=n.getBoundingClientRect();return{center:r.top+r.height/2,left:r.left,right:r.right,width:r.width,height:r.height}};return{search:pick('.mobile-search'),svg:pick('.mobile-search svg'),menu:pick('.mobile-menu-toggle'),icon:pick('.menu-icon'),input:pick('.header-search input'),submit:pick('.header-search button'),overflow:document.documentElement.scrollWidth>innerWidth}})()`);
  assert.equal(geometry.overflow,false,'Header overflow '+width+'/'+scale);
  if(width<=1180){for(const [a,b]of [['search','menu'],['search','svg'],['menu','icon']])assert.ok(Math.abs(geometry[a].center-geometry[b].center)<=1,'Header centers '+a+'/'+b+' at '+width+'/'+scale);for(const key of ['search','menu'])assert.ok(geometry[key].width>=44&&geometry[key].height>=44&&geometry[key].left>=0&&geometry[key].right<=width);}
  else {assert.ok(geometry.input.height>=44&&geometry.submit.height>=44,'Desktop search retains usable targets');if(scale===100)assert.ok(Math.abs(geometry.input.center-geometry.submit.center)<=1,'Desktop search stays centered');}
  if(width===1093){await screenshot('header-alignment-1093-'+scale+'.png');await audit('header alignment '+width+'/'+scale);}
  headerReports.push({width,scale,...geometry});
 }
 await send('Emulation.setDeviceMetricsOverride',{width:1093,height:1033,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:origin+'/about/'});await until(()=>evaluate('document.readyState==="complete"'),'Header keyboard ready');await evaluate('document.querySelector(".mobile-search").focus()');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});assert.equal(await evaluate('document.activeElement===document.querySelector(".mobile-menu-toggle")&&document.activeElement.matches(":focus-visible")'),true,'Search to menu keyboard order');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await until(()=>evaluate('document.querySelector("#site-menu").matches(":popover-open")'),'Medium keyboard menu opens');await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await until(()=>evaluate('!document.querySelector("#site-menu").matches(":popover-open")'),'Medium Escape closes');
 await evaluate('document.querySelector(".mobile-search").focus()');await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await until(()=>evaluate('location.pathname==="/search/"&&document.readyState==="complete"'),'Medium search link activates');
 const reports=[];
 for(const width of [1440,390,320])for(const scale of [100,200])for(const future of [false,true]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:origin+'/about/'});
  await until(()=>evaluate('document.readyState==="complete" && document.querySelector(".mobile-menu-toggle")?.getAttribute("aria-expanded")==="false"'),'Navigation ready');
  await evaluate('document.fonts.ready');
  if(future)await evaluate(`for(const selector of ['.desktop-navigation ul','#site-menu ul','.mobile-menu-fallback ul','.footer-links']){const list=document.querySelector(selector),li=document.createElement('li'),a=document.createElement('a');a.textContent='問い合わせ';a.href='#contact-fixture';li.append(a);const feed=[...list.children].find(item=>item.querySelector('a')?.getAttribute('href')==='/rss.xml');list.insertBefore(li,feed??null);}`);
  await evaluate('document.documentElement.style.fontSize='+JSON.stringify(scale+'%'));
  if(width<1181){
   await evaluate('document.querySelector(".mobile-menu-toggle").click()');
   await until(()=>evaluate(`(()=>{const panel=document.querySelector('#site-menu');return panel.matches(':popover-open') && getComputedStyle(panel).opacity==='1' && panel.getAnimations().every(a=>['finished','idle'].includes(a.playState));})()`),'Navigation open animation settled');
  }
  const state=await evaluate(`(()=>{const selectors=['.desktop-navigation','#site-menu','.mobile-menu-fallback','.footer-nav'];return {width:innerWidth,font:getComputedStyle(document.documentElement).fontSize,title:document.querySelector('main h1').textContent.trim(),overflow:document.documentElement.scrollWidth>innerWidth,groups:selectors.map(selector=>[...document.querySelectorAll(selector+' a')].map(a=>{const r=a.getBoundingClientRect();return {name:a.textContent.trim(),path:a.pathname,href:a.getAttribute('href'),left:r.left,right:r.right,width:r.width,height:r.height,align:getComputedStyle(a).textAlign};}))};})()`);
  assert.equal(state.width,width);assert.equal(state.font,scale===200?'32px':'16px');assert.equal(state.title,'サイト紹介');assert.equal(state.overflow,false,'Navigation width / text '+width+'/'+scale);
  for(const group of state.groups){
   const sections=group.filter(item=>item.href!=='/rss.xml');
   assert.deepEqual(sections.map(item=>item.name),future?[...names,'問い合わせ']:names);
   assert.deepEqual(sections.slice(0,6).map(item=>item.path),paths);
  }
  if(width<1181)assert.ok(state.groups[1].every(item=>item.align==='center'),'Expanded menu labels are centered');
  const visible=[...state.groups[width>=1181?0:1],...state.groups[3]];
  assert.ok(visible.every(item=>item.width>=44 && item.height>=44 && item.left>=-1 && item.right<=width+1),'44px navigation targets remain in viewport');
  const ax=await send('Accessibility.getFullAXTree');
  const axNames=ax.nodes.filter(node=>!node.ignored&&node.role?.value==='link').map(node=>node.name?.value);
  for(const name of future?[...names,'問い合わせ']:names)assert.ok(axNames.includes(name),'Accessible navigation name '+name);
  if(width===1440&&scale===200&&future){
   await until(()=>evaluate('Math.abs(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--site-header-bottom"))-document.querySelector(".header-band").getBoundingClientRect().bottom)<1'),"Header geometry before anchor navigation");
   await evaluate('document.querySelector("main h2").id="navigation-heading-fixture";location.hash="navigation-heading-fixture"');
   await until(()=>evaluate('scrollY>0 && document.querySelector("#navigation-heading-fixture").getBoundingClientRect().top>=document.querySelector(".header-band").getBoundingClientRect().bottom-1'),'Enlarged desktop header does not cover the anchor target');
   await evaluate('history.replaceState(null,"",location.pathname);scrollTo(0,0)');await until(()=>evaluate('scrollY===0'),'Anchor fixture reset');
  }
  await audit('navigation '+width+'/'+scale+'/'+future);
  await screenshot('navigation-'+width+'-'+scale+'-'+(future?'future':'current')+'.png');
  reports.push({width,scale,future,overflow:state.overflow,links:visible.length});
 }
 await send('Page.reload');await until(()=>evaluate('document.readyState==="complete" && getComputedStyle(document.documentElement).fontSize==="16px"'),'Navigation fixture cleanup');
 assert.equal(await evaluate('Boolean(document.querySelector(\'a[href="#contact-fixture"]\'))'),false);
 return {reports,headerReports};
}
