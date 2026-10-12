// Pure source guard for the reviewed manual-only workflow; no environment or IO.
export const manualJobGuard="github.repository == 'Xpotato1024/xpotato-site' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && github.actor == 'Xpotato1024' && github.triggering_actor == 'Xpotato1024' && github.run_attempt == 1 && inputs.owner_recovery_ready";
export function assertManualWorkflow(text) {
 const fail=()=>{throw Error('MANUAL_WORKFLOW_BOUNDARY')};
 if(typeof text!=='string'||!/^on:\n  workflow_dispatch:/m.test(text)||/^\s+(push|pull_request|pull_request_target|workflow_run|schedule):/m.test(text)||/id-token:|:\s*write\s*$|self-hosted/m.test(text))fail();
 const jobs=text.split(/^jobs:\s*$/m);if(jobs.length!==2)fail();
 const names=[...jobs[1].matchAll(/^  ([a-z][a-z0-9-]*):\s*$/gm)].map(r=>r[1]);if(JSON.stringify(names)!=='["production"]')fail();
 if(!text.includes('    if: '+manualJobGuard+'\n')||!/^    environment: site-production$/m.test(text)||!/^  cancel-in-progress: false$/m.test(text))fail();
 const allowed=['CLOUDFLARE_SITE_API_TOKEN','CLOUDFLARE_SITE_MONITOR_READ_TOKEN'];
 const secrets=[...text.matchAll(/secrets\.([A-Z_]+)/g)].map(r=>r[1]).sort();if(JSON.stringify(secrets)!==JSON.stringify(allowed.sort()))fail();
 if((text.match(/node \.\/scripts\/release\/manual-deployment-cli\.mjs/g)||[]).length!==1||/wrangler deploy|curl |fetch\(|echo.*\$env:CLOUDFLARE/.test(text))fail();
 if(text.indexOf('npm install --prefix')>text.indexOf('secrets.CLOUDFLARE_SITE_API_TOKEN')||!text.includes('Get-ReleaseArtifact.ps1 -Mode Production')||!text.includes('Test-SiteArtifactHandoff.ps1 @selection')||!text.includes('persist-credentials: false'))fail();
 return true;
}
