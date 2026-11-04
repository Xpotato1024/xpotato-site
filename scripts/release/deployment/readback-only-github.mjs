import {createJsonTransport,transportFailureCode} from '../shared/deployment-http.mjs';
import {authority} from './deployment-policy.mjs';
import {assertReadbackWorkflow,readbackWorkflowPath} from './readback-only-workflow-policy.mjs';
class AdmissionError extends Error{}
const stop=code=>{throw new AdmissionError(code);};
export const admissionErrorCode=error=>error instanceof AdmissionError?error.message:null;
export function requireReadbackRun(env){
  if(env.GITHUB_REPOSITORY!==authority.repository||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||env.GITHUB_REF!=='refs/heads/main'
    ||env.GITHUB_ACTOR!=='Xpotato1024'||env.GITHUB_TRIGGERING_ACTOR!=='Xpotato1024'||env.GITHUB_RUN_ATTEMPT!=='1'
    ||env.GITHUB_ACTIONS!=='true'||env.CI!=='true'||env.RUNNER_OS!=='Windows'||env.READBACK_APPROVED!=='true'
    ||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'')||env.READBACK_VERIFIER_SHA!==env.GITHUB_SHA
    ||!/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID??'')||!/^[1-9][0-9]*$/.test(env.GITHUB_REPOSITORY_ID??'')
    ||!/^[a-f0-9]{64}$/.test(env.READBACK_PLAN_SHA256??'')||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(env.READBACK_OPERATION_ID??''))stop('READBACK_OWNER_MAIN_APPROVAL_REQUIRED');
}
export function createReadbackGitHub({env,plan,credentialProvider,fetchImpl,clock=Date.now}){
  requireReadbackRun(env);
  const base='/repos/'+authority.repository,current=base+'/actions/runs/'+env.GITHUB_RUN_ID;
  const old=base+'/actions/runs/'+plan.originalDeployment.runId+'/attempts/'+plan.originalDeployment.runAttempt;
  const artifact=base+'/actions/artifacts/'+plan.originalDeployment.evidenceArtifactId;
  const allowed=new Set([base+'/branches/main',current,base+'/commits/'+env.GITHUB_SHA+'/check-runs?per_page=100',
    base+'/environments/site-production',base+'/environments/site-production/deployment-branch-policies?per_page=100',current+'/approvals',
    base+'/contents/'+readbackWorkflowPath+'?ref='+env.GITHUB_SHA,base+'/compare/'+plan.selection.sourceSha+'...'+env.GITHUB_SHA+'?per_page=1',old,artifact]);
  const request=createJsonTransport({origin:'https://api.github.com',credentialProvider,fetchImpl,clock,
    allowRequest:({path,query,method,body,allow404})=>method==='GET'&&body===undefined&&!allow404&&allowed.has(path+(query.size?'?'+query.toString():''))});
  let reads=0;
  const get=async path=>{if(++reads>32)stop('READBACK_GITHUB_BUDGET');try{return (await request({path})).data;}catch(error){stop(transportFailureCode(error)??'READBACK_GITHUB_FAILED');}};
  async function verify(){
    const branch=await get(base+'/branches/main'),run=await get(current);
    if(branch.protected!==true||branch.commit?.sha!==env.GITHUB_SHA)stop('READBACK_MAIN_MOVED_OR_UNPROTECTED');
    if(String(run.id)!==env.GITHUB_RUN_ID||run.repository?.full_name!==authority.repository||String(run.repository.id)!==env.GITHUB_REPOSITORY_ID
      ||run.event!=='workflow_dispatch'||run.head_branch!=='main'||run.head_sha!==env.GITHUB_SHA||run.run_attempt!==1
      ||run.path!==readbackWorkflowPath||run.status!=='in_progress'||run.actor?.login!=='Xpotato1024'||run.triggering_actor?.login!=='Xpotato1024')stop('READBACK_RUN_IDENTITY');
    const checks=await get(base+'/commits/'+env.GITHUB_SHA+'/check-runs?per_page=100');
    if(checks.total_count!==checks.check_runs?.length||!['result','offline-policy'].every(name=>checks.check_runs.filter(row=>row.name===name&&row.app?.id===15368&&row.status==='completed'&&row.conclusion==='success').length===1))stop('READBACK_MAIN_CHECKS');
    const environment=await get(base+'/environments/site-production'),reviewers=environment.protection_rules?.filter(row=>row.type==='required_reviewers');
    if(environment.name!=='site-production'||!Number.isSafeInteger(environment.id)||environment.can_admins_bypass!==false||reviewers?.length!==1
      ||reviewers[0].prevent_self_review!==false||JSON.stringify(reviewers[0].reviewers?.map(row=>row.reviewer?.login))!=='["Xpotato1024"]'
      ||environment.deployment_branch_policy?.custom_branch_policies!==true)stop('READBACK_ENVIRONMENT_PROTECTION');
    const branches=await get(base+'/environments/site-production/deployment-branch-policies?per_page=100');
    if(branches.total_count!==1||branches.branch_policies?.length!==1||branches.branch_policies[0].name!=='main'||branches.branch_policies[0].type!=='branch')stop('READBACK_ENVIRONMENT_MAIN_ONLY');
    const approvals=await get(current+'/approvals');
    if(!Array.isArray(approvals)||!approvals.some(row=>row.state==='approved'&&row.user?.login==='Xpotato1024'&&row.environments?.some(e=>e.id===environment.id&&e.name==='site-production')))stop('READBACK_ENVIRONMENT_APPROVAL');
    const source=await get(base+'/contents/'+readbackWorkflowPath+'?ref='+env.GITHUB_SHA);
    if(source.path!==readbackWorkflowPath||source.encoding!=='base64'||typeof source.content!=='string')stop('READBACK_WORKFLOW_SOURCE');
    try{assertReadbackWorkflow(Buffer.from(source.content,'base64').toString('utf8'));}catch{stop('READBACK_WORKFLOW_SOURCE');}
    const comparison=await get(base+'/compare/'+plan.selection.sourceSha+'...'+env.GITHUB_SHA+'?per_page=1');
    if(!['ahead','identical'].includes(comparison.status)||comparison.merge_base_commit?.sha!==plan.selection.sourceSha)stop('READBACK_SOURCE_NOT_ANCESTOR');
    // Ancestry identifies already-deployed bytes; it is not deploy source parity.
    return {ownerEnvironmentApproved:true,verifierSha:env.GITHUB_SHA,artifactSourceSha:plan.selection.sourceSha,providerWrites:0};
  }
  async function verifyOriginalEvidence(){
    const run=await get(old),row=await get(artifact),pin=plan.evidenceArchive;
    if(String(run.id)!==plan.originalDeployment.runId||run.run_attempt!==plan.originalDeployment.runAttempt
      ||run.repository?.full_name!==authority.repository||String(run.repository.id)!==env.GITHUB_REPOSITORY_ID
      ||run.name!=='Site manual production deployment'||run.path!=='.github/workflows/deploy-site.yml'||run.event!=='workflow_dispatch'
      ||run.head_branch!=='main'||run.head_sha!==plan.selection.sourceSha||run.status!=='completed'||run.conclusion!=='failure'
      ||run.actor?.login!=='Xpotato1024'||run.triggering_actor?.login!=='Xpotato1024')stop('ORIGINAL_EVIDENCE_RUN_IDENTITY');
    if(String(row.id)!==plan.originalDeployment.evidenceArtifactId||row.name!==pin.name||row.expired!==false||row.digest!==pin.digest
      ||row.size_in_bytes!==pin.bytes||!(Date.parse(row.expires_at)>clock())||String(row.workflow_run?.id)!==plan.originalDeployment.runId
      ||row.workflow_run?.head_sha!==plan.selection.sourceSha||row.workflow_run?.repository_id!==run.repository.id
      ||row.workflow_run?.head_repository_id!==run.repository.id)stop('ORIGINAL_EVIDENCE_ARTIFACT_IDENTITY');
    return {runId:plan.originalDeployment.runId,runAttempt:plan.originalDeployment.runAttempt,artifactId:plan.originalDeployment.evidenceArtifactId,
      digest:row.digest,bytes:row.size_in_bytes,resultSha256:pin.resultSha256};
  }
  return Object.freeze({verify,verifyOriginalEvidence});
}
