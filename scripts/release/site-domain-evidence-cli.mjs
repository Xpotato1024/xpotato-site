// Approved runner boundary; dispatch identifiers never enter step env or logs.
import {readFileSync,statSync} from 'node:fs';
import {probeDomainEvidence} from './site-domain-evidence.mjs';
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
async function main(){
 if(process.argv.length!==2||process.env.SITE_DOMAIN_EVIDENCE_AUTHORIZATION!=='owner-approved-three-get-domain-evidence'||process.env.PROBE_MODE!=='readonly-domain-evidence'||process.env.GITHUB_REPOSITORY!=='Xpotato1024/xpotato-site'||process.env.GITHUB_REF!=='refs/heads/main'||process.env.GITHUB_EVENT_NAME!=='workflow_dispatch'||process.env.GITHUB_ACTOR!=='Xpotato1024'||process.env.GITHUB_TRIGGERING_ACTOR!=='Xpotato1024'||process.env.GITHUB_RUN_NUMBER!=='7'||process.env.GITHUB_RUN_ATTEMPT!=='1')throw Error('BLOCKED');
 const eventPath=process.env.GITHUB_EVENT_PATH;
 if(typeof eventPath!=='string'||!eventPath)throw Error('BLOCKED');
 const stat=statSync(eventPath);
 if(!stat.isFile()||stat.size>1048576)throw Error('BLOCKED');
 const bytes=readFileSync(eventPath);
 if(bytes.length>1048576)throw Error('BLOCKED');
 const event=JSON.parse(bytes.toString('utf8'));
 if(!record(event)||!record(event.inputs)||event.inputs.mode!=='readonly-domain-evidence')throw Error('BLOCKED');
 const inputs=event.inputs;
 const controller=new AbortController(),abort=()=>controller.abort();
 process.once('SIGTERM',abort);process.once('SIGINT',abort);
 try {
  const receipt=await probeDomainEvidence({accountId:inputs.account_id,expectedCredentialId:inputs.expected_credential_id,expectedWorkerTag:inputs.expected_worker_tag,credentialProvider:async()=>process.env.CLOUDFLARE_SITE_MONITOR_READ_TOKEN,fetchImpl:fetch,signal:controller.signal});
  console.log(JSON.stringify(receipt));
  if(receipt.status!=='DOMAIN_EVIDENCE_MATCH_NO_LIVE_ACCEPTANCE')process.exitCode=1;
 }finally{process.removeListener('SIGTERM',abort);process.removeListener('SIGINT',abort)}
}
main().catch(()=>{console.error('Domain evidence blocked; no provider changes or baseline updates.');process.exitCode=1});
