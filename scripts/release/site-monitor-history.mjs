import {createJsonTransport} from './deployment-http.mjs';
import {assessMonitorHistory,validateMonitorBaseline} from './site-integrity-monitor.mjs';
import {authority} from './deployment-policy.mjs';
// The deploy gate needs only GitHub Actions(read), never Cloudflare admin/write.
export function createMonitorHistoryReader({credentialProvider,fetchImpl,clock=Date.now}){
 const path=`/repos/${authority.repository}/actions/workflows/site-integrity-monitor.yml/runs`;
 let checkpointPath;
 const request=createJsonTransport({origin:'https://api.github.com',credentialProvider,fetchImpl,clock,allowRequest:r=>r.method==='GET'&&r.body===undefined&&!r.allow404&&(r.path===checkpointPath&&r.query.size===0||r.path===path&&r.query.size===3&&r.query.get('per_page')==='100'&&/^[1-9][0-9]*$/.test(r.query.get('page'))&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ\.\.\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(r.query.get('created')))});
 return async (baseline,{checkpointRunId=baseline.checkpointRunId,excludeRunId,expectedSourceSha,currentRun}={})=>{
  validateMonitorBaseline(baseline);if(typeof checkpointRunId!=='string'||!/^[1-9][0-9]*$/.test(checkpointRunId)||excludeRunId!==undefined&&(typeof excludeRunId!=='string'||!/^[1-9][0-9]*$/.test(excludeRunId)||excludeRunId===checkpointRunId)||expectedSourceSha!==undefined&&(typeof expectedSourceSha!=='string'||!/^[a-f0-9]{40}$/.test(expectedSourceSha)))throw Error('MONITOR_CHECKPOINT_MISSING');
  checkpointPath=`/repos/${authority.repository}/actions/runs/${checkpointRunId}`;
  if(excludeRunId!==undefined&&(!currentRun||currentRun.id!==excludeRunId||typeof currentRun.createdAt!=='string'||expectedSourceSha===undefined))throw Error('MONITOR_CURRENT_RUN_IDENTITY');
  const deadlineAt=clock()+120000,checkpoint=(await request({path:checkpointPath,deadlineAt})).data;
  const start=Date.parse(checkpoint?.created_at),end=Math.floor(clock()/1000)*1000;
  if(String(checkpoint?.id)!==checkpointRunId||checkpoint.repository?.full_name!==authority.repository||checkpoint.path!=='.github/workflows/site-integrity-monitor.yml'||checkpoint.head_branch!=='main'||!Number.isFinite(start)||start>end)throw Error('MONITOR_CHECKPOINT_IDENTITY');
  const runs=[],seen=new Set(),iso=t=>new Date(t).toISOString().replace('.000Z','Z');
  // GitHub caps filtered searches at 1,000 results. Read complete UTC-day
  // partitions from the reviewed checkpoint, never the repository's lifetime.
  for(let lower=Math.floor(start/1000)*1000;lower<=end;){
   const upper=Math.min(end,Math.floor(lower/86400000)*86400000+86400000-1000);let total,count=0;
   for(let page=1;page<=10;page++){
   const r=await request({path:`${path}?per_page=100&page=${page}&created=${iso(lower)}..${iso(upper)}`,deadlineAt}),raw=r.data;
   if(!raw||!Number.isSafeInteger(raw.total_count)||raw.total_count<0||!Array.isArray(raw.workflow_runs)||raw.workflow_runs.length>100)throw Error('MONITOR_HISTORY_UNKNOWN');
   if(raw.total_count>1000)throw Error('MONITOR_HISTORY_PARTITION_LIMIT');
   total??=raw.total_count;if(total!==raw.total_count)throw Error('MONITOR_HISTORY_CHANGED');
   for(const v of raw.workflow_runs){const key=String(v.id),stamp=Date.parse(v.created_at);if(seen.has(key)||!Number.isFinite(stamp)||stamp<lower||stamp>upper||v.repository?.full_name!==authority.repository||v.path!=='.github/workflows/site-integrity-monitor.yml'||expectedSourceSha!==undefined&&(v.head_sha!==expectedSourceSha||v.actor?.login!=='Xpotato1024'||v.triggering_actor?.login!=='Xpotato1024'))throw Error('MONITOR_HISTORY_IDENTITY');if(key===excludeRunId&&(v.run_attempt!==1||v.head_branch!=='main'||v.event!=='schedule'||v.status!=='in_progress'||v.conclusion!==null||v.created_at!==currentRun.createdAt))throw Error('MONITOR_CURRENT_RUN_IDENTITY');seen.add(key);count++;runs.push({id:key,runAttempt:v.run_attempt,repository:v.repository.full_name,path:v.path,headBranch:v.head_branch,event:v.event,status:v.status,conclusion:v.conclusion,createdAt:v.created_at,completedAt:v.updated_at})}
   if(count===total)break;
   if(!raw.workflow_runs.length||count>total||page===10)throw Error('MONITOR_HISTORY_UNKNOWN');
   }
   lower=upper+1000;
  }
  if(excludeRunId!==undefined&&!seen.has(excludeRunId))throw Error('MONITOR_CURRENT_RUN_MISSING');
  const retained=runs.filter(v=>v.id!==excludeRunId),evidence={baseline,runs:retained,totalCount:retained.length,observedAt:new Date(clock()).toISOString(),checkpointRunId};assessMonitorHistory(evidence,clock());return evidence;
 };
}
