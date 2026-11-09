import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runNpmScript, runSourceLanes, sourceLanes } from './ci-source.mjs';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('both source lanes start before either finishes; success waits for both', async () => {
  const gates = sourceLanes.map(deferred), started = [];
  let completed = false;
  const run = runSourceLanes(script => {
    started.push(script);
    return gates[sourceLanes.indexOf(script)].promise;
  }).then(() => { completed = true; });
  assert.deepEqual(started, sourceLanes);
  gates[0].resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(completed, false);
  gates[1].resolve();
  await run;
  assert.equal(completed, true);
});

test('failure waits for sibling cleanup and cannot admit the next build', async () => {
  const cleanup = deferred(), events = [];
  const run = runSourceLanes(async script => {
    if (script === sourceLanes[0]) throw new Error('validator failed');
    await cleanup.promise;
    events.push('HEAD restored');
  }).then(() => events.push('BUILD'), error => {
    events.push('failed');
    assert.match(error.message, /validator failed/);
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events, []);
  cleanup.resolve();
  await run;
  assert.deepEqual(events, ['HEAD restored', 'failed']);
});

test('synchronous launch errors still wait for all lanes and report all failures', async () => {
  const started = [];
  await assert.rejects(runSourceLanes(script => {
    started.push(script);
    throw new Error(script);
  }), error => error instanceof AggregateError && error.errors.length === 2);
  assert.deepEqual(started, sourceLanes);
});

test('npm invocation fails closed without the npm entrypoint', async () => {
  await assert.rejects(runNpmScript('unused', { env: {} }), /through npm run ci:source/);
});

test('source graph retains every gate exactly once, with tests before shared fixture work', async () => {
  const { scripts } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(scripts.ci, 'npm run ci:source && npm run build && npm run ci:final');
  const prefix = scripts['ci:source'].split(' && ');
  assert.equal(prefix.pop(), 'node scripts/ci-source.mjs');
  assert.deepEqual(prefix, [
    'npm run browser-tools:install -- check', 'npm run toolchain:check', 'npm run schema:check',
    'npm run migration:legacy:check', 'npm run migration:legacy:baseline:check',
    'npm run migration:content:check', 'npm run migration:content:materialization:evidence:check',
    'npm run migration:taxonomy:inventory:check', 'npm run migration:taxonomy:review:check',
    'npm run migration:taxonomy:materialization:check', 'npm run migration:media:inventory:check',
    'npm run migration:media:review:proposal:check', 'npm run migration:media:candidate:check',
    'npm run test', 'npm run test:release',
  ]);
  assert.deepEqual(sourceLanes, ['ci:source:checks', 'ci:source:fixtures']);
  assert.equal(scripts[sourceLanes[0]], 'npm run typecheck && npm run validate:repository && npm run astro:check');
  assert.equal(scripts[sourceLanes[1]], 'npm run authoring:isolation:prepare && npm run review:isolation:prepare && npm run visual:isolation:prepare && npm run publication:isolation:prepare');
  assert.ok(scripts['test:release'].includes('scripts/ci-source.test.mjs'));
});


test('real subprocess success, failure, and launch errors are propagated', async t => {
  const root = await mkdtemp(join(tmpdir(), 'ci-source-runner-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const npm = join(root, 'fake-npm.mjs');
  await writeFile(npm, "if (process.argv[2] !== 'run') process.exit(91); process.exit(process.argv[3] === 'pass' ? 0 : 7);\n");
  const options = { cwd: root, env: { ...process.env, npm_execpath: npm } };
  await runNpmScript('pass', options);
  await assert.rejects(runNpmScript('fail', options), /fail failed \(exit 7\)/);
  await assert.rejects(runNpmScript('pass', { ...options, cwd: join(root, 'missing') }), /ENOENT/);
});


test('CLI reports START and timed END for both lanes even on failure', async t => {
  const root = await mkdtemp(join(tmpdir(), 'ci-source-logging-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const npm = join(root, 'fake-npm.mjs');
  await writeFile(npm, "process.exit(process.argv[3] === 'ci:source:checks' ? 7 : 0);\n");
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./ci-source.mjs', import.meta.url))], {
    cwd: root, env: { ...process.env, npm_execpath: npm }, encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /ci:source:checks START/);
  assert.match(result.stdout, /ci:source:fixtures START/);
  assert.match(result.stdout, /ci:source:fixtures END status=PASS elapsedMs=\d+/);
  assert.match(result.stderr, /ci:source:checks END status=FAIL elapsedMs=\d+/);
});
