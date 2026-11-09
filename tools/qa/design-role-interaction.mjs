import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const viewports = [[320,100],[390,100],[1181,100],[1440,100],[320,200],[1440,200]];
const tupleKeys = ['fontFamily','fontSize','fontWeight','lineHeight','display','minHeight'];
const tuple = value => Object.fromEntries(tupleKeys.map(key => [key,value[key]]));

/** Final-dist CSS/keyboard guard. Synthetic probes exist only in browser memory, never public content. */
export async function verifyDesignRoleInteraction({root,origin,send,evaluate,until}) {
  const detailsSource = await readFile(join(root,'apps/site/src/components/content/Details.astro'),'utf8');
  const noteSource = await readFile(join(root,'apps/site/src/content/notes/infrastructure-foundation.mdx'),'utf8');
  const generalDetailsCount = [...noteSource.matchAll(/<Details\s/gu)].length;
  assert.ok(generalDetailsCount>0,'Built noindex note contains general Details');
  const demoSource = await readFile(join(root,'apps/site/src/components/content/Demo.astro'),'utf8');
  assert.match(detailsSource, /<summary class="disclosure-summary">/u, 'General Details opts in to the shared role');
  for (const [tool,site] of [['summary-font-size','disclosure-font-size'],['summary-font-weight','disclosure-font-weight'],['line-height','disclosure-line-height'],['control-min-size','control-min-size']]) {
    assert.ok(demoSource.includes(`--bt-${tool}: var(--${site})`), `Demo bridge: ${tool}`);
  }
  const axeSource = await readFile(join(root,'node_modules/axe-core/axe.min.js'),'utf8');
  const reports=[];
  const key=async(key,code,windowsVirtualKeyCode,text='')=>{
    await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode,text});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode});
  };
  const go=async(path,scale)=>{
    await send('Page.navigate',{url:origin+path});
    await until(()=>evaluate(`location.pathname===${JSON.stringify(path)} && document.readyState==='complete'`),'Design roles: '+path);
    await evaluate('document.fonts.ready');
    await evaluate(`document.documentElement.style.fontSize=${JSON.stringify(scale+'%')}`);
  };
  const snapshot=selector=>evaluate(`(()=>{
    const n=document.querySelector(${JSON.stringify(selector)});if(!n)return null;
    const s=getComputedStyle(n), r=n.getBoundingClientRect();
    return Object.assign({height:r.height,paddingTop:s.paddingTop,paddingBottom:s.paddingBottom,outlineStyle:s.outlineStyle,outlineWidth:s.outlineWidth,outlineColor:s.outlineColor,focusVisible:n.matches(':focus-visible')},Object.fromEntries(${JSON.stringify(tupleKeys)}.map(k=>[k,s[k]])));
  })()`);
  // Resolve CSS tokens using a plain, unclassed probe, not the selector being tested.
  const expected=()=>evaluate(`(()=>{
    const p=document.createElement('div');p.style.cssText='font:var(--disclosure-font-weight) var(--disclosure-font-size)/var(--disclosure-line-height) var(--font-body);display:list-item;min-height:max(var(--control-min-size),44px);padding-block:var(--disclosure-padding-block)';document.body.append(p);
    const s=getComputedStyle(p),result=Object.fromEntries(${JSON.stringify([...tupleKeys,'paddingTop','paddingBottom'])}.map(k=>[k,s[k]]));
    const colors={};for(const role of ['divider','control','tool']){p.style.color='var(--border-'+role+')';colors[role]=getComputedStyle(p).color;}
    p.style.color='var(--focus)';colors.focus=getComputedStyle(p).color;p.remove();return {...result,colors};
  })()`);
  const overflow=async label=>assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false,'No horizontal overflow: '+label);
  const headings=async label=>{
    await evaluate(axeSource);
    const result=await evaluate(`axe.run(document,{runOnly:{type:'rule',values:['heading-order']}}).then(r=>({violations:r.violations,headings:[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(n=>n.checkVisibility()).map(n=>({tag:n.tagName,text:n.textContent.trim()}))}))`);
    assert.deepEqual(result.violations,[],'Visible heading order: '+label);return result.headings;
  };
  const checkSummary=async(selector,reference,{vendor=false}={})=>{
    const before=await snapshot(selector);assert.ok(before,'Required disclosure: '+selector);
    assert.deepEqual(tuple(before),tuple(reference),'Shared summary typography and target: '+selector);
    assert.ok(before.height>=44,'44px target: '+selector);
    // Upstream v0.2.5 exposes typography tokens but fixes .55rem vertical padding.
    const padding=vendor ? (parseFloat(reference.fontSize)*.55)+'px' : reference.paddingTop;
    assert.ok(Math.abs(parseFloat(before.paddingTop)-parseFloat(padding))<.02,'Documented padding role: '+selector);
    assert.equal(before.paddingBottom,before.paddingTop);
    await evaluate(`(()=>{const s=document.querySelector(${JSON.stringify(selector)});s.parentElement.open=false;s.scrollIntoView({block:'center'});s.focus()})()`);
    // Real keyboard input both establishes focus-visible and exercises repeated native toggling.
    for(const [name,code,num,text] of [['Enter','Enter',13,'\r'],['Enter','Enter',13,'\r'],[' ','Space',32,' '],[' ','Space',32,' ']]) {
      const open=await evaluate(`document.querySelector(${JSON.stringify(selector)}).parentElement.open`);
      await key(name,code,num,text);
      await until(()=>evaluate(`document.querySelector(${JSON.stringify(selector)}).parentElement.open===${!open}`),'Native toggle: '+selector);
      const focused=await snapshot(selector);
      assert.ok(focused.focusVisible && focused.outlineStyle==='solid' && parseFloat(focused.outlineWidth)>=3,'Visible keyboard focus: '+selector);
      assert.equal(focused.outlineColor,reference.colors.focus);
      assert.deepEqual(tuple(focused),tuple(reference),'Open/closed typography: '+selector);
      await overflow(selector);
    }
    return before;
  };
  const border=async(selector,side,role,reference)=>{
    const value=await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n)return null;const s=getComputedStyle(n);return {color:s[${JSON.stringify('border'+side+'Color')}],width:s[${JSON.stringify('border'+side+'Width')}],style:s[${JSON.stringify('border'+side+'Style')}]}})()`);
    assert.ok(value,'Required border: '+selector);assert.equal(value.color,reference.colors[role],`${role} color: ${selector}`);assert.ok(parseFloat(value.width)>0&&value.style==='solid','Visible border: '+selector);return {selector,side,role,...value};
  };
  try {
    for(const [width,scale] of viewports) {
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
      await go('/tools/prime-factorizer/',scale);
      await evaluate('document.querySelector("[data-interactive-module]").scrollIntoView()');
      await until(()=>evaluate('document.querySelector(".bt-prime-factorizer")?.dataset.phase === "ready"'),'Design roles Prime hydration');
      const reference=await expected();
      assert.equal(new Set(Object.values(reference.colors)).size,4,'Divider/control/tool/focus roles remain distinct');
      const selectors=await evaluate(`[...document.querySelectorAll('.bt-prime-factorizer summary')].filter(n=>n.checkVisibility()).map((n,i)=>{n.dataset.designRoleProbe='vendor-'+i;return '[data-design-role-probe="vendor-'+i+'"]'})`);
      assert.ok(selectors.length>0,'Actual vendor disclosures present');
      const summaries=[];
      for(const selector of [...selectors,'.prime-offline summary','.tool-release summary']) summaries.push({selector,...await checkSummary(selector,reference,{vendor:selectors.includes(selector)})});
      const visibleHeadings={closed:await headings('Prime closed '+width+'/'+scale)};
      await evaluate(`[...document.querySelectorAll('.bt-prime-factorizer details,.prime-offline details,.tool-release details')].forEach(n=>n.open=true)`);
      visibleHeadings.open=await headings('Prime open '+width+'/'+scale);
      await overflow('Prime all disclosures open');
      await evaluate(`[...document.querySelectorAll('.bt-prime-factorizer details,.prime-offline details,.tool-release details')].forEach(n=>n.open=false)`);
      assert.equal(await evaluate('document.querySelector(".prime-offline h2")?.textContent.trim().length>0'),true,'Offline section is an h2 peer');
      const borders=[];
      for(const [selector,side,role] of [['.tool-release','Top','divider'],['.tool-contact','Top','divider'],['.content-heading','Bottom','divider'],['.site-footer','Top','divider'],['.bt-prime-factorizer .bt-input-area','Top','tool'],['.page-share','Top','divider'],['.page-share-manual input','Top','control']]) borders.push(await border(selector,side,role,reference));
      // Keep the real Demo and release-notice scoped Astro attributes. The separate
      // article shell has no tools ancestor: route-specific fixes must not mask drift.
      // These are synthetic cascade fixtures, not published content evidence.
      await evaluate(`(()=>{
        const shell=document.createElement('main');shell.id='design-role-synthetic';shell.className='content-page';shell.dataset.searchCollection='blog';
        const article=document.createElement('article');article.className='prose';shell.append(article);
        const details=document.createElement('details');details.innerHTML='<summary class="disclosure-summary" data-design-role-probe="general">一般の折りたたみ</summary><p>合成試験</p>';article.append(details);
        const demo=document.querySelector('[data-interactive-module]').cloneNode(false),tool=document.querySelector('.bt-prime-factorizer').cloneNode(false);
        tool.removeAttribute('id');tool.innerHTML='<details><summary data-design-role-probe="inline">埋め込みツールの折りたたみ</summary><p>合成試験</p></details>';demo.append(tool);article.append(demo);
        const release=document.querySelector('.tool-release').cloneNode(true);
        release.querySelector('summary').dataset.designRoleProbe='inline-release';
        for(const n of [release,...release.querySelectorAll('[id]')])n.removeAttribute('id');
        demo.append(release);document.body.append(shell);
      })()`);
      assert.equal(await evaluate(`Boolean(document.querySelector('#design-role-synthetic').closest('[data-search-collection=tools]'))`),false,'Synthetic inline roles have no Tool route ancestor');
      const synthetic=[];
      for(const [name,vendor] of [['general',false],['inline',true],['inline-release',false]]) synthetic.push({name,...await checkSummary('[data-design-role-probe="'+name+'"]',reference,{vendor})});
      await evaluate('document.querySelector("#design-role-synthetic").remove()');
      reports.push({route:'/tools/prime-factorizer/',width,scale,summaries,borders,visibleHeadings,synthetic});

      // A real built, noindex note renders the general Details module without JS.
      await go('/notes/infrastructure-foundation/',scale);
      const noteReference=await expected();
      const noteSelectors=await evaluate(`[...document.querySelectorAll('main .disclosure-summary')].map((n,i)=>{n.dataset.designRoleProbe='note-'+i;return '[data-design-role-probe="note-'+i+'"]'})`);
      assert.equal(noteSelectors.length,generalDetailsCount,'Built note matches its source Details count');
      const generalDetails=[];
      for(const selector of noteSelectors) generalDetails.push({selector,...await checkSummary(selector,noteReference)});
      await overflow('Built general Details note');
      reports.push({route:'/notes/infrastructure-foundation/',width,scale,noindex:true,generalDetails});

      await go('/articles/',scale);
      const archiveReference=await expected();
      const archive=await checkSummary('.archive-tags summary',archiveReference);
      const archiveBorder=await border('.archive-tags','Bottom','divider',archiveReference);
      await overflow('archive');reports.push({route:'/articles/',width,scale,archive,border:archiveBorder});

      await go('/search/',scale);
      const searchReference=await expected(),searchBorders=[];
      for(const [selector,side,role] of [['#search-query','Top','control'],['#header-search-query','Top','control'],['.search-controls','Bottom','divider']]) searchBorders.push(await border(selector,side,role,searchReference));
      await overflow('search');reports.push({route:'/search/',width,scale,borders:searchBorders});

      await go('/contact/',scale);
      await until(()=>evaluate('!document.querySelector("[data-issue-controls]").hidden'),'Contact enhancement');
      const contactBorder=await border('#issue-target','Top','control',await expected());
      await send('Emulation.setScriptExecutionDisabled',{value:true});
      try {
        await go('/contact/',scale);
        assert.equal(await evaluate('document.querySelector("[data-issue-controls]").hidden'),true,'Native no-JS fallback is used');
        const fallback=await checkSummary('[data-issue-fallback] summary',await expected());
        await overflow('no-JS contact');reports.push({route:'/contact/',width,scale,border:contactBorder,noJavaScript:true,fallback});
      } finally {await send('Emulation.setScriptExecutionDisabled',{value:false});}
    }
  } finally {
    await send('Emulation.setScriptExecutionDisabled',{value:false});
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  }
  return {coverage:'Final-dist Prime, built noindex note with general Details, archive, search and native no-JS contact; additional general Details, inline Demo and inline release notice outside the Tool route ancestor are explicitly synthetic cascade probes plus source contracts, not publication evidence.',viewports,reports};
}
