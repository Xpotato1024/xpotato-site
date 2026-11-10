import assert from 'node:assert/strict';
export async function verifyPrimeOfflinePresentation({send,evaluate,until,origin,audit,screenshot}) {
  const reports=[],path=origin+'/tools/prime-factorizer/';
  let currentCase='initialization',lastClick;
  const guideState=()=>evaluate(`(()=>{const root=document.querySelector('[data-prime-offline]'),button=root.querySelector('button'),guide=root.querySelector('details'),tool=document.querySelector('[data-interactive-module]'),link=document.querySelector('[data-prime-offline-guide-link]'),r=n=>{const a=n.getBoundingClientRect();return {top:a.top,bottom:a.bottom,left:a.left,right:a.right,width:a.width,height:a.height};};return {root:r(root),button:r(button),summary:r(guide.querySelector('summary')),tool:r(tool),link:r(link),open:guide.open,hash:location.hash,overflow:document.documentElement.scrollWidth>innerWidth,text:root.textContent,status:root.querySelector('[role=status]').getAttribute('aria-live'),description:document.querySelector('.content-description').textContent,warning:document.querySelector('.tool-contact').textContent,headerBottom:Math.max(0,document.querySelector('.header-band').getBoundingClientRect().bottom),height:innerHeight,scrollY,scrollPadding:parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop),scrollMargin:parseFloat(getComputedStyle(root).scrollMarginTop),phase:document.querySelector('.bt-prime-factorizer')?.dataset.phase??null,hydrating:Boolean(document.querySelector('astro-island[ssr]')),viewport:visualViewport?{top:visualViewport.offsetTop,left:visualViewport.offsetLeft,width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale}:null};})()`);
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
    lastClick={selector,point,state:await guideState(),hit:await evaluate(`(()=>{const n=document.elementFromPoint(${point.x},${point.y});return n?{tag:n.tagName,id:n.id,class:n.className}:null;})()`)};
    await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
  };
  const reached=async(open=true)=>{
    try {
      await until(async()=>{const s=await guideState();return s.open===open&&s.hash==='#prime-offline-guide'&&s.button.top>=s.headerBottom&&s.button.bottom<=s.height;},'Guide target and visible save control: '+currentCase);
    } catch(error) {
      const state=await guideState();
      await screenshot('prime-offline-failure-'+currentCase.replace(/[^a-z0-9-]/gi,'-')+'.png');
      throw new Error('Prime offline navigation failed: '+JSON.stringify({case:currentCase,expectedOpen:open,lastClick,state}),{cause:error});
    }
    assert.equal((await guideState()).overflow,false,'Guidance reflows');
  };
  for(const width of [320,390,640,1181,1440])for(const scale of [100,200]) {
    currentCase=width+'px-'+scale+'percent';
    console.log('Prime offline presentation START: '+currentCase);
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
    assert.ok(state.description.includes('最大309桁（1024bit以下）'));
    assert.ok(state.description.includes('分解完了の保証ではありません'));
    assert.ok(state.text.includes('保存後は、同じブラウザでこのページを開けば、通信なしで計算できます'));
    assert.ok(!state.text.includes('PWA'));assert.ok(!state.warning.includes('GitHub Issueは公開されます'));
    await audit('prime offline '+width+'/'+scale);await screenshot('prime-offline-'+width+'-'+scale+'.png');
    await click('[data-prime-offline-guide-link]');await reached();
    await audit('prime offline guidance '+width+'/'+scale);await reached();await screenshot('prime-offline-guide-'+width+'-'+scale+'.png');
    await click('.prime-offline summary');
    await click('[data-prime-offline-guide-link]');await reached();
    await click('.prime-offline summary');
    await evaluate("document.querySelector('[data-prime-offline-guide-link]').focus()");
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await reached();
    reports.push({width,scale,...state});
  }
  currentCase='history-back-forward';
  await evaluate("history.back()");
  await until(()=>evaluate('location.hash===""'),'Back returns from guidance fragment');
  await evaluate("document.querySelector('.prime-offline details').open=false;history.forward()");
  await reached();
  currentCase='1181px-200percent-tall-wrapped-header';
  console.log('Prime offline presentation START: '+currentCase);
  await send('Emulation.setDeviceMetricsOverride',{width:1181,height:1000,deviceScaleFactor:1,mobile:false});
  await navigate(path);
  // Force real navigation wrapping across platforms, without changing header height or fragment offsets.
  await evaluate("document.documentElement.style.fontSize='200%';document.querySelector('.desktop-navigation').style.maxWidth='6rem';document.querySelector('[data-interactive-module]').scrollIntoView()");
  await until(()=>evaluate("document.querySelector('.bt-prime-factorizer')?.dataset.phase==='ready'"),'Tall header calculator ready');
  await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const tall=await guideState();
  assert.ok(tall.headerBottom>=440,'Fixture has a tall wrapping header');
  assert.ok(2*tall.scrollPadding+(tall.button.top-tall.root.top)+tall.button.height>tall.height,'The old doubled offset would place the save control outside the viewport');
  await click('[data-prime-offline-guide-link]');await reached();
  const first=await guideState();
  assert.ok(Math.abs(first.root.top-first.scrollPadding)<2,'The shared header offset is counted exactly once');
  await click('.prime-offline summary');
  await click('[data-prime-offline-guide-link]');await reached();
  const repeated=await guideState();
  assert.ok(Math.abs(repeated.root.top-repeated.scrollPadding)<2,'Same-fragment navigation retains the single offset after hydration');
  await screenshot('prime-offline-tall-wrapped-header.png');
  reports.push({case:currentCase,width:1181,scale:200,first,repeated});
  currentCase='direct-fragment-reduced-motion';
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await navigate(path+'#prime-offline-guide');await reached();
  await send('Emulation.setEmulatedMedia',{features:[]});
  currentCase='no-javascript';
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
