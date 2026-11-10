import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const viewports = [[320,100],[390,100],[1181,100],[1440,100],[320,200],[1440,200]];
const tupleKeys = ['fontFamily','fontSize','fontWeight','lineHeight','display','minHeight'];
const tuple = value => Object.fromEntries(tupleKeys.map(key => [key,value[key]]));

// These boundary roles currently require opaque sRGB colors. Do not silently
// treat a transparent/new color format as white or claim a contrast pass.
export function boundaryContrast(foreground, background) {
  const luminance = value => {
    const match = /^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/.exec(value);
    assert.ok(match && (match[4] === undefined || Number(match[4]) === 1), 'Opaque sRGB boundary color required: '+value);
    const channels=match.slice(1,4).map(Number);
    assert.ok(channels.every(channel=>Number.isFinite(channel)&&channel>=0&&channel<=255));
    return channels.map(channel=>{const c=channel/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
  };
  const a=luminance(foreground),b=luminance(background);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}

/** Final-dist CSS/keyboard guard. Synthetic probes exist only in browser memory, never public content. */
export async function verifyDesignRoleInteraction({root,origin,send,evaluate,until,screenshot}) {
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
    // A same-path reload (especially after disabling JavaScript) must not
    // satisfy readiness from the previous, already-enhanced document.
    await send('Page.navigate',{url:'about:blank'});
    await until(()=>evaluate('location.href==="about:blank"'),'Fresh design-role document');
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
    p.style.color='var(--focus)';colors.focus=getComputedStyle(p).color;p.remove();return {...result,colors,rootFontSize:getComputedStyle(document.documentElement).fontSize};
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
    // Adopted v0.2.6 consumes the shared public summary padding token.
    const padding=reference.paddingTop;
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
    const value=await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n)return null;const s=getComputedStyle(n);return {visible:n.checkVisibility(),background:s.backgroundColor,color:s[${JSON.stringify('border'+side+'Color')}],width:s[${JSON.stringify('border'+side+'Width')}],style:s[${JSON.stringify('border'+side+'Style')}]}})()`);
    assert.ok(value,'Required border: '+selector);assert.equal(value.color,reference.colors[role],`${role} color: ${selector}`);assert.ok(parseFloat(value.width)>0&&value.style==='solid','Defined border: '+selector);
    const contrast=role==='divider'?null:boundaryContrast(value.color,value.background);
    if(contrast!==null)assert.ok(contrast>=3,'Control boundary contrast is at least 3:1: '+selector+' ('+contrast+')');
    return {selector,side,role,...value,contrast};
  };
  const manifest=JSON.parse(await readFile(join(root,'apps/site/src/styles/design-roles.json'),'utf8'));
  const siteMatrix=[];
  const inspectSiteRoles=async(route,width,scale)=>{
    await go(route,scale);
    await until(()=>evaluate(`(()=>{const h=document.querySelector('.header-band');return !h||h.getAnimations({subtree:true}).filter(a=>'transitionProperty' in a).every(a=>['finished','idle'].includes(a.playState))})()`),'Settled design surfaces: '+route);
    const values=await evaluate(`(()=>{
      const token=(property,value)=>{const p=document.createElement('span');p.style[property]=value;document.body.append(p);const v=getComputedStyle(p)[property];p.remove();return v;};
      const read=n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return {tag:n.tagName,classes:n.className,height:r.height,fontFamily:s.fontFamily,fontSize:s.fontSize,minHeight:s.minHeight,color:s.color,background:s.backgroundColor,border:s.borderTopColor,borderWidth:s.borderTopWidth,outlineColor:s.outlineColor,outlineWidth:s.outlineWidth,clipPath:s.clipPath,width:r.width};};
      return {
        expected:{body:token('fontFamily','var(--font-body)'),display:token('fontFamily','var(--font-display)'),minHeight:token('minHeight','var(--control-min-size)'),surface:token('backgroundColor','var(--surface)'),field:token('backgroundColor','var(--surface-control)'),boundary:token('color','var(--border-control)'),accent:token('color','var(--accent)'),onAccent:token('color','var(--on-accent)')},
        fields:[...document.querySelectorAll('.control-field')].map(n=>({...read(n),surface:n.classList.contains('control-field--surface')})),
        actions:[...document.querySelectorAll('.action-primary')].map(n=>({...read(n),disabled:n.disabled})),
        cards:[...document.querySelectorAll('.article-card h2,.article-card h3')].map(read),
        hidden:[...document.querySelectorAll('.carousel-status,.code-copy-status')].map(read),
        headings:[...document.querySelectorAll('.prose > h2,.content-heading h1')].map(read),
        modules:[...document.querySelectorAll('.article-diagrams,.article-callout,.article-steps,.article-diagnostics')].map(read),
        rawFields:[...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(n=>!n.closest('[data-bt]')&&!n.matches('.control-field,.code-copy-buffer')).map(n=>n.outerHTML)
      };
    })()`);
    assert.deepEqual(values.rawFields,[],'Every site field uses its declared primitive: '+route);
    for(const field of values.fields){
      // Home's photo/header fusion is a declared surface exception.
      if(route==='/' && field.classes.includes('control-field')) continue;
      assert.equal(field.minHeight,values.expected.minHeight,'Field target token: '+route);
      assert.equal(field.border,values.expected.boundary,'Field boundary role: '+route);
      assert.equal(field.background,field.surface?values.expected.surface:values.expected.field,'Field surface role: '+route);
      assert.ok(boundaryContrast(field.border,field.background)>=3,'Field contrast: '+route);
      assert.equal(field.fontFamily,values.expected.body,'Field body font: '+route);
    }
    for(const action of values.actions){
      assert.equal(action.minHeight,values.expected.minHeight,'Primary target token: '+route);
      assert.equal(action.fontFamily,values.expected.body,'Primary body font: '+route);
      if(!action.disabled){assert.equal(action.background,values.expected.accent);assert.equal(action.color,values.expected.onAccent);assert.ok(boundaryContrast(action.color,action.background)>=4.5);}
    }
    for(const card of values.cards) assert.equal(card.fontFamily,card.tag==='H2'?values.expected.display:values.expected.body,'Card heading hierarchy: '+route);
    for(const heading of values.headings) assert.equal(heading.fontFamily,values.expected.display,'Editorial heading: '+route);
    for(const hidden of values.hidden) {assert.equal(hidden.width,1);assert.equal(hidden.height,1);assert.equal(hidden.clipPath,'inset(50%)');}
    await overflow(route+' '+width+'/'+scale);
    // Same final dist and real route. Serious/critical axe failures are never
    // excused merely because a visual exception is registered.
    await evaluate(axeSource);
    const axe=await evaluate(`axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}).then(r=>({violations:r.violations.filter(v=>['serious','critical'].includes(v.impact)),incomplete:r.incomplete.map(v=>v.id)}))`);
    assert.deepEqual(axe.violations,[],'Role matrix accessibility: '+route+' '+width+'/'+scale);
    if(screenshot && ['/', '/search/', '/articles/77arj41r5z8amrn46pdx71mknr/'].includes(route) && scale===100) await screenshot('design-'+(route==='/'?'home':route.split('/')[1])+'-'+width+'.png');
    return {route,width,scale,...values,axe};
  };
  try {
    for(const [width,scale] of manifest.browserCoverage.viewports){
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
      for(const route of manifest.browserCoverage.routes) siteMatrix.push(await inspectSiteRoles(route,width,scale));
    }
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
      for(const [selector,side,role] of [['.tool-release','Top','divider'],['.tool-contact','Top','divider'],['.content-heading','Bottom','divider'],['.site-footer','Top','divider'],['.bt-prime-factorizer .bt-input-area','Top','control'],['.bt-prime-factorizer .bt-help-area','Top','divider'],['.page-share','Top','divider'],['.page-share-manual input','Top','control']]) borders.push(await border(selector,side,role,reference));
      // Exercise public overrides on the actual adopted Prime, not the template fixture.
      const styleRoles=()=>evaluate(`(()=>{const r=document.querySelector('.bt-prime-factorizer');return {control:getComputedStyle(r.querySelector('.bt-input-area')).borderTopColor,divider:getComputedStyle(r.querySelector('.bt-help-area')).borderTopColor,padding:getComputedStyle(r.querySelector('summary')).paddingTop}})()`);
      const roleBefore=await styleRoles();
      assert.notEqual(roleBefore.control,roleBefore.divider);
      await evaluate(`document.querySelector('.bt-prime-factorizer').style.setProperty('--bt-border-divider','#eeeeee')`);
      const dividerOverride=await styleRoles();assert.equal(dividerOverride.divider,'rgb(238, 238, 238)');assert.equal(dividerOverride.control,roleBefore.control);
      await evaluate(`document.querySelector('.bt-prime-factorizer').style.setProperty('--bt-border-control','#444444')`);
      const controlOverride=await styleRoles();assert.equal(controlOverride.control,'rgb(68, 68, 68)');assert.equal(controlOverride.divider,dividerOverride.divider);
      await evaluate(`document.querySelector('.bt-prime-factorizer').style.setProperty('--bt-summary-padding-block','13px')`);
      assert.equal((await styleRoles()).padding,'13px');
      await evaluate(`(()=>{const s=document.querySelector('.bt-prime-factorizer').style;for(const p of ['--bt-border-divider','--bt-border-control','--bt-summary-padding-block'])s.removeProperty(p)})()`);
      assert.deepEqual(await styleRoles(),roleBefore,'Public role overrides restore actual host values');
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
  return {coverage:'Final-dist Prime, built noindex note with general Details, archive, search and native no-JS contact; additional general Details, inline Demo and inline release notice outside the Tool route ancestor are explicitly synthetic cascade probes plus source contracts, not publication evidence.',viewports,reports,siteMatrix};
}
