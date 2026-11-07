import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {isAbsolute, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runBrowserSuites} from './parallel-browser-suites.mjs';

const temp = process.env.XPOTATO_RELEASE_TEMP;
if (!temp || !isAbsolute(temp)) throw new Error('XPOTATO_RELEASE_TEMP absolute path required');
await mkdir(temp,{recursive:true});
const started = performance.now();
const results = await runBrowserSuites(['carousel','remaining'].map(name=>({
  name, command:process.execPath,
  args:[fileURLToPath(new URL('./release-interaction-suite.mjs',import.meta.url)),name],
})));
// Only complete, freshly successful children can contribute to the combined
// accessibility report. Both read the same final dist; neither rebuilds it.
const carousel = JSON.parse(await readFile(join(temp,'axe-carousel-final-dist.json'),'utf8'));
const remaining = JSON.parse(await readFile(join(temp,'axe-remaining-final-dist.json'),'utf8'));
await writeFile(join(temp,'axe-final-dist.json'),JSON.stringify({
  ...remaining, reports:[...carousel.reports,...remaining.reports],
  browsers:{carousel:carousel.browser,remaining:remaining.browser},
},null,2)+'\n');
const timing = {buildCount:0, elapsedMs:performance.now()-started, suites:results};
await writeFile(join(temp,'release-interaction-timing.json'),JSON.stringify(timing,null,2)+'\n');
console.log('All final-dist browser suites PASS: '+JSON.stringify(timing));
