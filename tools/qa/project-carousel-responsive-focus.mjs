import assert from 'node:assert/strict';

// Delay only this document's breakpoint callbacks to expose the ordering that
// can otherwise occur intermittently in Edge: CSS is applied before JS runs.
// No production timers, focus events, styles or activeElement values are faked.
const delayBreakpoint = `(() => {
  const match = window.matchMedia.bind(window);
  window.__carouselBreakpoint = {hold:false, pending:[]};
  window.matchMedia = query => {
    const media = match(query);
    if (query !== '(max-width: 760px)') return media;
    const add = media.addEventListener.bind(media);
    media.addEventListener = (type, listener, options) => add(type, type !== 'change' ? listener : event => {
      const run = () => typeof listener === 'function' ? listener.call(media, event) : listener.handleEvent(event);
      if (window.__carouselBreakpoint.hold) window.__carouselBreakpoint.pending.push(run);
      else run();
    }, options);
    return media;
  };
})();`;

export async function verifyProjectCarouselResponsiveFocus({send,evaluate,navigate,ready,settle}) {
  const resize = width => send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  const active = selector => evaluate(`document.activeElement === document.querySelector(${JSON.stringify(selector)})`);
  const key = async (name, modifiers=0) => {
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:name,code:name,modifiers,windowsVirtualKeyCode:name==='Tab'?9:undefined});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:name,code:name,modifiers,windowsVirtualKeyCode:name==='Tab'?9:undefined});
  };
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await send('Emulation.setTouchEmulationEnabled',{enabled:false});
  await resize(761);
  const injected = await send('Page.addScriptToEvaluateOnNewDocument',{source:delayBreakpoint});
  try {
    await navigate();await ready();await evaluate('document.fonts.ready');
    await evaluate(`document.querySelector('.home-projects').scrollIntoView();document.querySelector('[data-rotation]').click()`);
    for (const arrow of ['[data-previous]','[data-next]']) {
      await resize(761);await settle();
      await evaluate(`document.querySelector('[data-project-dot="3"]').click();document.querySelector(${JSON.stringify(arrow)}).focus();window.__carouselBreakpoint.hold=true`);
      assert.equal(await active(arrow),true);
      await resize(760);await settle();
      assert.ok(await evaluate('window.__carouselBreakpoint.pending.length > 0'),'Breakpoint callback is held after the real resize');
      assert.equal(await active(arrow),true,'CSS must not blur the arrow before the breakpoint callback: '+JSON.stringify(await evaluate(`({active:document.activeElement.outerHTML.slice(0,200),arrow:document.querySelector(${JSON.stringify(arrow)}).outerHTML,display:getComputedStyle(document.querySelector(${JSON.stringify(arrow)})).display,held:window.__carouselBreakpoint.pending.length})`)));
      assert.equal(await evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(arrow)})).display !== 'none'`),true);
      await evaluate(`window.__carouselBreakpoint.hold=false;window.__carouselBreakpoint.pending.splice(0).forEach(run=>run())`);
      assert.equal(await active('[data-project-dot="3"]'),true,'Focus moves to the current dot');
      assert.equal(await evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(arrow)})).display`),'none','Arrow is hidden after the handoff');
    }
  } finally {
    await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:injected.identifier});
  }
  // Start an unmodified document for repeated real resize/input coverage.
  await resize(761);await navigate();await ready();await evaluate('document.fonts.ready');
  await evaluate(`document.querySelector('.home-projects').scrollIntoView();document.querySelector('[data-rotation]').click()`);
  let transfers=0;
  for (const touch of [false,true]) {
    await send('Emulation.setTouchEmulationEnabled',{enabled:touch,maxTouchPoints:touch?1:undefined});
    for (const index of [0,3,5]) for (const arrow of ['[data-previous]','[data-next]']) {
      await resize(761);await settle();
      await evaluate(`document.querySelector('[data-project-dot="${index}"]').click();document.querySelector(${JSON.stringify(arrow)}).focus()`);
      // Establish keyboard modality so the transferred ring must remain visible.
      await key('Shift');
      await send('Emulation.setDeviceMetricsOverride',{width:760,height:1000,deviceScaleFactor:1,mobile:touch});await settle();
      assert.equal(await active(`[data-project-dot="${index}"]`),true);
      assert.equal(await evaluate('document.activeElement.matches(":focus-visible")'),true);
      assert.equal(await evaluate(`[...document.querySelectorAll('[data-previous],[data-next]')].every(b=>getComputedStyle(b).display==='none')`),true);
      await key('ArrowRight');await settle();
      assert.equal(await active(`[data-project-dot="${(index+1)%6}"]`),true,'Arrow-key navigation continues after resize');
      await key('Tab');
      assert.equal(await active(`[data-project-dot="${(index+1)%6+1}"]`),true,'Native Tab continues to the next visible dot');
      await key('Tab',8);
      assert.equal(await active(`[data-project-dot="${(index+1)%6}"]`),true,'Shift+Tab returns to the selected dot');
      transfers++;
    }
  }
  await send('Emulation.setTouchEmulationEnabled',{enabled:false});
  for (const arrow of ['[data-previous]','[data-next]']) {
    await resize(761);await settle();
    const target=arrow==='[data-previous]'?2:4;
    await evaluate(`document.querySelector('[data-project-dot="3"]').click();document.querySelector('[data-project-dot="3"]').click();document.querySelector(${JSON.stringify(arrow)}).focus();document.activeElement.click()`);
    await resize(760);await settle();
    assert.equal(await active(`[data-project-dot="${target}"]`),true,'Resize during a transition follows its destination');
    assert.equal(await evaluate(`document.querySelector('[data-project-dot="${target}"]').getAttribute('aria-current')`),'true');
  }
  // A remembered arrow must never steal focus after the user has moved away.
  for (const selector of ['[data-project-dot="2"]','[data-rotation]','.project-viewport','.project-slide[aria-hidden="false"] a','a.skip-link']) {
    await resize(761);await settle();
    await evaluate(`document.querySelector('[data-project-dot="0"]').click();document.querySelector('[data-previous]').focus();document.querySelector(${JSON.stringify(selector)}).focus()`);
    assert.equal(await active(selector),true,'Focus target exists: '+selector);
    for (const width of [760,761,390,1487]) {
      await resize(width);await settle();
      assert.equal(await active(selector),true,'Visible or external focus is preserved: '+selector);
    }
  }
  await resize(761);await settle();
  await evaluate(`document.querySelector('[data-previous]').focus();document.activeElement.blur()`);
  await resize(760);await settle();
  assert.equal(await evaluate('document.activeElement === document.body'),true,'Intentional blur is not undone');
  return {delayedBreakpointTransfers:2,realTransfers:transfers,keyboardContinuation:true,visibleAndExternalFocus:true,intentionalBlur:true};
}
