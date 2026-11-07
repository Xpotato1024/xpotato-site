import assert from 'node:assert/strict';
export async function verifyHomeWorkshopInteraction({ send, evaluate, until, origin, setFailure, verifyMenu, audit, screenshot }) {
  const records = [];
  const navigate = async () => {
    await send('Page.navigate', { url: origin + '/' });
    await until(() => evaluate('document.readyState === "complete" && Boolean(document.querySelector(".workshop-photo img"))'), 'Homepage photo markup');
    await evaluate('document.fonts.ready.then(()=>true)');
  };
  const snapshot = () => evaluate(`(() => { const img=document.querySelector('.workshop-photo img'),hero=document.querySelector('.home-intro'),r=hero.getBoundingClientRect();return {complete:img.complete,naturalWidth:img.naturalWidth,currentSrc:img.currentSrc,width:img.getAttribute('width'),height:img.getAttribute('height'),loading:img.loading,priority:img.fetchPriority,alt:img.alt,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},sourceWidth:Number([...img.closest('picture').querySelectorAll('[srcset]')].flatMap(node=>node.srcset.split(',')).map(value=>value.trim().split(' ')).find(([url])=>new URL(url,location.href).href===img.currentSrc)?.[1]?.replace('w','')),overflow:document.documentElement.scrollWidth>innerWidth,hero:{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom},background:getComputedStyle(hero).backgroundColor,secondaryPaths:[...document.querySelectorAll('.intro-secondary-links a')].map(a=>a.pathname),description:[...document.querySelectorAll('.intro-description span')].map(s=>({text:s.textContent,height:s.getBoundingClientRect().height,lineHeight:parseFloat(getComputedStyle(s).lineHeight),display:getComputedStyle(s).display})),links:Array.from(document.querySelectorAll('.intro-links a')).map(a=>{const b=a.getBoundingClientRect();return{path:a.pathname,text:a.textContent.replace('→','').trim(),x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom}})}; })()`);
  for (const [width,height,dpr=1] of [[393,700,2],[393,700,2.625],[393,700,3],[1487,844],[1440,900],[1440,700],[430,832],[431,832],[760,900],[761,900],[393,700],[390,744],[375,667],[390,600],[320,568]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor:dpr, mobile:width<=760 });
    await send('Network.clearBrowserCache');
    await navigate();
    await until(() => evaluate('document.querySelector(".workshop-photo img").complete && document.querySelector(".workshop-photo img").naturalWidth > 0'), 'Homepage image decoded');
    const data=await snapshot();
    assert.equal(data.overflow,false); assert.equal(data.width,'2400'); assert.equal(data.height,'1350');
    assert.ok((width<=430?[640,960,1280]:[640,960,1440,1920]).includes(data.sourceWidth),'Selected responsive candidate is recorded at each DPR');
    if(width<=430) { assert.ok(data.hero.width/data.hero.height<=32/27,'The mobile crop retains full-height cover geometry'); if(dpr>=2)assert.equal(data.sourceWidth,1280,'High-density mobile keeps the original 1080px vertical resolution'); }
    assert.equal(data.loading,'eager'); assert.equal(data.priority,'high'); assert.ok(data.alt);
    assert.match(new URL(data.currentSrc).pathname,/^\/media\/v1\/objects\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}\.(avif|webp|jpg)$/);
    assert.deepEqual(data.links.map(link=>link.path),['/projects/','/about/','/contact/']);
    assert.ok(data.links.every(link=>link.width>=44&&link.height>=44));
    const contact=data.links.find(link=>link.path==='/contact/');
    assert.equal(contact.text,'問い合わせ');
    assert.ok(contact.x>=0&&contact.right<=width&&contact.y>=0&&contact.bottom<=height,'Contact is visible without opening the menu or scrolling');
    assert.deepEqual(data.secondaryPaths,['/about/','/contact/'],'Supplementary links form one group');
    const [primary,about]=data.links;
    assert.ok(Math.abs(about.y-contact.y)<1&&Math.abs(about.bottom-contact.bottom)<1,'Supplementary links share a deliberate row');
    assert.deepEqual(data.description.map(part=>part.text),['ものづくり、プログラミング、','日々の試行錯誤。']);
    if(width<=760){
      assert.ok(about.y>=primary.bottom&&about.y-primary.bottom<=12,'Mobile primary action sits immediately above its supplementary group');
      assert.ok(data.hero.bottom<=height-64,'Compact mobile hero leaves space for the next section on a short screen');
      assert.ok(data.description.every(part=>part.display==='block'&&part.height<=part.lineHeight*1.1),'Description wraps at meaning boundaries without an orphan ending');
    }else{
      assert.ok(about.x>primary.right&&Math.abs((primary.y+primary.height/2)-(about.y+about.height/2))<2,'Desktop primary and supplementary actions align horizontally');
    }
    assert.equal(await evaluate('document.querySelector(".mobile-menu-toggle").getAttribute("aria-expanded")'),'false');
    await audit('home contact initial '+width);
    records.push({viewportWidth:width,viewportHeight:height,status:'decoded',...data});
    if((width===1440&&height===900)||width===393||width===1487||width===390)await screenshot('home-photo-'+width+'-'+height+'-dpr'+dpr+'.png');
  }
  const before=await snapshot();
  try {
    setFailure(true); await navigate();
    await until(() => evaluate('document.querySelector(".workshop-photo img").complete && document.querySelector(".workshop-photo img").naturalWidth === 0'), 'Test-only unavailable photo');
    const failure=await snapshot();
    assert.equal(failure.overflow,false); assert.deepEqual(failure.hero,before.hero,'Image failure must retain layout');
    assert.equal(failure.background,'rgb(38, 38, 42)');
    assert.deepEqual(failure.links.map(link=>link.path),['/projects/','/about/','/contact/']);
    assert.ok(failure.links.every(link=>link.width>=44&&link.height>=44));
    await audit('mobile unavailable photo');
    await screenshot('home-photo-unavailable.png');
    await verifyMenu(); records.push({viewportWidth:320,status:'503-fallback-menu-pass',...failure});
  } finally { setFailure(false); }
  for(const width of [320,375,390,393,430,1440]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:false});
    await navigate();await evaluate('document.documentElement.style.fontSize="200%"');
    const data=await snapshot();
    assert.equal(data.overflow,false,'Homepage reflows at '+width+' / 200%');
    assert.ok(data.links.every(link=>link.x>=0&&link.right<=width&&link.width>=44&&link.height>=44),'Hero links fit enlarged text');
    await audit('home contact '+width+'/200');
    records.push({viewportWidth:width,textScale:200,status:'contact-reflow-pass',...data});
    if(width===320)await screenshot('home-contact-320-200.png');
  }
  // Use the unchanged hero link order with a real keyboard activation of the internal contact route.
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await navigate();
  const history=await send('Page.getNavigationHistory'),entryId=history.entries[history.currentIndex].id;
  await evaluate('document.querySelector(".intro-links a").focus()');
  for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8});
  for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  for(const path of ['/projects/','/about/','/contact/']){
    assert.equal(await evaluate('document.activeElement.pathname'),path);
    assert.equal(await evaluate('document.activeElement.matches(":focus-visible")&&parseFloat(getComputedStyle(document.activeElement).outlineWidth)>0'),true,'Hero focus visible');
    if(path!=='/contact/')for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  }
  for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,...(type==='keyDown'?{text:'\r'}:{})});
  await until(()=>evaluate('location.pathname==="/contact/"&&document.readyState==="complete"&&Boolean(document.querySelector("[data-contact-details]"))'),'Hero contact navigation');
  await send('Page.navigateToHistoryEntry',{entryId});
  await until(()=>evaluate('location.pathname==="/"&&document.readyState==="complete"&&Boolean(document.querySelector(".intro-links a[href=\\"/contact/\\"]"))'),'Back to homepage');
  records.push({status:'hero-contact-keyboard-navigation-and-back-pass'});
  await send('Emulation.setDeviceMetricsOverride',{width:1487,height:1058,deviceScaleFactor:1,mobile:false});
  await navigate();
  await until(() => evaluate('document.querySelector(".workshop-photo img").naturalWidth > 0'), 'Photo restored after synthetic failure');
  return records;
}
