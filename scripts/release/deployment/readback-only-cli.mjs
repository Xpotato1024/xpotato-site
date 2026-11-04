import {readFile,writeFile,lstat} from 'node:fs/promises';
import {resolve,join,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hashBytes} from './manual-deployment.mjs';
import {runReadbackOnly,validateReadbackRequest} from './readback-only.mjs';
import {acquireCanonicalReadbackArtifact,currentVerifierRevision,readbackArtifact,readbackArtifactFailure} from './readback-only-artifact.mjs';
import {requireReadbackRun,createReadbackGitHub,admissionErrorCode} from './readback-only-github.mjs';
import {downloadOriginalEvidence,evidenceErrorCode} from './readback-only-evidence.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url)),planPath=join(root,'config/readback/robots-20261104.json');
class CliError extends Error{}
const stop=code=>{throw new CliError(code);};
const shape=(value,keys)=>{if(!value||Object.keys(value).sort().join('|')!==[...keys].sort().join('|'))stop('READBACK_PLAN_INVALID');};
export function parseReadbackPlan(bytes,env){
  if(!Buffer.isBuffer(bytes)||bytes.length>32768||hashBytes(bytes)!==env.READBACK_PLAN_SHA256)stop('READBACK_PLAN_DIGEST');
  let plan;try{plan=JSON.parse(bytes.toString('utf8'));}catch{stop('READBACK_PLAN_INVALID');}
  shape(plan,['schemaVersion','reviewedLibrarySha','selection','originalDeployment','expected','evidenceArchive']);
  const pin=plan.evidenceArchive;
  shape(pin,['name','bytes','digest','resultBytes','resultSha256']);
  if(plan.schemaVersion!==1||!/^[a-f0-9]{40}$/.test(plan.reviewedLibrarySha??'')||!Number.isSafeInteger(pin.bytes)||pin.bytes<1||pin.bytes>1048576
    ||!Number.isSafeInteger(pin.resultBytes)||pin.resultBytes<1||pin.resultBytes>1048576||!/^sha256:[a-f0-9]{64}$/.test(pin.digest??'')
    ||!/^[a-f0-9]{64}$/.test(pin.resultSha256??'')||pin.resultSha256!==plan.originalDeployment?.evidenceSha256
    ||pin.name!=='site-manual-evidence-'+plan.originalDeployment?.runId+'-'+plan.originalDeployment?.runAttempt)stop('READBACK_PLAN_INVALID');
  const request=validateReadbackRequest({operationId:env.READBACK_OPERATION_ID,verifierSha:env.READBACK_VERIFIER_SHA,
    selection:plan.selection,originalDeployment:plan.originalDeployment,expected:plan.expected});
  return {plan,request};
}
const incomplete=new Set(['READBACK_CREDENTIALS_UNAVAILABLE','READBACK_ARTIFACT_UNAVAILABLE','REMOTE_REQUEST_FAILED','REMOTE_TIMEOUT',
  'AUTHENTICATION_UNAVAILABLE','REMOTE_HTTP_429','EVIDENCE_AUTHENTICATION_UNAVAILABLE','EVIDENCE_DOWNLOAD_FAILED','EVIDENCE_DOWNLOAD_TIMEOUT','READBACK_PRODUCTION_ACQUISITION_UNAVAILABLE']);
async function executeReadback(env,backend){
  let stage='guard',outputPath,operationRoot,githubBefore,githubAfter,inputReceipt,readbackResult,execution;
  const base={protocol:'xpotato-readback-cli-v1',evidenceMode:backend.kind,acceptance:false,deployCount:0,providerWrites:0};
  let result;
  try{
    // Check the real runner-only entry conditions before consulting credentials.
    requireReadbackRun(env);
    execution={repository:env.GITHUB_REPOSITORY,workflow:'.github/workflows/site-readback-only.yml',runId:env.GITHUB_RUN_ID,runAttempt:1,
      verifierSha:env.GITHUB_SHA,operationId:env.READBACK_OPERATION_ID};
    if(backend.platform!=='win32')stop('READBACK_WINDOWS_RUNNER_REQUIRED');
    if(typeof env.RUNNER_TEMP!=='string'||!isAbsolute(env.RUNNER_TEMP))stop('READBACK_RUNNER_TEMP_REQUIRED');
    const temporary=resolve(env.RUNNER_TEMP),info=await lstat(temporary);
    if(!info.isDirectory()||info.isSymbolicLink())stop('READBACK_RUNNER_TEMP_REQUIRED');
    outputPath=join(temporary,'site-readback-result.json');
    operationRoot=join(temporary,'site-readback-'+env.READBACK_OPERATION_ID);
    for(const path of [outputPath,operationRoot]){
      try{await lstat(path);stop('READBACK_OPERATION_NOT_FRESH');}catch(error){if(error.code!=='ENOENT')throw error;}
    }
    stage='verifier';if(await backend.revision()!==env.GITHUB_SHA)stop('READBACK_VERIFIER_REVISION');
    if(backend.nodeVersion!==(await readFile(join(root,'.node-version'),'utf8')).trim())stop('READBACK_NODE_VERSION');
    stage='plan';const bytes=await backend.readPlan(),{plan,request}=parseReadbackPlan(bytes,env);
    stage='credentials';
    if(['GITHUB_TOKEN','CLOUDFLARE_SITE_API_TOKEN','CLOUDFLARE_SITE_MONITOR_READ_TOKEN'].some(name=>typeof env[name]!=='string'||!/^[A-Za-z0-9_.-]{16,2048}$/.test(env[name]))
      ||!env.CLOUDFLARE_SITE_DEPLOY_CONTEXT_JSON)stop('READBACK_CREDENTIALS_UNAVAILABLE');
    const githubCredential=async()=>env.GITHUB_TOKEN;
    const github=createReadbackGitHub({env,plan,credentialProvider:githubCredential,fetchImpl:backend.fetchImpl,...backend.clock?{clock:backend.clock}:{}});
    stage='github-admission';githubBefore=await github.verify();
    stage='original-metadata';const originalIdentity=await github.verifyOriginalEvidence();
    stage='original-download';const original=await downloadOriginalEvidence({artifactId:plan.originalDeployment.evidenceArtifactId,pin:plan.evidenceArchive,
      credentialProvider:githubCredential,fetchImpl:backend.fetchImpl});
    stage='production-acquisition';let artifact;
    try{artifact=await backend.prepareArtifact({operationRoot,selection:plan.selection,githubCredential});}
    catch(error){if(readbackArtifactFailure(error))throw error;stop('READBACK_PRODUCTION_ACQUISITION_UNAVAILABLE');}
    if(backend.kind==='synthetic'&&readbackArtifact(artifact).kind!=='synthetic')stop('READBACK_SYNTHETIC_ARTIFACT_REQUIRED');
    if(backend.kind==='live-adapters'&&readbackArtifact(artifact).kind!=='canonical-consumer')stop('READBACK_CANONICAL_ARTIFACT_REQUIRED');
    stage='input-evidence';const originalEvidencePath=join(operationRoot,'original-manual-result.json');
    await writeFile(originalEvidencePath,original,{flag:'wx'});
    inputReceipt={selection:plan.selection,originalEvidence:originalIdentity,verifierSha:env.GITHUB_SHA,reviewedLibrarySha:plan.reviewedLibrarySha,
      artifactRelationship:'already-deployed-verification-subject',consumer:readbackArtifact(artifact).kind,
      operationId:request.operationId,planSha256:hashBytes(bytes),providerWrites:0,deployCount:0};
    await writeFile(join(operationRoot,'readback-input-receipt.json'),JSON.stringify(inputReceipt,null,2)+'\n',{flag:'wx',encoding:'utf8'});
    stage='github-readmission';githubAfter=await github.verify();
    stage='readback';let context;try{context=JSON.parse(env.CLOUDFLARE_SITE_DEPLOY_CONTEXT_JSON);}catch{stop('READBACK_CONTEXT_INVALID');}
    readbackResult=await runReadbackOnly({request,originalEvidencePath,artifact,context,
      readonlyCredential:async()=>env.CLOUDFLARE_SITE_MONITOR_READ_TOKEN,deployCredential:async()=>env.CLOUDFLARE_SITE_API_TOKEN,outputDirectory:operationRoot,
      ...backend.kind==='synthetic'?{fetchImpl:backend.fetchImpl,...backend.clock?{clock:backend.clock}:{},wait:async()=>{}}:{}});
    if(readbackResult.evidenceMode!==backend.kind)stop('READBACK_EVIDENCE_MODE_MISMATCH');
    stage='complete';result={...base,status:readbackResult.status,code:readbackResult.code,stage,execution,githubBefore,githubAfter,inputReceipt,readbackResult};
  }catch(error){
    const code=error instanceof CliError?error.message:admissionErrorCode(error)??evidenceErrorCode(error)??readbackArtifactFailure(error)??'READBACK_CLI_STAGE_FAILED';
    result={...base,status:incomplete.has(code)?'READBACK_ONLY_INCOMPLETE':'READBACK_ONLY_FAILED',code,stage,...execution?{execution}:{},
      ...(githubBefore?{githubBefore}:{}),...(githubAfter?{githubAfter}:{}),...(inputReceipt?{inputReceipt}:{}),...(readbackResult?{readbackResult}:{})};
  }
  // Guard failures also need a nonsecret terminal record when the actual runner
  // temp is usable. No arbitrary output filename or overwrite is accepted.
  if(!outputPath&&typeof env.RUNNER_TEMP==='string'&&isAbsolute(env.RUNNER_TEMP)){
    try{const info=await lstat(env.RUNNER_TEMP);if(info.isDirectory()&&!info.isSymbolicLink())outputPath=join(resolve(env.RUNNER_TEMP),'site-readback-result.json');}catch{}
  }
  if(outputPath){try{await writeFile(outputPath,JSON.stringify(result,null,2)+'\n',{flag:'wx',encoding:'utf8'});return {...result,reportSaved:true};}catch{}}
  return {...result,status:'READBACK_ONLY_INCOMPLETE',code:'READBACK_CLI_RESULT_NOT_SAVED',stage:'persist',reportSaved:false};
}
// Production entry has no caller-overridable env, transport, process or adapter.
export async function main(...overrides){
  if(overrides.length)throw new Error('READBACK_LIVE_OVERRIDES_FORBIDDEN');
  return executeReadback(process.env,{kind:'live-adapters',platform:process.platform,nodeVersion:process.versions.node,fetchImpl:fetch,
    revision:currentVerifierRevision,readPlan:()=>readFile(planPath),prepareArtifact:acquireCanonicalReadbackArtifact});
}
// Unit/integration fixtures use a separate, permanently synthetic lane. Their
// fake GitHub env or preparation port can never produce live-adapter evidence.
export async function runSyntheticReadbackCli({env,fetchImpl,prepareArtifact,planBytes,revision,clock,platform='win32',nodeVersion='24.22.1'}){
  return executeReadback(env,{kind:'synthetic',platform,nodeVersion,fetchImpl,prepareArtifact,readPlan:async()=>Buffer.from(planBytes),revision:async()=>revision,clock});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().then(result=>{
  process.stdout.write(JSON.stringify({status:result.status,code:result.code,evidenceMode:result.evidenceMode,reportSaved:result.reportSaved,deployCount:0,providerWrites:0})+'\n');
  if(result.status!=='READBACK_ONLY_CHECKS_PASSED'||result.evidenceMode!=='live-adapters'||!result.reportSaved)process.exitCode=1;
}).catch(()=>{process.stderr.write('READBACK_CLI_BLOCKED\n');process.exitCode=1;});
