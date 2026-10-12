// Public-only admission; provider token and private baseline are absent in this step.
import {readFile,lstat,appendFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {boundedRuntimeJson,validateRuntimeContext} from './site-monitor-runtime.mjs';
import {prepareFiniteTrialGate,fail} from './site-monitor-finite.mjs';
import {fingerprint} from './site-integrity-monitor.mjs';
import {reserveArmedMetadataAttempt,createArmedMetadataAdmission,writeArmedPermit} from './site-monitor-armed.mjs';
async function publicJson(path,max){const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink()||s.size>max)fail('ARMED_CONTEXT_UNKNOWN');return boundedRuntimeJson((await readFile(path)).toString('utf8'),max)}
async function main(){
 if(process.argv.length!==3||process.env.SITE_MONITOR_AUTHORIZATION!=='separately-approved-armed-public-admission'||process.env.GITHUB_ACTIONS!=='true'||process.env.RUNNER_DEBUG==='1'||process.env.ACTIONS_STEP_DEBUG==='true'||process.env.ACTIONS_RUNNER_DEBUG==='true')fail('ARMED_CONTEXT_UNKNOWN');
 const sourceSha=execFileSync('git',['rev-parse','HEAD'],{cwd:fileURLToPath(new URL('../../',import.meta.url)),encoding:'utf8',timeout:5000,windowsHide:true}).trim();validateRuntimeContext(process.env,'schedule',sourceSha);
 if(process.env.GITHUB_WORKFLOW_REF!=='Xpotato1024/xpotato-site/.github/workflows/site-integrity-monitor.yml@refs/heads/main'||process.env.GITHUB_WORKFLOW_SHA!==sourceSha||!/^[1-9][0-9]*$/.test(process.env.GITHUB_RUN_NUMBER??''))fail('ARMED_CONTEXT_UNKNOWN');
 const approval=await publicJson(process.argv[2],1024),audit=await publicJson(new URL('../../docs/operations/site-monitor-executor-audit.json',import.meta.url),8192),gate=boundedRuntimeJson(process.env.SITE_MONITOR_RUNTIME_GATE_JSON,4096),context={gate,audit,sourceSha,baselineSha256:approval.baselineSha256};
 const g=prepareFiniteTrialGate(context);if(g.schemaVersion!==5)fail('ARMED_CONTEXT_UNKNOWN');
 const currentRunId=process.env.GITHUB_RUN_ID,currentRunNumber=Number(process.env.GITHUB_RUN_NUMBER),temp=process.env.RUNNER_TEMP;
 if(typeof temp!=='string'||resolve(temp)!==temp||(await lstat(temp)).isSymbolicLink()||!process.env.GITHUB_OUTPUT)fail('ARMED_STORAGE_UNKNOWN');
 const directory=join(temp,'site-trial-observe',currentRunId);let reservation;
 // Number-based filesystem reservation cannot race the clock crossing T.
 if(currentRunNumber>g.registration.afterRunNumber&&currentRunNumber<=g.registration.afterRunNumber+48)reservation=await reserveArmedMetadataAttempt({...context,currentRunId,currentRunNumber,runAttempt:1,controlDirectory:directory});
 const admission=await createArmedMetadataAdmission({...context,credentialProvider:async()=>process.env.GITHUB_TOKEN,fetchImpl:fetch}).check({currentRunId,currentRunNumber,reservation});
 const lines=['status='+admission.status,'gate_sha256='+fingerprint(g)];if(admission.status==='ADMITTED')lines.push('permit_sha256='+await writeArmedPermit({directory,permit:admission.permit,gate:g}));
 await appendFile(process.env.GITHUB_OUTPUT,lines.join('\n')+'\n',{encoding:'utf8'});console.log('ARMED_'+admission.status);
}
main().catch(()=>{console.error('ARMED_ADMISSION_STOPPED_UNKNOWN; no retry or refill.');process.exitCode=1});
