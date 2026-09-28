import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, stat } from 'node:fs/promises';
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
const server = createServer(async (req, res) => {
  try {
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
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: origin + '/tools/prime-factorizer/' });
  await until(() => evaluate('Boolean(document.querySelector("astro-island:not([ssr])") && document.querySelector("output"))'), 'React hydration');
  assert.match(await evaluate('document.querySelector("output").textContent'), /360/);
  await evaluate(`(() => { const input = document.querySelector('#prime-factorizer-input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '97'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await evaluate(`document.querySelector('#prime-factorizer-input').form.requestSubmit()`);
  await until(() => evaluate('document.querySelector("output").textContent.includes("97")'), 'PrimeFactorizer submit');
  await send('Page.navigate', { url: origin + '/search/' });
  await until(() => evaluate('document.readyState === "complete" && Boolean(document.querySelector("#search-query"))'), 'Search load');
  await evaluate(`document.querySelector('#search-query').value = '素因数'; document.querySelector('#search-form').requestSubmit()`);
  await until(() => evaluate('Array.from(document.querySelectorAll("#search-results a")).some(a => a.pathname === "/tools/prime-factorizer/")'), 'Japanese search result');
  assert.deepEqual(exceptions, [], 'Browser uncaught errors');
  console.log('Final artifact browser PASS: React hydration + changed input/submit + Japanese search under exact CSP; build count=0');
} finally {
  socket?.close();
  if (child.pid && child.exitCode === null) {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else child.kill('SIGTERM');
  }
  await new Promise(r => server.close(r));
}
