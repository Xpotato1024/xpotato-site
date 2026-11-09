import {isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runReleaseBrowserSuites} from './release-browser-reports.mjs';

const temp = process.env.XPOTATO_RELEASE_TEMP;
if (!temp || !isAbsolute(temp)) throw new Error('XPOTATO_RELEASE_TEMP absolute path required');
const timing = await runReleaseBrowserSuites({temp, createSuite:(name, runId) => ({
  name, command:process.execPath,
  args:[fileURLToPath(new URL('./release-interaction-suite.mjs',import.meta.url)),name],
  env:{...process.env, XPOTATO_RELEASE_BROWSER_RUN:runId},
})});
console.log('All final-dist browser suites PASS: '+JSON.stringify(timing));
