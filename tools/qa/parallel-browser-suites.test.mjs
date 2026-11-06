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
