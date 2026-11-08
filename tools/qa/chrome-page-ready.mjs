import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// DevToolsActivePort can exist before Chrome creates its first page target.
// Keep process diagnostics separate so spawn errors are observed immediately.
export function observeChromeProcess(child) {
  let launchError = null, stderr = '';
  child.on('error', error => { launchError = error.message; });
  child.stderr?.on('data', chunk => { stderr = (stderr + String(chunk)).slice(-4096); });
  return () => ({ pid: child.pid ?? null, exitCode: child.exitCode, signalCode: child.signalCode, launchError, stderr });
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
