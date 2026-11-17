import {probeWorkerMetadata} from './site-monitor-readiness.mjs';
async function main(){
 if(process.argv.length!==2||process.env.SITE_MONITOR_AUTHORIZATION!=='owner-approved-fixed-get-probe'||process.env.GITHUB_REPOSITORY!=='Xpotato1024/xpotato-site'||process.env.GITHUB_REF!=='refs/heads/main'||process.env.GITHUB_EVENT_NAME!=='workflow_dispatch'||process.env.GITHUB_ACTOR!=='Xpotato1024'||process.env.GITHUB_TRIGGERING_ACTOR!=='Xpotato1024')throw Error('BLOCKED');
 const receipt=await probeWorkerMetadata({accountId:process.env.PROBE_ACCOUNT_ID,credentialProvider:async()=>process.env.CLOUDFLARE_SITE_MONITOR_READ_TOKEN,fetchImpl:fetch});
 console.log(JSON.stringify(receipt));
 if(receipt.status!=='REQUIRED_GET_ACCESSIBLE_NO_LIVE_ACCEPTANCE')process.exitCode=1;
}
main().catch(()=>{console.error('Readiness probe blocked; no provider changes or baseline updates.');process.exitCode=1});
