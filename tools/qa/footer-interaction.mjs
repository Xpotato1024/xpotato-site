import assert from 'node:assert/strict';

// Runs in the browser: a new flex row clips its leading decorative rule.
function readSeparatorRows() {
  return [...document.querySelectorAll('.footer-links')].flatMap(list => {
    const box = list.getBoundingClientRect(), rows = [];
    for (const item of list.children) {
      const rect = item.getBoundingClientRect();
      let row = rows.find(row => Math.abs(row.top - rect.top) < 1);
      if (!row) { row = { top: rect.top, rules: [] }; rows.push(row); }
      const rule = getComputedStyle(item, '::before');
      row.rules.push(rule.content === '""' && parseFloat(rule.borderLeftWidth) === 1 && rect.left >= box.left && rect.left < box.right);
    }
    return rows.map(row => row.rules);
  });
}
function checkSeparators(rows) {
  for (const row of rows) assert.deepEqual(row, row.map((_, index) => index > 0), 'Only internal footer separators are visible on each wrapped row');
}

function contrast(foreground, background) {
  const luminance = color => color.match(/[\d.]+/gu).slice(0, 3).map(Number).map(value => {
    const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  }).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

/** Exercise the shipped footer on the same final artifact as the other release checks. */
export async function verifyFooterInteraction({ send, evaluate, until, origin, audit, screenshot, expectedRevision }) {
  const reports = [];
  for (const width of [1440, 1024, 768, 390, 375, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 761 });
    await send('Page.navigate', { url: origin + '/about/' });
    await until(() => evaluate('document.readyState === "complete" && Boolean(document.querySelector(".site-footer"))'), `Footer ${width}`);
    await evaluate('document.fonts.ready.then(() => { document.querySelector(".site-footer").scrollIntoView(); })');
    const state = await evaluate(`(() => {
      const footer = document.querySelector('.site-footer');
      const links = [...footer.querySelectorAll('.footer-nav a')];
      const box = footer.getBoundingClientRect();
      const rows = nodes => {
        const groups = [];
        for (const node of nodes) {
          const rect = node.getBoundingClientRect(), y = rect.y + rect.height / 2;
          let row = groups.find(group => Math.abs(group.y - y) < 8);
          if (!row) { row = { y, left: rect.left, right: rect.right }; groups.push(row); }
          row.left = Math.min(row.left, rect.left); row.right = Math.max(row.right, rect.right);
        }
        return groups.map(row => ({ width: row.right - row.left, centerOffset: (row.left + row.right) / 2 - (box.left + box.width / 2) }));
      };
      return { copyright: footer.querySelector('.footer-copyright').textContent.trim(),
        labels: links.map(a => a.textContent.trim()), paths: links.map(a => a.pathname),
        heights: links.map(a => a.getBoundingClientRect().height),
        overflow: document.documentElement.scrollWidth > innerWidth || box.right > innerWidth + 1,
        timestamp: footer.querySelector('time')?.dateTime ?? null,
        revisionHref: footer.querySelector('.footer-revision a')?.href ?? null,
        revisionText: footer.querySelector('.footer-revision').textContent.trim(),
        foreground: getComputedStyle(footer).color, background: getComputedStyle(document.documentElement).backgroundColor,
        footerHeight: box.height, navRows: rows(links), metaRows: rows([...footer.querySelector('.footer-meta').children]) };
    })()`);
    assert.equal(state.copyright, `© ${new Date().getUTCFullYear()} Xpotato`);
    assert.deepEqual(state.labels, ['Articles', '教育資料', '制作物', 'ツール', 'About', 'メモ', 'RSS']);
    assert.deepEqual(state.paths, ['/articles/', '/education/', '/projects/', '/tools/', '/about/', '/notes/', '/rss.xml']);
    assert.ok(state.heights.every(height => height >= 44), 'Footer navigation touch targets');
    assert.equal(state.overflow, false, `Footer ${width} overflow`);
    assert.ok(contrast(state.foreground, state.background) >= 4.5, 'Footer text contrast');
    assert.ok([...state.navRows, ...state.metaRows].every(row => Math.abs(row.centerOffset) <= 2), 'Footer rows share one visual center');
    assert.ok(state.navRows.every(row => row.width <= 600), 'Footer links retain their text width on a wide page');
    assert.ok(state.footerHeight <= (width >= 768 ? 150 : 240), 'Footer remains compact at normal text size');
    state.separatorRows = await evaluate(`(${readSeparatorRows.toString()})()`);
    checkSeparators(state.separatorRows);
    if (expectedRevision) {
      assert.equal(state.timestamp, expectedRevision.committedAt);
      assert.equal(state.revisionHref, `https://github.com/Xpotato1024/xpotato-site/commit/${expectedRevision.sha}`);
      assert.ok(state.revisionText.includes(expectedRevision.sha.slice(0, 7)));
      const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(expectedRevision.committedAt));
      assert.ok(state.revisionText.includes(date), 'Source date uses Japan time, including UTC day rollover');
    } else {
      assert.equal(state.timestamp, null); assert.equal(state.revisionHref, null);
      assert.equal(state.revisionText, 'ソース改訂情報なし');
    }
    await evaluate('document.querySelector(".footer-nav a").focus()');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    assert.equal(await evaluate('document.activeElement.pathname'), '/education/');
    const focus = await evaluate('(() => { const a = document.activeElement, s = getComputedStyle(a); return { visible: a.matches(":focus-visible"), width: s.outlineWidth, style: s.outlineStyle }; })()');
    assert.equal(focus.visible, true); assert.equal(focus.width, '3px'); assert.equal(focus.style, 'solid');
    await audit(`footer ${width}`);
    if (width === 1440 || width === 390 || width === 320) await screenshot(`footer-${width}.png`);
    reports.push({ width, ...state, focus, textContrast: contrast(state.foreground, state.background) });
  }
  for (const path of reports[0].paths) assert.equal((await fetch(origin + path)).status, 200, `Footer target ${path}`);
  // Browser-only stress fixture; never written into source, dist, or public content.
  await evaluate(`(() => {
    document.documentElement.style.fontSize = '200%';
    const links = document.querySelectorAll('.footer-nav a');
    links[0].textContent = 'Articles and implementation notes';
    links[1].textContent = 'EducationalResourcesWithAnUnbrokenEnglishLabel';
    links[2].textContent = '制作物とものづくりについての長い日本語ラベル';
    document.querySelector('.site-footer').scrollIntoView();
  })()`);
  assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll(".site-footer a")].some(a => a.getBoundingClientRect().right > innerWidth + 1)'), false, 'Footer 320px / 200% / Japanese and English wrapping');
  checkSeparators(await evaluate(`(${readSeparatorRows.toString()})()`));
  await screenshot('footer-320-text-200.png');
  await send('Page.reload');
  await until(() => evaluate('document.readyState === "complete" && getComputedStyle(document.documentElement).fontSize === "16px"'), 'Footer fixture reset');
  return { reports, textZoom: '320px / 200% / Japanese + English PASS', links: 'all internal targets HTTP 200' };
}
