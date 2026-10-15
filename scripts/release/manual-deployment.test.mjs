import {assertPackageSourceParity,oldRepositoryGuardBlob,reviewedRepositoryGuardBlob,repositoryGuardPath,reviewedGuardTransitions,reviewedSchemaTreePair} from './manual-deployment-source-policy.mjs';
import {createHash} from 'node:crypto';
import {assertManualWorkflow} from './manual-deployment-workflow-policy.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {EventEmitter} from 'node:events';
import {authority} from './deployment-policy.mjs';
import {createManualProvider,ManualDeployError,assessZoneWorkerRoutes} from './manual-deployment-provider.mjs';
import {requireManualRun,runManualDeployment,readPublicTargets,hashBytes,runTokenDiagnosticsOnly} from './manual-deployment.mjs';
import {createManualGitHub} from './manual-deployment-github.mjs';
import {createPublicReadback} from './manual-deployment-public.mjs';
import {homeWorkshopPublicObjects,assertHomeWorkshopPublicObject,assertHomeWorkshopPublicObjects,assertHomeWorkshopImageReferences,isRasterBytes} from './home-workshop-public-policy.mjs';
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
  const held=Array.from({length:44},(_,n)=>uid(n+1));await assert.rejects(()=>readPublicTargets(root,selection,held),/HOME_WORKSHOP_PHOTO_SET/);
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
   if(u.searchParams.has('recursive')&&(p.endsWith('3'.repeat(40))||p.endsWith('4'.repeat(40))))body=packageFixture()[p.endsWith('3'.repeat(40))?0:1];
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
 return [0,1].map(side=>({truncated:false,tree:[...Object.entries(reviewedGuardTransitions).map(([path,pair])=>({path,sha:pair[side],mode:'100644',type:'blob'})),{path:'content-contracts/src/existing.ts',sha:'c'.repeat(40),mode:'100644',type:'blob'}]}));
}
test('package parity permits only the exact reviewed repository guard migration',()=>{
 assert.equal(assertPackageSourceParity(packageFixture()).repositoryGuard,'EXACT_REVIEWED_MANUAL_BOUNDARY_MIGRATION');
 const unchanged=packageFixture();unchanged[0]=structuredClone(unchanged[1]);assert.equal(assertPackageSourceParity(unchanged).repositoryGuard,'UNCHANGED');
 for(const change of [trees=>{trees[1].tree[0].sha='d'.repeat(40)},trees=>{trees[1].tree.at(-1).sha='d'.repeat(40)},trees=>{trees[1].tree[0].mode='120000'},trees=>{trees.reverse()},trees=>{trees[1].tree.push(trees[1].tree[0])},trees=>{trees[1].truncated=true}]) {
  const trees=packageFixture();change(trees);assert.throws(()=>assertPackageSourceParity(trees));
 }
});
test('repository validation invokes manual boundary guard and historical compatibility rejects newer blobs',async()=>{
 const bytes=await readFile(new URL('../../packages/site-validators/src/repository-cli.ts',import.meta.url));
 const sha=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
 assert.equal(reviewedRepositoryGuardBlob,reviewedGuardTransitions['site-validators/src/repository-cli.ts'][1]);
 if(sha!==reviewedRepositoryGuardBlob){
  const trees=packageFixture();trees[1].tree.find(row=>row.path==='site-validators/src/repository-cli.ts').sha=sha;
  assert.throws(()=>assertPackageSourceParity(trees),/UNREVIEWED_REPOSITORY_GUARD_CHANGE/);
 }else assert.equal(sha,reviewedRepositoryGuardBlob);
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

test('all four reviewed package transitions reject other bytes, removal and reverse migration',()=>{
 for(const path of Object.keys(reviewedGuardTransitions)) {
  for(const change of [r=>{r.sha='e'.repeat(40)},r=>{r.mode='120000'}]) {
   const trees=packageFixture();change(trees[1].tree.find(r=>r.path===path));assert.throws(()=>assertPackageSourceParity(trees));
  }
  const missing=packageFixture();missing[1].tree=missing[1].tree.filter(r=>r.path!==path);assert.throws(()=>assertPackageSourceParity(missing));
 }
});
test('current validators retain the manual guard; historical transitions reject newer validator bytes',async()=>{
 for(const [path,[,expected]] of Object.entries(reviewedGuardTransitions)) {
  const bytes=await readFile(new URL('../../packages/'+path,import.meta.url));
  const current=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  if(current===expected)assert.equal(current,expected);
  else {
   // A fresh validator needs a fresh validated artifact; this is not another
   // production compatibility exception for a historical approved artifact.
   const trees=packageFixture();trees[1].tree.find(row=>row.path===path).sha=current;
   assert.throws(()=>assertPackageSourceParity(trees),/UNREVIEWED_REPOSITORY_GUARD_CHANGE/);
  }
  if(path.includes('readiness.ts'))assert.ok(bytes.toString().includes('assertManualWorkflow('));
 }
 const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 for(const phase of [7,8]) {
  const name=phase===7?'interactive':'route-discovery';
  const manifest=JSON.parse(await readFile(new URL('../../docs/migration/phase'+phase+'-'+name+'-readiness-v1.json',import.meta.url),'utf8'));
  const {manifestPayloadSha256,...payload}=manifest;
  assert.equal(payload.safety.deployWorkflowGate,'owner-main-manual-environment-production-artifact');
  assert.equal(createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex'),manifestPayloadSha256);
 }
});

test('schema source accepts the exact reviewed tree pair and rejects arbitrary changes',async()=>{
 const rewrite=(p,b,u)=>{if(p.includes('/git/trees/')&&!u.searchParams.has('recursive')&&b.tree?.some(r=>r.path==='schemas'))b.tree.find(r=>r.path==='schemas').sha=reviewedSchemaTreePair[p.endsWith('1'.repeat(40))?0:1];};
 await githubFixture(rewrite).github.verify();
 await assert.rejects(()=>githubFixture((p,b,u)=>{rewrite(p,b,u);if(p.endsWith('2'.repeat(40))&&b.tree?.some(r=>r.path==='schemas'))b.tree.find(r=>r.path==='schemas').sha='e'.repeat(40);}).github.verify(),/PUBLIC_BUILD_INPUTS_CHANGED/);
 const schema=JSON.parse(await readFile(new URL('../../schemas/generated/phase7-interactive-readiness-manifest.schema.json',import.meta.url),'utf8'));
 assert.deepEqual(schema.properties.safety.properties.deployWorkflowGate.enum,['if: ${{ false }}','owner-main-manual-environment-production-artifact']);
});

test('optional expiry omitted reproduces the stop with a specific nonsecret reason',async()=>{
 const f=providerFixture((p,b)=>{if(p.endsWith('/tokens/verify'))delete b.result.expires_on});
 const r=await f.provider.diagnoseDeployToken();
 assert.equal(r.code,'DEPLOY_TOKEN_EXPIRY_MISSING');assert.equal(r.diagnostics.fields.expires_on.present,false);
 assert.equal(r.deployAllowed,false);assert.equal(r.deployCount,0);assert.equal(r.providerWrites,0);
 assert.equal(f.calls.length,1);assert.ok(new URL(f.calls[0].url).pathname.endsWith('/tokens/verify'));assert.equal(f.calls[0].method,'GET');
});
test('optional not_before omitted passes only the token check; missing both still blocks expiry',async()=>{
 const absent=providerFixture((p,b)=>{if(p.endsWith('/tokens/verify'))delete b.result.not_before});
 const pass=await absent.provider.diagnoseDeployToken();assert.equal(pass.status,'TOKEN_VERIFY_CHECK_PASSED');
 assert.equal(pass.diagnostics.fields.not_before.state,'absent');assert.equal(pass.deployAllowed,false);
 const both=providerFixture((p,b)=>{if(p.endsWith('/tokens/verify')){delete b.result.not_before;delete b.result.expires_on}});
 assert.equal((await both.provider.diagnoseDeployToken()).code,'DEPLOY_TOKEN_EXPIRY_MISSING');
});
for(const [name,change,expected] of [
 ['ID missing',v=>{delete v.id},'DEPLOY_TOKEN_ID_MISSING'],
 ['ID malformed',v=>{v.id='synthetic-private-value'},'DEPLOY_TOKEN_ID_FORMAT'],
 ['inactive',v=>{v.status='disabled'},'DEPLOY_TOKEN_NOT_ACTIVE'],
 ['status unknown',v=>{v.status='synthetic-private-value'},'DEPLOY_TOKEN_NOT_ACTIVE'],
 ['expiry null',v=>{v.expires_on=null},'DEPLOY_TOKEN_EXPIRY_FORMAT'],
 ['expiry invalid',v=>{v.expires_on='synthetic-private-value'},'DEPLOY_TOKEN_EXPIRY_FORMAT'],
 ['not_before null',v=>{v.not_before=null},'DEPLOY_TOKEN_NOT_BEFORE_FORMAT'],
 ['not_before invalid',v=>{v.not_before='synthetic-private-value'},'DEPLOY_TOKEN_NOT_BEFORE_FORMAT'],
 ['not_before future',v=>{v.not_before='2026-10-13T00:00:00Z'},'DEPLOY_TOKEN_NOT_BEFORE_FUTURE']
])test('diagnosis identifies '+name+' without response values',async()=>{
 const f=providerFixture((p,b)=>{if(p.endsWith('/tokens/verify')){change(b.result);b.result.privateBody='synthetic-private-value'}});
 const r=await f.provider.diagnoseDeployToken();assert.equal(r.code,expected);
 assert.ok(!JSON.stringify(r).includes('synthetic-private-value'));assert.ok(!JSON.stringify(r).includes(id(4)));assert.ok(!JSON.stringify(r).includes(id(5)));
 assert.equal(f.calls.length,1);assert.equal(r.deployCount,0);
});
test('policy safety still rejects unlimited, overlong, rotation due and short remaining lifetime',async()=>{
 for(const value of [undefined,null,'2030-01-01T00:00:00Z','2026-10-19T00:00:00Z']) {
  const f=providerFixture((p,b)=>{if(p.endsWith('/tokens/verify'))b.result.expires_on=value});
  const r=await f.provider.diagnoseDeployToken();assert.ok(r.code);assert.equal(r.deployCount,0);
 }
 const due=providerFixture(()=>{}, {...context,tokenPolicy:{...context.tokenPolicy,createdOnUtcDate:'2026-08-13'}});
 const r=await due.provider.diagnoseDeployToken();assert.equal(r.diagnostics.policy.state,'blocked');
});
test('diagnosis transport failure stays sanitized and makes one read with no retry',async()=>{
 const f=providerFixture(()=>403),r=await f.provider.diagnoseDeployToken();
 assert.equal(r.code,'REMOTE_HTTP_403');assert.equal(f.calls.length,1);assert.equal(r.providerWrites,0);
});
test('deployment stop persists only safe token field diagnostics before every write',async()=>{
 const p=providerFixture((path,b)=>{if(path.endsWith('/tokens/verify'))delete b.result.expires_on});
 const f=fixture({provider:p.provider}),r=await runManualDeployment(f.input);
 assert.equal(r.deployCount,0);assert.equal(r.code,'DEPLOY_TOKEN_EXPIRY_MISSING');
 assert.equal(r.diagnostics.fields.expires_on.present,false);assert.ok(!f.calls.includes('deploy'));
 assert.ok(!JSON.stringify(r).includes(id(4)));assert.ok(!JSON.stringify(r).includes(id(5)));
});
test('diagnostic mode cannot fall through into deploy; actual CLI returns before manifest and staging use',async()=>{
 const calls=[],provider={diagnoseDeployToken:async()=>{calls.push('verifyGET');return {deployCount:0,providerWrites:0}}};
 await runTokenDiagnosticsOnly({env:{...env,DIAGNOSTIC_ONLY:'true'},provider,verifyGitHub:async()=>calls.push('github'),persist:async()=>calls.push('persist')});
 assert.deepEqual(calls,['github','verifyGET','persist']);
 for(const mode of [undefined,'false','TRUE'])await assert.rejects(()=>runTokenDiagnosticsOnly({env:{...env,DIAGNOSTIC_ONLY:mode},provider}),/DIAGNOSTIC_ONLY_MODE_REQUIRED/);
 const cli=await readFile(new URL('./manual-deployment-cli.mjs',import.meta.url),'utf8');
 assert.ok(cli.indexOf("if(env.DIAGNOSTIC_ONLY==='true')")<cli.indexOf('const manifest='));
 assert.ok(cli.slice(cli.indexOf("if(env.DIAGNOSTIC_ONLY==='true')"),cli.indexOf('const manifest=')).includes('return;'));
 const actual=await readFile(new URL('../../.github/workflows/deploy-site.yml',import.meta.url),'utf8');
 assert.throws(()=>assertManualWorkflow(actual.replace('        default: false','        default: true')));
});

test('unreported expiry stays blocked unless the one-time owner acceptance is explicitly true',async()=>{
 for(const acceptance of [undefined,false]) {
  const tokenPolicy={...context.tokenPolicy,...acceptance===undefined?{}:{acceptUnreportedExpiry:acceptance}};
  const f=providerFixture((p,b)=>{if(p.endsWith('/tokens/verify'))delete b.result.expires_on},{...context,tokenPolicy});
  assert.equal((await f.provider.diagnoseDeployToken()).code,'DEPLOY_TOKEN_EXPIRY_MISSING');
 }
 for(const acceptance of [null,'true',1])assert.throws(()=>providerFixture(()=>{},{...context,tokenPolicy:{...context.tokenPolicy,acceptUnreportedExpiry:acceptance}}),/OWNER_POLICY_PIN_REQUIRED/);
});
test('explicitly accepted unreported expiry remains UNKNOWN rather than unlimited or verified',async()=>{
 const accepted={...context,tokenPolicy:{...context.tokenPolicy,acceptUnreportedExpiry:true}};
 const f=providerFixture((p,b)=>{if(p.endsWith('/tokens/verify')){delete b.result.expires_on;delete b.result.not_before}},accepted);
 const r=await f.provider.diagnoseDeployToken();assert.equal(r.code,null);
 assert.equal(r.diagnostics.policy.state,'unverified_expiry_accepted');assert.equal(r.diagnostics.policy.expiryEvidence,'UNREPORTED');
 assert.equal(r.diagnostics.policy.lifetimeVerified,false);assert.equal(r.diagnostics.policy.rotationEnforced,false);
 assert.equal(r.diagnostics.reasonCode,'TOKEN_ACTIVE_EXPIRY_UNREPORTED');assert.equal(r.deployAllowed,false);
 assert.ok(!JSON.stringify(r).includes(id(4)));assert.equal(f.calls.length,1);
 const token=await f.provider.verifyDeployToken();assert.equal(token.expiresOn,null);
 assert.equal(token.lifetimeBasis,'NO_PROVIDER_EXPIRY_EVIDENCE');assert.equal(token.tokenLifetimePolicyVerified,false);
});
test('acceptance does not admit explicit null, invalid dates, inactive status or future not_before',async()=>{
 const accepted={...context,tokenPolicy:{...context.tokenPolicy,acceptUnreportedExpiry:true}};
 for(const change of [v=>{v.expires_on=null},v=>{v.expires_on=''},v=>{v.expires_on='invalid'},v=>{v.status='expired'},v=>{delete v.expires_on;v.not_before='2026-10-13T00:00:00Z'},v=>{delete v.expires_on;v.not_before=null}]) {
  const f=providerFixture((p,b)=>{if(p.endsWith('/tokens/verify'))change(b.result)},accepted);
  assert.ok((await f.provider.diagnoseDeployToken()).code);await assert.rejects(()=>f.provider.verifyDeployToken());
 }
});
test('reported expiry still enforces expiry, 90-day, 60-day and seven-day limits with acceptance set',async()=>{
 const accepted={...context,tokenPolicy:{...context.tokenPolicy,acceptUnreportedExpiry:true}};
 for(const expires_on of ['2026-10-11T00:00:00Z','2026-10-12T14:00:00Z','2030-01-01T00:00:00Z','2026-10-19T13:59:59Z']) {
  const r=await providerFixture((p,b)=>{if(p.endsWith('/tokens/verify'))b.result.expires_on=expires_on},accepted).provider.diagnoseDeployToken();assert.ok(r.code);
 }
 const due={...accepted,tokenPolicy:{...accepted.tokenPolicy,createdOnUtcDate:'2026-08-13'}};
 const r=await providerFixture((p,b)=>{if(p.endsWith('/tokens/verify'))b.result.expires_on='2026-10-20T00:00:00Z'},due).provider.diagnoseDeployToken();
 assert.equal(r.diagnostics.policy.reasonCode,'ROTATION_DUE');assert.equal(r.diagnostics.policy.rotationEnforced,true);
});
test('60-day rotation is advisory only for explicitly accepted unreported expiry',async()=>{
 const accepted={...context,tokenPolicy:{...context.tokenPolicy,createdOnUtcDate:'2026-08-13',acceptUnreportedExpiry:true}};
 const f=providerFixture((p,b)=>{if(p.endsWith('/tokens/verify'))delete b.result.expires_on},accepted);
 const r=await f.provider.diagnoseDeployToken();assert.equal(r.code,null);
 assert.equal(r.diagnostics.policy.rotationState,'due_by_confirmed_time_bound');assert.equal(r.diagnostics.policy.rotationEnforced,false);
});
test('reported to unreported expiry and the reverse stop as operation identity drift',async()=>{
 const accepted={...context,tokenPolicy:{...context.tokenPolicy,acceptUnreportedExpiry:true}};
 for(const reverse of [false,true]) {
  let calls=0;const f=providerFixture((p,b)=>{if(p.endsWith('/tokens/verify')&&((++calls===1)===reverse))delete b.result.expires_on},accepted);
  await f.provider.verifyDeployToken();await assert.rejects(()=>f.provider.verifyDeployToken(),/DEPLOY_TOKEN_CHANGED/);
 }
});
test('accepted unreported expiry still performs all pre/post deployment guards and reports uncertainty',async()=>{
 const accepted={...context,tokenPolicy:{...context.tokenPolicy,acceptUnreportedExpiry:true}};
 const p=providerFixture((path,b)=>{if(path.endsWith('/tokens/verify'))delete b.result.expires_on},accepted);
 const f=fixture();f.input.provider.verifyDeployToken=p.provider.verifyDeployToken;
 const r=await runManualDeployment(f.input);
 assert.equal(r.status,'DEPLOYED_READBACK_VERIFIED');assert.equal(r.expiryEvidence,'UNREPORTED');
 assert.equal(r.tokenLifetimePolicyVerified,false);assert.equal(r.rotationEnforced,false);
 assert.equal(r.credentialLifecycle,'ACTIVE_AT_LAST_VERIFY_WITH_UNREPORTED_EXPIRY');
 assert.ok(f.calls.includes('github'));assert.ok(f.calls.includes('persist'));assert.ok(f.calls.includes('published'));
 assert.equal(f.calls.filter(x=>x==='deploy').length,1);
});

const routeBody=(rows=[],info)=>({success:true,errors:[],messages:[],result:rows,...info===undefined?{}:{result_info:info}});
const routeRow=(pattern='links.xpotato.net/*',script,routeId='route-1')=>({id:routeId,pattern,...script===undefined?{}:{script}});
test('unfiltered SinglePage routes accept absent and consistent optional metadata',async()=>{
  for(const info of [undefined,{}, {count:0},{total_count:0},{page:1},{page:1,per_page:100,count:0,total_count:0,total_pages:1}])assert.equal(assessZoneWorkerRoutes(routeBody([],info)).code,null);
  const f=providerFixture((path,body)=>{if(path.endsWith('/routes'))delete body.result_info;});
  assert.equal((await f.provider.snapshot()).routes,0);
  assert.ok(f.calls.filter(call=>new URL(call.url).pathname.endsWith('/routes')).every(call=>call.method==='GET'&&new URL(call.url).search===''));
});
test('route metadata partial, contradictory, malformed and unsupported signals have separate safe reasons',()=>{
  const cases=[
    [{page:2},'ROUTE_PAGE_INFO_INCOMPLETE'],[{total_pages:2},'ROUTE_PAGE_INFO_INCOMPLETE'],[{total_count:1},'ROUTE_PAGE_INFO_INCOMPLETE'],
    [{count:1},'ROUTE_PAGE_INFO_CONTRADICTORY'],[{count:-1},'ROUTE_PAGE_INFO_MALFORMED'],[{count:null},'ROUTE_PAGE_INFO_MALFORMED'],
    [{count:'0'},'ROUTE_PAGE_INFO_MALFORMED'],[{count:false},'ROUTE_PAGE_INFO_MALFORMED'],[{page:0},'ROUTE_PAGE_INFO_MALFORMED'],
    [{per_page:0},'ROUTE_PAGE_INFO_MALFORMED'],[{total_pages:0},'ROUTE_PAGE_INFO_MALFORMED'],[null,'ROUTE_PAGE_INFO_MALFORMED'],
    [[], 'ROUTE_PAGE_INFO_MALFORMED'],[{cursor:'synthetic-private-cursor'},'ROUTE_PAGE_INFO_UNSUPPORTED_FIELDS']
  ];
  for(const [info,reason] of cases){const a=assessZoneWorkerRoutes(routeBody([],info));assert.equal(a.code,'ROUTE_DRIFT');assert.equal(a.diagnostics.reasonCode,reason);}
  for(const info of [{per_page:1},{total_count:1}])assert.notEqual(assessZoneWorkerRoutes(routeBody([routeRow(),routeRow('tools.xpotato.net/*','other-worker','route-2')],info)).code,null);
});
test('missing route result and invalid envelopes cannot prove an empty inventory',()=>{
  for(const result of [undefined,null,{},'private-body',false])assert.equal(assessZoneWorkerRoutes({...routeBody(),result}).diagnostics.reasonCode,'ROUTE_RESULT_MISSING_OR_INVALID');
  for(const body of [null,[],{...routeBody(),success:false},{...routeBody(),errors:null},{...routeBody(),errors:[{message:'synthetic-private-error'}]},{...routeBody(),messages:{}}])assert.equal(assessZoneWorkerRoutes(body).diagnostics.reasonCode,'ROUTE_ENVELOPE_INVALID');
  assert.equal(assessZoneWorkerRoutes({...routeBody(),next:'synthetic-private-cursor'}).diagnostics.reasonCode,'ROUTE_ENVELOPE_UNSUPPORTED_FIELDS');
});
test('invalid and duplicate route rows remain blocked',()=>{
  for(const row of [null,[],{},routeRow('links.xpotato.net/*',null),routeRow('links.xpotato.net/*',42),{...routeRow(),id:''},{...routeRow(),id:'x'.repeat(33)},{...routeRow(),id:42},{...routeRow(),pattern:null},routeRow('links.xpotato.net/*','bad\nscript')])assert.equal(assessZoneWorkerRoutes(routeBody([row])).diagnostics.reasonCode,'ROUTE_ROW_INVALID');
  assert.equal(assessZoneWorkerRoutes(routeBody([routeRow(),routeRow('tools.xpotato.net/*')])).diagnostics.reasonCode,'ROUTE_ID_DUPLICATE');
  assert.equal(assessZoneWorkerRoutes(routeBody([routeRow('links.xpotato.net'),routeRow('links.xpotato.net/','other-worker','route-2')])).diagnostics.reasonCode,'ROUTE_PATTERN_DUPLICATE');
  assert.equal(assessZoneWorkerRoutes(routeBody([routeRow('http://links.xpotato.net/'),routeRow('https://links.xpotato.net/','other-worker','route-2')])).code,null);
});
test('uninterpretable route patterns cannot silently be treated as unrelated',()=>{
  for(const pattern of ['', ' links.xpotato.net/*','ftp://links.xpotato.net/*','links.xpotato.net/*.jpg','links.xpotato.net/?a=*','x*potato.net/*','links.xpotato.net/#part','links.xpotato.net\\private','links.xpotato.net:443/*'])assert.equal(assessZoneWorkerRoutes(routeBody([routeRow(pattern)])).diagnostics.reasonCode,'ROUTE_PATTERN_UNINTERPRETABLE');
});
test('any route targeting the Site Worker remains drift regardless of hostname',()=>{
  assert.equal(assessZoneWorkerRoutes(routeBody([routeRow('links.xpotato.net/*',authority.worker)])).diagnostics.reasonCode,'SITE_WORKER_ROUTE_PRESENT');
});
test('exact and wildcard Site hostname overlap blocks other Workers and bypass routes on every path',()=>{
  for(const pattern of ['xpotato.net','XPoTaTo.NET','xpotato.net/','xpotato.net/unprobed/*','http://xpotato.net/private','https://xpotato.net/private','*xpotato.net/*','*potato.net','*.net/*'])for(const script of ['other-worker',undefined,''])assert.equal(assessZoneWorkerRoutes(routeBody([routeRow(pattern,script)])).diagnostics.reasonCode,'SITE_HOSTNAME_ROUTE_OVERLAP',pattern);
});
test('unrelated Worker and bypass routes preserve SinglePage inventory acceptance',()=>{
  for(const pattern of ['links.xpotato.net','links.xpotato.net/*','https://links.xpotato.net/path*','*.xpotato.net/*'])for(const script of ['other-worker',undefined,''])assert.equal(assessZoneWorkerRoutes(routeBody([routeRow(pattern,script)])).code,null,pattern);
});
test('route diagnostics are frozen enums and shape facts without values or API text',async()=>{
  const sentinel='synthetic-private-sentinel';
  const f=providerFixture((path,body)=>{if(path.endsWith('/routes')){delete body.result_info;body.result=[routeRow('xpotato.net/'+sentinel,sentinel,sentinel)];}});
  await assert.rejects(()=>f.provider.snapshot(),error=>{
    assert.ok(error instanceof ManualDeployError);assert.equal(error.message,'ROUTE_DRIFT');
    assert.equal(error.diagnostics.reasonCode,'SITE_HOSTNAME_ROUTE_OVERLAP');
    assert.equal(error.diagnostics.stage,'ZONE_WORKER_ROUTES');
    assert.ok(Object.isFrozen(error.diagnostics)&&Object.isFrozen(error.diagnostics.fields)&&Object.isFrozen(error.diagnostics.fields.result)&&Object.isFrozen(error.diagnostics.checks));
    assert.ok(!JSON.stringify(error.diagnostics).includes(sentinel));return true;
  });
  const a=assessZoneWorkerRoutes({...routeBody(),errors:[{message:sentinel}]});
  assert.ok(!JSON.stringify(a).includes(sentinel));
});
for(const failedSnapshot of [1,2,3])test('route subreason persists at snapshot '+failedSnapshot+' with the correct mutation boundary',async()=>{
  let count=0;
  const f=providerFixture((path,body)=>{if(path.endsWith('/routes')&&++count===failedSnapshot){delete body.result_info;body.result=[routeRow('xpotato.net/private-path')];}});
  const operation=fixture({provider:f.provider}),result=await runManualDeployment(operation.input);
  assert.equal(result.code,'ROUTE_DRIFT');assert.equal(result.diagnostics.reasonCode,'SITE_HOSTNAME_ROUTE_OVERLAP');
  assert.equal(result.status,failedSnapshot===3?'STOPPED_OWNER_RECOVERY_REQUIRED':'STOPPED_BEFORE_DEPLOY');
  assert.equal(result.deployCount,failedSnapshot===3?1:0);
  assert.equal(operation.calls.filter(call=>call==='deploy').length,failedSnapshot===3?1:0);
  assert.ok(f.calls.every(call=>call.method==='GET'));
});
test('route response envelope failures are classified before generic provider envelope failure',async()=>{
  const f=providerFixture((path,body)=>{if(path.endsWith('/routes'))body.success=false;});
  await assert.rejects(()=>f.provider.snapshot(),error=>error.message==='ROUTE_DRIFT'&&error.diagnostics.reasonCode==='ROUTE_ENVELOPE_INVALID');
});
test('only the reviewed frozen photo table is admitted and all 13 are mandatory',async()=>{
 const reviewed=JSON.parse(await readFile(new URL('../../docs/design/home-workshop-candidate-v1.json',import.meta.url),'utf8'));
 const delivery=reviewed.registryCandidate.assets[0].delivery;
 const expected=[delivery.master,...delivery.variants].map(r=>({path:'/'+r.objectKey,bytes:r.sizeBytes,sha256:r.sha256}));
 assert.deepEqual(homeWorkshopPublicObjects,expected);assert.equal(expected.reduce((n,r)=>n+r.bytes,0),2804363);
 assert.ok(Object.isFrozen(homeWorkshopPublicObjects)&&homeWorkshopPublicObjects.every(Object.isFrozen));
 assert.equal(assertHomeWorkshopPublicObjects(structuredClone(expected)),homeWorkshopPublicObjects);
 for(const rows of [expected.slice(1),[...expected,expected[0]],[expected[0],...expected.slice(0,12)],[],null])assert.throws(()=>assertHomeWorkshopPublicObjects(rows),/HOME_WORKSHOP_PHOTO_SET/);
 for(const patch of [{bytes:expected[0].bytes+1},{sha256:'0'.repeat(64)},{other:true}])assert.throws(()=>assertHomeWorkshopPublicObject({...expected[0],...patch}),/UNAPPROVED_RASTER/);
 for(const path of ['//'+expected[0].path.slice(1),'/../'+expected[0].path.slice(1),expected[0].path+'?x=1',expected[0].path+'#x',expected[0].path.toUpperCase(),expected[0].path.replace('/media/','/%6dedia/'),'/private.jpg','/image.bin'])assert.throws(()=>assertHomeWorkshopPublicObject({...expected[0],path}),/UNAPPROVED_RASTER/);
});
test('raster magic is recognized even when extensions pretend to be text or other binary',()=>{
 for(const hex of ['ffd8ffdb','89504e470d0a1a0a','474946383961','424d','49492a00','4d4d002a','49492b00','4d4d002b','ff0a','0000000c4a584c200d0a870a'])assert.equal(isRasterBytes(Buffer.from(hex,'hex')),true);
 for(const [prefix,brand] of [['RIFF','WEBP'],['ftyp','avif'],['ftyp','mif1'],['ftyp','heic']]){
  const bytes=Buffer.alloc(12);bytes.write(prefix,prefix==='RIFF'?0:4,'ascii');bytes.write(brand,8,'ascii');assert.equal(isRasterBytes(bytes),true);
 }
 for(const value of ['wOF2font','<svg/>','body{}','<html/>',''])assert.equal(isRasterBytes(Buffer.from(value)),false);
});
test('image references remain self-origin and only exact approved raster paths',()=>{
 const photo=homeWorkshopPublicObjects[0].path,vector='/xpotato-logo.svg',assets=new Map([[vector,{}],[photo,{}]]);
 assert.doesNotThrow(()=>assertHomeWorkshopImageReferences('<img src="'+vector+'"><img src="'+photo+'" srcset="'+photo+' 640w">','/',assets,authority.hostname));
 assert.doesNotThrow(()=>assertHomeWorkshopImageReferences("a{background:url("+photo+")}","/style.css",assets,authority.hostname));
 assert.doesNotThrow(()=>assertHomeWorkshopImageReferences('<script>const u=new URL(e,document.baseURI)</script>','/',assets,authority.hostname));
 for(const text of ['<img src="/private.jpg">','<img src="/image.bin">','<source srcset="'+photo+' 640w, /private.jpg 960w">','<img src="https://example.test'+photo+'">','<img src="'+photo+'?x=1">','<img src="/extra/..'+photo+'">','<img src=/private.jpg>','<source srcset=/private.jpg>','<div style="background:url(/image.bin)">','<style>a{background:image-set("/private.jpg" 1x)}</style>','a{background:url(/image.bin)}','a{background:url(/private.p\\\\6eg)}','a{background:image-set("/private.jpg" 1x)}',"a{background:url(https://example.test/private.jpg)}"])assert.throws(()=>assertHomeWorkshopImageReferences(text,text.startsWith('a{')?'/style.css':'/',assets,authority.hostname),/UNAPPROVED_IMAGE_REFERENCE/);
});
test('public artifact scan rejects disguised raster and approved-path byte substitution',async()=>{
 for(const name of ['private.bin','private.jpg.html',homeWorkshopPublicObjects[0].path.slice(1)]){
  const root=await mkdtemp(join(tmpdir(),'manual-photo-negative-'));
  try{
   const dist=join(root,'apps/site/dist');await mkdir(dist,{recursive:true});
   await writeFile(join(root,'release.json'),JSON.stringify({sourceSha:selection.sourceSha,productionEligible:true,event:'push',gitRef:'refs/heads/main',workflowRunId:selection.runId,workflowRunAttempt:1,serverAuthoritySha:authority.serverSha,wranglerVersion:authority.wrangler,validation:{source:'PASS',final:'PASS'}}));
   await writeFile(join(root,'apps/site/wrangler.jsonc'),JSON.stringify({name:authority.worker,compatibility_date:'2026-01-01',workers_dev:false,preview_urls:false,assets:{directory:'./dist',not_found_handling:'404-page'}}));
   const path=join(dist,name);await mkdir(join(path,'..'),{recursive:true});await writeFile(path,Buffer.from('ffd8ffdb','hex'));
   await assert.rejects(()=>readPublicTargets(root,selection,Array.from({length:44},(_,n)=>uid(n+1))),/UNAPPROVED_RASTER/);
  }finally{await rm(root,{recursive:true,force:true});}
 }
});
