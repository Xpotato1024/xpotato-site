import {createJsonTransport} from './deployment-http.mjs';
import {assessMonitorHistory} from './site-integrity-monitor.mjs';
import {authority} from './deployment-policy.mjs';
// The deploy gate needs only GitHub Actions(read), never Cloudflare admin/write.
export function createMonitorHistoryReader({credentialProvider,fetchImpl,clock=Date.now}){
 const path=`/repos/${authority.repository}/actions/workflows/site-integrity-monitor.yml/runs`;
 const request=createJsonTransport({origin:'https://api.github.com',credentialProvider,fetchImpl,clock,allowRequest:r=>r.path===path&&r.method==='GET'&&r.body===undefined&&!r.allow404&&r.query.size===2&&r.query.get('per_page')==='100'&&/^[1-9][0-9]*$/.test(r.query.get('page'))});
 return async baseline=>{
  const runs=[],seen=new Set();let total;
  for(let page=1;page<=100;page++){
   const r=await request({path:`${path}?per_page=100&page=${page}`}),raw=r.data;
   if(!raw||!Number.isSafeInteger(raw.total_count)||raw.total_count<0||!Array.isArray(raw.workflow_runs)||raw.workflow_runs.length>100)throw Error('MONITOR_HISTORY_UNKNOWN');
   total??=raw.total_count;if(total!==raw.total_count)throw Error('MONITOR_HISTORY_CHANGED');
   for(const v of raw.workflow_runs){const key=String(v.id);if(seen.has(key)||v.repository?.full_name!==authority.repository||v.path!=='.github/workflows/site-integrity-monitor.yml')throw Error('MONITOR_HISTORY_IDENTITY');seen.add(key);runs.push({id:key,runAttempt:v.run_attempt,repository:v.repository.full_name,path:v.path,headBranch:v.head_branch,event:v.event,status:v.status,conclusion:v.conclusion,createdAt:v.created_at,completedAt:v.updated_at})}
   if(runs.length===total){const evidence={baseline,runs,totalCount:total,observedAt:new Date(clock()).toISOString()};assessMonitorHistory(evidence,clock());return evidence}
   if(!raw.workflow_runs.length||runs.length>total)throw Error('MONITOR_HISTORY_UNKNOWN');
  }
  throw Error('MONITOR_HISTORY_LIMIT');
 };
}
