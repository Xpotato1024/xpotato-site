import { describe, expect, it } from 'vitest';
import { readSiteRevision } from './site-revision.js';

const sha = 'a'.repeat(40);
const committedAt = '2026-11-04T23:30:00-05:00';
const git = (log = `${sha}\n${committedAt}`, status = '') => (args: string[]) => args[0] === 'log' ? log : status;

describe('footer source revision', () => {
  it('keeps the exact commit timestamp and SHA independently of build time', () => {
    expect(readSiteRevision('.', git())).toEqual({ sha, committedAt });
  });
  it.each(['', 'main\n2026-11-04', `${sha}\nnot-a-date`, `${sha}\n2026-13-04T00:00:00+00:00`, `${sha}\n${committedAt}\nextra`])('omits unavailable or malformed metadata: %s', log => {
    expect(readSiteRevision('.', git(log))).toBeNull();
  });
  it('omits source identity for uncommitted local previews or source exports without Git', () => {
    expect(readSiteRevision('.', git(undefined, ' M apps/site/src/layouts/BaseLayout.astro'))).toBeNull();
    expect(readSiteRevision('.', () => { throw new Error('Git unavailable'); })).toBeNull();
  });
  it('omits identity when new untracked source is present', () => {
    expect(readSiteRevision('.', git(undefined, '?? source.ts'))).toBeNull();
  });
});
