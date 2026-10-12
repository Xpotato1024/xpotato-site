import {readFile,appendFile,lstat,open} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fingerprint} from './site-integrity-monitor.mjs';
import {boundedRuntimeJson,validateRuntimeContext} from './site-monitor-runtime.mjs';
import {prepareFiniteTrialGate,fail} from './site-monitor-finite.mjs';
import {reserveEvidenceAttempt,prepareEvidenceWait,restoreEvidenceWait,collectTrialEnvelope,writeTrialEnvelope,encodeTrialEnvelope,makeSavedReceipt} from './site-monitor-evidence.mjs';
// No ambient IO until the public authorization and context pass. Debug is denied
// because the native action has raw-response debug diagnostics on parse errors.
async function readPublic(path,max){const info=await lstat(path);if(!info.isFile()||info.size>max)fail('EVIDENCE_BODY_LIMIT');const bytes=await readFile(path);if(bytes.length>max)fail('EVIDENCE_BODY_LIMIT');return {bytes,value:boundedRuntimeJson(bytes.toString('utf8'),max)};}
async function output(lines){if(process.env.GITHUB_ACTIONS!=='true'||!process.env.GITHUB_OUTPUT)fail('EVIDENCE_CONTEXT_UNKNOWN');await appendFile(process.env.GITHUB_OUTPUT,lines.join('\n')+'\n',{encoding:'utf8'});}
async function main(){
 const mode=process.argv[2];if(process.argv.length!==3||!['prepare-wait','collect','upload-admission','saved-receipt'].includes(mode)||process.env.SITE_MONITOR_AUTHORIZATION!=='separately-approved-finite-evidence'||process.env.GITHUB_ACTIONS!=='true'||process.env.RUNNER_DEBUG==='1'||process.env.ACTIONS_STEP_DEBUG==='true'||process.env.ACTIONS_RUNNER_DEBUG==='true'||process.env.SITE_MONITOR_RUNNER_DEBUG==='1')fail('EVIDENCE_CONTEXT_UNKNOWN');
 const root=fileURLToPath(new URL('../../',import.meta.url)),sourceSha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',timeout:5000,windowsHide:true}).trim();validateRuntimeContext(process.env,'workflow_dispatch',sourceSha);
 if(process.env.GITHUB_WORKFLOW_REF!=='Xpotato1024/xpotato-site/.github/workflows/site-monitor-trial-evidence.yml@refs/heads/main'||process.env.GITHUB_WORKFLOW_SHA!==sourceSha)fail('EVIDENCE_CONTEXT_UNKNOWN');
 const gate=boundedRuntimeJson(process.env.SITE_MONITOR_RUNTIME_GATE_JSON,4096),{value:audit}=await readPublic(new URL('../../docs/operations/site-monitor-executor-audit.json',import.meta.url),8192),context={gate,audit,sourceSha,baselineSha256:gate.baselineSha256};prepareFiniteTrialGate(context);
 if(fingerprint(gate)!==process.env.SITE_MONITOR_EXPECTED_GATE_SHA256)fail('EVIDENCE_APPROVAL_UNKNOWN');
 if(gate.evidence.status!=='OWNER_APPROVED_NONSECRET_ARTIFACT_STORAGE'||Date.now()<Date.parse(gate.schemaVersion===5?gate.registration.registeredAt:gate.trial.startedAt)||Date.now()>=Date.parse(gate.evidence.expiresAt)||!/^[1-9][0-9]*$/.test(process.env.GITHUB_RUN_NUMBER??''))fail('EVIDENCE_APPROVAL_UNKNOWN');
 const currentRunId=process.env.GITHUB_RUN_ID,currentRunNumber=Number(process.env.GITHUB_RUN_NUMBER);if(currentRunNumber!==gate.evidence.afterRunNumber+1)fail('EVIDENCE_APPROVAL_UNKNOWN');
 const temp=process.env.RUNNER_TEMP;if(typeof temp!=='string'||resolve(temp)!==temp||(await lstat(temp)).isSymbolicLink())fail('EVIDENCE_STORAGE_UNKNOWN');
 const directory=join(temp,'site-trial-evidence',currentRunId),path=join(directory,'evidence.json');
 const attempt={...context,currentRunId,currentRunNumber,runAttempt:1,controlDirectory:directory};
 if(mode==='prepare-wait'){
  if(gate.schemaVersion!==5)fail('EVIDENCE_APPROVAL_UNKNOWN');
  const permit=await reserveEvidenceAttempt(attempt),ready=await prepareEvidenceWait({...attempt,permit,credentialProvider:async()=>process.env.GITHUB_TOKEN,fetchImpl:fetch,waitImpl:(ms,signal)=>new Promise((r,j)=>{const timer=setTimeout(r,ms);signal.addEventListener('abort',()=>{clearTimeout(timer);j(Error('TRIAL_DEADLINE'))},{once:true})})});
  await appendFile(process.env.GITHUB_STEP_SUMMARY,JSON.stringify(ready.receipt)+'\n',{encoding:'utf8'});await output(['status=FINITE_EVIDENCE_WAIT_STARTED','receipt_sha256='+ready.sha256]);console.log(JSON.stringify(ready.receipt));return;
 }
 if(mode==='collect'){
  const permit=gate.schemaVersion===5?await restoreEvidenceWait({...attempt,expectedSha256:process.env.SITE_MONITOR_WAIT_RECEIPT_SHA256}):await reserveEvidenceAttempt(attempt);
  const end=Date.parse(gate.trial.expiresAt),monotonicStart=performance.now();
  while(Date.now()<end){if(performance.now()-monotonicStart>=(gate.schemaVersion===5?9000000:7200000)||Date.now()+240000>=Date.parse(gate.evidence.expiresAt))fail('TRIAL_DEADLINE');await new Promise(r=>setTimeout(r,Math.min(30000,end-Date.now())))}
  const envelope=await collectTrialEnvelope({...context,currentRunId,currentRunNumber,permit,credentialProvider:async()=>process.env.GITHUB_TOKEN,fetchImpl:fetch});
  await writeTrialEnvelope({directory,envelope});await output(['status=EVIDENCE_COLLECTED']);return;
 }
 const {bytes,value:envelope}=await readPublic(path,131072),encoded=encodeTrialEnvelope(envelope);
 if(!bytes.equals(encoded.bytes)||fingerprint(envelope.gate)!==fingerprint(gate)||fingerprint(envelope.audit)!==fingerprint(audit)||envelope.collector.runId!==currentRunId||envelope.collector.runNumber!==currentRunNumber||envelope.collector.sourceSha!==sourceSha)fail('EVIDENCE_PROVENANCE_UNKNOWN');
 if(mode==='upload-admission'){
  // The pinned native action clamps retention to this platform maximum.
  if(!/^[1-9][0-9]*$/.test(process.env.GITHUB_RETENTION_DAYS??'')||Number(process.env.GITHUB_RETENTION_DAYS)<7)fail('EVIDENCE_STORAGE_UNKNOWN');
  if(Date.now()+120000>=Date.parse(gate.evidence.expiresAt))fail('TRIAL_DEADLINE');
  // Marker exists even if upload crashes; no rerun or logical upload refund.
  const handle=await open(join(directory,'upload-consumed'),'wx',0o600);try{await handle.writeFile(encoded.sha256);await handle.sync()}finally{await handle.close()}
  await output(['status=EVIDENCE_UPLOAD_APPROVED','json_sha256='+encoded.sha256]);return;
 }
 const marker=await readPublicText(join(directory,'upload-consumed'),64);if(marker!==encoded.sha256)fail('EVIDENCE_PROVENANCE_UNKNOWN');
 const receipt=makeSavedReceipt({envelope,jsonBytes:bytes,artifactId:process.env.SITE_MONITOR_ARTIFACT_ID,artifactDigest:process.env.SITE_MONITOR_ARTIFACT_DIGEST,expectedGateSha256:fingerprint(gate),expectedJsonSha256:marker,currentRunId,currentRunNumber,sourceSha});
 const handle=await open(join(directory,'receipt-consumed'),'wx',0o600);try{await handle.sync()}finally{await handle.close()}
 // Public receipt contains only allowlisted metadata, never URLs or raw errors.
 await appendFile(process.env.GITHUB_STEP_SUMMARY,JSON.stringify(receipt)+'\n',{encoding:'utf8'});await output(['status=EVIDENCE_SAVED','coverage='+receipt.trialCoverageStatus]);console.log('EVIDENCE_SAVED');
}
async function readPublicText(path,max){const info=await lstat(path);if(!info.isFile()||info.size!==max)fail('EVIDENCE_PROVENANCE_UNKNOWN');const b=await readFile(path);if(b.length!==max)fail('EVIDENCE_PROVENANCE_UNKNOWN');return b.toString('utf8')}
main().catch(()=>{console.error('EVIDENCE_STOPPED_UNKNOWN; no retry, refill, publication or incident closure.');process.exitCode=1});
