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
  const reports=[];
  for(const [width,scale] of [[320,100],[1440,100],[320,200]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:'about:blank'});
    for(let attempt=0;;attempt++){
      try { if(await evaluate("location.href==='about:blank' && document.readyState==='complete'")) break; } catch {}
      if(attempt>=100) throw Error('Style fixture blank document did not load');
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    await evaluate(`document.open(); document.write(${JSON.stringify('<!doctype html><html lang="ja"><head><title>ツール表示契約</title></head><body><main><h1>ツール表示契約</h1><section data-interactive-module="style-probe"><div data-bt class="bt-style-probe"><form><label for="sample">入力</label><textarea id="sample">長い日本語の入力</textarea><div class="bt-actions"><button type="submit">変換する</button><button type="button">消去する</button></div></form><details><summary>使い方と補足説明</summary><p>補足説明を開いた状態でも、入力枠と区切り線の色は独立しています。</p></details></div></section></main></body></html>')}); document.close();`);
    await evaluate(`(()=>{const s=document.createElement('style');s.textContent=${JSON.stringify(`:root{${tokens}} body{margin:16px} *{box-sizing:border-box} h1{font:600 1.4rem/1.5 system-ui} section[data-interactive-module]{${bridge}}\n${template}`)};document.head.append(s);document.documentElement.style.fontSize=${JSON.stringify(scale+'%')}})()`);
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
