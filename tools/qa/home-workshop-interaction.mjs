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
    const catchNode=document.querySelector('.home-catch'),catchStyle=getComputedStyle(catchNode),catchRange=document.createRange();catchRange.selectNodeContents(catchNode);
    const links=selector=>[...document.querySelectorAll(selector)].map(a=>({path:a.pathname,text:a.textContent.replace('→','').trim(),...rect(a)}));
    return {complete:img.complete,naturalWidth:img.naturalWidth,currentSrc:img.currentSrc,width:img.getAttribute('width'),height:img.getAttribute('height'),loading:img.loading,priority:img.fetchPriority,alt:img.alt,
      viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},sourceWidth:Number([...img.closest('picture').querySelectorAll('[srcset]')].flatMap(node=>node.srcset.split(',')).map(value=>value.trim().split(' ')).find(([url])=>new URL(url,location.href).href===img.currentSrc)?.[1]?.replace('w','')),
      overflow:document.documentElement.scrollWidth>innerWidth,hero:rect(hero),introduction:rect(intro),background:getComputedStyle(hero).backgroundColor,
      title:document.querySelector('#home-title').innerText.replace(/\\s+/g,' ').trim(),brand:document.querySelector('.home-brand')?.textContent??null,titleWords:[...document.querySelectorAll('.home-title-static > span')].map(rect),projectStart:rect(document.querySelector('.home-projects .section-heading')),firstProject:rect(document.querySelector('.project-slide')),catch:{...rect(catchNode),text:catchNode.textContent.trim(),fontSize:parseFloat(catchStyle.fontSize),lineHeight:parseFloat(catchStyle.lineHeight),color:catchStyle.color,opacity:Number(catchStyle.opacity),whiteSpace:catchStyle.whiteSpace,marginTop:parseFloat(catchStyle.marginTop),lines:catchRange.getClientRects().length,clipped:catchNode.scrollWidth>catchNode.clientWidth+1,afterTitle:document.querySelector('#home-title').nextElementSibling===catchNode},titleBottom:rect(document.querySelector('#home-title')).bottom,heroControls:hero.querySelectorAll('a,button').length,description:document.querySelector('meta[name="description"]').content,sectionOrder:[...document.querySelectorAll('.home > section')].map(n=>n.querySelector('h2')?.textContent.trim()).filter(Boolean),
      introductionBackground:getComputedStyle(intro).backgroundImage,links:links('.home-intro a'),about:links('.home-introduction > a'),topics:links('.home-topics a'),contact:links('.home-contact a'),
      introAfterHero:hero.nextElementSibling===intro,duplicateCatch:document.querySelector('main').textContent.includes('考えたことを、つくって確かめる。'),
      incorrectArrows:[...document.querySelectorAll('main a')].filter(a=>a.origin===location.origin&&a.textContent.includes('↗')).map(a=>a.href)};
  })()`);
  // Composite the declared translucent foreground over actual photo pixels, not opaque white.
  const sampleCatchContrast=async()=>{
    const bounds=await evaluate(`(()=>{const p=document.querySelector('.home-catch'),s=getComputedStyle(p),range=document.createRange();range.selectNodeContents(p);return{rects:[...range.getClientRects()].map(r=>({x:r.x,y:r.y,width:r.width,height:r.height})),color:s.color,opacity:Number(s.opacity),viewportWidth:innerWidth,oldVisibility:p.style.visibility}})()`);
    const channels=bounds.color.match(/[\d.]+/g).map(Number),alpha=(channels[3]??1)*bounds.opacity;
    const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    try{
      await evaluate(`(()=>{document.querySelector('.home-catch').style.visibility='hidden';return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))})()`);
      const capture=await send('Page.captureScreenshot',{format:'png'});
      const {data,info}=await sharp(Buffer.from(capture.data,'base64')).removeAlpha().raw().toBuffer({resolveWithObject:true});
      const scale=info.width/bounds.viewportWidth;let minRatio=Infinity;
      for(const rect of bounds.rects)for(let y=Math.max(0,Math.ceil(rect.y*scale));y<Math.min(info.height,Math.floor((rect.y+rect.height)*scale));y++)for(let x=Math.max(0,Math.ceil(rect.x*scale));x<Math.min(info.width,Math.floor((rect.x+rect.width)*scale));x++){
        const offset=(y*info.width+x)*info.channels,background=[...data.subarray(offset,offset+3)];
        const foreground=background.map((value,index)=>channels[index]*alpha+value*(1-alpha)),bgLum=luminance(background),fgLum=luminance(foreground);
        minRatio=Math.min(minRatio,(Math.max(fgLum,bgLum)+.05)/(Math.min(fgLum,bgLum)+.05));
      }
      assert.ok(Number.isFinite(minRatio)&&minRatio>=4.5,'Rendered alpha-composited catch contrast '+minRatio);
      return{minRatio,alpha,method:'minimum alpha-composited foreground/background contrast across rendered text-line bounds with glyphs hidden'};
    }finally{await evaluate(`(()=>{document.querySelector('.home-catch').style.visibility=${JSON.stringify(bounds.oldVisibility)};return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))})()`);}
  };
  const validateLayout=data=>{
    assert.equal(data.overflow,false);assert.equal(data.introAfterHero,true);assert.equal(data.duplicateCatch,false);
    assert.equal(data.title,'Think. Build. Run.');assert.equal(data.brand,null);
    assert.deepEqual(data.topics,[],'The introduction no longer maps the three phrases to potentially misleading destinations');
    assert.equal(data.introductionBackground,'none');
    const rows=new Set(data.titleWords.map(word=>Math.round(word.y)));
    assert.equal(rows.size,3,'The static headline keeps three rows');
    assert.deepEqual(data.links,[]);assert.equal(data.heroControls,0,'Hero has no CTA or other controls');
    assert.equal(data.catch.text,'ものづくり、プログラミング、日々の試行錯誤');assert.equal(data.catch.afterTitle,true);
    assert.equal(data.catch.clipped,false);assert.notEqual(data.catch.whiteSpace,'nowrap');
    assert.ok(data.catch.y>=data.titleBottom-1,'Catch clears the unchanged English title');
    assert.ok(data.catch.x>=0&&data.catch.right<=data.viewport.width&&data.catch.bottom<=data.hero.bottom,'Catch reflows inside hero');
    assert.equal(data.description,'Xpotatoの技術とものづくりの記録。ロボティクスやプログラミングの試行錯誤、制作物、教育資料、ブラウザで使える小さなツールをまとめています。');
    assert.deepEqual(data.sectionOrder.slice(0,3),['つくったもの','ブラウザで使えるツール','書きとめたこと'],'Section order is unchanged');
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
    const data=await snapshot();validateLayout(data);
    assert.ok(data.catch.fontSize>=14&&data.catch.fontSize<=16,'Default catch size is 14–16px');
    const catchColor=data.catch.color.match(/[\d.]+/g).map(Number),catchAlpha=(catchColor[3]??1)*data.catch.opacity;
    assert.ok(catchColor.slice(0,3).every(value=>value>=240)&&catchAlpha>=.75&&catchAlpha<=.85,'Catch uses approximately 80% white');
    assert.ok(data.catch.marginTop>=0&&data.catch.marginTop<=data.catch.fontSize,'Catch stays close to headline');
    if(width===393||width>=1440)assert.equal(data.catch.lines,1,'Default mobile/wide catch fits one line');
    assert.equal(data.width,'2400');assert.equal(data.height,'1350');
    assert.ok((width<=430?[640,960,1280]:[640,960,1440,1920]).includes(data.sourceWidth),'Selected responsive candidate is recorded at each DPR');
    if(width<=430&&dpr>=2)assert.equal(data.sourceWidth,1280,'High-density mobile keeps the original 1080px vertical resolution');
    assert.equal(data.loading,'eager');assert.equal(data.priority,'high');assert.ok(data.alt);
    assert.match(new URL(data.currentSrc).pathname,/^\/media\/v1\/objects\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}\.(avif|webp|jpg)$/);
    if(width<=430){assert.ok(data.introduction.bottom<=height,'Compact hero, description and about link fit the tested mobile first viewport');assert.ok(data.firstProject.y<height,'First project card begins in the tested mobile first viewport');}
    assert.equal(await evaluate('document.querySelector(".mobile-menu-toggle").getAttribute("aria-expanded")'),'false');
    await audit('home introduction '+width+'/'+height+'/'+dpr);const catchContrast=await sampleCatchContrast();records.push({status:'decoded',...data,catchContrast});
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
    }finally{await evaluate(`(()=>{for(const [node,style,placeholder] of window.__homeHeaderContrastRestore){style===null?node.removeAttribute('style'):node.setAttribute('style',style);if(node.matches('input'))placeholder===null?node.removeAttribute('placeholder'):node.setAttribute('placeholder',placeholder)}delete window.__homeHeaderContrastRestore;return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))})()`);}
  };
  const headerSnapshot=()=>evaluate(`(()=>{
    const h=document.querySelector('.header-band'),s=getComputedStyle(h),r=h.getBoundingClientRect();
    const boxes=[...document.querySelectorAll('.home-intro,#home-title,.home-catch,.home-introduction')].map(n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y+scrollY,width:b.width,height:b.height}});
    return{state:h.dataset.homeHeaderState,position:s.position,background:s.backgroundColor,backdrop:s.backdropFilter,shadow:s.boxShadow,transition:s.transitionProperty,durations:s.transitionDuration,height:r.height,top:r.top,boxes,reserved:parseFloat(getComputedStyle(document.body).getPropertyValue('--home-header-height')),
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
    assert.ok(top.transition.includes('backdrop-filter'),'Glass blur participates in smooth transition');
    assert.ok(top.durations.split(',').every(value=>parseFloat(value)>=.3&&parseFloat(value)<=.5),'Header surface transition lasts 300–500ms');
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
      assert.equal(data.position,'sticky');assert.equal(data.animations,0);assert.notEqual(data.background,'rgba(0, 0, 0, 0)','Without JS the header retains a readable background');assert.notEqual(data.background,'transparent');
    }
    await send('Emulation.setDeviceMetricsOverride',{width:320,height:844,deviceScaleFactor:1,mobile:false});await navigate();
    await evaluate('document.documentElement.style.fontSize="200%";window.scrollTo(0,0)');
    assert.equal(await evaluate(`document.querySelector('#home-title').getBoundingClientRect().top>=document.querySelector('.header-band').getBoundingClientRect().bottom`),true,'No-script 200% text keeps the title below the natural-height header');
    records.push({status:'no-script-readable-header-static-hero-pass',textScale:200});
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
  await evaluate('document.querySelector(".home-introduction > a").focus()');await navigationKey('Tab',8);await navigationKey('Tab');
  assert.equal(await evaluate('document.activeElement.pathname'),'/about/');
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
