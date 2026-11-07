import {spawn} from 'node:child_process';

// Wait for every suite, including on failure, so each browser's finally block
// closes its own browser/server and a partial success never passes the gate.
export async function runBrowserSuites(suites) {
  const results = await Promise.all(suites.map(async ({name, command, args, ...options}) => {
    const started = performance.now();
    return new Promise(resolve => {
      const child = spawn(command, args, {stdio:'inherit', windowsHide:true, ...options});
      child.once('error', error => resolve({name, status:'failed', error:error.message, elapsedMs:performance.now()-started}));
      child.once('close', (code, signal) => resolve({name, status:code===0?'passed':'failed', code, signal, elapsedMs:performance.now()-started}));
    });
  }));
  if (results.some(result => result.status !== 'passed')) {
    throw new Error('Browser suite failure: '+JSON.stringify(results));
  }
  return results;
}
