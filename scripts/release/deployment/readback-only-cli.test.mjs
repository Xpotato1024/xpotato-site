import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {deflateRawSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {fixture,selection,uuid,sentinel} from './readback-only.test-fixture.mjs';
import {hashBytes} from './manual-deployment.mjs';
import {main,runSyntheticReadbackCli,parseReadbackPlan} from './readback-only-cli.mjs';
import {crc32,readOriginalResult,downloadOriginalEvidence} from './readback-only-evidence.mjs';
import {assertReadbackWorkflow,readbackWorkflowSha256,readbackWorkflowPath} from './readback-only-workflow-policy.mjs';
import {authority} from './deployment-policy.mjs';

function archive(files){
  const local=[],central=[];let offset=0;
  for(const [name,value] of files){
    const body=Buffer.from(value),data=deflateRawSync(body),filename=Buffer.from(name),h=Buffer.alloc(30),c=Buffer.alloc(46);
    h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(8,8);h.writeUInt32LE(crc32(body),14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(body.length,22);h.writeUInt16LE(filename.length,26);
    c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);c.writeUInt32LE(crc32(body),16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(body.length,24);c.writeUInt16LE(filename.length,28);c.writeUInt32LE(offset,42);
    local.push(h,filename,data);central.push(c,filename);offset+=h.length+filename.length+data.length;
  }
  const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,cd,end]);
}
const pinFor=(zip,result)=>({name:'site-manual-evidence-13-1',bytes:zip.length,digest:'sha256:'+hashBytes(zip),resultBytes:result.length,resultSha256:hashBytes(result)});
async function cliFixture(t,change={}){
  const f=await fixture(t),workflow=await readFile(new URL('../../../.github/workflows/site-readback-only.yml',import.meta.url),'utf8');
  const files=[['manual-preimage.json','{}'],['manual-progress.json','{}'],['manual-result.json',f.originalBytes]];
  const zip=archive(files),pin=pinFor(zip,f.originalBytes),original=f.input.request.originalDeployment;
  const plan={schemaVersion:1,reviewedLibrarySha:'b'.repeat(40),selection,originalDeployment:original,expected:f.input.request.expected,evidenceArchive:pin};
  const planBytes=Buffer.from(JSON.stringify(plan));
  const env={GITHUB_REPOSITORY:authority.repository,GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',GITHUB_ACTOR:'Xpotato1024',
    GITHUB_TRIGGERING_ACTOR:'Xpotato1024',GITHUB_RUN_ATTEMPT:'1',GITHUB_ACTIONS:'true',CI:'true',RUNNER_OS:'Windows',READBACK_APPROVED:'true',
    GITHUB_SHA:'c'.repeat(40),READBACK_VERIFIER_SHA:'c'.repeat(40),GITHUB_RUN_ID:'88',GITHUB_REPOSITORY_ID:'42',READBACK_PLAN_SHA256:hashBytes(planBytes),READBACK_OPERATION_ID:uuid(5),
    RUNNER_TEMP:f.root,GITHUB_TOKEN:'synthetic-github-credential-000',CLOUDFLARE_SITE_API_TOKEN:'synthetic-write-credential-000',
    CLOUDFLARE_SITE_MONITOR_READ_TOKEN:'synthetic-read-credential-000',CLOUDFLARE_SITE_DEPLOY_CONTEXT_JSON:JSON.stringify(f.input.context)};
  const calls=[];let preparations=0;
  const fetchImpl=async(url,options)=>{
    const u=new URL(url);assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');assert.equal(options.body,undefined);
    calls.push({origin:u.origin,path:u.pathname,authenticated:!!options.headers.Authorization});
    if(u.hostname==='artifact-test.blob.core.windows.net'){
      assert.ok(!options.headers.Authorization);return change.signed?.(options)??new Response(zip);
    }
    if(u.origin!=='https://api.github.com')return f.input.fetchImpl(url,options);
    assert.equal(options.headers.Authorization,'Bearer synthetic-github-credential-000');
    if(u.pathname.endsWith('/actions/artifacts/14/zip'))return change.redirect?.(options)??new Response(null,{status:302,headers:{Location:'https://artifact-test.blob.core.windows.net/archive.zip?sig='+sentinel}});
    const path=u.pathname;let body;
    if(path.endsWith('/branches/main'))body={protected:true,commit:{sha:env.GITHUB_SHA}};
    else if(path.endsWith('/actions/runs/88'))body={id:88,repository:{id:42,full_name:authority.repository},event:'workflow_dispatch',head_branch:'main',head_sha:env.GITHUB_SHA,run_attempt:1,path:readbackWorkflowPath,status:'in_progress',actor:{login:'Xpotato1024'},triggering_actor:{login:'Xpotato1024'}};
    else if(path.endsWith('/check-runs'))body={total_count:2,check_runs:['result','offline-policy'].map(name=>({name,app:{id:15368},status:'completed',conclusion:'success'}))};
    else if(path.endsWith('/environments/site-production'))body={id:17,name:'site-production',can_admins_bypass:false,protection_rules:[{type:'required_reviewers',prevent_self_review:false,reviewers:[{reviewer:{login:'Xpotato1024'}}]}],deployment_branch_policy:{custom_branch_policies:true}};
    else if(path.endsWith('/deployment-branch-policies'))body={total_count:1,branch_policies:[{name:'main',type:'branch'}]};
    else if(path.endsWith('/approvals'))body=[{state:'approved',user:{login:'Xpotato1024'},environments:[{id:17,name:'site-production'}]}];
    else if(path.includes('/contents/'))body={path:readbackWorkflowPath,encoding:'base64',content:Buffer.from(workflow).toString('base64')};
    else if(path.includes('/compare/'))body={status:'ahead',merge_base_commit:{sha:selection.sourceSha}};
    else if(path.endsWith('/actions/runs/13/attempts/1'))body={id:13,run_attempt:1,repository:{id:42,full_name:authority.repository},name:'Site manual production deployment',path:'.github/workflows/deploy-site.yml',event:'workflow_dispatch',head_branch:'main',head_sha:selection.sourceSha,status:'completed',conclusion:'failure',actor:{login:'Xpotato1024'},triggering_actor:{login:'Xpotato1024'}};
    else if(path.endsWith('/actions/artifacts/14'))body={id:14,name:pin.name,expired:false,digest:pin.digest,size_in_bytes:pin.bytes,expires_at:'2027-02-02T00:00:00Z',workflow_run:{id:13,head_sha:selection.sourceSha,repository_id:42,head_repository_id:42}};
    else throw Error('Unexpected synthetic GitHub endpoint');
    const status=change.github?.({path,body,calls})??200;return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
  };
  const args={env,fetchImpl,planBytes,revision:env.GITHUB_SHA,clock:f.input.clock,prepareArtifact:async input=>{
    preparations++;if(change.prepare)await change.prepare(input);await mkdir(input.operationRoot);return f.artifact;
  }};
  return {f,args,env,zip,pin,files,plan,calls,preparations:()=>preparations,run:()=>runSyntheticReadbackCli(args),saved:async()=>JSON.parse(await readFile(join(f.root,'site-readback-result.json'),'utf8'))};
}
function safe(result){const text=JSON.stringify(result);for(const value of [sentinel,'synthetic-github-credential-000','synthetic-write-credential-000','synthetic-read-credential-000','Bearer ','Authorization','?sig='])assert.ok(!text.includes(value),value);}
test('manual workflow is exactly pinned, read-only permissions and Environment/owner/main guards are preserved',async()=>{
  const source=await readFile(new URL('../../../.github/workflows/site-readback-only.yml',import.meta.url),'utf8');
  assert.equal(hashBytes(source),readbackWorkflowSha256);assert.equal(assertReadbackWorkflow(source),true);
  for(const [from,to] of [['workflow_dispatch:','push:'],['workflow_dispatch:','pull_request:'],['workflow_dispatch:','schedule:'],['contents: read','contents: write'],['environment: site-production','environment: other'],["github.run_attempt == 1","github.run_attempt >= 1"],['persist-credentials: false','persist-credentials: true'],['if-no-files-found: error','if-no-files-found: warn'],["github.actor == 'Xpotato1024'","true"],['readback-only-cli.mjs','manual-deployment-cli.mjs']])assert.throws(()=>assertReadbackWorkflow(source.replace(from,to)),/READBACK_WORKFLOW_BOUNDARY/);
});
test('the whole synthetic CLI verifies GitHub approval, original archive and all readback stages without becoming live proof',async t=>{
  const c=await cliFixture(t),r=await c.run();assert.equal(r.status,'READBACK_ONLY_CHECKS_PASSED');assert.equal(r.evidenceMode,'synthetic');assert.equal(r.acceptance,false);assert.equal(r.reportSaved,true);
  assert.equal(r.readbackResult.evidenceMode,'synthetic');assert.equal(r.readbackResult.evidenceSaved,true);assert.equal(r.readbackResult.readback.observations.length,126);
  assert.equal(r.deployCount,0);assert.equal(r.providerWrites,0);assert.equal(c.preparations(),1);assert.equal(r.githubBefore.ownerEnvironmentApproved,true);assert.equal(r.githubAfter.ownerEnvironmentApproved,true);
  assert.equal(r.inputReceipt.selection.digest,selection.digest);assert.equal(r.inputReceipt.originalEvidence.digest,c.pin.digest);assert.equal(r.inputReceipt.verifierSha,c.env.GITHUB_SHA);assert.equal(r.inputReceipt.reviewedLibrarySha,'b'.repeat(40));
  assert.equal(r.execution.runId,'88');assert.equal(r.execution.verifierSha,c.env.GITHUB_SHA);assert.equal(r.inputReceipt.artifactRelationship,'already-deployed-verification-subject');
  assert.equal((await c.saved()).status,r.status);assert.ok(c.calls.some(row=>row.origin==='https://artifact-test.blob.core.windows.net'&&!row.authenticated));
  assert.ok(c.calls.filter(row=>row.authenticated).every(row=>['https://api.github.com','https://api.cloudflare.com'].includes(row.origin)));safe(r);
});
test('live main accepts no env or adapter override; the testing lane is a separate permanently synthetic API',async()=>{
  await assert.rejects(()=>main({GITHUB_ACTIONS:'true'}),/READBACK_LIVE_OVERRIDES_FORBIDDEN/);
});
for(const key of ['GITHUB_REPOSITORY','GITHUB_EVENT_NAME','GITHUB_REF','GITHUB_ACTOR','GITHUB_TRIGGERING_ACTOR','GITHUB_RUN_ATTEMPT','GITHUB_ACTIONS','CI','RUNNER_OS','READBACK_APPROVED','GITHUB_SHA','READBACK_VERIFIER_SHA','GITHUB_RUN_ID','GITHUB_REPOSITORY_ID','READBACK_PLAN_SHA256','READBACK_OPERATION_ID'])test('CLI guard refuses '+key+' before network and preserves a failure record',async t=>{
  const c=await cliFixture(t);c.env[key]='wrong';const r=await c.run();assert.equal(r.status,'READBACK_ONLY_FAILED');assert.equal(r.code,'READBACK_OWNER_MAIN_APPROVAL_REQUIRED');assert.equal(r.reportSaved,true);assert.equal(c.calls.length,0);assert.equal(c.preparations(),0);safe(r);
});
for(const [key,value,code] of [['platform','linux','READBACK_WINDOWS_RUNNER_REQUIRED'],['nodeVersion','1.0.0','READBACK_NODE_VERSION'],['revision','f'.repeat(40),'READBACK_VERIFIER_REVISION']])test('CLI runtime refuses '+key,async t=>{
  const c=await cliFixture(t);c.args[key]=value;const r=await c.run();assert.equal(r.code,code);assert.equal(c.calls.length,0);assert.equal(r.reportSaved,true);
});
test('review-pinned plan bytes and schema are required before any credential is used',async t=>{
  const c=await cliFixture(t);c.args.planBytes=Buffer.from(sentinel);let r=await c.run();assert.equal(r.code,'READBACK_PLAN_DIGEST');assert.equal(c.calls.length,0);safe(r);
  const d=await cliFixture(t);const plan=structuredClone(d.plan);plan.evidenceArchive.resultSha256='e'.repeat(64);d.args.planBytes=Buffer.from(JSON.stringify(plan));d.env.READBACK_PLAN_SHA256=hashBytes(d.args.planBytes);r=await d.run();assert.equal(r.code,'READBACK_PLAN_INVALID');assert.equal(d.calls.length,0);
});
for(const key of ['GITHUB_TOKEN','CLOUDFLARE_SITE_API_TOKEN','CLOUDFLARE_SITE_MONITOR_READ_TOKEN','CLOUDFLARE_SITE_DEPLOY_CONTEXT_JSON'])test('missing '+key+' stays incomplete with no network or artifact acquisition',async t=>{
  const c=await cliFixture(t);delete c.env[key];const r=await c.run();assert.equal(r.status,'READBACK_ONLY_INCOMPLETE');assert.equal(r.code,'READBACK_CREDENTIALS_UNAVAILABLE');assert.equal(c.calls.length,0);assert.equal(r.reportSaved,true);safe(r);
});
for(const [name,change] of [
  ['main drift',(p,b)=>{if(p.endsWith('/branches/main'))b.commit.sha='f'.repeat(40);}],
  ['unprotected main',(p,b)=>{if(p.endsWith('/branches/main'))b.protected=false;}],
  ['wrong run',(p,b)=>{if(p.endsWith('/actions/runs/88'))b.event='push';}],
  ['completed run',(p,b)=>{if(p.endsWith('/actions/runs/88'))b.status='completed';}],
  ['foreign checks',(p,b)=>{if(p.endsWith('/check-runs'))b.check_runs[0].app.id=1;}],
  ['admin bypass',(p,b)=>{if(p.endsWith('/environments/site-production'))b.can_admins_bypass=true;}],
  ['broader branch',(p,b)=>{if(p.endsWith('/deployment-branch-policies'))b.branch_policies[0].name='*';}],
  ['missing approval',(p,b)=>{if(p.endsWith('/approvals'))b.length=0;}],
  ['different workflow source',(p,b)=>{if(p.includes('/contents/'))b.content=Buffer.from(sentinel).toString('base64');}],
  ['unrelated old source',(p,b)=>{if(p.includes('/compare/'))b.merge_base_commit.sha='f'.repeat(40);}]
])test('authenticated admission refuses '+name+' before preparation/provider access',async t=>{
  const c=await cliFixture(t,{github:({path,body})=>{change(path,body);}}),r=await c.run();assert.equal(r.status,'READBACK_ONLY_FAILED');assert.equal(r.stage,'github-admission');assert.equal(c.preparations(),0);assert.ok(c.calls.every(row=>row.origin==='https://api.github.com'));safe(r);
});
for(const [name,change] of [
  ['run source',(p,b)=>{if(p.endsWith('/attempts/1'))b.head_sha='f'.repeat(40);}],
  ['run event',(p,b)=>{if(p.endsWith('/attempts/1'))b.event='push';}],
  ['run attempt',(p,b)=>{if(p.endsWith('/attempts/1'))b.run_attempt=2;}],
  ['run owner',(p,b)=>{if(p.endsWith('/attempts/1'))b.actor.login='other';}],
  ['expired artifact',(p,b)=>{if(p.endsWith('/artifacts/14'))b.expired=true;}],
  ['artifact digest',(p,b)=>{if(p.endsWith('/artifacts/14'))b.digest='sha256:'+'f'.repeat(64);}],
  ['artifact size',(p,b)=>{if(p.endsWith('/artifacts/14'))b.size_in_bytes++;}],
  ['foreign evidence',(p,b)=>{if(p.endsWith('/artifacts/14'))b.workflow_run.id=999;}],
  ['artifact fork',(p,b)=>{if(p.endsWith('/artifacts/14'))b.workflow_run.head_repository_id=999;}]
])test('original evidence metadata rejects '+name+' before download/acquisition',async t=>{
  const c=await cliFixture(t,{github:({path,body})=>{change(path,body);}}),r=await c.run();assert.equal(r.status,'READBACK_ONLY_FAILED');assert.equal(r.stage,'original-metadata');assert.equal(c.preparations(),0);assert.ok(!c.calls.some(row=>row.path.endsWith('/zip')));safe(r);
});
for(const location of ['http://artifact-test.blob.core.windows.net/a?sig='+sentinel,'https://private.invalid/a?sig='+sentinel,'https://user:password@artifact-test.blob.core.windows.net/a','https://artifact-test.blob.core.windows.net:8443/a'])test('unsafe download redirect is rejected without exposing its URL',async t=>{
  const c=await cliFixture(t,{redirect:()=>new Response(null,{status:302,headers:{location}})}),r=await c.run();assert.equal(r.code,'EVIDENCE_DOWNLOAD_REDIRECT');assert.equal(c.preparations(),0);safe(r);
});
for(const [name,respond,code] of [
  ['redirect chain',()=>new Response(null,{status:302,headers:{Location:'https://private.invalid/?sig='+sentinel}}),'EVIDENCE_DOWNLOAD_STATUS'],
  ['corrupt bytes',()=>new Response(Buffer.alloc(1)),'EVIDENCE_DOWNLOAD_SIZE'],
  ['oversized bytes',()=>new Response(Buffer.alloc(1048577)),'EVIDENCE_DOWNLOAD_SIZE'],
  ['transport exception',()=>{throw Error(sentinel+' https://private.invalid/?sig='+sentinel);},'EVIDENCE_DOWNLOAD_FAILED']
])test('signed download '+name+' stops safely',async t=>{
  const c=await cliFixture(t,{signed:respond}),r=await c.run();assert.equal(r.code,code);assert.equal(c.preparations(),0);safe(r);
});
test('production acquisition failure stays incomplete, is sanitized and does not use Cloudflare credentials',async t=>{
  const c=await cliFixture(t,{prepare:()=>{throw Error(sentinel+' signed-url');}}),r=await c.run();assert.equal(r.status,'READBACK_ONLY_INCOMPLETE');assert.equal(r.stage,'production-acquisition');assert.equal(r.reportSaved,true);assert.ok(c.calls.every(row=>row.origin!=='https://api.cloudflare.com'));safe(r);
});
test('readmission after acquisition is mandatory; new drift cannot reach the provider',async t=>{
  let n=0;const c=await cliFixture(t,{github:({path,body})=>{if(path.endsWith('/branches/main')&&++n===2)body.protected=false;}}),r=await c.run();
  assert.equal(r.stage,'github-readmission');assert.equal(r.status,'READBACK_ONLY_FAILED');assert.equal(c.preparations(),1);assert.ok(!c.calls.some(row=>row.origin==='https://api.cloudflare.com'));safe(r);
});
test('mandatory top-level result cannot overwrite a prior result or report a saved success',async t=>{
  const c=await cliFixture(t);await writeFile(join(c.f.root,'site-readback-result.json'),sentinel);const r=await c.run();assert.equal(r.code,'READBACK_CLI_RESULT_NOT_SAVED');assert.equal(r.reportSaved,false);assert.equal(c.calls.length,0);assert.equal(await readFile(join(c.f.root,'site-readback-result.json'),'utf8'),sentinel);
});
test('CRC32 has an independent standard check value and ZIP parsing rejects unknown, duplicate or corrupted entries',async t=>{
  assert.equal(crc32(Buffer.from('123456789')),0xcbf43926);const c=await cliFixture(t);assert.deepEqual(readOriginalResult(c.zip,c.pin),c.f.originalBytes);
  for(const files of [
    [['../manual-result.json',c.f.originalBytes],...c.files.slice(0,2)],
    [['manual-result.json',c.f.originalBytes],['manual-result.json',c.f.originalBytes],['manual-progress.json','{}']],
    [['manual-result.json',c.f.originalBytes],['private.json','{}'],['manual-progress.json','{}']]
  ]){const zip=archive(files);assert.throws(()=>readOriginalResult(zip,pinFor(zip,c.f.originalBytes)),/EVIDENCE_ZIP_ENTRY/);}
  const changed=Buffer.from(c.zip);changed[0]^=1;assert.throws(()=>readOriginalResult(changed,pinFor(changed,c.f.originalBytes)),/EVIDENCE_ZIP_ENTRY/);
  const changedCrc=Buffer.from(c.zip),central=changedCrc.readUInt32LE(changedCrc.length-6);changedCrc[central+16]^=1;assert.throws(()=>readOriginalResult(changedCrc,pinFor(changedCrc,c.f.originalBytes)),/EVIDENCE_ZIP_CRC/);
});
test('actual CLI with a denied owner guard writes only a sanitized result and exits nonzero without consulting services',async t=>{
  const c=await cliFixture(t);c.env.GITHUB_ACTOR='other';
  const env={...c.env,SystemRoot:process.env.SystemRoot??'',PATH:process.env.PATH??''};let failed;
  try{await promisify(execFile)(process.execPath,[fileURLToPath(new URL('./readback-only-cli.mjs',import.meta.url))],{env,windowsHide:true});}catch(error){failed=error;}
  assert.ok(failed);assert.equal(failed.code,1);const stdout=JSON.parse(failed.stdout);assert.equal(stdout.code,'READBACK_OWNER_MAIN_APPROVAL_REQUIRED');assert.equal(stdout.reportSaved,true);assert.equal(failed.stderr,'');safe(stdout);assert.equal((await c.saved()).providerWrites,0);
});
