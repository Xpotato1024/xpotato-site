import assert from 'node:assert/strict';

// Local-only scale fixture: reuse the actual final HTML, CSS and client module.
// No fixture tag or page is written to the public artifact/content registry.
export function tagDiscoveryFixture(html) {
  const tags = Array.from({length: 121}, (_, i) => ({id:`fixture-${i}`, label:i === 120 ? '折り返して全文を読める長いタグ名'.repeat(8) : `検証タグ${String(i).padStart(3,'0')}`,
    aliases:i === 119 ? ['ＦＤＭ 試験用別名'] : [], route:`/articles/tag/fixture-${i}/`, count:i + 1}));
  const template = '<template data-tag-catalog>' + tags.map(t => `<div data-id="${t.id}" data-label="${t.label}" data-aliases='${JSON.stringify(t.aliases)}' data-route="${t.route}" data-count="${t.count}"></div>`).join('') + '</template>';
  return html.replace(/<template data-tag-catalog>[\s\S]*?<\/template>/u, template);
}

export async function verifyTagDiscoveryInteraction({origin, send, evaluate, until, audit = async () => {}}) {
  const go = async path => {
    await send('Page.navigate', {url:origin + path});
    await until(() => evaluate(`document.readyState === 'complete' && !!document.querySelector('[data-tag-search] form:not([hidden])')`), 'tag search ready');
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
  return {actualTags:actual,fixtureTags:121,widths:[1440,390,320],pageSize:24,keyboard:true,ime:true,noJavaScript:true,independentSearchHistory:true};
}
