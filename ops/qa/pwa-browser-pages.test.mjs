import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isolatePwaPage } from './pwa-browser-pages.mjs';

const origin = 'http://127.0.0.1:1234';
function fixture(extra = []) {
  let targets = [{ type: 'page', targetId: 'current', url: 'about:blank' }, { type: 'service_worker', targetId: 'worker', url: origin + '/tools/prime-factorizer/sw.js' }, ...extra];
  const closed = [];
  return { closed, options: { origin, currentTargetId: 'current', until: async fn => assert.equal(await fn(), true),
    send: async (method, params) => {
      if (method === 'Target.getTargets') return { targetInfos: targets };
      assert.equal(method, 'Target.closeTarget'); closed.push(params.targetId);
      targets = targets.filter(target => target.targetId !== params.targetId); return { success: true };
    },
  } };
}

test('a restored scoped tab is closed; current page and worker are retained', async () => {
  const f = fixture([{ type: 'page', targetId: 'restored', url: origin + '/tools/prime-factorizer/' }]);
  assert.deepEqual(await isolatePwaPage(f.options), { restoredPagesClosed: 1, isolatedPage: true });
  assert.deepEqual(f.closed, ['restored']);
});

test('fresh one-page profile needs no close operation', async () => {
  const f = fixture(); assert.equal((await isolatePwaPage(f.options)).restoredPagesClosed, 0); assert.deepEqual(f.closed, []);
});

test('unexpected page or missing current target fails before closing anything', async () => {
  const foreign = fixture([{ type: 'page', targetId: 'other', url: 'https://example.com/' }]);
  await assert.rejects(isolatePwaPage(foreign.options), /Unexpected page/); assert.deepEqual(foreign.closed, []);
  const missing = fixture(); missing.options.currentTargetId = 'missing';
  await assert.rejects(isolatePwaPage(missing.options), /test page exists/); assert.deepEqual(missing.closed, []);
});

test('refused close and a lingering restored target are failures', async () => {
  for (const success of [false, true]) {
    const f = fixture([{ type: 'page', targetId: 'restored', url: origin + '/' }]);
    const read = f.options.send;
    f.options.send = (method, params) => method === 'Target.closeTarget' ? { success } : read(method, params);
    await assert.rejects(isolatePwaPage(f.options));
  }
});

test('a restored page appearing during cleanup is checked and closed once', async () => {
  const f = fixture(); let reads = 0, late = true;
  const send = f.options.send;
  f.options.send = async (method, params) => {
    if (method === 'Target.closeTarget') { assert.equal(params.targetId, 'late'); late = false; f.closed.push('late'); return { success: true }; }
    const result = await send(method, params);
    if (++reads > 1 && late) result.targetInfos = [...result.targetInfos, { type: 'page', targetId: 'late', url: origin + '/' }];
    return result;
  };
  f.options.until = async fn => { assert.equal(await fn(), false); assert.equal(await fn(), true); };
  assert.equal((await isolatePwaPage(f.options)).restoredPagesClosed, 1);
  assert.deepEqual(f.closed, ['late']);
});

test('a later foreign page fails immediately without a close attempt', async () => {
  const f = fixture(); let reads = 0;
  const send = f.options.send;
  f.options.send = async (...args) => {
    const result = await send(...args);
    if (++reads > 1) result.targetInfos = [...result.targetInfos, { type: 'page', targetId: 'foreign', url: 'https://example.com/' }];
    return result;
  };
  await assert.rejects(isolatePwaPage(f.options), /Unexpected page/);
  assert.deepEqual(f.closed, []);
});
