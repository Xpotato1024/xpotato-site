import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'parse5';
import { updateActivityFixture } from './update-activity-fixture.mjs';
import { inspectHomeStyleContract } from './home-style-contract.mjs';
import { releaseAxeAuditExpression } from './release-accessibility-audit.mjs';
import { parseStaticHeaderRules, headersForPath } from '../../packages/site-validators/src/delivery/static-headers.mjs';
import { publicMediaOrigin } from '../../packages/content-contracts/src/profiles/public-media-origin.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const scenarios = ['current', 'four-days', 'sliding', 'stalled'];
const brand = [116, 83, 153];
const alpha = [.08, .35, .6, .85];
const tokens = ['--brand-rgb', '--color-accent', '--color-label-static', '--color-focus',
  ...[0, 1, 2, 3].map(n => '--color-activity-' + n), '--color-activity-marker', '--color-activity-prelaunch'];
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.avif': 'image/avif', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function parseOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help') return { help: true };
    assert.ok(['--dist', '--out', '--output'].includes(args[i]), 'Unknown argument: ' + args[i]);
    const key = args[i] === '--dist' ? 'dist' : 'out';
    assert.ok(!options[key] && args[i + 1] && !args[i + 1].startsWith('--'), 'Missing or duplicate ' + args[i]);
    options[key] = args[++i];
  }
  assert.ok(options.dist && options.out && isAbsolute(options.dist) && isAbsolute(options.out), '--dist and --out must be absolute paths');
  options.dist = resolve(options.dist); options.out = resolve(options.out);
  assert.ok(options.out !== options.dist && !options.out.startsWith(options.dist + sep), 'Evidence output must be outside the read-only dist');
  return options;
}

export function rgba(value) {
  assert.match(value, /^rgba?\(/, 'Expected a resolved RGB color, received ' + value);
  const numbers = value.match(/[\d.]+/g).map(Number);
  assert.ok(numbers.length === 3 || numbers.length === 4, 'Invalid RGB color: ' + value);
  return [...numbers.slice(0, 3), numbers[3] ?? 1];
}
const composite = (color, background) => color.slice(0, 3).map((v, i) => v * color[3] + background[i] * (1 - color[3]));
const luminance = color => color.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
export function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
const sameColor = (value, opacity, label) => assert.deepEqual(rgba(value), [...brand, opacity], label);

function fixtureClock(html) {
  const walk = node => [node, ...(node.childNodes ?? []).flatMap(walk)];
  const node = walk(parse(html)).find(n => n.attrs?.some(a => a.name === 'data-update-events'));
  const events = JSON.parse(node?.attrs.find(a => a.name === 'data-update-events')?.value ?? 'null');
  assert.ok(Array.isArray(events), 'Prepared current preview needs update events');
  const event = events.find(e => e.kind === 'tools' && e.occurredAt);
  const clock = Date.parse(event?.occurredAt) + 2 * 86400000;
  assert.ok(Number.isFinite(clock), 'Prepared current preview needs its explicit two-day fixture timestamp');
  return clock;
}

// Read the supplied bytes. Do not rebuild, repair CSS, or write synthetic pages into dist.
export async function prepareServer(dist, requestedNow = Date.now()) {
  const realDist = await realpath(dist);
  const home = await readFile(join(realDist, 'index.html'), 'utf8');
  let rules = [];
  try { rules = parseStaticHeaderRules(await readFile(join(realDist, '_headers'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const previews = new Map();
  let clock = requestedNow;
  try { clock = fixtureClock(await readFile(join(realDist, 'preview/updates/current/index.html'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const scenario of scenarios) {
    const route = '/preview/updates/' + scenario + '/';
    let html, source;
    try { html = await readFile(join(realDist, route.slice(1), 'index.html'), 'utf8'); source = 'existing-preview'; }
    catch (error) { if (error.code !== 'ENOENT') throw error; html = updateActivityFixture(home, scenario, clock); source = 'generated-for-ci'; }
    previews.set(route, { html, source, sha256: sha256(html), scenario });
  }
  const server = createServer(async (req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
      const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
      const preview = previews.get(pathname);
      let body, extension;
      if (preview) { body = preview.html; extension = '.html'; }
      else {
        let file = resolve(realDist, '.' + decodeURIComponent(pathname));
        assert.ok(file === realDist || file.startsWith(realDist + sep), 'Path escapes dist');
        if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
        file = await realpath(file);
        assert.ok(file.startsWith(realDist + sep), 'Symlink escapes dist');
        body = await readFile(file); extension = extname(file);
      }
      res.writeHead(200, { ...headersForPath(preview ? '/' : pathname, rules), 'content-type': mime[extension] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  return { server, origin: 'http://127.0.0.1:' + server.address().port, clock, homeSha256: sha256(home), previews };
}

async function snapshot(page) {
  return page.evaluate(tokenNames => {
    const rect = node => { if (!node) return null; const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const font = node => { const s = getComputedStyle(node); return { family: s.fontFamily, size: s.fontSize, weight: s.fontWeight, lineHeight: s.lineHeight, spacing: s.letterSpacing }; };
    const root = document.querySelector('[data-update-activity]'), style = getComputedStyle(root);
    const cells = [...root.querySelectorAll('.home-update-week')];
    const titles = ['.home-update-title', '.article-card-copy h3', '.project-slide h3', '.home-tool-row h3'].map(selector => ({ selector, nodes: [...document.querySelectorAll(selector)].map(n => ({ text: n.textContent, sharedRole: n.classList.contains('content-item-title'), ...font(n) })) }));
    const slots = [...document.querySelectorAll('[data-home-new]')].filter(n => !n.hidden);
    const uniqueSlots = [...new Map(slots.map(n => [n.dataset.homeNew, n])).values()];
    const shown = n => !n.hidden && n.getClientRects().length > 0;
    const title = root.querySelector('.home-update-title'), meta = root.querySelector('.home-update-meta');
    const toolHeading = document.querySelector('#tools-heading');
    const range = document.createRange(); range.selectNodeContents(toolHeading);
    const lineTops = new Set([...range.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top * 10) / 10));
    const marker = root.querySelector('.home-update-pointer'), triangle = marker.querySelector('.home-update-triangle, svg');
    const label = document.querySelector('.project-slide .content-type-label');
    return {
      path: location.pathname, width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth + 1,
      timestamp: Date.now(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      tokens: Object.fromEntries(tokenNames.map(name => [name, style.getPropertyValue(name).trim()])),
      stylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map(n => n.href),
      titles, bodyFont: font(document.querySelector('.home-catch')),
      sectionOrder: [...document.querySelectorAll('main > section')].map(n => n.getAttribute('aria-labelledby')),
      meta: rect(meta), title: rect(title), metaSizes: [...meta.children].map(n => getComputedStyle(n).fontSize),
      latest: root.querySelector('[data-update-latest]')?.textContent, latestDate: root.querySelector('[data-update-latest]')?.getAttribute('datetime'),
      newBanner: root.querySelectorAll('[data-update-new]').length,
      newSlots: uniqueSlots.map(n => ({ id: n.dataset.homeNew, kind: n.closest('.article-card') ? 'article' : n.closest('.project-slide') ? 'project' : 'tool', text: n.textContent })),
      newColors: [...document.querySelectorAll('.home-new')].filter(shown).map(n => getComputedStyle(n).color),
      count: cells.length, current: cells.filter(n => n.hasAttribute('data-current')).length,
      before: cells.filter(n => n.hasAttribute('data-before-launch')).length,
      cells: cells.map(n => ({ week: n.dataset.week, total: Number(n.dataset.total), level: Number(n.dataset.level), before: n.hasAttribute('data-before-launch'), rect: rect(n), bar: rect(n.firstElementChild), fill: getComputedStyle(n.firstElementChild).backgroundColor, label: n.firstElementChild.getAttribute('aria-label'), tooltip: n.firstElementChild.title, text: n.firstElementChild.textContent })),
      plot: rect(root.querySelector('.home-update-plot')), summary: root.querySelector('.home-update-summary')?.textContent,
      fallback: root.querySelector('.home-update-fallback')?.textContent,
      fixture: root.querySelector('[data-update-fixture]')?.textContent ?? null,
      interactive: root.querySelectorAll('.home-update-strip a,.home-update-strip button,.home-update-strip [tabindex]').length,
      pointer: { rect: rect(marker), color: getComputedStyle(marker).color, label: marker.getAttribute('aria-label'), shape: triangle.tagName.toLowerCase(), shapeColor: getComputedStyle(triangle)[triangle.tagName.toLowerCase() === 'svg' ? 'fill' : 'borderBottomColor'] },
      prelaunch: [...root.querySelectorAll('.home-update-prelaunch')].map(n => ({ color: getComputedStyle(n).borderTopColor, style: getComputedStyle(n).borderTopStyle, rect: rect(n) })),
      staticLabels: [...document.querySelectorAll('.project-slide .content-type-label, .home-update-axis')].map(n => ({ color: getComputedStyle(n).color, text: n.textContent })),
      projectLabelFont: label ? font(label) : null,
      metadataFonts: [...root.querySelectorAll('.home-meta,.home-number,.home-update-summary')].map(font),
      surface: getComputedStyle(document.documentElement).backgroundColor,
      accent: getComputedStyle(root.querySelector('.home-update-arrow')).color,
      toolHeading: { ...rect(toolHeading), lines: lineTops.size, ...font(toolHeading) },
      toolListing: rect(toolHeading.closest('section').querySelector('.section-heading a')),
      articleHeading: rect(document.querySelector('#records-heading')),
      images: [...document.querySelectorAll('img')].filter(n => n.loading !== 'lazy').map(n => ({ source: n.currentSrc, complete: n.complete, width: n.naturalWidth })),
    };
  }, tokens);
}

function verifyCommon(data, scale) {
  assert.equal(data.overflow, false, 'No horizontal overflow: ' + data.path);
  for (const [name, value] of Object.entries(data.tokens)) assert.ok(value && !value.includes('var('), 'Loaded styles must resolve ' + name);
  assert.deepEqual(data.sectionOrder, ['home-title', 'updates-heading', 'records-heading', 'projects-heading', 'tools-heading']);
  const titleFonts = data.titles.flatMap(group => { assert.ok(group.nodes.length, 'Missing title role ' + group.selector); return group.nodes; });
  for (const title of titleFonts) {
    assert.equal(title.sharedRole, true, 'All content titles consume the shared role');
    assert.equal(title.size, 18 * scale + 'px'); assert.equal(title.weight, '400'); assert.equal(title.lineHeight, 27 * scale + 'px');
    assert.equal(title.family, data.bodyFont.family); assert.equal(title.spacing, 'normal');
  }
  assert.ok(data.title.y >= data.meta.bottom - 1, 'Metadata and title remain separate rows');
  assert.equal(new Set(data.metaSizes).size, 1);
  assert.ok(data.metadataFonts.every(f => f.family === data.bodyFont.family), 'Numerals and Japanese metadata share the body family');
  assert.ok(data.images.every(n => n.complete && n.width > 0), 'Eager images are loaded');
  sameColor(data.accent, 1, 'Accent is not black or a missing variable');
  sameColor(data.pointer.color, .8, 'Current-week pointer has the data color');
  sameColor(data.pointer.shapeColor, .8, 'The painted triangle uses the pointer color');
  assert.equal(data.pointer.label, '今週'); assert.ok(data.pointer.rect.width >= 8 && data.pointer.rect.height >= 8);
  const surface = rgba(data.surface); assert.deepEqual(surface, [250, 249, 247, 1]);
  const ratios = { method: 'Resolved CSS alpha composited over opaque #faf9f7. Excludes carousel edge fades and header transition frames.', new: [], static: [] };
  for (const color of data.newColors) { sameColor(color, 1, 'NEW accent'); const ratio = contrast(composite(rgba(color), surface), surface); assert.ok(ratio >= 4.5); ratios.new.push(ratio); }
  assert.ok(data.staticLabels.length, 'PROJECT static labels exist');
  for (const label of data.staticLabels) { sameColor(label.color, .9, 'Static label color'); const ratio = contrast(composite(rgba(label.color), surface), surface); assert.ok(ratio >= 4.5); ratios.static.push(ratio); }
  if (scale === 1) {
    assert.equal(data.toolHeading.lines, 1); assert.ok(data.toolListing.y < data.toolHeading.bottom && data.toolListing.x > data.toolHeading.x);
  } else if (data.width < 761) {
    assert.ok(data.toolHeading.lines <= 2); assert.ok(data.toolListing.y >= data.toolHeading.bottom - 1);
    assert.ok(data.toolHeading.width >= data.width - 82, 'Enlarged heading uses the available width');
  }
  return ratios;
}

function verifyStrip(data) {
  assert.equal(data.count, 13); assert.equal(data.current, 1); assert.equal(data.interactive, 0);
  for (const [index, cell] of data.cells.entries()) {
    assert.equal(new Date(cell.week + 'T00:00:00Z').getUTCDay(), 1, 'JST week IDs start on Monday');
    if (index) assert.equal(Date.parse(cell.week) - Date.parse(data.cells[index - 1].week), 7 * 86400000);
    assert.equal(cell.label, cell.tooltip); assert.equal(cell.text, '');
    assert.match(cell.label, /^\d{4}-\d{2}-\d{2}の週：(\d+件|サイト公開前（集計対象外）)/);
    assert.ok(Math.abs(cell.rect.width - data.plot.width / 13) < .2);
    assert.ok(cell.bar.height >= 12 && cell.bar.height <= 16);
    if (cell.before) assert.equal(rgba(cell.fill)[3], 0);
    else sameColor(cell.fill, alpha[cell.level], 'Every painted bar resolves its exact data color');
  }
  assert.equal(data.prelaunch.length, data.before ? 1 : 0);
  if (data.before) { assert.equal(data.prelaunch[0].style, 'dotted'); sameColor(data.prelaunch[0].color, .3, 'Prelaunch line color'); }
  assert.ok(Math.abs(data.pointer.rect.x + data.pointer.rect.width / 2 - (data.plot.right - data.plot.width / 26)) < 1);
}

async function run(options) {
  await mkdir(options.out, { recursive: true });
  const output = await realpath(options.out), input = await realpath(options.dist);
  assert.ok(output !== input && !output.startsWith(input + sep), 'Evidence output cannot resolve into dist');
  const report = { schemaVersion: 1, status: 'running', engine: 'Playwright WebKit', limitation: 'Headless WebKit engine smoke, not an actual iPhone or Safari-device acceptance test.',
    sourceRevision: process.env.RELEASE_SOURCE_SHA ?? null, workflowRevision: process.env.GITHUB_SHA ?? null, startedAt: new Date().toISOString(), records: [], screenshots: [], errors: [] };
  let serverState, browser;
  const resultFile = join(output, 'home-design-webkit.json');
  try {
    report.linkedStyleContract = await inspectHomeStyleContract(input, await readFile(join(input, 'index.html'), 'utf8'));
    serverState = await prepareServer(input);
    report.homeSha256 = serverState.homeSha256;
    report.fixtureClock = new Date(serverState.clock).toISOString();
    report.fixtures = [...serverState.previews.entries()].map(([path, { source, sha256 }]) => ({ path, source, sha256 }));
    const { webkit } = await import('playwright');
    browser = await webkit.launch({ headless: true }); report.browserVersion = browser.version();
    const axe = await readFile(join(root, 'node_modules/axe-core/axe.min.js'), 'utf8');
    const capture = async (page, name) => { const file = 'home-webkit-' + name + '.png'; await page.screenshot({ path: join(output, file), fullPage: true }); report.screenshots.push(file); };
    async function visit({ width, scenario = 'real', scale = 1, nojs = false, timezoneId = 'Asia/Tokyo' }) {
      const synthetic = scenarios.includes(scenario), path = synthetic ? '/preview/updates/' + scenario + '/' : '/';
      const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : width === 390 ? 844 : 1058 },
        deviceScaleFactor: 1, isMobile: width < 761, hasTouch: width < 761, javaScriptEnabled: !nojs, timezoneId, reducedMotion: 'reduce' });
      const errors = [], rejectedRequests = [], failedResources = [];
      let observed;
      await context.route('**/*', async route => {
        const request = route.request(), url = request.url();
        if (url.startsWith(serverState.origin + '/') || (request.resourceType() === 'image' && url.startsWith(publicMediaOrigin + '/media/v1/objects/sha256/'))) await route.continue();
        else { rejectedRequests.push({ url, type: request.resourceType() }); await route.abort(); }
      });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) failedResources.push({ url: response.url(), status: response.status() }); });
      const identity = (synthetic ? 'fixture-' : '') + scenario + (nojs ? '-nojs' : '') + '-' + width + (scale === 2 ? '-text200' : '') + (timezoneId === 'Asia/Tokyo' ? '' : '-los-angeles');
      console.log('WebKit start: ' + identity);
      // A page evaluation must not leave the whole CI job waiting indefinitely.
      let expired = false;
      const deadline = setTimeout(() => { expired = true; void context.close().catch(() => {}); }, 60000);
      try {
        if (synthetic) await context.addInitScript(now => {
          if (!location.pathname.startsWith('/preview/updates/')) return;
          const OriginalDate = Date;
          window.Date = class extends OriginalDate { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } };
        }, serverState.clock);
        const response = await page.goto(serverState.origin + path, { waitUntil: 'load' }); assert.equal(response.status(), 200);
        if (!nojs) await page.waitForSelector('[data-update-ready="true"]');
        await page.evaluate(async factor => { if (factor === 2) document.documentElement.style.fontSize = '200%'; await document.fonts.ready; window.scrollTo(0, 0); }, scale);
        await page.waitForFunction(() => !document.querySelector('.header-band').getAnimations({ subtree: true }).some(a => a.playState === 'running'));
        const data = await snapshot(page); observed = data;
        const ratios = verifyCommon(data, scale);
        if (nojs) {
          assert.equal(data.count, 0); assert.equal(data.newBanner, 0); assert.deepEqual(data.newSlots, []);
          assert.match(data.latest, /^\d{4}-\d{2}-\d{2}$/); assert.match(data.fallback, /未集計/); assert.match(data.fallback, /0件を表しません/);
        } else verifyStrip(data);
        if (synthetic) {
          assert.match(data.fixture, /実際の更新記録ではありません/);
          const fresh = scenario === 'current' || scenario === 'sliding';
          assert.equal(data.newBanner, fresh ? 1 : 0); assert.equal(data.newSlots.length, fresh ? 3 : 0);
          if (fresh) { assert.deepEqual(data.newSlots.map(n => n.kind).sort(), ['article', 'project', 'tool']); assert.ok(data.newSlots.every(n => n.text.includes('新着'))); }
          assert.equal(data.before, scenario === 'current' || scenario === 'four-days' ? 7 : 0);
          assert.equal(data.latest, scenario === 'four-days' ? '4日前' : scenario === 'stalled' ? '65日前' : '2日前');
          if (scenario === 'stalled') assert.ok(data.cells.slice(-8).every(c => c.total === 0));
          else assert.equal(data.summary, '直近13週で9件');
          if (scenario === 'current') {
            assert.deepEqual([...new Set(data.cells.filter(c => !c.before).map(c => c.level))].sort(), [0, 1, 2, 3]);
            ratios.levels = alpha.map(a => contrast(composite([...brand, a], rgba(data.surface)), rgba(data.surface)));
            assert.ok(ratios.levels[1] >= 1.6 && ratios.levels.every((n, i) => !i || n > ratios.levels[i - 1]));
          }
        } else assert.equal(data.fixture, null, 'Real home must not contain synthetic fixture data');
        const stylesheets = [];
        for (const url of data.stylesheets) {
          assert.equal(new URL(url).origin, serverState.origin, 'Executable CSS is local');
          const response = await context.request.get(url); assert.equal(response.status(), 200);
          const bytes = await response.body(); stylesheets.push({ path: new URL(url).pathname, sha256: sha256(bytes), bytes: bytes.length });
        }
        // Normal JS and no-JS CSS must both preserve the native keyboard focus treatment.
        await page.locator('.home-tool-row').first().focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
        // This runner-side delay also works when page JavaScript is disabled.
        // Keep the exact color assertion; do not rely on a page animation callback.
        await page.waitForTimeout(100);
        const focus = await page.locator('.home-tool-row').first().evaluate(n => { const s=getComputedStyle(n); return { active: document.activeElement === n, visible: n.matches(':focus-visible'), color: s.outlineColor, width: parseFloat(s.outlineWidth), style:s.outlineStyle, offset:s.outlineOffset,
          tokens:Object.fromEntries(['--focus','--color-focus','--color-accent','--brand-rgb'].map(key=>[key,s.getPropertyValue(key).trim()])) }; });
        observed.focus = focus;
        assert.equal(focus.active, true); assert.equal(focus.visible, true); assert.ok(focus.width >= 2); sameColor(focus.color, 1, 'Focus uses the interaction accent');
        await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
        let accessibility;
        if (!nojs) {
          await page.evaluate(axe);
          accessibility = await page.evaluate(releaseAxeAuditExpression);
          assert.deepEqual(accessibility.violations, [], 'WebKit accessibility violations');
        } else accessibility = { status: 'not-run', reason: 'Page JavaScript disabled; DOM/focus/fallback checks run independently.' };
        assert.deepEqual(errors, [], 'No page runtime errors'); assert.deepEqual(rejectedRequests, [], 'No unexpected external requests'); assert.deepEqual(failedResources, [], 'All requested resources return successfully');
        const record = { scenario, source: synthetic ? serverState.previews.get(path).source : 'real-home', clockMode: synthetic ? 'fixed-fixture-only' : 'browser-wall-clock', nojs, scale, ...data, ratios, stylesheets, focus, accessibility, errors, rejectedRequests, failedResources };
        report.records.push(record); await capture(page, identity);
        if (scale === 2) {
          await page.locator('#tools-heading').evaluate(n => { const h = n.getBoundingClientRect(), header = document.querySelector('.header-band').getBoundingClientRect(); scrollBy(0, h.y - header.bottom - 16); });
          const file = 'home-webkit-' + identity + '-tool-heading.png'; await page.screenshot({ path: join(output, file) }); report.screenshots.push(file);
        }
        await writeFile(resultFile, JSON.stringify(report, null, 2) + '\n');
        console.log('WebKit passed: ' + identity);
        return record;
      } catch (error) {
        report.errors.push({ identity, expired, message: error.stack ?? String(error), observed, errors, rejectedRequests, failedResources });
        try { await capture(page, identity + '-failure'); } catch { /* Preserve the original failure. */ }
        throw error;
      } finally { clearTimeout(deadline); await context.close(); }
    }
    for (const width of [320, 390, 1487]) {
      await visit({ width });
      for (const scenario of scenarios) await visit({ width, scenario });
      await visit({ width, nojs: true });
    }
    for (const width of [320, 390]) await visit({ width, scenario: 'current', scale: 2 });
    const foreign = await visit({ width: 390, scenario: 'current', timezoneId: 'America/Los_Angeles' });
    const jst = report.records.find(r => r.width === 390 && r.scenario === 'current' && r.scale === 1 && r.timezone === 'Asia/Tokyo');
    assert.deepEqual(foreign.cells.map(c => c.label), jst.cells.map(c => c.label), 'JST model is independent of browser timezone');
    assert.equal(foreign.latest, jst.latest);
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.failure = error.stack ?? String(error); throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    await writeFile(resultFile, JSON.stringify(report, null, 2) + '\n');
    await browser?.close();
    if (serverState) { serverState.server.closeAllConnections(); await new Promise(done => serverState.server.close(done)); }
  }
  console.log(JSON.stringify({ status: report.status, engine: report.engine, records: report.records.length, output: relative(process.cwd(), resultFile) }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) console.log('node tools/qa/home-design-webkit.mjs --dist <absolute prepared dist> --out <absolute evidence directory>\nReads the supplied HTML/CSS bytes; runs headless WebKit only when invoked without --help.');
  else await run(options);
}
