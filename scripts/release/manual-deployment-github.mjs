import {createJsonTransport,transportFailureCode} from './deployment-http.mjs';
import {authority,validateSelection} from './deployment-policy.mjs';
import {requireManualRun} from './manual-deployment.mjs';
import {assertPackageSourceParity} from './manual-deployment-source-policy.mjs';
import {stop} from './manual-deployment-provider.mjs';
export function createManualGitHub({env,selection,credentialProvider,fetchImpl}) {
  requireManualRun(env);validateSelection(selection);
  const base='/repos/'+authority.repository, run=base+'/actions/runs/'+env.GITHUB_RUN_ID;
  let count=0;
  const request=createJsonTransport({origin:'https://api.github.com',credentialProvider,fetchImpl,allowRequest:({path,query,method,body,allow404})=>method==='GET'&&body===undefined&&!allow404&&path.startsWith(base+'/')&&query.size<=2});
  async function get(path) {
    if (++count>64) stop('GITHUB_READ_BUDGET');
    try {return (await request({path})).data;} catch(e) {stop(transportFailureCode(e)||'GITHUB_READ_FAILED');}
  }
  async function verify() {
    const branch=await get(base+'/branches/main');
    if(branch.protected!==true||branch.commit?.sha!==env.GITHUB_SHA)stop('MAIN_MOVED_OR_UNPROTECTED');
    const current=await get(run);
    if(current.event!=='workflow_dispatch'||current.head_branch!=='main'||current.head_sha!==env.GITHUB_SHA||current.run_attempt!==1||current.path!=='.github/workflows/deploy-site.yml'||current.actor?.login!=='Xpotato1024'||current.triggering_actor?.login!=='Xpotato1024')stop('GITHUB_MANUAL_RUN_IDENTITY');
    const checks=await get(base+'/commits/'+env.GITHUB_SHA+'/check-runs?per_page=100');
    if(checks.total_count!==checks.check_runs?.length||!['result','offline-policy'].every(name=>checks.check_runs.filter(c=>c.name===name&&c.app?.id===15368&&c.status==='completed'&&c.conclusion==='success').length===1))stop('REQUIRED_MAIN_CHECKS');
    const environment=await get(base+'/environments/site-production');
    const reviewers=environment.protection_rules?.filter(r=>r.type==='required_reviewers');
    if(environment.name!=='site-production'||environment.can_admins_bypass!==false||reviewers?.length!==1||reviewers[0].prevent_self_review!==false||JSON.stringify(reviewers[0].reviewers?.map(r=>r.reviewer?.login))!=='["Xpotato1024"]'||environment.deployment_branch_policy?.custom_branch_policies!==true)stop('ENVIRONMENT_PROTECTION_CHANGED');
    const branches=await get(base+'/environments/site-production/deployment-branch-policies?per_page=100');
    if(branches.total_count!==1||branches.branch_policies?.length!==1||branches.branch_policies[0].name!=='main'||branches.branch_policies[0].type!=='branch')stop('ENVIRONMENT_MAIN_ONLY');
    const history=await get(run+'/approvals');
    if(!Array.isArray(history)||!history.some(r=>r.state==='approved'&&r.user?.login==='Xpotato1024'&&r.environments?.some(e=>e.id===environment.id&&e.name==='site-production')))stop('OWNER_ENVIRONMENT_APPROVAL_REQUIRED');
    const comparison=await get(base+'/compare/'+selection.sourceSha+'...'+env.GITHUB_SHA+'?per_page=1');
    if(!['ahead','identical'].includes(comparison.status)||comparison.merge_base_commit?.sha!==selection.sourceSha)stop('SOURCE_NOT_MAIN_ANCESTOR');
    const required=['apps','schemas','package.json','package-lock.json','.node-version'];
    const trees=[];
    for(const sha of [selection.sourceSha,env.GITHUB_SHA]) {
      const commit=await get(base+'/git/commits/'+sha);
      const tree=await get(base+'/git/trees/'+commit.tree.sha);
      if(tree.truncated!==false||!Array.isArray(tree.tree))stop('SOURCE_TREE_INCOMPLETE');
      trees.push(tree.tree);
    }
    for(const path of required) {
      const old=trees[0].filter(r=>r.path===path),current=trees[1].filter(r=>r.path===path);
      if(old.length!==1||current.length!==1||old[0].sha!==current[0].sha||old[0].mode!==current[0].mode||old[0].type!==current[0].type)stop('PUBLIC_BUILD_INPUTS_CHANGED');
    }
    const packageTrees=[];
    for(const tree of trees) {
      const packages=tree.filter(r=>r.path==='packages');
      if(packages.length!==1||packages[0].type!=='tree'||packages[0].mode!=='040000')stop('PACKAGE_SOURCE_INCOMPLETE');
      packageTrees.push(await get(base+'/git/trees/'+packages[0].sha+'?recursive=1'));
    }
    assertPackageSourceParity(packageTrees);
    const scriptTrees=[];
    const ignored=new Set(['manual-deployment.mjs','manual-deployment-provider.mjs','manual-deployment-github.mjs','manual-deployment-public.mjs','manual-deployment-process.mjs','manual-deployment-cli.mjs','manual-deployment.test.mjs','manual-deployment-readiness.mjs','manual-deployment-readiness.test.mjs','Read-ManualArtifactHandoff.ps1','manual-deployment-workflow-policy.mjs','manual-deployment-source-policy.mjs']);
    for(const tree of trees) {
      const scripts=tree.find(r=>r.path==='scripts');
      if(!scripts || scripts.type!=='tree')stop('SCRIPTS_TREE_REQUIRED');
      const content=await get(base+'/git/trees/'+scripts.sha+'?recursive=1');
      if(content.truncated!==false||!Array.isArray(content.tree))stop('SCRIPTS_TREE_INCOMPLETE');
      scriptTrees.push(content.tree.filter(r=>r.type!=='tree' && !r.path.endsWith('.test.mjs') && !ignored.has(r.path.replace(/^release\//,''))).map(r=>[r.path,r.mode,r.type,r.sha]));
    }
    if(JSON.stringify(scriptTrees[0])!==JSON.stringify(scriptTrees[1]))stop('BUILD_OR_POLICY_SCRIPTS_CHANGED');
    for(const path of ['docs/migration/content-materialization-v1.json','docs/architecture/infrastructure-handoff.md']) {
      const manifestPath=base+'/contents/'+path+'?ref=';
      const oldManifest=await get(manifestPath+selection.sourceSha),currentManifest=await get(manifestPath+env.GITHUB_SHA);
      if(!oldManifest.sha||oldManifest.sha!==currentManifest.sha)stop('SOURCE_AUTHORITY_OR_HELD_MANIFEST_CHANGED');
    }
    return {workflowSource:env.GITHUB_SHA,artifactSource:selection.sourceSha,ownerEnvironmentApproved:true,mainProtected:true,mainProtectionDetail:'SERVER_ENFORCED_NOT_ADMIN_API_READ'};
  }
  async function sourceJson(path) {
    if(path!=='docs/migration/content-materialization-v1.json')stop('SOURCE_PATH_NOT_ALLOWED');
    const result=await get(base+'/contents/'+path+'?ref='+selection.sourceSha);
    if(result.path!==path||result.encoding!=='base64'||typeof result.content!=='string')stop('SOURCE_CONTENT_RESPONSE');
    try {return JSON.parse(Buffer.from(result.content,'base64').toString('utf8'));} catch {stop('SOURCE_JSON_INVALID');}
  }
  return Object.freeze({verify,sourceJson});
}