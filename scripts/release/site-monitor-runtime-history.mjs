import {createJsonTransport} from './deployment-http.mjs';
import {createMonitorHistoryReader} from './site-monitor-history.mjs';
import {createIntegrityMonitor,assessMonitorHistory} from './site-integrity-monitor.mjs';
import {runId,utc} from './site-monitor-runtime.mjs';
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
export function createRuntimeHistoryPreflight({credentialProvider,fetchImpl,clock=Date.now}){
 const reader=createMonitorHistoryReader({credentialProvider,fetchImpl,clock});
 return async ({baseline,gate,currentRunId})=>{
  if(!runId(currentRunId)||gate.checkpoint.runId===currentRunId)fail();
  const currentPath=`/repos/${repo}/actions/runs/${currentRunId}`,checkpointPath=`/repos/${repo}/actions/runs/${gate.checkpoint.runId}`,jobsPath=`${checkpointPath}/attempts/1/jobs`,jobPaths=new Set([jobsPath]);
  const request=createJsonTransport({origin:'https://api.github.com',credentialProvider,fetchImpl,clock,allowRequest:r=>r.method==='GET'&&r.body===undefined&&!r.allow404&&((r.path===currentPath||r.path===checkpointPath)&&r.query.size===0||jobPaths.has(r.path)&&r.query.size===1&&r.query.get('per_page')==='100')});
  const deadlineAt=clock()+120000,current=(await request({path:currentPath,deadlineAt})).data;
  identity(current,currentRunId,gate.sourceSha,'schedule',clock());
  if(current.status!=='in_progress'||current.conclusion!==null||clock()-Date.parse(current.created_at)>600000)fail();
  const checkpoint=(await request({path:checkpointPath,deadlineAt})).data;
  identity(checkpoint,gate.checkpoint.runId,gate.sourceSha,'workflow_dispatch',clock());
  if(checkpoint.status!=='completed'||checkpoint.conclusion!=='success'||!utc(checkpoint.updated_at)||Date.parse(checkpoint.updated_at)>clock()||checkpoint.created_at!==gate.checkpoint.createdAt||checkpoint.updated_at!==gate.checkpoint.completedAt)fail();
  const jobs=(await request({path:`${jobsPath}?per_page=100`,deadlineAt})).data;
  executedJob(jobs,checkpoint,gate.sourceSha,'bootstrap','observe',clock());
  const evidence=await reader(baseline,{checkpointRunId:gate.checkpoint.runId,excludeRunId:currentRunId,expectedSourceSha:gate.sourceSha,currentRun:{id:currentRunId,createdAt:current.created_at}});
  assessMonitorHistory(evidence,clock());
  // Same immutable executor: each successful observe job checked its immediate
  // predecessor before CF. A hidden job skip makes the next real run fail, and
  // complete raw history retains that failure. Reuse that inductive proof,
  // rather than re-fetching every historical job on every five-minute poll.
  if(evidence.runs.some(run=>run.id!==gate.checkpoint.runId&&run.event!=='schedule'))fail();
  const latest=[...evidence.runs].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||(BigInt(a.id)<BigInt(b.id)?-1:1)).at(-1);
  if(latest.id!==gate.checkpoint.runId){
   const priorJobsPath=`/repos/${repo}/actions/runs/${latest.id}/attempts/1/jobs`;jobPaths.add(priorJobsPath);
   const priorJobs=(await request({path:`${priorJobsPath}?per_page=100`,deadlineAt})).data;
   executedJob(priorJobs,{id:latest.id,created_at:latest.createdAt,updated_at:latest.completedAt},gate.sourceSha,'observe','bootstrap',clock());
  }
  assessMonitorHistory(evidence,clock());
  if(Date.parse(current.created_at)<Date.parse(latest.createdAt)||Date.parse(current.created_at)===Date.parse(latest.createdAt)&&BigInt(currentRunId)<BigInt(latest.id)||Date.parse(current.created_at)-Date.parse(latest.createdAt)>600000)fail();
  return Object.freeze({status:'MONITOR_RUNTIME_HISTORY_CONSISTENT'});
 };
}
export function createRuntimeObservation({baseline,gate,currentRunId,historyPreflight,credentialProvider,fetchImpl,clock}){
 const monitor=createIntegrityMonitor({baseline,credentialProvider,fetchImpl,clock,maxPublicGets:3});
 const frozenBaseline=structuredClone(baseline),frozenGate=structuredClone(gate);let attempted=false;
 return Object.freeze({check:async()=>{
  if(attempted)throw Error('MONITOR_ALREADY_ATTEMPTED');attempted=true;
  const history=await historyPreflight({baseline:frozenBaseline,gate:frozenGate,currentRunId});
  if(history?.status!=='MONITOR_RUNTIME_HISTORY_CONSISTENT')fail();
  return {stage:'CONTINUOUS_READONLY',...await monitor.check()};
 }});
}
