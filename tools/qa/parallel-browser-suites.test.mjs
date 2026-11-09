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
import {releaseBrowserSuites, runReleaseBrowserSuites, runReleaseBrowserSuite, mergeReleaseBrowserReports} from './release-browser-reports.mjs';
const successfulReport = (name, runId) => ({
  suite:name, runId, browser:`test-${name}`, reports:[{label:name}],
  ...(name === 'carousel-desktop' ? {carouselReport:{status:'PASS', scenario:'desktop', viewports:[1487,390,320]}} : {}),
  ...(name === 'carousel-mobile' ? {carouselReport:{status:'PASS', scenario:'mobile', mobileReport:{holdPastDeadline:true}}} : {}),
  ...(name === 'remaining' ? {schemaVersion:1, buildCount:0, footerReport:{passed:true}} : {}),
  ...(name === 'common-tool' ? {commonToolReport:{passed:true}, privateCommonSiteBuilds:1} : {}),
});
const writeReportSuite = (folder, name, report, after = '') => suite(name,
  `import {writeFile} from 'node:fs/promises'; await writeFile(${JSON.stringify(join(folder,`axe-${name}-final-dist.json`))},${JSON.stringify(JSON.stringify(report))}); ${after}`);

test('four independent suites merge every report and preserve both carousel scenarios and private-build metadata', async () => {
  const folder = await mkdtemp(join(tmpdir(),'release-report-test-'));
  try {
    const timing = await runReleaseBrowserSuites({temp:folder, createSuite:(name, runId) => writeReportSuite(folder, name, successfulReport(name, runId))});
    assert.deepEqual(timing.suites.map(result => result.name), ['carousel-desktop','carousel-mobile','remaining','common-tool']);
    assert.equal(timing.buildCount, 0);
    const combined = JSON.parse(await readFile(join(folder,'axe-final-dist.json'),'utf8'));
    assert.deepEqual(combined.reports.map(report => report.label), releaseBrowserSuites);
    assert.deepEqual(Object.keys(combined.browsers), releaseBrowserSuites);
    assert.deepEqual(combined.commonToolReport, {passed:true});
    assert.deepEqual(combined.footerReport, {passed:true});
    assert.equal(combined.privateCommonSiteBuilds, 1);
    assert.equal(combined.buildCount, 0);
    const carousel = JSON.parse(await readFile(join(folder,'project-carousel-browser.json'),'utf8'));
    assert.deepEqual(carousel.viewports, [1487,390,320]);
    assert.deepEqual(carousel.mobileReport, {holdPastDeadline:true});
    assert.equal(carousel.scenario, 'all');
    assert.equal(JSON.parse(await readFile(join(folder,'release-interaction-timing.json'),'utf8')).suites.length, 4);
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

test('release merge waits for every surviving suite after failure', async () => {
  const folder = await mkdtemp(join(tmpdir(),'release-report-test-'));
  try {
    await assert.rejects(runReleaseBrowserSuites({temp:folder, createSuite:(name, runId) => {
      if (name === 'common-tool') return suite(name,'process.exit(7)');
      return writeReportSuite(folder, name, successfulReport(name, runId),
        `await new Promise(r=>setTimeout(r,100)); await writeFile(${JSON.stringify(join(folder,name+'-closed'))},'cleaned');`);
    }}), /Browser suite failure/);
    for (const name of releaseBrowserSuites.filter(name => name !== 'common-tool')) assert.equal(await readFile(join(folder,name+'-closed'),'utf8'),'cleaned');
    await assert.rejects(readFile(join(folder,'axe-final-dist.json')), {code:'ENOENT'});
  } finally { await rm(folder,{recursive:true,force:true}); }
});

test('independent suite execution cannot claim the full gate until all fresh exit receipts merge', async () => {
  const folder = await mkdtemp(join(tmpdir(),'release-independent-test-'));
  const runId = 'fresh-independent-run';
  const createSuite = (name, id) => writeReportSuite(folder, name, successfulReport(name, id));
  try {
    await runReleaseBrowserSuite({temp:folder, name:releaseBrowserSuites[0], runId, createSuite});
    await assert.rejects(readFile(join(folder,'axe-final-dist.json')), {code:'ENOENT'});
    await assert.rejects(mergeReleaseBrowserReports({temp:folder, runId}), {code:'ENOENT'});
    for (const name of releaseBrowserSuites.slice(1)) await runReleaseBrowserSuite({temp:folder, name, runId, createSuite});
    const timing = await mergeReleaseBrowserReports({temp:folder, runId});
    assert.deepEqual(timing.suites.map(result => result.name), releaseBrowserSuites);
    assert.equal(timing.elapsedMs, undefined, 'Separate jobs do not invent aggregate wall time');
    await assert.rejects(mergeReleaseBrowserReports({temp:folder, runId:'another-run'}), /Fresh browser result identity/);
    await assert.rejects(readFile(join(folder,'axe-final-dist.json')), {code:'ENOENT'});
    await assert.rejects(runReleaseBrowserSuite({temp:folder, name:'unknown', runId, createSuite}), /Known release browser suite/);
    await assert.rejects(runReleaseBrowserSuite({temp:folder, name:'remaining', runId:'', createSuite}), /Browser run identity required/);
  } finally { await rm(folder,{recursive:true,force:true}); }
});

for (const fault of ['missing-result','failed-result','nonzero-result','terminated-result','wrong-result-name','stale-result','invalid-duration','wrong-carousel-scenario','failed-carousel','missing-mobile']) {
  test(`independent merge rejects ${fault} and clears a prior aggregate`, async () => {
    const folder = await mkdtemp(join(tmpdir(),'release-independent-fault-'));
    const runId = 'fresh-fault-test';
    try {
      for (const name of releaseBrowserSuites) {
        await writeFile(join(folder,`axe-${name}-final-dist.json`), JSON.stringify(successfulReport(name, runId)));
        await writeFile(join(folder,`release-${name}-result.json`), JSON.stringify({runId,name,status:'passed',code:0,signal:null,elapsedMs:10}));
      }
      const name = 'carousel-mobile';
      const path = join(folder,`release-${name}-result.json`);
      const result = JSON.parse(await readFile(path,'utf8'));
      if (fault === 'missing-result') await rm(path);
      if (fault === 'failed-result') result.status = 'failed';
      if (fault === 'nonzero-result') result.code = 3;
      if (fault === 'terminated-result') result.signal = 'SIGTERM';
      if (fault === 'wrong-result-name') result.name = 'carousel-desktop';
      if (fault === 'stale-result') result.runId = 'previous-run';
      if (fault === 'invalid-duration') result.elapsedMs = -1;
      if (fault !== 'missing-result') await writeFile(path, JSON.stringify(result));
      const report = successfulReport(name, runId);
      if (fault === 'wrong-carousel-scenario') report.carouselReport.scenario = 'desktop';
      if (fault === 'failed-carousel') report.carouselReport.status = 'FAIL';
      if (fault === 'missing-mobile') delete report.carouselReport.mobileReport;
      await writeFile(join(folder,`axe-${name}-final-dist.json`), JSON.stringify(report));
      for (const artifact of ['axe-final-dist.json','project-carousel-browser.json','release-interaction-timing.json']) {
        await writeFile(join(folder,artifact), '{"stale":"success"}');
      }
      await assert.rejects(mergeReleaseBrowserReports({temp:folder, runId}));
      for (const artifact of ['axe-final-dist.json','project-carousel-browser.json','release-interaction-timing.json']) {
        await assert.rejects(readFile(join(folder,artifact)), {code:'ENOENT'});
      }
    } finally { await rm(folder,{recursive:true,force:true}); }
  });
}

test('a failed standalone child never leaves its previous success receipt', async () => {
  const folder = await mkdtemp(join(tmpdir(),'release-child-fault-'));
  const name = 'carousel-mobile', runId = 'new-child-run';
  try {
    await writeFile(join(folder,`release-${name}-result.json`), '{"stale":"success"}');
    await assert.rejects(runReleaseBrowserSuite({temp:folder, name, runId,
      createSuite:() => writeReportSuite(folder, name, successfulReport(name, runId), 'process.exit(3)')}));
    await assert.rejects(readFile(join(folder,`release-${name}-result.json`)), {code:'ENOENT'});
  } finally { await rm(folder,{recursive:true,force:true}); }
});

import {verifyProjectCarouselInteraction} from './project-carousel-interaction.mjs';
test('carousel rejects an unknown scenario before issuing any browser command', async () => {
  await assert.rejects(verifyProjectCarouselInteraction({scenario:'skip-mobile'}), /Known carousel scenario/);
});

test('public mode has exactly three public suites and cannot claim common Tool validation', async () => {
  const folder = await mkdtemp(join(tmpdir(),'release-public-test-'));
  try {
    const timing = await runReleaseBrowserSuites({temp:folder, mode:'public',
      createSuite:(name, runId) => writeReportSuite(folder, name, successfulReport(name, runId))});
    assert.equal(timing.mode, 'public');
    assert.deepEqual(timing.suites.map(result => result.name), ['carousel-desktop','carousel-mobile','remaining']);
    const combined = JSON.parse(await readFile(join(folder,'axe-final-dist.json'),'utf8'));
    assert.equal(combined.mode, 'public');
    assert.equal(Object.hasOwn(combined, 'commonToolReport'), false);
    assert.equal(Object.hasOwn(combined, 'privateCommonSiteBuilds'), false);
    assert.deepEqual(Object.keys(combined.browsers), ['carousel-desktop','carousel-mobile','remaining']);
    await assert.rejects(readFile(join(folder,'release-common-tool-result.json')), {code:'ENOENT'});
    await assert.rejects(mergeReleaseBrowserReports({temp:folder, runId:combined.runId}), {code:'ENOENT'}, 'A public receipt set never passes all mode');
    await assert.rejects(readFile(join(folder,'axe-final-dist.json')), {code:'ENOENT'});
  } finally { await rm(folder,{recursive:true,force:true}); }
});

for (const mode of ['carousel', 'common', '', ['carousel-desktop'], '__proto__']) {
  test(`rejects arbitrary browser mode ${JSON.stringify(mode)}`, async () => {
    await assert.rejects(runReleaseBrowserSuites({mode}), /Expected browser mode: all or public/);
    await assert.rejects(mergeReleaseBrowserReports({mode}), /Expected browser mode: all or public/);
  });
}

for (const fault of ['missing', 'stale', 'invalid', 'wrong-suite', 'missing-common-result', 'extra-private-build']) {
  test(`standalone common Tool requires a complete fresh report before its success receipt: ${fault}`, async () => {
    const folder = await mkdtemp(join(tmpdir(),'release-common-report-'));
    const name = 'common-tool', runId = 'standalone-common-run';
    try {
      await assert.rejects(runReleaseBrowserSuite({temp:folder, name, runId, createSuite:() => {
        const report = successfulReport(name, runId);
        if (fault === 'missing') return suite(name, '');
        if (fault === 'stale') report.runId = 'previous-run';
        if (fault === 'invalid') report.reports = null;
        if (fault === 'wrong-suite') report.suite = 'remaining';
        if (fault === 'missing-common-result') delete report.commonToolReport;
        if (fault === 'extra-private-build') report.privateCommonSiteBuilds = 2;
        return writeReportSuite(folder, name, report);
      }}));
      await assert.rejects(readFile(join(folder,`release-${name}-result.json`)), {code:'ENOENT'});
    } finally { await rm(folder,{recursive:true,force:true}); }
  });
}
