import assert from 'node:assert/strict';

export async function verifyUpdateActivityInteraction({ send, evaluate, until, origin, audit, screenshot }) {
  const records = [];
  const snapshot = () => evaluate(`(()=>{const root=document.querySelector('[data-update-activity]'),cells=[...root.querySelectorAll('.home-update-week')],markers=[...root.querySelectorAll('.home-update-count')],band=root.querySelector('.home-update-band'),latest=root.querySelector('[data-update-latest]'),link=root.querySelector('[data-update-banner] a'),plot=root.querySelector('.home-update-plot');return {tops:cells.map(n=>Math.round(n.getBoundingClientRect().top)),widths:cells.map(n=>n.getBoundingClientRect().width),plotWidth:plot?.getBoundingClientRect().width,plotX:plot?.getBoundingClientRect().x,bannerWidth:root.querySelector('[data-update-banner]').getBoundingClientRect().width,bandWidth:band.getBoundingClientRect().width,bandLine:link?Math.abs(latest.getBoundingClientRect().top-link.getBoundingClientRect().top)<5:true,bandHeight:band.getBoundingClientRect().height,count:cells.length,current:root.querySelectorAll('[data-current]').length,recent:root.querySelectorAll('[data-recent]').length,summary:root.querySelector('.home-update-summary')?.textContent,latest:latest.textContent,latestMeaning:latest.querySelector('.visually-hidden')?.textContent,bannerMeaning:link?.getAttribute('aria-label'),totals:cells.map(n=>Number(n.dataset.total)),visibleNumbers:markers.some(n=>n.textContent.trim()),labels:markers.map(n=>n.getAttribute('aria-label')),tooltips:markers.map(n=>n.title),months:root.querySelector('.home-update-axis')?.textContent,interactive:root.querySelectorAll('.home-update-strip a,.home-update-strip button,.home-update-strip [tabindex]').length,overflow:document.documentElement.scrollWidth>innerWidth,animation:cells.some(n=>getComputedStyle(n).animationName!=='none'),fixture:root.querySelector('[data-update-fixture]')?.textContent}})()`);
  for (const width of [320, 390, 1487]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 760 });
    for (const scenario of ['current', 'sliding', 'stalled', 'recent', 'invalid', 'article-latest']) {
      const count = ['sliding', 'stalled'].includes(scenario) ? 13 : 6;
      await send('Page.navigate', { url: `${origin}/__updates-fixture__/${scenario}/` });
      await until(() => evaluate(`location.pathname==='/__updates-fixture__/${scenario}/' && document.readyState==='complete' && document.querySelectorAll('.home-update-week').length===${count}`), 'launch-aware live weeks');
      await evaluate('document.fonts.ready');
      const data = await snapshot();
      assert.equal(new Set(data.tops).size, 1); assert.ok(data.bannerWidth<=data.bandWidth);
      assert.equal(data.count, count); assert.equal(data.current, 1); assert.equal(data.interactive, 0);
      assert.ok(data.widths.every(width => width >= 24)); assert.equal(data.plotWidth, 316); assert.ok(data.plotX >= 0);
      assert.equal(data.visibleNumbers, false); assert.equal(data.bandLine, true); assert.ok(data.bandHeight < 32);
      assert.deepEqual(data.labels, data.tooltips); assert.match(data.months, /\d+月/); assert.doesNotMatch(data.months, /\d{4}-/);
      assert.equal(data.overflow, false); assert.equal(data.animation, false); assert.ok(data.fixture.includes('実際の更新記録ではありません'));
      assert.ok(data.labels.every(label => /^\d{4}-\d{2}-\d{2}の週：\d+件/.test(label)));
      if (scenario === 'stalled') {
        assert.ok(data.totals.slice(-8).every(count => count === 0)); assert.match(data.latest, /65日前/); assert.equal(data.recent, 0);
      } else {
        assert.ok(data.summary.startsWith(scenario === 'sliding' ? '直近13週で3件' : scenario === 'current' ? '公開から6週で9件' : '公開から6週で3件'));
        assert.equal(data.recent, scenario === 'recent' ? 1 : 0);
      }
      if (scenario === 'article-latest') { assert.match(data.latestMeaning, /記事/); assert.match(data.bannerMeaning, /ツール/); }
      await audit(`update strip ${scenario} ${width}`);
      await screenshot(`home-updates-${scenario}-${width}.png`);
      records.push({ width, scenario, ...data });
      if (width <= 390 && scenario === 'sliding') {
        await evaluate("document.documentElement.style.fontSize='200%'");
        const zoom = await snapshot(); assert.equal(zoom.overflow, false); assert.equal(zoom.count, 13);
        assert.ok(zoom.widths.every(width => width >= 24));
        await screenshot(`home-updates-sliding-${width}-text200.png`); records.push({ width, scenario: 'text200', ...zoom });
      }
    }
  }
  // Time-zone override cannot change JST grouping. No-JS remains an honest absolute-date fallback.
  for (const timezoneId of ['America/Los_Angeles', 'Asia/Tokyo']) {
    await send('Emulation.setTimezoneOverride', { timezoneId });
    await send('Page.navigate', { url: origin + '/__updates-fixture__/current/' });
    await until(() => evaluate("location.pathname==='/__updates-fixture__/current/' && document.readyState==='complete' && document.querySelectorAll('.home-update-week').length===6"), 'timezone fixture');
    const data = await snapshot(); assert.equal(data.summary, '公開から6週で9件'); records.push({ timezoneId, ...data });
  }
  assert.deepEqual(records.at(-1).labels, records.at(-2).labels);
  await send('Emulation.setTimezoneOverride', { timezoneId: '' });
  // QA-only clock: cover a month change in the last slot and a one-week opening month.
  for (const instant of ['2027-02-01T12:00:00+09:00', '2027-02-22T12:00:00+09:00']) {
    const now = Date.parse(instant);
    const script = await send('Page.addScriptToEvaluateOnNewDocument', { source: `if(location.pathname.startsWith('/__updates-fixture__/')){const OriginalDate=Date;window.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:[${now}]))}static now(){return ${now}}};}` });
    try {
      await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 900, deviceScaleFactor: 1, mobile: true });
      await send('Page.navigate', { url: origin + '/__updates-fixture__/sliding/?at=' + encodeURIComponent(instant) });
      await until(() => evaluate("location.pathname==='/__updates-fixture__/sliding/' && document.readyState==='complete' && document.querySelectorAll('.home-update-week').length===13"), 'month edge fixture');
      await evaluate("document.documentElement.style.fontSize='200%';document.fonts.ready");
      const data = await snapshot(); assert.equal(data.overflow, false);
      const labels = await evaluate(`(()=>[...document.querySelectorAll('.home-update-axis span')].filter(n=>n.textContent).map(n=>{const range=document.createRange();range.selectNodeContents(n);const r=range.getBoundingClientRect();return{x:r.x,right:r.right}}))()`);
      assert.ok(labels.every((label,index)=>label.x>=0 && label.right<=320 && (index===0 || labels[index-1].right<=label.x)),'Month labels fit and do not overlap');
      await screenshot(`home-updates-month-edge-${instant.slice(0,10)}-320-text200.png`); records.push({ scenario: 'month-edge', instant, ...data });
    } finally { await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: script.identifier }); }
  }
  await send('Emulation.setScriptExecutionDisabled', { value: true });
  try {
    for (const width of [320, 390, 1487]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 760 });
      await send('Page.navigate', { url: origin + '/__updates-fixture__/current/' });
      await until(() => evaluate("location.pathname==='/__updates-fixture__/current/' && document.readyState==='complete'"), 'no JS fallback');
      const data = await snapshot(); assert.equal(data.count, 0); assert.match(data.latest, /最終更新 \d{4}-\d{2}-\d{2}/); assert.equal(data.overflow, false);
      await screenshot(`home-updates-nojs-${width}.png`); records.push({ width, scenario: 'nojs', ...data });
    }
  } finally { await send('Emulation.setScriptExecutionDisabled', { value: false }); }
  await send('Page.navigate', { url: origin + '/' });
  return records;
}
