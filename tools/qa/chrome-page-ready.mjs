import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// DevToolsActivePort can exist before Chrome creates its first page target.
// Keep process diagnostics separate so spawn errors are observed immediately.
export function observeChromeProcess(child) {
  let launchError = null, stderr = '';
  const listeners = new Set();
  const notify = () => { for (const listener of listeners) listener(); };
  child.on('error', error => { launchError = error.message; notify(); });
  child.on('exit', notify);
  child.stderr?.on('data', chunk => { stderr = (stderr + String(chunk)).slice(-4096); });
  const snapshot = () => ({ pid: child.pid ?? null, exitCode: child.exitCode, signalCode: child.signalCode, launchError, stderr });
  snapshot.subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
  return snapshot;
}

export async function waitForChromePage({
  profile, processState, timeoutMs = 20000, pollMs = 100,
  readActivePort = signal => readFile(join(profile, 'DevToolsActivePort'), { encoding: 'utf8', signal }),
  fetchTargets = async (port, signal) => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal });
    if (!response.ok) throw new Error(`Target list HTTP ${response.status}`);
    return response.json();
  },
  now = () => performance.now(), pause = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  const started = now(), deadline = started + timeoutMs;
  let attempts = 0, stage = 'port file', port = null, targets = [], lastError = null;
  const fail = reason => {
    const diagnostics = { reason, stage, elapsedMs: Math.round(now() - started), timeoutMs, attempts, port, targets, lastError, process: processState() };
    const error = new Error(`Chrome page startup failed: ${JSON.stringify(diagnostics)}`);
    error.diagnostics = diagnostics;
    return error;
  };
  const checkProcess = () => {
    const state = processState();
    if (state.launchError || state.exitCode != null || state.signalCode != null) throw fail('browser unavailable');
  };
  while (now() < deadline) {
    checkProcess();
    attempts++;
    try {
      stage = 'port file';
      const value = (await readActivePort(AbortSignal.timeout(Math.max(1, Math.ceil(deadline - now()))))).split('\n')[0].trim();
      if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) throw new Error('DevToolsActivePort has no valid port yet');
      port = Number(value);
      stage = 'page target';
      const remaining = Math.ceil(deadline - now());
      if (remaining <= 0) break;
      const list = await fetchTargets(port, AbortSignal.timeout(remaining));
      if (!Array.isArray(list)) throw new Error('Target list is not an array');
      targets = list.slice(0, 10).map(target => ({ type: target?.type ?? null, id: target?.id ?? null, hasDebuggerUrl: typeof target?.webSocketDebuggerUrl === 'string' }));
      const target = list.find(target => target?.type === 'page' && typeof target.webSocketDebuggerUrl === 'string' && target.webSocketDebuggerUrl.length > 0);
      checkProcess();
      if (target && now() < deadline) return { port, target };
      lastError = 'No page target with a debugger URL yet';
    } catch (error) {
      // A process failure must not be swallowed as a transient target-list race.
      if (error.diagnostics) throw error;
      lastError = error.message;
    }
    checkProcess();
    const remaining = deadline - now();
    if (remaining > 0) await pause(Math.min(pollMs, remaining));
  }
  throw fail('deadline exceeded');
}

// Target discovery and WebSocket connection share one startup budget.
export async function connectChromePage({ WebSocketClass = WebSocket, schedule = setTimeout, unschedule = clearTimeout, ...options }) {
  const now = options.now ?? (() => performance.now());
  const started = now(), timeoutMs = options.timeoutMs ?? 20000;
  const { port, target } = await waitForChromePage({ ...options, now, timeoutMs });
  const address = new URL(target.webSocketDebuggerUrl);
  if (address.protocol !== 'ws:' || address.hostname !== '127.0.0.1' || Number(address.port) !== port || address.username || address.password) throw new Error('Chrome debugger must use the discovered loopback port');
  const socket = new WebSocketClass(address.href);
  return new Promise((resolve, reject) => {
    let settled = false, timer, unsubscribe = () => {};
    const cleanup = () => {
      unschedule(timer); unsubscribe();
      socket.removeEventListener('open', open);
      socket.removeEventListener('error', error);
      socket.removeEventListener('close', close);
    };
    const fail = reason => {
      if (settled) return;
      settled = true; cleanup();
      const diagnostics = { reason, stage: 'CDP connection', elapsedMs: Math.round(now() - started), timeoutMs, port, process: options.processState() };
      // Retain the error listener while an unfinished handshake is closed.
      socket.addEventListener('error', () => {}, { once: true });
      try { socket.close(); } catch {}
      const failure = new Error(`Chrome page startup failed: ${JSON.stringify(diagnostics)}`);
      failure.diagnostics = diagnostics;
      reject(failure);
    };
    const checkProcess = () => {
      const state = options.processState();
      if (state.launchError || state.exitCode != null || state.signalCode != null) fail('browser unavailable');
    };
    const open = () => {
      checkProcess();
      if (settled) return;
      if (now() - started >= timeoutMs) return fail('deadline exceeded');
      settled = true; cleanup(); resolve({ port, target, socket });
    };
    const error = () => fail('WebSocket error');
    const close = () => fail('WebSocket closed before open');
    socket.addEventListener('open', open);
    socket.addEventListener('error', error);
    socket.addEventListener('close', close);
    unsubscribe = options.processState.subscribe?.(checkProcess) ?? (() => {});
    checkProcess();
    if (settled) return;
    const remaining = timeoutMs - (now() - started);
    if (remaining <= 0) return fail('deadline exceeded');
    timer = schedule(() => fail('deadline exceeded'), Math.ceil(remaining));
    if (socket.readyState === 1) open();
  });
}
