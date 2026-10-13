import {createHash} from 'node:crypto';
import {readFile, readdir, lstat} from 'node:fs/promises';
import {join, relative, resolve, sep} from 'node:path';
import {authority, validateSelection} from './deployment-policy.mjs';
import {ManualDeployError, stop, uuid} from './manual-deployment-provider.mjs';
export const hashBytes=bytes=>createHash('sha256').update(bytes).digest('hex');
export function requireManualRun(env) {
  if (env.GITHUB_REPOSITORY!==authority.repository || env.GITHUB_EVENT_NAME!=='workflow_dispatch' || env.GITHUB_REF!=='refs/heads/main' || env.GITHUB_ACTOR!=='Xpotato1024' || env.GITHUB_TRIGGERING_ACTOR!=='Xpotato1024' || env.GITHUB_RUN_ATTEMPT!=='1' || env.OWNER_RECOVERY_READY!=='true' || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'') || !/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID||'')) stop('MANUAL_OWNER_MAIN_RUN_REQUIRED');
}
export async function readPublicTargets(staging,selection,heldIds) {
  validateSelection(selection);
  const root=resolve(staging), dist=join(root,'apps/site/dist');
  const release=JSON.parse(await readFile(join(root,'release.json'),'utf8'));
  if (release.sourceSha!==selection.sourceSha || release.productionEligible!==true || release.event!=='push' || release.gitRef!=='refs/heads/main' || release.workflowRunId!==selection.runId || release.workflowRunAttempt!==selection.runAttempt || release.serverAuthoritySha!==authority.serverSha || release.wranglerVersion!==authority.wrangler || release.validation?.source!=='PASS' || release.validation?.final!=='PASS') stop('STAGED_RELEASE_MISMATCH');
  const config=JSON.parse(await readFile(join(root,'apps/site/wrangler.jsonc'),'utf8'));
  if (Object.keys(config).sort().join('|')!=='assets|compatibility_date|name|preview_urls|workers_dev' || config.name!==authority.worker || config.workers_dev!==false || config.preview_urls!==false || Object.keys(config.assets||{}).sort().join('|')!=='directory|not_found_handling' || config.assets.directory!=='./dist' || config.assets.not_found_handling!=='404-page') stop('CONFIG_OVERRIDE_OR_BINDING');
  if (!Array.isArray(heldIds) || heldIds.length!==44 || new Set(heldIds).size!==44 || heldIds.some(id=>!/^[a-f0-9-]{36}$/.test(id))) stop('HELD_MANIFEST_REQUIRED');
  if ((await lstat(dist)).isSymbolicLink() || (await lstat(join(root,'apps'))).isSymbolicLink() || (await lstat(join(root,'apps/site'))).isSymbolicLink()) stop('STAGING_PATH_ESCAPE');
  const files=[];let rasterCount=0;
  async function walk(directory) {
    for (const name of await readdir(directory)) {
      const path=join(directory,name), info=await lstat(path);
      if (info.isSymbolicLink() || !path.startsWith(dist+sep)) stop('STAGING_PATH_ESCAPE');
      if (info.isDirectory()) await walk(path);
      else if (info.isFile()) files.push(path);
      else stop('STAGING_NONREGULAR_FILE');
    }
  }
  await walk(dist);
  const assets=new Map(), routes=['/','/about/','/education/','/notes/','/projects/','/search/','/tools/prime-factorizer/'];
  const textExtensions=/\.(html|css|js|json|xml|txt|svg)$/i;
  for (const path of files) {
    const bytes=await readFile(path), name=relative(dist,path).split(sep).join('/');
    if (/\.(png|jpe?g|webp|avif|heic|heif|gif|tiff?|bmp|jxl)$/i.test(name)) {rasterCount++;stop('UNAPPROVED_RASTER');}
    if (textExtensions.test(name)) {
      const text=bytes.toString('utf8');
      if (heldIds.some(id=>text.includes(id)) || /data:image\/(?!svg\+xml)[a-z0-9.+-]+/i.test(text)) stop('HELD_OR_PRIVATE_MEDIA');
    }
    assets.set('/'+name,{bytes:bytes.length,sha256:hashBytes(bytes)});
  }
  const selected=new Map();
  for (const route of routes) {
    const path=join(dist,route==='/'?'index.html':route.slice(1)+'index.html');
    const html=await readFile(path,'utf8');
    selected.set(route,assets.get('/'+relative(dist,path).split(sep).join('/')));
    for (const [,value] of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
      const url=new URL(value,'https://'+authority.hostname+route);
      if (url.origin!=='https://'+authority.hostname || !/\.(css|js|svg|ico|woff2?)$/.test(url.pathname)) continue;
      if (url.search || !assets.has(url.pathname)) stop('BUILT_ASSET_REFERENCE_MISMATCH');
      selected.set(url.pathname,assets.get(url.pathname));
    }
  }
  // Include the search/tool chunks as well as assets linked from representative HTML.
  for (const [path,metric] of assets) if (path.startsWith('/_astro/') && /\.(css|js)$/.test(path)) selected.set(path,metric);
  if (selected.size>64 || [...selected.values()].some(value=>!value)) stop('PUBLIC_TARGET_BUDGET');
  return {configPath:join(root,'apps/site/wrangler.jsonc'),dist,targets:[...selected].map(([path,metric])=>({path,...metric})),fileCount:files.length,heldCount:44,rasterCount};
}
export async function runManualDeployment({env,selection,provider,verifyGitHub,verifyHandoff,loadTargets,probeBefore,verifyPublished,deployOnce,persistPreimage,clock=Date.now}) {
  requireManualRun(env);validateSelection(selection);
  let mutationAttempted=false, preimage, receipt;
  try {
    await verifyGitHub();
    const handoff=await verifyHandoff();
    if (handoff.mode!=='Production' || handoff.sourceSha!==selection.sourceSha || handoff.artifactId!==selection.artifactId || handoff.digest!==selection.digest) stop('CANONICAL_HANDOFF_REQUIRED');
    const targets=await loadTargets(handoff);
    const token=await provider.verifyDeployToken();
    preimage=await provider.snapshot();
    const before=await probeBefore(preimage);
    if (before.publicStatus!==200 || !/^[a-f0-9]{64}$/.test(before.homeSha256) || before.workersDevStatus!==404 || before.previewStatus!==404) stop('BEFORE_PUBLIC_OR_ENDPOINT_FAILURE');
    await verifyGitHub();
    const repeated=await verifyHandoff();
    if (JSON.stringify(repeated)!==JSON.stringify(handoff) || JSON.stringify(await loadTargets(repeated))!==JSON.stringify(targets)) stop('HANDOFF_OR_TARGETS_CHANGED');
    const latest=await provider.snapshot();
    if (latest.deploymentId!==preimage.deploymentId || latest.versionId!==preimage.versionId || latest.workerTag!==preimage.workerTag || !Number.isFinite(Date.parse(latest.observedAt)) || Date.parse(latest.observedAt)>clock() || clock()-Date.parse(latest.observedAt)>120000) stop('PREIMAGE_CHANGED');
    await provider.verifyDeployToken();
    await persistPreimage({selection,preimage:latest,before,token});
    mutationAttempted=true;receipt=await deployOnce(targets);
    if (receipt.count!==1 || receipt.exitCode!==0 || !uuid(receipt.versionId)) stop('DEPLOY_RECEIPT_UNKNOWN');
    const postimage=await provider.snapshot();
    if (postimage.versionId!==receipt.versionId) stop('POST_VERSION_MISMATCH');
    await verifyPublished(targets,postimage);
    const active=await provider.verifyDeployToken();
    if (active.tokenId!==token.tokenId || active.expiresOn!==token.expiresOn) stop('TOKEN_CHANGED_AFTER_DEPLOY');
    return {status:'DEPLOYED_READBACK_VERIFIED',sourceSha:selection.sourceSha,artifactId:selection.artifactId,digest:selection.digest,preimage,postimage,credentialLifecycle:active.expiryEvidence==='UNREPORTED'?'ACTIVE_AT_LAST_VERIFY_WITH_UNREPORTED_EXPIRY':'ACTIVE_UNTIL_REVIEWED_ROTATION',expiryEvidence:active.expiryEvidence,tokenLifetimePolicyVerified:active.tokenLifetimePolicyVerified,rotationEnforced:active.rotationEnforced,scopeEvidence:active.scopeEvidence,scopeLiveReadback:false,publicTargets:targets.targets.length,buildCount:0,deployCount:1};
  } catch(error) {
    const code=error instanceof ManualDeployError?error.message:'MANUAL_DEPLOY_STEP_FAILED';
    return {status:mutationAttempted?'STOPPED_OWNER_RECOVERY_REQUIRED':'STOPPED_BEFORE_DEPLOY',code,diagnostics:error instanceof ManualDeployError?error.diagnostics:undefined,deployCount:mutationAttempted?1:0,preimage,rollbackExecuted:false,credentialRevoked:false};
  }
}

export async function runTokenDiagnosticsOnly({env,provider,verifyGitHub,persist}) {
  requireManualRun(env);
  if(env.DIAGNOSTIC_ONLY!=='true')stop('DIAGNOSTIC_ONLY_MODE_REQUIRED');
  await verifyGitHub();
  const result=await provider.diagnoseDeployToken();
  await persist(result);
  return result;
}
