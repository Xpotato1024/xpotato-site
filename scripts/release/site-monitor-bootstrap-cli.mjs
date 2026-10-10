// Event-file input avoids shell interpolation and never prints baseline values.
import {readFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateBootstrapContext,prepareBootstrapContext,createMonitorBootstrap} from './site-monitor-bootstrap.mjs';
async function boundedJson(path,maxBytes){const info=await stat(path);if(!info.isFile()||info.size>maxBytes)throw Error();const bytes=await readFile(path);if(bytes.length>maxBytes)throw Error();return JSON.parse(bytes.toString('utf8'))}
async function main(){
 validateBootstrapContext(process.env);
 if(process.argv.length!==3||typeof process.env.GITHUB_EVENT_PATH!=='string'||!process.env.GITHUB_EVENT_PATH)throw Error();
 const event=await boundedJson(process.env.GITHUB_EVENT_PATH,1048576),approval=await boundedJson(process.argv[2],1024);
 const checkedOutSha=execFileSync('git',['rev-parse','HEAD'],{cwd:fileURLToPath(new URL('../../',import.meta.url)),encoding:'utf8',timeout:5000,windowsHide:true}).trim();
 const context={env:process.env,event,approval,checkedOutSha,runtimeGateJson:process.env.SITE_MONITOR_RUNTIME_GATE_JSON};
 prepareBootstrapContext(context);
 const monitor=createMonitorBootstrap({...context,baselineJson:process.env.SITE_MONITOR_APPROVED_BASELINE_JSON,credentialProvider:async()=>process.env.CLOUDFLARE_SITE_MONITOR_READ_TOKEN,fetchImpl:fetch});
 const receipt=await monitor.check();console.log(JSON.stringify(receipt));
 if(receipt.status!=='OBSERVED_MATCH')process.exitCode=1;
}
main().catch(()=>{console.error('MONITOR_BOOTSTRAP_BLOCKED: no retry, no schedule, owner review required.');process.exitCode=1});
