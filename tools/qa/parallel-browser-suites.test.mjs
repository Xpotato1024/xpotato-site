import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runBrowserSuites} from './parallel-browser-suites.mjs';

const suite = (name, source) => ({name, command:process.execPath, args:['--input-type=module', '-e', source], stdio:'ignore'});
test('all suites must pass, and a failing suite still waits for sibling cleanup', async () => {
  assert.deepEqual((await runBrowserSuites([suite('carousel',''),suite('remaining','')])).map(r=>r.status),['passed','passed']);
  const folder = await mkdtemp(join(tmpdir(),'browser-suite-test-'));
  const receipt = join(folder,'closed');
  try {
    await assert.rejects(runBrowserSuites([
      suite('carousel','process.exit(3)'),
      suite('remaining',`import {writeFile} from 'node:fs/promises'; await new Promise(r=>setTimeout(r,100)); await writeFile(${JSON.stringify(receipt)},'cleaned');`),
    ]), /Browser suite failure:.*"name":"carousel".*"code":3/);
    assert.equal(await readFile(receipt,'utf8'),'cleaned');
    await assert.rejects(runBrowserSuites([{name:'unlaunchable', command:join(folder,'missing-executable'), args:[], stdio:'ignore'}]),/Browser suite failure/);
    await assert.rejects(runBrowserSuites([suite('terminated',"process.kill(process.pid,'SIGTERM')")]),/Browser suite failure/);
  } finally { await rm(folder,{recursive:true,force:true}); }
});

// Exercise the real orchestration/merge without Chrome or rebuilding public dist.
import {writeFile} from 'node:fs/promises';
import {releaseBrowserSuites, runReleaseBrowserSuites} from './release-browser-reports.mjs';
const successfulReport = (name, runId) => ({
  suite:name, runId, browser:`test-${name}`, reports:[{label:name}],
  ...(name === 'remaining' ? {schemaVersion:1, buildCount:0, footerReport:{passed:true}} : {}),
  ...(name === 'common-tool' ? {commonToolReport:{passed:true}, privateCommonSiteBuilds:1} : {}),
});
const writeReportSuite = (folder, name, report, after = '') => suite(name,
  `import {writeFile} from 'node:fs/promises'; await writeFile(${JSON.stringify(join(folder,`axe-${name}-final-dist.json`))},${JSON.stringify(JSON.stringify(report))}); ${after}`);

test('three independent suites merge every report and preserve private-build metadata', async () => {
  const folder = await mkdtemp(join(tmpdir(),'release-report-test-'));
  try {
    const timing = await runReleaseBrowserSuites({temp:folder, createSuite:(name, runId) => writeReportSuite(folder, name, successfulReport(name, runId))});
    assert.deepEqual(timing.suites.map(result => result.name), ['carousel','remaining','common-tool']);
    assert.equal(timing.buildCount, 0);
    const combined = JSON.parse(await readFile(join(folder,'axe-final-dist.json'),'utf8'));
    assert.deepEqual(combined.reports.map(report => report.label), releaseBrowserSuites);
    assert.deepEqual(Object.keys(combined.browsers), releaseBrowserSuites);
    assert.deepEqual(combined.commonToolReport, {passed:true});
    assert.deepEqual(combined.footerReport, {passed:true});
    assert.equal(combined.privateCommonSiteBuilds, 1);
    assert.equal(combined.buildCount, 0);
    assert.equal(JSON.parse(await readFile(join(folder,'release-interaction-timing.json'),'utf8')).suites.length, 3);
  } finally { await rm(folder,{recursive:true,force:true}); }
});

for (const fault of ['missing', 'stale', 'wrong-suite', 'invalid-reports', 'missing-common-result', 'extra-private-build', 'wrong-result-set', 'child-failure']) {
  test(`report merge fails closed for ${fault} and removes stale success`, async () => {
    const folder = await mkdtemp(join(tmpdir(),'release-report-test-'));
    try {
      for (const name of [...releaseBrowserSuites.map(name => `axe-${name}-final-dist.json`),'axe-final-dist.json','release-interaction-timing.json']) {
        await writeFile(join(folder,name), JSON.stringify(successfulReport('common-tool','old-run')));
      }
      await assert.rejects(runReleaseBrowserSuites({temp:folder, createSuite:(name, runId) => {
        const report = successfulReport(name, runId);
        if (name !== 'common-tool') return writeReportSuite(folder, name, report);
        if (fault === 'missing') return suite(name, '');
        if (fault === 'stale') report.runId = 'old-run';
        if (fault === 'wrong-suite') report.suite = 'remaining';
        if (fault === 'invalid-reports') delete report.reports;
        if (fault === 'missing-common-result') delete report.commonToolReport;
        if (fault === 'extra-private-build') report.privateCommonSiteBuilds = 2;
        if (fault === 'wrong-result-set') return {...writeReportSuite(folder, name, report), name:'remaining'};
        return writeReportSuite(folder, name, report, fault === 'child-failure' ? 'process.exit(3)' : '');
      }}));
      for (const name of ['axe-final-dist.json','release-interaction-timing.json']) {
        await assert.rejects(readFile(join(folder,name)), {code:'ENOENT'});
      }
    } finally { await rm(folder,{recursive:true,force:true}); }
  });
}

test('release merge waits for both surviving suites after failure', async () => {
  const folder = await mkdtemp(join(tmpdir(),'release-report-test-'));
  try {
    await assert.rejects(runReleaseBrowserSuites({temp:folder, createSuite:(name, runId) => {
      if (name === 'common-tool') return suite(name,'process.exit(7)');
      return writeReportSuite(folder, name, successfulReport(name, runId),
        `await new Promise(r=>setTimeout(r,100)); await writeFile(${JSON.stringify(join(folder,name+'-closed'))},'cleaned');`);
    }}), /Browser suite failure/);
    for (const name of ['carousel','remaining']) assert.equal(await readFile(join(folder,name+'-closed'),'utf8'),'cleaned');
    await assert.rejects(readFile(join(folder,'axe-final-dist.json')), {code:'ENOENT'});
  } finally { await rm(folder,{recursive:true,force:true}); }
});
