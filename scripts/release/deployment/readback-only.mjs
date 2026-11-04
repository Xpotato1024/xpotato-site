import {readFile,writeFile,lstat} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {authority,validateSelection} from './deployment-policy.mjs';
import {createManualProvider,validateManualContext,ManualDeployError,uuid} from './manual-deployment-provider.mjs';
import {createPublicReadback,publicReadbackReport} from './manual-deployment-public.mjs';
import {hashBytes} from './manual-deployment.mjs';
import {assertPublicTargetPlan} from '../shared/public-readback-policy.mjs';
import {parseStaticHeaderRules,headersForPath} from '../../../packages/site-validators/src/delivery/static-headers.mjs';
import {readbackArtifact,currentVerifierRevision,readbackArtifactFailure} from './readback-only-artifact.mjs';

class ReadbackError extends Error{}
const stop=code=>{throw new ReadbackError(code);};
const exact=(value,keys,code)=>{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype
    ||Reflect.ownKeys(value).some(key=>typeof key!=='string'||!Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'))
    ||Object.keys(value).sort().join('|')!==[...keys].sort().join('|'))stop(code);
};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const snapshotKeys=['deploymentId','versionId','accountId','zoneId','workerTag','accountSubdomain','hostname','bindings','routes','workersDev','previewUrls'];
const requiredHeaders=['content-security-policy','x-content-type-options','referrer-policy','permissions-policy'];
const incompleteCodes=new Set(['PUBLIC_TIMEOUT','PUBLIC_READ_FAILED','PUBLIC_READBACK_STALE','PUBLIC_BODY_LIMIT','PUBLIC_READ_BUDGET','PROVIDER_READ_BUDGET','REMOTE_TIMEOUT','REMOTE_REQUEST_FAILED','REMOTE_HTTP_429','AUTHENTICATION_UNAVAILABLE','READBACK_ARTIFACT_UNAVAILABLE','READBACK_ORIGINAL_EVIDENCE_UNAVAILABLE']);
const providerCodes=new Set([...incompleteCodes,'PUBLIC_BYTES_MISMATCH','PUBLIC_HTTP_OR_REDIRECT','ALTERNATE_ENDPOINT_LIVE',
  'POST_VERSION_CHANGED_DURING_READBACK','ACTIVE_DEPLOYMENT','ACTIVE_DEPLOYMENT_PAGE_UNREADABLE','READONLY_TOKEN_IDENTITY',
  'WORKER_IDENTITY','BINDINGS_DRIFT','VERSION_BINDINGS','ENDPOINT_DRIFT','DOMAIN_DRIFT','DOMAIN_ZONE_OR_ENDPOINT_DRIFT',
  'ROUTE_DRIFT','ACCOUNT_SUBDOMAIN','PREFLIGHT_CHANGED_OR_STALE','DEPLOY_TOKEN_CHANGED','DEPLOY_TOKEN_NOT_ACTIVE',
  'DEPLOY_TOKEN_POLICY_OR_ROTATION','DEPLOY_TOKEN_EXPIRY_MISSING','DEPLOY_TOKEN_EXPIRY_FORMAT','DEPLOY_TOKEN_ID_FORMAT',
  'DEPLOY_TOKEN_ID_MISSING','DEPLOY_TOKEN_RESULT_MISSING_OR_INVALID','DEPLOY_TOKEN_NOT_BEFORE_FORMAT','DEPLOY_TOKEN_NOT_BEFORE_FUTURE',
  'REMOTE_HTTP_401','REMOTE_HTTP_403','REMOTE_HTTP_404','REMOTE_HTTP_429','REMOTE_HTTP_FAILURE','REMOTE_REDIRECT_REJECTED',
  'REMOTE_CONTENT_TYPE','REMOTE_BODY_LIMIT','REMOTE_BODY_UNREADABLE','REMOTE_INVALID_JSON','PROVIDER_ENVELOPE']);
const tokenFields=['tokenId','expiresOn','notBefore','expiryEvidence','status','tokenLifetimePolicyVerified','rotationEnforced','scopeLiveReadback','rotationState'];
const tokenSignature=token=>JSON.stringify(tokenFields.map(key=>[key,token[key]??null]));
function validateRequest(request){
  exact(request,['operationId','verifierSha','selection','originalDeployment','expected'],'READBACK_REQUEST_INVALID');
  exact(request.selection,['artifactId','digest','runId','runAttempt','sourceSha'],'READBACK_REQUEST_INVALID');
  validateSelection(request.selection);
  if(!uuid(request.operationId)||!/^[a-f0-9]{40}$/.test(request.verifierSha))stop('READBACK_REQUEST_INVALID');
  exact(request.originalDeployment,['runId','runAttempt','evidenceArtifactId','selection','deployment','evidenceSha256'],'READBACK_ORIGINAL_RECEIPT_INVALID');
  const original=request.originalDeployment;
  exact(original.selection,['artifactId','digest','runId','runAttempt','sourceSha'],'READBACK_ORIGINAL_RECEIPT_INVALID');validateSelection(original.selection);
  exact(original.deployment,['status','receipt'],'READBACK_ORIGINAL_RECEIPT_INVALID');
  exact(original.deployment.receipt,['count','exitCode','versionId'],'READBACK_ORIGINAL_RECEIPT_INVALID');
  if(!/^[1-9][0-9]*$/.test(original.runId)||!/^[1-9][0-9]*$/.test(original.evidenceArtifactId)||!Number.isSafeInteger(original.runAttempt)||original.runAttempt<1
    ||!/^[a-f0-9]{64}$/.test(original.evidenceSha256)||!equal(original.selection,request.selection)
    ||original.deployment.status!=='acknowledged'||original.deployment.receipt.count!==1||original.deployment.receipt.exitCode!==0)stop('READBACK_ORIGINAL_RECEIPT_INVALID');
  exact(request.expected,snapshotKeys,'READBACK_EXPECTED_IDENTITY_INVALID');
  const expected=request.expected;
  if(!uuid(expected.deploymentId)||!uuid(expected.versionId)||original.deployment.receipt.versionId!==expected.versionId
    ||['accountId','zoneId','workerTag'].some(key=>!/^[a-f0-9]{32}$/.test(expected[key]))
    ||typeof expected.accountSubdomain!=='string'||!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(expected.accountSubdomain)
    ||expected.hostname!==authority.hostname||expected.bindings!==0||expected.routes!==0||expected.workersDev!==false||expected.previewUrls!==false)stop('READBACK_EXPECTED_IDENTITY_INVALID');
  return structuredClone(request);
}
function assertSnapshot(snapshot,expected,now){
  if(!snapshot||!Number.isFinite(Date.parse(snapshot.observedAt))||Date.parse(snapshot.observedAt)>now||now-Date.parse(snapshot.observedAt)>120000
    ||snapshotKeys.some(key=>snapshot[key]!==expected[key]))stop('READBACK_PROVIDER_IDENTITY_OR_FRESHNESS');
}
function assertArtifact(value,selection){
  if(!value?.handoff||!equal(value.handoff,{mode:'Production',sourceSha:selection.sourceSha,artifactId:selection.artifactId,digest:selection.digest}))stop('READBACK_HANDOFF_INVALID');
  const plan=value.plan;assertPublicTargetPlan(plan?.targets);
  if(plan.targets.length!==126||!plan.targets.some(row=>row.path==='/')||!plan.targets.some(row=>row.path==='/robots.txt')
    ||typeof plan.headers!=='string'||!plan.headers.trim())stop('READBACK_PLAN_INCOMPLETE');
  const rules=parseStaticHeaderRules(plan.headers);
  for(const target of plan.targets.filter(row=>!row.path.startsWith('https://'))){
    const headers=headersForPath(target.path,rules);
    if(requiredHeaders.some(name=>!headers[name]))stop('READBACK_SECURITY_HEADERS_MISSING');
  }
  return structuredClone(plan);
}
function assertReadback(report,plan,versionId){
  if(report?.status!=='verified'||report.expectedVersionId!==versionId||!Number.isFinite(Date.parse(report.startedAt))
    ||!Number.isFinite(Date.parse(report.observedAt))||Date.parse(report.observedAt)-Date.parse(report.startedAt)>120000
    ||report.alternateEndpoints?.workersDevStatus!==404||report.alternateEndpoints?.previewStatus!==404
    ||plan.targets.some(target=>!report.observations?.some(row=>row.path===target.path&&row.matches)))stop('READBACK_STAGES_INCOMPLETE');
}

// Library only: no CLI, workflow, deployment port, mutable provider or precomputed
// public/provider "success" input. Real read adapters execute every stage here.
// Caller-supplied transports/artifact fixtures always produce synthetic evidence.
export async function runReadbackOnly(input){
  let stage='request',request,report,beforeSnapshot,afterSnapshot,beforePublic,tokenBefore,tokenAfter,artifactBefore,artifactAfter,verifierRevisionVerified=false;
  const stages=[],network={requests:0,providerRequests:0,publicRequests:0,providerWrites:0},startedAt=new Date().toISOString();
  let mode='synthetic',clock=Date.now,outputPath;
  const result=(status,code)=>({protocol:'xpotato-readback-only-v1',status,code,stage,evidenceMode:mode,acceptance:false,verifierRevisionVerified,
    deployCount:0,providerWrites:0,startedAt,completedAt:new Date().toISOString(),stages:[...stages],network:{...network},
    ...(request?{operationId:request.operationId,verifierSha:request.verifierSha,selection:request.selection,
      originalDeployment:request.originalDeployment,expected:request.expected}:{}),
    ...(beforeSnapshot?{beforeSnapshot}:{}),...(afterSnapshot?{afterSnapshot}:{}),...(beforePublic?{beforePublic}:{}),...(report?{readback:report}:{}),
    ...(artifactBefore?{artifactBefore}:{}),...(artifactAfter?{artifactAfter}:{}),
    ...(tokenAfter?{tokenChecks:{identityStable:tokenSignature(tokenBefore)===tokenSignature(tokenAfter),expiryEvidence:tokenAfter.expiryEvidence,
      lifetimeVerified:tokenAfter.tokenLifetimePolicyVerified,rotationEnforced:tokenAfter.rotationEnforced,scopeLiveReadback:tokenAfter.scopeLiveReadback}}:{})});
  let outcome;
  try{
    const allowed=['request','originalEvidencePath','artifact','context','readonlyCredential','deployCredential','outputDirectory','fetchImpl','clock','wait'];
    if(!input||Object.getPrototypeOf(input)!==Object.prototype||Reflect.ownKeys(input).some(key=>typeof key!=='string'||!allowed.includes(key))
      ||Object.keys(input).some(key=>!Object.hasOwn(Object.getOwnPropertyDescriptor(input,key),'value')))stop('READBACK_INPUT_CAPABILITY_INVALID');
    request=validateRequest(input.request);
    if(typeof input.outputDirectory!=='string'||!isAbsolute(input.outputDirectory))stop('READBACK_OUTPUT_REQUIRED');
    outputPath=join(input.outputDirectory,'readback-only-'+request.operationId+'.json');
    if(input.clock!==undefined&&typeof input.clock!=='function'||input.wait!==undefined&&typeof input.wait!=='function'
      ||input.fetchImpl!==undefined&&typeof input.fetchImpl!=='function'||typeof input.readonlyCredential!=='function'||typeof input.deployCredential!=='function')stop('READBACK_INPUT_CAPABILITY_INVALID');
    clock=input.clock??Date.now;
    const artifact=readbackArtifact(input.artifact);
    if(!equal(artifact.selection,request.selection))stop('READBACK_ARTIFACT_SELECTION_CHANGED');
    mode=artifact.kind==='canonical-consumer'&&input.fetchImpl===undefined&&input.clock===undefined&&input.wait===undefined?'live-adapters':'synthetic';
    if(mode==='live-adapters'){
      let actualRevision;try{actualRevision=await currentVerifierRevision();}catch{stop('READBACK_VERIFIER_REVISION');}
      if(actualRevision!==request.verifierSha)stop('READBACK_VERIFIER_REVISION');verifierRevisionVerified=true;
    }
    stages.push('request');
    stage='original-receipt';
    if(typeof input.originalEvidencePath!=='string'||!isAbsolute(input.originalEvidencePath))stop('READBACK_ORIGINAL_EVIDENCE_REQUIRED');
    let originalInfo,originalBytes;
    try{originalInfo=await lstat(input.originalEvidencePath);}catch{stop('READBACK_ORIGINAL_EVIDENCE_UNAVAILABLE');}
    if(!originalInfo.isFile()||originalInfo.isSymbolicLink()||originalInfo.size>1048576)stop('READBACK_ORIGINAL_EVIDENCE_DIGEST');
    try{originalBytes=await readFile(input.originalEvidencePath);}catch{stop('READBACK_ORIGINAL_EVIDENCE_UNAVAILABLE');}
    if(originalBytes.length>1048576||hashBytes(originalBytes)!==request.originalDeployment.evidenceSha256)stop('READBACK_ORIGINAL_EVIDENCE_DIGEST');
    const original=JSON.parse(originalBytes.toString('utf8').replace(/^\uFEFF/,''));
    if(!equal(original.selection,request.selection)||!equal(original.deployment,request.originalDeployment.deployment)||original.deployCount!==1
      ||snapshotKeys.some(key=>original.postimage?.[key]!==request.expected[key]))stop('READBACK_ORIGINAL_EVIDENCE_BINDING');stages.push(stage);
    stage='artifact-before';const plan=assertArtifact(await artifact.load(),request.selection),planHash=hashBytes(JSON.stringify(plan));
    artifactBefore={consumer:artifact.kind,planSha256:planHash,headersSha256:hashBytes(plan.headers),targets:plan.targets.length};stages.push(stage);
    stage='provider-setup';const context=structuredClone(validateManualContext(input.context));
    if(context.accountId!==request.expected.accountId)stop('READBACK_ACCOUNT_MISMATCH');
    const transport=input.fetchImpl??fetch;
    const getOnly=async(url,options)=>{
      if(options?.method!=='GET'||options.body!==undefined)stop('READBACK_NON_GET_FORBIDDEN');
      network.requests++;if(new URL(url).origin==='https://api.cloudflare.com')network.providerRequests++;else network.publicRequests++;
      return transport(url,options);
    };
    const provider=createManualProvider({context,readonlyCredential:input.readonlyCredential,deployCredential:input.deployCredential,fetchImpl:getOnly,clock});
    const publicReader=createPublicReadback({fetchImpl:getOnly,clock,...input.wait?{wait:input.wait}:{}});stages.push(stage);
    stage='token-before';tokenBefore=await provider.verifyDeployToken();stages.push(stage);
    stage='provider-before';beforeSnapshot=await provider.snapshot();assertSnapshot(beforeSnapshot,request.expected,clock());stages.push(stage);
    stage='public-before';beforePublic=await publicReader.before(beforeSnapshot);
    const home=plan.targets.find(row=>row.path==='/');
    if(beforePublic.publicStatus!==200||beforePublic.homeSha256!==home.sha256||beforePublic.workersDevStatus!==404||beforePublic.previewStatus!==404)stop('READBACK_BEFORE_PUBLIC_MISMATCH');stages.push(stage);
    stage='public-readback';report=await publicReader.published(plan,beforeSnapshot,()=>provider.assertSameVersion(beforeSnapshot));
    assertReadback(report,plan,request.expected.versionId);stages.push(stage);
    stage='provider-after';afterSnapshot=await provider.snapshot();assertSnapshot(afterSnapshot,request.expected,clock());
    if(afterSnapshot.readonlyTokenId!==beforeSnapshot.readonlyTokenId)stop('READBACK_READONLY_IDENTITY_CHANGED');stages.push(stage);
    stage='artifact-after';const repeated=assertArtifact(await artifact.load(),request.selection);
    artifactAfter={consumer:artifact.kind,planSha256:hashBytes(JSON.stringify(repeated)),headersSha256:hashBytes(repeated.headers),targets:repeated.targets.length};
    if(artifactAfter.planSha256!==planHash)stop('READBACK_STAGING_OR_TARGETS_CHANGED');stages.push(stage);
    stage='token-final';tokenAfter=await provider.verifyDeployToken();
    if(tokenSignature(tokenBefore)!==tokenSignature(tokenAfter))stop('READBACK_FINAL_TOKEN_CHANGED');stages.push(stage);
    stage='complete';outcome=result('READBACK_ONLY_CHECKS_PASSED',null);
  }catch(error){
    report=publicReadbackReport(error)??report;
    const code=readbackArtifactFailure(error)??(error instanceof ReadbackError||error instanceof ManualDeployError&&providerCodes.has(error.message)?error.message:'READBACK_STAGE_FAILED');
    outcome=result(incompleteCodes.has(code)?'READBACK_ONLY_INCOMPLETE':'READBACK_ONLY_FAILED',code);
  }
  if(outputPath){
    try{await writeFile(outputPath,JSON.stringify(outcome,null,2)+'\n',{flag:'wx',encoding:'utf8'});return {...outcome,evidenceSaved:true};}
    catch{return {...outcome,status:'READBACK_ONLY_INCOMPLETE',code:'READBACK_EVIDENCE_NOT_SAVED',stage:'persist',evidenceSaved:false};}
  }
  return {...outcome,evidenceSaved:false};
}
