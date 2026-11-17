import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hostedGateContext, hostedGateJobs, assertHostedRun, pendingHostedJobs, waitForHostedGates } from './ci-hosted-gate.mjs';

const source = 'a'.repeat(40);
const env = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'Xpotato1024/xpotato-site', GITHUB_WORKFLOW: 'vNext CI', GITHUB_JOB: 'producer',
  GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2', RELEASE_SOURCE_SHA: source, GITHUB_EVENT_NAME: 'pull_request', GITHUB_REF: 'refs/pull/169/merge', GH_TOKEN: 'synthetic-test-token' };
const context = hostedGateContext(env);
const run = () => ({ id: 123, run_attempt: 2, repository: { id: 42, full_name: env.GITHUB_REPOSITORY }, name: 'vNext CI',
  path: '.github/workflows/ci.yml', head_sha: source, head_branch: 'feature', event: 'pull_request', status: 'in_progress', conclusion: null,
  pull_requests: [{ number: 169, head: { sha: source, repo: { id: 42 } }, base: { ref: 'main', repo: { id: 42 } } }] });
const jobs = () => ({ total_count: 3, jobs: hostedGateJobs.map((name, i) => ({ id: 10 + i, name, run_id: 123, run_attempt: 2,
  head_sha: source, workflow_name: 'vNext CI', status: 'completed', conclusion: 'success' })) });
const response = (body, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
function harness({ runData = run(), jobsData = jobs() } = {}) {
  let time = 0, polls = 0;
  const calls = [], logs = [], sleeps = [];
  return {
    calls, logs, sleeps,
    options: { env, now: () => time, timeoutMs: 30_000, log: value => logs.push(value),
      sleep: async ms => { sleeps.push(ms); time += ms; },
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        const data = url.endsWith('/jobs?per_page=100') ? (typeof jobsData === 'function' ? jobsData(polls++) : jobsData) : runData;
        return response(data);
      } },
  };
}

test('fixed barrier uses authenticated GETs for only the current run attempt and all three jobs', async () => {
  const h = harness();
  const result = await waitForHostedGates(h.options);
  assert.deepEqual(result, { sourceSha: source, runId: '123', attempt: 2, jobs: ['source-validation', 'publication-fixtures', 'common-tool'] });
  assert.deepEqual(h.calls.map(c => c.url), [
    'https://api.github.com/repos/Xpotato1024/xpotato-site/actions/runs/123/attempts/2',
    'https://api.github.com/repos/Xpotato1024/xpotato-site/actions/runs/123/attempts/2/jobs?per_page=100',
  ]);
  for (const { options } of h.calls) {
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer ' + env.GH_TOKEN);
    assert.ok(options.signal instanceof AbortSignal);
  }
  assert.equal(h.sleeps.length, 0); assert.match(h.logs[0], /PASS/);
  assert.ok(h.logs.every(line => !line.includes(env.GH_TOKEN)));
});

test('PR context uses checked-out source, never the synthetic GITHUB_SHA; main remains a separate run', async () => {
  assert.equal(hostedGateContext({ ...env, GITHUB_SHA: 'f'.repeat(40) }).sourceSha, source);
  const mainEnv = { ...env, GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main' };
  const main = { ...run(), event: 'push', head_branch: 'main', pull_requests: [] };
  const h = harness({ runData: main });
  assert.equal((await waitForHostedGates({ ...h.options, env: mainEnv })).sourceSha, source);
  assert.throws(() => assertHostedRun({ ...main, head_branch: 'feature' }, hostedGateContext(mainEnv)), /not main/);
});

for (const [name, patch] of Object.entries({ local: { GITHUB_ACTIONS: 'false' }, repository: { GITHUB_REPOSITORY: 'Other/site' },
  workflow: { GITHUB_WORKFLOW: 'untrusted' }, caller: { GITHUB_JOB: 'source-validation' }, zeroRun: { GITHUB_RUN_ID: '0' },
  unsafeRun: { GITHUB_RUN_ID: '9007199254740992' }, attempt: { GITHUB_RUN_ATTEMPT: '2x' }, sha: { RELEASE_SOURCE_SHA: 'missing' },
  event: { GITHUB_EVENT_NAME: 'workflow_dispatch' }, target: { GITHUB_REF: 'refs/heads/main' },
  pushBranch: { GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/feature' }, token: { GH_TOKEN: '' }, tokenWhitespace: { GH_TOKEN: 'bad token' } })) {
  test(`rejects invalid caller ${name} before any request`, async () => {
    let called = false;
    await assert.rejects(waitForHostedGates({ env: { ...env, ...patch }, fetchImpl: () => { called = true; throw Error('unexpected'); } }), /Hosted CI gate/);
    assert.equal(called, false);
  });
}

for (const [name, patch] of Object.entries({ id: { id: 124 }, attempt: { run_attempt: 1 }, repository: { repository: { id: 42, full_name: 'Other/site' } },
  workflow: { name: 'Other' }, path: { path: '.github/workflows/deploy-site.yml' }, source: { head_sha: 'b'.repeat(40) },
  event: { event: 'push' }, cancelled: { status: 'completed', conclusion: 'cancelled' }, oldSuccess: { status: 'completed', conclusion: 'success' },
  contradictory: { conclusion: 'failure' }, noPullRequest: { pull_requests: [] } })) {
  test(`rejects mismatched or stale run ${name}`, () => assert.throws(() => assertHostedRun({ ...run(), ...patch }, context), /Hosted CI gate/));
}

for (const name of ['fork', 'different-pr', 'wrong-head', 'wrong-base', 'wrong-base-repo', 'duplicate-pr']) {
  test(`rejects unauthenticated PR relationship: ${name}`, () => {
    const data = run(), pr = data.pull_requests[0];
    if (name === 'fork') pr.head.repo.id = 43;
    if (name === 'different-pr') pr.number = 170;
    if (name === 'wrong-head') pr.head.sha = 'b'.repeat(40);
    if (name === 'wrong-base') pr.base.ref = 'feature';
    if (name === 'wrong-base-repo') pr.base.repo.id = 43;
    if (name === 'duplicate-pr') data.pull_requests.push(structuredClone(pr));
    assert.throws(() => assertHostedRun(data, context), /PR source, repository, or target mismatch/);
  });
}

test('missing, queued, and running gates wait; rechecks run identity before each poll', async () => {
  const h = harness({ jobsData: poll => {
    const data = jobs();
    if (poll === 0) { data.jobs.pop(); data.total_count--; }
    if (poll === 1) Object.assign(data.jobs[2], { status: 'in_progress', conclusion: null });
    return data;
  } });
  await waitForHostedGates(h.options);
  assert.deepEqual(h.sleeps, [10_000, 10_000]); assert.equal(h.calls.length, 6);
  assert.equal(h.logs.filter(line => line.includes('Waiting')).length, 1);
});

for (const conclusion of ['failure', 'cancelled', 'skipped', 'neutral', 'timed_out', 'action_required', 'stale', null]) {
  test(`completed ${conclusion} is never success`, async () => {
    const data = jobs(); data.jobs[1].conclusion = conclusion;
    const h = harness({ jobsData: data });
    await assert.rejects(waitForHostedGates(h.options), /publication-fixtures did not succeed/);
    assert.equal(h.sleeps.length, 0); assert.ok(h.logs.every(line => !line.includes('PASS')));
  });
}

for (const [name, patch] of Object.entries({ run: { run_id: 124 }, attempt: { run_attempt: 1 }, source: { head_sha: 'b'.repeat(40) },
  workflow: { workflow_name: 'Other' }, absentAttempt: { run_attempt: undefined }, unknownStatus: { status: 'unexpected' },
  pendingSuccess: { status: 'queued', conclusion: 'success' }, unknownJob: { name: 'replacement-job' } })) {
  test(`rejects invalid job ${name}`, () => {
    const data = jobs(); Object.assign(data.jobs[0], patch);
    assert.throws(() => pendingHostedJobs(data, context), /Hosted CI gate/);
  });
}

test('duplicate jobs/IDs and truncated pagination cannot satisfy the barrier', () => {
  for (const kind of ['name', 'id', 'pagination', 'missing-list']) {
    const data = jobs();
    if (kind === 'name') data.jobs[1].name = data.jobs[0].name;
    if (kind === 'id') data.jobs[1].id = data.jobs[0].id;
    if (kind === 'pagination') data.total_count = 101;
    if (kind === 'missing-list') delete data.jobs;
    assert.throws(() => pendingHostedJobs(data, context), /Hosted CI gate/);
  }
});

test('scope/producer/downstream jobs are allowed without being mistaken for independent gate success', () => {
  const data = jobs();
  for (const [index, name] of ['scope', 'producer', 'windows-consumer', 'result'].entries()) data.jobs.push({ ...data.jobs[0], id: 40 + index, name, status: 'queued', conclusion: null });
  data.total_count = data.jobs.length;
  assert.deepEqual(pendingHostedJobs(data, context), []);
});

test('missing required job has a finite deadline and never falls back to an earlier run', async () => {
  const data = jobs(); data.jobs.pop(); data.total_count--;
  const h = harness({ jobsData: data });
  await assert.rejects(waitForHostedGates({ ...h.options, timeoutMs: 25_000 }), /deadline exceeded/);
  assert.deepEqual(h.sleeps, [10_000, 10_000, 5_000]);
  assert.ok(h.calls.every(({ url }) => url.includes('/runs/123/attempts/2')));
  assert.ok(h.logs.every(line => !line.includes('PASS')));
});

for (const status of [301, 401, 403, 404, 429, 500]) {
  test(`HTTP ${status} fails closed without retry or response leakage`, async () => {
    let calls = 0;
    await assert.rejects(waitForHostedGates({ env, fetchImpl: async () => { calls++; return response('private response: ' + env.GH_TOKEN, status); } }), error => {
      assert.equal(error.message, `Hosted CI gate: API HTTP ${status}`); return true;
    });
    assert.equal(calls, 1);
  });
}

test('network/body/JSON errors are sanitized and cannot produce PASS', async () => {
  for (const fetchImpl of [async () => { throw Error(env.GH_TOKEN); }, async () => ({ status: 200, text: async () => { throw Error(env.GH_TOKEN); } }),
    async () => response(env.GH_TOKEN), async () => response('x'.repeat(2 * 1024 * 1024 + 1))]) {
    await assert.rejects(waitForHostedGates({ env, fetchImpl }), error => {
      assert.match(error.message, /Hosted CI gate/); assert.ok(!error.message.includes(env.GH_TOKEN)); return true;
    });
  }
});

test('hung request is bounded and its signal is aborted', async () => {
  let signal;
  await assert.rejects(waitForHostedGates({ env, requestTimeoutMs: 10, fetchImpl: async (_url, options) => {
    signal = options.signal; return new Promise(() => {});
  } }), /API request deadline exceeded/);
  assert.equal(signal.aborted, true);
});

test('overlong responses cannot slip through the overall deadline', async () => {
  let time = 0;
  const h = harness();
  await assert.rejects(waitForHostedGates({ ...h.options, timeoutMs: 100, now: () => time, fetchImpl: async url => {
    if (url.endsWith('/jobs?per_page=100')) { time = 101; return response(jobs()); }
    return response(run());
  } }), /deadline exceeded/);
});

test('wait limits cannot be widened or disabled', async () => {
  for (const patch of [{ timeoutMs: 25 * 60_000 + 1 }, { timeoutMs: Infinity }, { pollMs: 0 }, { pollMs: 10_001 }, { requestTimeoutMs: 15_001 }]) {
    await assert.rejects(waitForHostedGates({ env, ...patch }), /invalid bounded wait/);
  }
});

test('CLI fails with a nonzero exit before network outside the hosted producer', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./ci-hosted-gate.mjs', import.meta.url))], { env: { PATH: process.env.PATH }, encoding: 'utf8' });
  assert.equal(result.status, 1); assert.match(result.stderr, /unexpected caller/);
});
