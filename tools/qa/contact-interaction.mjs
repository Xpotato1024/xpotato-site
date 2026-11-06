import assert from 'node:assert/strict';

/** Static contact destinations on the final dist. Activation is intercepted; nothing is sent. */
export async function verifyContactInteraction({send,evaluate,until,origin,audit,screenshot}) {
 const expected=[
  'mailto:321miyuto@xpotato.net',
  'https://github.com/Xpotato1024/browser-prime-toolkit/issues',
  'https://github.com/Xpotato1024/xpotato-site/issues',
  'https://www.instagram.com/miyu_to_x/',
  'https://twitter.com/bael_fps',
  'https://github.com/Xpotato1024',
 ];
 const reports=[];
 for(const [width,scale] of [[320,100],[390,100],[1181,100],[1440,100],[320,200],[1440,200]]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  // A private-looking browsing query must never be forwarded to a destination.
  await send('Page.navigate',{url:origin+'/contact/?private-input=do-not-forward'});
  await until(()=>evaluate('document.readyState==="complete" && Boolean(document.querySelector("[data-contact-details]"))'),'Contact ready');
  await evaluate('document.fonts.ready');
  await evaluate('document.documentElement.style.fontSize='+JSON.stringify(scale+'%'));
  const state=await evaluate(`(()=>{const main=document.querySelector('main'),details=main.querySelector('[data-contact-details]');return{
   hrefs:[...details.querySelectorAll('a')].map(a=>a.href),
   forms:main.querySelectorAll('form,input,textarea,button,iframe,astro-island').length,
   pending:details.querySelector('.social-pending')?.textContent.trim(),
   pendingLinks:details.querySelector('.social-pending')?.querySelectorAll('a,button,[tabindex]').length,
   overflow:document.documentElement.scrollWidth>innerWidth,
   emptyLinks:main.querySelectorAll('a[href=""]').length,
   canonical:document.querySelector('link[rel="canonical"]').href,
   notice:details.textContent.includes('GitHub Issueの内容は公開されます。'),
   targets:[...details.querySelectorAll('a')].map(a=>{const r=a.getBoundingClientRect();return {left:r.left,right:r.right}}),
  }})()`);
  assert.deepEqual(state.hrefs,expected);assert.equal(state.forms,0);assert.equal(state.emptyLinks,0);
  assert.equal(state.pending,'LinkedIn 準備中');assert.equal(state.pendingLinks,0);assert.equal(state.notice,true);
  assert.equal(state.canonical,'https://xpotato.net/contact/');assert.equal(state.overflow,false);
  assert.ok(state.targets.every(r=>r.left>=0 && r.right<=width+1),'Contact links fit '+width+'/'+scale);
  await audit('contact '+width+'/'+scale);
  await screenshot('contact-'+width+'-'+scale+'.png');
  // Reflow a future long address, without changing repository content or sending it.
  await evaluate(`document.querySelector('.contact-email').textContent='${'long-address-'.repeat(8)}@example.invalid'`);
  assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false,'Long email wraps');
  reports.push({width,scale,...state});
 }
 await send('Page.navigate',{url:origin+'/contact/'});
 await until(()=>evaluate('document.readyState==="complete" && Boolean(document.querySelector("[data-contact-details]"))'),'Contact keyboard ready');
 await evaluate(`window.contactActivations=[];document.querySelector('[data-contact-details]').addEventListener('click',event=>{const a=event.target.closest('a');if(a){event.preventDefault();window.contactActivations.push(a.href);}});document.querySelector('.contact-email').focus()`);
 for(let index=0;index<expected.length;index++) {
  assert.equal(await evaluate('document.activeElement.href'),expected[index]);
  assert.equal(await evaluate('document.activeElement.matches(":focus-visible") && parseFloat(getComputedStyle(document.activeElement).outlineWidth)>0'),true,'Contact focus visible');
  for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,...(type==='keyDown'?{text:'\r'}:{})});
  if(index<expected.length-1)for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 }
 assert.deepEqual(await evaluate('window.contactActivations'),expected);
 await send('Page.navigate',{url:origin+'/tools/prime-factorizer/?input=do-not-forward'});
 await until(()=>evaluate('document.readyState==="complete" && Boolean(document.querySelector(".tool-contact"))'),'Tool contact ready');
 const toolLinks=await evaluate(`[...document.querySelectorAll('.tool-contact a')].map(a=>a.getAttribute('href'))`);
 assert.deepEqual(toolLinks,['/contact/',expected[1],'/contact/#contact-bugs']);
 await evaluate('document.querySelector(\'.tool-contact a[href="/contact/"]\').click()');
 await until(()=>evaluate('location.pathname==="/contact/" && document.readyState==="complete"'),'Tool to contact navigation');
 return {reports,activationDestinations:expected,activationIntercepted:true,toolLinks};
}
