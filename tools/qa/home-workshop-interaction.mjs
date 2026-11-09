import assert from 'node:assert/strict';
import sharp from 'sharp';
export async function verifyHomeWorkshopInteraction({ send, evaluate, until, origin, setFailure, verifyMenu, audit, screenshot }) {
  const records = [];
  const navigate = async () => {
    await send('Page.navigate', { url: origin + '/' });
    await until(() => evaluate('document.readyState === "complete" && Boolean(document.querySelector(".workshop-photo img"))'), 'Homepage photo markup');
    await evaluate('document.fonts.ready.then(()=>true)');
  };
  const snapshot = () => evaluate(`(() => {
    const img=document.querySelector('.workshop-photo img'),hero=document.querySelector('.home-intro'),intro=document.querySelector('.home-introduction');
    const rect=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
    const links=selector=>[...document.querySelectorAll(selector)].map(a=>({path:a.pathname,text:a.textContent.replace('→','').trim(),...rect(a)}));
    return {complete:img.complete,naturalWidth:img.naturalWidth,currentSrc:img.currentSrc,width:img.getAttribute('width'),height:img.getAttribute('height'),loading:img.loading,priority:img.fetchPriority,alt:img.alt,
      viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},sourceWidth:Number([...img.closest('picture').querySelectorAll('[srcset]')].flatMap(node=>node.srcset.split(',')).map(value=>value.trim().split(' ')).find(([url])=>new URL(url,location.href).href===img.currentSrc)?.[1]?.replace('w','')),
      overflow:document.documentElement.scrollWidth>innerWidth,hero:rect(hero),introduction:rect(intro),background:getComputedStyle(hero).backgroundColor,
      title:document.querySelector('.home-title-accessible').textContent.trim(),brand:document.querySelector('.home-brand')?.textContent??null,titleWords:[...document.querySelectorAll('.home-title-row')].map(rect),projectStart:rect(document.querySelector('.home-projects .section-heading')),firstProject:rect(document.querySelector('.project-slide')),cta:{radius:getComputedStyle(document.querySelector('.button-glass')).borderRadius,gap:getComputedStyle(document.querySelector('.button-glass')).gap},
      introductionBackground:getComputedStyle(intro).backgroundImage,links:links('.intro-links a'),about:links('.home-introduction > a'),topics:links('.home-topics a'),contact:links('.home-contact a'),
      introAfterHero:hero.nextElementSibling===intro,duplicateCatch:document.querySelector('main').textContent.includes('考えたことを、つくって確かめる。'),
      incorrectArrows:[...document.querySelectorAll('main a')].filter(a=>a.origin===location.origin&&a.textContent.includes('↗')).map(a=>a.href)};
  })()`);
  // Sample the rendered photo/glass behind the white label, without glyphs or text shadow.
  // This is a conservative pixel check, not a full WCAG or assistive-technology certification.
  const sampleCtaContrast=async()=>{
    const bounds=await evaluate(`(()=>{const a=document.querySelector('.button-glass'),r=a.getBoundingClientRect(),t=a.firstElementChild.getBoundingClientRect();return{button:{x:r.x,y:r.y,width:r.width,height:r.height},label:{x:t.x,y:t.y,width:t.width,height:t.height},border:getComputedStyle(a).borderColor}})()`);
    const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    try{
      await evaluate(`(()=>{for(const s of document.querySelectorAll('.button-glass > span'))s.style.visibility='hidden';return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))})()`);
      const capture=await send('Page.captureScreenshot',{format:'png',clip:{...bounds.label,scale:1}});
      const {data,info}=await sharp(Buffer.from(capture.data,'base64')).removeAlpha().raw().toBuffer({resolveWithObject:true});
      let max=0;for(let i=0;i<data.length;i+=info.channels)max=Math.max(max,luminance([...data.subarray(i,i+3)]));
      const textRatio=1.05/(max+.05);
      const b=bounds.button,margin=4,clip={x:b.x-margin,y:b.y-margin,width:b.width+margin*2,height:b.height+margin*2,scale:1};
      const outside=await send('Page.captureScreenshot',{format:'png',clip});
      const pixels=await sharp(Buffer.from(outside.data,'base64')).removeAlpha().raw().toBuffer({resolveWithObject:true}),sx=pixels.info.width/clip.width,sy=pixels.info.height/clip.height;
      const at=(x,y)=>{const i=(Math.min(pixels.info.height-1,Math.round(y*sy))*pixels.info.width+Math.min(pixels.info.width-1,Math.round(x*sx)))*pixels.info.channels;return luminance([...pixels.data.subarray(i,i+3)])};
      let adjacent=0;for(let x=12;x<b.width-12;x++)adjacent=Math.max(adjacent,at(x+margin,margin-2),at(x+margin,margin+b.height+2));
      const borderLum=luminance(bounds.border.match(/[\d.]+/g).slice(0,3).map(Number)),borderRatio=(borderLum+.05)/(adjacent+.05);
      assert.ok(textRatio>=4.5,'Rendered CTA white text contrast '+textRatio);assert.ok(borderRatio>=3,'Rendered neutral edge contrast '+borderRatio);
      return{textRatio,borderRatio,method:'maximum rendered background luminance behind hidden label; straight-edge adjacent photo samples'};
    }finally{await evaluate(`(()=>{for(const s of document.querySelectorAll('.button-glass > span'))s.style.removeProperty('visibility');return true})()`);}
  };
  const validateLayout=data=>{
    assert.equal(data.overflow,false);assert.equal(data.introAfterHero,true);assert.equal(data.duplicateCatch,false);
    assert.equal(data.title,'Think. Build. Run. ものづくり、プログラミング、日々の試行錯誤。');assert.equal(data.brand,null);
    assert.deepEqual(data.topics,[],'The introduction no longer maps the three phrases to potentially misleading destinations');
    assert.equal(data.introductionBackground,'none');
    const rows=new Set(data.titleWords.map(word=>Math.round(word.y)));
    assert.equal(rows.size,3,'The alternating headline keeps three reserved rows');
    assert.deepEqual(data.links.map(link=>link.path),['/projects/']);
    assert.deepEqual(data.about.map(link=>link.path),['/about/']);
    assert.deepEqual(data.contact.map(link=>link.path),['/contact/']);
    assert.deepEqual(data.incorrectArrows,[]);
    assert.ok([...data.links,...data.about,...data.contact].every(link=>link.width>=44&&link.height>=44&&link.x>=0&&link.right<=data.viewport.width),'Home destinations retain 44px targets and fit');
    assert.equal(data.contact[0].text,'問い合わせ');
    assert.ok(data.about[0].y>=data.hero.bottom,'About lives below the image');
    assert.ok(data.contact[0].y>=data.introduction.bottom,'Contact has its own closing placement');
  };
  for (const [width,height,dpr=1] of [[393,700,2],[393,700,2.625],[393,700,3],[1487,844],[1440,900],[1440,700],[430,832],[431,832],[760,900],[761,900],[393,700],[390,744],[375,667],[390,600],[320,568]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor:dpr, mobile:width<=760 });
    await send('Network.clearBrowserCache');await navigate();
    await until(() => evaluate('document.querySelector(".workshop-photo img").complete && document.querySelector(".workshop-photo img").naturalWidth > 0'), 'Homepage image decoded');
    const data=await snapshot();validateLayout(data);assert.equal(data.width,'2400');assert.equal(data.height,'1350');
    assert.ok((width<=430?[640,960,1280]:[640,960,1440,1920]).includes(data.sourceWidth),'Selected responsive candidate is recorded at each DPR');
    if(width<=430&&dpr>=2)assert.equal(data.sourceWidth,1280,'High-density mobile keeps the original 1080px vertical resolution');
    assert.equal(data.loading,'eager');assert.equal(data.priority,'high');assert.ok(data.alt);
    assert.match(new URL(data.currentSrc).pathname,/^\/media\/v1\/objects\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}\.(avif|webp|jpg)$/);
    if(width<=430){assert.ok(data.introduction.bottom<=height,'Compact hero, description and about link fit the tested mobile first viewport');assert.ok(data.firstProject.y<height,'First project card begins in the tested mobile first viewport');}
    assert.equal(await evaluate('document.querySelector(".mobile-menu-toggle").getAttribute("aria-expanded")'),'false');
    await audit('home introduction '+width+'/'+height+'/'+dpr);const ctaContrast=await sampleCtaContrast();records.push({status:'decoded',...data,ctaContrast});
    if((width===1440&&height===900)||width===393||width===1487||width===390)await screenshot('home-photo-'+width+'-'+height+'-dpr'+dpr+'.png');
  }
  // Meta points to the exact same social image on both platforms, without fetching production.
  const meta=await evaluate(`(()=>{const property=name=>document.querySelector('meta[property="'+name+'"]')?.content,name=value=>document.querySelector('meta[name="'+value+'"]')?.content;return{og:property('og:image'),twitter:name('twitter:image'),card:name('twitter:card'),width:property('og:image:width'),height:property('og:image:height'),alt:property('og:image:alt')}})()`);
  assert.equal(meta.card,'summary_large_image');assert.equal(meta.og,meta.twitter);assert.equal(meta.width,'1200');assert.equal(meta.height,'630');assert.ok(meta.alt);
  const socialUrl=new URL(meta.og);assert.equal(socialUrl.origin,'https://xpotato.net');
  assert.match(socialUrl.pathname,/^\/media\/v1\/objects\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}\.jpg$/);
  const socialResponse=await fetch(origin+socialUrl.pathname);assert.equal(socialResponse.status,200);assert.equal(socialResponse.headers.get('content-type'),'image/jpeg');records.push({status:'social-meta-local-asset-pass',...meta});
  // Inspect both visible phases without waiting for a full 18-second cycle.
  // Web Animations time is changed only in this QA browser, never in the shipped page.
  for(const width of [320,390,1440]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:false});await navigate();
    const start=await snapshot();
    for(const time of [1000,10000]){
      await evaluate(`(()=>{for(const a of document.querySelector('#home-title').getAnimations({subtree:true})){a.pause();a.currentTime=${time}}return true})()`);
      const phase=await snapshot();assert.deepEqual(phase.hero,start.hero);assert.deepEqual(phase.titleWords,start.titleWords,'Language changes do not shift the reserved rows');
      const visible=await evaluate(`(()=>{const all=s=>[...document.querySelectorAll(s)].map(n=>Number(getComputedStyle(n).opacity));return{english:all('.home-title-english'),japanese:all('.home-title-japanese'),hidden:[...document.querySelectorAll('.home-title-row')].every(n=>n.getAttribute('aria-hidden')==='true'),live:document.querySelector('#home-title [aria-live]')!==null}})()`);
      assert.deepEqual(visible.english,[time<9000?1:0,time<9000?1:0,time<9000?1:0]);assert.deepEqual(visible.japanese,[time<9000?0:1,time<9000?0:1,time<9000?0:1]);assert.equal(visible.hidden,true);assert.equal(visible.live,false);
      if(time===10000)await screenshot('home-introduction-japanese-'+width+'.png');
    }
    await navigate();
    await evaluate(`(()=>{for(const a of document.querySelector('#home-title').getAnimations({subtree:true})){a.pause();a.currentTime=8100}return true})()`);
    const fade=await evaluate(`Number(getComputedStyle(document.querySelector('.home-title-japanese')).opacity)`);assert.ok(fade>.45&&fade<.55,'The stop check starts midway through the fade');
    const toggle=await evaluate(`(()=>{const r=document.querySelector('[name="pause-home-title"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,...toggle,button:'left',clickCount:1});
    assert.equal(await evaluate(`document.querySelector('[name="pause-home-title"]').checked`),true);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.home-title-japanese')).opacity`),'1','Stopping during a fade settles to readable Japanese');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.home-title-english')).animationName`),'none');
    for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,...toggle,button:'left',clickCount:1});
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.home-title-english')).animationName`),'home-title-english');
    await evaluate(`document.querySelector('[name="pause-home-title"]').focus()`);
    for(const expected of [true,false]){
      for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:' ',code:'Space',windowsVirtualKeyCode:32,...(type==='keyDown'?{text:' '}: {})});
      assert.equal(await evaluate(`document.querySelector('[name="pause-home-title"]').checked`),expected,'Native Space toggles the stop control');
    }
    records.push({status:'bilingual-layout-and-native-pause-pass',viewportWidth:width});
  }
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await navigate();
  const reduced=await evaluate(`(()=>{const ja=document.querySelector('.home-title-japanese'),en=document.querySelector('.home-title-english');return{animation:getComputedStyle(ja).animationName,japanese:getComputedStyle(ja).opacity,english:getComputedStyle(en).opacity,toggle:getComputedStyle(document.querySelector('.home-motion-toggle')).display}})()`);
  assert.deepEqual(reduced,{animation:'none',japanese:'1',english:'0',toggle:'none'});records.push({status:'reduced-motion-static-japanese-pass'});
  await send('Emulation.setEmulatedMedia',{features:[]});await send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});await navigate();
  const before=await snapshot();
  try {
    setFailure(true);await navigate();
    await until(() => evaluate('document.querySelector(".workshop-photo img").complete && document.querySelector(".workshop-photo img").naturalWidth === 0'), 'Test-only unavailable photo');
    const failure=await snapshot();validateLayout(failure);assert.deepEqual(failure.hero,before.hero,'Image failure must retain layout');assert.deepEqual(failure.introduction,before.introduction);
    assert.equal(failure.background,'rgb(38, 38, 42)');await audit('mobile unavailable photo');await screenshot('home-photo-unavailable.png');await verifyMenu();records.push({status:'503-fallback-menu-pass',...failure});
  } finally { setFailure(false); }
  for(const width of [320,375,390,393,430,1440]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:false});await navigate();await evaluate('document.documentElement.style.fontSize="200%"');
    const data=await snapshot();validateLayout(data);await audit('home introduction '+width+'/200');records.push({textScale:200,status:'home-reflow-pass',...data});
    if(width===320)await screenshot('home-introduction-320-200.png');
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await navigate();
  const history=await send('Page.getNavigationHistory'),entryId=history.entries[history.currentIndex].id;
  const key=async(key,modifiers=0)=>{for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key,code:key,modifiers,windowsVirtualKeyCode:key==='Tab'?9:13,...(key==='Enter'&&type==='keyDown'?{text:'\r'}:{})});};
  await evaluate('document.querySelector(".intro-links a").focus()');await key('Tab',8);await key('Tab');
  assert.equal(await evaluate('document.activeElement.pathname'),'/projects/');
  await key('Tab');assert.equal(await evaluate('document.activeElement.name'),'pause-home-title');await key('Tab');assert.equal(await evaluate('document.activeElement.pathname'),'/about/');
  assert.equal(await evaluate('document.activeElement.matches(":focus-visible")&&parseFloat(getComputedStyle(document.activeElement).outlineWidth)>0'),true,'Intro link focus visible');
  await key('Enter');await until(()=>evaluate('location.pathname==="/about/"&&document.readyState==="complete"'),'Introduction about navigation');
  await send('Page.navigateToHistoryEntry',{entryId});await until(()=>evaluate('location.pathname==="/"&&document.readyState==="complete"&&Boolean(document.querySelector(".home-contact a"))'),'Back to homepage');
  await evaluate('document.querySelector(".home-contact").scrollIntoView();document.querySelector(".home-contact a").focus()');await key('Tab',8);await key('Tab');
  assert.equal(await evaluate('document.activeElement.pathname'),'/contact/');
  assert.equal(await evaluate('document.activeElement.matches(":focus-visible")'),true);await screenshot('home-contact-390.png');await key('Enter');
  await until(()=>evaluate('location.pathname==="/contact/"&&document.readyState==="complete"&&Boolean(document.querySelector("[data-contact-details]"))'),'Closing contact navigation');
  await send('Page.navigateToHistoryEntry',{entryId});await until(()=>evaluate('location.pathname==="/"&&document.readyState==="complete"&&Boolean(document.querySelector(".home-introduction"))'),'Back from contact');
  records.push({status:'about-contact-keyboard-navigation-and-back-pass'});
  await send('Emulation.setDeviceMetricsOverride',{width:1487,height:1058,deviceScaleFactor:1,mobile:false});await navigate();
  await until(() => evaluate('document.querySelector(".workshop-photo img").naturalWidth > 0'), 'Photo restored after synthetic failure');return records;
}
