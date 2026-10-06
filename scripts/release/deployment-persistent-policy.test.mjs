import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {persistentPolicy,validatePersistentToken,validateProductionProtection,assessPersistentOperation,assessPersistentRotation} from './deployment-persistent-policy.mjs';
const now=Date.parse('2026-10-06T12:02:00Z'),day=86400000;
const at=offset=>new Date(now+offset).toISOString();
const accountId='a'.repeat(32),workerTag='b'.repeat(32),permissionGroupId='c'.repeat(32),tokenId='d'.repeat(32),sourceSha='e'.repeat(40);
const context={accountId,workerTag,permissionGroupId,tokenId,actor:'Xpotato1024'};
function token(offset=-60000){return {observedAt:at(offset),accountId,workerTag,tokenId,status:'active',issuedOn:at(-30*day),notBefore:at(-30*day),expiresOn:at(60*day),policyCount:1,effect:'allow',permissionGroupIds:[permissionGroupId],resourceScope:'individual-worker',additionalPolicyCount:0}}
function protection(){return {observedAt:at(-60000),repository:'Xpotato1024/xpotato-site',visibility:'public',ownerType:'User',mainProtected:true,forcePushAllowed:false,deletionAllowed:false,requirePullRequest:true,requiredReviewCount:0,requiredChecks:['result','offline-policy'],strictChecks:true,checksAppId:15368,enforceAdmins:true,environment:'site-production',environmentBranches:['main'],environmentTags:[],requiredReviewers:['Xpotato1024'],preventSelfReview:false,adminBypass:false,credentialLocation:'environment-secret',workflowEvent:'workflow_dispatch',workflowRef:'refs/heads/main',actor:'Xpotato1024'}}
function provider(offset=-60000){return {observedAt:at(offset),complete:true,accountId,worker:'xpotato-site',workerTag,deploymentId:'old-deployment',versionId:'old-version',trafficPercent:100,bindings:[],routes:[],hostname:'xpotato.net',workersDev:false,previewUrls:false,publicHealth:{status:200,bytesMatch:true},alternateEndpoints:{workersDevStatus:404,actualVersionPreviewStatus:404,siteContentPresent:false}}}
function revoke(){return {observedAt:at(-10000),tokenId,revokeSuccess:true,inventoryComplete:true,inventoryContainsToken:false,detailStatus:404}}
function evidence(){return {selection:{runId:'2',runAttempt:1,artifactId:'3',sourceSha,digest:'sha256:'+'f'.repeat(64)},context,protection:protection(),token:token(),preimage:provider(),containment:{observedAt:at(-60000),independentOfDeployToken:true,capabilityVerified:true,separatelyAuthorized:true},handoff:{mode:'Production',sourceSha,archiveVerified:true,stagingVerified:true,configPath:'apps/site/wrangler.jsonc',wranglerVersion:'4.136.1',buildCount:0},deployment:{startedAt:at(-50000),completedAt:at(-40000),count:1,exitCode:0,deploymentId:'new-deployment',versionId:'new-version',tokenId},postimage:{...provider(-30000),deploymentId:'new-deployment',versionId:'new-version'},credentialReadback:token(-20000),emergencyRevocation:null}}

test('B retains a 30-day-old exact token; it does not apply JIT issue/revoke rules',()=>{
 const result=validatePersistentToken(token(),context,now);assert.equal(result.perOperationRevoke,false);assert.equal(result.credentialMode,'PERSISTENT_EXPIRING');assert.equal(persistentPolicy.approvalStatus,'CREDENTIAL_NOT_AUTHORIZED');
});
test('90-day maximum, 60-day rotation and 7-day minimum remaining lifetime fail closed',()=>{
 for(const patch of [{expiresOn:at(60*day+1)},{issuedOn:at(-60*day),notBefore:at(-60*day),expiresOn:at(30*day)},{expiresOn:at(7*day-1)},{issuedOn:at(1)},{notBefore:at(1)},{expiresOn:at(-1)},{expiresOn:null}])assert.throws(()=>validatePersistentToken({...token(),...patch},context,now),/PERSISTENT_TOKEN/);
 assert.equal(validatePersistentToken({...token(),expiresOn:at(7*day)},context,now).perOperationRevoke,false);
});
test('broad scope, extra roles, other Worker or changed token ID cannot be stored as B',()=>{
 for(const patch of [{accountId:'0'.repeat(32)},{workerTag:'0'.repeat(32)},{tokenId:'0'.repeat(32)},{resourceScope:'account-wide'},{policyCount:2},{additionalPolicyCount:1},{permissionGroupIds:[permissionGroupId,'0'.repeat(32)]},{status:'disabled'}])assert.throws(()=>validatePersistentToken({...token(),...patch},context,now),/PERSISTENT_TOKEN_SCOPE/);
});
test('metadata remains nonsecret and cannot accept or reflect a secret field',()=>{
 assert.throws(()=>validatePersistentToken({...token(),value:'synthetic-secret'},context,now),/^Error: INVALID_PERSISTENT_TOKEN_FIELDS$/);
 assert.throws(()=>validatePersistentToken(token(1),context,now),/STALE/);
});
test('sole owner can dispatch and explicitly approve without admin bypass or second person claim',()=>{
 assert.deepEqual(validateProductionProtection(protection(),'Xpotato1024',now),{reviewModel:'SOLE_OWNER_EXPLICIT_ENVIRONMENT_APPROVAL',twoPersonApproval:false});
 for(const patch of [{preventSelfReview:true},{requiredReviewers:[]},{adminBypass:true},{environmentBranches:['*']},{environmentTags:['main']},{credentialLocation:'repository-secret'},{workflowEvent:'pull_request'},{workflowRef:'refs/heads/feature'},{actor:'other'}])assert.throws(()=>validateProductionProtection({...protection(),...patch},'Xpotato1024',now));
});
test('current unprotected main and missing required checks are rejected',()=>{
 for(const patch of [{mainProtected:false},{forcePushAllowed:true},{deletionAllowed:true},{requirePullRequest:false},{requiredReviewCount:1},{requiredChecks:['result']},{checksAppId:0},{strictChecks:false},{enforceAdmins:false}])assert.throws(()=>validateProductionProtection({...protection(),...patch},'Xpotato1024',now));
});
test('synthetic B success retains token but cannot grant live acceptance',()=>{
 const result=assessPersistentOperation(evidence(),now);assert.equal(result.status,'PERSISTENT_EVIDENCE_CONSISTENT');assert.equal(result.acceptance,false);assert.equal(result.credentialLifecycle,'ACTIVE_UNTIL_REVIEWED_ROTATION');
});
test('B handoff still forbids candidates, changed source, alternate config and rebuild',()=>{
 for(const patch of [{mode:'Candidate'},{sourceSha:'0'.repeat(40)},{archiveVerified:false},{stagingVerified:false},{configPath:'other.jsonc'},{wranglerVersion:'latest'},{buildCount:1}]){const e=evidence();Object.assign(e.handoff,patch);assert.throws(()=>assessPersistentOperation(e,now),/HANDOFF/)}
});
test('R2 binding, endpoint drift, wrong version and unknown postcheck require emergency revoke',()=>{
 for(const patch of [{bindings:[{type:'r2_bucket'}]},{previewUrls:true},{versionId:'unexpected'},{complete:false}]){const e=evidence();Object.assign(e.postimage,patch);assert.throws(()=>assessPersistentOperation(e,now),/INVALID_EMERGENCY_REVOCATION/);e.emergencyRevocation=revoke();assert.equal(assessPersistentOperation(e,now).containmentRequired,true)}
});
test('deployment failure requires independent containment and proven same-ID revoke',()=>{
 const e=evidence();e.deployment.exitCode=1;e.emergencyRevocation=revoke();assert.equal(assessPersistentOperation(e,now).rollbackAuthorization,false);
 for(const patch of [{tokenId:'0'.repeat(32)},{revokeSuccess:false},{inventoryComplete:false},{inventoryContainsToken:true},{detailStatus:403},{observedAt:at(-45000)}]){e.emergencyRevocation={...revoke(),...patch};assert.throws(()=>assessPersistentOperation(e,now),/REVOCATION/)}
 e.emergencyRevocation=revoke();e.containment.independentOfDeployToken=false;assert.throws(()=>assessPersistentOperation(e,now),/CONTAINMENT/);
});
test('successful credential readback must be same ID, policy, expiry and after public postcheck',()=>{
 for(const patch of [{tokenId:'0'.repeat(32)},{expiresOn:at(59*day)},{observedAt:at(-35000)},{permissionGroupIds:['0'.repeat(32)]}]){const e=evidence();Object.assign(e.credentialReadback,patch);assert.throws(()=>assessPersistentOperation(e,now))}
});
test('preflight timestamp is evaluated at mutation, not a later reporting time',()=>{
 const e=evidence();e.protection.observedAt=e.token.observedAt=e.preimage.observedAt=e.containment.observedAt=at(-600000);e.deployment.startedAt=at(-590000);assert.equal(assessPersistentOperation(e,now).acceptance,false);e.token.observedAt=at(-720001);assert.throws(()=>assessPersistentOperation(e,now),/STALE/);
});
test('all official actions use reviewed full SHA and checkout never persists credentials',()=>{
 const pins={'actions/checkout':'11d5960a326750d5838078e36cf38b85af677262','actions/setup-node':'49933ea5288caeca8642d1e84afbd3f7d6820020','actions/upload-artifact':'ea165f8d65b6e75b540449e92b4886f43607fa02'};
 const root=new URL('../../.github/workflows/',import.meta.url);
 for(const file of readdirSync(root).filter(f=>f.endsWith('.yml'))){const workflow=readFileSync(new URL(file,root),'utf8');for(const [,action,pin] of workflow.matchAll(/uses: (actions\/[a-z-]+)@([^\s]+)/g))assert.equal(pin,pins[action],file);for(const block of workflow.split(/- uses: actions\/checkout@/).slice(1))assert.match(block.split(/\n\s*- (?:name:|uses:|run:|id:)/)[0],/persist-credentials: false/,file)}
});
test('PR CI cannot access production Environment, secrets, untrusted privileged events or self-hosted runner',()=>{
 for(const name of ['ci.yml','production-path-review.yml','phase6-media-readiness.yml','legacy-reproduction.yml','legacy-visual-performance-baseline.yml']){const text=readFileSync(new URL(`../../.github/workflows/${name}`,import.meta.url),'utf8');assert.ok(!/secrets\.|environment:|pull_request_target|workflow_run:|self-hosted|id-token:|contents: write/.test(text),name)}
 const review=readFileSync(new URL('../../.github/workflows/production-path-review.yml',import.meta.url),'utf8');assert.ok(!/paths:/.test(review),'required offline-policy must run on every PR');
 const prod=readFileSync(new URL('../../.github/workflows/deploy-site.yml',import.meta.url),'utf8');assert.equal((prod.match(/if: \$\{\{ false \}\}/g)||[]).length,3);assert.match(prod,/environment: site-production/);assert.match(prod,/cancel-in-progress: false/);assert.ok(!/secrets\./.test(prod));assert.match(prod,/needs: release-review/);
});
test('settings proposal has no secret values and preserves deployability for sole owner',()=>{
 const p=JSON.parse(readFileSync(new URL('../../docs/operations/production-settings-proposal.json',import.meta.url),'utf8'));assert.equal(p.status,'SETTINGS_APPLIED_TOKEN_NOT_AUTHORIZED');assert.equal(p.workflowActivation,false);assert.equal(p.mainProtection.required_pull_request_reviews.required_approving_review_count,0);assert.equal(p.environment.prevent_self_review,false);assert.equal(p.environment.can_admins_bypass,false);assert.deepEqual(p.environment.branchPolicies,[{name:'main',type:'branch'}]);assert.deepEqual(p.environment.secretNames,['CLOUDFLARE_SITE_API_TOKEN']);assert.equal(p.token.expiresAfterDays,persistentPolicy.maximumLifetimeDays);
});
test('rotation requires new ID, fresh issuance, authorized Environment update and old-ID absence',()=>{
 const oldId='1'.repeat(32);
 const fixture=()=>({previousTokenId:oldId,newToken:{...token(),issuedOn:at(-60000),notBefore:at(-60000),expiresOn:at(90*day-60000)},context,secretUpdate:{environment:'site-production',secretName:'CLOUDFLARE_SITE_API_TOKEN',tokenId,completedAt:at(-30000),separatelyAuthorized:true,successful:true},previousRevocation:{...revoke(),tokenId:oldId}});
 assert.equal(assessPersistentRotation(fixture(),now).acceptance,false);
 for(const patch of [{environment:'other'},{tokenId:oldId},{completedAt:at(-61000)},{successful:false},{separatelyAuthorized:false}]){const e=fixture();Object.assign(e.secretUpdate,patch);assert.throws(()=>assessPersistentRotation(e,now),/SECRET_UPDATE/)}
 for(const patch of [{inventoryComplete:false},{detailStatus:403},{tokenId},{observedAt:at(-35000)}]){const e=fixture();Object.assign(e.previousRevocation,patch);assert.throws(()=>assessPersistentRotation(e,now),/REVO[CK]/)}
 const e=fixture();e.previousTokenId=tokenId;assert.throws(()=>assessPersistentRotation(e,now),/NEW_ID/);e.previousTokenId=oldId;e.newToken=token();assert.throws(()=>assessPersistentRotation(e,now),/FRESH_ISSUANCE/);
});
