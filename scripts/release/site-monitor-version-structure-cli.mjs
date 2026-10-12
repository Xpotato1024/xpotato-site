// Manual owner/main singleton diagnostic; identifiers stay in the event file.
import {readFileSync,statSync} from 'node:fs';
import {createVersionStructureProbe} from './site-monitor-version-structure.mjs';
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
async function main(){
 if(process.argv.length!==2||process.env.SITE_VERSION_STRUCTURE_AUTHORIZATION!=='owner-approved-version-only-structure'||process.env.GITHUB_REPOSITORY!=='Xpotato1024/xpotato-site'||process.env.GITHUB_REF!=='refs/heads/main'||process.env.GITHUB_EVENT_NAME!=='workflow_dispatch'||process.env.GITHUB_ACTOR!=='Xpotato1024'||process.env.GITHUB_TRIGGERING_ACTOR!=='Xpotato1024'||process.env.GITHUB_RUN_ATTEMPT!=='1')throw Error('BLOCKED');
 const eventPath=process.env.GITHUB_EVENT_PATH;
 if(typeof eventPath!=='string'||!eventPath)throw Error('BLOCKED');
 const stat=statSync(eventPath);if(!stat.isFile()||stat.size>1048576)throw Error('BLOCKED');
 const bytes=readFileSync(eventPath);if(bytes.length>1048576)throw Error('BLOCKED');
 const event=JSON.parse(bytes.toString('utf8'));
 if(!record(event)||!record(event.inputs)||event.inputs.mode!=='readonly-version-structure')throw Error('BLOCKED');
 if(typeof event.inputs.expected_source_sha!=='string'||!/^[a-f0-9]{40}$/.test(event.inputs.expected_source_sha)||process.env.GITHUB_SHA!==event.inputs.expected_source_sha)throw Error('BLOCKED');
 const controller=new AbortController(),abort=()=>controller.abort();
 process.once('SIGTERM',abort);process.once('SIGINT',abort);
 try{
  const operation=createVersionStructureProbe({accountId:event.inputs.account_id,versionId:event.inputs.expected_version_id,credentialProvider:async()=>process.env.CLOUDFLARE_SITE_MONITOR_READ_TOKEN,fetchImpl:fetch,signal:controller.signal});
  const receipt=await operation.acquire();console.log(JSON.stringify(receipt));
  if(receipt.status!=='STRUCTURE_OBSERVED_NO_ACCEPTANCE')process.exitCode=1;
 }finally{process.removeListener('SIGTERM',abort);process.removeListener('SIGINT',abort);controller.abort();}
}
main().catch(()=>{console.error('Version structure diagnostic blocked; no provider changes or acceptance.');process.exitCode=1});
