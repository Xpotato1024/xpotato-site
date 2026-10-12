import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createManualProvider,validateManualContext,stop,ManualDeployError} from './manual-deployment-provider.mjs';
import {requireManualRun,readPublicTargets,runManualDeployment} from './manual-deployment.mjs';
import {createManualGitHub} from './manual-deployment-github.mjs';
import {createPublicReadback} from './manual-deployment-public.mjs';
import {executeCaptured,cleanToolEnvironment,createWranglerDeploy} from './manual-deployment-process.mjs';
export async function main(env=process.env) {
  requireManualRun(env);
  if(process.platform!=='win32'||env.CI!=='true'||!env.GITHUB_TOKEN||!env.CLOUDFLARE_SITE_API_TOKEN||!env.CLOUDFLARE_SITE_MONITOR_READ_TOKEN)stop('APPROVED_WINDOWS_RUNNER_CREDENTIALS_REQUIRED');
  const selection={artifactId:env.SELECT_ARTIFACT,digest:env.SELECT_DIGEST,runId:env.SELECT_RUN,runAttempt:Number(env.SELECT_ATTEMPT),sourceSha:env.SELECT_SHA};
  const context=validateManualContext(JSON.parse(env.CLOUDFLARE_SITE_DEPLOY_CONTEXT_JSON||'null'));
  const temporary=resolve(env.RUNNER_TEMP),root=resolve(env.MANUAL_OPERATION_ROOT),tools=resolve(env.MANUAL_TOOL_ROOT);
  for(const path of [root,tools]) {const r=relative(temporary,path);if(!r||r.startsWith('..')||isAbsolute(r))stop('RUNNER_TEMP_PATH_REQUIRED');}
  const github=createManualGitHub({env,selection,credentialProvider:async()=>env.GITHUB_TOKEN,fetchImpl:fetch});
  const provider=createManualProvider({context,readonlyCredential:async()=>env.CLOUDFLARE_SITE_MONITOR_READ_TOKEN,deployCredential:async()=>env.CLOUDFLARE_SITE_API_TOKEN,fetchImpl:fetch});
  const publicReadback=createPublicReadback({fetchImpl:fetch});
  const manifest=await github.sourceJson('docs/migration/content-materialization-v1.json');
  const held=manifest.records?.filter(r=>r.collection==='blog');
  if(manifest.schemaVersion!==1||manifest.materializationVersion!=='legacy-content-materialization-v1'||held?.length!==44||held.some(r=>r.targetDraft!==true||JSON.stringify(r.publicationHoldReasons)!=='["blog_media_registry"]'))stop('HELD_MANIFEST_POLICY_CHANGED');
  const heldIds=held.map(r=>r.vNextContentId);
  const verifyHandoff=async()=>{
    const powershell=join(env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
    const args=['-NoProfile','-NonInteractive','-File',fileURLToPath(new URL('./Read-ManualArtifactHandoff.ps1',import.meta.url)),'-OperationRoot',root,'-ArtifactId',selection.artifactId,'-RunId',selection.runId,'-RunAttempt',String(selection.runAttempt),'-ExpectedDigest',selection.digest,'-SourceSha',selection.sourceSha];
    const result=await executeCaptured(powershell,args,{env:cleanToolEnvironment(env,{GITHUB_TOKEN:env.GITHUB_TOKEN}),timeoutMs:180000});
    if(result.exitCode!==0)stop('CANONICAL_HANDOFF_FAILED');
    try {return JSON.parse(result.output.trim());}catch {stop('CANONICAL_HANDOFF_RESPONSE');}
  };
  const result=await runManualDeployment({env,selection,provider,verifyGitHub:github.verify,verifyHandoff,loadTargets:()=>readPublicTargets(join(root,'staging'),selection,heldIds),probeBefore:publicReadback.before,verifyPublished:publicReadback.published,deployOnce:createWranglerDeploy({toolRoot:tools,env,context}),persistPreimage:async evidence=>writeFile(join(root,'manual-preimage.json'),JSON.stringify(evidence,null,2),{flag:'wx',encoding:'utf8'})});
  await writeFile(join(root,'manual-result.json'),JSON.stringify(result,null,2),{flag:'wx',encoding:'utf8'});
  process.stdout.write(JSON.stringify({status:result.status,code:result.code,deployCount:result.deployCount})+'\n');
  if(result.status!=='DEPLOYED_READBACK_VERIFIED')process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{
  process.stderr.write((error instanceof ManualDeployError?error.message:'MANUAL_RUN_FAILED')+'\n');process.exitCode=1;
});
