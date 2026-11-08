import assert from 'node:assert/strict';
export async function verifyPrimeOfflinePresentation({send,evaluate,until,origin,audit,screenshot}) {
  const reports=[];
  for(const width of [320,390,640,1181,1440])for(const scale of [100,200]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:origin+'/tools/prime-factorizer/'});
    await until(()=>evaluate('document.readyState==="complete" && Boolean(document.querySelector("[data-prime-offline]"))'),'Prime presentation ready');
    await evaluate('document.fonts.ready');await evaluate('document.documentElement.style.fontSize='+JSON.stringify(scale+'%'));
    const state=await evaluate(`(()=>{const root=document.querySelector('[data-prime-offline]'),button=root.querySelector('button'),guide=root.querySelector('details'),tool=document.querySelector('[data-interactive-module]'),r=n=>{const a=n.getBoundingClientRect();return {top:a.top,bottom:a.bottom,left:a.left,right:a.right,width:a.width,height:a.height};};return {root:r(root),button:r(button),summary:r(guide.querySelector('summary')),tool:r(tool),open:guide.open,overflow:document.documentElement.scrollWidth>innerWidth,text:root.textContent,status:root.querySelector('[role=status]').getAttribute('aria-live'),warning:document.querySelector('.tool-contact').textContent};})()`);
    assert.equal(state.overflow,false,'Prime panel reflows '+width+'/'+scale);
    assert.equal(state.open,false);assert.equal(state.status,'polite');
    assert.ok(state.root.bottom<=state.tool.top,'Offline benefits precede calculator');
    assert.ok(state.button.height>=44&&state.button.left>=state.root.left&&state.button.right<=state.root.right,'Visible save target is contained');
    assert.ok(state.summary.height>=44,'Disclosure target remains usable');
    assert.ok(!state.warning.includes('GitHub Issueは公開されます'));
    await audit('prime offline '+width+'/'+scale);await screenshot('prime-offline-'+width+'-'+scale+'.png');
    await evaluate("document.querySelector('.prime-offline summary').click()");
    assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false,'Expanded guidance reflows');
    await audit('prime offline guidance '+width+'/'+scale);
    await evaluate("document.querySelector('.prime-offline summary').click()");
    reports.push({width,scale,...state});
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  return reports;
}
