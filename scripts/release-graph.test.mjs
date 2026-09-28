import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const scripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).scripts;
function expanded(name, ancestors = []) {
  assert.ok(!ancestors.includes(name), `Cycle: ${name}`);
  return scripts[name].split(' && ').flatMap(cmd => {
    const match = /^npm run ([\w:-]+)$/.exec(cmd);
    return match ? expanded(match[1], [...ancestors, name]) : [cmd];
  });
}
test('core DAG builds once before final consumers, packaging never rebuilds', () => {
  const graph = expanded('release:produce');
  assert.equal(graph.filter(c => c === 'npm run build --workspace @xpotato/site').length, 1);
  assert.equal(graph.filter(c => c.includes('static')).length, 1);
  assert.equal(graph.filter(c => c.includes('security-headers-cli.ts --write')).length, 1);
  assert.ok(!graph.some(c => /canonicaliz|artifact-manifest|phase8-preview/.test(c)));
  for (const name of ['release:package', 'phase7:check', 'phase8:check']) assert.ok(!expanded(name).some(c => /astro build|npm run build/.test(c)), name);
});
test('production activation remains blocked', () => {
  assert.match(readFileSync(new URL('../.github/workflows/deploy-site.yml', import.meta.url), 'utf8'), /if: \$\{\{ false \}\}/);
});
import { commandChanged } from './conditional-scope.mjs';
test('conditional validation follows affected command dependencies without unrelated reruns', () => {
  const before = { scripts: { target: 'npm run inner', inner: 'tsx media.ts', unrelated: 'old' }, engines: { node: '24' } };
  const after = structuredClone(before);
  after.scripts.unrelated = 'new';
  assert.equal(commandChanged(before, after, 'target'), false);
  after.scripts.inner = 'tsx changed.ts';
  assert.equal(commandChanged(before, after, 'target'), true);
  after.scripts.inner = before.scripts.inner;
  after.engines.node = '25';
  assert.equal(commandChanged(before, after, 'target'), true);
});
