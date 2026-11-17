import { pathToFileURL } from 'node:url';

// This is only the fixed Hosted CI packaging barrier, not a task scheduler.
// package.json owns commands; ci.yml starts these independent jobs. Never use
// another run, a cached success, or an intermediate release to satisfy this gate.
export const hostedGateJobs = Object.freeze(['source-validation', 'publication-fixtures', 'common-tool']);
const repository = 'Xpotato1024/xpotato-site';
const workflow = 'vNext CI';
const workflowPath = '.github/workflows/ci.yml';
const allowedJobs = new Set(['scope', ...hostedGateJobs, 'producer', 'windows-consumer', 'result']);
const activeStatuses = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);
const positiveInteger = value => typeof value === 'string' && /^[1-9][0-9]*$/u.test(value) && Number.isSafeInteger(Number(value));
const fail = message => { throw new Error(`Hosted CI gate: ${message}`); };

export function hostedGateContext(env = process.env) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_REPOSITORY !== repository || env.GITHUB_WORKFLOW !== workflow || env.GITHUB_JOB !== 'producer') fail('unexpected caller');
  if (!positiveInteger(env.GITHUB_RUN_ID) || !positiveInteger(env.GITHUB_RUN_ATTEMPT)) fail('invalid run identity');
  if (typeof env.RELEASE_SOURCE_SHA !== 'string' || !/^[a-f0-9]{40}$/u.test(env.RELEASE_SOURCE_SHA)) fail('invalid source SHA');
  const event = env.GITHUB_EVENT_NAME, ref = env.GITHUB_REF;
  if (!(event === 'push' && ref === 'refs/heads/main') && !(event === 'pull_request' && /^refs\/pull\/[1-9][0-9]*\/merge$/u.test(ref ?? ''))) fail('unsupported event/ref');
  return Object.freeze({ runId: env.GITHUB_RUN_ID, attempt: Number(env.GITHUB_RUN_ATTEMPT), sourceSha: env.RELEASE_SOURCE_SHA, event, ref });
}

export function assertHostedRun(run, context) {
  if (String(run?.id) !== context.runId || run?.run_attempt !== context.attempt || run?.repository?.full_name !== repository ||
      !Number.isSafeInteger(run?.repository?.id) || run.repository.id < 1 || run?.name !== workflow || run?.path !== workflowPath ||
      run?.head_sha !== context.sourceSha || run?.event !== context.event) fail('run/source/workflow identity mismatch');
  // The producer is still running. A finished run cannot authorize a new package.
  if (run.status !== 'in_progress' || run.conclusion !== null) fail('run is not active');
  if (context.event === 'push') {
    if (run.head_branch !== 'main') fail('push is not main');
  } else {
    const number = Number(context.ref.split('/')[2]);
    if (!Array.isArray(run.pull_requests)) fail('missing authenticated PR identity');
    const matches = run.pull_requests.filter(pr => pr?.number === number && pr?.head?.sha === context.sourceSha &&
      pr?.head?.repo?.id === run.repository.id && pr?.base?.ref === 'main' && pr?.base?.repo?.id === run.repository.id);
    if (matches.length !== 1) fail('PR source, repository, or target mismatch');
  }
}

export function pendingHostedJobs(listing, context) {
  if (!Array.isArray(listing?.jobs) || !Number.isInteger(listing.total_count) || listing.total_count !== listing.jobs.length || listing.jobs.length > 100) fail('incomplete job listing');
  const jobs = new Map(), ids = new Set();
  for (const job of listing.jobs) {
    if (!allowedJobs.has(job?.name) || jobs.has(job.name) || !Number.isSafeInteger(job.id) || job.id < 1 || ids.has(job.id)) fail('unexpected or duplicate job identity');
    if (String(job.run_id) !== context.runId || job.run_attempt !== context.attempt || job.head_sha !== context.sourceSha || job.workflow_name !== workflow) fail('job run/attempt/source/workflow mismatch');
    jobs.set(job.name, job); ids.add(job.id);
  }
  const pending = [];
  for (const name of hostedGateJobs) {
    const job = jobs.get(name);
    // A scheduled job may not have appeared yet; absence never counts as success.
    if (!job) { pending.push(name); continue; }
    if (job.status === 'completed') {
      if (job.conclusion !== 'success') fail(`required job ${name} did not succeed`);
    } else if (activeStatuses.has(job.status) && job.conclusion === null) pending.push(name);
    else fail(`invalid required job state: ${name}`);
  }
  return pending;
}

export async function waitForHostedGates({ env = process.env, fetchImpl = fetch, now = () => performance.now(),
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), log = console.log,
  timeoutMs = 25 * 60_000, pollMs = 10_000, requestTimeoutMs = 15_000 } = {}) {
  const context = hostedGateContext(env);
  const token = env.GH_TOKEN;
  if (typeof token !== 'string' || !token || /\s/u.test(token)) fail('missing or malformed read-only token');
  for (const [value, maximum] of [[timeoutMs, 25 * 60_000], [pollMs, 10_000], [requestTimeoutMs, 15_000]]) {
    if (!Number.isFinite(value) || value <= 0 || value > maximum) fail('invalid bounded wait');
  }
  const deadline = now() + timeoutMs;
  const base = `https://api.github.com/repos/${repository}/actions/runs/${context.runId}/attempts/${context.attempt}`;
  async function read(url) {
    const remaining = deadline - now();
    if (remaining <= 0) fail('deadline exceeded');
    const controller = new AbortController();
    let timer;
    const expired = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('Hosted CI gate: API request deadline exceeded')); }, Math.min(requestTimeoutMs, remaining));
    });
    const request = async () => {
      let response;
      try {
        response = await fetchImpl(url, { method: 'GET', redirect: 'error', signal: controller.signal,
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
      } catch { fail('API request failed'); }
      if (response.status !== 200) fail(`API HTTP ${Number.isInteger(response.status) ? response.status : 'invalid'}`);
      let body;
      try { body = await response.text(); } catch { fail('API body unavailable'); }
      if (body.length > 2 * 1024 * 1024) fail('API response exceeds limit');
      try { return JSON.parse(body); } catch { fail('API returned invalid JSON'); }
    };
    try { return await Promise.race([request(), expired]); }
    finally { clearTimeout(timer); controller.abort(); }
  }
  let previous = '';
  while (now() < deadline) {
    assertHostedRun(await read(base), context);
    const pending = pendingHostedJobs(await read(`${base}/jobs?per_page=100`), context);
    if (now() >= deadline) fail('deadline exceeded');
    if (!pending.length) {
      log(`[ci:hosted:gate] PASS: current run ${context.runId} attempt ${context.attempt}; all three required jobs succeeded`);
      return { sourceSha: context.sourceSha, runId: context.runId, attempt: context.attempt, jobs: [...hostedGateJobs] };
    }
    const current = pending.join(', ');
    if (current !== previous) { log(`[ci:hosted:gate] Waiting for: ${current}`); previous = current; }
    await sleep(Math.min(pollMs, deadline - now()));
  }
  fail('deadline exceeded');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await waitForHostedGates(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
