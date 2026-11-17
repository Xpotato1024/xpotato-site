import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from './ci-scope.mjs';
test('prose only completes without build', () => assert.equal(classify(['docs/operations/validation.md', 'AGENTS.md']).core, false));
test('vendor ownership README is prose, including the PR167 documentation-only change set', () => {
  const result = classify(['docs/README.md', 'docs/operations/repository-hygiene-plan-20261109.md',
    'docs/operations/repository-ownership.md', 'docs/operations/repository-restructuring-coverage.md', 'vendor/README.md']);
  assert.equal(result.core, false);
  assert.match(result.reason, /^NOT_APPLICABLE: prose-only change; site build count=0$/);
  assert.equal(classify(['vendor/README.md']).core, false);
});
test('README exception never exempts vendor bytes, executable inputs or unknown paths', () => {
  for (const path of ['vendor/browser-tools/README.md', 'vendor/browser-tools/prime-factorizer/v0-2-5/README.md',
    'vendor/browser-tools/prime-factorizer/v0-2-5/src/index.js', 'vendor/README.md.js', 'vendor/readme.md',
    'config/browser-tools/installations.json', 'config/browser-tools/history.json', 'config/browser-tools/public-admissions.json',
    'package-lock.json', 'docs/acceptance/acceptance.md', 'docs/architecture/infrastructure-handoff.md', 'unknown']) {
    assert.equal(classify(['vendor/README.md', path]).core, true, path);
  }
});
test('shared and unknown inputs require core', () => {
  for (const path of ['package.json', 'package-lock.json', '.github/workflows/ci.yml', 'schemas/a.json', 'docs/acceptance/evidence.json', 'docs/acceptance/acceptance.md', 'docs/architecture/infrastructure-handoff.md', 'content/a.mdx', 'ops/ci/ci-scope.mjs', 'unknown']) assert.equal(classify([path, 'README.md']).core, true, path);
  assert.equal(classify([]).core, true);
});

// New working-code ownership must keep full CI rather than prose-only scope.
for (const path of ['ops/authoring/content.ts','ops/build/publication.ts','ops/qa/release-interaction.mjs','ops/media/publication/media-publication.ts']) {
  assert.equal(classify([path]).core, true);
}
