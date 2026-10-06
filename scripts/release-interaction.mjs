import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, mkdtemp, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Browser behavior against the one final dist, with its actual CSP; no build or UID rewriting.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'apps/site/dist');
const temp = process.env.XPOTATO_RELEASE_TEMP;
if (!temp || !isAbsolute(temp)) throw new Error('XPOTATO_RELEASE_TEMP absolute path required');
await mkdir(temp, { recursive: true });
const profile = await mkdtemp(join(temp, 'chrome-'));
const headers = Object.fromEntries((await readFile(join(dist, '_headers'), 'utf8')).split('\n').filter(l => /^\s+[^:]+:/.test(l)).map(l => { const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
let failSearchIndex = false;
const server = createServer(async (req, res) => {
  try {
    if (failSearchIndex && new URL(req.url, 'http://localhost').pathname === '/search/search-index.json') { res.writeHead(503); res.end('Test-only unavailable index'); return; }
    let path = resolve(dist, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (path !== dist && !path.startsWith(dist + sep)) throw new Error('Path escape');
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    res.writeHead(200, { ...headers, 'Content-Type': mime[extname(path)] ?? 'application/octet-stream' });
    res.end(await readFile(path));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const chrome = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome');
const child = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
let launchError;
child.on('error', e => { launchError = e; });
let socket;
const delay = ms => new Promise(r => setTimeout(r, ms));
async function until(check, label) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) { if (launchError) throw launchError; try { const value = await check(); if (value) return value; } catch {} await delay(100); }
  throw new Error(`Timed out: ${label}`);
}
try {
  const port = await until(async () => (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0], 'Chrome startup');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map(); const exceptions = [];
  socket.addEventListener('message', e => {
    const m = JSON.parse(String(e.data));
    if (m.method === 'Runtime.exceptionThrown') exceptions.push(m.params.exceptionDetails.text);
    if (pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); clearTimeout(p.timer); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  });
  const send = (method, params = {}) => new Promise((resolveCommand, reject) => {
    const key = ++id;
    pending.set(key, { resolve: resolveCommand, reject, timer: setTimeout(() => { pending.delete(key); reject(new Error(`CDP timeout ${method}`)); }, 25000) });
    socket.send(JSON.stringify({ id: key, method, params }));
  });
  const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
  const axeSource = await readFile(join(root, 'node_modules/axe-core/axe.min.js'), 'utf8');
  const axeReports = [];
  const audit = async label => {
    await evaluate(axeSource);
    const result = await evaluate(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] } }).then(r => ({ version: r.testEngine.version, violations: r.violations.map(v => ({ id:v.id, impact:v.impact, targets:v.nodes.map(n=>n.target) })), incomplete:r.incomplete.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})) }))`);
    axeReports.push({ label, ...result });
    assert.deepEqual(result.violations.filter(v => ['serious', 'critical'].includes(v.impact)), [], `axe serious/critical violations: ${label}`);
  };
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 1487, height: 1058, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: origin + '/tools/prime-factorizer/' });
  await until(() => evaluate('document.readyState === "complete" && Boolean(document.querySelector("astro-island"))'), 'Tool page load');
  // client:visible remains intentional: the editorial header can place the tool below the fold.
  await evaluate('document.querySelector("astro-island").firstElementChild.scrollIntoView()');
  await until(() => evaluate('Boolean(document.querySelector("astro-island:not([ssr])") && document.querySelector("output"))'), 'React hydration');
  assert.match(await evaluate('document.querySelector("output").textContent'), /360/);
  await evaluate(`(() => { const input = document.querySelector('#prime-factorizer-input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '97'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await evaluate(`document.querySelector('#prime-factorizer-input').form.requestSubmit()`);
  await until(() => evaluate('document.querySelector("output").textContent.includes("97")'), 'PrimeFactorizer submit');
  for (const draft of ['', '1', '2.5', '-4']) {
    await evaluate(`(() => { const input = document.querySelector('#prime-factorizer-input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(draft)}); input.dispatchEvent(new Event('input', { bubbles:true })); input.form.dispatchEvent(new Event('submit', {bubbles:true,cancelable:true})); })()`);
    assert.match(await evaluate('document.querySelector("output").textContent'), /97/, 'Invalid draft preserves computed output');
    assert.match(await evaluate('document.querySelector(".tool-result-status").textContent'), /まだ反映/, 'Stale output is announced');
  }
  await audit('desktop tool with invalid draft');
  await send('Page.navigate', { url: origin + '/search/' });
  await until(() => evaluate('document.readyState === "complete" && Boolean(document.querySelector("#search-query"))'), 'Search load');
  await evaluate(`document.querySelector('#search-query').value = '素因数'; document.querySelector('#search-form').requestSubmit()`);
  await until(() => evaluate('Array.from(document.querySelectorAll("#search-results a")).some(a => a.pathname === "/tools/prime-factorizer/")'), 'Japanese search result');
  assert.equal(await evaluate('new URL(location.href).searchParams.get("q")'), '素因数', 'Submitted search persists in URL');
  await send('Page.navigate', { url: origin + '/search/?q=' + encodeURIComponent('素因数') });
  await until(() => evaluate('Array.from(document.querySelectorAll("#search-results a")).some(a => a.pathname === "/tools/prime-factorizer/")'), 'Direct URL search');
  assert.equal(await evaluate('document.querySelector("#search-query").value'), '素因数');
  assert.equal(await evaluate('document.querySelector("#header-search-query").value'), '素因数');
  await evaluate(`document.querySelector('#search-form').reset()`);
  await until(() => evaluate('document.querySelector("#search-query").value === "" && !new URL(location.href).searchParams.has("q") && !document.querySelector("#search-results a")'), 'Clear query and URL');
  await evaluate('history.back()');
  await until(() => evaluate('document.querySelector("#search-query").value === "素因数" && Boolean(document.querySelector("#search-results a"))'), 'Back restores query and results');
  await evaluate('history.forward()');
  await until(() => evaluate('document.querySelector("#search-query").value === "" && !document.querySelector("#search-results a")'), 'Forward restores empty search');
  await evaluate(`document.querySelector('#search-query').value = 'zzzz-no-match-987654321'; document.querySelector('#search-form').requestSubmit()`);
  await until(() => evaluate('document.querySelector("#search-status").textContent.includes("一致する結果はありません") && !document.querySelector("#search-results a")'), 'No results state');
  const beforeComposition = await evaluate('location.href');
  await evaluate(`(() => { const input = document.querySelector('#search-query'); input.dispatchEvent(new CompositionEvent('compositionstart')); input.value = '素因数'; input.form.requestSubmit(); })()`);
  assert.equal(await evaluate('location.href'), beforeComposition, 'IME composition does not commit query');
  await evaluate(`document.querySelector('#search-query').dispatchEvent(new CompositionEvent('compositionend'))`);
  await until(() => evaluate('Array.from(document.querySelectorAll("#search-results a")).some(a => a.pathname === "/tools/prime-factorizer/")'), 'IME finished query');
  await audit('desktop search results');
  failSearchIndex = true;
  await send('Page.navigate', { url: origin + '/search/?q=' + encodeURIComponent('素因数') });
  await until(() => evaluate('document.querySelector("#search-status")?.textContent.includes("読み込めませんでした")'), 'Search unavailable state');
  assert.equal(await evaluate('document.querySelectorAll("#search-results a").length'), 0);
  await audit('desktop search unavailable');
  failSearchIndex = false;
  await evaluate('document.querySelector("#search-form").requestSubmit()');
  await until(() => evaluate('Boolean(document.querySelector("#search-results a"))'), 'Search retry after failure');
  await send('Page.navigate', { url: origin + '/' });
  await until(() => evaluate('document.readyState === "complete" && Boolean(document.querySelector("#header-search-query"))'), 'Static header');
  assert.equal(await evaluate('document.querySelectorAll("script[src], astro-island").length'), 0, 'Static header adds no runtime');
  assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".intro-links a")).map(a => a.pathname)'), ['/projects/', '/about/']);
  await audit('desktop home');
  // A deliberate test-only inaccessible button proves the axe harness detects a defect.
  assert.ok(await evaluate(`(() => { const b=document.createElement('button'); b.id='axe-harness-probe'; document.querySelector('main').append(b); return axe.run('#axe-harness-probe',{runOnly:['button-name']}).then(r=>{b.remove();return r.violations.some(v=>v.id==='button-name')}); })()`), 'axe harness self-check');
  await evaluate('document.querySelector(".intro-links .button-glass").focus()');
  const glassCenter = await evaluate('(() => { const r = document.querySelector(".intro-links .button-glass").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()');
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...glassCenter });
  await until(() => evaluate('getComputedStyle(document.querySelector(".intro-links .button-glass")).boxShadow.includes("7px")'), 'Glass hover retains visible focus ring');
  await evaluate(`document.querySelector('#header-search-query').value = '素因数'; document.querySelector('.header-search').requestSubmit()`);
  await until(() => evaluate('location.pathname === "/search/" && Array.from(document.querySelectorAll("#search-results a")).some(a => a.pathname === "/tools/prime-factorizer/")'), 'Header GET submission');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: origin + '/' });
  await until(() => evaluate('document.readyState === "complete" && Boolean(document.querySelector(".mobile-menu-toggle"))'), 'Mobile header');
  await evaluate(`document.querySelector('.mobile-menu-toggle').focus(); document.querySelector('.mobile-menu-toggle').click()`);
  assert.equal(await evaluate('document.querySelector("#site-menu").matches(":popover-open")'), true);
  await audit('mobile home with menu open');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  assert.equal(await evaluate('document.querySelector("#site-menu").matches(":popover-open")'), false, 'Escape closes native menu');
  assert.equal(await evaluate('document.activeElement.className'), 'mobile-menu-toggle', 'Escape restores trigger focus');
  await audit('mobile home with menu closed');
  await send('Page.navigate', { url: origin + '/about/' });
  await until(() => evaluate('document.readyState === "complete" && Boolean(document.querySelector(".prose"))'), 'Copy component test host');
  // Safe synthetic DOM exercises the shipped copy script; no fixture enters dist or publishing.
  await evaluate(`(() => { const block=document.createElement('div'); block.dataset.codeBlock=''; block.innerHTML='<pre tabindex="0"><code>safe synthetic copy\\n</code></pre><button class="code-copy-button" type="button" aria-label="コードをコピー"><span class="code-copy-tooltip">コードをコピー</span></button><span class="code-copy-status" role="status"></span><span class="code-copy-feedback" hidden></span>'; document.querySelector('.prose').append(block); return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/scripts/code-copy.js';s.onload=()=>resolve(true);s.onerror=reject;document.body.append(s)}); })()`);
  await send('Browser.grantPermissions', { origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  await send('Page.bringToFront');
  await evaluate('document.querySelector(".code-copy-button").scrollIntoView(); document.querySelector(".code-copy-button").focus()');
  const copyCenter = await evaluate('(() => { const r=document.querySelector(".code-copy-button").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}; })()');
  await send('Input.dispatchMouseEvent', { type:'mousePressed', ...copyCenter, button:'left', clickCount:1 });
  await send('Input.dispatchMouseEvent', { type:'mouseReleased', ...copyCenter, button:'left', clickCount:1 });
  await until(() => evaluate('document.querySelector(".code-copy-button").dataset.state === "success"'), 'Copy success');
  assert.equal((await evaluate('navigator.clipboard.readText()')).replaceAll('\r\n','\n'), 'safe synthetic copy\n');
  await until(() => evaluate('document.querySelector(".code-copy-button").dataset.state === "idle"'), 'Copy success reset');
  await evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Test-only denial')}}}); document.execCommand=()=>false; document.querySelector('.code-copy-button').click()`);
  await until(() => evaluate('document.querySelector(".code-copy-button").dataset.state === "error" && !document.querySelector(".code-copy-feedback").hidden'), 'Honest copy failure');
  await writeFile(join(temp, 'axe-final-dist.json'), JSON.stringify({ schemaVersion:1, buildCount:0, browser:await evaluate('navigator.userAgent'), policy:'serious/critical block; other violations and incomplete require review; no WCAG conformance claim', reports:axeReports }, null, 2)+'\n');
  assert.deepEqual(exceptions, [], 'Browser uncaught errors');
  console.log('Final artifact browser PASS: tool invalid-input retention, search URL/clear/history/IME/failure/retry, menu, actual clipboard success/failure and axe under exact CSP; build count=0');
} finally {
  socket?.close();
  if (child.pid && child.exitCode === null) {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else child.kill('SIGTERM');
  }
  await new Promise(r => server.close(r));
}
