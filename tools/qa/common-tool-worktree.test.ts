import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {execFileSync} from 'node:child_process';
import {access, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {tmpdir} from 'node:os';
import {withCommonToolWorktree} from './common-tool-worktree.js';

const faults = vi.hoisted(() => ({removals: 0, failCount: 0, failAdd: false, workspace: ''}));
vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {...actual, execFileSync: (...args: Parameters<typeof actual.execFileSync>) => {
    const argv = args[1] as string[];
    if (argv[0] === 'worktree' && argv[1] === 'add' && faults.failAdd) {faults.workspace = argv[3]!; throw Error('worktree add failed');}
    if (argv[0] === 'worktree' && argv[1] === 'remove') {
      faults.removals++;
      if (faults.removals <= faults.failCount) throw Error('Directory not empty');
    }
    return actual.execFileSync(...args);
  }};
});

describe('private common-tool worktree cleanup', () => {
  let root: string;
  let leftover: string | undefined;
  beforeEach(async () => {
    faults.removals = 0; faults.failCount = 0; faults.failAdd = false;
    root = await mkdtemp(join(tmpdir(), 'common-tool-cleanup-test-'));
    execFileSync('git', ['init', root], {stdio: 'pipe'});
    execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'fixture'], {stdio: 'pipe'});
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    if (leftover) {await rm(leftover, {recursive: true, force: true, maxRetries: 3}); leftover = undefined;}
    await rm(root, {recursive: true, force: true, maxRetries: 3});
  });
  it('removes the fixture and registration after successful work', async () => {
    let temporary = '';
    const result = await withCommonToolWorktree(root, async paths => {temporary = paths.temporary; return 42;});
    expect(result).toBe(42);
    await expect(access(temporary)).rejects.toMatchObject({code: 'ENOENT'});
    expect(execFileSync('git', ['-C', root, 'worktree', 'list', '--porcelain'], {encoding: 'utf8'})).not.toContain(temporary.replaceAll('\\', '/'));
  });
  it('recovers from Windows directory removal failure without pruning another worktree', async () => {
    const other = join(root, 'other');
    execFileSync('git', ['-C', root, 'worktree', 'add', '--detach', other, 'HEAD'], {stdio: 'pipe'});
    faults.failCount = 1;
    await withCommonToolWorktree(root, async ({workspace}) => {
      await mkdir(join(workspace, 'generated'));
      await writeFile(join(workspace, 'generated', 'file'), 'fixture');
    });
    expect(faults.removals).toBe(2);
    await expect(access(join(other, '.git'))).resolves.toBeUndefined();
  });
  it('does not follow nested directory links during fallback removal', async () => {
    const outside = join(root, 'outside'); await mkdir(outside);
    await writeFile(join(outside, 'sentinel'), 'keep');
    faults.failCount = 1;
    await withCommonToolWorktree(root, async ({workspace}) => {
      await symlink(outside, join(workspace, 'linked-output'), process.platform === 'win32' ? 'junction' : 'dir');
    });
    expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('keep');
  });
  it('bounds registration retries and reports cleanup failure after successful work', async () => {
    faults.failCount = Infinity;
    await expect(withCommonToolWorktree(root, async ({temporary}) => {leftover = temporary;})).rejects.toThrow('Directory not empty');
    expect(faults.removals).toBe(4);
  });
  it('refuses a replaced worktree root before invoking Git removal', async () => {
    const outside = join(root, 'outside'); await mkdir(outside);
    await writeFile(join(outside, 'sentinel'), 'keep');
    await expect(withCommonToolWorktree(root, async ({temporary, workspace}) => {
      leftover = temporary;
      await rename(workspace, join(temporary, 'original-site'));
      await symlink(outside, workspace, process.platform === 'win32' ? 'junction' : 'dir');
    })).rejects.toThrow('Unsafe fixture worktree target');
    expect(faults.removals).toBe(0);
    expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('keep');
  });
  it('cleans the allocated directory when worktree creation fails', async () => {
    faults.failAdd = true;
    const operation = vi.fn();
    await expect(withCommonToolWorktree(root, operation)).rejects.toThrow('worktree add failed');
    expect(operation).not.toHaveBeenCalled();
    await expect(access(dirname(faults.workspace))).rejects.toMatchObject({code: 'ENOENT'});
  });
  it('preserves the original work failure when cleanup also fails', async () => {
    faults.failCount = Infinity;
    const error = Error('build failed');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(withCommonToolWorktree(root, async ({temporary}) => {leftover = temporary; throw error;})).rejects.toBe(error);
    expect(log).toHaveBeenCalledWith('Common-tool fixture cleanup also failed:', expect.any(Error));
  });
});
