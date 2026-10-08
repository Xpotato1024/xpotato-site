// Explicit host boundary; imports never retrieve credentials or perform IO.
import {probeDomainEvidence} from './site-domain-evidence.mjs';
async function main(){
 if(process.argv.length!==2||process.env.SITE_DOMAIN_EVIDENCE_AUTHORIZATION!=='owner-approved-three-get-domain-evidence'||process.env.PROBE_MODE!=='readonly-domain-evidence'||process.env.GITHUB_REPOSITORY!=='Xpotato1024/xpotato-site'||process.env.GITHUB_REF!=='refs/heads/main'||process.env.GITHUB_EVENT_NAME!=='workflow_dispatch'||process.env.GITHUB_ACTOR!=='Xpotato1024'||process.env.GITHUB_TRIGGERING_ACTOR!=='Xpotato1024')throw Error('BLOCKED');
 const controller=new AbortController(),abort=()=>controller.abort();
 process.once('SIGTERM',abort);process.once('SIGINT',abort);
 try {
  const receipt=await probeDomainEvidence({accountId:process.env.PROBE_ACCOUNT_ID,expectedCredentialId:process.env.PROBE_EXPECTED_CREDENTIAL_ID,expectedWorkerTag:process.env.PROBE_EXPECTED_WORKER_TAG,credentialProvider:async()=>process.env.CLOUDFLARE_SITE_MONITOR_READ_TOKEN,fetchImpl:fetch,signal:controller.signal});
  console.log(JSON.stringify(receipt));
  if(receipt.status!=='DOMAIN_EVIDENCE_MATCH_NO_LIVE_ACCEPTANCE')process.exitCode=1;
 }finally{process.removeListener('SIGTERM',abort);process.removeListener('SIGINT',abort)}
}
main().catch(()=>{console.error('Domain evidence blocked; no provider changes or baseline updates.');process.exitCode=1});
