// Manual diagnostic boundary; no baseline file, scheduler or mutation API.
import {readFileSync,statSync} from 'node:fs';
import {probeMonitorConditions} from './site-monitor-conditions.mjs';
import {probeMonitorCandidate} from './site-monitor-candidate.mjs';
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
async function main(){
 if(process.argv.length!==2||process.env.SITE_MONITOR_CONDITIONS_AUTHORIZATION!=='owner-approved-readonly-monitor-conditions'||process.env.GITHUB_REPOSITORY!=='Xpotato1024/xpotato-site'||process.env.GITHUB_REF!=='refs/heads/main'||process.env.GITHUB_EVENT_NAME!=='workflow_dispatch'||process.env.GITHUB_ACTOR!=='Xpotato1024'||process.env.GITHUB_TRIGGERING_ACTOR!=='Xpotato1024')throw Error('BLOCKED');
 const path=process.env.GITHUB_EVENT_PATH,stat=statSync(path);
 if(!stat.isFile()||stat.size>1048576)throw Error('BLOCKED');
 const bytes=readFileSync(path);if(bytes.length>1048576)throw Error('BLOCKED');
 const event=JSON.parse(bytes.toString('utf8'));
 if(!record(event)||!record(event.inputs)||!['readonly-monitor-conditions','readonly-monitor-candidate'].includes(event.inputs.mode)||typeof event.inputs.expected_conditions!=='string')throw Error('BLOCKED');
 const candidateMode=event.inputs.mode==='readonly-monitor-candidate';
 // Source mismatch blocks before credential access. One approval's run budget
 // is reserved by its host ledger, not a permanent ban on approved dev reruns.
 if(typeof event.inputs.expected_source_sha!=='string'||!/^[a-f0-9]{40}$/.test(event.inputs.expected_source_sha)||event.inputs.expected_source_sha!==process.env.GITHUB_SHA)throw Error('BLOCKED');
 const expected=JSON.parse(event.inputs.expected_conditions);
 const controller=new AbortController(),abort=()=>controller.abort();
 process.once('SIGTERM',abort);process.once('SIGINT',abort);
 try{
  const dependencies={credentialProvider:async()=>process.env.CLOUDFLARE_SITE_MONITOR_READ_TOKEN,fetchImpl:fetch,signal:controller.signal};
  const receipt=candidateMode?await probeMonitorCandidate({seed:expected,source:{sourceSha:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,runAttempt:Number(process.env.GITHUB_RUN_ATTEMPT)},...dependencies}):await probeMonitorConditions({expected,...dependencies});
  console.log(JSON.stringify(receipt));
  if(receipt.status!==(candidateMode?'CANDIDATE_REVIEW_REQUIRED':'CONDITIONS_MATCH_NO_LIVE_ACCEPTANCE'))process.exitCode=1;
 }finally{process.removeListener('SIGTERM',abort);process.removeListener('SIGINT',abort)}
}
main().catch(()=>{console.error('Monitor conditions blocked; no provider changes, baseline or activation.');process.exitCode=1});
