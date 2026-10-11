// Explicit opt-in: public context/gate, bounded Secret/digest, history, then CF.
import {readFile,stat,appendFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {prepareApprovedBaseline,validateRuntimeContext,boundedRuntimeJson} from './site-monitor-runtime.mjs';
import {prepareTrialGate,trialAdmission,createTrialPreflight,createTrialObservation} from './site-monitor-trial.mjs';
import {prepareFiniteTrialGate,createFiniteTrialPreflight,createFiniteTrialObservation} from './site-monitor-finite.mjs';
import {reserveFiniteReadAttempt} from './site-monitor-evidence.mjs';
const safeOutcomes=new Set(['OBSERVED_MATCH','TRIAL_EXPIRED','TRIAL_NOT_STARTED','TRIAL_ATTEMPT_BUDGET_EXHAUSTED','TRIAL_GITHUB_BUDGET_EXHAUSTED','TRIAL_DEADLINE','PROVIDER_OR_PUBLIC_INCIDENT','HISTORY_OR_APPROVAL_UNKNOWN']);
async function publishOutcome(label){if(!safeOutcomes.has(label))throw Error();if(process.env.GITHUB_ACTIONS==='true'&&typeof process.env.GITHUB_OUTPUT==='string'&&process.env.GITHUB_OUTPUT.length)await appendFile(process.env.GITHUB_OUTPUT,'status='+label+'\n',{encoding:'utf8'});}
async function main(){
 if(process.argv.length!==3||process.env.SITE_MONITOR_AUTHORIZATION!=='separately-approved-readonly-monitor')throw Error();
 validateRuntimeContext(process.env,'schedule',process.env.GITHUB_SHA);
 const info=await stat(process.argv[2]);if(!info.isFile()||info.size>1024)throw Error();
 const bytes=await readFile(process.argv[2]);if(bytes.length>1024)throw Error();
 const approval=JSON.parse(bytes.toString('utf8'));
 const checkedOutSha=execFileSync('git',['rev-parse','HEAD'],{cwd:fileURLToPath(new URL('../../',import.meta.url)),encoding:'utf8',timeout:5000,windowsHide:true}).trim();
 const gate=boundedRuntimeJson(process.env.SITE_MONITOR_RUNTIME_GATE_JSON,4096);
 if(![3,4].includes(gate?.schemaVersion)||!/^[1-9][0-9]*$/.test(process.env.GITHUB_RUN_NUMBER??''))throw Error();
 validateRuntimeContext(process.env,'schedule',checkedOutSha);
 async function publicRecord(name,max){const path=new URL('../../docs/operations/'+name,import.meta.url),info=await stat(path);if(!info.isFile()||info.size>max)throw Error();return boundedRuntimeJson((await readFile(path)).toString('utf8'),max);}
 const executorAudit=await publicRecord('site-monitor-executor-audit.json',8192),finite=gate.schemaVersion===4,recovery=finite?undefined:await publicRecord('site-monitor-closed-gate-recovery.json',32768);
 const context={gate,audit:executorAudit,sourceSha:checkedOutSha,baselineSha256:approval.baselineSha256};
 if(finite){
  if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_WORKFLOW_REF!=='Xpotato1024/xpotato-site/.github/workflows/site-integrity-monitor.yml@refs/heads/main'||process.env.GITHUB_WORKFLOW_SHA!==checkedOutSha)throw Error();
  prepareFiniteTrialGate(context);
 }else prepareTrialGate({...context,recovery});
 const currentRunNumber=Number(process.env.GITHUB_RUN_NUMBER);
 trialAdmission(gate,currentRunNumber,Date.now());
 if(finite){const temp=process.env.RUNNER_TEMP;if(typeof temp!=='string'||resolve(temp)!==temp)throw Error();await reserveFiniteReadAttempt({...context,currentRunId:process.env.GITHUB_RUN_ID,currentRunNumber,runAttempt:1,controlDirectory:join(temp,'site-trial-observe',process.env.GITHUB_RUN_ID)});}
 const baseline=prepareApprovedBaseline(process.env.SITE_MONITOR_APPROVED_BASELINE_JSON,approval);
 const historyOptions={...context,credentialProvider:async()=>process.env.GITHUB_TOKEN,fetchImpl:fetch};
 const historyPreflight=finite?createFiniteTrialPreflight(historyOptions):createTrialPreflight({...historyOptions,recovery});
 const monitorOptions={...context,baseline,currentRunId:process.env.GITHUB_RUN_ID,currentRunNumber,historyPreflight,credentialProvider:async()=>process.env.CLOUDFLARE_SITE_MONITOR_READ_TOKEN,fetchImpl:fetch};
 const monitor=finite?createFiniteTrialObservation(monitorOptions):createTrialObservation({...monitorOptions,recovery});
 const receipt=await monitor.check();console.log(JSON.stringify(receipt));
 await publishOutcome(receipt.status==='OBSERVED_MATCH'?'OBSERVED_MATCH':'PROVIDER_OR_PUBLIC_INCIDENT');
 if(receipt.status!=='OBSERVED_MATCH')process.exitCode=1;
}
main().catch(async error=>{const label=safeOutcomes.has(error?.message)?error.message:'HISTORY_OR_APPROVAL_UNKNOWN';try{await publishOutcome(label);}catch{}console.error('MONITOR_RUNTIME_BLOCKED: '+label+'; STOP deployment; no retry, checkpoint reset or automatic rebootstrap; owner review required.');process.exitCode=1});
