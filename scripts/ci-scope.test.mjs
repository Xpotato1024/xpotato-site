import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from './ci-scope.mjs';
test('prose only completes without build', () => assert.equal(classify(['docs/operations/validation.md', 'AGENTS.md']).core, false));
test('shared and unknown inputs require core', () => {
  for (const path of ['package.json', 'package-lock.json', '.github/workflows/ci.yml', 'schemas/a.json', 'docs/migration/evidence.json', 'docs/migration/acceptance.md', 'docs/architecture/infrastructure-handoff.md', 'apps/site/src/content/a.mdx', 'scripts/ci-scope.mjs', 'unknown']) assert.equal(classify([path, 'README.md']).core, true, path);
  assert.equal(classify([]).core, true);
});
