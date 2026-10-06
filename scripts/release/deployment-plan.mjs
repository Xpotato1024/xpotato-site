import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,realpath} from 'node:fs/promises';
import {resolve,relative,isAbsolute,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {deriveReleaseReview,validateSelection,authority} from './deployment-policy.mjs';

const args=process.argv.slice(2);
if(args.length!==6)throw Error('Usage: deployment-plan.mjs RUN_ID ATTEMPT ARTIFACT_ID SHA DIGEST OUTPUT');
const [runId,attempt,artifactId,sourceSha,digest,output]=args;
if(!/^[1-9][0-9]*$/.test(attempt))throw Error('INVALID_ATTEMPT');
const selection=validateSelection({runId,runAttempt:Number(attempt),artifactId,sourceSha,digest});
const temp=resolve(process.env.RUNNER_TEMP??tmpdir());
const inside=relative(temp,resolve(output));
if(!isAbsolute(output)||!inside||inside.startsWith('..')||isAbsolute(inside))throw Error('OUTPUT_MUST_BE_TASK_TEMP_CHILD');
const canonicalTemp=await realpath(temp);
let ancestor=dirname(resolve(output));
for(;;){try{const canonical=await realpath(ancestor);const within=relative(canonicalTemp,canonical);if(within.startsWith('..')||isAbsolute(within))throw Error('OUTPUT_REPARSE_ESCAPE');break;}catch(error){if(error.code!=='ENOENT')throw error;const parent=dirname(ancestor);if(parent===ancestor)throw Error('OUTPUT_PARENT_UNRESOLVED');ancestor=parent;}}
const readApi=path=>JSON.parse(execFileSync('gh',['api',`repos/${authority.repository}/${path}`],{encoding:'utf8',maxBuffer:4*1024*1024,stdio:['ignore','pipe','ignore'],windowsHide:true}));
// GET only. No mutation, Cloudflare authentication, OIDC request or site build.
const run=readApi(`actions/runs/${selection.runId}/attempts/${selection.runAttempt}`);
const artifact=readApi(`actions/artifacts/${selection.artifactId}`);
const plan=deriveReleaseReview(selection,run,artifact);
await mkdir(dirname(resolve(output)),{recursive:true});
const finalParent=relative(canonicalTemp,await realpath(dirname(resolve(output))));
if(finalParent.startsWith('..')||isAbsolute(finalParent))throw Error('OUTPUT_REPARSE_ESCAPE');
await writeFile(output,JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
console.log('Release metadata reviewed; BLOCKED_CREDENTIAL_AND_LIVE_ACCEPTANCE. Provider mutations=0, builds=0.');
