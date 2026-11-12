import assert from 'node:assert/strict';

export async function verifyHomeToolRows({send,evaluate,until,origin,audit,screenshot}) {
  const records=[];
  const navigate=async()=>{
    await send('Page.navigate',{url:origin+'/'});
    await until(()=>evaluate(`location.pathname==='/'&&document.readyState==='complete'&&Boolean(document.querySelector('.home-tool-row'))`),'Home tool rows ready');
    await evaluate('document.fonts.ready.then(()=>true)');
  };
  const settle=()=>until(()=>evaluate(`document.querySelector('.header-band').getAnimations({subtree:true}).every(a=>a.playState==='finished'||a.playState==='idle')`),'Home header settles');
  const snapshot=()=>evaluate(`(()=>{
    const rect=n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    const heading=document.querySelector('#tools-heading'),section=heading.closest('section'),headingRange=document.createRange();headingRange.selectNodeContents(heading);
    return{width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,heading:{...rect(heading),text:heading.textContent,fontSize:parseFloat(getComputedStyle(heading).fontSize),lines:headingRange.getClientRects().length},listing:rect(section.querySelector('.section-heading a')),footerTop:rect(document.querySelector('.site-footer')).y,rows:[...document.querySelectorAll('.home-tool-row')].map(a=>{
      const s=getComputedStyle(a),p=a.querySelector('p'),h=a.querySelector('h3'),arrow=a.querySelector('.home-tool-arrow');
      const range=document.createRange();range.selectNode(h.firstChild);const lineRects=[...range.getClientRects()];
      return{...rect(a),path:a.pathname,links:a.closest('article').querySelectorAll('a').length,title:h.textContent,description:p.textContent,descriptionRect:rect(p),copy:rect(a.querySelector('.home-tool-copy')),titleSize:parseFloat(getComputedStyle(h).fontSize),titleWeight:getComputedStyle(h).fontWeight,titleLineHeight:parseFloat(getComputedStyle(h).lineHeight),lastTitleLine:rect({getBoundingClientRect:()=>lineRects.at(-1)}),arrow:rect(arrow),arrowInline:arrow.parentElement===h,hiddenArrow:arrow.getAttribute('aria-hidden'),border:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth],radius:s.borderRadius,background:s.backgroundColor,shadow:s.boxShadow,clipped:p.scrollWidth>p.clientWidth+1||h.scrollWidth>h.clientWidth+1,separator:getComputedStyle(a.closest('li')).borderTopWidth};
    })};
  })()`);
  const validate=data=>{
    assert.equal(data.overflow,false);assert.ok(data.rows.length>0);
    for(const [i,row] of data.rows.entries()){
      assert.ok(row.title&&row.description&&row.path.startsWith('/tools/'));
      assert.equal(row.links,1);assert.equal(row.hiddenArrow,'true');assert.equal(row.clipped,false);
      assert.ok(row.width>=44&&row.height>=44&&row.x>=0&&row.right<=data.width,'Whole row is a generous native link');
      assert.deepEqual(row.border,['0px','0px','0px','0px']);assert.equal(row.radius,'0px');assert.equal(row.background,'rgba(0, 0, 0, 0)');assert.equal(row.shadow,'none');
      assert.equal(row.arrowInline,true);assert.equal(row.titleWeight,'400');assert.ok(row.arrow.right<=row.right+1);
      assert.ok(Math.abs(row.arrow.y-row.lastTitleLine.y)<=row.titleLineHeight+1,'Arrow follows the last title line, including reflow');
      if(Math.abs(row.arrow.y-row.lastTitleLine.y)<row.titleLineHeight/2)assert.ok(row.arrow.x-row.lastTitleLine.right>=0&&row.arrow.x-row.lastTitleLine.right<=row.titleSize*.3,'Arrow stays close to title');
      if(i){assert.ok(row.y>=data.rows[i-1].bottom,'Rows remain vertical');assert.equal(row.separator,'1px');}
    }
  };
  const key=async(value,code,virtualKey,modifiers=0)=>{
    for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:value,code,windowsVirtualKeyCode:virtualKey,modifiers,...(value==='Enter'&&type==='keyDown'?{text:'\r'}:{})});
  };
  for(const width of [320,390,1487])for(const scale of [100,200]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<761});await navigate();
    if(scale===200)await evaluate(`document.documentElement.style.fontSize='200%'`);
    await evaluate(`document.querySelector('[aria-labelledby="tools-heading"]').scrollIntoView({block:'center'})`);await settle();
    const data=await snapshot();validate(data);
    assert.equal(data.heading.text,'ブラウザツール');
    if(scale===100){assert.equal(data.heading.lines,1);assert.ok(data.listing.x>data.heading.x&&data.listing.right<=width&&data.listing.y<data.heading.bottom,'Short heading and listing link share one row');assert.equal(data.rows[0].titleSize,18);assert.ok(data.heading.fontSize/data.rows[0].titleSize>=1.4);assert.ok(data.footerTop-data.rows.at(-1).descriptionRect.bottom<=56,'Description-to-footer whitespace is reduced');}
    await audit('home tool rows '+width+'/'+scale);
    if(scale===100||width===320)await screenshot('home-tool-rows-'+width+'-'+scale+'.png');
    records.push({status:'home-tool-rows-pass',scale,...data});
    // Browser-only layout fixture: never written into the public catalog or build.
    await evaluate(`(()=>{const list=document.querySelector('.home-tool-list'),template=list.firstElementChild;for(let i=0;i<2;i++){const row=template.cloneNode(true);row.dataset.syntheticToolRow='';row.querySelector('h3').firstChild.textContent='検証用の長いツール名 ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(3);row.querySelector('p').textContent='検証用の説明です。'.repeat(30);row.querySelectorAll('[data-home-new]').forEach(n=>n.remove());list.append(row)}})()`);
    const multiple=await snapshot();validate(multiple);assert.equal(multiple.rows.length,data.rows.length+2);records.push({status:'home-tool-multiple-synthetic-rows-pass',scale,...multiple});
  }
  for(const noScript of [false,true]){
    await send('Emulation.setScriptExecutionDisabled',{value:noScript});
    try{
      await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await navigate();
      const data=await snapshot();validate(data);
      const history=await send('Page.getNavigationHistory'),entryId=history.entries[history.currentIndex].id,target=data.rows[0].path;
      await evaluate(`document.querySelector('[aria-labelledby="tools-heading"] .section-heading a').focus()`);await key('Tab','Tab',9);
      assert.equal(await evaluate(`document.activeElement.matches('.home-tool-row')&&document.activeElement.matches(':focus-visible')&&parseFloat(getComputedStyle(document.activeElement).outlineWidth)>=2`),true,'Tab reaches one visible focus ring per row');
      await key('Enter','Enter',13);await until(()=>evaluate(`location.pathname===${JSON.stringify(target)}&&document.readyState==='complete'`),'Tool row keyboard destination');
      await send('Page.navigateToHistoryEntry',{entryId});await until(()=>evaluate(`location.pathname==='/'&&document.readyState==='complete'&&Boolean(document.querySelector('.home-tool-row'))`),'Tool row history back');
      await evaluate(`document.querySelector('.home-tool-row').scrollIntoView({block:'center'})`);await settle();
      const point=await evaluate(`(()=>{const r=document.querySelector('.home-tool-row').getBoundingClientRect();return{x:r.x+12,y:Math.max(r.y+12,document.querySelector('.header-band').getBoundingClientRect().bottom+12)}})()`);
      assert.ok(point.y>0&&point.y<844,'Touch point is visible');
      await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,radiusX:4,radiusY:4,force:1}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await until(()=>evaluate(`location.pathname===${JSON.stringify(target)}&&document.readyState==='complete'`),'Tool row touch destination');
      await send('Page.navigateToHistoryEntry',{entryId});await until(()=>evaluate(`location.pathname==='/'&&document.readyState==='complete'&&Boolean(document.querySelector('.home-tool-row'))`),'Tool touch history back');
      if(noScript){await evaluate(`document.querySelector('[aria-labelledby="tools-heading"]').scrollIntoView({block:'center'})`);await screenshot('home-tool-rows-nojs-390.png');}
      records.push({status:'home-tool-native-keyboard-touch-history-pass',noScript,target});
    }finally{await send('Emulation.setScriptExecutionDisabled',{value:false});}
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1487,height:1058,deviceScaleFactor:1,mobile:false});
  await navigate();return records;
}
