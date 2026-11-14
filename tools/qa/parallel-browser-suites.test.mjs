import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runBrowserSuites, waitForOwnedGroupExit} from './parallel-browser-suites.mjs';

const suite = (name, source) => ({name, command:process.execPath, args:['--input-type=module', '-e', source], stdio:'ignore'});
const startup = name => ({timeoutMs:3000, ready:{type:'xpotato:chrome-ready', suite:name, runId:'ipc-fixture'}});
const gatedSuite = (name, source, timeoutMs = 3000) => ({...suite(name, source), startup:{...startup(name), timeoutMs}});
const readySource = name => `process.send(${JSON.stringify(startup(name).ready)},()=>process.disconnect());`;

test('four Chrome-ready IPC receipts serialize launches while all four interaction bodies overlap', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'browser-start-order-'));
  const names = ['desktop', 'mobile', 'remaining', 'tools'];
  try {
    const results = await runBrowserSuites(names.map((name, index) => gatedSuite(name, `
      import assert from 'node:assert/strict';
      import {existsSync, writeFileSync} from 'node:fs';
      import {join} from 'node:path';
      const folder=${JSON.stringify(folder)}, names=${JSON.stringify(names)}, index=${index};
      for(let n=0;n<index;n++) {
        assert.ok(existsSync(join(folder,names[n]+'-ready')), 'Predecessor must be ready before launch');
        assert.ok(!existsSync(join(folder,names[n]+'-finished')), 'Predecessor assertions must still be running');
      }
      writeFileSync(join(folder,${JSON.stringify(name+'-started')}),'started');
      await new Promise(r=>setTimeout(r,30));
      writeFileSync(join(folder,${JSON.stringify(name+'-ready')}),'ready');
      ${readySource(name)}
      const deadline=Date.now()+2000;
      while(!existsSync(join(folder,'tools-ready'))) {
        assert.ok(Date.now()<deadline,'All suites must start without waiting for prior assertions');
        await new Promise(r=>setTimeout(r,10));
      }
      writeFileSync(join(folder,${JSON.stringify(name+'-finished')}),'cleaned');
    `)));
    assert.deepEqual(results.map(result => result.status), names.map(() => 'passed'));
    assert.ok(results.every(result => result.startupMs >= 30));
    for (const name of names) assert.equal(await readFile(join(folder, name+'-finished'), 'utf8'), 'cleaned');
  } finally { await rm(folder, {recursive:true, force:true}); }
});

for (const [fault, body, expected] of [
  ['zero exit without ready', '', /without the exact|disconnected before/],
  ['early failure', 'process.exit(3)', /without the exact|disconnected before/],
  ['wrong suite', `process.send({...${JSON.stringify(startup('broken').ready)},suite:'another'});setInterval(()=>{},1000);`, /Unexpected/],
  ['wrong run', `process.send({...${JSON.stringify(startup('broken').ready)},runId:'stale'});setInterval(()=>{},1000);`, /Unexpected/],
  ['extra field', `process.send({...${JSON.stringify(startup('broken').ready)},extra:true});setInterval(()=>{},1000);`, /Unexpected/],
  ['duplicate ready', `process.send(${JSON.stringify(startup('broken').ready)});process.send(${JSON.stringify(startup('broken').ready)});setInterval(()=>{},1000);`, /Duplicate/],
  ['IPC disconnect', 'process.disconnect();setInterval(()=>{},1000);', /disconnected before/],
  ['missing ready deadline', 'setInterval(()=>{},1000);', /deadline exceeded/],
]) {
  test(`startup protocol fails closed for ${fault} and waits for a surviving sibling`, async () => {
    const folder = await mkdtemp(join(tmpdir(), 'browser-start-failure-'));
    const cleanup = join(folder, 'sibling-cleaned');
    try {
      const started = performance.now();
      await assert.rejects(runBrowserSuites([
        gatedSuite('broken', body, 250),
        gatedSuite('sibling', `${readySource('sibling')} await new Promise(r=>setTimeout(r,80)); await import('node:fs/promises').then(fs=>fs.writeFile(${JSON.stringify(cleanup)},'cleaned'));`),
      ]), error => {
        assert.match(error.message, /Browser suite failure/); assert.match(error.message, expected); return true;
      });
      assert.ok(performance.now()-started < 5000, 'A missing receipt cannot hang the run');
      assert.equal(await readFile(cleanup, 'utf8'), 'cleaned');
    } finally { await rm(folder, {recursive:true, force:true}); }
  });
}

test('gated spawn errors and synchronous launch exceptions release the next launch without claiming success', async () => {
  for (const invalid of [{command:'/does-not-exist/chrome-suite'}, {args:'not-an-array'}]) {
    await assert.rejects(runBrowserSuites([
      {...gatedSuite('broken', ''), ...invalid},
      gatedSuite('sibling', readySource('sibling')),
    ]), error => {
      assert.match(error.message, /Browser suite failure/);
      assert.match(error.message, /"name":"sibling","status":"passed"/);
      return true;
    });
  }
});

test('invalid later startup configuration is rejected before any child can start', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'browser-start-config-'));
  const marker = join(folder, 'should-not-start');
  try {
    await assert.rejects(runBrowserSuites([
      gatedSuite('first', `await import('node:fs/promises').then(fs=>fs.writeFile(${JSON.stringify(marker)},'started'));${readySource('first')}`),
      {...gatedSuite('invalid', ''), startup:{ready:startup('invalid').ready}},
    ]), /Bounded browser startup/);
    await assert.rejects(readFile(marker), {code:'ENOENT'});
  } finally { await rm(folder, {recursive:true, force:true}); }
});

async function assertProcessStopped(pid, readStatus = readFile) {
  const status = await readStatus(`/proc/${pid}/status`, 'utf8').catch(error => {
    // The process can disappear before open (ENOENT) or after open, while
    // procfs resolves the task for read (ESRCH). Neither is a live process.
    if (error.code === 'ENOENT' || error.code === 'ESRCH') return ''; throw error;
  });
  assert.ok(!status || /^State:\s+[ZX]/m.test(status), 'Owned descendant must be killed before return');
}

test('descendant status accepts only absent/dead processes, including exit during procfs read', async () => {
  for (const code of ['ENOENT', 'ESRCH']) {
    await assertProcessStopped(123, async () => { throw Object.assign(Error(code), {code}); });
  }
  for (const state of ['Z (zombie)', 'X (dead)']) await assertProcessStopped(123, async () => `Name:\tnode\nState:\t${state}\n`);
  for (const state of ['R (running)', 'S (sleeping)', 'D (disk sleep)', 'T (stopped)']) {
    await assert.rejects(assertProcessStopped(123, async () => `Name:\tnode\nState:\t${state}\n`), /must be killed before return/);
  }
  for (const code of ['EACCES', 'EIO']) {
    await assert.rejects(assertProcessStopped(123, async () => { throw Object.assign(Error(code), {code}); }), {code});
  }
});

for (const mode of ['deadline', 'early-zero-exit']) {
  test(`startup ${mode} waits for cleanup of a same-group descendant ignoring SIGTERM`, {skip:process.platform !== 'linux' ? 'Linux process-group/proc regression' : false}, async () => {
    const folder = await mkdtemp(join(tmpdir(), 'browser-start-descendant-'));
    const pidPath = join(folder, 'descendant-pid');
    let pid;
    try {
      const descendant = `import {writeFileSync} from 'node:fs'; process.on('SIGTERM',()=>{}); writeFileSync(${JSON.stringify(pidPath)},String(process.pid)); setInterval(()=>{},1000);`;
      const body = `
        import {spawn} from 'node:child_process';
        import {existsSync} from 'node:fs';
        spawn(process.execPath,['--input-type=module','-e',${JSON.stringify(descendant)}],{stdio:'ignore'});
        while(!existsSync(${JSON.stringify(pidPath)})) await new Promise(r=>setTimeout(r,5));
        ${mode === 'early-zero-exit' ? 'process.exit(0);' : 'setInterval(()=>{},1000);'}
      `;
      const started = performance.now();
      await assert.rejects(runBrowserSuites([gatedSuite('broken', body, 500)]), /Browser suite failure/);
      pid = Number(await readFile(pidPath, 'utf8'));
      assert.ok(performance.now()-started >= 1900, 'Failure must wait for the bounded forced descendant cleanup');
      assert.ok(performance.now()-started < 5000, 'Cleanup must stay bounded');
      // A killed orphan can briefly remain a zombie until the container init
      // reaps it. It must no longer be a live process when failure returns.
      await assertProcessStopped(pid);
    } finally {
      if (pid) { try { process.kill(pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } }
      await rm(folder, {recursive:true, force:true});
    }
  });
}
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
  suite:name, runId, buildCount:0, browser:`test-${name}`, reports:[{label:name}],
  ...(name === 'carousel-desktop' ? {carouselReport:{status:'PASS', scenario:'desktop', viewports:[1487,390,320]}} : {}),
  ...(name === 'carousel-mobile' ? {carouselReport:{status:'PASS', scenario:'mobile', mobileReport:{holdPastDeadline:true}}} : {}),
  ...(name === 'remaining' ? {schemaVersion:1, buildCount:0, footerReport:{passed:true}} : {}),
  ...(name === 'tools' ? {browserToolReport:{passed:true,productionBuildCount:0,fixtureHostBuildCount:1}} : {}),
  ...(name === 'common-tool' ? {commonToolReport:{passed:true}, privateCommonSiteBuilds:1} : {}),
});
const writeReportSuite = (folder, name, report, after = '') => suite(name,
  `import {writeFile} from 'node:fs/promises'; await writeFile(${JSON.stringify(join(folder,`axe-${name}-final-dist.json`))},${JSON.stringify(JSON.stringify(report))}); ${after}`);

test('five independent suites merge every report and preserve both carousel scenarios and private-build metadata', async () => {
  const folder = await mkdtemp(join(tmpdir(),'release-report-test-'));
  try {
    const timing = await runReleaseBrowserSuites({temp:folder, createSuite:(name, runId) => writeReportSuite(folder, name, successfulReport(name, runId))});
    assert.deepEqual(timing.suites.map(result => result.name), ['carousel-desktop','carousel-mobile','remaining','tools','common-tool']);
    assert.equal(timing.buildCount, 0);
    const combined = JSON.parse(await readFile(join(folder,'axe-final-dist.json'),'utf8'));
    assert.deepEqual(combined.reports.map(report => report.label), releaseBrowserSuites);
    assert.deepEqual(Object.keys(combined.browsers), releaseBrowserSuites);
    assert.deepEqual(combined.commonToolReport, {passed:true});
    assert.deepEqual(combined.footerReport, {passed:true});
    assert.deepEqual(combined.browserToolReport, {passed:true,productionBuildCount:0,fixtureHostBuildCount:1});
    assert.equal(combined.privateCommonSiteBuilds, 1);
    assert.equal(combined.buildCount, 0);
    const carousel = JSON.parse(await readFile(join(folder,'project-carousel-browser.json'),'utf8'));
    assert.deepEqual(carousel.viewports, [1487,390,320]);
    assert.deepEqual(carousel.mobileReport, {holdPastDeadline:true});
    assert.equal(carousel.scenario, 'all');
    assert.equal(JSON.parse(await readFile(join(folder,'release-interaction-timing.json'),'utf8')).suites.length, 5);
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

test('public mode has exactly four public suites and cannot claim common Tool validation', async () => {
  const folder = await mkdtemp(join(tmpdir(),'release-public-test-'));
  try {
    const timing = await runReleaseBrowserSuites({temp:folder, mode:'public',
      createSuite:(name, runId) => writeReportSuite(folder, name, successfulReport(name, runId))});
    assert.equal(timing.mode, 'public');
    assert.deepEqual(timing.suites.map(result => result.name), ['carousel-desktop','carousel-mobile','remaining','tools']);
    const combined = JSON.parse(await readFile(join(folder,'axe-final-dist.json'),'utf8'));
    assert.equal(combined.mode, 'public');
    assert.equal(combined.buildCount, 0);
    assert.deepEqual(combined.browserToolReport, {passed:true,productionBuildCount:0,fixtureHostBuildCount:1});
    assert.equal(Object.hasOwn(combined, 'commonToolReport'), false);
    assert.equal(Object.hasOwn(combined, 'privateCommonSiteBuilds'), false);
    assert.deepEqual(Object.keys(combined.browsers), ['carousel-desktop','carousel-mobile','remaining','tools']);
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

for (const mode of ['all', 'public']) {
  for (const fault of ['missing-report','stale-report','wrong-suite','missing-tool-result','missing-result','stale-result','child-failure']) {
    test(`${mode} merge requires the tools lane's own fresh report and successful exit: ${fault}`, async () => {
      const folder = await mkdtemp(join(tmpdir(),'release-tools-fault-'));
      const runId = 'fresh-tools-fault';
      try {
        for (const name of releaseBrowserSuites) {
          await writeFile(join(folder,`axe-${name}-final-dist.json`), JSON.stringify(successfulReport(name, runId)));
          await writeFile(join(folder,`release-${name}-result.json`), JSON.stringify({runId,name,status:'passed',code:0,signal:null,elapsedMs:10}));
        }
        const report = successfulReport('tools', runId);
        if (fault === 'missing-report') await rm(join(folder,'axe-tools-final-dist.json'));
        if (fault === 'stale-report') report.runId = 'previous-run';
        if (fault === 'wrong-suite') report.suite = 'remaining';
        if (fault === 'missing-tool-result') delete report.browserToolReport;
        if (fault !== 'missing-report') await writeFile(join(folder,'axe-tools-final-dist.json'), JSON.stringify(report));
        if (fault === 'missing-result') await rm(join(folder,'release-tools-result.json'));
        if (fault === 'stale-result' || fault === 'child-failure') {
          await writeFile(join(folder,'release-tools-result.json'), JSON.stringify({
            runId:fault === 'stale-result' ? 'previous-run' : runId,
            name:'tools',status:fault === 'child-failure' ? 'failed' : 'passed',
            code:fault === 'child-failure' ? 3 : 0,signal:null,elapsedMs:10,
          }));
        }
        for (const name of ['axe-final-dist.json','project-carousel-browser.json','release-interaction-timing.json']) {
          await writeFile(join(folder,name), '{"stale":"success"}');
        }
        await assert.rejects(mergeReleaseBrowserReports({temp:folder, runId, mode}));
        for (const name of ['axe-final-dist.json','project-carousel-browser.json','release-interaction-timing.json']) {
          await assert.rejects(readFile(join(folder,name)), {code:'ENOENT'});
        }
      } finally { await rm(folder,{recursive:true,force:true}); }
    });
  }
}

for (const name of releaseBrowserSuites) {
  for (const buildCount of [undefined, 1]) {
    test(`${name} cannot drop or change the zero public rebuild count: ${buildCount}`, async () => {
      const folder = await mkdtemp(join(tmpdir(),'release-build-count-'));
      try {
        await assert.rejects(runReleaseBrowserSuite({temp:folder,name,runId:'build-count-run',createSuite:(_, runId) =>
          writeReportSuite(folder,name,{...successfulReport(name,runId),buildCount})}), /Browser suite must not rebuild public dist/);
        await assert.rejects(readFile(join(folder,`release-${name}-result.json`)), {code:'ENOENT'});
      } finally { await rm(folder,{recursive:true,force:true}); }
    });
  }
}

import {setReleaseBrowserBoundaryState} from './release-browser-state.mjs';
test('split browser boundaries explicitly preserve desktop, motion, network, cache and service worker state', async () => {
  for (const boundary of ['tools-start', 'remaining-resume']) {
    const calls = [];
    await setReleaseBrowserBoundaryState(async (...args) => calls.push(args), boundary, {primeAsync:true});
    assert.deepEqual(calls, [
      ['Network.setCacheDisabled', {cacheDisabled:true}],
      ['Network.emulateNetworkConditions', {offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1}],
      ['Emulation.setEmulatedMedia', {features:[]}],
      ['Emulation.setDeviceMetricsOverride', {width:1487,height:1058,deviceScaleFactor:1,mobile:false}],
      ['Network.setBypassServiceWorker', {bypass:boundary === 'remaining-resume'}],
    ]);
  }
  const legacyCalls = [];
  await setReleaseBrowserBoundaryState(async (...args) => legacyCalls.push(args), 'remaining-resume', {primeAsync:false});
  assert.deepEqual(legacyCalls.find(([method]) => method === 'Emulation.setDeviceMetricsOverride'),
    ['Emulation.setDeviceMetricsOverride', {width:1440,height:1000,deviceScaleFactor:1,mobile:false}]);
  await assert.rejects(setReleaseBrowserBoundaryState(() => assert.fail('No command without a known Prime mode'), 'remaining-resume'), /Prime mode required/);
  await assert.rejects(setReleaseBrowserBoundaryState(() => assert.fail('No command for an unknown boundary'), 'skip-prime'), /Known release browser boundary/);
});

test('private and Prime checks run only in tools, while public interaction checks remain in remaining', async () => {
  const source = await readFile(new URL('./release-interaction-suite.mjs', import.meta.url), 'utf8');
  const toolsStart = source.indexOf("} else if (suite === 'tools') {");
  const remainingStart = source.indexOf('  const searchClearReport=', toolsStart);
  assert.ok(toolsStart >= 0 && remainingStart > toolsStart);
  const toolsBody = source.slice(toolsStart, remainingStart);
  const remainingBody = source.slice(remainingStart);
  for (const operation of ['verifyPrivateDraftInteraction','verifyContentReviewInteraction','verifyArticleVisualInteraction',
    'verifyColdPrimeGuideNavigation','verifyPrimeOfflinePresentation','verifyPrimeSiteSmoke']) {
    assert.equal(toolsBody.split(`await ${operation}(`).length-1, 1, `${operation} runs once in tools`);
    assert.ok(!remainingBody.includes(`await ${operation}(`), `${operation} was removed only from remaining`);
  }
  assert.equal(toolsBody.split('await verifyBrowserToolInteraction(').length-1, 2, 'Both fixed and generated browser Tool fixtures remain');
  assert.match(toolsBody, /verifyBrowserToolInteraction\(\{root,temp,send,evaluate,until,socket,generated:true\}\)/);
  assert.match(toolsBody, /await audit\('desktop installed tool integration'\)/);
  assert.match(toolsBody, /setReleaseBrowserBoundaryState\(send, 'tools-start'\)/);
  assert.match(remainingBody, /setReleaseBrowserBoundaryState\(send, 'remaining-resume', \{primeAsync\}\)/);
  for (const operation of ['verifySearchClearInteraction','verifySearchLayoutInteraction','verifySearchThumbnailInteraction',
    'verifyUpdateActivityInteraction','verifyFooterInteraction','verifyContactInteraction','verifyTagDiscoveryInteraction','verifyHomeWorkshopInteraction','verifyNavigationInteraction']) {
    assert.equal(remainingBody.split(`await ${operation}(`).length-1, 1, `${operation} remains mandatory`);
    assert.ok(!toolsBody.includes(`await ${operation}(`), `${operation} has one lane owner`);
  }
  assert.ok(!remainingBody.includes('browserToolReport'), 'Tool metadata has moved out of remaining');
  assert.match(toolsBody, /reports:axeReports,browserToolReport/);
  assert.match(remainingBody, /Actual clipboard|Honest copy failure/);
});

test('forced cleanup observes the async-kill transition without waiting for zombie reaping', async () => {
  let state = 'R', sleeps = 0;
  await waitForOwnedGroupExit(42, {
    platform:'linux', list:()=>['self','7'], read:()=>`7 (child ) with spaces) ${state} 1 42 0`,
    now:()=>sleeps*20, sleep:async ms => { assert.equal(ms,20); sleeps++; state = sleeps === 1 ? 'S' : 'Z'; },
  });
  assert.equal(sleeps,2, 'Must not return while the owned descendant is live');
});

test('forced cleanup distinguishes group, dead states and disappearing proc entries', async () => {
  for (const state of ['Z','X']) {
    await waitForOwnedGroupExit(42, {
      platform:'linux', list:()=>['self','7','8'], read:path => path.includes('/7/') ? `7 (child) ${state} 1 42 0` : '8 (sibling) R 1 99 0',
      sleep:async()=>assert.fail('Dead owned group must not wait for sibling or init'),
    });
  }
  for (const code of ['ENOENT','ESRCH']) {
    await waitForOwnedGroupExit(42, {
      platform:'linux', list:()=>['7'], read:()=>{ throw Object.assign(Error(code),{code}); },
      sleep:async()=>assert.fail('Absent process must not delay cleanup'),
    });
  }
});

test('forced cleanup keeps running, sleeping, blocked and stopped descendants live until the deadline', async () => {
  for (const state of ['R','S','D','T']) {
    let time = 0, sleeps = 0;
    await assert.rejects(waitForOwnedGroupExit(42, {
      platform:'linux', list:()=>['7'], read:()=>`7 (child) ${state} 1 42 0`,
      now:()=>time, sleep:async ms => { time+=ms; sleeps++; },
    }), /still live after SIGKILL deadline/);
    assert.equal(time,1000); assert.equal(sleeps,50);
  }
});

test('forced cleanup fails closed for unreadable or malformed group observations', async () => {
  for (const code of ['EACCES','EIO']) {
    for (const operation of ['list','read']) {
      await assert.rejects(waitForOwnedGroupExit(42, {
        platform:'linux', list:()=>['7'], read:()=> '7 (child) Z 1 42 0',
        [operation]:()=>{ throw Object.assign(Error(code),{code}); },
      }), {code});
    }
  }
  for (const stat of ['garbage', '7 (child) R 1 not-a-group 0']) {
    await assert.rejects(waitForOwnedGroupExit(42, {
      platform:'linux', list:()=>['7'], read:()=>stat,
    }), /Invalid process-group stat/);
  }
});

test('forced cleanup uses bounded group-disappearance observation outside Linux', async () => {
  let time = 0;
  await waitForOwnedGroupExit(42, {
    platform:'darwin', exists:()=>time<40, now:()=>time, sleep:async ms=>{ time+=ms; },
  });
  assert.equal(time,40);
  time = 0;
  await assert.rejects(waitForOwnedGroupExit(42, {
    platform:'darwin', exists:()=>true, now:()=>time, sleep:async ms=>{ time+=ms; },
  }), /still live after SIGKILL deadline/);
  assert.equal(time,1000);
});

test('host-only tools overlap public suites without replaying upstream product deadlines', async () => {
  const folder=await mkdtemp(join(tmpdir(),'host-suite-overlap-'));
  try {
   const timing=await runReleaseBrowserSuites({temp:folder,mode:'public',createSuite:(name,runId)=>writeReportSuite(folder,name,successfulReport(name,runId),
    `await new Promise(r=>setTimeout(r,100));`)});
   assert.deepEqual(timing.suites.map(x=>x.name),releaseBrowserSuites.filter(n=>n!=='common-tool'));
   const source=await readFile(new URL('./release-interaction-suite.mjs',import.meta.url),'utf8');
   assert.match(source,/from "\.\/prime-site-smoke\.mjs"/);
   assert.doesNotMatch(source,/prime-tool-interaction\.mjs|verifyPrimeToolInteraction/);
   const smoke=await readFile(new URL('./prime-site-smoke.mjs',import.meta.url),'utf8');
   assert.doesNotMatch(smoke,/waitForDebuggerOnStart|reportedFactors|finite 1-second outcome|for\(const engine/);
  } finally {await rm(folder,{recursive:true,force:true});}
});
