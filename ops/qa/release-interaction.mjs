import {isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runReleaseBrowserSuites, runReleaseBrowserSuite, mergeReleaseBrowserReports} from './release-browser-reports.mjs';

const temp = process.env.XPOTATO_RELEASE_TEMP;
if (!temp || !isAbsolute(temp)) throw new Error('XPOTATO_RELEASE_TEMP absolute path required');
const createSuite = (name, runId) => ({
  name, command:process.execPath,
  args:[fileURLToPath(new URL('./release-interaction-suite.mjs',import.meta.url)),name],
  env:{...process.env, XPOTATO_RELEASE_BROWSER_RUN:runId},
  // Chrome itself retains its 20s port/target/CDP deadline. The supervisor
  // also covers Node/server preflight and lets that failure report finish.
  startup:{timeoutMs:25000, ready:{type:'xpotato:chrome-ready',suite:name,runId}},
});
const [mode, ...extra] = process.argv.slice(2);
if (extra.length) throw new Error('Expected at most one suite name or --merge');
if (mode === '--merge') {
  const timing = await mergeReleaseBrowserReports({temp, runId:process.env.XPOTATO_RELEASE_BROWSER_RUN});
  console.log('All final-dist browser suite reports PASS: '+JSON.stringify(timing));
} else if (mode === 'public') {
  const timing = await runReleaseBrowserSuites({temp, createSuite, mode:'public'});
  console.log('Public final-dist browser suites PASS (common Tool is a separate required gate): '+JSON.stringify(timing));
} else if (mode) {
  const result = await runReleaseBrowserSuite({temp, name:mode, runId:process.env.XPOTATO_RELEASE_BROWSER_RUN, createSuite});
  console.log('Focused browser suite PASS (not the full release gate): '+JSON.stringify(result));
} else {
  const timing = await runReleaseBrowserSuites({temp, createSuite});
  console.log('All final-dist browser suites PASS: '+JSON.stringify(timing));
}
