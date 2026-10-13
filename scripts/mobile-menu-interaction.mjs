import assert from 'node:assert/strict';

export async function verifyMobileMenuInteraction({ send, evaluate, until, audit = async () => {} }) {
  const key = async (name, code, number) => {
    const text = name === 'Enter' ? '\r' : name === ' ' ? ' ' : '';
    await send('Input.dispatchKeyEvent', { type:'keyDown', key:name, code, windowsVirtualKeyCode:number, text, unmodifiedText:text });
    await send('Input.dispatchKeyEvent', { type:'keyUp', key:name, code, windowsVirtualKeyCode:number });
  };
  const nativeState = open => until(() => evaluate(`(() => { const b=document.querySelector('.mobile-menu-toggle');return document.querySelector('#site-menu').matches(':popover-open')===${open} && b.getAttribute('aria-expanded')===${JSON.stringify(String(open))} && b.getAttribute('aria-label')===${JSON.stringify(open?'メニューを閉じる':'メニューを開く')}; })()`), 'native menu state '+open);
  const fallbackState = open => until(() => evaluate(`(() => { const d=document.querySelector('.mobile-menu-fallback'),s=d.querySelector('summary');return d.open===${open} && s.getAttribute('aria-expanded')===${JSON.stringify(String(open))} && s.getAttribute('aria-label')===${JSON.stringify(open?'メニューを閉じる':'メニューを開く')}; })()`), 'fallback menu state '+open);
  const viewport = width => send('Emulation.setDeviceMetricsOverride', { width, height:844, deviceScaleFactor:1, mobile:width<=1180 });
  const motion = value => send('Emulation.setEmulatedMedia', { features:[{name:'prefers-reduced-motion',value}] });
  const glyph = (selector, open) => until(() => evaluate(`(() => {const lines=document.querySelectorAll('${selector} .menu-icon > span');return Array.from(lines).every((line,index)=>{const m=new DOMMatrixReadOnly(getComputedStyle(line).transform);return ${open} ? (index===0?m.b>.6:m.b<-.6) : Math.abs(m.b)<.001;});})()`), 'menu glyph '+open);
  const reports = [];
  await send('Page.bringToFront');
  await viewport(390); await motion('no-preference'); await nativeState(false);
  await evaluate("document.querySelector('.mobile-menu-toggle').focus()");
  await key('Enter','Enter',13); await nativeState(true); await glyph('.mobile-menu-toggle',true);
  await audit('mobile menu keyboard open');
  await key(' ','Space',32); await nativeState(false); await glyph('.mobile-menu-toggle',false);
  reports.push('native Enter and Space synchronize label, expanded and glyph');
  const tween = async () => evaluate(`(() => {
    const b=document.querySelector('.mobile-menu-toggle'),line=b.querySelector('.menu-icon > span');
    getComputedStyle(line).transform;b.click();getComputedStyle(line).transform;
    const animation=line.getAnimations().find(a=>a.transitionProperty==='transform');
    if(!animation)return null;
    const duration=Number(animation.effect.getTiming().duration);
    animation.pause();animation.currentTime=duration/2;
    const m=new DOMMatrixReadOnly(getComputedStyle(line).transform),angle=Math.atan2(m.b,m.a)*180/Math.PI;
    animation.play();return {duration,angle};
  })()`);
  for (const open of [true,false]) {
    const interpolation=await tween();
    assert.ok(interpolation&&interpolation.duration>0&&interpolation.duration<=250,'Short transform transition exists');
    assert.ok(interpolation.angle>0&&interpolation.angle<45,'Opening/closing has an intermediate angle');
    await nativeState(open);await glyph('.mobile-menu-toggle',open);
  }
  reports.push('both directions interpolate during a short transition');
  for (const count of [11,12,1]) {
    const before=await evaluate("document.querySelector('#site-menu').matches(':popover-open')");
    await evaluate(`for(let i=0;i<${count};i++)document.querySelector('.mobile-menu-toggle').click()`);
    await nativeState(count%2?!before:before);
  }
  await evaluate("document.querySelector('.mobile-menu-toggle').click()");await nativeState(true);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x:4,y:700,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:4,y:700,button:'left',clickCount:1});
  await nativeState(false);
  await evaluate("document.querySelector('.mobile-menu-toggle').focus();document.querySelector('.mobile-menu-toggle').click()");
  await nativeState(true);await key('Escape','Escape',27);await nativeState(false);
  assert.equal(await evaluate("document.activeElement===document.querySelector('.mobile-menu-toggle')"),true,'Escape restores trigger focus');
  reports.push('native repeated clicks, outside click and Escape remain consistent');
  await evaluate("document.querySelector('.mobile-menu-toggle').click()");await nativeState(true);
  await viewport(1181);await nativeState(false);await fallbackState(false);
  await viewport(1180);await nativeState(false);
  reports.push('crossing the desktop boundary closes without reopening');
  await motion('reduce');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.menu-icon > span')).transitionDuration"),'0s');
  await evaluate("document.querySelector('.mobile-menu-toggle').click()");await nativeState(true);await glyph('.mobile-menu-toggle',true);
  await evaluate("document.querySelector('.mobile-menu-toggle').click()");await nativeState(false);await glyph('.mobile-menu-toggle',false);
  reports.push('reduced motion has no transition and preserves state');
  await motion('no-preference');await viewport(390);
  // Test-only display override exercises the details path on a Popover-capable engine.
  await evaluate("document.querySelector('.mobile-menu-toggle').style.display='none';document.querySelector('.mobile-menu-fallback').style.display='block';document.querySelector('.mobile-menu-fallback summary').focus()");
  await key('Enter','Enter',13);await fallbackState(true);await glyph('.mobile-menu-fallback',true);
  await audit('mobile details fallback open');
  await key(' ','Space',32);await fallbackState(false);
  for (const count of [11,12,1]) {
    const before=await evaluate("document.querySelector('.mobile-menu-fallback').open");
    await evaluate(`for(let i=0;i<${count};i++)document.querySelector('.mobile-menu-fallback summary').click()`);
    await fallbackState(count%2?!before:before);
  }
  await evaluate("document.querySelector('.mobile-menu-fallback summary').click()");await fallbackState(true);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x:4,y:700,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:4,y:700,button:'left',clickCount:1});
  await fallbackState(false);
  await evaluate("document.querySelector('.mobile-menu-fallback summary').focus();document.querySelector('.mobile-menu-fallback summary').click()");
  await fallbackState(true);await key('Escape','Escape',27);await fallbackState(false);
  assert.equal(await evaluate("document.activeElement===document.querySelector('.mobile-menu-fallback summary')"),true,'Fallback Escape restores focus');
  await evaluate("document.querySelector('.mobile-menu-fallback summary').click()");await fallbackState(true);
  await viewport(1181);await fallbackState(false);await viewport(390);await fallbackState(false);
  await motion('reduce');assert.equal(await evaluate("getComputedStyle(document.querySelector('.mobile-menu-fallback .menu-icon > span')).transitionDuration"),'0s');
  await evaluate("document.querySelector('.mobile-menu-fallback summary').click()");await fallbackState(true);await glyph('.mobile-menu-fallback',true);
  await evaluate("document.querySelector('.mobile-menu-fallback summary').click()");await fallbackState(false);await glyph('.mobile-menu-fallback',false);
  await evaluate("document.querySelector('.mobile-menu-toggle').style.removeProperty('display');document.querySelector('.mobile-menu-fallback').style.removeProperty('display')");
  await motion('no-preference');await nativeState(false);await audit('mobile menu final closed');
  reports.push('details fallback keyboard, repeated clicks, outside, Escape, viewport and reduced motion');
  return {schemaVersion:1,reports};
}
