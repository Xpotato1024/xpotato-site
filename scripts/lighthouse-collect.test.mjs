import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectLighthouse } from './lighthouse-collect.mjs';

test('one browser collects three local routes and leaves reports without its profile', async () => {
  const work = await mkdtemp(join(tmpdir(), 'lighthouse-fixture-'));
  const urls = []; let launches = 0, kills = 0;
  try {
    const rows = await collectLighthouse({ origin: 'http://127.0.0.1:1234', work, chromePath: 'fixture-chrome',
      launch: async options => { launches++; assert.equal(options.chromePath, 'fixture-chrome'); assert.ok(options.userDataDir.startsWith(work)); return { port: 5678, kill: async () => { kills++; } }; },
      lighthouse: async (url, options) => { urls.push(url); assert.equal(options.port, 5678); assert.equal(options.enableErrorReporting, false); return { lhr: { finalDisplayedUrl: url, lighthouseVersion: '13.5.0', categories: { performance: { score: 0 } }, audits: { 'largest-contentful-paint': { numericValue: 1 }, 'cumulative-layout-shift': { numericValue: 0 } }, runWarnings: [] } }; } });
    assert.deepEqual(urls, ['http://127.0.0.1:1234/', 'http://127.0.0.1:1234/notes/wordpress-migration-playbook/', 'http://127.0.0.1:1234/tools/prime-factorizer/']);
    assert.equal(rows.length, 3); assert.equal(rows[0].scores.performance, 0); assert.equal(launches, 1); assert.equal(kills, 1);
    assert.deepEqual((await readdir(work)).sort(), ['lhr-0.json', 'lhr-1.json', 'lhr-2.json']);
  } finally { await rm(work, { recursive: true, force: true }); }
});
for (const mode of ['launch', 'audit', 'kill']) test(`browser/profile cleanup when ${mode} fails`, async () => {
  const work = await mkdtemp(join(tmpdir(), 'lighthouse-fixture-')); let kills = 0;
  try {
    await assert.rejects(collectLighthouse({ origin: 'http://127.0.0.1:1234', work,
      launch: async () => { if (mode === 'launch') throw Error('launch failed'); return { port: 1, kill: async () => { kills++; if (mode === 'kill') throw Error('kill failed'); } }; },
      lighthouse: async () => { throw Error('audit failed'); } }));
    assert.equal(kills, mode === 'launch' ? 0 : 1); assert.deepEqual(await readdir(work), []);
  } finally { await rm(work, { recursive: true, force: true }); }
});
test('nonlocal origins are refused before launching a browser', async () => {
  for (const origin of ['https://example.com', 'http://user:pass@127.0.0.1']) await assert.rejects(collectLighthouse({ origin, work: '/unused' }), /Local Lighthouse/);
});
