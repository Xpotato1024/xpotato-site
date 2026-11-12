import assert from 'node:assert/strict';

export async function verifyUpdateActivityInteraction({ send, evaluate, until, origin, audit, screenshot }) {
  const records = [];
  const snapshot = () => evaluate(`(()=>{const root=document.querySelector('[data-update-activity]');return {tops:[...root.querySelectorAll('.home-update-week')].map(n=>Math.round(n.getBoundingClientRect().top)),bannerWidth:root.querySelector('[data-update-banner]').getBoundingClientRect().width,bandWidth:root.querySelector('.home-update-band').getBoundingClientRect().width,count:root.querySelectorAll('.home-update-week').length,current:root.querySelectorAll('[data-current]').length,recent:root.querySelectorAll('[data-recent]').length,summary:root.querySelector('.home-update-summary')?.textContent,latest:root.querySelector('[data-update-latest]').textContent,totals:[...root.querySelectorAll('.home-update-count')].map(n=>Number(n.textContent)),labels:[...root.querySelectorAll('.home-update-count')].map(n=>n.getAttribute('aria-label')),interactive:root.querySelectorAll('.home-update-strip a,.home-update-strip button,.home-update-strip [tabindex]').length,overflow:document.documentElement.scrollWidth>innerWidth,animation:[...root.querySelectorAll('.home-update-week')].some(n=>getComputedStyle(n).animationName!=='none'),fixture:root.querySelector('[data-update-fixture]')?.textContent}})()`);
  for (const width of [320, 390, 1487]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 760 });
    for (const scenario of ['sparse', 'stalled', 'recent', 'invalid']) {
      await send('Page.navigate', { url: `${origin}/__updates-fixture__/${scenario}/` });
      await until(() => evaluate(`location.pathname==='/__updates-fixture__/${scenario}/' && document.readyState==='complete' && document.querySelectorAll('.home-update-week').length===13`), '13 live weeks');
      await evaluate('document.fonts.ready');
      const data = await snapshot();
      assert.equal(new Set(data.tops).size, 1); assert.ok(data.bannerWidth<=data.bandWidth);
      assert.equal(data.count, 13); assert.equal(data.current, 1); assert.equal(data.interactive, 0);
      assert.equal(data.overflow, false); assert.equal(data.animation, false); assert.ok(data.fixture.includes('実際の更新記録ではありません'));
      assert.ok(data.labels.every(label => /^\d{4}-\d{2}-\d{2}の週：\d+件/.test(label)));
      if (scenario === 'stalled') {
        assert.ok(data.totals.slice(-8).every(count => count === 0)); assert.match(data.latest, /65日前/); assert.equal(data.recent, 0);
      } else {
        assert.equal(data.summary, '直近13週で3件'); assert.equal(data.recent, scenario === 'recent' ? 1 : 0);
      }
      await audit(`update strip ${scenario} ${width}`);
      await screenshot(`home-updates-${scenario}-${width}.png`);
      records.push({ width, scenario, ...data });
      if (width <= 390 && scenario === 'sparse') {
        await evaluate("document.documentElement.style.fontSize='200%'");
        const zoom = await snapshot(); assert.equal(zoom.overflow, false); assert.equal(zoom.count, 13);
        await screenshot(`home-updates-sparse-${width}-text200.png`); records.push({ width, scenario: 'text200', ...zoom });
      }
    }
  }
  // Time-zone override cannot change JST grouping. No-JS remains an honest absolute-date fallback.
  for (const timezoneId of ['America/Los_Angeles', 'Asia/Tokyo']) {
    await send('Emulation.setTimezoneOverride', { timezoneId });
    await send('Page.navigate', { url: origin + '/__updates-fixture__/sparse/' });
    await until(() => evaluate("location.pathname==='/__updates-fixture__/sparse/' && document.readyState==='complete' && document.querySelectorAll('.home-update-week').length===13"), 'timezone fixture');
    const data = await snapshot(); assert.equal(data.summary, '直近13週で3件'); records.push({ timezoneId, ...data });
  }
  assert.deepEqual(records.at(-1).labels, records.at(-2).labels);
  await send('Emulation.setTimezoneOverride', { timezoneId: '' });
  await send('Emulation.setScriptExecutionDisabled', { value: true });
  try {
    await send('Page.navigate', { url: origin + '/__updates-fixture__/stalled/' });
    await until(() => evaluate("location.pathname==='/__updates-fixture__/stalled/' && document.readyState==='complete'"), 'no JS fallback');
    const data = await snapshot(); assert.equal(data.count, 0); assert.match(data.latest, /最終更新 \d{4}-\d{2}-\d{2}/);
    await screenshot('home-updates-nojs.png'); records.push({ scenario: 'nojs', ...data });
  } finally { await send('Emulation.setScriptExecutionDisabled', { value: false }); }
  await send('Page.navigate', { url: origin + '/' });
  return records;
}
