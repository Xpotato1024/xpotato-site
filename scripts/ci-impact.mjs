import { execFileSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { classify } from './ci-scope.mjs';

// Observations only. Never export job outputs or authorize skipping a check.
export const articleClosure = Object.freeze([
  'changed-articles', 'home-activity', 'collection-archives-and-pagination',
  'category-and-tag-archives', 'search-index-and-ui', 'rss', 'sitemap',
  'all-related-article-cards', 'route-and-redirect-integrity',
  'all-content-links', 'publication-and-media-integrity',
]);
const shaPattern = /^[a-f0-9]{40}$/;
const articlePattern = /^apps\/site\/src\/content\/(blog|notes)\/[^/]+\.(md|mdx)$/;

export function parseNameStatus(raw) {
  if (!raw) return [];
  if (!raw.endsWith('\0')) throw new Error('Truncated Git diff');
  const fields = raw.slice(0, -1).split('\0');
  const changes = [];
  for (let i = 0; i < fields.length;) {
    const status = fields[i++];
    if (!/^(?:[AMDTUXB]|[RC]\d{1,3})$/.test(status)) throw new Error('Unknown Git diff status');
    const paths = fields.slice(i, i + (/^[RC]/.test(status) ? 2 : 1));
    i += paths.length;
    if (paths.length !== (/^[RC]/.test(status) ? 2 : 1) || paths.some(p => !p)) throw new Error('Incomplete Git diff');
    changes.push({ status, paths });
  }
  return changes;
}

export function classifyImpact(changes, { base = null, head = null, comparisonAvailable = true, comparisonReason = 'base-or-diff-unavailable' } = {}) {
  const paths = [...new Set(changes.flatMap(c => c.paths))].sort();
  const reasons = [];
  const validPath = p => typeof p === 'string' && p && !/[\x00-\x1f\x7f\\]/.test(p)
    && !p.startsWith('/') && !p.split('/').some(part => part === '.' || part === '..' || !part);
  if (!comparisonAvailable) reasons.push(comparisonReason);
  if (!paths.length) reasons.push('empty-change-set');
  if (paths.some(p => !validPath(p))) reasons.push('unsupported-path');
  if (changes.some(c => !['A', 'M'].includes(c.status))) reasons.push('delete-rename-copy-or-type-change');
  const articles = paths.filter(p => articlePattern.test(p));
  const prose = paths.filter(p => !classify([p]).core);
  const shared = paths.filter(p => !articles.includes(p) && !prose.includes(p));
  if (shared.length) reasons.push('shared-registry-tool-or-unknown-input');
  let candidate = 'full';
  if (!reasons.length) candidate = articles.length ? 'article-impact-candidate' : 'existing-prose-only';
  return {
    schemaVersion: 1, mode: 'shadow', base, head, comparisonAvailable,
    comparisonStrategy: 'exact-ancestor-base-to-head',
    classifierSource: head,
    candidate, reasons, changes, affectedArticleSources: articles,
    affectedDomains: candidate === 'article-impact-candidate' ? [...articleClosure] : candidate === 'full' ? ['all'] : [],
    // Existing prose policy remains the sole exception. Even article candidates run every current core check.
    executionPolicy: 'unchanged-ci-scope', skipAuthorized: false,
    estimatedSavedSeconds: null,
    unresolved: candidate === 'article-impact-candidate'
      ? ['exact routes and stable ContentIds', 'old/new metadata and reverse dependencies', 'suite-to-domain coverage', 'shared chunk and CSS output effects', 'MDX imports, exports and inline JSX semantics'] : [],
  };
}

export function inspectImpact({ cwd = process.cwd(), base = process.env.DIFF_BASE } = {}) {
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  let head = null;
  let comparisonReason = 'base-or-diff-unavailable';
  try {
    head = git(['rev-parse', '--verify', 'HEAD^{commit}']).trim();
    if (!base || !shaPattern.test(base) || /^0+$/.test(base)) throw new Error('Missing base');
    git(['cat-file', '-e', `${base}^{commit}`]);
    // Divergent trees alone cannot establish a complete impact/reuse boundary.
    comparisonReason = 'nonancestor-base';
    git(['merge-base', '--is-ancestor', base, head]);
    comparisonReason = 'base-or-diff-unavailable';
    const changes = parseNameStatus(git(['diff', '--name-status', '-z', '--find-renames', base, head]));
    return classifyImpact(changes, { base, head });
  } catch {
    return classifyImpact([], { base: shaPattern.test(base ?? '') ? base : null, head, comparisonAvailable: false, comparisonReason });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = { ...inspectImpact(), run: {
    repository: process.env.GITHUB_REPOSITORY ?? null,
    id: process.env.GITHUB_RUN_ID ?? null, attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    event: process.env.GITHUB_EVENT_NAME ?? null,
  } };
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (process.env.CI_IMPACT_REPORT) writeFileSync(process.env.CI_IMPACT_REPORT, json);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `\n### CI impact observation (shadow)\n\nCandidate: ${report.candidate}; changed entries: ${report.changes.length}.\n\nAll existing CI checks and prose-only policy remain unchanged. Skips authorized: none. Time saving: not measured.\n\n${report.reasons.length ? `Full fallback: ${report.reasons.join(', ')}.\n` : ''}`);
  console.log(json);
}
