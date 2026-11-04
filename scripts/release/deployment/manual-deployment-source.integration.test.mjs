import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {createManualGitHub} from './manual-deployment-github.mjs';
import {runManualDeployment} from './manual-deployment.mjs';
import {main as manualEntry} from './manual-deployment-cli.mjs';
import {authority} from './deployment-policy.mjs';
import {reviewedSchemaTreePair} from './manual-deployment-source-policy.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trimEnd();
const parseTree=text=>text.split('\0').filter(Boolean).map(line=>{
  const match=/^(\d{6}) (blob|tree|commit) ([a-f0-9]{40})\t([\s\S]+)$/.exec(line);
  assert.ok(match,'Unexpected local Git tree record');return {mode:match[1],type:match[2],sha:match[3],path:match[4]};
});
// Paths/modes/blob IDs come from the checkout, not from guard policy constants.
// Only GitHub approval envelopes and provider/handoff/deploy ports are synthetic.
const snapshot={root:parseTree(git('ls-tree','-z','HEAD')),
  packages:{truncated:false,tree:parseTree(git('ls-tree','-r','-t','-z','HEAD:packages'))},
  scripts:{truncated:false,tree:parseTree(git('ls-tree','-r','-t','-z','HEAD:scripts'))}};
const authorityPaths=['docs/migration/content-materialization-v1.json','docs/architecture/infrastructure-handoff.md'];
const sourceDocuments=Object.fromEntries(authorityPaths.map(path=>[path,{sha:git('rev-parse','HEAD:'+path),path,encoding:'base64',
  content:execFileSync('git',['show','HEAD:'+path],{cwd:root}).toString('base64')}]));
const hash='a'.repeat(64),artifactSha='a'.repeat(40),workflowSha='b'.repeat(40),changed='e'.repeat(40);
const selection={artifactId:'12',digest:'sha256:'+hash,runId:'11',runAttempt:1,sourceSha:artifactSha};
const env={GITHUB_REPOSITORY:authority.repository,GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',
  GITHUB_ACTOR:'Xpotato1024',GITHUB_TRIGGERING_ACTOR:'Xpotato1024',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:workflowSha,GITHUB_RUN_ID:'13',OWNER_RECOVERY_READY:'true'};
const stamp='2026-11-04T00:00:00.000Z',clock=()=>Date.parse(stamp),uuid=n=>n.toString(16).padStart(8,'0')+'-0000-4000-8000-000000000000';
const guards=['site-validators/src/repository-cli.ts','site-validators/src/migration/phase7-interactive-readiness.ts',
  'site-validators/src/migration/phase8-route-discovery-readiness.ts','content-contracts/src/migration/phase7-interactive.ts'];
const rootEntry=(body,path)=>{const row=body.tree.find(r=>r.path===path);assert.ok(row,'Missing real Git root '+path);return row;};
function fixture(change=()=>{}) {
  const requests=[],ports=[];let pass=0,packageReads=0,scriptReads=0,providerReads=0;
  const fetchImpl=async(url,options)=>{
    const u=new URL(url),p=u.pathname;assert.equal(u.origin,'https://api.github.com');assert.equal(options.method,'GET');
    requests.push({path:p,query:u.search,method:options.method});let body,scope,side;
    if(p.endsWith('/branches/main')){pass++;body={protected:true,commit:{sha:workflowSha}};scope='branch';}
    else if(p.endsWith('/actions/runs/13')){body={event:'workflow_dispatch',head_branch:'main',head_sha:workflowSha,run_attempt:1,path:'.github/workflows/deploy-site.yml',actor:{login:'Xpotato1024'},triggering_actor:{login:'Xpotato1024'}};scope='run';}
    else if(p.endsWith('/check-runs')){body={total_count:2,check_runs:['result','offline-policy'].map(name=>({name,app:{id:15368},status:'completed',conclusion:'success'}))};scope='checks';}
    else if(p.endsWith('/environments/site-production')){body={id:17,name:'site-production',can_admins_bypass:false,protection_rules:[{type:'required_reviewers',prevent_self_review:false,reviewers:[{reviewer:{login:'Xpotato1024'}}]}],deployment_branch_policy:{custom_branch_policies:true}};scope='environment';}
    else if(p.endsWith('/deployment-branch-policies')){body={total_count:1,branch_policies:[{name:'main',type:'branch'}]};scope='branches';}
    else if(p.endsWith('/approvals')){body=[{state:'approved',user:{login:'Xpotato1024'},environments:[{id:17,name:'site-production'}]}];scope='approval';}
    else if(p.includes('/compare/')){body={status:'ahead',merge_base_commit:{sha:artifactSha}};scope='comparison';}
    else if(p.includes('/git/commits/')){body={tree:{sha:p.endsWith(artifactSha)?'1'.repeat(40):'2'.repeat(40)}};scope='commit';}
    else if(p.includes('/git/trees/')){
      if(!u.searchParams.has('recursive')){side=p.endsWith('1'.repeat(40))?0:1;body={truncated:false,tree:structuredClone(snapshot.root)};scope='root';}
      else if(p.endsWith(snapshot.root.find(r=>r.path==='packages').sha)){side=packageReads++%2;body=structuredClone(snapshot.packages);scope='packages';}
      else if(p.endsWith(snapshot.root.find(r=>r.path==='scripts').sha)){side=scriptReads++%2;body=structuredClone(snapshot.scripts);scope='scripts';}
      else throw Error('Unexpected fixture tree endpoint');
    }else if(p.includes('/contents/')){const path=p.split('/contents/')[1];assert.ok(sourceDocuments[path]);body=structuredClone(sourceDocuments[path]);side=u.searchParams.get('ref')===artifactSha?0:1;scope='authority';}
    else throw Error('Unexpected fixture endpoint');
    change({body,scope,side,pass});return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
  };
  const github=createManualGitHub({env,selection,credentialProvider:async()=>'syntheticgithub00',fetchImpl});
  const image={observedAt:stamp,deploymentId:uuid(1),versionId:uuid(2),workerTag:'c'.repeat(32),hostname:authority.hostname};
  const call=name=>async()=>{ports.push(name);};
  const input={env,selection,clock,verifyGitHub:github.verify,
    verifyHandoff:async()=>{ports.push('handoff');return {mode:'Production',sourceSha:artifactSha,artifactId:'12',digest:selection.digest};},
    loadTargets:async()=>{ports.push('targets');return {targets:[{path:'/',bytes:1,sha256:hash}]};},
    provider:{verifyDeployToken:async()=>{ports.push('token');return {tokenId:'d'.repeat(32),expiresOn:'2026-12-01T00:00:00Z'};},
      snapshot:async()=>{ports.push('provider');return {...image,versionId:++providerReads===3?uuid(3):uuid(2)};}},
    probeBefore:async()=>{ports.push('public');return {publicStatus:200,homeSha256:hash,workersDevStatus:404,previewStatus:404};},
    persistPreimage:call('persist'),persistProgress:call('progress'),verifyPublished:call('readback'),
    deployOnce:async()=>{ports.push('synthetic-deploy');return {count:1,exitCode:0,versionId:uuid(3)};}};
  return {github,input,requests,ports};
}
async function run(f){
  // Same source-manifest read as the CLI; no authentic approval/provider receipt
  // is produced by these tests and no fetch/process uses a real credential.
  const held=await f.github.sourceJson(authorityPaths[0]);
  assert.equal(held.records.filter(r=>r.collection==='blog'&&r.targetDraft===true).length,44);
  return runManualDeployment(f.input);
}
test('actual current Git trees pass both formal source checks and the preflight orchestrator',async()=>{
  assert.equal(typeof manualEntry,'function');
  for(const path of guards)assert.ok(snapshot.packages.tree.some(r=>r.path===path&&r.type==='blob'&&r.mode==='100644'));
  const f=fixture(),result=await run(f);
  assert.equal(result.status,'DEPLOYED_READBACK_VERIFIED');assert.equal(result.deployCount,1);assert.equal(result.buildCount,0);
  assert.equal(f.ports.filter(p=>p==='synthetic-deploy').length,1);assert.ok(f.ports.indexOf('persist')<f.ports.indexOf('synthetic-deploy'));
  assert.ok(f.requests.length<=64);assert.ok(f.requests.every(r=>r.method==='GET'));
});
test('only exact manual-control paths can differ while actual current build inputs remain fixed',async()=>{
  const f=fixture(({body,scope,side})=>{if(scope==='scripts'&&side===1)rootEntry(body,'release/deployment/manual-deployment-github.mjs').sha=changed;});
  assert.equal((await run(f)).status,'DEPLOYED_READBACK_VERIFIED');
});
for(const path of ['apps','schemas','package.json','package-lock.json','.node-version','tools','config','vendor','templates','tests','.gitattributes','.gitignore','.nvmrc','tsconfig.base.json','tsconfig.json','vitest.config.ts'])
  test('actual preflight rejects changed build owner '+path+' before handoff/provider/deploy',async()=>{
    const f=fixture(({body,scope,side})=>{if(scope==='root'&&side===1)rootEntry(body,path).sha=changed;});
    const result=await run(f);assert.equal(result.code,'PUBLIC_BUILD_INPUTS_CHANGED');assert.equal(result.deployCount,0);assert.equal(result.deployment.status,'not_attempted');assert.deepEqual(f.ports,[]);
  });
for(const path of guards)test('actual preflight rejects changed mandatory guard '+path,async()=>{
  const f=fixture(({body,scope,side})=>{if(scope==='packages'&&side===1)rootEntry(body,path).sha=changed;});
  assert.equal((await run(f)).code,'UNREVIEWED_REPOSITORY_GUARD_CHANGE');assert.deepEqual(f.ports,[]);
});
for(const [name,change,code]of [
  ['missing guard',b=>{b.tree=b.tree.filter(r=>r.path!==guards[1]);},'REPOSITORY_GUARD_PATH_OR_MODE'],
  ['guard executable',b=>{rootEntry(b,guards[1]).mode='100755';},'REPOSITORY_GUARD_PATH_OR_MODE'],
  ['symlink',b=>{rootEntry(b,guards[1]).mode='120000';},'PACKAGE_SOURCE_INCOMPLETE'],
  ['gitlink',b=>{Object.assign(rootEntry(b,guards[1]),{type:'commit',mode:'160000'});},'PACKAGE_SOURCE_INCOMPLETE'],
  ['duplicate',b=>{b.tree.push({...b.tree[0]});},'PACKAGE_SOURCE_INCOMPLETE'],
  ['truncated',b=>{b.truncated=true;},'PACKAGE_SOURCE_INCOMPLETE'],
  ['old alias beside new owner',b=>{b.tree.push({...rootEntry(b,guards[1]),path:'site-validators/src/phase7-interactive-readiness.ts'});},'REPOSITORY_GUARD_PATH_OR_MODE'],
  ['traversal',b=>{b.tree.push({path:'../hidden',sha:changed,type:'blob',mode:'100644'});},'PACKAGE_SOURCE_INCOMPLETE'],
])test('actual preflight rejects '+name,async()=>{
  const f=fixture(({body,scope,side})=>{if(scope==='packages'&&side===1)change(body);});
  assert.equal((await run(f)).code,code);assert.deepEqual(f.ports,[]);
});
for(const path of ['release/shared/deployment-http.mjs','release/deployment/publication-plan.mjs','release/artifact/ReleaseConsumer.psm1'])
  test('actual preflight protects other release dependency '+path,async()=>{
    const f=fixture(({body,scope,side})=>{if(scope==='scripts'&&side===1)rootEntry(body,path).sha=changed;});
    assert.equal((await run(f)).code,'BUILD_OR_POLICY_SCRIPTS_CHANGED');assert.deepEqual(f.ports,[]);
  });
test('unknown same-basename script is not a manual-control exception',async()=>{
  const f=fixture(({body,scope,side})=>{if(scope==='scripts'&&side===1)body.tree.push({path:'release/other/manual-deployment-github.mjs',sha:changed,type:'blob',mode:'100644'});});
  assert.equal((await run(f)).code,'BUILD_OR_POLICY_SCRIPTS_CHANGED');assert.deepEqual(f.ports,[]);
});
test('missing control-plane dependency stops before handoff or provider',async()=>{
  const f=fixture(({body,scope,side})=>{if(scope==='scripts'&&side===1)body.tree=body.tree.filter(r=>r.path!=='release/artifact/Read-ManualArtifactHandoff.ps1');});
  assert.equal((await run(f)).code,'MANUAL_CONTROL_PLANE_PATH_OR_MODE');assert.deepEqual(f.ports,[]);
});
for(const path of authorityPaths)test('actual preflight binds authority record '+path,async()=>{
  const f=fixture(({body,scope,side})=>{if(scope==='authority'&&side===1&&body.path===path)body.sha=changed;});
  assert.equal((await run(f)).code,'SOURCE_AUTHORITY_OR_HELD_MANIFEST_CHANGED');assert.deepEqual(f.ports,[]);
});
test('a newly introduced unclassified root cannot escape source comparison',async()=>{
  const f=fixture(({body,scope,side})=>{if(scope==='root'&&side===1)body.tree.push({path:'future-build-input',type:'tree',mode:'040000',sha:changed});});
  assert.equal((await run(f)).code,'PUBLIC_BUILD_INPUTS_CHANGED');assert.deepEqual(f.ports,[]);
});
for(const [name,change,code]of [
  ['missing build owner',b=>{b.tree=b.tree.filter(r=>r.path!=='tools');},'PUBLIC_BUILD_INPUTS_CHANGED'],
  ['build owner file instead of tree',b=>{Object.assign(rootEntry(b,'tools'),{type:'blob',mode:'100644'});},'PUBLIC_BUILD_INPUTS_CHANGED'],
  ['duplicate root',b=>{b.tree.push({...b.tree[0]});},'SOURCE_TREE_INCOMPLETE'],
  ['truncated root',b=>{b.truncated=true;},'SOURCE_TREE_INCOMPLETE'],
])test('actual preflight rejects '+name,async()=>{
  const f=fixture(({body,scope,side})=>{if(scope==='root'&&side===1)change(body);});
  assert.equal((await run(f)).code,code);assert.deepEqual(f.ports,[]);
});
test('the historical schema exception cannot authorize a current-layout schema change',async()=>{
  const f=fixture(({body,scope,side})=>{if(scope==='root')rootEntry(body,'schemas').sha=reviewedSchemaTreePair[side];});
  assert.equal((await run(f)).code,'PUBLIC_BUILD_INPUTS_CHANGED');assert.deepEqual(f.ports,[]);
});
test('current and legacy owner layouts cannot be mixed across source revisions',async()=>{
  const f=fixture(({body,scope,side})=>{if(scope==='packages'&&side===1)for(const row of body.tree)if(guards.slice(1).includes(row.path))row.path=row.path.replace('/src/migration/','/src/');});
  assert.equal((await run(f)).code,'PUBLIC_PACKAGE_INPUTS_CHANGED');assert.deepEqual(f.ports,[]);
});
test('manual-control exception does not permit changed executable mode',async()=>{
  const f=fixture(({body,scope,side})=>{if(scope==='scripts'&&side===1)rootEntry(body,'release/deployment/manual-deployment-github.mjs').mode='100755';});
  assert.equal((await run(f)).code,'MANUAL_CONTROL_PLANE_PATH_OR_MODE');assert.deepEqual(f.ports,[]);
});
test('a matching real source never promotes a Candidate handoff into Production',async()=>{
  const f=fixture();f.input.verifyHandoff=async()=>{f.ports.push('handoff');return {mode:'Candidate',sourceSha:artifactSha,artifactId:'12',digest:selection.digest};};
  const result=await run(f);assert.equal(result.code,'CANONICAL_HANDOFF_REQUIRED');assert.equal(result.deployCount,0);assert.deepEqual(f.ports,['handoff']);
});
test('second real adapter verification rejects input drift before persisting or invoking deploy',async()=>{
  const f=fixture(({body,scope,side,pass})=>{if(pass===2&&scope==='root'&&side===1)rootEntry(body,'tools').sha=changed;});
  assert.equal((await run(f)).code,'PUBLIC_BUILD_INPUTS_CHANGED');assert.ok(f.ports.includes('handoff'));assert.ok(f.ports.includes('provider'));
  assert.ok(!f.ports.includes('persist'));assert.ok(!f.ports.includes('synthetic-deploy'));
});
test('missing owner approval cannot reach artifact handoff/provider even with matching real trees',async()=>{
  const f=fixture(({body,scope})=>{if(scope==='approval')body.splice(0);});
  assert.equal((await run(f)).code,'OWNER_ENVIRONMENT_APPROVAL_REQUIRED');assert.deepEqual(f.ports,[]);
});
test('the current CLI handoff path resolves the canonical consumer, not a layout alias',async()=>{
  const cli=await readFile(new URL('./manual-deployment-cli.mjs',import.meta.url),'utf8');
  const handoff=await readFile(new URL('../artifact/Read-ManualArtifactHandoff.ps1',import.meta.url),'utf8');
  assert.ok(cli.includes('../artifact/Read-ManualArtifactHandoff.ps1'));assert.ok(handoff.includes('Test-SiteArtifactHandoff.ps1'));
});
test('the actual CLI cannot start preflight without its approved runner credentials',async()=>{
  await assert.rejects(()=>manualEntry({...env,CI:'true'}),/APPROVED_WINDOWS_RUNNER_CREDENTIALS_REQUIRED/);
});
