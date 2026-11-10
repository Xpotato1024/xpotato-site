import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { boundaryContrast } from './design-role-interaction.mjs';

// In-memory authoring-template fixture; no content, release pin or vendor mutation.
export async function verifyBrowserToolStyleApi({ root, send, evaluate, screenshot }) {
  const template=(await readFile(join(root,'templates/browser-tool-sync/styles/tool.css'),'utf8')).replaceAll('__TOOL_ID__','style-probe');
  const global=await readFile(join(root,'apps/site/src/styles/global.css'),'utf8');
  const tokens=global.match(/:root\s*\{([^}]+)\}/u)[1];
  const demo=await readFile(join(root,'apps/site/src/components/content/Demo.astro'),'utf8');
  const bridge=demo.match(/section\[data-interactive-module\]\s*\{([^}]+)\}/u)[1];
  const axe=await readFile(join(root,'node_modules/axe-core/axe.min.js'),'utf8');
  // Use shipped Japanese font bytes, not the runner's optional OS fonts. The
  // blank private fixture has no origin, so inline only these local dist fonts.
  const html=await readFile(join(root,'apps/site/dist/tools/prime-factorizer/index.html'),'utf8');
  const fontPath=html.match(/href="(\/_astro\/fonts-[^"]+\.css)"/u)?.[1];
  assert.ok(fontPath,'Selected Prime route font stylesheet');
  const fontCss=await readFile(join(root,'apps/site/dist',fontPath),'utf8');
  let fonts=[...fontCss.matchAll(/@font-face\{[^}]+\}/gu)].map(m=>m[0]).filter(rule=>rule.includes("font-family:'Zen Kaku Gothic New'")).join('\n');
  assert.ok(fonts,'Actual shipped UI font faces');
  for(const path of new Set([...fonts.matchAll(/url\((\/fonts\/[a-zA-Z0-9.-]+\.woff2)\)/gu)].map(m=>m[1]))){
    const bytes=await readFile(join(root,'apps/site/dist',path));
    fonts=fonts.replaceAll(`url(${path})`,`url(data:font/woff2;base64,${bytes.toString('base64')})`);
  }
  const reports=[];
  for(const [width,scale] of [[320,100],[1440,100],[320,200]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:'about:blank'});
    for(let attempt=0;;attempt++){
      try { if(await evaluate("location.href==='about:blank' && document.readyState==='complete'")) break; } catch {}
      if(attempt>=100) throw Error('Style fixture blank document did not load');
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    await evaluate(`document.open(); document.write(${JSON.stringify('<!doctype html><html lang="ja"><head><title>素因数分解</title></head><body><main><h1>素因数分解</h1><section data-interactive-module="style-probe"><div data-bt class="bt-style-probe"><form><label for="sample">入力</label><textarea id="sample">入力 入力 入力 入力 入力 入力</textarea><div class="bt-actions"><button type="submit">計算</button><button type="button">キャンセル</button></div></form><details><summary>使い方・ヘルプ</summary><p>使い方・ヘルプ 入力 計算 キャンセル 使い方・ヘルプ 入力 計算 キャンセル</p></details></div></section></main></body></html>')}); document.close();`);
    await evaluate(`(()=>{const s=document.createElement('style');s.textContent=${JSON.stringify(`${fonts} :root{${tokens}} body{margin:16px} *{box-sizing:border-box} h1{font:600 1.4rem/1.5 var(--font-body)} section[data-interactive-module]{${bridge}}\n${template}`)};document.head.append(s);document.documentElement.style.fontSize=${JSON.stringify(scale+'%')}})()`);
    await evaluate('document.fonts.ready');
    assert.equal(await evaluate(`document.fonts.check('600 16px "Zen Kaku Gothic New"', '入力使い方・ヘルプ素因数分解計算キャンセル')`),true,'Shipped Japanese UI font is loaded');
    const snapshot=()=>evaluate(`(()=>{const input=getComputedStyle(document.querySelector('textarea')),line=getComputedStyle(document.querySelector('details')),summary=getComputedStyle(document.querySelector('summary'));return {control:input.borderTopColor,divider:line.borderTopColor,background:input.backgroundColor,padding:summary.paddingTop,height:document.querySelector('summary').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth}})()`);
    const initial=await snapshot();
    assert.notEqual(initial.control,initial.divider);
    assert.ok(boundaryContrast(initial.control,initial.background)>=3);
    assert.equal(parseFloat(initial.padding),8*scale/100);
    assert.ok(initial.height>=44);assert.equal(initial.overflow,false);
    await evaluate(`document.querySelector('section').style.setProperty('--bt-border-divider','#eeeeee')`);
    const divider=await snapshot();assert.equal(divider.control,initial.control);assert.equal(divider.divider,'rgb(238, 238, 238)');
    await evaluate(`document.querySelector('section').style.setProperty('--bt-border-control','#444444')`);
    const control=await snapshot();assert.equal(control.control,'rgb(68, 68, 68)');assert.equal(control.divider,divider.divider);
    // CSS-wide initial unsets new tokens, exposing the old host's single theme.
    await evaluate(`document.querySelector('section').style.cssText='--bt-border-control:initial;--bt-border-divider:initial;--bt-border:#555555;--bt-summary-padding-block:initial'`);
    const legacy=await snapshot();assert.equal(legacy.control,'rgb(85, 85, 85)');assert.equal(legacy.divider,legacy.control);
    await evaluate(`document.querySelector('section').style.cssText='--bt-border-control:initial;--bt-border-divider:initial;--bt-border:initial'`);
    const standalone=await snapshot();assert.equal(standalone.control,'rgb(115, 106, 123)');assert.equal(standalone.divider,'rgb(216, 212, 220)');
    await evaluate(`document.querySelector('section').removeAttribute('style');document.querySelector('summary').focus()`);
    for(const [key,code,keyCode,text] of [['Enter','Enter',13,'\r'],['Enter','Enter',13,'\r'],[' ','Space',32,' '],[' ','Space',32,' ']]) {
      const before=await evaluate(`document.querySelector('details').open`);
      await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:keyCode,text});
      await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:keyCode});
      assert.equal(await evaluate(`document.querySelector('details').open`),!before);
      assert.equal(await evaluate(`document.querySelector('summary').matches(':focus-visible')`),true);
      assert.ok(await evaluate(`parseFloat(getComputedStyle(document.querySelector('summary')).outlineWidth)>=3`));
    }
    await evaluate(`document.querySelector('details').open=true`);
    assert.equal((await snapshot()).overflow,false);
    await evaluate(axe);
    const violations=await evaluate(`axe.run(document).then(r=>r.violations.map(v=>({id:v.id,impact:v.impact})))`);
    assert.deepEqual(violations,[]);
    await screenshot?.(`tool-style-api-${width}-${scale}.png`);
    reports.push({width,scale,initial,legacy,standalone,keyboardToggles:4,violations});
  }
  return {scope:'authoring-template-and-real-bridge-private-fixture',reports};
}
