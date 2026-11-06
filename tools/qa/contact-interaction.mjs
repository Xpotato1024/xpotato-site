import assert from 'node:assert/strict';

/** Static contact destinations on the final dist. Activation is intercepted; nothing is sent. */
export async function verifyContactInteraction({send,evaluate,until,origin,audit,screenshot}) {
 const expected=[
  'mailto:321miyuto@xpotato.net',
  origin+'/tools/',
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
   icons:[...details.querySelectorAll('.social-links svg')].map(svg=>({id:svg.dataset.socialIcon,viewBox:svg.getAttribute('viewBox'),hidden:svg.getAttribute('aria-hidden'),focusable:svg.getAttribute('focusable'),paths:svg.querySelectorAll('path').length,width:svg.getBoundingClientRect().width,height:svg.getBoundingClientRect().height})),
   hierarchy:{primaryHeading:parseFloat(getComputedStyle(details.querySelector('.contact-primary h2')).fontSize),secondaryHeading:parseFloat(getComputedStyle(details.querySelector('.contact-secondary h2')).fontSize),email:parseFloat(getComputedStyle(details.querySelector('.contact-email')).fontSize),reportLink:parseFloat(getComputedStyle(details.querySelector('.contact-report-link a')).fontSize)},
   headings:[...details.querySelectorAll('h2')].map(h=>({optIn:h.classList.contains('content-h2'),border:getComputedStyle(h).borderTopWidth,marker:getComputedStyle(h,'::before').content,markerWidth:parseFloat(getComputedStyle(h,'::before').width),markerColor:getComputedStyle(h,'::before').backgroundColor})),
   targets:[...details.querySelectorAll('a')].map(a=>{const r=a.getBoundingClientRect();return {left:r.left,right:r.right}}),
  }})()`);
  assert.deepEqual(state.hrefs,expected);assert.equal(state.forms,0);assert.equal(state.emptyLinks,0);
  assert.equal(state.pending,'LinkedIn 準備中');assert.equal(state.pendingLinks,0);assert.equal(state.notice,true);
  assert.equal(state.canonical,'https://xpotato.net/contact/');assert.equal(state.overflow,false);
  assert.deepEqual(state.icons.map(icon=>icon.id),['instagram','x','github','linkedin']);
  assert.ok(state.icons.every(icon=>icon.viewBox==='0 0 16 16'&&icon.hidden==='true'&&icon.focusable==='false'&&icon.paths>0&&icon.width>=24&&icon.height>=24),'Readable decorative SVGs with visible text names');
  assert.ok(state.hierarchy.primaryHeading>state.hierarchy.secondaryHeading&&state.hierarchy.email>state.hierarchy.reportLink,'Email is the primary visual level');
  assert.equal(state.headings.length,3);
  assert.ok(state.headings.every(h=>h.optIn&&h.border==='1px'&&h.marker==='""'&&h.markerWidth===4*scale/100&&h.markerColor==='rgb(116, 83, 153)'),'Shared section heading border and accent marker');
  const scope=await evaluate(`(()=>{const host=document.createElement('div');host.className='prose';host.innerHTML='<section><h2>Nested heading probe</h2></section><section data-bt><h2 class="content-h2">Tool heading probe</h2></section>';document.body.append(host);const result=[...host.querySelectorAll('h2')].map(h=>getComputedStyle(h,'::before').content);host.remove();return result;})()`);
  assert.deepEqual(scope,['none','none'],'Nested components require opt-in; Tool namespace remains excluded');
  const ax=await send('Accessibility.getFullAXTree');
  const linkNames=ax.nodes.filter(node=>!node.ignored&&node.role?.value==='link').map(node=>node.name?.value);
  for(const name of ['Instagram @miyu_to_x','X @bael_fps','GitHub Xpotato1024'])assert.ok(linkNames.includes(name),'Social accessible name: '+name);
  assert.ok(state.targets.every(r=>r.left>=0 && r.right<=width+1),'Contact links fit '+width+'/'+scale);
  await audit('contact '+width+'/'+scale);
  await screenshot('contact-'+width+'-'+scale+'.png');
  await evaluate('document.querySelector("#contact-social").scrollIntoView({block:"center"})');
  await screenshot('contact-social-'+width+'-'+scale+'.png');
  // Reflow a future long address, without changing repository content or sending it.
  await evaluate(`document.querySelector('.contact-address').textContent='${'long-address-'.repeat(8)}@example.invalid'`);
  assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false,'Long email wraps');
  reports.push({width,scale,...state});
 }
 await send('Page.navigate',{url:origin+'/contact/'});
 await until(()=>evaluate('document.readyState==="complete" && Boolean(document.querySelector("[data-contact-details]"))'),'Contact keyboard ready');
 await evaluate(`window.contactActivations=[];document.querySelector('[data-contact-details]').addEventListener('click',event=>{const a=event.target.closest('a');if(a){event.preventDefault();window.contactActivations.push(a.href);}});document.querySelector('.contact-email').focus()`);
 // Enter the first link through the keyboard so focus-visible does not depend on a previous pointer test.
 for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8});
 for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 for(let index=0;index<expected.length;index++) {
  assert.equal(await evaluate('document.activeElement.href'),expected[index]);
  assert.equal(await evaluate('document.activeElement.matches(":focus-visible") && parseFloat(getComputedStyle(document.activeElement).outlineWidth)>0'),true,'Contact focus visible');
  for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,...(type==='keyDown'?{text:'\r'}:{})});
  if(index<expected.length-1)for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 }
 assert.deepEqual(await evaluate('window.contactActivations'),expected);
 await send('Page.navigate',{url:origin+'/contact/'});
 await until(()=>evaluate('document.readyState==="complete" && Boolean(document.querySelector(".contact-report-link a"))'),'Contact tool-list link ready');
 await evaluate('document.querySelector(".contact-report-link a").click()');
 await until(()=>evaluate('location.pathname==="/tools/" && document.readyState==="complete"'),'Contact to tool list navigation');
 await send('Page.navigate',{url:origin+'/tools/prime-factorizer/?input=do-not-forward'});
 await until(()=>evaluate('document.readyState==="complete" && Boolean(document.querySelector(".tool-contact"))'),'Tool contact ready');
 const toolLinks=await evaluate(`[...document.querySelectorAll('.tool-contact a')].map(a=>a.getAttribute('href'))`);
 assert.deepEqual(toolLinks,['/contact/','https://github.com/Xpotato1024/browser-prime-toolkit/issues','/contact/#contact-bugs']);
 await evaluate('document.querySelector(\'.tool-contact a[href="/contact/"]\').click()');
 await until(()=>evaluate('location.pathname==="/contact/" && document.readyState==="complete"'),'Tool to contact navigation');
 return {reports,activationDestinations:expected,activationIntercepted:true,toolLinks};
}
