import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {assertManualWorkflow} from "./release/deployment/manual-deployment-workflow-policy.mjs";
import {sourceLanes} from './ci-source.mjs';
const scripts = JSON.parse(readFileSync(new URL("../package.json", import.meta.url))).scripts;
function expanded(name, ancestors = []) {
  assert.ok(!ancestors.includes(name), `Cycle: ${name}`);
  return scripts[name].split(' && ').flatMap(cmd => {
    if (cmd === 'node scripts/ci-source.mjs') return sourceLanes.flatMap(lane => expanded(lane, [...ancestors, name]));
    const match = /^npm run ([\w:-]+)$/.exec(cmd);
    return match ? expanded(match[1], [...ancestors, name]) : [cmd];
  });
}
test('core DAG builds once before final consumers, packaging never rebuilds', () => {
  const graph = expanded('release:produce');
  assert.equal(graph.filter(c => c === 'npm run build --workspace @xpotato/site').length, 1);
  assert.equal(graph.filter(c => c.includes('static')).length, 1);
  assert.equal(graph.filter(c => c === 'tsx tools/build/publication.ts').length, 1);
  assert.equal(graph.filter(c => c === 'tsx tools/build/publication.ts --check').length, 1);
  assert.ok(graph.indexOf('tsx tools/build/publication.ts --check') > graph.indexOf('tsx tools/build/publication.ts'));
  assert.ok(!graph.some(c=>c.includes('security-headers-cli.ts --write')),'CSP is generated in the publication compiler, not a second writer');
  assert.equal(graph.filter(c => c === 'tsx tools/qa/performance-budget.mjs').length, 1);
  assert.ok(graph.indexOf('tsx tools/qa/performance-budget.mjs') > graph.indexOf('npm run build --workspace @xpotato/site'));
  assert.ok(!graph.some(c => /canonicaliz|artifact-manifest|phase8-preview/.test(c)));
  for (const name of ['release:package', 'phase7:check', 'phase8:check']) assert.ok(!expanded(name).some(c => /astro build|npm run build/.test(c)), name);
});
test('production dispatch remains manual/main/owner-only', () => {
  assertManualWorkflow(readFileSync(new URL("../.github/workflows/deploy-site.yml", import.meta.url), 'utf8'));
});

test('WebKit checks the one final build before packaging with a pinned engine dependency', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const producer = workflow.split('  producer:')[1].split('  windows-consumer:')[0];
  const webkit = producer.indexOf('run: npm run quality:home-webkit');
  assert.ok(webkit > producer.indexOf('run: npm run release:validate:hosted'));
  assert.ok(webkit < producer.indexOf('run: npm run ci:hosted:gate'));
  assert.match(producer, /npx --no-install playwright install --with-deps webkit/);
  assert.match(producer, /--dist "\$GITHUB_WORKSPACE\/apps\/site\/dist" --out "\$RUNNER_TEMP\/release-validation"/);
  assert.match(producer, /release-validation\/home-design-webkit\.json/);
  assert.equal(JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).devDependencies.playwright, '1.65.0');
});
test('only superseded PR runs are cancelled and dependency caching never caches test success', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(workflow, /group: vnext-ci-\$\{\{ github\.event_name == 'pull_request' && format\('pr-\{0\}', github\.event\.pull_request\.number\) \|\| format\('run-\{0\}', github\.run_id\) \}\}/);
  assert.match(workflow, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
  assert.match(workflow, /cache: npm/);
  assert.match(workflow, /run: npm ci --prefer-offline/);
  assert.match(workflow, /run: npm run release:validate:hosted/);
  assert.match(workflow, /run: npm run ci:hosted:gate/);
  assert.match(workflow, /run: npm run release:package/);
  assert.doesNotMatch(workflow, /pull_request_target|workflow_run|contents: write|actions: write/);
});
test('supplementary reports cannot become a score/build/upload gate', () => {
  assert.ok(!expanded('release:produce').some(c=>/(?:lighthouse-report\.mjs|external-links-cli\.ts|quality:lighthouse)/.test(c)));
  const source=readFileSync(new URL("../tools/qa/lighthouse-report.mjs",import.meta.url),'utf8');
  assert.match(source, /collectLighthouse/); assert.doesNotMatch(source, /'autorun'|'upload'|'assert'|@lhci/);
  assert.match(source,/withinTemp/);
  const workflow=readFileSync(new URL("../.github/workflows/ci.yml",import.meta.url),'utf8');
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


test('Hosted source jobs preserve all checks while the one producer gates packaging', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const sections = Object.fromEntries([...workflow.matchAll(/^  ([a-z-]+):\n([\s\S]*?)(?=^  [a-z-]+:|$(?![\s\S]))/gm)].map(match => [match[1], match[2]]));
  for (const name of ['source-validation', 'publication-fixtures', 'common-tool', 'producer']) {
    assert.match(sections[name], /needs: scope/);
    assert.match(sections[name], /if: needs\.scope\.outputs\.core == 'true'/);
    assert.match(sections[name], /ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
    assert.match(sections[name], /persist-credentials: false/);
    assert.match(sections[name], /npm ci --prefer-offline/);
    assert.doesNotMatch(sections[name].split('    steps:')[0], /runner\./, 'runner context is available only inside steps, not job-level env');
  }
  assert.match(sections['source-validation'], /run: npm run ci:source:validate/);
  assert.match(sections['publication-fixtures'], /run: npm run ci:fixtures:lifecycle/);
  assert.match(sections['common-tool'], /run: npm run release:interaction -- common-tool/);
  assert.equal(scripts['ci:source:validate'], 'npm run ci:source:preflight && npm run test && npm run test:release && npm run ci:source:checks');
  assert.equal(scripts['ci:source:preflight'], scripts['ci:source'].split(' && npm run test && npm run test:release')[0]);
  assert.equal(scripts['ci:fixtures:lifecycle'], 'npm run toolchain:check && npm run publication:isolation:prepare');
  assert.equal(scripts['ci:fixtures:isolation'], 'npm run authoring:isolation:prepare && npm run review:isolation:prepare && npm run visual:isolation:prepare && tsx tools/qa/article-publication-isolation.ts --prepare-isolation-only');
  assert.equal(scripts['ci:final:public'], scripts['ci:final'].replace('npm run release:interaction', 'npm run release:interaction -- public'));
  const hosted = expanded('release:produce:hosted');
  const build = hosted.indexOf('npm run build --workspace @xpotato/site');
  const isolation = hosted.indexOf('tsx tools/qa/article-publication-isolation.ts --prepare-isolation-only');
  const gate = hosted.indexOf('node scripts/ci-hosted-gate.mjs');
  const pack = hosted.indexOf('tsx tools/build/release-package-cli.ts');
  assert.equal(hosted.filter(command => command === 'npm run build --workspace @xpotato/site').length, 1);
  assert.ok(isolation >= 0 && isolation < build && build < gate && gate < pack);
  assert.ok(sections.producer.indexOf('run: npm run release:validate:hosted') < sections.producer.indexOf('run: npm run ci:hosted:gate'));
  assert.ok(sections.producer.indexOf('run: npm run ci:hosted:gate') < sections.producer.indexOf('run: npm run release:package'));
  assert.equal((sections.producer.match(/GH_TOKEN:/g) ?? []).length, 1);
  assert.match(sections.producer, /name: Require this attempt's independent[\s\S]*?GH_TOKEN:[^\n]+\n        run: npm run ci:hosted:gate/);
  assert.match(sections.result, /needs: \[scope, source-validation, publication-fixtures, common-tool, producer, windows-consumer\]/);
  for (const name of ['SOURCE_RESULT', 'FIXTURES_RESULT', 'COMMON_TOOL_RESULT', 'PRODUCER_RESULT', 'CONSUMER_RESULT']) assert.ok(sections.result.includes(`"$${name}" != success`), name);
});


test('public image cache never admits test success, private sources or a skipped build', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const producer = workflow.split('  producer:')[1].split('  windows-consumer:')[0];
  const paths = [
    '.local/home-workshop-build/candidate.json', '.local/home-workshop-build/public-master',
    '.local/home-workshop-build/variants', '.local/home-workshop-build/mobile', '.local/home-workshop-build/social',
  ];
  const cacheSteps = [...producer.matchAll(/uses: actions\/cache\/(restore|save)@([^ \n]+)[\s\S]*?path: \|\n((?:            [^\n]+\n)+)/g)];
  assert.equal(cacheSteps.length, 2);
  for (const [, , pin, block] of cacheSteps) {
    assert.equal(pin, '55cc8345863c7cc4c66a329aec7e433d2d1c52a9');
    assert.deepEqual(block.trim().split('\n').map(path => path.trim()), paths);
  }
  assert.doesNotMatch(producer, /restore-keys:/);
  assert.equal((producer.match(/cache-hit/g) ?? []).length, 1);
  assert.match(producer, /name: Save verified public derived images only\n        if: steps\.media-cache-restore\.outputs\.cache-hit != 'true'\n        continue-on-error: true/);
  assert.match(producer, /\[\[ -n "\$MATCHED_KEY" && "\$MATCHED_KEY" != "\$EXPECTED_KEY" \]\]/);
  assert.ok(producer.indexOf('run: npm run ci:media-cache:key') < producer.indexOf('run: npm run release:validate:hosted'));
  assert.ok(producer.indexOf('run: npm run ci:hosted:gate') < producer.indexOf('run: npm run ci:media-cache:verify'));
  assert.ok(producer.indexOf('run: npm run ci:media-cache:verify') < producer.indexOf('uses: actions/cache/save@'));
  const hosted = expanded('release:produce:hosted');
  assert.ok(hosted.indexOf('node --import tsx tools/build/home-workshop/ci-cache.ts verify') < hosted.indexOf('tsx tools/build/release-package-cli.ts'));
});


test('parallel public UI suite retains required design-role checks and both quality artifact sets', () => {
  const suite = readFileSync(new URL('../tools/qa/release-interaction-suite.mjs', import.meta.url), 'utf8');
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(suite, /import \{ verifyDesignRoleInteraction \} from '\.\/design-role-interaction\.mjs'/);
  const probe = suite.indexOf('await measured(verifyDesignRoleInteraction)');
  const search = suite.indexOf('const searchClearReport=');
  assert.ok(probe > 0 && probe < search, 'Design-role assertions run before the remaining public UI checks');
  assert.match(suite.slice(probe, search), /design-roles-final-dist\.json/);
  assert.match(suite.slice(probe, search), /if \(suite === 'remaining'\)/);
  for (const artifact of ['axe-*-final-dist.json', 'release-*-result.json', 'design-roles-final-dist.json', 'project-carousel-browser.json', 'carousel-*.png']) {
    assert.ok(workflow.includes('/release-validation/'+artifact), 'Retain quality artifact: '+artifact);
  }
});
