// Private candidate presentation regression. Public fixed releases are not silently replaced.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function verifyPrimePresentation({origin,send,evaluate,until,temp}){
 const root="document.querySelector('.bt-prime-factorizer')";
 const reports=[];
 const settle=()=>evaluate('document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))');
 const metric=()=>evaluate(`({scrollY,maxScroll:Math.max(0,document.documentElement.scrollHeight-innerHeight),scale:visualViewport?.scale??1,visualTop:visualViewport?.pageTop??null,visualHeight:visualViewport?.height??null,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,phase:${root}.dataset.phase,active:document.activeElement.id||document.activeElement.tagName})`);
 const target=selector=>`${root}.querySelector(${JSON.stringify(selector)})`;
 const position=async (selector,{focus=true}={})=>{await evaluate(`(()=>{const n=${target(selector)};scrollTo(0,Math.max(0,n.getBoundingClientRect().top+scrollY-150));${focus?'n.focus({preventScroll:true});':''}})()`);await settle();};
 const stable=async(label,action)=>{
  const before=await metric();await action();await settle();const after=await metric();
  reports.push({label,before,after,scrollDelta:after.scrollY-before.scrollY,naturalEndClamp:Math.min(before.scrollY,after.maxScroll)-before.scrollY});
  await writeFile(join(temp,'prime-flat-presentation-progress.json'),JSON.stringify(reports,null,2)+'\n');
  assert.equal(after.scale,before.scale,label+' scale');assert.ok(Math.abs(after.scrollY-Math.min(before.scrollY,after.maxScroll))<=2,label+' scroll delta '+(after.scrollY-before.scrollY));
  assert.ok(after.scrollWidth<=after.width+1,label+' horizontal overflow');
 };
 const click=async selector=>{
  const r=await evaluate(`(()=>{const r=${target(selector)}.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...r});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...r});
 };
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Page.navigate',{url:origin+'/tools/prime-factorizer/'});
 await until(()=>evaluate(root+"?.dataset.phase==='ready'"),'flat presentation ready');await settle();
 const style=await evaluate(`(()=>{const r=${root};return {controls:Array.from(r.querySelectorAll('input,select,textarea'),n=>({font:parseFloat(getComputedStyle(n).fontSize),height:n.getBoundingClientRect().height})),panels:Array.from(document.querySelectorAll('.bt-prime-factorizer details,.tool-release'),n=>{const s=getComputedStyle(n);return{radius:s.borderRadius,left:s.borderLeftWidth,right:s.borderRightWidth,bottom:s.borderBottomWidth,bg:s.backgroundColor};}),viewport:document.querySelector('meta[name=viewport]').content};})()`);
 assert.ok(style.controls.every(x=>x.font>=16));
 assert.ok(style.panels.every(x=>x.radius==='0px'&&x.left==='0px'&&x.right==='0px'&&x.bottom==='0px'));
 assert.ok(!/user-scalable\s*=\s*(no|0)|maximum-scale/i.test(style.viewport));
 await position('input',{focus:false});await stable('input focus',()=>click('input'));
 await position('select[id$=-sample]');await stable('sample keeps select focus',async()=>{
  await evaluate(`(()=>{const s=${target('select[id$=-sample]')};s.value='360';s.dispatchEvent(new Event('change'));})()`);
  assert.equal(await evaluate("document.activeElement.id.endsWith('-sample')"),true);
 });
 await position('.bt-settings summary');await stable('details expand',()=>click('.bt-settings summary'));
 await stable('details collapse',()=>click('.bt-settings summary'));
 await position('input');await stable('result update from input',async()=>{
  await evaluate(root+".querySelector('form').requestSubmit()");
  await until(()=>evaluate(root+".dataset.phase==='result'"),'flat result');
 });
 await position('[data-action=copy]');await stable('denied clipboard fallback selection',async()=>{
  await evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('test denied')}}})");
  await click('[data-action=copy]');await until(()=>evaluate(root+".querySelector('textarea[aria-label^=手動]').hidden===false"),'flat copy fallback');
  assert.equal(await evaluate("document.activeElement.getAttribute('aria-label').startsWith('手動')"),true);
 });
 await position('[data-action=reset]');await stable('reset without input keyboard focus',async()=>{
  await click('[data-action=reset]');await until(()=>evaluate(root+".dataset.phase==='ready'"),'flat reset ready');
  assert.equal(await evaluate("document.activeElement.dataset.action"),'reset');
 });
 // Use the unchanged heavy route only to exercise real asynchronous cancellation, not performance.
 await evaluate(`(()=>{const e=${target('select[id$=-engine]')};e.value='optimized';e.dispatchEvent(new Event('change'));})()`);
 await until(()=>evaluate(root+".dataset.phase==='ready'"),'heavy ready');
 await position('input');
 await stable('running then cancellation',async()=>{
  await evaluate(`(()=>{const r=${root};r.querySelector('input').value='1522605027922533360535618378132637429718068114961380688657908494580122963258952897654000350692006139';r.querySelector('form').requestSubmit();})()`);
  await until(()=>evaluate(root+".dataset.phase==='running'"),'heavy running');
  await evaluate(target('[data-action=cancel]')+".focus({preventScroll:true})");
  await evaluate(target('[data-action=cancel]')+".click()");
  await until(()=>evaluate(root+".dataset.phase==='result'"),'cancelled presentation');
 });
 const report={scope:'private candidate with actual site presentation; Chrome viewport emulation, no physical soft keyboard/iOS test',style,reports};
 await writeFile(join(temp,'prime-flat-presentation.json'),JSON.stringify(report,null,2)+'\n');
 return report;
}
