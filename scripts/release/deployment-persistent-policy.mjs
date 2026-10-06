// Mode B is an explicitly selected design, not permission to issue credentials,
// configure GitHub or deploy. Pure nonsecret evidence gates; no provider writes.
import {validateSelection,validateProviderSnapshot,validateRevocation,authority} from './deployment-policy.mjs';
const fail=code=>{throw Error(code)};
const exact=(v,keys,code)=>{if(!v||Array.isArray(v)||typeof v!=='object'||Object.keys(v).sort().join('|')!==[...keys].sort().join('|'))fail(code)};
const id=v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
const timestamp=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v)&&Number.isFinite(Date.parse(v));
const fresh=(v,now)=>{if(!timestamp(v)||Date.parse(v)>now||now-Date.parse(v)>120000)fail('STALE_PERSISTENT_EVIDENCE')};
export const persistentPolicy=Object.freeze({mode:'B',environment:'site-production',secretName:'CLOUDFLARE_SITE_API_TOKEN',maximumLifetimeDays:90,rotationDueDays:60,minimumRemainingDays:7,approvalStatus:'CREDENTIAL_NOT_AUTHORIZED'});

export function validatePersistentToken(token,expected,now=Date.now()){
 exact(token,['observedAt','accountId','tokenId','status','issuedOn','notBefore','expiresOn','policyCount','effect','permissionGroupIds','workerTag','resourceScope','additionalPolicyCount'],'INVALID_PERSISTENT_TOKEN_FIELDS');
 fresh(token.observedAt,now);
 if(!id(expected.accountId)||!id(expected.workerTag)||!id(expected.permissionGroupId)||!id(expected.tokenId)||token.accountId!==expected.accountId||token.tokenId!==expected.tokenId||token.workerTag!==expected.workerTag||token.status!=='active'||token.resourceScope!=='individual-worker'||token.policyCount!==1||token.effect!=='allow'||token.additionalPolicyCount!==0||!Array.isArray(token.permissionGroupIds)||token.permissionGroupIds.length!==1||token.permissionGroupIds[0]!==expected.permissionGroupId)fail('PERSISTENT_TOKEN_SCOPE');
 if(!timestamp(token.issuedOn)||!timestamp(token.notBefore)||!timestamp(token.expiresOn))fail('PERSISTENT_TOKEN_TIME');
 const issued=Date.parse(token.issuedOn),start=Date.parse(token.notBefore),expiry=Date.parse(token.expiresOn),day=86400000;
 if(issued>now||start>now||expiry-issued>persistentPolicy.maximumLifetimeDays*day||expiry<=issued||expiry-now<persistentPolicy.minimumRemainingDays*day||now-issued>=persistentPolicy.rotationDueDays*day)fail('PERSISTENT_TOKEN_ROTATION_REQUIRED');
 return {tokenId:token.tokenId,credentialMode:'PERSISTENT_EXPIRING',perOperationRevoke:false,rotationDueAt:new Date(issued+60*day).toISOString(),expiresOn:token.expiresOn};
}

export function assessPersistentRotation(evidence,now=Date.now()){
 exact(evidence,['previousTokenId','newToken','context','secretUpdate','previousRevocation'],'INVALID_ROTATION_FIELDS');
 const {previousTokenId,newToken,context,secretUpdate,previousRevocation}=evidence;
 if(!id(previousTokenId)||previousTokenId===context.tokenId)fail('ROTATION_REQUIRES_NEW_ID');
 validatePersistentToken(newToken,context,now);
 if(now-Date.parse(newToken.issuedOn)>900000)fail('ROTATION_REQUIRES_FRESH_ISSUANCE');
 exact(secretUpdate,['environment','secretName','tokenId','completedAt','separatelyAuthorized','successful'],'INVALID_SECRET_UPDATE');
 if(secretUpdate.environment!==persistentPolicy.environment||secretUpdate.secretName!==persistentPolicy.secretName||secretUpdate.tokenId!==context.tokenId||secretUpdate.separatelyAuthorized!==true||secretUpdate.successful!==true||!timestamp(secretUpdate.completedAt)||Date.parse(secretUpdate.completedAt)<Date.parse(newToken.observedAt)||Date.parse(secretUpdate.completedAt)>now)fail('SECRET_UPDATE_NOT_PROVEN');
 validateRevocation(previousRevocation,previousTokenId,now);
 if(Date.parse(previousRevocation.observedAt)<Date.parse(secretUpdate.completedAt))fail('ROTATION_REVOKE_ORDER');
 return {status:'ROTATION_EVIDENCE_CONSISTENT',acceptance:false,oldCredential:'REVOKED',limitations:'Offline only; no token issuance, secret write or provider mutation.'};
}

export function validateProductionProtection(protection,expectedActor,now=Date.now()){
 exact(protection,['observedAt','repository','visibility','ownerType','mainProtected','forcePushAllowed','deletionAllowed','requirePullRequest','requiredReviewCount','requiredChecks','strictChecks','checksAppId','enforceAdmins','environment','environmentBranches','environmentTags','requiredReviewers','preventSelfReview','adminBypass','credentialLocation','workflowEvent','workflowRef','actor'],'INVALID_PROTECTION_FIELDS');
 fresh(protection.observedAt,now);
 if(protection.repository!==authority.repository||protection.visibility!=='public'||protection.ownerType!=='User'||expectedActor!=='Xpotato1024'||protection.actor!==expectedActor||protection.mainProtected!==true||protection.forcePushAllowed!==false||protection.deletionAllowed!==false||protection.requirePullRequest!==true||protection.requiredReviewCount!==0||protection.strictChecks!==true||protection.checksAppId!==15368||protection.enforceAdmins!==true)fail('MAIN_PROTECTION_REQUIRED');
 if(!Array.isArray(protection.requiredChecks)||protection.requiredChecks.length!==2||!['result','offline-policy'].every(c=>protection.requiredChecks.includes(c)))fail('REQUIRED_CHECKS_MISMATCH');
 if(protection.environment!==persistentPolicy.environment||JSON.stringify(protection.environmentBranches)!=='["main"]'||JSON.stringify(protection.environmentTags)!=='[]'||JSON.stringify(protection.requiredReviewers)!==JSON.stringify([expectedActor])||protection.preventSelfReview!==false||protection.adminBypass!==false||protection.credentialLocation!=='environment-secret'||protection.workflowEvent!=='workflow_dispatch'||protection.workflowRef!=='refs/heads/main')fail('ENVIRONMENT_PROTECTION_REQUIRED');
 return {reviewModel:'SOLE_OWNER_EXPLICIT_ENVIRONMENT_APPROVAL',twoPersonApproval:false};
}

export function assessPersistentOperation(evidence,now=Date.now()){
 exact(evidence,['selection','context','protection','token','preimage','containment','handoff','deployment','postimage','credentialReadback','emergencyRevocation'],'INVALID_PERSISTENT_OPERATION_FIELDS');
 const {selection,context,protection,token,preimage,containment,handoff,deployment,postimage,credentialReadback,emergencyRevocation}=evidence;
 validateSelection(selection);
 exact(context,['accountId','workerTag','permissionGroupId','tokenId','actor'],'INVALID_PERSISTENT_CONTEXT');
 exact(deployment,['startedAt','completedAt','count','exitCode','deploymentId','versionId','tokenId'],'INVALID_PERSISTENT_DEPLOYMENT');
 if(!timestamp(deployment.startedAt)||!timestamp(deployment.completedAt)||Date.parse(deployment.completedAt)<Date.parse(deployment.startedAt)||Date.parse(deployment.completedAt)>now||deployment.count!==1||deployment.tokenId!==context.tokenId)fail('PERSISTENT_DEPLOYMENT_ORDER');
 const mutationTime=Date.parse(deployment.startedAt);
 validateProductionProtection(protection,context.actor,mutationTime);
 validatePersistentToken(token,context,mutationTime);
 validateProviderSnapshot(preimage,context,mutationTime);
 exact(containment,['observedAt','independentOfDeployToken','capabilityVerified','separatelyAuthorized'],'INVALID_PERSISTENT_CONTAINMENT');
 fresh(containment.observedAt,mutationTime);
 if(containment.independentOfDeployToken!==true||containment.capabilityVerified!==true||containment.separatelyAuthorized!==true)fail('PERSISTENT_CONTAINMENT_NOT_READY');
 exact(handoff,['mode','sourceSha','archiveVerified','stagingVerified','configPath','wranglerVersion','buildCount'],'INVALID_PERSISTENT_HANDOFF');
 if(handoff.mode!=='Production'||handoff.sourceSha!==selection.sourceSha||handoff.archiveVerified!==true||handoff.stagingVerified!==true||handoff.configPath!=='apps/site/wrangler.jsonc'||handoff.wranglerVersion!==authority.wrangler||handoff.buildCount!==0)fail('PERSISTENT_HANDOFF_NOT_PROVEN');
 let postcheck=false;
 if(deployment.exitCode===0){try {validateProviderSnapshot(postimage,context,now);postcheck=postimage.deploymentId===deployment.deploymentId&&postimage.versionId===deployment.versionId&&Date.parse(postimage.observedAt)>=Date.parse(deployment.completedAt);}catch{postcheck=false}}
 if(!postcheck){
  exact(emergencyRevocation,['observedAt','tokenId','revokeSuccess','inventoryComplete','inventoryContainsToken','detailStatus'],'INVALID_EMERGENCY_REVOCATION');
  fresh(emergencyRevocation.observedAt,now);
  if(emergencyRevocation.tokenId!==context.tokenId||emergencyRevocation.revokeSuccess!==true||emergencyRevocation.inventoryComplete!==true||emergencyRevocation.inventoryContainsToken!==false||emergencyRevocation.detailStatus!==404||Date.parse(emergencyRevocation.observedAt)<Date.parse(deployment.completedAt))fail('EMERGENCY_REVOCATION_NOT_PROVEN');
  return {status:'FAILED_REVOKED_CONTAINMENT_REQUIRED',acceptance:false,containmentRequired:true,rollbackAuthorization:false};
 }
 if(emergencyRevocation!==null)fail('UNEXPECTED_REVOCATION_ON_SUCCESS');
 validatePersistentToken(credentialReadback,context,now);
 if(Date.parse(credentialReadback.observedAt)<Date.parse(postimage.observedAt)||['issuedOn','notBefore','expiresOn'].some(key=>credentialReadback[key]!==token[key]))fail('PERSISTENT_CREDENTIAL_CHANGED');
 return {status:'PERSISTENT_EVIDENCE_CONSISTENT',acceptance:false,credentialLifecycle:'ACTIVE_UNTIL_REVIEWED_ROTATION',limitations:'Offline only. Authenticated provider/protection adapters, approval proof, deploy and independent revoke supervisor are not connected.'};
}
