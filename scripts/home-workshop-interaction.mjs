import assert from 'node:assert/strict';
export async function verifyHomeWorkshopInteraction({ send, evaluate, until, origin, setFailure, verifyMenu, audit, screenshot }) {
  const records = [];
  const navigate = async () => {
    await send('Page.navigate', { url: origin + '/' });
    await until(() => evaluate('document.readyState === "complete" && Boolean(document.querySelector(".workshop-photo img"))'), 'Homepage photo markup');
    await evaluate('document.fonts.ready.then(()=>true)');
  };
  const snapshot = () => evaluate(`(() => { const img=document.querySelector('.workshop-photo img'),hero=document.querySelector('.home-intro'),r=hero.getBoundingClientRect(); return {complete:img.complete,naturalWidth:img.naturalWidth,currentSrc:img.currentSrc,width:img.getAttribute('width'),height:img.getAttribute('height'),loading:img.loading,priority:img.fetchPriority,alt:img.alt,overflow:document.documentElement.scrollWidth>innerWidth,hero:{x:r.x,y:r.y,width:r.width,height:r.height},background:getComputedStyle(hero).backgroundColor,links:Array.from(document.querySelectorAll('.intro-links a')).map(a=>({path:a.pathname,width:a.getBoundingClientRect().width,height:a.getBoundingClientRect().height}))}; })()`);
  for (const width of [1487,390,375,320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height:844, deviceScaleFactor:1, mobile:width<760 });
    await navigate();
    await until(() => evaluate('document.querySelector(".workshop-photo img").complete && document.querySelector(".workshop-photo img").naturalWidth > 0'), 'Homepage image decoded');
    const data=await snapshot();
    assert.equal(data.overflow,false); assert.equal(data.width,'2400'); assert.equal(data.height,'1350');
    assert.equal(data.loading,'eager'); assert.equal(data.priority,'high'); assert.ok(data.alt);
    assert.match(new URL(data.currentSrc).pathname,/^\/media\/v1\/objects\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}\.(avif|webp|jpg)$/);
    assert.deepEqual(data.links.map(link=>link.path),['/projects/','/about/']);
    assert.ok(data.links.every(link=>link.width>=44&&link.height>=44));
    records.push({width,status:'decoded',...data});
    if(width===1487||width===390)await screenshot('home-photo-'+width+'.png');
  }
  const before=await snapshot();
  try {
    setFailure(true); await navigate();
    await until(() => evaluate('document.querySelector(".workshop-photo img").complete && document.querySelector(".workshop-photo img").naturalWidth === 0'), 'Test-only unavailable photo');
    const failure=await snapshot();
    assert.equal(failure.overflow,false); assert.deepEqual(failure.hero,before.hero,'Image failure must retain layout');
    assert.equal(failure.background,'rgb(38, 38, 42)');
    assert.deepEqual(failure.links.map(link=>link.path),['/projects/','/about/']);
    assert.ok(failure.links.every(link=>link.width>=44&&link.height>=44));
    await audit('mobile unavailable photo');
    await screenshot('home-photo-unavailable.png');
    await verifyMenu(); records.push({width:320,status:'503-fallback-menu-pass',...failure});
  } finally { setFailure(false); }
  await send('Emulation.setDeviceMetricsOverride',{width:1487,height:1058,deviceScaleFactor:1,mobile:false});
  await navigate();
  await until(() => evaluate('document.querySelector(".workshop-photo img").naturalWidth > 0'), 'Photo restored after synthetic failure');
  return records;
}
