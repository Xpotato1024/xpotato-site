import {execFileSync} from 'node:child_process';
import {lstat, mkdtemp, realpath, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, dirname, join, resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

/** Only owns the fresh directory allocated by this call, never other worktrees. */
export async function withCommonToolWorktree<T>(root: string, operation: (paths: {temporary: string; workspace: string}) => Promise<T>): Promise<T> {
  const parent = await realpath(tmpdir());
  const temporary = await mkdtemp(join(parent, 'xpotato-common-tools-'));
  const workspace = join(temporary, 'site');
  const identity = await lstat(temporary);
  const git = (args: string[]) => execFileSync('git', args, {cwd: root, encoding: 'utf8', stdio: 'pipe'});
  const registered = () => git(['worktree', 'list', '--porcelain', '-z']).split('\0')
    .some(field => field.startsWith('worktree ') && resolve(field.slice(9)) === workspace);
  const assertOwned = async () => {
    if (dirname(temporary) !== parent || !/^xpotato-common-tools-[^/\\]+$/.test(basename(temporary)) || workspace !== join(temporary, 'site')) {
      throw Error('Unsafe fixture cleanup target');
    }
    const current = await lstat(temporary);
    if (!current.isDirectory() || current.isSymbolicLink() || current.dev !== identity.dev || current.ino !== identity.ino) {
      throw Error('Fixture cleanup directory identity changed');
    }
    const site = await lstat(workspace).catch(error => {if (error.code === 'ENOENT') return undefined; throw error;});
    if (site && (!site.isDirectory() || site.isSymbolicLink())) throw Error('Unsafe fixture worktree target');
  };
  const cleanup = async () => {
    await assertOwned();
    // Git on Windows may leave both a partial directory and its registration.
    // Remove only our exact directory with Node's bounded Windows retries, then
    // unregister only that path. Never prune unrelated worktree registrations.
    if (registered()) {
      try {git(['worktree', 'remove', '--force', workspace]);}
      catch {
        await assertOwned();
        // rm removes nested symlinks/junctions themselves, without following them.
        await rm(workspace, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
        for (let attempt = 0; attempt < 3 && registered(); attempt++) {
          try {git(['worktree', 'remove', '--force', workspace]);}
          catch (error) {if (attempt === 2) throw error; await delay(200 * (attempt + 1));}
        }
        if (registered()) throw Error('Fixture worktree registration remains after cleanup');
      }
    }
    await assertOwned();
    await rm(temporary, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
  };
  let failed = false;
  try {
    git(['worktree', 'add', '--detach', workspace, 'HEAD']);
    return await operation({temporary, workspace});
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {await cleanup();}
    catch (error) {
      if (!failed) throw error;
      // Do not replace an installer/build/validator failure with a cleanup error.
      console.error('Common-tool fixture cleanup also failed:', error);
    }
  }
}
