import { execFileSync } from 'node:child_process';

export interface SiteRevision {
  sha: string;
  committedAt: string;
}

type ReadGit = (args: string[]) => string;

/** Build-source identity only. A commit time is never a deployment time. */
export function readSiteRevision(root: string, readGit: ReadGit = args =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(),
): SiteRevision | null {
  try {
    const [sha, committedAt, ...extra] = readGit(['log', '-1', '--format=%H%n%cI', 'HEAD']).trim().split('\n');
    if (!sha || !/^[a-f0-9]{40}$/u.test(sha) || !committedAt || extra.length ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/u.test(committedAt) ||
        !Number.isFinite(Date.parse(committedAt))) throw new Error('Invalid source revision');
    // Local edits are not the named commit. Do not label them as that revision.
    if (readGit(['status', '--porcelain', '--untracked-files=normal']).trim()) throw new Error('Uncommitted source');
    return { sha, committedAt };
  } catch {
    // Source exports and private previews can render without a public source identity.
    // The existing release pipeline, rather than the footer, owns release eligibility.
    return null;
  }
}
