import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { articleClosure, classifyImpact, inspectImpact, parseNameStatus } from './ci-impact.mjs';
import { classify } from './ci-scope.mjs';
const article = 'apps/site/src/content/blog/example.mdx';
const change = (path, status = 'M') => ({ status, paths: [path] });

test('article-only observations include cross-page dependencies but authorize no skip', () => {
  const result = classifyImpact([change(article), change('README.md')]);
  assert.equal(result.candidate, 'article-impact-candidate');
  assert.deepEqual(result.affectedArticleSources, [article]);
  assert.deepEqual(result.affectedDomains, articleClosure);
  for (const domain of ['home-activity', 'collection-archives-and-pagination', 'category-and-tag-archives', 'search-index-and-ui', 'rss', 'sitemap', 'all-related-article-cards', 'all-content-links', 'route-and-redirect-integrity', 'publication-and-media-integrity']) assert.ok(result.affectedDomains.includes(domain));
  assert.equal(result.mode, 'shadow');
  assert.equal(result.skipAuthorized, false);
  assert.equal(result.estimatedSavedSeconds, null);
  assert.ok(result.unresolved.length);
  assert.equal(classify([article]).core, true);
  assert.equal(classifyImpact([change('apps/site/src/content/notes/new.md', 'A')]).candidate, 'article-impact-candidate');
});

test('shared, registry, tool and unknown inputs force full even mixed with articles', () => {
  for (const path of ['apps/site/src/content-registry/taxonomy/tags.json', 'apps/site/src/content-registry/provenance/a.json',
    'apps/site/src/content-registry/media/assets.json', 'apps/site/src/content/tools/prime-factorizer.mdx',
    'apps/site/src/content/projects/project.mdx', 'apps/site/src/content/pages/about.mdx',
    'apps/site/src/content/blog/nested/article.mdx', 'apps/site/src/styles/global.css',
    'apps/site/src/components/Article.astro', 'apps/site/src/lib/discovery/index.ts',
    'apps/site/src/content.config.ts', 'apps/site/public/file.svg', 'config/browser-tools/installations.json',
    'vendor/browser-tools/prime/index.js', 'package.json', 'package-lock.json', '.node-version',
    '.github/workflows/ci.yml', 'scripts/ci-impact.mjs', 'tools/qa/test.mjs', 'schemas/a.json',
    'docs/migration/acceptance.md', 'docs/architecture/infrastructure-handoff.md', 'unknown']) {
    assert.equal(classifyImpact([change(article), change(path)]).candidate, 'full', path);
  }
});

test('missing diff, empty, malformed paths and destructive statuses fail closed', () => {
  assert.equal(classifyImpact([], { comparisonAvailable: false }).candidate, 'full');
  assert.equal(classifyImpact([]).candidate, 'full');
  for (const status of ['D', 'T', 'U', 'X', 'B', 'R100', 'C100', 'unexpected']) {
    assert.equal(classifyImpact([{ status, paths: [article, 'apps/site/src/content/blog/new.mdx'] }]).candidate, 'full');
  }
  for (const path of ['../README.md', '/README.md', 'docs/a\nb.md', 'docs/../x.md', 'docs//a.md', 'docs/\\a.md']) {
    assert.equal(classifyImpact([change(path)]).candidate, 'full', path);
  }
  assert.equal(classifyImpact([change('README.md')]).candidate, 'existing-prose-only');
  assert.equal(classifyImpact([change('README.md', 'D')]).candidate, 'full');
});

test('NUL diff parser retains both sides, spaces and Unicode; rejects truncation', () => {
  assert.deepEqual(parseNameStatus('R100\0old name.mdx\0新しい名前.mdx\0M\0README.md\0'), [
    { status: 'R100', paths: ['old name.mdx', '新しい名前.mdx'] }, change('README.md'),
  ]);
  for (const raw of ['M\0name', 'R100\0old\0', 'M\0\0', '???\0file\0', 'M\0file\0D\0']) assert.throws(() => parseNameStatus(raw));
});

test('real Git snapshots cover modify, rename, delete, absent base and nonancestor base', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'ci-impact-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = () => { git('add', '-A'); git('-c', 'user.name=CI fixture', '-c', 'user.email=ci@example.invalid', 'commit', '-qm', 'fixture'); return git('rev-parse', 'HEAD'); };
  try {
    git('init', '-q'); git('config', 'core.autocrlf', 'false');
    mkdirSync(join(cwd, 'apps/site/src/content/blog'), { recursive: true });
    writeFileSync(join(cwd, article), 'original article\n'); const base = commit();
    writeFileSync(join(cwd, article), 'updated article\n'); commit();
    assert.equal(inspectImpact({ cwd, base }).candidate, 'article-impact-candidate');
    const modified = git('rev-parse', 'HEAD');
    renameSync(join(cwd, article), join(cwd, 'apps/site/src/content/blog/renamed.mdx')); commit();
    const renamed = inspectImpact({ cwd, base: modified });
    assert.equal(renamed.candidate, 'full'); assert.equal(renamed.changes[0].status, 'R100');
    rmSync(join(cwd, 'apps/site/src/content/blog/renamed.mdx')); commit();
    assert.equal(inspectImpact({ cwd, base: modified }).candidate, 'full');
    for (const invalid of [undefined, '', 'HEAD~1', '0'.repeat(40), 'f'.repeat(40)]) {
      assert.equal(inspectImpact({ cwd, base: invalid }).comparisonAvailable, false);
    }
    git('checkout', '-q', '--detach', base);
    writeFileSync(join(cwd, 'unknown'), 'shared input\n'); const divergent = commit();
    git('checkout', '-q', '--detach', modified);
    const nonancestor = inspectImpact({ cwd, base: divergent });
    assert.equal(nonancestor.candidate, 'full');
    assert.ok(nonancestor.reasons.includes('nonancestor-base'));
    assert.equal(nonancestor.comparisonAvailable, false);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test('workflow stores shadow evidence without changing existing execution decisions', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const source = readFileSync(new URL('./ci-impact.mjs', import.meta.url), 'utf8');
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(workflow, /run: node scripts\/ci-impact.mjs/);
  assert.match(workflow, /name: site-ci-impact-/);
  assert.match(pkg.scripts['test:release'], /scripts\/ci-impact.test.mjs/);
  assert.equal((workflow.match(/if: needs.scope.outputs.core == 'true'/g) ?? []).length, 4);
  assert.doesNotMatch(source, /GITHUB_OUTPUT/);
  assert.doesNotMatch(workflow, /if:.*(?:impact|candidate)/);
  assert.match(workflow, /run: npm run ci:final:public/);
  assert.match(workflow, /run: npm run ci:hosted:gate/);
  assert.match(workflow, /run: npm run release:package/);
});
