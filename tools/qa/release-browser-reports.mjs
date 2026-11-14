import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {runBrowserSuites} from './parallel-browser-suites.mjs';

export const releaseBrowserSuites = Object.freeze(['carousel-desktop', 'carousel-mobile', 'remaining', 'tools', 'common-tool']);
export const publicReleaseBrowserSuites = Object.freeze(releaseBrowserSuites.filter(name => name !== 'common-tool'));
const suitesForMode = mode => {
  assert.ok(mode === 'all' || mode === 'public', 'Expected browser mode: all or public');
  return mode === 'all' ? releaseBrowserSuites : publicReleaseBrowserSuites;
};
const reportPath = (temp, name) => join(temp, `axe-${name}-final-dist.json`);
const resultPath = (temp, name) => join(temp, `release-${name}-result.json`);
const mergedNames = ['axe-final-dist.json', 'project-carousel-browser.json', 'release-interaction-timing.json'];
const clearMerged = temp => Promise.all(mergedNames.map(name => rm(join(temp, name), {force:true})));
const writeJson = (path, value) => writeFile(path, JSON.stringify(value, null, 2)+'\n');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));

function assertRunId(runId) {
  assert.equal(typeof runId, 'string', 'Browser run identity required');
  assert.ok(runId.trim(), 'Browser run identity required');
}
function assertResult(result, name) {
  assert.equal(result.name, name, 'Exact successful browser suite identity');
  assert.equal(result.status, 'passed', 'Successful browser suite required');
  assert.equal(result.code, 0, 'Browser suite exited successfully');
  assert.equal(result.signal, null, 'Browser suite was not terminated');
  assert.ok(Number.isFinite(result.elapsedMs) && result.elapsedMs >= 0, 'Measured browser suite duration');
}


async function readSuiteReport(temp, name, runId) {
  const report = await readJson(reportPath(temp, name));
  assert.equal(report.suite, name, 'Browser report suite identity');
  assert.equal(report.runId, runId, 'Fresh browser report identity');
  assert.ok(Array.isArray(report.reports), 'Browser accessibility report array');
  assert.equal(typeof report.browser, 'string', 'Browser user agent');
  assert.equal(report.buildCount, 0, 'Browser suite must not rebuild public dist');
  if (name === 'tools') assert.ok(report.browserToolReport, 'Browser Tool result required');
  if (name.startsWith('carousel-')) {
    assert.equal(report.carouselReport?.scenario, name.slice('carousel-'.length), 'Exact carousel scenario report');
    assert.equal(report.carouselReport.status, 'PASS', 'Successful carousel scenario');
    if (name === 'carousel-mobile') assert.ok(report.carouselReport.mobileReport, 'Mobile carousel result required');
  }
  if (name === 'common-tool') {
    assert.ok(report.commonToolReport, 'Common Tool result required');
    assert.equal(report.privateCommonSiteBuilds, 1, 'One isolated private Site build');
  }
  return report;
}

// A single-shard receipt is written only after the child and its cleanup exit
// successfully. Independent CI jobs share an explicit fresh run ID, not reports
// from a prior invocation. This entrypoint alone never creates a combined PASS.
export async function runReleaseBrowserSuite({temp, name, runId, createSuite}) {
  assert.ok(releaseBrowserSuites.includes(name), 'Known release browser suite');
  assertRunId(runId);
  await mkdir(temp, {recursive:true});
  await clearMerged(temp);
  await Promise.all([reportPath(temp, name), resultPath(temp, name)].map(path => rm(path, {force:true})));
  const [result] = await runBrowserSuites([createSuite(name, runId)]);
  assertResult(result, name);
  await readSuiteReport(temp, name, runId);
  await writeJson(resultPath(temp, name), {runId, ...result});
  return result;
}

// Reusable after independent jobs, but only an exact set of fresh reports AND
// successful child-exit receipts can produce the aggregate artifact.
export async function mergeReleaseBrowserReports({temp, runId, elapsedMs, mode = 'all'}) {
  const suites = suitesForMode(mode);
  assertRunId(runId);
  await clearMerged(temp);
  const results = await Promise.all(suites.map(async name => {
    const {runId: resultRunId, ...result} = await readJson(resultPath(temp, name));
    assert.equal(resultRunId, runId, 'Fresh browser result identity');
    assertResult(result, name);
    return result;
  }));
  const reports = await Promise.all(suites.map(name => readSuiteReport(temp, name, runId)));
  const [desktop, mobile, remaining, tools, commonTool] = reports;
  const carouselReport = {...desktop.carouselReport, scenario:'all', mobileReport:mobile.carouselReport.mobileReport};
  const {suite, ...remainingMetadata} = remaining;
  const timing = {mode, buildCount:0, ...(elapsedMs === undefined ? {} : {elapsedMs}), suites:results};
  await writeJson(join(temp, 'project-carousel-browser.json'), carouselReport);
  await writeJson(join(temp, 'axe-final-dist.json'), {
    ...remainingMetadata,
    mode,
    browserToolReport:tools.browserToolReport,
    reports:reports.flatMap(report => report.reports),
    browsers:Object.fromEntries(reports.map(report => [report.suite, report.browser])),
    ...(mode === 'all' ? {commonToolReport:commonTool.commonToolReport, privateCommonSiteBuilds:commonTool.privateCommonSiteBuilds} : {}),
  });
  await writeJson(join(temp, 'release-interaction-timing.json'), timing);
  return timing;
}

// All real scenarios still run. Wait for every child even on failure so sibling
// cleanup completes before the failure propagates to the release graph.
export async function runReleaseBrowserSuites({temp, createSuite, mode = 'all'}) {
  const suites = suitesForMode(mode);
  await mkdir(temp, {recursive:true});
  await clearMerged(temp);
  const runId = randomUUID(), started = performance.now();
  await Promise.all(suites.flatMap(name => [reportPath(temp, name), resultPath(temp, name)]).map(path => rm(path, {force:true})));
  // Prime's shipped wall-clock deadlines also include debugger-paused Worker
  // observation. Do not compete with the carousel/layout browsers on this runner.
  // Keep every assertion, deadline, detector and suite; run tools after cleanup.
  const results = [], phases = [suites.filter(name => name !== 'tools'), ['tools']];
  let failure;
  for (const names of phases) {
    try { results.push(...await runBrowserSuites(names.map(name => createSuite(name, runId)))); }
    catch (error) { failure ??= error; }
  }
  // Still run the second phase after a failure for diagnostics, never aggregate PASS.
  if (failure) throw failure;
  results.sort((a,b) => suites.indexOf(a.name)-suites.indexOf(b.name));
  // No receipt or aggregate is trusted until every child has exited and its
  // cleanup completed. A ready message is only a launch-order signal.
  await Promise.all(results.map(async (result, index) => {
    const name = suites[index];
    assertResult(result, name);
    await readSuiteReport(temp, name, runId);
    await writeJson(resultPath(temp, name), {runId, ...result});
  }));
  return mergeReleaseBrowserReports({temp, runId, mode, elapsedMs:performance.now()-started});
}
