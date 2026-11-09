import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { observeChromeProcess, waitForChromePage, connectChromePage } from './chrome-page-ready.mjs';

const page = { type: 'page', id: 'fixture', webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/fixture' };
function fixture(overrides = {}) {
  let clock = 0;
  const child = Object.assign(new EventEmitter(), { pid: 123, exitCode: null, signalCode: null, stderr: new EventEmitter() });
  return { child, options: {
    processState: observeChromeProcess(child), timeoutMs: 500, pollMs: 100,
    readActivePort: async () => '9222\n/devtools/browser/fixture\n',
    fetchTargets: async () => [page], now: () => clock, pause: async ms => { clock += ms; }, ...overrides,
  } };
}

test('waits for the page after the port is ready, not for a fixed startup delay', async () => {
  let calls = 0;
  const { options } = fixture({ fetchTargets: async () => [[], [{ type: 'service_worker' }], [{ type: 'page' }], [page]][calls++] });
  assert.deepEqual(await waitForChromePage(options), { port: 9222, target: page });
  assert.equal(calls, 4);
});

test('immediately ready page needs no sleep or retry', async () => {
  const { options } = fixture({ pause: async () => assert.fail('Unnecessary wait') });
  assert.equal((await waitForChromePage(options)).target, page);
});

test('retries missing/partial port and transient HTTP/list failures within the same deadline', async () => {
  let reads = 0, requests = 0;
  const { options } = fixture({
    timeoutMs: 800,
    readActivePort: async () => { if (++reads === 1) throw Error('ENOENT'); return reads === 2 ? '\n' : '9222\n'; },
    fetchTargets: async () => { if (++requests === 1) throw Error('ECONNREFUSED'); return requests === 2 ? {} : [page]; },
  });
  assert.equal((await waitForChromePage(options)).target, page);
  assert.equal(reads, 5);
  assert.equal(requests, 3);
});

test('never masks persistent empty targets; diagnostics retain stage and target types', async () => {
  const { options } = fixture({ fetchTargets: async () => [{ type: 'service_worker', id: 'worker' }] });
  await assert.rejects(waitForChromePage(options), error => {
    assert.equal(error.diagnostics.reason, 'deadline exceeded');
    assert.equal(error.diagnostics.stage, 'page target');
    assert.equal(error.diagnostics.attempts, 5);
    assert.equal(error.diagnostics.elapsedMs, 500);
    assert.deepEqual(error.diagnostics.targets, [{ type: 'service_worker', id: 'worker', hasDebuggerUrl: false }]);
    assert.match(error.message, /No page target/);
    return true;
  });
});

test('persistent port or target-list failures remain failures with the last cause', async () => {
  for (const stage of ['port file', 'page target']) {
    const { options } = fixture(stage === 'port file'
      ? { readActivePort: async () => '65536\n' }
      : { fetchTargets: async () => { throw Error('Target list HTTP 503'); } });
    await assert.rejects(waitForChromePage(options), error => {
      assert.equal(error.diagnostics.stage, stage);
      assert.equal(error.diagnostics.reason, 'deadline exceeded');
      assert.match(error.diagnostics.lastError, stage === 'port file' ? /valid port/ : /HTTP 503/);
      return true;
    });
  }
});

test('port-file reads receive the remaining deadline signal', async () => {
  const { options } = fixture({ readActivePort: async signal => {
    assert.ok(signal instanceof AbortSignal);
    assert.equal(signal.aborted, false);
    return '9222\n';
  } });
  assert.equal((await waitForChromePage(options)).target, page);
});

test('spawn failure and early process exit fail promptly with bounded stderr', async () => {
  for (const mode of ['spawn', 'exit', 'signal']) {
    const { child, options } = fixture({ pause: async () => assert.fail('Unavailable browser must fail immediately') });
    child.stderr.emit('data', 'x'.repeat(5000) + ' fixture failure');
    if (mode === 'spawn') child.emit('error', Error('ENOENT fixture'));
    if (mode === 'exit') child.exitCode = 7;
    if (mode === 'signal') child.signalCode = 'SIGTERM';
    await assert.rejects(waitForChromePage(options), error => {
      assert.equal(error.diagnostics.reason, 'browser unavailable');
      assert.equal(error.diagnostics.attempts, 0);
      assert.equal(error.diagnostics.process.stderr.length, 4096);
      assert.match(error.message, /fixture failure/);
      return true;
    });
  }
});

test('a page arriving after process exit or after deadline is not a pass', async () => {
  const { child, options } = fixture();
  options.fetchTargets = async () => { child.exitCode = 0; return [page]; };
  await assert.rejects(waitForChromePage(options), /browser unavailable/);
  const late = fixture();
  late.options.fetchTargets = async () => { await late.options.pause(600); return [page]; };
  await assert.rejects(waitForChromePage(late.options), /deadline exceeded/);
});

test('a stalled real HTTP request is aborted by the startup deadline', async () => {
  const server = createServer(() => {});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { options } = fixture();
  const started = performance.now();
  try {
    await assert.rejects(waitForChromePage({
      ...options, timeoutMs: 100, now: () => performance.now(),
      readActivePort: async () => String(server.address().port),
      fetchTargets: undefined,
    }), error => {
      assert.equal(error.diagnostics.reason, 'deadline exceeded');
      assert.match(error.diagnostics.lastError, /timeout|abort/i);
      return true;
    });
    assert.ok(performance.now() - started < 3000, 'The stalled request must not hang the suite');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

function handshake() {
  const base = fixture(); let socket, timer, delay;
  class FakeSocket extends EventTarget {
    readyState = 0; closed = false;
    constructor() { super(); socket = this; }
    close() { this.closed = true; this.readyState = 3; }
  }
  return { ...base, options: { ...base.options, WebSocketClass: FakeSocket,
    schedule: (callback, ms) => { timer = callback; delay = ms; return callback; },
    unschedule: () => { timer = null; },
  }, get socket() { return socket; }, get timer() { return timer; }, get delay() { return delay; } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('CDP handshake shares the original deadline after target preparation', async () => {
  const f = handshake();
  f.options.fetchTargets = async () => { await f.options.pause(300); return [page]; };
  const result = connectChromePage(f.options); await tick();
  assert.equal(f.delay, 200);
  f.socket.readyState = 1; f.socket.dispatchEvent(new Event('open'));
  assert.equal((await result).socket, f.socket);
  assert.equal(f.timer, null);
});

test('never-open and late-open CDP handshakes fail and close their socket', async () => {
  for (const mode of ['never', 'late']) {
    const f = handshake();
    const rejected = assert.rejects(connectChromePage(f.options), error => {
      assert.equal(error.diagnostics.stage, 'CDP connection');
      assert.equal(error.diagnostics.reason, 'deadline exceeded');
      return true;
    });
    await tick();
    if (mode === 'never') f.timer();
    else { await f.options.pause(500); f.socket.dispatchEvent(new Event('open')); }
    await rejected; assert.equal(f.socket.closed, true); assert.equal(f.timer, null);
  }
});

test('WebSocket failure and browser exit during handshake fail promptly', async () => {
  for (const mode of ['error', 'close', 'exit']) {
    const f = handshake();
    const rejected = assert.rejects(connectChromePage(f.options), /WebSocket error|closed before open|browser unavailable/);
    await tick();
    if (mode === 'exit') { f.child.exitCode = 8; f.child.emit('exit', 8); }
    else f.socket.dispatchEvent(new Event(mode));
    await rejected; assert.equal(f.socket.closed, true); assert.equal(f.timer, null);
  }
});

test('debugger connection cannot leave the discovered loopback endpoint', async () => {
  for (const address of ['ws://example.com:9222/x', 'ws://127.0.0.1:9223/x', 'wss://127.0.0.1:9222/x', 'ws://user@127.0.0.1:9222/x']) {
    const f = handshake(); f.options.fetchTargets = async () => [{ ...page, webSocketDebuggerUrl: address }];
    await assert.rejects(connectChromePage(f.options), /discovered loopback/);
    assert.equal(f.socket, undefined);
  }
});

test('all raw-CDP site consumers use the shared bounded connection and command lifecycle', async () => {
  for (const name of ['release-interaction-suite', 'project-carousel-smoke', 'performance-smoke', 'prime-pwa-smoke']) {
    const source = await readFile(new URL(`./${name}.mjs`, import.meta.url), 'utf8');
    assert.match(source, /connectChromePage\(/, name);
    assert.match(source, /createCdpCommands\(/, name);
    assert.doesNotMatch(source, /new WebSocket\(|webSocketDebuggerUrl|DevToolsActivePort/, name);
  }
});
