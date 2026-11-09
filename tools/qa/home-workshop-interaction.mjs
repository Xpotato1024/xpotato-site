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
      title:document.querySelector('#home-title').innerText.replace(/\\s+/g,' ').trim(),brand:document.querySelector('.home-brand')?.textContent??null,titleWords:[...document.querySelectorAll('.home-title-static > span')].map(rect),projectStart:rect(document.querySelector('.home-projects .section-heading')),firstProject:rect(document.querySelector('.project-slide')),cta:{radius:getComputedStyle(document.querySelector('.home-primary-link')).borderRadius,gap:getComputedStyle(document.querySelector('.home-primary-link')).gap},
      introductionBackground:getComputedStyle(intro).backgroundImage,links:links('.intro-links a'),about:links('.home-introduction > a'),topics:links('.home-topics a'),contact:links('.home-contact a'),
      introAfterHero:hero.nextElementSibling===intro,duplicateCatch:document.querySelector('main').textContent.includes('考えたことを、つくって確かめる。'),
      incorrectArrows:[...document.querySelectorAll('main a')].filter(a=>a.origin===location.origin&&a.textContent.includes('↗')).map(a=>a.href)};
  })()`);
  // Sample the real opaque button behind its hidden label; test the computed dark text.
  const sampleCtaContrast=async()=>{
    const bounds=await evaluate(`(()=>{const a=document.querySelector('.home-primary-link'),r=a.getBoundingClientRect(),t=a.firstElementChild.getBoundingClientRect(),s=getComputedStyle(a);return{label:{x:t.x,y:t.y,width:t.width,height:t.height},color:s.color,background:s.backgroundColor,backdrop:s.backdropFilter}})()`);
    const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    assert.equal(bounds.backdrop,'none','Hero CTA must not use glass');
    const color=bounds.color.match(/[\d.]+/g).slice(0,3).map(Number),textLum=luminance(color);
    assert.ok(textLum<.1,'CTA label stays dark');
    assert.ok(luminance(bounds.background.match(/[\d.]+/g).slice(0,3).map(Number))>.9,'CTA background stays light');
    assert.ok(!bounds.background.startsWith('rgba')||Number(bounds.background.match(/[\d.]+/g)[3])===1,'CTA is opaque');
    try{
      await evaluate(`(()=>{for(const s of document.querySelectorAll('.home-primary-link > span'))s.style.visibility='hidden';return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))})()`);
      const capture=await send('Page.captureScreenshot',{format:'png',clip:{...bounds.label,scale:1}});
      const {data,info}=await sharp(Buffer.from(capture.data,'base64')).removeAlpha().raw().toBuffer({resolveWithObject:true});
      let min=1;for(let i=0;i<data.length;i+=info.channels)min=Math.min(min,luminance([...data.subarray(i,i+3)]));
      const textRatio=(min+.05)/(textLum+.05);assert.ok(textRatio>=4.5,'Rendered CTA dark text contrast '+textRatio);
      return{textRatio,method:'minimum rendered background luminance behind hidden label versus computed dark text'};
    }finally{await evaluate(`(()=>{for(const s of document.querySelectorAll('.home-primary-link > span'))s.style.removeProperty('visibility');return true})()`);}
  };
  const validateLayout=data=>{
    assert.equal(data.overflow,false);assert.equal(data.introAfterHero,true);assert.equal(data.duplicateCatch,false);
    assert.equal(data.title,'Think. Build. Run.');assert.equal(data.brand,null);
    assert.deepEqual(data.topics,[],'The introduction no longer maps the three phrases to potentially misleading destinations');
    assert.equal(data.introductionBackground,'none');
    const rows=new Set(data.titleWords.map(word=>Math.round(word.y)));
    assert.equal(rows.size,3,'The static headline keeps three rows');
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
  const sampleHeaderContrast=async()=>{
    const logoResponse=await fetch(origin+'/xpotato-logo.svg');assert.equal(logoResponse.status,200);
    const logoColors=[...(await logoResponse.text()).matchAll(/fill="#([a-f0-9]{6})"/gi)].map(match=>[0,2,4].map(index=>parseInt(match[1].slice(index,index+2),16)));
    assert.ok(logoColors.length,'Logo has measurable solid fill colors');
    const samples=await evaluate(`(()=>{
      const targets=[];
      const add=(selector,kind)=>document.querySelectorAll(selector).forEach(node=>{
        const style=getComputedStyle(node),box=node.getBoundingClientRect();if(!box.width||!box.height)return;
        let r=box;
        if(kind==='text'&&node.firstChild?.nodeType===Node.TEXT_NODE){const range=document.createRange();range.selectNode(node.firstChild);r=range.getBoundingClientRect();}
        if(kind==='input')r={x:box.x+parseFloat(style.paddingLeft),y:box.y+parseFloat(style.paddingTop),width:Math.max(1,box.width-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)),height:parseFloat(style.lineHeight)};
        const color=kind==='input'?getComputedStyle(node,'::placeholder').color:style.color;
        targets.push({selector,kind,color,x:r.x,y:r.y,width:r.width,height:r.height});
      });
      add('.brand > span','text');add('.brand-domain','text');add('.desktop-navigation a','text');add('.header-search input','input');
      add('.brand img','logo');add('.mobile-search svg,.header-search button svg,.menu-icon','icon');
      window.__homeHeaderContrastRestore=[];
      for(const node of document.querySelectorAll('.brand > span,.brand-domain,.desktop-navigation a,.header-search input,.brand img,.mobile-search svg,.header-search button svg,.menu-icon')){
        window.__homeHeaderContrastRestore.push([node,node.getAttribute('style'),node.getAttribute('placeholder')]);
        if(node.matches('img,svg,.menu-icon'))node.style.visibility='hidden';else node.style.setProperty('color','transparent','important');
        if(node.matches('input'))node.setAttribute('placeholder','');
      }
      return{targets,viewportWidth:innerWidth,state:document.querySelector('.header-band').dataset.homeHeaderState};
    })()`);
    try{
      await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))`);
      const capture=await send('Page.captureScreenshot',{format:'png'});
      const {data,info}=await sharp(Buffer.from(capture.data,'base64')).removeAlpha().raw().toBuffer({resolveWithObject:true});
      const scale=info.width/samples.viewportWidth;
      const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      const results=samples.targets.map(target=>{
        // Initial logo is CSS-inverted white; use its lightest real fill on the pale scrolled surface.
        const textLum=target.kind==='logo'? (samples.state==='top'?1:Math.max(...logoColors.map(luminance))):luminance(target.color.match(/[\d.]+/g).slice(0,3).map(Number));
        let minRatio=Infinity;
        for(let y=Math.max(0,Math.ceil(target.y*scale));y<Math.min(info.height,Math.floor((target.y+target.height)*scale));y++)for(let x=Math.max(0,Math.ceil(target.x*scale));x<Math.min(info.width,Math.floor((target.x+target.width)*scale));x++){
          const offset=(y*info.width+x)*info.channels,background=luminance([...data.subarray(offset,offset+3)]);
          minRatio=Math.min(minRatio,(Math.max(background,textLum)+.05)/(Math.min(background,textLum)+.05));
        }
        const required=['icon','logo'].includes(target.kind)?3:4.5;
        assert.ok(Number.isFinite(minRatio)&&minRatio>=required,'Header '+samples.state+' '+target.selector+' contrast '+minRatio+' requires '+required);
        return{selector:target.selector,kind:target.kind,minRatio,required};
      });
      return{state:samples.state,method:'minimum rendered background contrast over text/icon bounds with glyphs hidden and surfaces preserved',results};
    }finally{await evaluate(`(()=>{for(const [node,style,placeholder] of window.__homeHeaderContrastRestore){style===null?node.removeAttribute('style'):node.setAttribute('style',style);if(node.matches('input'))placeholder===null?node.removeAttribute('placeholder'):node.setAttribute('placeholder',placeholder)}delete window.__homeHeaderContrastRestore;return true})()`);}
  };
  const headerSnapshot=()=>evaluate(`(()=>{
    const h=document.querySelector('.header-band'),s=getComputedStyle(h),r=h.getBoundingClientRect();
    const boxes=[...document.querySelectorAll('.home-intro,#home-title,.home-primary-link,.home-introduction')].map(n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y+scrollY,width:b.width,height:b.height}});
    return{state:h.dataset.homeHeaderState,position:s.position,background:s.backgroundColor,backdrop:s.backdropFilter,shadow:s.boxShadow,height:r.height,top:r.top,boxes,reserved:parseFloat(getComputedStyle(document.body).getPropertyValue('--home-header-height')),
      animations:document.querySelector('.home-intro').getAnimations({subtree:true}).length,
      obsolete:document.querySelectorAll('.home-title-japanese,.home-title-accessible,.home-display-settings').length,
      words:[...document.querySelectorAll('.home-title-static > span')].map(n=>n.textContent.trim()),hidden:document.querySelector('#home-title [aria-hidden="true"]')!==null};
  })()`);
  const scrollTo=async(y)=>{
    await evaluate(`window.scrollTo({top:${y},behavior:'instant'})`);
    await until(()=>evaluate(`document.querySelector('.header-band').dataset.homeHeaderState===${JSON.stringify(y<=24?'top':'scrolled')} && document.querySelector('.header-band').getAnimations({subtree:false}).every(a=>a.playState==='finished'||a.playState==='idle')`),'Header settled at '+y);
  };
  const stable=(before,after)=>{
    assert.equal(after.height,before.height,'Header geometry stays fixed');
    for(let i=0;i<before.boxes.length;i++)for(const key of ['x','y','width','height'])assert.ok(Math.abs(before.boxes[i][key]-after.boxes[i][key])<1,'No document-coordinate layout shift: '+i+'/'+key);
  };
  const key=async(name,code,number)=>{for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:name,code,windowsVirtualKeyCode:number,...(name==='Enter'&&type==='keyDown'?{text:'\r'}:{})});};
  const menuAtPosition=async(y)=>{
    await scrollTo(y);
    await evaluate(`document.querySelector('.mobile-menu-toggle').focus({preventScroll:true})`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.querySelector('#site-menu').matches(':popover-open') && document.querySelector('.mobile-menu-toggle').getAttribute('aria-expanded')==='true'`),'Menu opens at '+y);
    await key('Escape','Escape',27);
    await until(()=>evaluate(`!document.querySelector('#site-menu').matches(':popover-open') && document.querySelector('.mobile-menu-toggle').getAttribute('aria-expanded')==='false'`),'Menu closes at '+y);
    assert.equal(await evaluate(`document.activeElement===document.querySelector('.mobile-menu-toggle')`),true);
    for(const count of [11,12,1]){
      const before=await evaluate(`document.querySelector('#site-menu').matches(':popover-open')`);
      await evaluate(`for(let i=0;i<${count};i++)document.querySelector('.mobile-menu-toggle').click()`);
      await until(()=>evaluate(`document.querySelector('#site-menu').matches(':popover-open')===${count%2?!before:before}`),'Repeated menu clicks at '+y);
    }
    await evaluate(`document.querySelector('.mobile-search').focus({preventScroll:true})`);await key('Enter','Enter',13);
    await until(()=>evaluate(`location.pathname==='/search/' && document.readyState==='complete'`),'Keyboard search at '+y);
    await navigate();
  };
  for(const width of [320,390,1440]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:false});await navigate();await scrollTo(0);
    const top=await headerSnapshot();
    assert.equal(top.position,'fixed');assert.equal(top.top,0);assert.ok(Math.abs(top.reserved-top.height)<1,'Measured header height reserves content space');
    assert.equal(top.animations,0,'Hero and photo have no animations');assert.equal(top.obsolete,0);assert.equal(top.hidden,false);assert.deepEqual(top.words,['Think.','Build.','Run.']);
    assert.equal(top.backdrop,'none','Initial header fuses with photo, without blur');
    const topContrast=await sampleHeaderContrast();await screenshot('home-fused-header-'+width+'.png');await scrollTo(24);assert.equal((await headerSnapshot()).state,'top');await scrollTo(25);assert.equal((await headerSnapshot()).state,'scrolled');await scrollTo(300);
    const scrolled=await headerSnapshot();stable(top,scrolled);assert.notEqual(scrolled.backdrop,'none','Scrolled header uses backdrop glass');assert.notEqual(scrolled.background,top.background);
    const scrolledContrast=await sampleHeaderContrast();await screenshot('home-glass-header-'+width+'.png');await scrollTo(0);stable(top,await headerSnapshot());
    if(width<=390){await menuAtPosition(0);await menuAtPosition(300);}
    else for(const y of [0,300]){
      await scrollTo(y);await evaluate(`document.querySelector('#header-search-query').focus({preventScroll:true});document.querySelector('#header-search-query').value='test'`);await key('Enter','Enter',13);
      await until(()=>evaluate(`location.pathname==='/search/' && new URLSearchParams(location.search).get('q')==='test'`),'Desktop keyboard search at '+y);await navigate();
    }
    records.push({status:'static-hero-fused-and-glass-header-layout-and-keyboard-pass',viewportWidth:width,top,scrolled,topContrast,scrolledContrast});
  }
  // Retain full native and details-fallback regression, including history restoration.
  await navigate();await verifyMenu();
  await send('Emulation.setScriptExecutionDisabled',{value:true});
  try{
    await navigate();
    for(const y of [0,300]){
      await evaluate(`window.scrollTo({top:${y},behavior:'instant'})`);const data=await headerSnapshot();
      assert.equal(data.position,'fixed');assert.equal(data.animations,0);assert.notEqual(data.background,'rgba(0, 0, 0, 0)','Without JS the header retains a readable background');assert.notEqual(data.background,'transparent');
    }
    records.push({status:'no-script-readable-header-static-hero-pass'});
  }finally{await send('Emulation.setScriptExecutionDisabled',{value:false});}
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await navigate();
  for(const y of [0,300]){await scrollTo(y);const data=await headerSnapshot();assert.equal(data.animations,0);assert.ok(await evaluate(`getComputedStyle(document.querySelector('.header-band')).transitionDuration.split(',').every(value=>parseFloat(value)<=.00001)`),'Reduced motion disables perceptible header transitions');}
  records.push({status:'reduced-motion-static-hero-and-header-pass'});
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
  const navigationKey=async(key,modifiers=0)=>{for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key,code:key,modifiers,windowsVirtualKeyCode:key==='Tab'?9:13,...(key==='Enter'&&type==='keyDown'?{text:'\r'}:{})});};
  await evaluate('document.querySelector(".intro-links a").focus()');await navigationKey('Tab',8);await navigationKey('Tab');
  assert.equal(await evaluate('document.activeElement.pathname'),'/projects/');
  await navigationKey('Tab');assert.equal(await evaluate('document.activeElement.pathname'),'/about/');
  assert.equal(await evaluate('document.activeElement.matches(":focus-visible")&&parseFloat(getComputedStyle(document.activeElement).outlineWidth)>0'),true,'Intro link focus visible');
  await navigationKey('Enter');await until(()=>evaluate('location.pathname==="/about/"&&document.readyState==="complete"'),'Introduction about navigation');
  await send('Page.navigateToHistoryEntry',{entryId});await until(()=>evaluate('location.pathname==="/"&&document.readyState==="complete"&&Boolean(document.querySelector(".home-contact a"))'),'Back to homepage');
  await evaluate('document.querySelector(".home-contact").scrollIntoView();document.querySelector(".home-contact a").focus()');await navigationKey('Tab',8);await navigationKey('Tab');
  assert.equal(await evaluate('document.activeElement.pathname'),'/contact/');
  assert.equal(await evaluate('document.activeElement.matches(":focus-visible")'),true);await screenshot('home-contact-390.png');await navigationKey('Enter');
  await until(()=>evaluate('location.pathname==="/contact/"&&document.readyState==="complete"&&Boolean(document.querySelector("[data-contact-details]"))'),'Closing contact navigation');
  await send('Page.navigateToHistoryEntry',{entryId});await until(()=>evaluate('location.pathname==="/"&&document.readyState==="complete"&&Boolean(document.querySelector(".home-introduction"))'),'Back from contact');
  records.push({status:'about-contact-keyboard-navigation-and-back-pass'});
  await send('Emulation.setDeviceMetricsOverride',{width:1487,height:1058,deviceScaleFactor:1,mobile:false});await navigate();
  await until(() => evaluate('document.querySelector(".workshop-photo img").naturalWidth > 0'), 'Photo restored after synthetic failure');return records;
}
