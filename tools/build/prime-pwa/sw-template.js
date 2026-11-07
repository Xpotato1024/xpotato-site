/* Generated from the exact final build. No runtime/user-data caching. */
const RELEASE = __PRIME_PWA_RELEASE__;
const PREFIX = 'xpotato-prime-offline-v1-';
const CACHE = PREFIX + RELEASE.version;
const PATH = '/tools/prime-factorizer/';
const entries = new Map(RELEASE.entries.map(entry => [new URL(entry.path, self.location.origin).href, entry]));
const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
const valid = async (response, entry) => {
  if (!response?.ok || response.type === 'opaque' || response.redirected || response.headers.get('content-security-policy') !== entry.csp) return false;
  const reader = response.clone().body.getReader(), chunks = []; let size = 0;
  for (;;) { const {done,value} = await reader.read(); if (done) break; size += value.byteLength;
    if (size > entry.bytes) { await Promise.all([reader.cancel(), response.body.cancel()]); return false; } chunks.push(value); }
  const body = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { body.set(chunk,offset); offset += chunk.byteLength; }
  return body.byteLength === entry.bytes && await digest(body) === entry.sha256;
};
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // A rollback may reinstall A while A is active and B is waiting. Never
    // remove or overwrite a complete cache already owned by that active A.
    const existed = (await caches.keys()).includes(CACHE);
    const cache = await caches.open(CACHE);
    try {
      if (existed) {
        const keys = await cache.keys();
        if (keys.length === entries.size && keys.every(key => entries.has(key.url))
          && (await Promise.all(RELEASE.entries.map(async entry => valid(await cache.match(new URL(entry.path, self.location.origin).href), entry)))).every(Boolean)) return;
      }
      for (const entry of RELEASE.entries) {
        const request = new Request(new URL(entry.path, self.location.origin), { cache: 'no-store', credentials: 'omit', redirect: 'error' });
        const response = await fetch(request);
        if (!await valid(response, entry)) throw Error('Offline release changed');
        await cache.put(request, response);
      }
    } catch (error) { if (!existed) await caches.delete(CACHE); throw error; }
    // No skipWaiting: a new release cannot replace a running calculator.
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Natural activation waits for all old controlled documents to close.
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (windows.some(client => new URL(client.url).pathname.startsWith(PATH))) return;
    for (const name of await caches.keys()) if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    // No clients.claim: an already loaded document keeps its original asset graph.
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const isPage = request.mode === 'navigate' && url.pathname === PATH;
  const key = isPage ? new URL(PATH, self.location.origin).href : request.url;
  if (!entries.has(key) || (!isPage && (url.search || url.hash))) return;
  event.respondWith((async () => {
    const cached = (await caches.keys()).includes(CACHE) ? await (await caches.open(CACHE)).match(key) : undefined;
    // Fail closed on eviction instead of mixing old HTML with new mutable assets.
    if (cached) return cached;
    await self.registration.unregister();
    return new Response('保存が消去されたためオフライン機能を解除しました。このツールのタブとアプリをすべて閉じ、オンラインで開いて保存し直してください。', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  })());
});

self.addEventListener('message', event => {
  if (event.data !== 'PRIME_OFFLINE_STATUS' || !event.ports[0]) return;
  event.waitUntil((async () => {
    try {
      if (!(await caches.keys()).includes(CACHE)) { event.ports[0].postMessage({ complete: false }); return; }
      const cache = await caches.open(CACHE), keys = await cache.keys();
      const complete = keys.length === entries.size && keys.every(key => entries.has(key.url))
        && (await Promise.all(keys.map(key => cache.match(key)))).every(Boolean);
      event.ports[0].postMessage({ complete, version: RELEASE.version });
    } catch { event.ports[0].postMessage({ complete: false }); }
  })());
});
