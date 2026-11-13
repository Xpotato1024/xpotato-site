import assert from 'node:assert/strict';

// Local-only scale fixture: reuse the actual final HTML, CSS and client module.
// No fixture tag or page is written to the public artifact/content registry.
export function tagDiscoveryFixture(html) {
  const actualRoute = /data-route="([^"]+)"/u.exec(html)?.[1];
  assert.ok(actualRoute, 'A real public tag archive is available for the return-navigation test');
  const tags = Array.from({length: 121}, (_, i) => ({id:`fixture-${i}`, label:i === 120 ? '折り返して全文を読める長いタグ名'.repeat(8) : `検証タグ${String(i).padStart(3,'0')}`,
    aliases:i === 119 ? ['ＦＤＭ 試験用別名'] : i < 25 ? ['boundary-match'] : [], route:i === 119 ? actualRoute : `/articles/tag/fixture-${i}/`, count:i + 1}));
  const template = '<template data-tag-catalog>' + tags.map(t => `<div data-id="${t.id}" data-label="${t.label}" data-aliases='${JSON.stringify(t.aliases)}' data-route="${t.route}" data-count="${t.count}"></div>`).join('') + '</template>';
  return html.replace(/<template data-tag-catalog>[\s\S]*?<\/template>/u, template);
}

export async function verifyTagDiscoveryInteraction({origin, send, evaluate, until, audit = async () => {}}) {
  const go = async path => {
    await send('Page.navigate', {url:origin + path});
    await until(() => evaluate(`location.href === ${JSON.stringify(new URL(path,origin).href)} && document.readyState === 'complete' && !!document.querySelector('[data-tag-search] form:not([hidden])')`), 'tag search ready');
    // Chromium can apply initial #tags fragment focus after load. Finish the
    // font/layout rendering opportunity before sending real keyboard input;
    // the paging focus and subsequent Tab assertions below remain immediate.
    await evaluate('document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))');
  };
  const query = async value => {
    await evaluate(`document.querySelector('#tag-query').focus(); document.querySelector('#tag-query').value='';`);
    await send('Input.insertText', {text:value});
  };
  const count = () => evaluate(`document.querySelectorAll('#tag-results li').length`);
  const key = async (key, code, keyCode, text = '') => {
    await send('Input.dispatchKeyEvent', {type:'keyDown', key, code, windowsVirtualKeyCode:keyCode, text});
    await send('Input.dispatchKeyEvent', {type:'keyUp', key, code, windowsVirtualKeyCode:keyCode});
  };
  await go('/search/#tags');
  const actual = await count();
  assert.ok(actual <= 24);
  if(actual) {
    const first = await evaluate(`document.querySelector('#tag-results a > span').textContent`);
    await query(first); assert.ok(await count() >= 1);
    assert.equal(await evaluate(`new URL(location.href).searchParams.get('tag')`), first);
  }
  for (const width of [1440,390,320]) {
    await send('Emulation.setDeviceMetricsOverride', {width,height:900,deviceScaleFactor:1,mobile:width<760});
    await go('/__tag-discovery-fixture__/?q=&tag=検証#tags');
    assert.equal(await count(),24);
    assert.equal(await evaluate(`document.querySelector('[data-tag-page]').textContent`),'1 / 5');
    await evaluate(`document.querySelector('[data-tag-next]').focus()`);
    await key('Enter','Enter',13,'\r');
    assert.equal(await evaluate(`document.querySelector('[data-tag-page]').textContent`),'2 / 5');
    assert.equal(await evaluate(`document.activeElement.id`),'tag-status');
    await key('Tab','Tab',9);
    assert.equal(await evaluate(`document.activeElement.closest('#tag-results')?.id`),'tag-results');
    await query('fdm'); assert.equal(await count(),1);
    assert.equal(await evaluate(`document.querySelector('#tag-results a > span').textContent`),'検証タグ119');
    await query('一致しない語'); assert.equal(await count(),0);
    assert.match(await evaluate(`document.querySelector('#tag-status').textContent`),/一致するタグはありません/u);
    await evaluate(`document.querySelector('.tag-search-form button[type=reset]').click()`);
    await until(() => count().then(n=>n===24),'clear tags');
    assert.equal(await evaluate(`document.activeElement.id`),'tag-query');
    assert.equal(await evaluate(`new URL(location.href).searchParams.get('q')`),'');
    await query('長いタグ'); assert.equal(await count(),1);
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`),true,`long tag reflow ${width}`);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('#tag-results a')).every(a=>a.getBoundingClientRect().height>=44)`),true);
    await audit(`tags ${width}px long label`);
    if(width===320){
      await evaluate(`document.documentElement.style.fontSize='200%'`);
      assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`),true,'200% text reflow');
      await evaluate(`document.documentElement.style.fontSize=''`);
    }
    await evaluate(`document.querySelector('#tag-query').dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));document.querySelector('#tag-query').value='検証タグ';document.querySelector('#tag-query').dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));`);
    assert.equal(await count(),1,'IME intermediate value keeps the current result');
    await evaluate(`document.querySelector('#tag-query').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));`);
    assert.equal(await count(),24,'IME commits once');
  }
  const traverse = async (search, total) => {
    await go('/__tag-discovery-fixture__/#tags');
    if(search) await query(search);
    const found = [];
    const pages = Math.ceil(total / 24);
    for(let page = 1; page <= pages; page++) {
      assert.equal(await evaluate(`document.querySelector('[data-tag-page]').textContent`),`${page} / ${pages}`);
      assert.equal(await evaluate(`document.querySelector('#tag-status').textContent`),`${total}タグ・${(page - 1) * 24 + 1}〜${Math.min(page * 24,total)}件を表示（タグ名順）`);
      const links = await evaluate(`Array.from(document.querySelectorAll('#tag-results a'),a=>a.getAttribute('href'))`);
      assert.equal(links.length,Math.min(24,total-(page-1)*24));
      found.push(...links);
      assert.equal(await evaluate(`document.querySelector('[data-tag-prev]').disabled`),page === 1);
      assert.equal(await evaluate(`document.querySelector('[data-tag-next]').disabled`),page === pages);
      if(page < pages) {
        await evaluate(`document.querySelector('[data-tag-next]').focus()`);
        await key('Enter','Enter',13,'\r');
        assert.equal(await evaluate(`document.activeElement.id`),'tag-status');
        await key('Tab','Tab',9);
        assert.equal(await evaluate(`document.activeElement === document.querySelector('#tag-results a')`),true);
      }
    }
    assert.equal(new Set(found).size,total,'Every matching tag is reachable exactly once');
    return {matches:total,pages,lastPage:Math.min(24,(total-1)%24+1)};
  };
  const boundaries = [];
  for(const width of [1440,390]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<760});
    for(const [search,total] of [['',121],['検証',120],['boundary-match',25]]) boundaries.push({width,query:search,...await traverse(search,total)});
  }
  // Return from a real public tag archive to a filtered final result page.
  await traverse('検証',120);
  const returnHistory = await send('Page.getNavigationHistory');
  const returnEntry = returnHistory.entries[returnHistory.currentIndex].id;
  const actualRoute = await evaluate(`Array.from(document.querySelectorAll('#tag-results a')).find(a=>!a.getAttribute('href').includes('/fixture-')).getAttribute('href')`);
  await evaluate(`Array.from(document.querySelectorAll('#tag-results a')).find(a=>a.getAttribute('href')===${JSON.stringify(actualRoute)}).click()`);
  await until(() => evaluate(`location.pathname===${JSON.stringify(actualRoute)} && document.readyState==='complete' && !!document.querySelector('.archive-tags')`),'actual tag archive');
  await evaluate(`document.querySelector('.archive-tags summary').focus()`);
  await key('Enter','Enter',13,'\r');
  const selected = await evaluate(`(() => {const links=Array.from(document.querySelectorAll('.archive-tags .tag-links a')),a=links[0],style=getComputedStyle(a),other=getComputedStyle(links[1]);return {href:a.getAttribute('href'),current:a.getAttribute('aria-current'),weight:style.fontWeight,emphasized:style.color!==other.color&&style.borderBottomColor!==other.borderBottomColor};})()`);
  assert.equal(selected.href,actualRoute); assert.equal(selected.current,'page');
  assert.equal(selected.weight,'700'); assert.equal(selected.emphasized,true);
  await send('Page.navigateToHistoryEntry',{entryId:returnEntry});
  await until(() => evaluate(`document.querySelector('#tag-query')?.value==='検証' && document.querySelector('[data-tag-page]').textContent==='5 / 5' && document.querySelectorAll('#tag-results li').length===24`),'return restores filtered final page');
  assert.equal(await evaluate(`new URL(location.href).searchParams.get('tagPage')`),'5');
  await evaluate(`document.querySelector('.tag-search-form').reset()`);
  await until(() => evaluate(`document.activeElement.id==='tag-query' && document.querySelector('[data-tag-page]').textContent==='1 / 6'`),'return then clear restores input and first page');
  await go('/__tag-discovery-fixture__/?q=first&tag=検証#tags');
  await evaluate(`document.querySelector('[data-tag-next]').click()`);
  assert.equal(await evaluate(`new URL(location.href).searchParams.get('tagPage')`),'2');
  await evaluate(`document.querySelector('#search-query').value='second';document.querySelector('#search-form').requestSubmit()`);
  await until(() => evaluate(`new URL(location.href).searchParams.get('q')==='second'`),'full-text query update');
  const history = await send('Page.getNavigationHistory');
  await send('Page.navigateToHistoryEntry',{entryId:history.entries[history.currentIndex-1].id});
  await until(() => evaluate(`document.querySelector('#search-query').value==='first' && document.querySelector('[data-tag-page]').textContent==='2 / 5'`),'restore full-text query and tag page');
  await send('Page.navigateToHistoryEntry',{entryId:history.entries[history.currentIndex].id});
  await until(() => evaluate(`document.querySelector('#search-query').value==='second' && document.querySelector('[data-tag-page]').textContent==='2 / 5'`),'forward restores both searches');
  await query('fdm');
  assert.equal(await count(),1);
  assert.equal(await evaluate(`document.querySelector('#search-query').value`),'second');
  assert.equal(await evaluate(`new URL(location.href).searchParams.has('tagPage')`),false);
  await evaluate(`document.querySelector('.tag-search-form').reset()`);
  await until(() => count().then(n=>n===24),'clear after history');
  assert.equal(await evaluate(`new URL(location.href).searchParams.get('q')`),'second');
  await evaluate(`document.querySelector('#search-form').reset()`);
  await until(() => evaluate(`!new URL(location.href).searchParams.has('q') && document.querySelector('#tag-query').value===''`),'independent full-text clear');
  await send('Emulation.setScriptExecutionDisabled',{value:true});
  try {
    await send('Page.navigate',{url:origin+'/articles/tags/'});
    await until(() => evaluate(`document.readyState==='complete' && !!document.querySelector('.tag-directory')`),'static tag directory');
    assert.ok(await evaluate(`Array.from(document.querySelectorAll('.tag-links a')).every(a=>a.getAttribute('href').startsWith('/articles/tag/'))`));
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`),true);
    await send('Page.navigate',{url:origin+'/search/#tags'});
    await until(() => evaluate(`document.readyState==='complete' && !!document.querySelector('[data-tag-search]')`),'static search fallback');
    assert.equal(await evaluate(`document.querySelector('.tag-search-form').hidden`),true);
    assert.ok(await evaluate(`document.querySelector('[data-tag-search] noscript').textContent.includes('JavaScript')`));
    await send('Page.navigate',{url:origin+'/articles/'});
    await until(() => evaluate(`document.readyState==='complete' && !!document.querySelector('.archive')`),'static article archive');
    await evaluate(`document.querySelector('.archive-tags summary')?.focus()`);
    await key('Enter','Enter',13,'\r');
    assert.equal(await evaluate(`document.querySelector('.archive-tags')?.open ?? true`),true);
    assert.ok(await evaluate(`document.querySelectorAll('.archive-tags .tag-links a').length <= 6`));
  } finally { await send('Emulation.setScriptExecutionDisabled',{value:false}); }
  await send('Emulation.setDeviceMetricsOverride',{width:1487,height:1058,deviceScaleFactor:1,mobile:false});
  // The category chooser is native HTML and remains bounded as broad categories grow.
  await send('Page.navigate',{url:origin+'/articles/'});
  await until(() => evaluate(`document.readyState==='complete' && !!document.querySelector('.archive-categories')`),'category chooser');
  assert.equal(await evaluate(`document.querySelector('.archive-categories').open`),false);
  await evaluate(`document.querySelector('.archive-categories summary').focus()`);
  await key('Enter','Enter',13,'\r');
  assert.equal(await evaluate(`document.querySelector('.archive-categories').open`),true);
  assert.equal(await evaluate(`document.querySelector('.archive-category-options a[aria-current]').textContent`),'すべて');
  await evaluate(`(() => { const nav=document.querySelector('.archive-category-options'); for(let i=0;i<60;i++){const a=document.createElement('a');a.href='/articles/';a.textContent='検証用の主分類'+i;nav.append(a);} })()`);
  for(const width of [1440,390,320]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    const shape=await evaluate(`(() => {const n=document.querySelector('.archive-category-options');return {bounded:n.clientHeight<=192,scrolls:n.scrollHeight>n.clientHeight,overflow:document.documentElement.scrollWidth>innerWidth};})()`);
    assert.deepEqual(shape,{bounded:true,scrolls:true,overflow:false},'bounded category choices at '+width);
  }
  await evaluate(`document.querySelector('.archive-category-options a:last-child').focus()`);
  assert.equal(await evaluate(`document.querySelector('.archive-category-options').scrollTop>0`),true);
  await evaluate(`document.querySelector('.archive-categories summary').focus()`);
  await key('Enter','Enter',13,'\r');
  assert.equal(await evaluate(`document.querySelector('.archive-categories').open`),false);
  await key('Enter','Enter',13,'\r');
  assert.equal(await evaluate(`document.querySelector('.archive-categories').open`),true);
  return {actualTags:actual,fixtureTags:121,fixtureCategories:60,boundedCategories:true,widths:[1440,390,320],pageSize:24,keyboard:true,ime:true,noJavaScript:true,independentSearchHistory:true,boundaries,currentTagStyle:selected,tagArchiveReturn:true};
}
