import {assertPackageSourceParity,oldRepositoryGuardBlob,reviewedRepositoryGuardBlob,repositoryGuardPath} from './manual-deployment-source-policy.mjs';
import {createHash} from 'node:crypto';
import {assertManualWorkflow} from './manual-deployment-workflow-policy.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {EventEmitter} from 'node:events';
import {authority} from './deployment-policy.mjs';
import {createManualProvider,ManualDeployError} from './manual-deployment-provider.mjs';
import {requireManualRun,runManualDeployment,readPublicTargets,hashBytes} from './manual-deployment.mjs';
import {createManualGitHub} from './manual-deployment-github.mjs';
import {createPublicReadback} from './manual-deployment-public.mjs';
import {cleanToolEnvironment,createWranglerDeploy,executeCaptured} from './manual-deployment-process.mjs';
const now=Date.parse('2026-10-12T14:00:00Z'), uid=n=>n.toString(16).padStart(8,'0')+'-0000-4000-8000-000000000000', id=n=>String(n).repeat(32);
const selection={artifactId:'12',digest:'sha256:'+'d'.repeat(64),runId:'11',runAttempt:1,sourceSha:'a'.repeat(40)};
const env={GITHUB_REPOSITORY:authority.repository,GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',GITHUB_ACTOR:'Xpotato1024',GITHUB_TRIGGERING_ACTOR:'Xpotato1024',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'b'.repeat(40),GITHUB_RUN_ID:'13',OWNER_RECOVERY_READY:'true'};
const context={accountId:id(1),ownerPolicyReviewed:true,tokenPolicy:{createdOnUtcDate:'2026-10-01',issuedOn:null,reviewSource:'owner-created-and-saved-token'}};
const image={observedAt:new Date(now).toISOString(),deploymentId:uid(1),versionId:uid(2),workerTag:id(2),accountSubdomain:'example',bindings:0,routes:0,workersDev:false,previewUrls:false,hostname:authority.hostname};
function fixture(overrides={}) {
 const calls=[],handoff={mode:'Production',sourceSha:selection.sourceSha,artifactId:selection.artifactId,digest:selection.digest};
 let snapshots=0;
 const step=name=>async()=>{calls.push(name);return undefined};
 const result={env,selection,clock:()=>now,provider:{verifyDeployToken:async()=>{calls.push('token');return {tokenId:id(4),expiresOn:'2026-12-20T00:00:00Z',scopeEvidence:'OWNER_PINNED_INITIAL_POLICY'}},snapshot:async()=>{calls.push('snapshot');return {...image,versionId:++snapshots===3?uid(3):uid(2)}}},verifyGitHub:step('github'),verifyHandoff:async()=>{calls.push('handoff');return {...handoff}},loadTargets:async()=>{calls.push('targets');return {targets:[{path:'/',bytes:1,sha256:'a'.repeat(64)}]}},probeBefore:async()=>{calls.push('before');return {publicStatus:200,homeSha256:'a'.repeat(64),workersDevStatus:404,previewStatus:404}},verifyPublished:step('published'),persistPreimage:step('persist'),deployOnce:async()=>{calls.push('deploy');return {count:1,exitCode:0,versionId:uid(3)}},...overrides};
 return {calls,input:result};
}
test('manual owner/main/first attempt and real recovery acknowledgement are mandatory',()=>{
 for(const key of ['GITHUB_REPOSITORY','GITHUB_EVENT_NAME','GITHUB_REF','GITHUB_ACTOR','GITHUB_TRIGGERING_ACTOR','GITHUB_RUN_ATTEMPT','OWNER_RECOVERY_READY','GITHUB_SHA','GITHUB_RUN_ID'])assert.throws(()=>requireManualRun({...env,[key]:'wrong'}),/MANUAL_OWNER_MAIN_RUN_REQUIRED/);
});
test('valid operation persists preimage before one write and keeps token active',async()=>{
 const f=fixture(),r=await runManualDeployment(f.input);
 assert.equal(r.status,'DEPLOYED_READBACK_VERIFIED');assert.equal(r.deployCount,1);assert.equal(r.buildCount,0);assert.equal(r.scopeLiveReadback,false);
 assert.equal(f.calls.filter(x=>x==='deploy').length,1);assert.ok(f.calls.indexOf('persist')<f.calls.indexOf('deploy'));assert.ok(f.calls.indexOf('published')>f.calls.indexOf('deploy'));
});
for(const gate of ['verifyGitHub','verifyHandoff','loadTargets','probeBefore','persistPreimage'])test(gate+' failure stops before write',async()=>{
 const f=fixture({[gate]:async()=>{throw Error('synthetic-private-output')}});
 const r=await runManualDeployment(f.input);assert.equal(r.status,'STOPPED_BEFORE_DEPLOY');assert.equal(r.deployCount,0);assert.ok(!f.calls.includes('deploy'));assert.ok(!JSON.stringify(r).includes('synthetic-private-output'));
});
test('second handoff identity drift stops before write',async()=>{
 let count=0;const f=fixture({verifyHandoff:async()=>({mode:'Production',sourceSha:selection.sourceSha,artifactId:++count===1?selection.artifactId:'99',digest:selection.digest})});
 assert.equal((await runManualDeployment(f.input)).code,'HANDOFF_OR_TARGETS_CHANGED');assert.ok(!f.calls.includes('deploy'));
});
test('preimage drift cannot be deployed',async()=>{
 const f=fixture();let count=0;f.input.provider.snapshot=async()=>({...image,versionId:++count===2?uid(99):uid(2)});
 assert.equal((await runManualDeployment(f.input)).code,'PREIMAGE_CHANGED');assert.ok(!f.calls.includes('deploy'));
});
for(const gate of ['deployOnce','verifyPublished'])test(gate+' failure yields owner recovery and no automatic rollback/revoke',async()=>{
 const f=fixture({[gate]:async()=>{throw Error('synthetic-private-output')}});
 const r=await runManualDeployment(f.input);assert.equal(r.status,'STOPPED_OWNER_RECOVERY_REQUIRED');assert.equal(r.deployCount,1);assert.equal(r.rollbackExecuted,false);assert.equal(r.credentialRevoked,false);
});
test('receipt/provider version mismatch is never reported as successful',async()=>{
 const f=fixture({deployOnce:async()=>({count:1,exitCode:0,versionId:uid(99)})});
 assert.equal((await runManualDeployment(f.input)).code,'POST_VERSION_MISMATCH');
});
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
function providerFixture(change=()=>{},manualContext=context) {
 const calls=[];
 const fetchImpl=async(url,options)=>{
  const path=new URL(url).pathname;
  calls.push({url,method:options.method,authorization:options.headers.Authorization});
  let result,info;
  if(path.endsWith('/tokens/verify'))result={id:options.headers.Authorization.endsWith('writecredential00')?id(4):id(5),status:'active',expires_on:'2026-12-20T00:00:00Z',not_before:'2026-10-01T00:00:00Z'};
  else if(path.endsWith('/scripts'))result=[{id:authority.worker,tag:id(2)}];
  else if(path.endsWith('/settings'))result={bindings:[]};
  else if(path.endsWith('/deployments'))result={deployments:[{id:uid(1),strategy:'percentage',versions:[{version_id:uid(2),percentage:100}]}]};
  else if(path.includes('/versions/'))result={id:uid(2),resources:{bindings:[]}};
  else if(path.endsWith('/scripts/'+authority.worker+'/subdomain'))result={enabled:false,previews_enabled:false};
  else if(path.endsWith('/domains')){result=[{id:'domain',service:authority.worker,hostname:authority.hostname,environment:'production',zone_id:id(3),enabled:true,previews_enabled:false}];info={page:1,per_page:100,count:1,total_count:1};}
  else if(path.endsWith('/routes')){result=[];info={page:1,per_page:100,count:0,total_count:0};}
  else if(path.endsWith('/workers/subdomain'))result={subdomain:'example'};
  else throw Error('unexpected');
  const body={success:true,errors:[],result,...info?{result_info:info}:{}};
  const status=change(path,body)||200;
  return json(body,status);
 };
 return {calls,provider:createManualProvider({context:manualContext,readonlyCredential:async()=>'readcredential000',deployCredential:async()=>'writecredential00',fetchImpl,clock:()=>now})};
}
test('provider uses readonly fixed GETs and writer only on its own verify endpoint',async()=>{
 const f=providerFixture();const token=await f.provider.verifyDeployToken();const snapshot=await f.provider.snapshot();
 assert.equal(snapshot.versionId,uid(2));assert.equal(token.scopeLiveReadback,false);
 assert.ok(f.calls.every(c=>c.method==='GET'&&new URL(c.url).origin==='https://api.cloudflare.com'));
 assert.ok(f.calls.filter(c=>c.authorization.endsWith('writecredential00')).every(c=>new URL(c.url).pathname.endsWith('/tokens/verify')));
});
test('deployment first active page does not require <=100 lifetime history',async()=>{
 const f=providerFixture((p,b)=>{if(p.endsWith('/deployments'))b.result_info={page:1,per_page:100,count:1,total_count:200};});
 assert.equal((await f.provider.snapshot()).deploymentId,uid(1));
});
for(const [name,change] of [
 ['token expiry mismatch',(p,b)=>{if(p.endsWith('/tokens/verify'))b.result.expires_on='2030-01-01T00:00:00Z'}],
 ['extra binding',(p,b)=>{if(p.endsWith('/settings'))b.result.bindings=[{type:'r2_bucket'}]}],
 ['domain metadata incomplete',(p,b)=>{if(p.endsWith('/domains'))delete b.result_info}],
 ['route metadata incomplete',(p,b)=>{if(p.endsWith('/routes'))delete b.result_info}],
 ['workersDev enabled',(p,b)=>{if(p.endsWith('/scripts/'+authority.worker+'/subdomain'))b.result.enabled=true}],
 ['permission denied',()=>403]
])test('provider rejects '+name,async()=>{
 const f=providerFixture(change);await assert.rejects(()=>name.startsWith('token')?f.provider.verifyDeployToken():f.provider.snapshot());
});
test('public readback checks exact bytes and actual version preview prefix',async()=>{
 const calls=[],body='approved',r=createPublicReadback({fetchImpl:async url=>{calls.push(url);return new Response(url.includes('workers.dev')?'missing':body,{status:url.includes('workers.dev')?404:200});}});
 await r.before(image);await r.published({targets:[{path:'/',bytes:8,sha256:hashBytes(body)}]},image);
 assert.ok(calls.includes('https://'+uid(2).slice(0,8)+'-'+authority.worker+'.example.workers.dev/'));
});
test('public redirects and byte mismatch fail without writes',async()=>{
 for(const response of [()=>new Response('wrong',{status:200}),()=>new Response('',{status:302,headers:{Location:'https://example.test'}})]) {
  const r=createPublicReadback({fetchImpl:async()=>response()});await assert.rejects(()=>r.published({targets:[{path:'/',bytes:1,sha256:'a'.repeat(64)}]},image));
 }
});
test('Wrangler child environment excludes unrelated credentials',()=>{
 const child=cleanToolEnvironment({PATH:'safe',GITHUB_TOKEN:'synthetic',CLOUDFLARE_SITE_MONITOR_READ_TOKEN:'synthetic',CLOUDFLARE_API_KEY:'synthetic',CLOUDFLARE_EMAIL:'synthetic'},{CLOUDFLARE_API_TOKEN:'synthetic-write'});
 assert.deepEqual(Object.keys(child).sort(),['CI','CLOUDFLARE_API_TOKEN','NO_COLOR','PATH','WRANGLER_SEND_METRICS'].sort());
});
test('Wrangler is pinned, uses config only, runs once and does not expose raw output',async()=>{
 const root=await mkdtemp(join(tmpdir(),'manual-tool-'));
 try {
  await mkdir(join(root,'node_modules/wrangler'),{recursive:true});await writeFile(join(root,'node_modules/wrangler/package.json'),'{"version":"4.136.1"}');
  const calls=[],deploy=createWranglerDeploy({toolRoot:root,env:{CLOUDFLARE_SITE_API_TOKEN:'synthetic-write'},context,execute:async(command,args,options)=>{calls.push({command,args,options});return {exitCode:0,output:'Current Version ID: '+uid(3)+'\nsynthetic-private-output'};}});
  const r=await deploy({configPath:join(root,'approved-config.jsonc')});assert.equal(r.versionId,uid(3));assert.equal(calls.length,1);assert.deepEqual(calls[0].args.slice(1),['deploy','--config',join(root,'approved-config.jsonc')]);
  await assert.rejects(()=>deploy({configPath:'wrong'}),/DEPLOY_ALREADY_ATTEMPTED/);assert.ok(!JSON.stringify(r).includes('synthetic-private-output'));
 } finally {await rm(root,{recursive:true,force:true});}
});
test('captured process errors never return stdout/stderr secret text',async()=>{
 const spawnImpl=()=>{const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{};queueMicrotask(()=>child.emit('error',Error('synthetic-private-output')));return child;};
 await assert.rejects(()=>executeCaptured('unused',[],{spawnImpl}),error=>error.message==='CAPTURED_TOOL_FAILED');
});
test('canonical staging rejects held ID, broad raster and data image content',async()=>{
 const root=await mkdtemp(join(tmpdir(),'manual-stage-'));
 try {
  const dist=join(root,'apps/site/dist');await mkdir(dist,{recursive:true});
  await writeFile(join(root,'release.json'),JSON.stringify({sourceSha:selection.sourceSha,productionEligible:true,event:'push',gitRef:'refs/heads/main',workflowRunId:selection.runId,workflowRunAttempt:1,serverAuthoritySha:authority.serverSha,wranglerVersion:authority.wrangler,validation:{source:'PASS',final:'PASS'}}));
  await writeFile(join(root,'apps/site/wrangler.jsonc'),JSON.stringify({name:authority.worker,compatibility_date:'2026-01-01',workers_dev:false,preview_urls:false,assets:{directory:'./dist',not_found_handling:'404-page'}}));
  for(const route of ['','about','education','notes','projects','search','tools/prime-factorizer']){await mkdir(join(dist,route),{recursive:true});await writeFile(join(dist,route,'index.html'),'<html>approved</html>');}
  const held=Array.from({length:44},(_,n)=>uid(n+1));assert.equal((await readPublicTargets(root,selection,held)).rasterCount,0);
  await writeFile(join(dist,'index.html'),'<img src="data:image/gif;base64,AA">');await assert.rejects(()=>readPublicTargets(root,selection,held),/HELD_OR_PRIVATE_MEDIA/);
  await writeFile(join(dist,'index.html'),held[0]);await assert.rejects(()=>readPublicTargets(root,selection,held),/HELD_OR_PRIVATE_MEDIA/);
  await writeFile(join(dist,'index.html'),'<html>approved</html>');await writeFile(join(dist,'private.gif'),'raster');await assert.rejects(()=>readPublicTargets(root,selection,held),/UNAPPROVED_RASTER/);
 } finally {await rm(root,{recursive:true,force:true});}
});
test('actual workflow equals reviewed manual-only template and installs before secrets',async()=>{
 const template=await readFile(new URL('../../docs/operations/manual-site-deploy.workflow.yml',import.meta.url),'utf8'),live=await readFile(new URL('../../.github/workflows/deploy-site.yml',import.meta.url),'utf8');
 assert.ok(template.includes('workflow_dispatch:'));assert.ok(!/^\s+(push|pull_request):/m.test(template));assert.ok(template.indexOf('npm install --prefix')<template.indexOf('secrets.CLOUDFLARE_SITE_API_TOKEN'));
 assert.equal(live,template);assertManualWorkflow(live);
});

function githubFixture(change=()=>{}) {
 const calls=[],root=['apps','packages','schemas','scripts','package.json','package-lock.json','.node-version'].map(path=>({path,sha:'c'.repeat(40),mode:path.includes('.')?'100644':'040000',type:path.includes('.')?'blob':'tree'}));
 const fetchImpl=async(url,options)=>{
  calls.push({url,method:options.method});
  const u=new URL(url),p=u.pathname;let body;
  if(p.endsWith('/branches/main'))body={protected:true,commit:{sha:env.GITHUB_SHA}};
  else if(p.endsWith('/actions/runs/'+env.GITHUB_RUN_ID))body={event:'workflow_dispatch',head_branch:'main',head_sha:env.GITHUB_SHA,run_attempt:1,path:'.github/workflows/deploy-site.yml',actor:{login:'Xpotato1024'},triggering_actor:{login:'Xpotato1024'}};
  else if(p.endsWith('/check-runs'))body={total_count:2,check_runs:['result','offline-policy'].map(name=>({name,app:{id:15368},status:'completed',conclusion:'success'}))};
  else if(p.endsWith('/environments/site-production'))body={id:17,name:'site-production',can_admins_bypass:false,protection_rules:[{type:'required_reviewers',prevent_self_review:false,reviewers:[{reviewer:{login:'Xpotato1024'}}]}],deployment_branch_policy:{custom_branch_policies:true}};
  else if(p.endsWith('/deployment-branch-policies'))body={total_count:1,branch_policies:[{name:'main',type:'branch'}]};
  else if(p.endsWith('/approvals'))body=[{state:'approved',user:{login:'Xpotato1024'},environments:[{id:17,name:'site-production'}]}];
  else if(p.includes('/compare/'))body={status:'ahead',merge_base_commit:{sha:selection.sourceSha}};
  else if(p.includes('/git/commits/'))body={tree:{sha:p.endsWith(selection.sourceSha)?'1'.repeat(40):'2'.repeat(40)}};
  else if(p.includes('/git/trees/')) {
   if(u.searchParams.has('recursive')&&(p.endsWith('3'.repeat(40))||p.endsWith('4'.repeat(40))))body={truncated:false,tree:[{path:'content-contracts/src/existing.ts',sha:'c'.repeat(40),mode:'100644',type:'blob'},{path:repositoryGuardPath,sha:p.endsWith('3'.repeat(40))?oldRepositoryGuardBlob:reviewedRepositoryGuardBlob,mode:'100644',type:'blob'}]};
   else if(u.searchParams.has('recursive'))body={truncated:false,tree:[{path:'release/existing.mjs',sha:'c'.repeat(40),mode:'100644',type:'blob'}]};
   else {body={truncated:false,tree:structuredClone(root)};body.tree.find(r=>r.path==='packages').sha=p.endsWith('1'.repeat(40))?'3'.repeat(40):'4'.repeat(40);}
  }
  else if(p.includes('/contents/'))body={sha:'c'.repeat(40),path:'docs/migration/content-materialization-v1.json',encoding:'base64',content:Buffer.from('{"schemaVersion":1}').toString('base64')};
  else throw Error('unexpected');
  const status=change(p,body,u)||200;
  return json(body,status);
 };
 return {calls,github:createManualGitHub({env,selection,credentialProvider:async()=>'githubcredential00',fetchImpl})};
}
test('GitHub runtime verifies owner approval, ancestor and unchanged build inputs via read only',async()=>{
 const f=githubFixture(),r=await f.github.verify();assert.equal(r.ownerEnvironmentApproved,true);assert.equal(r.mainProtectionDetail,'SERVER_ENFORCED_NOT_ADMIN_API_READ');assert.ok(f.calls.every(c=>c.method==='GET'));
 assert.deepEqual(await f.github.sourceJson('docs/migration/content-materialization-v1.json'),{schemaVersion:1});
 await assert.rejects(()=>f.github.sourceJson('unsafe'),/SOURCE_PATH_NOT_ALLOWED/);
});
for(const [name,change] of [
 ['main moved',(p,b)=>{if(p.endsWith('/branches/main'))b.commit.sha='e'.repeat(40)}],
 ['offline missing',(p,b)=>{if(p.endsWith('/check-runs'))b.check_runs[1].conclusion='failure'}],
 ['environment bypass',(p,b)=>{if(p.endsWith('/environments/site-production'))b.can_admins_bypass=true}],
 ['approval absent',(p,b)=>{if(p.endsWith('/approvals'))b.splice(0)}],
 ['not ancestor',(p,b)=>{if(p.includes('/compare/'))b.status='diverged'}],
 ['public inputs changed',(p,b)=>{if(p.includes('/git/trees/')&&b.tree?.[0]?.path==='apps')b.tree[0].sha=Math.random().toString(16)}],
 ['policy script changed',(p,b,u)=>{if(p.includes('/git/trees/')&&u.searchParams.has('recursive'))b.tree[0].sha=Math.random().toString(16)}],
 ['incomplete tree',(p,b)=>{if(p.includes('/git/trees/'))b.truncated=true}],
 ['permission denied',()=>403]
])test('GitHub rejects '+name,async()=>{await assert.rejects(()=>githubFixture(change).github.verify());});
test('missing not_before is explicitly absent when own token status is active',async()=>{
 const f=providerFixture((p,b)=>{if(p.endsWith('/tokens/verify'))delete b.result.not_before});
 const r=await f.provider.verifyDeployToken();assert.equal(r.notBefore,null);assert.equal(r.notBeforeEvidence,'ABSENT_ACTIVE_STATUS');assert.equal(r.issuedOn,null);assert.equal(r.lifetimeBasis,'OWNER_CONFIRMED_UTC_DATE_LOWER_BOUND');
});
test('runtime-derived identities remain fixed and separate during an operation',async()=>{
 let count=0;const f=providerFixture((p,b)=>{if(p.endsWith('/tokens/verify')&&++count===2)b.result.id=id(9)});
 await f.provider.verifyDeployToken();await assert.rejects(()=>f.provider.verifyDeployToken(),/DEPLOY_TOKEN_CHANGED/);
 const reused=providerFixture((p,b)=>{if(p.endsWith('/tokens/verify'))b.result.id=id(4)});
 await reused.provider.verifyDeployToken();await assert.rejects(()=>reused.provider.snapshot(),/READONLY_TOKEN_IDENTITY/);
});
test('automatic events, branch/actor/attempt bypasses and extra jobs cannot enter manual path',async()=>{
 const actual=await readFile(new URL('../../.github/workflows/deploy-site.yml',import.meta.url),'utf8');
 for(const change of [actual.replace('workflow_dispatch:','push:'),actual.replace("github.ref == 'refs/heads/main'","true"),actual.replace("github.actor == 'Xpotato1024'","true"),actual.replace('github.run_attempt == 1','true'),actual+'\n  other-job:\n    runs-on: ubuntu-latest\n',actual+'\n  secret: \u0024{{ secrets.FAKE }}\n'])assert.throws(()=>assertManualWorkflow(change),/MANUAL_WORKFLOW_BOUNDARY/);
});

for(const [name,change] of [
 ['missing expiry',(p,b)=>{if(p.endsWith('/tokens/verify'))delete b.result.expires_on}],
 ['nonexpiring token',(p,b)=>{if(p.endsWith('/tokens/verify'))b.result.expires_on=null}],
 ['90 day lifetime exceeded',(p,b)=>{if(p.endsWith('/tokens/verify'))b.result.expires_on='2026-12-30T00:00:01Z'}],
 ['under seven days remaining',(p,b)=>{if(p.endsWith('/tokens/verify'))b.result.expires_on='2026-10-19T13:59:59Z'}],
 ['future not_before',(p,b)=>{if(p.endsWith('/tokens/verify'))b.result.not_before='2026-10-13T00:00:00Z'}]
])test('runtime token time check rejects '+name,async()=>{await assert.rejects(()=>providerFixture(change).provider.verifyDeployToken());});
test('creation date bound is conservative; an exact owner timestamp can resolve the 90-day boundary',async()=>{
 const expires='2026-12-30T14:00:00Z',change=(p,b)=>{if(p.endsWith('/tokens/verify'))b.result.expires_on=expires};
 await assert.rejects(()=>providerFixture(change).provider.verifyDeployToken(),/DEPLOY_TOKEN_POLICY_OR_ROTATION/);
 const exact={...context,tokenPolicy:{...context.tokenPolicy,issuedOn:'2026-10-01T14:00:00Z'}};
 const r=await providerFixture(change,exact).provider.verifyDeployToken();assert.equal(r.lifetimeBasis,'OWNER_EXACT_ISSUED_ON');assert.equal(r.expiresOn,expires);
});
test('60 day rotation, future creation and timestamps outside the confirmed UTC day stop before write',async()=>{
 for(const tokenPolicy of [
  {...context.tokenPolicy,createdOnUtcDate:'2026-08-13'},
  {...context.tokenPolicy,createdOnUtcDate:'2026-10-13'},
  {...context.tokenPolicy,issuedOn:'2026-10-02T00:00:00Z'},
  {...context.tokenPolicy,issuedOn:'2026-09-30T23:59:59Z'}
 ])await assert.rejects(()=>providerFixture(()=>{}, {...context,tokenPolicy}).provider.verifyDeployToken(),/DEPLOY_TOKEN_POLICY_OR_ROTATION/);
});
test('context rejects invalid UTC date, unknown fields and old self-comparison scope pins',()=>{
 for(const patch of [{permissionGroupId:id(6)},{ownerPolicyReviewed:false},{tokenPolicy:{...context.tokenPolicy,createdOnUtcDate:'2026-02-30'}},{tokenPolicy:{...context.tokenPolicy,issuedOn:'today'}},{tokenPolicy:{...context.tokenPolicy,secretValue:'synthetic'}}])assert.throws(()=>providerFixture(()=>{}, {...context,...patch}));
});
test('runtime derived Worker and readonly identity drift is refused',async()=>{
 let count=0;const worker=providerFixture((p,b)=>{if(p.endsWith('/scripts')&&++count===2)b.result[0].tag=id(8)});
 await worker.provider.snapshot();await assert.rejects(()=>worker.provider.snapshot(),/WORKER_IDENTITY/);
 count=0;const reader=providerFixture((p,b)=>{if(p.endsWith('/tokens/verify')&&++count===2)b.result.id=id(8)});
 await reader.provider.snapshot();await assert.rejects(()=>reader.provider.snapshot(),/READONLY_TOKEN_IDENTITY/);
});

for(const [name,change] of [
 ['missing zone',(p,b)=>{if(p.endsWith('/domains'))delete b.result[0].zone_id}],
 ['inactive domain',(p,b)=>{if(p.endsWith('/domains'))b.result[0].enabled=false}],
 ['domain previews',(p,b)=>{if(p.endsWith('/domains'))b.result[0].previews_enabled=true}]
])test('domain-derived route target rejects '+name,async()=>{
 const f=providerFixture(change);await assert.rejects(()=>f.provider.snapshot(),/DOMAIN_ZONE_OR_ENDPOINT_DRIFT/);
 assert.ok(!f.calls.some(c=>new URL(c.url).pathname.endsWith('/workers/routes')));
});
test('domain zone is runtime-derived, route GET is exactly bound and later zone drift is refused',async()=>{
 let count=0;const f=providerFixture((p,b)=>{if(p.endsWith('/domains')&&++count===2)b.result[0].zone_id=id(8)});
 const r=await f.provider.snapshot();assert.equal(r.zoneId,id(3));
 assert.deepEqual(f.calls.filter(c=>new URL(c.url).pathname.endsWith('/workers/routes')).map(c=>new URL(c.url).pathname),['/client/v4/zones/'+id(3)+'/workers/routes']);
 await assert.rejects(()=>f.provider.snapshot(),/DOMAIN_ZONE_OR_ENDPOINT_DRIFT/);
});

function packageFixture() {
 return [oldRepositoryGuardBlob,reviewedRepositoryGuardBlob].map(sha=>({truncated:false,tree:[{path:repositoryGuardPath,sha,mode:'100644',type:'blob'},{path:'content-contracts/src/existing.ts',sha:'c'.repeat(40),mode:'100644',type:'blob'}]}));
}
test('package parity permits only the exact reviewed repository guard migration',()=>{
 assert.equal(assertPackageSourceParity(packageFixture()).repositoryGuard,'EXACT_REVIEWED_MANUAL_BOUNDARY_MIGRATION');
 const unchanged=packageFixture();unchanged[0].tree[0].sha=reviewedRepositoryGuardBlob;assert.equal(assertPackageSourceParity(unchanged).repositoryGuard,'UNCHANGED');
 for(const change of [trees=>{trees[1].tree[0].sha='d'.repeat(40)},trees=>{trees[1].tree[1].sha='d'.repeat(40)},trees=>{trees[1].tree[0].mode='120000'},trees=>{trees.reverse()},trees=>{trees[1].tree.push(trees[1].tree[0])},trees=>{trees[1].truncated=true}]) {
  const trees=packageFixture();change(trees);assert.throws(()=>assertPackageSourceParity(trees));
 }
});
test('repository validation really invokes manual boundary guard and matches its reviewed full blob',async()=>{
 const bytes=await readFile(new URL('../../packages/site-validators/src/repository-cli.ts',import.meta.url));
 const sha=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
 assert.equal(sha,reviewedRepositoryGuardBlob);
 const source=bytes.toString('utf8');assert.ok(source.includes('try { assertManualWorkflow(deployWorkflowSource); }'));assert.ok(source.includes('errors.push("deploy-site.yml must preserve'));
});
test('workflow declares exact config and rejects unsupported job-level runner context',async()=>{
 const actual=await readFile(new URL('../../.github/workflows/deploy-site.yml',import.meta.url),'utf8');
 assert.throws(()=>assertManualWorkflow(actual.replace('VNEXT_WRANGLER_CONFIG: apps/site/wrangler.jsonc','VNEXT_WRANGLER_CONFIG: other.jsonc')));
 const injected=actual.replace('    steps:','      UNSUPPORTED: \u0024{{ runner.temp }}\n    steps:');
 assert.throws(()=>assertManualWorkflow(injected),/MANUAL_WORKFLOW_BOUNDARY/);
 assert.ok(actual.includes("$env:MANUAL_OPERATION_ROOT = Join-Path $env:RUNNER_TEMP 'site-manual-release'"));
 assert.ok(actual.includes("$env:MANUAL_TOOL_ROOT = Join-Path $env:RUNNER_TEMP 'site-manual-tools'"));
});
