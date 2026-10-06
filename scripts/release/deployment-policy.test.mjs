import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deriveReleaseReview,validateProviderSnapshot,validateTokenMetadata,validateRevocation,assessOperationEvidence,authority} from './deployment-policy.mjs';
const now=Date.parse('2026-10-06T12:02:00Z');
const at=offset=>new Date(now+offset).toISOString();
const sha='a'.repeat(40),tag='b'.repeat(32),account='c'.repeat(32),permission='d'.repeat(32),tokenId='e'.repeat(32);
const selection={artifactId:'3',digest:'sha256:'+'f'.repeat(64),runId:'2',runAttempt:1,sourceSha:sha};
const run={repository:{full_name:authority.repository},id:2,run_attempt:1,head_sha:sha,path:authority.workflow,head_branch:'main',event:'push',status:'completed',conclusion:'success'};
const artifact={id:3,name:'site-release-2-1',digest:selection.digest,expired:false,expires_at:at(86400000),workflow_run:{id:2,head_sha:sha}};
const context={accountId:account,workerTag:tag,permissionGroupId:permission,runId:'2',sourceSha:sha};
function provider(offset=-60000){return {observedAt:at(offset),complete:true,accountId:account,worker:authority.worker,workerTag:tag,deploymentId:'deployment-old',versionId:'version-old',trafficPercent:100,bindings:[],routes:[],hostname:authority.hostname,workersDev:false,previewUrls:false,publicHealth:{status:200,bytesMatch:true},alternateEndpoints:{workersDevStatus:404,actualVersionPreviewStatus:404,siteContentPresent:false}}}
function token(){return {observedAt:at(-60000),accountId:account,tokenId,status:'active',issuedOn:at(-60000),notBefore:at(-60000),expiresOn:at(3600000),policyCount:1,effect:'allow',permissionGroupIds:[permission],workerTag:tag,resourceScope:'individual-worker',additionalPolicyCount:0}}
function revoke(){return {observedAt:at(-20000),tokenId,revokeSuccess:true,inventoryComplete:true,inventoryContainsToken:false,detailStatus:404}}
function evidence(){return {context,preimage:provider(),token:token(),containment:{observedAt:at(-60000),independentOfDeployToken:true,capabilityVerified:true,separatelyAuthorized:true},handoff:{mode:'Production',sourceSha:sha,archiveVerified:true,stagingVerified:true,configPath:'apps/site/wrangler.jsonc',wranglerVersion:authority.wrangler,buildCount:0},deployment:{startedAt:at(-50000),completedAt:at(-40000),count:1,exitCode:0,deploymentId:'deployment-new',versionId:'version-new',tokenId},postimage:{...provider(-30000),deploymentId:'deployment-new',versionId:'version-new'},revocation:revoke()}}

test('exact successful main metadata yields blocked review, never deployment or archive proof',()=>{
 const p=deriveReleaseReview(selection,run,artifact,now);
 assert.equal(p.status,'BLOCKED_SETTINGS_AND_LIVE_ADAPTERS');assert.equal(p.workflowActivation,false);assert.equal(p.providerMutations,0);assert.equal(p.buildCount,0);assert.match(p.archiveAndStagingVerification,/REQUIRED/);
});
test('PR, wrong SHA, workflow, attempt, pending and failed runs fail closed',()=>{
 for(const patch of [{event:'pull_request'},{head_branch:'feature'},{head_sha:'0'.repeat(40)},{path:'.github/workflows/other.yml'},{run_attempt:2},{status:'in_progress'},{conclusion:'failure'},{repository:{full_name:'other/repo'}}])assert.throws(()=>deriveReleaseReview(selection,{...run,...patch},artifact,now),/NOT_SUCCESSFUL/);
});
test('immutable artifact identity, expiry and producer attribution are mandatory',()=>{
 for(const patch of [{id:4},{name:'site-release-2-2'},{digest:'sha256:'+'0'.repeat(64)},{expired:true},{expires_at:at(-1)},{workflow_run:{id:9,head_sha:sha}}])assert.throws(()=>deriveReleaseReview(selection,run,{...artifact,...patch},now),/ARTIFACT_IDENTITY/);
});
test('unknown selection fields and numeric injection are rejected without reflecting input',()=>{
 assert.throws(()=>deriveReleaseReview({...selection,apiToken:'synthetic-secret'},run,artifact,now),/^Error: INVALID_SELECTION_FIELDS$/);
 for(const value of ['0','2; command','2\n3'])assert.throws(()=>deriveReleaseReview({...selection,runId:value},run,artifact,now),/^Error: INVALID_SELECTION$/);
});
test('provider full pagination, R2/other bindings, traffic, domain and endpoint drift block',()=>{
 for(const patch of [{complete:false},{bindings:[{type:'r2_bucket'}]},{bindings:[{type:'secret_text'}]},{routes:['*']},{trafficPercent:99},{hostname:'other.example'},{workersDev:true},{previewUrls:true},{workerTag:'0'.repeat(32)}])assert.throws(()=>validateProviderSnapshot({...provider(),...patch},context,now));
});
test('alternate URLs must be actual-version 404 without site content and public bytes must match',()=>{
 for(const patch of [{publicHealth:{status:200,bytesMatch:false}},{alternateEndpoints:{workersDevStatus:403,actualVersionPreviewStatus:404,siteContentPresent:false}},{alternateEndpoints:{workersDevStatus:404,actualVersionPreviewStatus:200,siteContentPresent:true}}])assert.throws(()=>validateProviderSnapshot({...provider(),...patch},context,now),/ENDPOINT_FAILURE/);
});
test('future or stale provider observations are unknown, not absence',()=>{
 for(const offset of [1,-120001])assert.throws(()=>validateProviderSnapshot(provider(offset),context,now),/STALE/);
});
test('exact individual-worker policy, permission ID and finite fresh token lifetime are required',()=>{
 assert.equal(validateTokenMetadata(token(),context,now).revokeRequired,true);
 for(const patch of [{policyCount:2},{additionalPolicyCount:1},{effect:'deny'},{resourceScope:'account-wide'},{workerTag:'0'.repeat(32)},{permissionGroupIds:[permission,'0'.repeat(32)]},{permissionGroupIds:['0'.repeat(32)]},{issuedOn:at(-900001)},{expiresOn:at(-1)},{expiresOn:at(86400001)},{notBefore:at(1000)}])assert.throws(()=>validateTokenMetadata({...token(),...patch},context,now));
});
test('secret fields are not accepted or echoed by metadata gates',()=>{
 for(const key of ['value','token','Authorization','sessionCookie'])assert.throws(()=>validateTokenMetadata({...token(),[key]:'synthetic-secret'},context,now),/^Error: INVALID_TOKEN_METADATA_FIELDS$/);
});
test('expiry or process termination alone never proves same-ID revocation',()=>{
 assert.equal(validateRevocation(revoke(),tokenId,now),true);
 for(const patch of [{tokenId:'0'.repeat(32)},{revokeSuccess:false},{inventoryComplete:false},{inventoryContainsToken:true},{detailStatus:403}])assert.throws(()=>validateRevocation({...revoke(),...patch},tokenId,now),/REVOCATION/);
});
test('consistent synthetic evidence cannot grant live acceptance or deploy authorization',()=>{
 const result=assessOperationEvidence(evidence(),now);assert.equal(result.status,'EVIDENCE_CONSISTENT');assert.equal(result.acceptance,false);assert.match(result.limitations,/not implemented/);
});
test('containment cannot use deploy credential or implied authorization',()=>{
 for(const key of ['independentOfDeployToken','capabilityVerified','separatelyAuthorized']){const e=evidence();e.containment[key]=false;assert.throws(()=>assessOperationEvidence(e,now),/CONTAINMENT_NOT_READY/)}
});
test('canonical Production handoff rejects candidates, rebuilds and alternate config/toolchain',()=>{
 for(const patch of [{mode:'Candidate'},{sourceSha:'0'.repeat(40)},{archiveVerified:false},{stagingVerified:false},{configPath:'wrangler.jsonc'},{wranglerVersion:'latest'},{buildCount:1}]){const e=evidence();Object.assign(e.handoff,patch);assert.throws(()=>assessOperationEvidence(e,now),/HANDOFF/)}
});
test('deployment must be single and after fresh preflight, token and containment',()=>{
 for(const patch of [{completedAt:at(-51000)},{count:2},{tokenId:'0'.repeat(32)}]){const e=evidence();Object.assign(e.deployment,patch);assert.throws(()=>assessOperationEvidence(e,now),/DEPLOYMENT_ORDER/)}
 const e=evidence();e.deployment.startedAt=at(-61000);assert.throws(()=>assessOperationEvidence(e,now),/STALE_OR_INVALID_OBSERVATION/);
});
test('deploy failure still requires revocation; it never authorizes rollback',()=>{
 const e=evidence();e.deployment.exitCode=1;assert.deepEqual(assessOperationEvidence(e,now),{status:'DEPLOY_FAILED_REVOKED',acceptance:false,rollbackAuthorization:false});e.revocation.revokeSuccess=false;assert.throws(()=>assessOperationEvidence(e,now),/REVOCATION/);
});
test('endpoint postcheck failure needs containment after same-ID revocation',()=>{
 const e=evidence();e.postimage.previewUrls=true;assert.deepEqual(assessOperationEvidence(e,now),{status:'POSTCHECK_FAILED_REVOKED',acceptance:false,containmentRequired:true,rollbackAuthorization:false});
});
test('postimage must identify deployed version and ordered readback/revoke',()=>{
 const e=evidence();e.postimage.versionId='unexpected';assert.throws(()=>assessOperationEvidence(e,now),/POSTDEPLOY/);
 e.postimage.versionId=e.deployment.versionId;e.revocation.observedAt=at(-50000);assert.throws(()=>assessOperationEvidence(e,now),/REVOCATION_ORDER/);
 e.revocation.observedAt=at(-35000);assert.throws(()=>assessOperationEvidence(e,now),/REVOCATION_BEFORE_SUCCESSFUL_READBACK/);
});
test('preflight freshness is assessed at mutation time, postcheck at observation time',()=>{
 const e=evidence();e.preimage.observedAt=at(-600000);e.token.observedAt=at(-600000);e.token.issuedOn=at(-600000);e.token.notBefore=at(-600000);e.containment.observedAt=at(-600000);e.deployment.startedAt=at(-590000);assert.equal(assessOperationEvidence(e,now).status,'EVIDENCE_CONSISTENT');
 e.preimage.observedAt=at(-720001);assert.throws(()=>assessOperationEvidence(e,now),/STALE/);
});
test('workflow stays hard blocked and credentials/OIDC/deploy are absent from review implementation',()=>{
 const workflow=readFileSync(new URL('../../.github/workflows/deploy-site.yml',import.meta.url),'utf8');
 assert.equal((workflow.match(/if: \$\{\{ false \}\}/g)||[]).length,3);
 const jobs=workflow.split(/^jobs:\s*$/m)[1];assert.ok(jobs);
 assert.deepEqual([...jobs.matchAll(/^  ([a-z][a-z0-9-]*):\s*$/gm)].map(m=>m[1]).sort(),['lifecycle-gate','production','release-review']);
 for(const name of ['release-review','lifecycle-gate','production'])assert.match(jobs.split(`  ${name}:`)[1].split(/^  [a-z]/m)[0],/^    if: \$\{\{ false \}\}$/m);
 assert.ok(!/id-token:|secrets\.|wrangler deploy|CLOUDFLARE_API_TOKEN/.test(workflow));
 const planner=readFileSync(new URL('./deployment-plan.mjs',import.meta.url),'utf8');
 assert.ok(!/gh.*(?:POST|DELETE|PATCH)|wrangler deploy|cloudflare\.com\/client|CLOUDFLARE_API_TOKEN/.test(planner));
});
