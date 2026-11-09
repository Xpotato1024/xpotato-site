// Transport lifecycle only; consumers own event observations and assertions.
export function createCdpCommands(socket, { timeoutMs = 25000, schedule = setTimeout, unschedule = clearTimeout } = {}) {
  let sequence = 0, terminalError = null;
  const pending = new Map();
  const fail = error => {
    terminalError ??= error;
    for (const call of pending.values()) { unschedule(call.timer); call.reject(terminalError); }
    pending.clear();
  };
  const onClose = () => fail(new Error('CDP transport closed'));
  const onError = () => fail(new Error('CDP transport error'));
  const onMessage = event => {
    let message;
    try { message = JSON.parse(String(event.data)); }
    catch { fail(new Error('Invalid CDP response')); return; }
    if (!message || typeof message !== 'object') { fail(new Error('Invalid CDP response')); return; }
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id); unschedule(call.timer);
    message.error ? call.reject(new Error(`CDP ${call.method}: ${message.error.message}`)) : call.resolve(message.result);
  };
  socket.addEventListener('message', onMessage);
  socket.addEventListener('close', onClose);
  socket.addEventListener('error', onError);
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    if (terminalError || socket.readyState !== 1) { reject(terminalError ?? new Error(`CDP is not connected: ${method}`)); return; }
    const id = ++sequence;
    const timer = schedule(() => { pending.delete(id); reject(new Error(`CDP timeout ${method}`)); }, timeoutMs);
    pending.set(id, { method, resolve, reject, timer });
    try { socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }
    catch (error) { pending.delete(id); unschedule(timer); reject(error); }
  });
  return { send, get pendingCount() { return pending.size; }, dispose() {
    fail(new Error('CDP transport disposed'));
    socket.removeEventListener('message', onMessage);
    socket.removeEventListener('close', onClose);
    socket.removeEventListener('error', onError);
  } };
}
