import {createJsonTransport} from './deployment-http.mjs';
import {createMonitorHistoryReader} from './site-monitor-history.mjs';
import {createIntegrityMonitor,assessReadonlyCoverage,fingerprint} from './site-integrity-monitor.mjs';
import {runId,utc,prepareRuntimeGate,validateExecutorAudit} from './site-monitor-runtime.mjs';
const repo='Xpotato1024/xpotato-site',path='.github/workflows/site-integrity-monitor.yml';
const fail=()=>{throw Error('MONITOR_RUNTIME_HISTORY_BLOCKED')};
function identity(raw,id,sourceSha,event,now){
 if(!raw||String(raw.id)!==id||raw.run_attempt!==1||raw.repository?.full_name!==repo||raw.path!==path||raw.head_branch!=='main'||raw.head_sha!==sourceSha||raw.event!==event||raw.actor?.login!=='Xpotato1024'||raw.triggering_actor?.login!=='Xpotato1024'||!utc(raw.created_at)||Date.parse(raw.created_at)>now)fail();
}
function executedJob(raw,run,sourceSha,name,otherName,now){
 if(!raw||!Array.isArray(raw.jobs)||raw.total_count!==raw.jobs.length||raw.jobs.length<1||raw.jobs.length>2||new Set(raw.jobs.map(v=>v.name)).size!==raw.jobs.length||raw.jobs.some(v=>String(v.run_id)!==String(run.id)||v.head_sha!==sourceSha||v.name!==name&&(v.name!==otherName||v.status!=='completed'||v.conclusion!=='skipped')))fail();
 const job=raw.jobs.find(v=>v.name===name);
 if(!job||job.status!=='completed'||job.conclusion!=='success'||!utc(job.started_at)||!utc(job.completed_at)||Date.parse(job.started_at)<Date.parse(run.created_at)||Date.parse(job.completed_at)<Date.parse(job.started_at)||Date.parse(job.completed_at)>Date.parse(run.updated_at)||Date.parse(job.completed_at)>now)fail();
}
export function createRuntimeHistoryPreflight({credentialProvider,fetchImpl,clock=Date.now,executorAudit}){
 const reader=createMonitorHistoryReader({credentialProvider,fetchImpl,clock});
 const frozenAudit=executorAudit===undefined?undefined:structuredClone(executorAudit);
 return async ({baseline,gate,currentRunId,signal,deadlineAt:sharedDeadline})=>{
  prepareRuntimeGate({runtimeGateJson:JSON.stringify(gate),approval:{schemaVersion:1,status:'OWNER_APPROVED_BASELINE',baselineSha256:fingerprint(baseline)},sourceSha:gate.sourceSha,phase:'ACTIVE',executorAudit:frozenAudit});
  const audit=gate.schemaVersion===2?validateExecutorAudit(frozenAudit,gate.baselineSha256):undefined,checkpoints=audit?audit.records.map(v=>v.checkpoint):[gate.checkpoint],root=checkpoints[0];
  const sourceForRun=raw=>{const c=checkpoints.find(v=>v.runId===String(raw.id));if(c)return raw.created_at===c.createdAt&&raw.updated_at===c.completedAt&&raw.event===c.event?c.sourceSha:undefined;return !audit||Date.parse(raw.created_at)>=Date.parse(gate.transition.effectiveAt)?gate.sourceSha:undefined};
  if(!runId(currentRunId)||gate.checkpoint.runId===currentRunId)fail();
  const currentPath=`/repos/${repo}/actions/runs/${currentRunId}`,checkpointPaths=new Set(checkpoints.map(c=>`/repos/${repo}/actions/runs/${c.runId}`)),jobPaths=new Set([...checkpointPaths].map(p=>`${p}/attempts/1/jobs`));
  const request=createJsonTransport({origin:'https://api.github.com',credentialProvider,fetchImpl,clock,allowRequest:r=>r.method==='GET'&&r.body===undefined&&!r.allow404&&((r.path===currentPath||checkpointPaths.has(r.path))&&r.query.size===0||jobPaths.has(r.path)&&r.query.size===1&&r.query.get('per_page')==='100')});
  const deadlineAt=Math.min(clock()+120000,sharedDeadline??Infinity),get=args=>request({...args,deadlineAt,signal}),current=(await get({path:currentPath})).data;
  identity(current,currentRunId,gate.sourceSha,'schedule',clock());
  if(current.status!=='in_progress'||current.conclusion!==null||!utc(current.updated_at)||Date.parse(current.updated_at)<Date.parse(current.created_at)||Date.parse(current.updated_at)>clock()||audit&&Date.parse(current.created_at)<Date.parse(gate.transition.effectiveAt))fail();
  for(const c of checkpoints){
   const checkpointPath=`/repos/${repo}/actions/runs/${c.runId}`,checkpoint=(await get({path:checkpointPath})).data;
   identity(checkpoint,c.runId,c.sourceSha,'workflow_dispatch',clock());
   if(checkpoint.status!=='completed'||checkpoint.conclusion!=='success'||!utc(checkpoint.updated_at)||Date.parse(checkpoint.updated_at)>clock()||checkpoint.created_at!==c.createdAt||checkpoint.updated_at!==c.completedAt)fail();
   executedJob((await get({path:`${checkpointPath}/attempts/1/jobs?per_page=100`})).data,checkpoint,c.sourceSha,'bootstrap','observe',clock());
  }
  const evidence=await reader(baseline,{checkpointRunId:root.runId,excludeRunId:currentRunId,expectedSourceSha:gate.sourceSha,sourceForRun,readonlyAdmission:true,currentRun:{id:currentRunId,createdAt:current.created_at},deadlineAt,signal});
  // Same immutable executor: each successful observe job checked its immediate
  // predecessor before CF. A hidden job skip makes the next real run fail, and
  // complete raw history retains that failure. Reuse that inductive proof,
  // rather than re-fetching every historical job on every five-minute poll.
  if(evidence.runs.some(run=>!checkpoints.some(c=>c.runId===run.id)&&run.event!=='schedule'))fail();
  const latest=[...evidence.runs].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||(BigInt(a.id)<BigInt(b.id)?-1:1)).at(-1);
  if(!checkpoints.some(c=>c.runId===latest.id)){
   const priorJobsPath=`/repos/${repo}/actions/runs/${latest.id}/attempts/1/jobs`;jobPaths.add(priorJobsPath);
   const priorJobs=(await get({path:`${priorJobsPath}?per_page=100`})).data;
   executedJob(priorJobs,{id:latest.id,created_at:latest.createdAt,updated_at:latest.completedAt},gate.sourceSha,'observe','bootstrap',clock());
  }
  if(Date.parse(current.created_at)<Date.parse(latest.createdAt)||Date.parse(current.created_at)===Date.parse(latest.createdAt)&&BigInt(currentRunId)<BigInt(latest.id))fail();
  return Object.freeze({status:'MONITOR_RUNTIME_HISTORY_CONSISTENT',...assessReadonlyCoverage(evidence,{createdAt:current.created_at},clock())});
 };
}
export function createRuntimeObservation({baseline,gate,currentRunId,historyPreflight,credentialProvider,fetchImpl,clock=Date.now}){
 const monitor=createIntegrityMonitor({baseline,credentialProvider,fetchImpl,clock,maxPublicGets:3});
 const frozenBaseline=structuredClone(baseline),frozenGate=structuredClone(gate);let attempted=false;
 return Object.freeze({check:async()=>{
  if(attempted)throw Error('MONITOR_ALREADY_ATTEMPTED');attempted=true;
  const controller=new AbortController(),deadlineAt=clock()+120000;let timer;
  const check=()=>{if(controller.signal.aborted||clock()>=deadlineAt)fail()};
  try{return await Promise.race([(async()=>{
   const history=await historyPreflight({baseline:frozenBaseline,gate:frozenGate,currentRunId,signal:controller.signal,deadlineAt});check();
   if(history?.status!=='MONITOR_RUNTIME_HISTORY_CONSISTENT'||!['COVERAGE_INCIDENT_RETAINED','COVERAGE_WITHIN_BOUND'].includes(history.coverageStatus)||!Array.isArray(history.coverageChecks)||new Set(history.coverageChecks).size!==history.coverageChecks.length||history.coverageChecks.some(v=>!['OBSERVATION_GAP','OBSERVATION_DELAY'].includes(v))||(history.coverageStatus==='COVERAGE_INCIDENT_RETAINED')!==(history.coverageChecks.length>0))fail();
   const receipt=await monitor.check({signal:controller.signal,deadlineAt});check();
   return {stage:'CONTINUOUS_READONLY',...receipt,coverageStatus:history.coverageStatus,coverageChecks:history.coverageChecks};
  })(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('MONITOR_RUNTIME_HISTORY_BLOCKED'))},120000)})])}finally{clearTimeout(timer);controller.abort()}
 }});
}
