import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCdpCommands } from './cdp-commands.mjs';

function fixture() {
  class Socket extends EventTarget {
    readyState = 1; sent = [];
    send(data) { this.sent.push(JSON.parse(data)); }
    reply(data) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) })); }
  }
  const socket = new Socket(), timers = new Set();
  const client = createCdpCommands(socket, { schedule: callback => { timers.add(callback); return callback; }, unschedule: timer => timers.delete(timer) });
  return { socket, client, timers };
}

test('CDP success/error preserve command and worker-session routing', async () => {
  const { socket, client, timers } = fixture();
  const success = client.send('Runtime.enable', {}, 'worker-session');
  assert.deepEqual(socket.sent[0], { id: 1, method: 'Runtime.enable', params: {}, sessionId: 'worker-session' });
  socket.reply({ method: 'Runtime.event', params: {} });
  socket.reply({ id: 1, result: { enabled: true } });
  assert.deepEqual(await success, { enabled: true });
  const rejected = assert.rejects(client.send('Page.navigate'), /CDP Page.navigate: invalid/);
  socket.reply({ id: 2, error: { message: 'invalid' } }); await rejected;
  assert.equal(client.pendingCount, 0); assert.equal(timers.size, 0); client.dispose();
});

test('closed/error/disposed transport rejects every pending command and later sends', async () => {
  for (const mode of ['close', 'error', 'dispose']) {
    const { socket, client, timers } = fixture();
    const results = [assert.rejects(client.send('Page.enable'), /CDP transport/), assert.rejects(client.send('Runtime.enable'), /CDP transport/)];
    if (mode === 'dispose') client.dispose(); else socket.dispatchEvent(new Event(mode));
    await Promise.all(results); await assert.rejects(client.send('Network.enable'), /CDP transport/);
    assert.equal(client.pendingCount, 0); assert.equal(timers.size, 0);
  }
});

test('unconnected socket refuses sends without creating timers', async () => {
  const { socket, client, timers } = fixture(); socket.readyState = 0;
  await assert.rejects(client.send('Page.enable'), /not connected/);
  assert.equal(socket.sent.length, 0); assert.equal(client.pendingCount, 0); assert.equal(timers.size, 0); client.dispose();
});

test('send failure and command timeout release their entries', async () => {
  const { socket, client, timers } = fixture();
  const timedOut = assert.rejects(client.send('Page.enable'), /CDP timeout Page.enable/);
  for (const timer of [...timers]) { timers.delete(timer); timer(); } await timedOut;
  socket.send = () => { throw Error('fixture send failure'); };
  await assert.rejects(client.send('Runtime.enable'), /fixture send failure/);
  assert.equal(client.pendingCount, 0); assert.equal(timers.size, 0); client.dispose();
});

test('malformed response fails pending calls rather than leaving them hanging', async () => {
  for (const data of ['{', 'null', '42']) {
    const { socket, client, timers } = fixture();
    const rejected = assert.rejects(client.send('Page.enable'), /Invalid CDP response/);
    socket.dispatchEvent(new MessageEvent('message', { data })); await rejected;
    assert.equal(client.pendingCount, 0); assert.equal(timers.size, 0); client.dispose();
  }
});
