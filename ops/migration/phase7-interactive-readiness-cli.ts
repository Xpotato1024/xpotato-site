import {readRegisteredToolRoutes} from '../../packages/site-validators/src/browser-tools/tool-runtime-policy.js';
import {checkInstalledToolsReadiness} from '../../packages/site-validators/src/browser-tools/installed-tools-readiness.js';
import {fileURLToPath} from 'node:url';
const mode=process.argv[2]??'--check',tools=await readRegisteredToolRoutes();
if(tools.length){
 if(mode!=='--check')throw Error('Frozen legacy readiness is not rewritten for installed releases');
 console.log('Installed Tool readiness PASS',JSON.stringify(await checkInstalledToolsReadiness(fileURLToPath(new URL('../../',import.meta.url)))));
}else{
 const {checkPhase7InteractiveReadiness}=await import('../../packages/site-validators/src/migration/phase7-interactive-readiness.js');
 const {writePhase7InteractiveReadiness}=await import('./writers.js');
 if(!['--check','--write'].includes(mode))throw Error('Unknown readiness mode');
 console.log('Legacy Phase 7 readiness PASS',JSON.stringify(mode==='--write'?await writePhase7InteractiveReadiness():await checkPhase7InteractiveReadiness()));
}
