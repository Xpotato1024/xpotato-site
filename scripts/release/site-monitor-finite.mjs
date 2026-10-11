// Finite read authority never resolves a historical incident or opens deploy.
import {fingerprint,monitorTimestamp as utc,createIntegrityMonitor} from './site-integrity-monitor.mjs';
import {prepareRuntimeGate,runId} from './site-monitor-runtime.mjs';
import {trialAdmission,jobsProof} from './site-monitor-trial.mjs';
import {createPublicWorkflowHistoryReader} from './site-monitor-history.mjs';
import {createJsonTransport} from './deployment-http.mjs';
export const evidenceWorkflow='.github/workflows/site-monitor-trial-evidence.yml';
export const uploadActionSha='ea165f8d65b6e75b540449e92b4886f43607fa02';
const repo='Xpotato1024/xpotato-site',workflow='.github/workflows/site-integrity-monitor.yml';
export const fail=label=>{throw Error(label)};
export const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...keys].sort().join('|');
export const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
export const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const number=v=>Number.isSafeInteger(v)&&v>0;
const conclusions=['success','failure','skipped','cancelled','timed_out','action_required','neutral','stale','startup_failure'];
export function prepareFiniteTrialGate({gate,audit,sourceSha,baselineSha256}){
 if(!exact(gate,['schemaVersion','status','owner','sourceSha','baselineSha256','actionsEmailConfirmed','slackConfirmed','checkpoint','transition','trial','readApproval','evidence'])||gate.schemaVersion!==4||gate.sourceSha!==sourceSha||gate.baselineSha256!==baselineSha256)fail('TRIAL_APPROVAL_UNKNOWN');
 const {trial,readApproval,evidence,...legacy}=gate;
 prepareRuntimeGate({runtimeGateJson:JSON.stringify({...legacy,schemaVersion:2}),approval:{schemaVersion:1,status:'OWNER_APPROVED_BASELINE',baselineSha256},sourceSha,phase:'ACTIVE',executorAudit:audit});
 if(!exact(trial,['status','startedAt','expiresAt','afterRunNumber','maxAttempts','maxGithubGetsPerAttempt'])||trial.status!=='OWNER_APPROVED_FINITE_TRIAL'||!utc(trial.startedAt)||!utc(trial.expiresAt)||trial.startedAt!==gate.transition.effectiveAt||Date.parse(trial.expiresAt)<=Date.parse(trial.startedAt)||Date.parse(trial.expiresAt)-Date.parse(trial.startedAt)>7200000||!number(trial.afterRunNumber)||trial.afterRunNumber>Number.MAX_SAFE_INTEGER-24||trial.maxAttempts!==24||trial.maxGithubGetsPerAttempt!==64)fail('TRIAL_APPROVAL_UNKNOWN');
 if(!exact(readApproval,['status','ownerDecisionSha256','historicalIncidentRetained','deployAllowed','sitePublicationAllowed','acceptance'])||readApproval.status!=='OWNER_APPROVED_FINITE_READ_WITH_RETAINED_INCIDENTS'||!hash(readApproval.ownerDecisionSha256)||readApproval.historicalIncidentRetained!==true||readApproval.deployAllowed!==false||readApproval.sitePublicationAllowed!==false||readApproval.acceptance!==false)fail('TRIAL_APPROVAL_UNKNOWN');
 if(!exact(evidence,['status','workflow','afterRunNumber','notBefore','expiresAt','maxAttempts','maxGithubGets','maxJsonBytes','retentionDays','overwrite','maxLogicalUploads','uploadTimeoutSeconds','artifactVisibility','uploadActionSha','retryPolicy','storageDeadlinePolicy'])||!['PROPOSED','OWNER_APPROVED_NONSECRET_ARTIFACT_STORAGE'].includes(evidence.status)||evidence.workflow!==evidenceWorkflow||!number(evidence.afterRunNumber)||evidence.afterRunNumber===Number.MAX_SAFE_INTEGER||evidence.notBefore!==trial.expiresAt||!utc(evidence.expiresAt)||Date.parse(evidence.expiresAt)<=Date.parse(evidence.notBefore)+240000||Date.parse(evidence.expiresAt)>Date.parse(evidence.notBefore)+3600000||evidence.maxAttempts!==1||evidence.maxGithubGets!==64||evidence.maxJsonBytes!==131072||evidence.retentionDays!==7||evidence.overwrite!==false||evidence.maxLogicalUploads!==1||evidence.uploadTimeoutSeconds!==120||evidence.artifactVisibility!=='PUBLIC_REPOSITORY_READERS'||evidence.uploadActionSha!==uploadActionSha||evidence.retryPolicy!=='PINNED_ACTION_FINITE_RETRIES'||evidence.storageDeadlinePolicy!=='ADMISSION_AND_RECEIPT_DEADLINE_PLATFORM_UPLOAD_TIMEOUT')fail('EVIDENCE_APPROVAL_UNKNOWN');
 return structuredClone(gate);
}
function normalizedProof(raw,name){
 const j=raw.jobs.find(v=>v.name===name),s=j.steps?.find(v=>v.name==='Trial readonly observation'),receipt=j.steps?.find(v=>v.name==='Monitor receipt OBSERVED_MATCH');
 return {kind:name==='bootstrap'?'BOOTSTRAP_CONFIRMED':'OBSERVED_MATCH',jobStartedAt:j.started_at,jobCompletedAt:j.completed_at,observationStartedAt:s?.started_at??null,observationCompletedAt:s?.completed_at??null,observationStepNumber:s?.number??null,receiptStepNumber:receipt?.number??null};
}
export function createFiniteHistoryReader({gate,audit,sourceSha,baselineSha256,credentialProvider,fetchImpl,clock=Date.now}){
 const g=prepareFiniteTrialGate({gate,audit,sourceSha,baselineSha256}),a=structuredClone(audit);let attempted=false,gets=0;
 const read=async({currentRunId,currentRunNumber,collector=false,signal,deadlineAt:outerDeadline}={})=>{
  if(attempted)fail('TRIAL_ALREADY_ATTEMPTED');attempted=true;
  const admission=collector?{deadlineAt:Math.min(clock()+120000,Date.parse(g.evidence.expiresAt)-120000)}:trialAdmission(g,currentRunNumber,clock());
  if(!runId(currentRunId)||!number(currentRunNumber))fail('TRIAL_RUN_IDENTITY_UNKNOWN');
  if(collector&&(g.evidence.status!=='OWNER_APPROVED_NONSECRET_ARTIFACT_STORAGE'||currentRunNumber!==g.evidence.afterRunNumber+1||clock()<Date.parse(g.trial.expiresAt)||clock()+240000>=Date.parse(g.evidence.expiresAt)))fail('EVIDENCE_APPROVAL_UNKNOWN');
  const deadlineAt=Math.min(admission.deadlineAt,outerDeadline??Infinity);
  const check=()=>{if(signal?.aborted||clock()>=deadlineAt)fail('TRIAL_DEADLINE');if(gets>=64)fail('TRIAL_GITHUB_BUDGET_EXHAUSTED');};
  const wrappedFetch=(...args)=>{check();gets++;return fetchImpl(...args);},credential=async context=>{check();return credentialProvider(context)};
  const base=`/repos/${repo}/actions/runs/`,paths=new Set([base+currentRunId]);
  const transport=createJsonTransport({origin:'https://api.github.com',credentialProvider:credential,fetchImpl:wrappedFetch,clock,allowRequest:r=>r.method==='GET'&&r.body===undefined&&!r.allow404&&paths.has(r.path)&&(r.path.endsWith('/jobs')?r.query.size===1&&r.query.get('per_page')==='100':r.query.size===0)});
  const get=async p=>{check();const r=await transport({path:p,signal,deadlineAt});if(clock()>=deadlineAt||signal?.aborted)fail('TRIAL_DEADLINE');return r.data;};
  const current=await get(base+currentRunId);
  if(String(current?.id)!==currentRunId||current.run_number!==currentRunNumber||current.run_attempt!==1||current.repository?.full_name!==repo||current.path!==(collector?evidenceWorkflow:workflow)||current.head_branch!=='main'||current.head_sha!==g.sourceSha||current.event!==(collector?'workflow_dispatch':'schedule')||current.actor?.login!==g.owner||current.triggering_actor?.login!==g.owner||current.status!=='in_progress'||current.conclusion!==null||!utc(current.created_at)||!utc(current.updated_at)||Date.parse(current.created_at)<Date.parse(g.trial.startedAt)||Date.parse(current.created_at)>clock()||Date.parse(current.updated_at)<Date.parse(current.created_at)||Date.parse(current.updated_at)>clock())fail('TRIAL_RUN_IDENTITY_UNKNOWN');
  const checkpoints=a.records.map(v=>v.checkpoint),sourceForRun=raw=>{
   const c=checkpoints.find(v=>v.runId===String(raw.id));
   if(c)return raw.created_at===c.createdAt&&raw.updated_at===c.completedAt&&raw.event===c.event?c.sourceSha:undefined;
   if(Date.parse(raw.created_at)<Date.parse(g.trial.startedAt)&&raw.run_number<=g.trial.afterRunNumber)return sha(raw.head_sha)?raw.head_sha:undefined;
   return g.sourceSha;
  };
  const reader=createPublicWorkflowHistoryReader({credentialProvider:credential,fetchImpl:wrappedFetch,clock});
  const history=await reader({checkpointRunId:checkpoints[0].runId,expectedSourceSha:g.sourceSha,readonlyAdmission:true,retainedValidator:()=>{},sourceForRun,...(collector?{throughAt:g.trial.expiresAt}:{excludeRunId:currentRunId,currentRun:{id:currentRunId,createdAt:current.created_at}}),signal,deadlineAt});
  const rows=[],numbers=new Set();let retained=0,trialIncident=false;
  for(const r of history.runs){
   if(!runId(r.id)||r.runAttempt!==1||r.headBranch!=='main'||!number(r.runNumber)||numbers.has(r.runNumber)||r.status!=='completed'||!conclusions.includes(r.conclusion)||Date.parse(r.completedAt)<Date.parse(r.createdAt)||Date.parse(r.completedAt)>clock())fail('HISTORY_IDENTITY_UNKNOWN');
   numbers.add(r.runNumber);const c=checkpoints.find(v=>v.runId===r.id),pre=Date.parse(r.createdAt)<Date.parse(g.trial.startedAt);let classification,proof=null;
   if(c){if(r.event!=='workflow_dispatch'||r.conclusion!=='success'||r.runNumber>g.trial.afterRunNumber)fail('HISTORY_IDENTITY_UNKNOWN');classification='BOOTSTRAP_CHECKPOINT';}
   else if(pre){if(r.runNumber>g.trial.afterRunNumber||Date.parse(r.completedAt)>=Date.parse(g.trial.startedAt)||!['schedule','workflow_dispatch'].includes(r.event))fail('HISTORY_IDENTITY_UNKNOWN');classification='UNRESOLVED_PRETRIAL_INCIDENT_RETAINED';retained++;}
   else if(collector&&Date.parse(r.createdAt)===Date.parse(g.trial.expiresAt)){classification='CUTOFF_BOUNDARY_EXCLUDED';}
   else{
    if(r.runNumber<=g.trial.afterRunNumber||r.runNumber>g.trial.afterRunNumber+24||r.event!=='schedule'||r.sourceSha!==g.sourceSha||!collector&&r.runNumber>=currentRunNumber||Date.parse(r.createdAt)>=Date.parse(g.trial.expiresAt))fail('HISTORY_IDENTITY_UNKNOWN');
    const incident=r.conclusion!=='success'||Date.parse(r.completedAt)>=Date.parse(g.trial.expiresAt);
    if(incident&&!collector)fail('HISTORY_INCIDENT_UNCLASSIFIED');
    trialIncident||=incident;classification=incident?'TRIAL_INCIDENT_RETAINED':'TRIAL_OBSERVED_MATCH';
   }
   let jobSummary=null;
   if(collector||c||classification==='TRIAL_OBSERVED_MATCH'){
    const p=base+r.id+'/attempts/1/jobs';paths.add(p);const j=await get(p+'?per_page=100');
    if(!j||!Array.isArray(j.jobs)||!Number.isSafeInteger(j.total_count)||j.total_count!==j.jobs.length||j.jobs.length>2||new Set(j.jobs.map(v=>v.name)).size!==j.jobs.length||j.jobs.some(v=>String(v.run_id)!==r.id||v.head_sha!==r.sourceSha||!['bootstrap','observe'].includes(v.name)||v.status!=='completed'||!conclusions.includes(v.conclusion)))fail('HISTORY_JOB_UNKNOWN');
    jobSummary=j.jobs.map(v=>({name:v.name,status:v.status,conclusion:v.conclusion}));
    if(c||classification==='TRIAL_OBSERVED_MATCH'){jobsProof(j,r,c?'bootstrap':'observe');proof=normalizedProof(j,c?'bootstrap':'observe');}
   }
   rows.push({id:r.id,runNumber:r.runNumber,runAttempt:r.runAttempt,sourceSha:r.sourceSha,event:r.event,status:r.status,conclusion:r.conclusion,createdAt:r.createdAt,completedAt:r.completedAt,classification,proof,jobSummary});
  }
  if(checkpoints.some(c=>!rows.some(r=>r.id===c.runId))||!numbers.has(g.trial.afterRunNumber))fail('HISTORY_INCOMPLETE');
  const sorted=[...rows].sort((x,y)=>x.runNumber-y.runNumber);for(let i=1;i<sorted.length;i++)if(sorted[i].runNumber!==sorted[i-1].runNumber+1)fail('HISTORY_INCOMPLETE');
  if(!collector&&currentRunNumber!==sorted.at(-1).runNumber+1)fail('HISTORY_INCOMPLETE');
  if(clock()>=deadlineAt||signal?.aborted)fail('TRIAL_DEADLINE');return {runs:rows,retainedHistoricalRuns:retained,trialIncident,githubGets:gets,...(collector?{history:{fromAt:checkpoints[0].createdAt,throughAt:g.trial.expiresAt,totalCount:history.totalCount,partitions:history.partitions}}:{})};
 };
 return Object.freeze({read,gets:()=>gets});
}
export function createFiniteTrialPreflight(options){
 const g=prepareFiniteTrialGate(options),reader=createFiniteHistoryReader({...options,gate:g});
 return async({baseline,currentRunId,currentRunNumber,signal,deadlineAt}={})=>{
  if(fingerprint(baseline)!==g.baselineSha256)fail('TRIAL_APPROVAL_UNKNOWN');
  return reader.read({currentRunId,currentRunNumber,signal,deadlineAt});
 };
}
export function createFiniteTrialObservation({baseline,gate,audit,sourceSha,baselineSha256,currentRunId,currentRunNumber,historyPreflight,credentialProvider,fetchImpl,clock=Date.now}){
 const g=prepareFiniteTrialGate({gate,audit,sourceSha,baselineSha256});if(fingerprint(baseline)!==g.baselineSha256)fail('TRIAL_APPROVAL_UNKNOWN');const b=structuredClone(baseline);let attempted=false;
 return Object.freeze({check:async()=>{
  if(attempted)fail('TRIAL_ALREADY_ATTEMPTED');attempted=true;const {ordinal,deadlineAt}=trialAdmission(g,currentRunNumber,clock()),controller=new AbortController();let timer;
  try{return await Promise.race([(async()=>{
   const h=await historyPreflight({baseline:b,currentRunId,currentRunNumber,signal:controller.signal,deadlineAt});
   if(!exact(h,['runs','retainedHistoricalRuns','trialIncident','githubGets'])||h.trialIncident!==false||!Array.isArray(h.runs)||!Number.isSafeInteger(h.retainedHistoricalRuns)||h.retainedHistoricalRuns<0||!number(h.githubGets)||h.githubGets>64)fail('TRIAL_HISTORY_UNKNOWN');
   if(controller.signal.aborted||clock()>=deadlineAt)fail('TRIAL_DEADLINE');
   const receipt=await createIntegrityMonitor({baseline:b,credentialProvider,fetchImpl,clock,maxPublicGets:3}).check({signal:controller.signal,deadlineAt});
   if(controller.signal.aborted||clock()>=deadlineAt)fail('TRIAL_DEADLINE');
   return {stage:'FINITE_READONLY_TRIAL',...receipt,historicalIncidentRetained:true,coverageStatus:'COVERAGE_INCIDENT_RETAINED',trialOrdinal:ordinal,githubGets:h.githubGets,retainedHistoricalRuns:h.retainedHistoricalRuns};
  })(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('TRIAL_DEADLINE'))},Math.max(0,deadlineAt-clock()))})]);}finally{clearTimeout(timer);controller.abort()}
 }});
}
