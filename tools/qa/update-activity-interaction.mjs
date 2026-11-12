import assert from 'node:assert/strict';

export async function verifyUpdateActivityInteraction({ send, evaluate, until, origin, audit, screenshot }) {
  const records = [];
  const snapshot = () => evaluate(`(()=>{
    const root=document.querySelector('[data-update-activity]'),cells=[...root.querySelectorAll('.home-update-week')],bars=cells.map(n=>n.firstElementChild),plot=root.querySelector('.home-update-plot'),banner=root.querySelector('[data-update-banner]'),latest=root.querySelector('[data-update-latest]'),heading=root.querySelector('h2'),article=document.querySelector('#records-heading');
    const rect=n=>{const r=n.getBoundingClientRect();return{x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width,height:r.height}},font=n=>{const s=getComputedStyle(n);return{family:s.fontFamily,size:s.fontSize,weight:s.fontWeight,spacing:s.letterSpacing}};
    const slots=[...document.querySelectorAll('[data-home-new]')],visible=[...new Map(slots.filter(n=>!n.hidden).map(n=>[n.dataset.homeNew,n])).values()];
    return {heading:heading.textContent,headingFont:font(heading),articleHeadingFont:font(article),articleHeading:rect(article),viewportHeight:innerHeight,plot:rect(plot),banner:rect(banner),count:cells.length,current:root.querySelectorAll('[data-current]').length,recent:root.querySelectorAll('[data-recent]').length,summary:root.querySelector('.home-update-summary')?.textContent,latest:latest.textContent,bannerText:banner.textContent,newBanner:root.querySelectorAll('[data-update-new]').length,newSlots:visible.map(n=>({id:n.dataset.homeNew,text:n.textContent,kind:n.closest('.article-card')?'article':n.closest('.project-slide')?'project':'tool'})),hiddenSlots:slots.filter(n=>n.hidden).length,totals:cells.map(n=>Number(n.dataset.total)),widths:cells.map(n=>rect(n).width),tops:cells.map(n=>rect(n).y),heights:bars.map(n=>rect(n).height),gaps:bars.slice(1).map((n,i)=>rect(n).x-rect(bars[i]).right),visibleNumbers:bars.some(n=>n.textContent.trim()),labels:bars.map(n=>n.getAttribute('aria-label')),tooltips:bars.map(n=>n.title),before:cells.filter(n=>n.hasAttribute('data-before-launch')).length,prelaunch:root.querySelectorAll('.home-update-prelaunch').length,preStyle:root.querySelector('.home-update-prelaunch')?getComputedStyle(root.querySelector('.home-update-prelaunch')).borderTopStyle:null,preWidth:root.querySelector('.home-update-prelaunch')?rect(root.querySelector('.home-update-prelaunch')).width:0,preCellWidth:cells.filter(n=>n.hasAttribute('data-before-launch')).reduce((a,n)=>a+rect(n).width,0),outlines:bars.map(n=>getComputedStyle(n).outlineStyle),zeroFills:cells.filter(n=>!n.hasAttribute('data-before-launch')&&n.dataset.total==='0').map(n=>getComputedStyle(n.firstElementChild).backgroundColor),months:root.querySelector('.home-update-axis')?.textContent,triangle:rect(root.querySelector('.home-update-pointer')),triangleLabel:root.querySelector('.home-update-pointer').getAttribute('aria-label'),launchLabel:root.querySelector('.home-update-launch-axis')?.textContent??'',interactive:root.querySelectorAll('.home-update-strip a,.home-update-strip button,.home-update-strip [tabindex]').length,overflow:document.documentElement.scrollWidth>innerWidth,animation:[...root.querySelectorAll('*')].some(n=>getComputedStyle(n).animationName!=='none'),fixture:root.querySelector('[data-update-fixture]')?.textContent,fonts:[...root.querySelectorAll('.home-meta,.home-number')].map(font),bodyFont:font(document.querySelector('.home-catch')),summaryFont:root.querySelector('.home-update-summary')?font(root.querySelector('.home-update-summary')):null,titleFont:font(root.querySelector('.home-update-title')),articleTitleFont:font(document.querySelector('.article-card h3')),projectMetaFont:font(document.querySelector('.project-slide .eyebrow'))};
  })()`);
  const navigate=async(scenario,query='')=>{
    await send('Page.navigate',{url:origin+'/__updates-fixture__/'+scenario+'/'+query});
    await until(()=>evaluate(`location.pathname==='/__updates-fixture__/${scenario}/'&&document.readyState==='complete'&&document.querySelector('[data-update-ready]')?.dataset.updateReady==='true'`),'live update fixture');
    await evaluate('document.fonts.ready');
  };
  for(const width of [320,390,1487]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<760});
    for(const scenario of ['current','four-days','current-labeled','sliding','stalled','recent','invalid','article-latest']){
      await navigate(scenario); const data=await snapshot();
      assert.equal(data.heading,'更新状況'); assert.deepEqual(data.headingFont,data.articleHeadingFont);
      assert.equal(data.count,13);assert.equal(data.current,1);assert.equal(data.recent,0);assert.equal(data.interactive,0);
      assert.equal(new Set(data.tops).size,1);assert.ok(data.widths.every(w=>Math.abs(w-data.plot.width/13)<.1));
      assert.ok(Math.abs(data.plot.x-data.banner.x)<1);assert.ok(Math.abs(data.plot.width-Math.min(520,data.banner.width))<1);
      assert.ok(data.heights.every(h=>h>=12&&h<=16));assert.ok(data.gaps.every(g=>g>=1.99&&g<=3));
      assert.equal(data.before,['sliding','stalled'].includes(scenario)?0:7);assert.equal(data.prelaunch,data.before?1:0);
      if(data.before){assert.equal(data.preStyle,'dashed');assert.ok(Math.abs(data.preWidth-data.preCellWidth)<=1.1);}
      assert.ok(data.outlines.every(s=>s==='none'));assert.ok(data.zeroFills.every(s=>s==='rgb(229, 220, 237)'));
      assert.equal(data.triangleLabel,'今週');assert.ok(data.triangle.width>=8&&data.triangle.width<=10);assert.ok(data.triangle.height>=8&&data.triangle.height<=10);
      assert.ok(Math.abs(data.triangle.x+data.triangle.width/2-(data.plot.right-data.plot.width/26))<1);
      assert.equal(data.launchLabel,scenario==='current-labeled'?'公開':'');
      assert.equal(data.visibleNumbers,false);assert.deepEqual(data.labels,data.tooltips);assert.match(data.months,/\d+月/);
      assert.ok(data.labels.every(label=>/^\d{4}-\d{2}-\d{2}の週：(\d+件|サイト公開前（集計対象外）)/.test(label)));
      assert.equal(data.overflow,false);assert.equal(data.animation,false);assert.ok(data.fixture.includes('実際の更新記録ではありません'));
      assert.ok(data.fonts.every(font=>font.family===data.projectMetaFont.family));
      assert.equal(data.summaryFont.family,data.bodyFont.family);assert.equal(data.titleFont.family,data.bodyFont.family);assert.equal(data.articleTitleFont.family,data.bodyFont.family);
      const fresh=!['four-days','stalled','invalid'].includes(scenario);
      assert.equal(data.newBanner,fresh?1:0);assert.equal(data.newSlots.length,fresh?3:0);
      if(fresh){assert.deepEqual(data.newSlots.map(n=>n.kind).sort(),['article','project','tool']);assert.ok(data.newSlots.every(n=>n.text.includes('新着')));}
      if(scenario==='stalled'){assert.ok(data.totals.slice(-8).every(n=>n===0));assert.equal(data.latest,'65日前');}
      else {assert.equal(data.summary,['current','current-labeled','four-days','sliding'].includes(scenario)?'直近13週で9件':'直近13週で3件');}
      if(['current','article-latest'].includes(scenario))assert.equal(data.latest,'2日前');
      if(scenario==='four-days')assert.equal(data.latest,'4日前');
      await audit('update strip '+scenario+' '+width);await screenshot('home-updates-'+scenario+'-'+width+'.png');records.push({width,scenario,...data});
      if(width<=390&&['sliding','current-labeled'].includes(scenario)){
        await evaluate("document.documentElement.style.fontSize='200%'");const zoom=await snapshot();assert.equal(zoom.overflow,false);assert.equal(zoom.count,13);
        await screenshot('home-updates-'+scenario+'-'+width+'-text200.png');
        await evaluate("window.scrollTo(0,Math.max(0,document.querySelector('[data-update-activity]').getBoundingClientRect().top+scrollY-90))");
        await screenshot('home-updates-'+scenario+'-'+width+'-text200-focused.png');records.push({width,scenario:scenario+'-text200',...zoom});
      }
    }
  }
  for(const timezoneId of ['America/Los_Angeles','Asia/Tokyo']){
    await send('Emulation.setTimezoneOverride',{timezoneId});await navigate('current');records.push({timezoneId,...await snapshot()});
  }
  assert.deepEqual(records.at(-1).labels,records.at(-2).labels);assert.equal(records.at(-1).latest,records.at(-2).latest);
  await send('Emulation.setTimezoneOverride',{timezoneId:''});
  for(const instant of ['2027-02-01T12:00:00+09:00','2027-02-22T12:00:00+09:00']){
    const now=Date.parse(instant),script=await send('Page.addScriptToEvaluateOnNewDocument',{source:`if(location.pathname.startsWith('/__updates-fixture__/')){const OriginalDate=Date;window.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:[${now}]))}static now(){return ${now}}};}`});
    try{
      await send('Emulation.setDeviceMetricsOverride',{width:320,height:900,deviceScaleFactor:1,mobile:true});await navigate('sliding','?at='+encodeURIComponent(instant));
      await evaluate("document.documentElement.style.fontSize='200%';document.fonts.ready");const data=await snapshot();assert.equal(data.overflow,false);
      const labels=await evaluate(`(()=>[...document.querySelectorAll('.home-update-axis span')].filter(n=>n.textContent).map(n=>{const range=document.createRange();range.selectNodeContents(n);const r=range.getBoundingClientRect();return{x:r.x,right:r.right}}))()`);
      assert.ok(labels.every((label,index)=>label.x>=0&&label.right<=320&&(index===0||labels[index-1].right<=label.x)),'Month labels fit without overlap');
      await screenshot('home-updates-month-edge-'+instant.slice(0,10)+'-320-text200.png');
      await evaluate("window.scrollTo(0,Math.max(0,document.querySelector('[data-update-activity]').getBoundingClientRect().top+scrollY-90))");
      await screenshot('home-updates-month-edge-'+instant.slice(0,10)+'-320-text200-focused.png');records.push({scenario:'month-edge',instant,...data});
    }finally{await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:script.identifier});}
  }
  await send('Emulation.setScriptExecutionDisabled',{value:true});
  try{
    for(const width of [320,390,1487]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<760});
      await send('Page.navigate',{url:origin+'/'});
      await until(()=>evaluate("location.pathname==='/'&&document.readyState==='complete'&&!document.querySelector('[data-update-ready]')"),'real no JS fallback');
      const data=await snapshot();assert.equal(data.count,0);assert.match(data.latest,/^\d{4}-\d{2}-\d{2}$/);assert.equal(data.newBanner,0);assert.equal(data.newSlots.length,0);assert.equal(data.triangleLabel,'今週');assert.equal(data.overflow,false);
      await screenshot('home-updates-nojs-'+width+'.png');records.push({width,scenario:'nojs',...data});
    }
  }finally{await send('Emulation.setScriptExecutionDisabled',{value:false});}
  for(const [width,height] of [[320,568],[390,844],[1487,1058]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<760});await send('Page.navigate',{url:origin+'/'});
    await until(()=>evaluate("location.pathname==='/'&&document.readyState==='complete'&&!!document.querySelector('[data-update-ready]')"),'real update strip');await evaluate('document.fonts.ready');
    await evaluate('window.scrollTo(0,0)');
    const data=await snapshot();const spacing=await evaluate(`(()=>{const summary=document.querySelector('.home-update-summary'),divider=document.querySelector('.records[aria-labelledby="records-heading"] .section-heading');return {summaryToDivider:divider.getBoundingClientRect().top-summary.getBoundingClientRect().bottom}})()`);
    assert.ok(spacing.summaryToDivider>=0&&spacing.summaryToDivider<=20);assert.equal(data.overflow,false);
    // Explicitly measure the first view, rather than scrolling the article heading into view.
    const articleHeadingInInitialViewport=data.articleHeading.y>=0&&data.articleHeading.bottom<=height;
    console.log('Home initial viewport: '+JSON.stringify({width,height,articleHeading:data.articleHeading,articleHeadingInInitialViewport}));
    await screenshot('home-updates-real-initial-'+width+'.png');records.push({width,height,scenario:'real-initial',articleHeadingInInitialViewport,...data,...spacing});
  }
  return records;
}
