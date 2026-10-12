import {createJsonTransport,transportFailureCode} from './deployment-http.mjs';
import {authority} from './deployment-policy.mjs';
import {validateProductionProtection,persistentPolicy} from './deployment-persistent-policy.mjs';
class GitHubError extends Error {}
const fail=code=>{throw new GitHubError(code)};
const repo=`/repos/${authority.repository}`,env=`${repo}/environments/${persistentPolicy.environment}`;
export function createGitHubProtectionAdapter({credentialProvider,fetchImpl,confirmAdminBypassDisabled,clock=Date.now}){
 const request=createJsonTransport({origin:'https://api.github.com',credentialProvider,fetchImpl,allowRequest:({path,query,method,body,allow404})=>method==='GET'&&body===undefined&&!allow404&&(
  [repo,`${repo}/branches/main/protection`,env,`${env}/secrets`,`${repo}/actions/secrets`].includes(path)&&query.size===0||
  path===`${env}/deployment-branch-policies`&&[...query.keys()].every(k=>['page','per_page'].includes(k))||
  new RegExp(`^${repo}/actions/runs/[1-9][0-9]*/(?:attempts/1|approvals)$`).test(path)&&query.size===0
 )});
 const get=async path=>(await request({path})).data;
 async function readSupervisedRun({runId,workflowSha}){
  try {
   if(typeof runId!=='string'||!/^[1-9][0-9]*$/.test(runId)||typeof workflowSha!=='string'||!/^[a-f0-9]{40}$/.test(workflowSha))fail('SUPERVISED_RUN_INPUT');
   const run=await get(`${repo}/actions/runs/${runId}/attempts/1`);
   if(String(run.id)!==runId||run.run_attempt!==1||run.repository?.full_name!==authority.repository||run.event!=='workflow_dispatch'||run.head_branch!=='main'||run.path!=='.github/workflows/deploy-site.yml'||run.head_sha!==workflowSha||run.actor?.login!=='Xpotato1024'||run.triggering_actor?.login!=='Xpotato1024')fail('SUPERVISED_RUN_IDENTITY');
   return {repository:authority.repository,id:runId,runAttempt:1,sourceSha:run.head_sha,event:run.event,headBranch:run.head_branch,path:run.path,actor:run.actor.login,status:run.status,conclusion:run.conclusion};
  }catch(error){if(error instanceof GitHubError)throw error;throw new GitHubError(transportFailureCode(error)??'SUPERVISED_RUN_READBACK_FAILED')}
 }
 async function readProductionProtection({runId,runAttempt,workflowSha}){
  try {
   if(typeof runId!=='string'||!/^[1-9][0-9]*$/.test(runId)||runAttempt!==1||typeof workflowSha!=='string'||!/^[a-f0-9]{40}$/.test(workflowSha))fail('APPROVAL_RUN_IDENTITY_OR_ATTEMPT');
   const repository=await get(repo),main=await get(`${repo}/branches/main/protection`),environment=await get(env);
   if(environment.name!==persistentPolicy.environment||!Number.isSafeInteger(environment.id)||environment.id<1)fail('ENVIRONMENT_IDENTITY');
   let bypassVerified=Object.hasOwn(environment,'can_admins_bypass')&&environment.can_admins_bypass===false;
   // This field is not documented as a REST create/update request parameter.
   // Never silently infer it from a successful PUT or invent an alternative API.
   if(!Object.hasOwn(environment,'can_admins_bypass')){
    if(typeof confirmAdminBypassDisabled!=='function')fail('ADMIN_BYPASS_READBACK_REQUIRED');
    const proof=await confirmAdminBypassDisabled({repository:authority.repository,environmentId:environment.id,environment:persistentPolicy.environment});
    bypassVerified=proof?.source==='operator-ui-readback'&&proof.environmentId===environment.id&&proof.disabled===true&&proof.separatelyAuthorized===true&&typeof proof.observedAt==='string'&&Number.isFinite(Date.parse(proof.observedAt))&&Date.parse(proof.observedAt)<=clock()&&clock()-Date.parse(proof.observedAt)<=120000;
   }
   if(!bypassVerified)fail('ADMIN_BYPASS_READBACK_REQUIRED');
   const branchPolicies=[];let total;
   for(let page=1;page<=10;page++){const result=await get(`${env}/deployment-branch-policies?page=${page}&per_page=100`);if(!Array.isArray(result.branch_policies)||!Number.isSafeInteger(result.total_count)||result.total_count<0)fail('ENVIRONMENT_BRANCH_INVENTORY');total??=result.total_count;if(total!==result.total_count)fail('ENVIRONMENT_BRANCH_INVENTORY_CHANGED');branchPolicies.push(...result.branch_policies);if(branchPolicies.length===total)break;if(!result.branch_policies.length||branchPolicies.length>total||page===10)fail('ENVIRONMENT_BRANCH_INVENTORY')}
   const secrets=await get(`${env}/secrets`),repositorySecrets=await get(`${repo}/actions/secrets`);
   if(!Array.isArray(secrets.secrets)||secrets.total_count!==secrets.secrets.length||!Array.isArray(repositorySecrets.secrets)||repositorySecrets.total_count!==repositorySecrets.secrets.length||!secrets.secrets.some(s=>s.name===persistentPolicy.secretName)||repositorySecrets.secrets.some(s=>s.name===persistentPolicy.secretName))fail('ENVIRONMENT_SECRET_CUSTODY_NOT_PROVEN');
   const run=await get(`${repo}/actions/runs/${runId}/attempts/1`);
   if(String(run.id)!==runId||run.run_attempt!==1||run.repository?.full_name!==authority.repository||run.event!=='workflow_dispatch'||run.head_branch!=='main'||run.path!=='.github/workflows/deploy-site.yml'||run.head_sha!==workflowSha||run.actor?.login!=='Xpotato1024'||run.triggering_actor?.login!=='Xpotato1024')fail('PRODUCTION_RUN_NOT_PROVEN');
   const history=await get(`${repo}/actions/runs/${runId}/approvals`);
   if(!Array.isArray(history))fail('APPROVAL_NOT_PROVEN');const relevant=history.filter(h=>h.environments?.some(e=>e.id===environment.id&&e.name===persistentPolicy.environment));
   if(relevant.length!==1||relevant[0].state!=='approved'||relevant[0].user?.login!=='Xpotato1024'||relevant[0].user?.id!==190472511)fail('APPROVAL_NOT_PROVEN');
   const reviewRules=environment.protection_rules?.filter(r=>r.type==='required_reviewers');
   if(!Array.isArray(reviewRules)||reviewRules.length!==1||!Array.isArray(reviewRules[0].reviewers)||reviewRules[0].reviewers.length!==1||reviewRules[0].reviewers[0].type!=='User'||reviewRules[0].reviewers[0].reviewer?.id!==190472511||main.required_conversation_resolution?.enabled!==true||environment.deployment_branch_policy?.protected_branches!==false||environment.deployment_branch_policy?.custom_branch_policies!==true)fail('PROTECTION_RULES_NOT_PROVEN');
   const checks=main.required_status_checks?.checks;
   if(!Array.isArray(checks)||checks.some(c=>c.app_id!==15368))fail('CHECKS_PROVIDER_NOT_PROVEN');
   const protection={observedAt:new Date(clock()).toISOString(),repository:repository.full_name,visibility:repository.visibility,ownerType:repository.owner?.type,mainProtected:true,forcePushAllowed:main.allow_force_pushes?.enabled,deletionAllowed:main.allow_deletions?.enabled,requirePullRequest:main.required_pull_request_reviews!==null&&typeof main.required_pull_request_reviews==='object',requiredReviewCount:main.required_pull_request_reviews?.required_approving_review_count,requiredChecks:checks.map(c=>c.context),strictChecks:main.required_status_checks.strict,checksAppId:15368,enforceAdmins:main.enforce_admins?.enabled,environment:environment.name,environmentBranches:branchPolicies.filter(p=>p.type==='branch').map(p=>p.name),environmentTags:branchPolicies.filter(p=>p.type==='tag').map(p=>p.name),requiredReviewers:reviewRules[0].reviewers.map(r=>r.reviewer.login),preventSelfReview:reviewRules[0].prevent_self_review,adminBypass:false,credentialLocation:'environment-secret',workflowEvent:run.event,workflowRef:'refs/heads/'+run.head_branch,actor:run.actor.login};
   if(branchPolicies.some(p=>!['branch','tag'].includes(p.type))||main.required_pull_request_reviews?.require_code_owner_reviews!==false||main.required_pull_request_reviews?.require_last_push_approval!==false)fail('SOLE_OWNER_PROTECTION_NOT_PROVEN');
   validateProductionProtection(protection,'Xpotato1024',clock());
   return {protection,approval:{runId,runAttempt:1,workflowSha,environmentId:environment.id,reviewer:'Xpotato1024',observedAt:protection.observedAt,verifiedBy:'github-review-history'}};
  }catch(error){if(error instanceof GitHubError)throw error;throw new GitHubError(transportFailureCode(error)??'GITHUB_PROTECTION_NOT_PROVEN')}
 }
 return Object.freeze({readProductionProtection,readSupervisedRun});
}
