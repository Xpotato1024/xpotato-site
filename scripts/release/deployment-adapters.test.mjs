import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createJsonTransport} from './deployment-http.mjs';
import {createCloudflareAdapter} from './deployment-cloudflare.mjs';
import {createDataPlaneProbe} from './deployment-data-plane.mjs';
import {createGitHubProtectionAdapter} from './deployment-github.mjs';
import {createIndependentSupervisor,runSupervisorLoop} from './deployment-supervisor.mjs';
const now=Date.parse('2026-10-06T12:02:00Z'),day=86400000,at=n=>new Date(now+n).toISOString();
const accountId='a'.repeat(32),workerTag='b'.repeat(32),tokenId='c'.repeat(32),permissionGroupId='d'.repeat(32),credentialId='e'.repeat(32),zoneId='f'.repeat(32),sourceSha='1'.repeat(40);
const deploymentId='10000000-0000-0000-0000-000000000000',versionId='20000000-0000-0000-0000-000000000000';
// Synthetic map only, not a guessed production Cloudflare selector.
const reviewedResourceMap={[`fixture-account-${accountId}`]:{[`fixture-worker-${workerTag}`]:'*'}};
const response=(data,status=200,headers={'content-type':'application/json'})=>new Response(typeof data==='string'?data:JSON.stringify(data),{status,headers});
const cf=result=>response({success:true,errors:[],messages:[],result});
const page=(rows,per_page=50,extra={})=>response({success:true,errors:[],result:rows,result_info:{page:1,per_page,count:rows.length,total_count:rows.length,total_pages:1,...extra}});
const token=()=>({id:tokenId,status:'active',issued_on:at(-30*day),not_before:at(-30*day),expires_on:at(60*day),name:'synthetic-only',creator_email_at_creation:'fixture@example.invalid',policies:[{id:'0'.repeat(32),effect:'allow',permission_groups:[{id:permissionGroupId,name:'fixture-role'}],resources:reviewedResourceMap}]});
const health=()=>({publicHealth:{status:200,bytesMatch:true},alternateEndpoints:{workersDevStatus:404,actualVersionPreviewStatus:404,siteContentPresent:false}});
function cloud(role='audit-read',fault=()=>undefined,options={}){
 const operatorPolicies=[{id:'2'.repeat(32),effect:'allow',permission_groups:[{id:'3'.repeat(32)}],resources:{[`fixture-operator-account-${accountId}`]:'*'}}];
 const calls=[];let deleted=false;
 const fetchImpl=async(url,init)=>{const u=new URL(url),path=u.pathname;calls.push({path,method:init.method,query:u.search,body:init.body});const override=await fault(u,init);if(override!==undefined)return override;
  if(path.endsWith('/tokens/verify'))return cf({id:role==='site-read'?tokenId:credentialId,status:'active'});
  if(path.endsWith('/tokens/'+credentialId))return cf({id:credentialId,status:'active',issued_on:at(-60000),not_before:at(-60000),expires_on:at(3600000),policies:operatorPolicies});
  if(path.endsWith('/tokens/'+tokenId)){if(init.method==='DELETE'){deleted=true;return cf({id:tokenId})}return deleted?response({},404):cf(token())}
  if(path.endsWith('/tokens'))return page(deleted?[]:[{id:tokenId}]);
  if(path.endsWith('/workers/scripts'))return cf([{id:'xpotato-site',tag:workerTag}]);
  if(path.endsWith('/settings'))return cf({bindings:[]});
  if(path.endsWith('/deployments')){const rows=[{id:deploymentId,created_on:at(-day),strategy:'percentage',versions:[{version_id:versionId,percentage:100}]}];return response({success:true,errors:[],result:{deployments:rows},result_info:{page:1,per_page:100,count:1,total_count:1,total_pages:1}})}
  if(path.includes('/versions/'))return cf({id:versionId,resources:{bindings:{}}});
  if(path.endsWith('/workers/domains'))return page([{id:'domain-fixture',service:'xpotato-site',environment:'production',hostname:'xpotato.net'}]);
  if(path==='/client/v4/zones')return page([{id:zoneId,account:{id:accountId}}]);
  if(path.endsWith('/workers/routes'))return cf([]);
  if(path.endsWith('/workers/subdomain'))return cf({subdomain:'fixture-owner'});
  if(path.endsWith('/subdomain'))return cf({enabled:false,previews_enabled:false});
  throw Error('unexpected synthetic path');
 };
 const adapter=createCloudflareAdapter({accountId,workerTag,tokenId,permissionGroupId,reviewedResourceMap,reviewedIndependentAuthority:{policies:operatorPolicies,capabilities:['account-token-read-all','account-zone-inventory-all','worker-read','account-token-write-all']},role,credentialId:role==='site-read'?tokenId:credentialId,credentialProvider:async()=>'synthetic-credential-not-real',fetchImpl,authorizeMutation:async()=>true,clock:()=>now,...options});return {adapter,calls};
}
function transport(fetchImpl,extra={}){return createJsonTransport({origin:'https://api.cloudflare.com',credentialProvider:async()=>'synthetic-credential-not-real',fetchImpl,allowRequest:r=>r.path==='/client/v4/mock'&&r.method==='GET',...extra})}

test('transport has no implicit fetch, credential lookup or network at construction',()=>{
 assert.throws(()=>createJsonTransport({origin:'https://api.cloudflare.com',credentialProvider:()=>'',allowRequest:()=>true}),/INVALID_TRANSPORT/);
 let calls=0;transport(async()=>{calls++;return response({ok:true})});assert.equal(calls,0);
});
test('transport binds credential to exact host/path and rejects redirect/exfiltration before lookup',async()=>{
 let lookedUp=0;const request=transport(async(url,init)=>{assert.equal(url,'https://api.cloudflare.com/client/v4/mock');assert.equal(init.redirect,'manual');return response({ok:true})},{credentialProvider:async()=>{lookedUp++;return 'synthetic-credential-not-real'}});
 for(const path of ['//other.invalid/x','https://other.invalid/x','/client/v4/%2fmock','/client/v4/mock#x','/client/v4/other'])await assert.rejects(request({path}),/REQUEST_NOT_ALLOWED/);
 assert.equal(lookedUp,0);await request({path:'/client/v4/mock'});assert.equal(lookedUp,1);
 await assert.rejects(transport(async()=>response('',302))({path:'/client/v4/mock'}),/REMOTE_REDIRECT/);
});
test('HTTP failure and thrown credential/network errors never reflect secrets',async()=>{
 for(const status of [401,403,404,429,500])await assert.rejects(transport(async()=>response({value:'synthetic-secret'},status))({path:'/client/v4/mock'}),e=>!e.message.includes('synthetic-secret')&&e.message.startsWith('REMOTE_HTTP'));
 await assert.rejects(transport(async()=>{throw Error('synthetic-secret')})({path:'/client/v4/mock'}),/^Error: REMOTE_REQUEST_FAILED$/);
 await assert.rejects(transport(async()=>response({}),{credentialProvider:async()=>{throw Error('synthetic-secret')}})({path:'/client/v4/mock'}),/^Error: REMOTE_REQUEST_FAILED$/);
});
test('body limits, invalid JSON/content type and bounded timeout fail closed',async()=>{
 await assert.rejects(transport(async()=>response('not JSON'))({path:'/client/v4/mock'}),/INVALID_JSON/);
 await assert.rejects(transport(async()=>response('{}',200,{'content-type':'text/html'}))({path:'/client/v4/mock'}),/CONTENT_TYPE/);
 await assert.rejects(transport(async()=>response('long-body'),{maxBytes:2})({path:'/client/v4/mock'}),/BODY_LIMIT/);
 await assert.rejects(transport(async()=>new Promise(()=>{}),{timeoutMs:5})({path:'/client/v4/mock'}),/REMOTE_TIMEOUT/);
 await assert.rejects(transport(async()=>response({}),{credentialProvider:async()=>new Promise(()=>{}),timeoutMs:5})({path:'/client/v4/mock'}),/REMOTE_TIMEOUT/);
});
test('site-read role proves credential ID but cannot audit/revoke/contain',async()=>{
 const {adapter,calls}=cloud('site-read');assert.equal((await adapter.verifyCredential()).credentialId,tokenId);await assert.rejects(adapter.readTokenMetadata(),/AUDIT/);await assert.rejects(adapter.revokeToken(),/REVOKE/);await assert.rejects(adapter.containEndpoints(health),/CONTAINMENT/);assert.equal(calls.length,1);
});
test('independent role cannot reuse deploy credential and raw identity must match',async()=>{
 assert.throws(()=>cloud('audit-read',()=>undefined,{credentialId:tokenId}),/INDEPENDENT_CREDENTIAL/);
 const {adapter}=cloud('audit-read',u=>u.pathname.endsWith('/tokens/verify')?cf({id:tokenId,status:'active'}):undefined);await assert.rejects(adapter.readTokenMetadata(),/CREDENTIAL_IDENTITY/);
});
test('list-self or unreviewed independent authority cannot prove complete inventory',async()=>{
 assert.throws(()=>cloud('token-revoke',()=>undefined,{reviewedIndependentAuthority:undefined}),/REVIEWED_AUTHORITY/);
 assert.throws(()=>cloud('audit-read',()=>undefined,{reviewedIndependentAuthority:{policies:[{}],capabilities:['list-self']}}),/REVIEWED_AUTHORITY/);
 const {adapter,calls}=cloud('token-revoke',u=>u.pathname.endsWith('/tokens/'+credentialId)?cf({id:credentialId,status:'active',issued_on:at(-60000),not_before:at(-60000),expires_on:at(3600000),policies:[]}):undefined);await assert.rejects(adapter.revokeToken(),/INDEPENDENT_SCOPE/);assert.ok(!calls.some(c=>c.method==='DELETE'));
});
test('raw token and live script tag produce only nonsecret normalized metadata',async()=>{
 const {adapter}=cloud();const metadata=await adapter.readTokenMetadata();assert.equal(metadata.tokenId,tokenId);assert.equal(metadata.resourceScope,'individual-worker');assert.ok(!JSON.stringify(metadata).includes('fixture@example'));assert.ok(!JSON.stringify(metadata).includes('synthetic-credential'));assert.match(adapter.selectorFingerprint,/^[a-f0-9]{64}$/);
});
test('raw extra policy, wrong selector, wildcard scope, wrong role and secret fields block',async()=>{
 for(const change of [t=>{t.policies.push(t.policies[0])},t=>{t.policies[0].resources={'*':'*'}},t=>{t.policies[0].permission_groups.push({id:'0'.repeat(32)})},t=>{t.value='synthetic-secret'},t=>{t.id='0'.repeat(32)}]){const {adapter}=cloud('audit-read',u=>{if(u.pathname.endsWith('/tokens/'+tokenId)){const t=token();change(t);return cf(t)}});await assert.rejects(adapter.readTokenMetadata(),e=>!e.message.includes('synthetic-secret')&&/RAW_TOKEN/.test(e.message))}
 assert.throws(()=>cloud('audit-read',()=>undefined,{reviewedResourceMap:{'*':'*'}}),/SELECTOR/);
});
test('display name alone, duplicate scripts and expired policy are rejected',async()=>{
 for(const rows of [[{id:'xpotato-site',tag:'0'.repeat(32)}],[{id:'xpotato-site',tag:workerTag},{id:'xpotato-site',tag:workerTag}]]){const {adapter}=cloud('audit-read',u=>u.pathname.endsWith('/workers/scripts')?cf(rows):undefined);await assert.rejects(adapter.readTokenMetadata(),/WORKER_TAG/)}
 const {adapter}=cloud('audit-read',u=>u.pathname.endsWith('/tokens/'+tokenId)?cf({...token(),expires_on:at(-1)}):undefined);await assert.rejects(adapter.readTokenMetadata(),/TOKEN_POLICY_NOT_VALID/);
});
test('complete provider snapshot verifies actual active version, bindings, domain and all zones/routes',async()=>{
 const {adapter,calls}=cloud();const snapshot=await adapter.readProviderSnapshot(health);assert.equal(snapshot.complete,true);assert.equal(snapshot.versionId,versionId);assert.equal(snapshot.workersDev,false);assert.ok(calls.some(c=>c.path.endsWith('/zones/'+zoneId+'/workers/routes')));assert.equal(calls.filter(c=>c.path.endsWith('/deployments')).length,2);
});
test('R2 settings, version bindings, route/domain/endpoint drift prevent provider proof',async()=>{
 const changes=[u=>u.pathname.endsWith('/settings')?cf({bindings:[{type:'r2_bucket'}]}):undefined,u=>u.pathname.includes('/versions/')?cf({id:versionId,resources:{bindings:[{type:'r2_bucket'}]}}):undefined,u=>u.pathname.endsWith('/workers/routes')?cf([{id:'route',script:'xpotato-site'}]):undefined,u=>u.pathname.endsWith('/workers/domains')?page([{id:'domain',service:'xpotato-site',environment:'production',hostname:'other.invalid'}]):undefined,u=>u.pathname.endsWith('/scripts/xpotato-site/subdomain')?cf({enabled:false,previews_enabled:true}):undefined];
 for(const fault of changes)await assert.rejects(cloud('audit-read',fault).adapter.readProviderSnapshot(health));
});
test('incomplete pagination, duplicate IDs, page changes and provider race are unknown',async()=>{
 const {adapter}=cloud('audit-read',u=>u.pathname.endsWith('/workers/domains')?response({success:true,errors:[],result:[],result_info:{page:1,per_page:50,count:0,total_count:2,total_pages:1}}):undefined);await assert.rejects(adapter.readProviderSnapshot(health),/PAGINATION/);
 const duplicate=cloud('audit-read',u=>u.pathname.endsWith('/workers/domains')?page([{id:'same'},{id:'same'}]):undefined);await assert.rejects(duplicate.adapter.readProviderSnapshot(health),/DUPLICATE/);
 let reads=0;const race=cloud('audit-read',u=>{if(u.pathname.endsWith('/scripts/xpotato-site/subdomain')&&++reads===2)return cf({enabled:true,previews_enabled:false})});await assert.rejects(race.adapter.readProviderSnapshot(health),/SNAPSHOT_CHANGED/);
});
test('data-plane exception and provider error bodies never enter emitted adapter errors',async()=>{
 await assert.rejects(cloud().adapter.readProviderSnapshot(async()=>{throw Error('synthetic-secret')}),/^Error: CLOUDFLARE_ADAPTER_FAILED$/);
 await assert.rejects(cloud('audit-read',u=>u.pathname.endsWith('/settings')?response({errors:[{message:'synthetic-secret'}]},403):undefined).adapter.readProviderSnapshot(health),/^Error: REMOTE_HTTP_403$/);
});
test('exact-token revoke verifies successful ID receipt, complete inventory and detail404',async()=>{
 const {adapter,calls}=cloud('token-revoke');const receipt=await adapter.revokeToken();assert.equal(receipt.detailStatus,404);assert.equal(receipt.inventoryContainsToken,false);assert.equal(calls.filter(c=>c.method==='DELETE').length,1);assert.ok(calls.some(c=>c.query.includes('include_expired=true')));
});
test('revoke lacks authorization, partial inventory, target retained, wrong receipt and detail403 fail',async()=>{
 const denied=cloud('token-revoke',()=>undefined,{authorizeMutation:async()=>false});await assert.rejects(denied.adapter.revokeToken(),/NOT_AUTHORIZED/);assert.equal(denied.calls.length,0);
 for(const fault of [(u,i)=>i.method==='DELETE'?cf({id:'0'.repeat(32)}):undefined,u=>u.pathname.endsWith('/tokens')?response({success:true,errors:[],result:[]}):undefined,u=>u.pathname.endsWith('/tokens')?page([{id:tokenId}]):undefined,(u,i)=>u.pathname.endsWith('/tokens/'+tokenId)&&i.method==='GET'?response({message:'synthetic-secret'},403):undefined])await assert.rejects(cloud('token-revoke',fault).adapter.revokeToken());
});
test('ambiguous DELETE error does not retry or report revocation',async()=>{
 const {adapter,calls}=cloud('token-revoke',(u,i)=>{if(i.method==='DELETE')throw Error('synthetic-secret')});await assert.rejects(adapter.revokeToken(),/^Error: REMOTE_REQUEST_FAILED$/);assert.equal(calls.filter(c=>c.method==='DELETE').length,1);
 await assert.rejects(adapter.revokeToken(),/ALREADY_ATTEMPTED/);assert.equal(calls.filter(c=>c.method==='DELETE').length,1);
});
test('armed independent authority remains usable for emergency after issuance freshness window',async()=>{
 let time=now;const {adapter}=cloud('token-revoke',()=>undefined,{clock:()=>time});await adapter.verifyCredential();time+=16*60000;assert.equal((await adapter.revokeToken()).revokeSuccess,true);
});
test('containment writes only both false and proves provider plus data-plane readback',async()=>{
 const {adapter,calls}=cloud('endpoint-contain');const result=await adapter.containEndpoints(async()=>health().alternateEndpoints);assert.equal(result.readbackVerified,true);const writes=calls.filter(c=>c.method==='POST');assert.equal(writes.length,1);assert.deepEqual(JSON.parse(writes[0].body),{enabled:false,previews_enabled:false});assert.ok(!calls.some(c=>c.method==='DELETE'));
});
test('containment write success alone, wrong authority, exposed endpoint or malformed response do not pass',async()=>{
 await assert.rejects(cloud('endpoint-contain').adapter.containEndpoints(async()=>({...health().alternateEndpoints,actualVersionPreviewStatus:200})),/CONTAINMENT_NOT_PROVEN/);
 await assert.rejects(cloud('endpoint-contain',(u,i)=>i.method==='POST'?cf({enabled:false}):undefined).adapter.containEndpoints(async()=>health().alternateEndpoints),/RECEIPT/);
 await assert.rejects(cloud('endpoint-contain',()=>undefined,{authorizeMutation:async()=>{throw Error('synthetic-secret')}}).adapter.containEndpoints(async()=>health().alternateEndpoints),/^Error: MUTATION_NOT_AUTHORIZED$/);
});
test('data-plane derives actual 8-char version URL and makes no authenticated calls',async()=>{
 const home='synthetic public homepage',hash=createHash('sha256').update(home).digest('hex'),calls=[];
 const probe=createDataPlaneProbe({expectedHomeSha256:hash,siteContentMarkers:['fixture-brand-marker'],fetchImpl:async(url,options)=>{calls.push(url);assert.equal(options.headers.Authorization,undefined);assert.equal(options.redirect,'manual');return new Response(url==='https://xpotato.net/'?home:'provider not found',{status:url==='https://xpotato.net/'?200:404})}});
 assert.equal((await probe({versionId,accountSubdomain:'fixture-owner'})).publicHealth.bytesMatch,true);assert.equal(calls[2],'https://20000000-xpotato-site.fixture-owner.workers.dev/');
});
test('data-plane refuses injected subdomain/version, redirects and branded 404 content',async()=>{
 const home='synthetic public homepage',hash=createHash('sha256').update(home).digest('hex');
 const probe=createDataPlaneProbe({expectedHomeSha256:hash,siteContentMarkers:['fixture-brand-marker'],fetchImpl:async url=>new Response(url==='https://xpotato.net/'?home:'fixture-brand-marker',{status:url==='https://xpotato.net/'?200:404})});
 await assert.rejects(probe({versionId,accountSubdomain:'other.invalid/path'}),/IDENTITY/);await assert.rejects(probe({versionId:'latest',accountSubdomain:'fixture-owner'}),/IDENTITY/);assert.equal((await probe({versionId,accountSubdomain:'fixture-owner'})).alternateEndpoints.siteContentPresent,true);
 const redirect=createDataPlaneProbe({expectedHomeSha256:hash,siteContentMarkers:['fixture-brand-marker'],fetchImpl:async()=>new Response('',{status:302})});await assert.rejects(redirect({versionId,accountSubdomain:'fixture-owner'}),/PROBE_FAILED/);
});

function github(fault=()=>undefined,options={}){
 const paths=[];const envId=23583819406,owner={login:'Xpotato1024',id:190472511,type:'User'};
 const repo='/repos/Xpotato1024/xpotato-site',env=repo+'/environments/site-production';
 const main={required_status_checks:{strict:true,checks:[{context:'result',app_id:15368},{context:'offline-policy',app_id:15368}]},required_pull_request_reviews:{required_approving_review_count:0,require_code_owner_reviews:false,require_last_push_approval:false},enforce_admins:{enabled:true},allow_force_pushes:{enabled:false},allow_deletions:{enabled:false},required_conversation_resolution:{enabled:true}};
 const environment={id:envId,name:'site-production',can_admins_bypass:false,deployment_branch_policy:{protected_branches:false,custom_branch_policies:true},protection_rules:[{type:'required_reviewers',prevent_self_review:false,reviewers:[{type:'User',reviewer:owner}]}]};
 const fetchImpl=async(url,init)=>{const u=new URL(url);paths.push(u.pathname);assert.equal(init.method,'GET');const override=await fault(u,init,{main,environment});if(override!==undefined)return override;
  if(u.pathname===repo)return response({full_name:'Xpotato1024/xpotato-site',visibility:'public',owner});
  if(u.pathname.endsWith('/branches/main/protection'))return response(main);
  if(u.pathname===env)return response(environment);
  if(u.pathname.endsWith('/deployment-branch-policies'))return response({total_count:1,branch_policies:[{id:1,name:'main',type:'branch'}]});
  if(u.pathname.endsWith('/environments/site-production/secrets'))return response({total_count:1,secrets:[{name:'CLOUDFLARE_SITE_API_TOKEN'}]});
  if(u.pathname.endsWith('/actions/secrets'))return response({total_count:0,secrets:[]});
  if(u.pathname.endsWith('/attempts/1'))return response({id:123,run_attempt:1,repository:{full_name:'Xpotato1024/xpotato-site'},event:'workflow_dispatch',head_branch:'main',path:'.github/workflows/deploy-site.yml',head_sha:sourceSha,actor:owner,triggering_actor:owner});
  if(u.pathname.endsWith('/approvals'))return response([{state:'approved',user:owner,environments:[{id:envId,name:'site-production'}]}]);
  throw Error('unexpected mock path');
 };
 return {paths,adapter:createGitHubProtectionAdapter({fetchImpl,credentialProvider:async()=>'synthetic-github-credential',clock:()=>now,...options})};
}
const productionRun={runId:'123',runAttempt:1,workflowSha:sourceSha};
test('GitHub raw protection/approval metadata binds owner, main, exact run and Environment ID',async()=>{
 const {adapter}=github();const result=await adapter.readProductionProtection(productionRun);assert.equal(result.protection.adminBypass,false);assert.equal(result.approval.runAttempt,1);assert.equal(result.approval.verifiedBy,'github-review-history');
});
test('GitHub governance permission failure is not bypassed by read-only job assumptions',async()=>{
 const {adapter}=github(u=>u.pathname.endsWith('/protection')?response({message:'synthetic-secret'},403):undefined);await assert.rejects(adapter.readProductionProtection(productionRun),/^Error: REMOTE_HTTP_403$/);
});
test('independent supervisor reads authenticated run attempt without governance permissions',async()=>{
 const {adapter}=github(u=>u.pathname.endsWith('/attempts/1')?response({id:123,run_attempt:1,repository:{full_name:'Xpotato1024/xpotato-site'},event:'workflow_dispatch',head_branch:'main',path:'.github/workflows/deploy-site.yml',head_sha:sourceSha,actor:{login:'Xpotato1024'},triggering_actor:{login:'Xpotato1024'},status:'completed',conclusion:'cancelled'}):undefined);assert.equal((await adapter.readSupervisedRun({runId:'123',workflowSha:sourceSha})).conclusion,'cancelled');
});
test('missing bypass response needs separately authorized fresh UI readback, never inferred from PUT',async()=>{
 const missing=(u,i,{environment})=>{if(u.pathname.endsWith('/environments/site-production')){delete environment.can_admins_bypass;return response(environment)}};
 await assert.rejects(github(missing).adapter.readProductionProtection(productionRun),/BYPASS_READBACK_REQUIRED/);
 const valid=github(missing,{confirmAdminBypassDisabled:async({environmentId})=>({source:'operator-ui-readback',environmentId,disabled:true,separatelyAuthorized:true,observedAt:at(-1000)})});assert.equal((await valid.adapter.readProductionProtection(productionRun)).protection.adminBypass,false);
 await assert.rejects(github(missing,{confirmAdminBypassDisabled:async()=>({disabled:true})}).adapter.readProductionProtection(productionRun),/BYPASS_READBACK_REQUIRED/);
});
test('bypass true, self-review lock, permissive branch and wrong required check source fail',async()=>{
 const faults=[(u,i,{environment})=>{if(u.pathname.endsWith('/environments/site-production'))return response({...environment,can_admins_bypass:true})},(u,i,{environment})=>{if(u.pathname.endsWith('/environments/site-production')){environment.protection_rules[0].prevent_self_review=true;return response(environment)}},u=>u.pathname.endsWith('/deployment-branch-policies')?response({total_count:1,branch_policies:[{name:'*',type:'branch'}]}):undefined,(u,i,{main})=>u.pathname.endsWith('/protection')?response({...main,required_status_checks:{strict:true,checks:[{context:'result',app_id:0}]}}):undefined];for(const fault of faults)await assert.rejects(github(fault).adapter.readProductionProtection(productionRun));
});
test('empty Environment, repository-level duplicate secret or partial name inventory block production',async()=>{
 for(const fault of [u=>u.pathname.endsWith('/environments/site-production/secrets')?response({total_count:0,secrets:[]}):undefined,u=>u.pathname.endsWith('/actions/secrets')?response({total_count:1,secrets:[{name:'CLOUDFLARE_SITE_API_TOKEN'}]}):undefined,u=>u.pathname.endsWith('/environments/site-production/secrets')?response({total_count:2,secrets:[{name:'CLOUDFLARE_SITE_API_TOKEN'}]}):undefined])await assert.rejects(github(fault).adapter.readProductionProtection(productionRun),/CUSTODY_NOT_PROVEN/);
});
test('old/rerun approval, rejected/other owner and wrong Environment cannot authorize production',async()=>{
 const g=github();await assert.rejects(g.adapter.readProductionProtection({...productionRun,runAttempt:2}),/ATTEMPT/);assert.equal(g.paths.length,0);
 for(const history of [[],[{state:'rejected',user:{login:'Xpotato1024',id:190472511},environments:[{id:23583819406,name:'site-production'}]}],[{state:'approved',user:{login:'other',id:1},environments:[{id:23583819406,name:'site-production'}]}]])await assert.rejects(github(u=>u.pathname.endsWith('/approvals')?response(history):undefined).adapter.readProductionProtection(productionRun),/APPROVAL_NOT_PROVEN/);
});

function supervisor(options={}){
 const mutations=[],run={repository:'Xpotato1024/xpotato-site',id:'123',runAttempt:1,sourceSha,event:'workflow_dispatch',headBranch:'main',path:'.github/workflows/deploy-site.yml',actor:'Xpotato1024',status:'in_progress',conclusion:null};let time=now;
 const controller=createIndependentSupervisor({selection:{runId:'2',runAttempt:1,artifactId:'3',sourceSha,digest:'sha256:'+'f'.repeat(64)},tokenId,runId:'123',workflowSha:sourceSha,deadlineAt:at(900000),authorizeArm:async()=>true,verifyReady:async()=>({observedAt:at(0),independentHost:true,capabilityVerified:true,revokeCredentialId:credentialId,containmentCredentialId:'9'.repeat(32)}),readRun:async()=>run,verifySuccess:async()=>true,revokeToken:async()=>{mutations.push('revoke');return {observedAt:new Date(time).toISOString(),tokenId,revokeSuccess:true,inventoryComplete:true,inventoryContainsToken:false,detailStatus:404}},containEndpoints:async()=>{mutations.push('contain');return {observedAt:new Date(time).toISOString(),worker:'xpotato-site',workersDev:false,previewUrls:false,readbackVerified:true}},clock:()=>time,...options});return {controller,run,mutations,setTime:v=>{time=v}};
}
test('supervisor cannot arm without explicit authority and independent verified capabilities',async()=>{
 for(const options of [{authorizeArm:async()=>false},{verifyReady:async()=>({independentHost:false})},{verifyReady:async()=>({observedAt:at(0),independentHost:true,capabilityVerified:true,revokeCredentialId:tokenId,containmentCredentialId:credentialId})}]){const s=supervisor(options);await assert.rejects(s.controller.arm(),/AUTHORIZATION_OR_CAPABILITY/);assert.equal(s.mutations.length,0)}
});
test('normal success requires independent verification and keeps B credential active',async()=>{
 const s=supervisor();await s.controller.arm();assert.equal((await s.controller.poll()).state,'ARMED');s.run.status='completed';s.run.conclusion='success';assert.equal((await s.controller.poll()).state,'SUCCEEDED_VERIFIED');assert.equal(s.mutations.length,0);assert.equal((await s.controller.poll()).acceptance,false);
});
test('job cancellation/timeout/failure triggers revoke and containment once outside job lifecycle',async()=>{
 for(const conclusion of ['cancelled','failure','timed_out',null]){const s=supervisor();await s.controller.arm();s.run.status='completed';s.run.conclusion=conclusion;assert.equal((await s.controller.poll()).state,'FAILED_CONTAINED');assert.deepEqual(s.mutations,['revoke','contain']);await s.controller.poll();assert.equal(s.mutations.length,2)}
 const s=supervisor();await s.controller.arm();s.setTime(now+900000);assert.equal((await s.controller.poll()).reason,'DEADLINE_EXCEEDED');
});
test('unknown run, changed identity or unknown independent postcheck always takes safety path',async()=>{
 const s=supervisor({readRun:async()=>{throw Error('synthetic-secret')}});await s.controller.arm();assert.equal((await s.controller.poll()).reason,'RUN_READBACK_UNKNOWN');
 const changed=supervisor();await changed.controller.arm();changed.run.sourceSha='0'.repeat(40);assert.equal((await changed.controller.poll()).reason,'RUN_IDENTITY_CHANGED');
 const unknown=supervisor({verifySuccess:async()=>{throw Error('synthetic-secret')}});await unknown.controller.arm();unknown.run.status='completed';unknown.run.conclusion='success';assert.equal((await unknown.controller.poll()).reason,'INDEPENDENT_POSTCHECK_UNKNOWN');
});
test('revoke failure never prevents containment, leaks errors, retries or authorizes rollback',async()=>{
 const s=supervisor({revokeToken:async()=>{throw Error('synthetic-secret')}});await s.controller.arm();s.run.status='completed';s.run.conclusion='failure';const result=await s.controller.poll();assert.equal(result.state,'FAILED_UNRESOLVED');assert.equal(result.containmentVerified,true);assert.equal(result.rollbackAuthorization,false);assert.ok(!JSON.stringify(result).includes('synthetic-secret'));assert.deepEqual(s.mutations,['contain']);
});
test('hung run/verification/revoke callbacks are bounded and containment is still attempted',async()=>{
 const s=supervisor({callbackTimeoutMs:5,readRun:async()=>new Promise(()=>{})});await s.controller.arm();assert.equal((await s.controller.poll()).state,'FAILED_CONTAINED');
 const r=supervisor({callbackTimeoutMs:5,revokeToken:async()=>new Promise(()=>{})});await r.controller.arm();r.run.status='completed';r.run.conclusion='failure';const result=await r.controller.poll();assert.equal(result.state,'FAILED_UNRESOLVED');assert.equal(result.containmentVerified,true);
});
test('historical safety receipt cannot complete a new supervised operation',async()=>{
 const s=supervisor({revokeToken:async()=>({observedAt:at(-120001),tokenId,revokeSuccess:true,inventoryComplete:true,inventoryContainsToken:false,detailStatus:404})});await s.controller.arm();s.run.status='completed';s.run.conclusion='failure';assert.equal((await s.controller.poll()).revocationVerified,false);
});
test('explicit independent host loop handles scheduler failure with the safety path',async()=>{
 const s=supervisor();const result=await runSupervisorLoop(s.controller,{wait:async()=>{throw Error('synthetic-secret')},pollIntervalMs:1});assert.equal(result.reason,'SUPERVISOR_STOP_REQUESTED');assert.deepEqual(s.mutations,['revoke','contain']);
});
test('nondeployment approval workflow never checks out code or references secret/provider/build',()=>{
 const text=readFileSync(new URL('../../.github/workflows/environment-approval-check.yml',import.meta.url),'utf8');assert.match(text,/workflow_dispatch:/);assert.match(text,/environment: site-production/);assert.ok(!/secrets\.|uses:|CLOUDFLARE|wrangler|npm |pull_request:/.test(text));assert.match(text,/refs\/heads\/main/);
});
