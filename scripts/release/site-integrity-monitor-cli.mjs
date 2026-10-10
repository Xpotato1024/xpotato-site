// Explicit opt-in: public context/gate, bounded Secret/digest, history, then CF.
import {readFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {prepareObservationContext,prepareApprovedBaseline,validateRuntimeContext} from './site-monitor-runtime.mjs';
import {createRuntimeHistoryPreflight,createRuntimeObservation} from './site-monitor-runtime-history.mjs';
async function main(){
 if(process.argv.length!==3||process.env.SITE_MONITOR_AUTHORIZATION!=='separately-approved-readonly-monitor')throw Error();
 validateRuntimeContext(process.env,'schedule',process.env.GITHUB_SHA);
 const info=await stat(process.argv[2]);if(!info.isFile()||info.size>1024)throw Error();
 const bytes=await readFile(process.argv[2]);if(bytes.length>1024)throw Error();
 const approval=JSON.parse(bytes.toString('utf8'));
 const checkedOutSha=execFileSync('git',['rev-parse','HEAD'],{cwd:fileURLToPath(new URL('../../',import.meta.url)),encoding:'utf8',timeout:5000,windowsHide:true}).trim();
 const gate=prepareObservationContext({env:process.env,approval,checkedOutSha,runtimeGateJson:process.env.SITE_MONITOR_RUNTIME_GATE_JSON});
 const baseline=prepareApprovedBaseline(process.env.SITE_MONITOR_APPROVED_BASELINE_JSON,approval);
 const historyPreflight=createRuntimeHistoryPreflight({credentialProvider:async()=>process.env.GITHUB_TOKEN,fetchImpl:fetch});
 const monitor=createRuntimeObservation({baseline,gate,currentRunId:process.env.GITHUB_RUN_ID,historyPreflight,credentialProvider:async()=>process.env.CLOUDFLARE_SITE_MONITOR_READ_TOKEN,fetchImpl:fetch});
 const receipt=await monitor.check();console.log(JSON.stringify(receipt));
 if(receipt.status!=='OBSERVED_MATCH')process.exitCode=1;
}
main().catch(()=>{console.error('MONITOR_RUNTIME_BLOCKED: STOP deployment; no retry, checkpoint reset or automatic rebootstrap; owner review required.');process.exitCode=1});
