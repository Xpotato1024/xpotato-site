// Review-only gates. No credential value, network, process or provider mutation API.
export const authority = Object.freeze({repository:'Xpotato1024/xpotato-site',serverSha:'c54a06ee377cae365af623b598ed852c4b577e1f',worker:'xpotato-site',hostname:'xpotato.net',workflow:'.github/workflows/ci.yml',wrangler:'4.136.1'});
const fail=code=>{throw new Error(code)};
const exact=(value,keys,code)=>{if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).sort().join('|')!==[...keys].sort().join('|'))fail(code)};
const positive=value=>typeof value==='string'&&/^[1-9][0-9]*$/.test(value);
const sha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const digest=value=>typeof value==='string'&&/^sha256:[a-f0-9]{64}$/.test(value);
const time=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)&&Number.isFinite(Date.parse(value));
const recent=(value,now,max=120000)=>{if(!time(value)||Date.parse(value)>now||now-Date.parse(value)>max)fail('STALE_OR_INVALID_OBSERVATION')};

export function validateSelection(selection){
 exact(selection,['artifactId','digest','runId','runAttempt','sourceSha'],'INVALID_SELECTION_FIELDS');
 if(!positive(selection.artifactId)||!positive(selection.runId)||!Number.isSafeInteger(selection.runAttempt)||selection.runAttempt<1||!sha(selection.sourceSha)||!digest(selection.digest))fail('INVALID_SELECTION');
 return selection;
}

export function deriveReleaseReview(selection,run,artifact,now=Date.now()){
 validateSelection(selection);
 if(run.repository?.full_name!==authority.repository||String(run.id)!==selection.runId||run.run_attempt!==selection.runAttempt||run.head_sha!==selection.sourceSha||run.path!==authority.workflow||run.head_branch!=='main'||run.event!=='push'||run.status!=='completed'||run.conclusion!=='success')fail('NOT_SUCCESSFUL_EXACT_MAIN_PRODUCER');
 if(String(artifact.id)!==selection.artifactId||artifact.name!==`site-release-${selection.runId}-${selection.runAttempt}`||artifact.digest!==selection.digest||artifact.expired!==false||!time(artifact.expires_at)||Date.parse(artifact.expires_at)<=now||artifact.workflow_run?.id!==run.id||artifact.workflow_run?.head_sha!==selection.sourceSha)fail('ARTIFACT_IDENTITY_OR_RETENTION_MISMATCH');
 return {schemaVersion:1,status:'BLOCKED_SETTINGS_AND_LIVE_ADAPTERS',selection:{...selection},repository:authority.repository,serverAuthoritySha:authority.serverSha,observedAt:new Date(now).toISOString(),productionEligible:true,archiveAndStagingVerification:'REQUIRED_CANONICAL_POWERSHELL_CONSUMER',authentication:'B_SELECTED_SETTINGS_NOT_AUTHORIZED',workflowActivation:false,providerMutations:0,buildCount:0,requiredGates:['canonical-production-handoff','accepted-authentication-design','operation-authorization','fresh-preimage-and-containment','exact-token-policy','postdeploy-and-endpoint-readback','same-token-revocation-and-absence'],limitations:'Metadata review is not archive verification, provider verification, authorization or deployment.'};
}

// Explicit normalized contract for a future authenticated adapter. It is not a raw
// Cloudflare response, nor proof that an operator-supplied JSON is authentic.
export function validateProviderSnapshot(snapshot,expected,now=Date.now()){
 exact(snapshot,['observedAt','complete','accountId','worker','workerTag','deploymentId','versionId','trafficPercent','bindings','routes','hostname','workersDev','previewUrls','publicHealth','alternateEndpoints'],'INVALID_PROVIDER_FIELDS');
 recent(snapshot.observedAt,now);
 if(snapshot.complete!==true||snapshot.accountId!==expected.accountId||snapshot.worker!==authority.worker||snapshot.workerTag!==expected.workerTag||!/^[a-f0-9]{32}$/.test(snapshot.workerTag)||!snapshot.deploymentId||!snapshot.versionId||snapshot.trafficPercent!==100)fail('PROVIDER_IDENTITY_OR_TRAFFIC');
 if(!Array.isArray(snapshot.bindings)||snapshot.bindings.length!==0||!Array.isArray(snapshot.routes)||snapshot.routes.length!==0||snapshot.hostname!==authority.hostname||snapshot.workersDev!==false||snapshot.previewUrls!==false)fail('PROVIDER_BINDING_OR_ENDPOINT_DRIFT');
 exact(snapshot.publicHealth,['status','bytesMatch'],'INVALID_HEALTH_FIELDS');
 exact(snapshot.alternateEndpoints,['workersDevStatus','actualVersionPreviewStatus','siteContentPresent'],'INVALID_ENDPOINT_FIELDS');
 if(snapshot.publicHealth.status!==200||snapshot.publicHealth.bytesMatch!==true||snapshot.alternateEndpoints.workersDevStatus!==404||snapshot.alternateEndpoints.actualVersionPreviewStatus!==404||snapshot.alternateEndpoints.siteContentPresent!==false)fail('PUBLIC_OR_ALTERNATE_ENDPOINT_FAILURE');
 return {deploymentId:snapshot.deploymentId,versionId:snapshot.versionId};
}

export function validateTokenMetadata(token,expected,now=Date.now()){
 exact(token,['observedAt','accountId','tokenId','status','issuedOn','notBefore','expiresOn','policyCount','effect','permissionGroupIds','workerTag','resourceScope','additionalPolicyCount'],'INVALID_TOKEN_METADATA_FIELDS');
 recent(token.observedAt,now);
 if(token.accountId!==expected.accountId||!positive(expected.runId)||!/^[a-f0-9]{32}$/.test(token.tokenId)||token.status!=='active'||token.policyCount!==1||token.effect!=='allow'||token.additionalPolicyCount!==0||token.resourceScope!=='individual-worker'||token.workerTag!==expected.workerTag||!/^[a-f0-9]{32}$/.test(token.workerTag))fail('TOKEN_SCOPE_MISMATCH');
 if(!/^[a-f0-9]{32}$/.test(expected.permissionGroupId)||!Array.isArray(token.permissionGroupIds)||token.permissionGroupIds.length!==1||token.permissionGroupIds[0]!==expected.permissionGroupId)fail('TOKEN_PERMISSION_MISMATCH');
 if(!time(token.issuedOn)||!time(token.notBefore)||!time(token.expiresOn)||Date.parse(token.issuedOn)>now||now-Date.parse(token.issuedOn)>900000||Date.parse(token.notBefore)>now||Date.parse(token.notBefore)>Date.parse(token.issuedOn)||Date.parse(token.expiresOn)<=now||Date.parse(token.expiresOn)-Date.parse(token.issuedOn)>86400000)fail('TOKEN_LIFETIME_INVALID');
 return {tokenId:token.tokenId,revokeRequired:true};
}

export function validateRevocation(receipt,tokenId,now=Date.now()){
 exact(receipt,['observedAt','tokenId','revokeSuccess','inventoryComplete','inventoryContainsToken','detailStatus'],'INVALID_REVOCATION_FIELDS');
 recent(receipt.observedAt,now);
 if(receipt.tokenId!==tokenId||receipt.revokeSuccess!==true||receipt.inventoryComplete!==true||receipt.inventoryContainsToken!==false||receipt.detailStatus!==404)fail('REVOCATION_NOT_PROVEN');
 return true;
}

export function assessOperationEvidence(evidence,now=Date.now()){
 exact(evidence,['context','preimage','token','containment','handoff','deployment','postimage','revocation'],'INVALID_OPERATION_FIELDS');
 const {context,preimage,token,containment,handoff,deployment,postimage,revocation}=evidence;
 exact(context,['accountId','workerTag','permissionGroupId','runId','sourceSha'],'INVALID_CONTEXT');
 if(!/^[a-f0-9]{32}$/.test(context.accountId)||!sha(context.sourceSha))fail('INVALID_CONTEXT');
 exact(deployment,['startedAt','completedAt','count','exitCode','deploymentId','versionId','tokenId'],'INVALID_DEPLOYMENT');
 if(!time(deployment.startedAt)||!time(deployment.completedAt)||deployment.count!==1||deployment.tokenId!==token.tokenId||Date.parse(deployment.completedAt)<Date.parse(deployment.startedAt)||Date.parse(deployment.completedAt)>now)fail('DEPLOYMENT_ORDER_OR_IDENTITY');
 const mutationTime=Date.parse(deployment.startedAt);
 validateProviderSnapshot(preimage,context,mutationTime);
 validateTokenMetadata(token,context,mutationTime);
 exact(containment,['observedAt','independentOfDeployToken','capabilityVerified','separatelyAuthorized'],'INVALID_CONTAINMENT');
 recent(containment.observedAt,mutationTime);
 if(containment.independentOfDeployToken!==true||containment.capabilityVerified!==true||containment.separatelyAuthorized!==true)fail('CONTAINMENT_NOT_READY');
 exact(handoff,['mode','sourceSha','archiveVerified','stagingVerified','configPath','wranglerVersion','buildCount'],'INVALID_HANDOFF');
 if(handoff.mode!=='Production'||handoff.sourceSha!==context.sourceSha||handoff.archiveVerified!==true||handoff.stagingVerified!==true||handoff.configPath!=='apps/site/wrangler.jsonc'||handoff.wranglerVersion!==authority.wrangler||handoff.buildCount!==0)fail('HANDOFF_NOT_PROVEN');
 // Even unsuccessful/unknown deployment must have same-ID revocation evidence.
 validateRevocation(revocation,token.tokenId,now);
 if(Date.parse(revocation.observedAt)<Date.parse(deployment.completedAt))fail('REVOCATION_ORDER');
 if(deployment.exitCode!==0)return {status:'DEPLOY_FAILED_REVOKED',acceptance:false,rollbackAuthorization:false};
 try {validateProviderSnapshot(postimage,context,now);}catch{return {status:'POSTCHECK_FAILED_REVOKED',acceptance:false,containmentRequired:true,rollbackAuthorization:false};}
 if(postimage.deploymentId!==deployment.deploymentId||postimage.versionId!==deployment.versionId||Date.parse(postimage.observedAt)<Date.parse(deployment.completedAt))fail('POSTDEPLOY_VERSION_OR_ORDER');
 if(Date.parse(revocation.observedAt)<Date.parse(postimage.observedAt))fail('REVOCATION_BEFORE_SUCCESSFUL_READBACK');
 return {status:'EVIDENCE_CONSISTENT',acceptance:false,credentialLifecycle:'REVOKED',limitations:'Offline consistency only. Authenticated adapters, signed human authorization and live acceptance are not implemented.'};
}
