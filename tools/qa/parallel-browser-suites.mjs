import {spawn, execFileSync} from 'node:child_process';
import {readdirSync, readFileSync} from 'node:fs';

function ipcStdio(stdio = 'inherit') {
  if (typeof stdio === 'string') return [stdio, stdio, stdio, 'ipc'];
  return [...stdio.slice(0, 3), 'ipc'];
}

function hasLiveLinuxGroup(pgid, {list = readdirSync, read = readFileSync} = {}) {
  for (const pid of list('/proc')) {
    if (!/^[0-9]+$/.test(pid)) continue;
    let stat;
    try { stat = read(`/proc/${pid}/stat`, 'utf8'); }
    catch (error) { if (['ENOENT', 'ESRCH'].includes(error.code)) continue; throw error; }
    // comm may contain spaces, newlines and parentheses; the final ')' ends it.
    const fields = stat.slice(stat.lastIndexOf(')')+2).trim().split(/\s+/);
    if (stat.lastIndexOf(')') < 0 || !/^[A-Za-z]$/.test(fields[0]) || !/^\d+$/.test(fields[2] ?? '')) {
      throw new Error('Invalid process-group stat for '+pid);
    }
    if (Number(fields[2]) === pgid && !['Z', 'X'].includes(fields[0])) return true;
  }
  return false;
}

export async function waitForOwnedGroupExit(pgid, {
  platform = process.platform, exists, list, read,
  now = () => performance.now(), sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  const deadline = now()+1000;
  // kill(0) includes unreaped zombies. On Linux observe live group members,
  // not init's reaping schedule. This phase observes only; never signal again.
  const live = () => platform === 'linux' ? hasLiveLinuxGroup(pgid, {list, read}) : exists();
  while (live()) {
    const remaining = deadline-now();
    if (remaining <= 0) throw new Error('Owned browser group still live after SIGKILL deadline');
    await sleep(Math.min(20, remaining));
  }
}

async function closeOwnedGroup(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    if (child.exitCode === null && child.signalCode === null) execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {stdio:'ignore', windowsHide:true});
    return;
  }
  const exists = () => {
    try { process.kill(-child.pid, 0); return true; }
    catch (error) { if (error.code === 'ESRCH') return false; throw error; }
  };
  // Stop probing forever once the owned group disappears. In particular, do
  // not leave a delayed kill behind that might hit a subsequently reused PID.
  if (!exists()) return;
  try { process.kill(-child.pid, 'SIGTERM'); }
  catch (error) { if (error.code === 'ESRCH') return; throw error; }
  const deadline = performance.now()+2000;
  while (exists()) {
    if (performance.now() >= deadline) {
      try { process.kill(-child.pid, 'SIGKILL'); }
      catch (error) { if (error.code === 'ESRCH') return; throw error; }
      await waitForOwnedGroupExit(child.pid, {exists});
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

// Wait for every suite, including on failure, so each browser's finally block
// closes its own browser/server and a partial success never passes the gate.
export async function runBrowserSuites(suites) {
  for (const {startup} of suites) if (startup && (!Number.isFinite(startup.timeoutMs) || startup.timeoutMs <= 0 || !startup.ready)) {
    throw new Error('Bounded browser startup receipt required');
  }
  let previousReady = Promise.resolve();
  const results = await Promise.all(suites.map(async ({name, command, args, startup, ...options}) => {
    // Only launches are queued. After an exact CDP-ready receipt, the previous
    // browser's real-time assertions continue alongside every later suite.
    let release = () => {};
    if (startup) {
      const previous = previousReady;
      previousReady = new Promise(resolve => { release = resolve; });
      await previous;
    }
    const started = performance.now();
    return new Promise(resolve => {
      let child, ready = false, startupMs, failure, startupTimer, cleanup;
      const finish = async (code, signal) => {
        clearTimeout(startupTimer);
        if (startup && !ready) failure ??= 'Browser exited without the exact startup-ready receipt';
        if (startup && (failure || code !== 0)) stop(failure ?? 'Browser suite exited unsuccessfully');
        await cleanup;
        release();
        resolve({name, status:code===0&&!failure?'passed':'failed', code, signal,
          ...(failure ? {error:failure} : {}), ...(startupMs === undefined ? {} : {startupMs}), elapsedMs:performance.now()-started});
      };
      const stop = reason => {
        failure ??= reason;
        clearTimeout(startupTimer);
        // Gated children have their own process group: a missing/malformed
        // receipt cannot leave their Chrome/server running or kill a sibling.
        cleanup ??= closeOwnedGroup(child).catch(error => { failure += '; browser group cleanup failed: '+error.message; });
      };
      try {
        child = spawn(command, args, {stdio:'inherit', windowsHide:true, ...options,
          ...(startup ? {stdio:ipcStdio(options.stdio), detached:process.platform!=='win32'} : {})});
      } catch (error) { failure = error.message; finish(null, null); return; }
      child.once('error', error => { failure ??= error.message; });
      child.once('close', finish);
      if (startup) {
        startupTimer = setTimeout(() => stop('Browser startup-ready receipt deadline exceeded'), startup.timeoutMs);
        child.on('message', message => {
          if (failure) return;
          if (ready) return stop('Duplicate browser startup-ready receipt');
          if (performance.now()-started >= startup.timeoutMs) return stop('Browser startup-ready receipt deadline exceeded');
          const keys = Object.keys(startup.ready);
          if (!message || typeof message !== 'object' || Array.isArray(message) || Object.keys(message).length !== keys.length ||
              keys.some(key => message[key] !== startup.ready[key])) return stop('Unexpected browser startup-ready receipt');
          ready = true; startupMs = performance.now()-started;
          clearTimeout(startupTimer);
          release();
        });
        child.once('disconnect', () => { if (!ready) stop('Browser IPC disconnected before startup-ready receipt'); });
      }
    });
  }));
  if (results.some(result => result.status !== 'passed')) {
    throw new Error('Browser suite failure: '+JSON.stringify(results));
  }
  return results;
}
