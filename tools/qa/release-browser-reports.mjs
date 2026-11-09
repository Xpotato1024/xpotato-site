import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {runBrowserSuites} from './parallel-browser-suites.mjs';

export const releaseBrowserSuites = Object.freeze(['carousel', 'remaining', 'common-tool']);
const reportPath = (temp, name) => join(temp, `axe-${name}-final-dist.json`);

// Never reuse a prior invocation's success, including when a child exits zero
// without writing its report. Each child owns its browser/profile/server and file.
export async function runReleaseBrowserSuites({temp, createSuite}) {
  await mkdir(temp, {recursive:true});
  await Promise.all([
    ...releaseBrowserSuites.map(name => reportPath(temp, name)),
    join(temp, 'axe-final-dist.json'), join(temp, 'release-interaction-timing.json'),
  ].map(path => rm(path, {force:true})));
  const runId = randomUUID(), started = performance.now();
  const results = await runBrowserSuites(releaseBrowserSuites.map(name => createSuite(name, runId)));
  assert.deepEqual(results.map(result => result.name), releaseBrowserSuites, 'Exact successful browser suite set');
  const reports = await Promise.all(releaseBrowserSuites.map(async name => {
    const report = JSON.parse(await readFile(reportPath(temp, name), 'utf8'));
    assert.equal(report.suite, name, 'Browser report suite identity');
    assert.equal(report.runId, runId, 'Fresh browser report identity');
    assert.ok(Array.isArray(report.reports), 'Browser accessibility report array');
    assert.equal(typeof report.browser, 'string', 'Browser user agent');
    return report;
  }));
  const [, remaining, commonTool] = reports;
  assert.ok(commonTool.commonToolReport, 'Common Tool result required');
  assert.equal(commonTool.privateCommonSiteBuilds, 1, 'One isolated private Site build');
  const {suite, ...remainingMetadata} = remaining;
  await writeFile(join(temp, 'axe-final-dist.json'), JSON.stringify({
    ...remainingMetadata,
    reports:reports.flatMap(report => report.reports),
    browsers:Object.fromEntries(reports.map(report => [report.suite, report.browser])),
    commonToolReport:commonTool.commonToolReport,
    privateCommonSiteBuilds:commonTool.privateCommonSiteBuilds,
  }, null, 2)+'\n');
  const timing = {buildCount:0, elapsedMs:performance.now()-started, suites:results};
  await writeFile(join(temp, 'release-interaction-timing.json'), JSON.stringify(timing, null, 2)+'\n');
  return timing;
}
