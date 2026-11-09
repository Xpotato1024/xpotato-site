import assert from 'node:assert/strict';
export async function verifyPrimeOfflinePresentation({send,evaluate,until,origin,audit,screenshot}) {
  const reports=[],path=origin+'/tools/prime-factorizer/';
  const guideState=()=>evaluate(`(()=>{const root=document.querySelector('[data-prime-offline]'),button=root.querySelector('button'),guide=root.querySelector('details'),tool=document.querySelector('[data-interactive-module]'),link=document.querySelector('[data-prime-offline-guide-link]'),r=n=>{const a=n.getBoundingClientRect();return {top:a.top,bottom:a.bottom,left:a.left,right:a.right,width:a.width,height:a.height};};return {root:r(root),button:r(button),summary:r(guide.querySelector('summary')),tool:r(tool),link:r(link),open:guide.open,hash:location.hash,overflow:document.documentElement.scrollWidth>innerWidth,text:root.textContent,status:root.querySelector('[role=status]').getAttribute('aria-live'),description:document.querySelector('.content-description').textContent,warning:document.querySelector('.tool-contact').textContent,headerBottom:Math.max(0,document.querySelector('.header-band').getBoundingClientRect().bottom),height:innerHeight};})()`);
  const ready=async()=>{
    await until(()=>evaluate('document.readyState==="complete" && Boolean(document.querySelector("[data-prime-offline-guide-link]"))'),'Prime presentation ready');
    await evaluate('document.fonts.ready');
  };
  const navigate=async url=>{
    await send('Page.navigate',{url:'about:blank'});
    await until(()=>evaluate('location.href==="about:blank"'),'Fresh Prime document');
    await send('Page.navigate',{url});await ready();
  };
  const click=async selector=>{
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
    const point=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
  };
  const reached=async(open=true)=>{
    await until(async()=>{const s=await guideState();return s.open===open&&s.hash==='#prime-offline-guide'&&s.button.top>=s.headerBottom&&s.button.bottom<=s.height;},'Guide target and visible save control');
    assert.equal((await guideState()).overflow,false,'Guidance reflows');
  };
  for(const width of [320,390,640,1181,1440])for(const scale of [100,200]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    await navigate(path);
    await evaluate('document.documentElement.style.fontSize='+JSON.stringify(scale+'%'));
    const state=await guideState();
    assert.equal(state.overflow,false,'Prime guidance reflows '+width+'/'+scale);
    assert.equal(state.open,false);assert.equal(state.status,'polite');
    assert.ok(state.tool.bottom<=state.root.top,'Save control follows calculator');
    assert.ok(state.link.bottom<=state.tool.top,'Description link precedes calculator');
    assert.ok(state.button.height>=44&&state.button.left>=state.root.left&&state.button.right<=state.root.right,'Visible save target is contained');
    assert.ok(state.summary.height>=44&&state.link.height>=44,'Disclosure and link targets remain usable');
    assert.ok(state.description.includes('初回保存後はオフラインでも使えます'));
    assert.ok(!state.text.includes('PWA'));assert.ok(!state.warning.includes('GitHub Issueは公開されます'));
    await audit('prime offline '+width+'/'+scale);await screenshot('prime-offline-'+width+'-'+scale+'.png');
    await click('[data-prime-offline-guide-link]');await reached();
    await audit('prime offline guidance '+width+'/'+scale);await screenshot('prime-offline-guide-'+width+'-'+scale+'.png');
    await click('.prime-offline summary');
    await click('[data-prime-offline-guide-link]');await reached();
    await click('.prime-offline summary');
    await evaluate("document.querySelector('[data-prime-offline-guide-link]').focus()");
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await reached();
    reports.push({width,scale,...state});
  }
  await evaluate("history.back()");
  await until(()=>evaluate('location.hash===""'),'Back returns from guidance fragment');
  await evaluate("document.querySelector('.prime-offline details').open=false;history.forward()");
  await reached();
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await navigate(path+'#prime-offline-guide');await reached();
  await send('Emulation.setEmulatedMedia',{features:[]});
  await send('Emulation.setScriptExecutionDisabled',{value:true});
  try {
    await navigate(path);
    await click('[data-prime-offline-guide-link]');await reached(false);
    await click('.prime-offline summary');
    assert.equal((await guideState()).open,true,'No-JS disclosure remains native and usable');
    await screenshot('prime-offline-no-js.png');
  } finally { await send('Emulation.setScriptExecutionDisabled',{value:false}); }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  return reports;
}
