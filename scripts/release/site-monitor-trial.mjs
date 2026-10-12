// Finite readonly admission. Raw incident history is never rewritten.
import {fingerprint,monitorTimestamp as utc,createIntegrityMonitor} from './site-integrity-monitor.mjs';
import {validateExecutorAudit,prepareRuntimeGate,runId} from './site-monitor-runtime.mjs';
import {createMonitorHistoryReader} from './site-monitor-history.mjs';
import {createJsonTransport} from './deployment-http.mjs';
const repo='Xpotato1024/xpotato-site',workflow='.github/workflows/site-integrity-monitor.yml';
const fail=label=>{throw Error(label)};
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...keys].sort().join('|');
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v),hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function prepareTrialGate({gate,recovery,audit,sourceSha,baselineSha256}){
 if(!exact(gate,['schemaVersion','status','owner','sourceSha','baselineSha256','actionsEmailConfirmed','slackConfirmed','checkpoint','transition','recoverySha256','trial'])||gate.schemaVersion!==3||gate.sourceSha!==sourceSha||gate.baselineSha256!==baselineSha256)fail('TRIAL_APPROVAL_UNKNOWN');
 const {recoverySha256,trial,...legacy}=gate;
 prepareRuntimeGate({runtimeGateJson:JSON.stringify({...legacy,schemaVersion:2}),approval:{schemaVersion:1,status:'OWNER_APPROVED_BASELINE',baselineSha256},sourceSha,phase:'ACTIVE',executorAudit:audit});
 validateExecutorAudit(audit,baselineSha256);
 if(!exact(trial,['status','startedAt','expiresAt','afterRunNumber','maxAttempts','maxGithubGetsPerAttempt'])||trial.status!=='OWNER_APPROVED_FINITE_TRIAL'||!utc(trial.startedAt)||!utc(trial.expiresAt)||Date.parse(trial.startedAt)!==Date.parse(gate.transition.effectiveAt)||Date.parse(trial.expiresAt)<=Date.parse(trial.startedAt)||Date.parse(trial.expiresAt)-Date.parse(trial.startedAt)>7200000||!Number.isSafeInteger(trial.afterRunNumber)||trial.afterRunNumber<1||trial.afterRunNumber>Number.MAX_SAFE_INTEGER-24||trial.maxAttempts!==24||trial.maxGithubGetsPerAttempt!==64)fail('TRIAL_APPROVAL_UNKNOWN');
 if(!exact(recovery,['schemaVersion','status','owner','baselineSha256','auditSha256','closedRuns'])||recovery.schemaVersion!==1||recovery.status!=='OWNER_APPROVED_CLOSED_GATE_RECOVERY'||recovery.owner!==gate.owner||recovery.baselineSha256!==baselineSha256||recovery.auditSha256!==fingerprint(audit)||!hash(recoverySha256)||fingerprint(recovery)!==recoverySha256||!Array.isArray(recovery.closedRuns)||recovery.closedRuns.length>24||new Set(recovery.closedRuns.map(r=>r.runId)).size!==recovery.closedRuns.length)fail('RECOVERY_APPROVAL_UNKNOWN');
 for(const r of recovery.closedRuns){
  const c=r.closure,stop=audit.records.find(v=>v.checkpoint.runId===c?.stoppedRecordRunId);
  if(!exact(r,['runId','runAttempt','event','sourceSha','createdAt','completedAt','classification','closure'])||!runId(r.runId)||audit.records.some(v=>v.checkpoint.runId===r.runId)||r.runAttempt!==1||r.event!=='schedule'||!sha(r.sourceSha)||!utc(r.createdAt)||!utc(r.completedAt)||Date.parse(r.completedAt)<Date.parse(r.createdAt)||r.classification!=='OWNER_ATTESTED_GATE_CLOSED_UNOBSERVED'||!exact(c,['stoppedRecordRunId','closedFrom','closedUntil','stopReceiptSha256','gateReadbackSha256','ownerDecisionSha256'])||!stop||c.closedFrom!==stop.stoppedAt||c.stopReceiptSha256!==stop.stopReceiptSha256||![c.gateReadbackSha256,c.ownerDecisionSha256].every(hash)||!utc(c.closedUntil)||Date.parse(c.closedUntil)>Date.parse(trial.startedAt)||Date.parse(r.createdAt)<Date.parse(c.closedFrom)||Date.parse(r.completedAt)>Date.parse(c.closedUntil)||Date.parse(c.closedUntil)<Date.parse(c.closedFrom)||audit.records.some(v=>Date.parse(c.closedFrom)<Date.parse(v.stoppedAt)&&Date.parse(c.closedUntil)>Date.parse(v.activeAt)))fail('RECOVERY_APPROVAL_UNKNOWN');
 }
 return structuredClone(gate);
}
// Workflow run_number is immutable and increments even for failed/skipped/manual
// runs. Reserve 64 GitHub GETs for each of 24 numbers; no refunds or remote writes.
export function trialAdmission(gate,runNumber,now){
 const t=gate.trial;
 if(!Number.isSafeInteger(runNumber)||runNumber<=t.afterRunNumber||runNumber>t.afterRunNumber+t.maxAttempts)fail('TRIAL_ATTEMPT_BUDGET_EXHAUSTED');
 if(now<Date.parse(t.startedAt))fail('TRIAL_NOT_STARTED');
 if(now>=Date.parse(t.expiresAt))fail('TRIAL_EXPIRED');
 return {ordinal:runNumber-t.afterRunNumber,deadlineAt:Math.min(now+120000,Date.parse(t.expiresAt))};
}
export function jobsProof(proof,run,name){
 if(!proof||!Array.isArray(proof.jobs)||!Number.isSafeInteger(proof.total_count)||proof.total_count!==proof.jobs.length||proof.jobs.length>2||new Set(proof.jobs.map(j=>j.name)).size!==proof.jobs.length||proof.jobs.some(j=>String(j.run_id)!==run.id||j.head_sha!==run.sourceSha||!['bootstrap','observe'].includes(j.name)||j.status!=='completed'))fail('HISTORY_JOB_UNKNOWN');
 if(name==='closed'){
  // GitHub may omit jobs when the entire workflow is skipped. Zero actual jobs
  // proves no job execution, not the gate's cause (the separate owner attestation).
  if(proof.jobs.some(j=>j.conclusion!=='skipped'))fail('HISTORY_JOB_UNKNOWN');return;
 }
 const job=proof.jobs.find(j=>j.name===name);
 if(!job||job.conclusion!=='success'||proof.jobs.some(j=>j.name!==name&&j.conclusion!=='skipped')||!utc(job.started_at)||!utc(job.completed_at)||Date.parse(job.started_at)<Date.parse(run.createdAt)||Date.parse(job.completed_at)<Date.parse(job.started_at)||Date.parse(job.completed_at)>Date.parse(run.completedAt))fail('HISTORY_JOB_UNKNOWN');
 if(name==='observe'){
  const steps=job.steps,observation=steps?.filter(s=>s.name==='Trial readonly observation'),receipt=steps?.filter(s=>s.name==='Monitor receipt OBSERVED_MATCH');
  if(!Array.isArray(steps)||observation.length!==1||receipt.length!==1||observation[0].status!=='completed'||observation[0].conclusion!=='success'||receipt[0].status!=='completed'||receipt[0].conclusion!=='success'||!Number.isSafeInteger(observation[0].number)||!Number.isSafeInteger(receipt[0].number)||receipt[0].number<=observation[0].number||!utc(observation[0].started_at)||!utc(observation[0].completed_at)||Date.parse(observation[0].started_at)<Date.parse(job.started_at)||Date.parse(observation[0].completed_at)>Date.parse(job.completed_at)||Date.parse(observation[0].completed_at)-Date.parse(observation[0].started_at)>120000)fail('OBSERVATION_RECEIPT_UNKNOWN');
 }
}
export function createTrialPreflight({audit,recovery,credentialProvider,fetchImpl,clock=Date.now}){
 const frozenAudit=structuredClone(audit),frozenRecovery=structuredClone(recovery);
 return async({baseline,gate,currentRunId,currentRunNumber,signal,deadlineAt:outerDeadline})=>{
  const g=prepareTrialGate({gate,recovery:frozenRecovery,audit:frozenAudit,sourceSha:gate.sourceSha,baselineSha256:fingerprint(baseline)}),admission=trialAdmission(g,currentRunNumber,clock());
  if(!runId(currentRunId))fail('TRIAL_RUN_IDENTITY_UNKNOWN');
  const deadlineAt=Math.min(admission.deadlineAt,outerDeadline??Infinity);let gets=0;
  const check=()=>{if(signal?.aborted||clock()>=deadlineAt)fail('TRIAL_DEADLINE');if(gets>=64)fail('TRIAL_GITHUB_BUDGET_EXHAUSTED');};
  const boundedFetch=(...args)=>{check();gets++;return fetchImpl(...args);},credential=async context=>{check();return credentialProvider(context);};
  const base=`/repos/${repo}/actions/runs/`,paths=new Set([base+currentRunId]);
  const transport=createJsonTransport({origin:'https://api.github.com',credentialProvider:credential,fetchImpl:boundedFetch,clock,allowRequest:r=>r.method==='GET'&&r.body===undefined&&!r.allow404&&paths.has(r.path)&&(r.path.endsWith('/jobs')?r.query.size===1&&r.query.get('per_page')==='100':r.query.size===0)});
  const get=async path=>{check();const response=await transport({path,signal,deadlineAt});if(clock()>=deadlineAt||signal?.aborted)fail('TRIAL_DEADLINE');return response.data;};
  const current=await get(base+currentRunId);
  if(current?.run_number!==currentRunNumber||current.run_attempt!==1||current.head_sha!==g.sourceSha||current.repository?.full_name!==repo||current.path!==workflow||current.head_branch!=='main'||current.event!=='schedule'||current.actor?.login!=='Xpotato1024'||current.triggering_actor?.login!=='Xpotato1024'||String(current.id)!==currentRunId||current.status!=='in_progress'||current.conclusion!==null||!utc(current.created_at)||!utc(current.updated_at)||Date.parse(current.created_at)<Date.parse(g.trial.startedAt)||Date.parse(current.updated_at)<Date.parse(current.created_at)||Date.parse(current.updated_at)>clock())fail('TRIAL_RUN_IDENTITY_UNKNOWN');
  const checkpoints=frozenAudit.records.map(r=>r.checkpoint),closed=frozenRecovery.closedRuns;
  const sourceForRun=raw=>{if(!Number.isSafeInteger(raw.id)||raw.id<1||String(raw.id)===currentRunId&&raw.run_number!==currentRunNumber)return undefined;const c=[...checkpoints,...closed].find(r=>r.runId===String(raw.id));if(c)return raw.created_at===c.createdAt&&raw.updated_at===c.completedAt&&raw.event===c.event?c.sourceSha:undefined;return Date.parse(raw.created_at)>=Date.parse(g.trial.startedAt)?g.sourceSha:undefined;};
  const retainedValidator=e=>{
   const numbers=new Set();
   for(const r of e.runs){
    const bootstrap=checkpoints.find(c=>c.runId===r.id),skip=closed.find(c=>c.runId===r.id);
    if(!runId(r.id)||r.runAttempt!==1||r.headBranch!=='main'||!Number.isSafeInteger(r.runNumber)||r.runNumber<1||numbers.has(r.runNumber)||r.runNumber>=currentRunNumber||r.status!=='completed'||Date.parse(r.completedAt)<Date.parse(r.createdAt)||Date.parse(r.completedAt)>clock()||bootstrap&&r.conclusion!=='success')fail('HISTORY_IDENTITY_UNKNOWN');
    numbers.add(r.runNumber);
    if(bootstrap){if(r.event!=='workflow_dispatch'||r.runNumber>g.trial.afterRunNumber)fail('HISTORY_IDENTITY_UNKNOWN');}
    else if(skip){if(r.event!=='schedule'||r.conclusion!=='skipped'||r.runNumber>g.trial.afterRunNumber)fail('HISTORY_INCIDENT_UNCLASSIFIED');}
    else if(r.event!=='schedule'||r.conclusion!=='success'||r.sourceSha!==g.sourceSha||r.runNumber<=g.trial.afterRunNumber||Date.parse(r.createdAt)<Date.parse(g.trial.startedAt)||Date.parse(r.completedAt)>=Date.parse(g.trial.expiresAt))fail('HISTORY_INCIDENT_UNCLASSIFIED');
   }
   if(checkpoints.some(c=>!e.runs.some(r=>r.id===c.runId))||closed.some(c=>!e.runs.some(r=>r.id===c.runId)))fail('HISTORY_INCOMPLETE');
  };
  const reader=createMonitorHistoryReader({credentialProvider:credential,fetchImpl:boundedFetch,clock});
  let evidence;
  try{evidence=await reader(baseline,{checkpointRunId:checkpoints[0].runId,excludeRunId:currentRunId,expectedSourceSha:g.sourceSha,currentRun:{id:currentRunId,createdAt:current.created_at},readonlyAdmission:true,sourceForRun,retainedValidator,signal,deadlineAt});}catch(error){check();throw error;}
  for(const r of evidence.runs){const p=base+r.id+'/attempts/1/jobs';paths.add(p);jobsProof(await get(p+'?per_page=100'),r,checkpoints.some(c=>c.runId===r.id)?'bootstrap':closed.some(c=>c.runId===r.id)?'closed':'observe');}
  const ordered=[...evidence.runs].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.runNumber-b.runNumber),latest=ordered.at(-1),checks=new Set();
  if(Date.parse(current.created_at)<Date.parse(latest.createdAt))fail('TRIAL_RUN_IDENTITY_UNKNOWN');
  for(let i=0;i<ordered.length;i++){const r=ordered[i];if(Date.parse(r.completedAt)-Date.parse(r.createdAt)>600000)checks.add('OBSERVATION_DELAY');if(i&&(Date.parse(r.createdAt)-Date.parse(ordered[i-1].createdAt)>600000||Date.parse(r.completedAt)-Date.parse(ordered[i-1].completedAt)>600000))checks.add('OBSERVATION_GAP');}
  if(Date.parse(current.created_at)-Date.parse(latest.createdAt)>600000||clock()-Date.parse(latest.completedAt)>600000)checks.add('OBSERVATION_GAP');
  if(clock()-Date.parse(current.created_at)>600000)checks.add('OBSERVATION_DELAY');
  if(closed.length)checks.add('OWNER_ATTESTED_GATE_CLOSED_UNOBSERVED');
  return {status:'TRIAL_HISTORY_CONSISTENT',coverageStatus:checks.size?'COVERAGE_INCIDENT_RETAINED':'COVERAGE_WITHIN_BOUND',coverageChecks:[...checks].sort(),retainedClosedRuns:closed.length,trialOrdinal:admission.ordinal,githubGets:gets};
 };
}
export function createTrialObservation({baseline,gate,audit,recovery,currentRunId,currentRunNumber,historyPreflight,credentialProvider,fetchImpl,clock=Date.now}){
 const g=prepareTrialGate({gate,recovery,audit,sourceSha:gate.sourceSha,baselineSha256:fingerprint(baseline)}),b=structuredClone(baseline);let attempted=false;
 return Object.freeze({check:async()=>{
  if(attempted)fail('TRIAL_ALREADY_ATTEMPTED');attempted=true;
  const {deadlineAt}=trialAdmission(g,currentRunNumber,clock()),controller=new AbortController();let timer;
  try{return await Promise.race([(async()=>{
   const history=await historyPreflight({baseline:b,gate:g,currentRunId,currentRunNumber,signal:controller.signal,deadlineAt});
   if(controller.signal.aborted||clock()>=deadlineAt)fail('TRIAL_DEADLINE');
   const labels=['OBSERVATION_GAP','OBSERVATION_DELAY','OWNER_ATTESTED_GATE_CLOSED_UNOBSERVED'];
   if(!exact(history,['status','coverageStatus','coverageChecks','retainedClosedRuns','trialOrdinal','githubGets'])||history.status!=='TRIAL_HISTORY_CONSISTENT'||!['COVERAGE_INCIDENT_RETAINED','COVERAGE_WITHIN_BOUND'].includes(history.coverageStatus)||!Array.isArray(history.coverageChecks)||new Set(history.coverageChecks).size!==history.coverageChecks.length||history.coverageChecks.some(v=>!labels.includes(v))||(history.coverageStatus==='COVERAGE_INCIDENT_RETAINED')!==(history.coverageChecks.length>0)||history.retainedClosedRuns!==recovery.closedRuns.length||history.trialOrdinal!==currentRunNumber-g.trial.afterRunNumber||!Number.isSafeInteger(history.githubGets)||history.githubGets<1||history.githubGets>64)fail('TRIAL_HISTORY_UNKNOWN');
   const receipt=await createIntegrityMonitor({baseline:b,credentialProvider,fetchImpl,clock,maxPublicGets:3}).check({signal:controller.signal,deadlineAt});
   if(controller.signal.aborted||clock()>=deadlineAt)fail('TRIAL_DEADLINE');
   return {stage:'FINITE_READONLY_TRIAL',...receipt,coverageStatus:history.coverageStatus,coverageChecks:history.coverageChecks,trialOrdinal:history.trialOrdinal,githubGets:history.githubGets,retainedClosedRuns:history.retainedClosedRuns};
  })(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('TRIAL_DEADLINE'));},Math.max(0,deadlineAt-clock()));})]);}finally{clearTimeout(timer);controller.abort();}
 }});
}
