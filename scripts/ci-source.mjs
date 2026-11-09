import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Tests run before this barrier: they may mutate fixtures or inspect Git. These
// two lanes only share immutable source inputs. Private candidate builds have
// unique roots/cache/output under apps/site/.local, separate from astro check.
// Keep the isolation chain serial: publication can temporarily attach HEAD and
// must restore it before ci:source returns and the single final build starts.
export const sourceLanes = Object.freeze(['ci:source:checks', 'ci:source:fixtures']);

export function runNpmScript(script, { env = process.env, cwd = process.cwd() } = {}) {
  return new Promise((resolve, reject) => {
    // npm_execpath is set by npm run, and avoids shell/cmd.exe quoting differences.
    const npm = env.npm_execpath;
    if (!npm) return reject(new Error('Run the source lanes through npm run ci:source'));
    const child = spawn(process.execPath, [npm, 'run', script], { cwd, env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0 && signal === null) resolve();
      else reject(new Error(`${script} failed (${signal ?? `exit ${code}`})`));
    });
  });
}

export async function runSourceLanes(run = runNpmScript) {
  // Do not fail fast/kill the sibling: its finally block may need to restore
  // detached HEAD or finish private fixture cleanup. A failure never admits build.
  const results = await Promise.allSettled(sourceLanes.map(async script => run(script)));
  const failures = results.flatMap((result, index) => result.status === 'rejected'
    ? [new Error(`${sourceLanes[index]}: ${result.reason?.message ?? result.reason}`, { cause: result.reason })] : []);
  if (failures.length) throw new AggregateError(failures, failures.map(error => error.message).join('\n'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runSourceLanes(async script => {
      const start = performance.now();
      console.log(`[ci:source] ${script} START`);
      try {
        await runNpmScript(script);
        console.log(`[ci:source] ${script} END status=PASS elapsedMs=${Math.round(performance.now() - start)}`);
      } catch (error) {
        console.error(`[ci:source] ${script} END status=FAIL elapsedMs=${Math.round(performance.now() - start)}`);
        throw error;
      }
    });
  }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
