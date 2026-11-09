import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { publicationFixtureMode, publicationFixtureUpdateKinds } from '../tools/qa/publication-fixture-isolation.ts';

test('publication preparation is full unless the one explicit bounded mode is selected', () => {
  for (const args of [[], ['--prepare']]) {
    const mode = publicationFixtureMode(args);
    assert.equal(mode, 'prepare');
    assert.deepEqual(publicationFixtureUpdateKinds(mode), ['body', 'title', 'hero', 'category', 'tags']);
  }
  assert.equal(publicationFixtureMode(['--prepare-isolation-only']), 'prepare-isolation-only');
  assert.deepEqual(publicationFixtureUpdateKinds('prepare-isolation-only'), []);
  assert.equal(publicationFixtureMode(['--check']), 'check');
  assert.throws(() => publicationFixtureUpdateKinds('check'), /cannot prepare/);
});

test('unknown, conflicting, repeated and environment-style selectors cannot weaken preparation', () => {
  for (const args of [
    ['--fast'], ['--prepare-isolation'], ['--prepare-isolation-only=true'],
    ['--prepare', '--prepare-isolation-only'], ['--check', '--prepare-isolation-only'],
    ['--prepare-isolation-only', '--prepare-isolation-only'], ['--prepare', 'extra'],
  ]) assert.throws(() => publicationFixtureMode(args), /Expected --prepare/);
});

test('bounded preparation rejoins all base lifecycle assertions and writes the same leak-check receipt', async () => {
  const source = await readFile(new URL('../tools/qa/article-publication-isolation.ts', import.meta.url), 'utf8');
  const start = source.indexOf('for(const kind of publicationFixtureUpdateKinds(mode))');
  const end = source.indexOf('const context=await publicationCandidate', start);
  assert.ok(start > 0 && end > start);
  const before = source.slice(0, start), after = source.slice(end);
  for (const assertion of [
    'const candidate=await buildArticleCandidate',
    'await approveMockCandidate',
    'await persistMockMedia(job.directory,repo,repository,target,"protected",port)',
    'const exported=await exportMockCandidate',
    'cleanup=await renderMockExportAfterJobRemoval',
    'await assert.rejects(()=>exportMockCandidate',
    'let previous=await readMockExportData',
  ]) assert.ok(before.includes(assertion), assertion);
  for (const assertion of [
    'await validateMockReceipts(context,head)',
    'assert.equal(head.state,"EXPORTED")',
    'article-publication-isolation/receipt.json',
    'preparation:mode',
  ]) assert.ok(after.includes(assertion), assertion);
  assert.doesNotMatch(before.slice(before.indexOf('async function prepare()')), /return;|process\.exit\(/);
  assert.doesNotMatch(source, /process\.env\.[A-Z_]*(?:FAST|SKIP|ISOLATION_ONLY)/);
});
