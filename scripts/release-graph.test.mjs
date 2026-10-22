import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {assertManualWorkflow} from './release/manual-deployment-workflow-policy.mjs';
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
  assert.equal(graph.filter(c => c === 'tsx scripts/performance-budget.mjs').length, 1);
  assert.ok(graph.indexOf('tsx scripts/performance-budget.mjs') > graph.indexOf('npm run build --workspace @xpotato/site'));
  assert.ok(!graph.some(c => /canonicaliz|artifact-manifest|phase8-preview/.test(c)));
  for (const name of ['release:package', 'phase7:check', 'phase8:check']) assert.ok(!expanded(name).some(c => /astro build|npm run build/.test(c)), name);
});
test('production dispatch remains manual/main/owner-only', () => {
  assertManualWorkflow(readFileSync(new URL('../.github/workflows/deploy-site.yml', import.meta.url), 'utf8'));
});
test('supplementary reports cannot become a score/build/upload gate', () => {
  assert.ok(!expanded('release:produce').some(c=>/lighthouse|external-links/.test(c)));
  const source=readFileSync(new URL('./lighthouse-report.mjs',import.meta.url),'utf8');
  assert.match(source, /collectLighthouse/); assert.doesNotMatch(source, /'autorun'|'upload'|'assert'|@lhci/);
  assert.match(source,/withinTemp/);
  const workflow=readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
  assert.match(workflow,/Supplementary Lighthouse report[\s\S]*?continue-on-error: true[\s\S]*?run: npm run quality:lighthouse/);
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
