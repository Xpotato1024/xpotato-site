import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createSyntheticReadbackArtifact,openCanonicalReadbackArtifact,readbackArtifact} from './readback-only-artifact.mjs';
import {publicReadbackPolicy} from '../shared/public-readback-policy.mjs';
import {ManualDeployError} from './manual-deployment-provider.mjs';
import {authority} from './deployment-policy.mjs';
import {fixture,selection,expected,uuid,sentinel} from './readback-only.test-fixture.mjs';
function noSecrets(value){
  const s=JSON.stringify(value);for(const text of [sentinel,'synthetic-read-credential-000','synthetic-write-credential-000','Bearer ','Authorization','<html>','Content-Signal:'])assert.ok(!s.includes(text),text);
}
test('all 126 artifact targets, managed robots, headers, alternates and real provider adapters complete without a deployment port',async t=>{
  const f=await fixture(t),r=await f.run();assert.equal(r.status,'READBACK_ONLY_CHECKS_PASSED');
  assert.equal(r.evidenceMode,'synthetic');assert.equal(r.acceptance,false);assert.equal(r.verifierRevisionVerified,false);
  assert.equal(r.deployCount,0);assert.equal(r.providerWrites,0);assert.equal(r.network.providerWrites,0);assert.equal(r.evidenceSaved,true);
  assert.equal(r.network.publicRequests,131);assert.equal(r.readback.observations.length,126);assert.equal(f.loads(),2);
  assert.ok(r.readback.observations.every(row=>row.matches));assert.equal(r.readback.attempts,1);
  assert.deepEqual(r.readback.alternateEndpoints,{workersDevStatus:404,previewStatus:404});
  const robots=r.readback.observations.find(row=>row.path==='/robots.txt');assert.equal(robots.bodyMatch,'cloudflare-managed-robots');
  assert.equal(robots.expected.bytes,70);assert.equal(robots.actual.bytes,2746);assert.equal(robots.managedRobots.origin.sha256,robots.expected.sha256);
  assert.equal(r.artifactBefore.planSha256,r.artifactAfter.planSha256);assert.equal(r.artifactBefore.headersSha256,r.artifactAfter.headersSha256);
  assert.equal(r.tokenChecks.identityStable,true);assert.equal(r.tokenChecks.expiryEvidence,'LIVE_VERIFY');assert.equal(r.tokenChecks.scopeLiveReadback,false);
  assert.deepEqual(r.stages,['request','original-receipt','artifact-before','provider-setup','token-before','provider-before','public-before','public-readback','provider-after','artifact-after','token-final']);
  assert.ok(f.calls.filter(c=>c.writer).every(c=>c.path.endsWith('/tokens/verify')));
  assert.deepEqual((await f.saved()).status,r.status);assert.deepEqual(await readFile(f.originalEvidencePath),f.originalBytes);noSecrets(r);
});
test('synthetic handles cannot be forged or upgraded by setting a live kind or injecting success ports',async t=>{
  const f=await fixture(t);
  assert.ok(Object.isFrozen(readbackArtifact(f.artifact)));assert.throws(()=>{readbackArtifact(f.artifact).kind='canonical-consumer';});
  for(const artifact of [{kind:'canonical-consumer',load:async()=>({status:'verified'})},{}]){
    const g=await fixture(t);g.input.artifact=artifact;const r=await g.run();assert.equal(r.status,'READBACK_ONLY_FAILED');assert.equal(g.calls.length,0);
  }
  for(const key of ['provider','verifyPublished','deployOnce','createWranglerDeploy','persistProgress','evidenceMode','acceptance']){
    const g=await fixture(t);g.input[key]=()=>{throw Error(sentinel);};const r=await g.run();assert.equal(r.code,'READBACK_INPUT_CAPABILITY_INVALID');assert.equal(g.calls.length,0);noSecrets(r);
  }
});
test('canonical handle construction performs no credential access, process execution or network IO',()=>{
  let touched=0;const artifact=openCanonicalReadbackArtifact({operationRoot:process.cwd(),selection,githubCredential:async()=>{touched++;throw Error(sentinel);}});
  assert.equal(readbackArtifact(artifact).kind,'canonical-consumer');assert.equal(touched,0);
});
test('an upstream artifact success flag cannot replace the canonical handoff and target plan stages',async t=>{
  const f=await fixture(t);f.input.artifact=createSyntheticReadbackArtifact({selection,load:async()=>({status:'verified',success:true})});
  const r=await f.run();assert.equal(r.code,'READBACK_HANDOFF_INVALID');assert.equal(r.stage,'artifact-before');assert.equal(f.calls.length,0);assert.equal(r.acceptance,false);
});
test('request accessors are rejected without invoking their getter',async t=>{
  const f=await fixture(t);let touched=0;Object.defineProperty(f.input.request,'expected',{enumerable:true,get(){touched++;throw Error(sentinel);}});
  const r=await f.run();assert.equal(r.code,'READBACK_REQUEST_INVALID');assert.equal(touched,0);assert.equal(f.calls.length,0);noSecrets(r);
});
for(const [name,change] of [
  ['unacknowledged receipt',r=>{r.originalDeployment.deployment.status='attempted_unknown';}],
  ['receipt version',r=>{r.originalDeployment.deployment.receipt.versionId=uuid(90);}],
  ['different artifact selection',r=>{r.originalDeployment.selection.artifactId='99';}],
  ['missing original evidence ID',r=>{delete r.originalDeployment.evidenceArtifactId;}],
  ['untrusted extra source field',r=>{r.privateValue=sentinel;}],
])test('request rejects '+name+' before artifact or network stages',async t=>{
  const f=await fixture(t);change(f.input.request);const r=await f.run();assert.equal(r.status,'READBACK_ONLY_FAILED');assert.equal(f.calls.length,0);assert.equal(f.loads(),0);noSecrets(r);
});
test('original evidence bytes and receipt/expected binding are required, not an upstream success flag',async t=>{
  const changed=await fixture(t);await writeFile(changed.originalEvidencePath,sentinel);let r=await changed.run();assert.equal(r.code,'READBACK_ORIGINAL_EVIDENCE_DIGEST');assert.equal(changed.calls.length,0);noSecrets(r);
  const binding=await fixture(t);binding.input.request.expected.deploymentId=uuid(99);r=await binding.run();assert.equal(r.code,'READBACK_ORIGINAL_EVIDENCE_BINDING');assert.equal(binding.calls.length,0);
  const missing=await fixture(t);delete missing.input.originalEvidencePath;r=await missing.run();assert.equal(r.code,'READBACK_ORIGINAL_EVIDENCE_REQUIRED');assert.equal(missing.calls.length,0);
});
test('an unavailable original evidence file is incomplete, with no artifact or credential access',async t=>{
  const f=await fixture(t);f.input.originalEvidencePath=join(f.root,'unavailable.json');const r=await f.run();
  assert.equal(r.status,'READBACK_ONLY_INCOMPLETE');assert.equal(r.code,'READBACK_ORIGINAL_EVIDENCE_UNAVAILABLE');assert.equal(f.calls.length,0);assert.equal(f.loads(),0);
});
for(const [name,change,code] of [
  ['candidate handoff',v=>{v.handoff.mode='Candidate';},'READBACK_HANDOFF_INVALID'],
  ['handoff digest',v=>{v.handoff.digest='sha256:'+'f'.repeat(64);},'READBACK_HANDOFF_INVALID'],
  ['one target missing',v=>{v.plan.targets.pop();},'READBACK_PLAN_INCOMPLETE'],
  ['no robots',v=>{v.plan.targets.find(row=>row.path==='/robots.txt').path='/other.txt';},'READBACK_PLAN_INCOMPLETE'],
  ['missing headers',v=>{v.plan.headers='';},'READBACK_PLAN_INCOMPLETE'],
  ['security header omitted',v=>{v.plan.headers=v.plan.headers.replace('  referrer-policy: no-referrer\n','');},'READBACK_SECURITY_HEADERS_MISSING'],
])test('artifact stage rejects '+name+' without credential calls',async t=>{
  const f=await fixture(t,{artifact:change}),r=await f.run();assert.equal(r.code,code);assert.equal(r.status,'READBACK_ONLY_FAILED');assert.equal(f.calls.length,0);assert.equal(r.stage,'artifact-before');
});
test('artifact IO failure is incomplete and arbitrary upstream error text remains private',async t=>{
  const f=await fixture(t,{artifact:()=>{throw new ManualDeployError(sentinel);}}),r=await f.run();
  assert.equal(r.status,'READBACK_ONLY_INCOMPLETE');assert.equal(r.code,'READBACK_ARTIFACT_UNAVAILABLE');assert.equal(f.calls.length,0);noSecrets(r);
});
for(const [name,change] of [
  ['binding',(p,b)=>{if(p.endsWith('/settings'))b.result.bindings=[{type:'r2_bucket'}];}],
  ['endpoint flags',(p,b)=>{if(p.endsWith('/scripts/'+authority.worker+'/subdomain'))b.result.enabled=true;}],
  ['domain',(p,b)=>{if(p.endsWith('/domains'))b.result[0].hostname='other.example';}],
  ['worker identity',(p,b)=>{if(p.endsWith('/scripts'))b.result[0].tag='9'.repeat(32);}],
  ['deployment version',(p,b)=>{if(p.endsWith('/deployments'))b.result.deployments[0].versions[0].version_id=uuid(91);}]
])test('provider-before rejects '+name+' before public observations',async t=>{
  const f=await fixture(t,{provider:({path,body})=>{change(path,body);}}),r=await f.run();
  assert.equal(r.status,'READBACK_ONLY_FAILED');assert.equal(r.stage,'provider-before');assert.equal(f.calls.filter(c=>!c.provider).length,0);assert.ok(!r.stages.includes('public-readback'));noSecrets(r);
});
test('credential failure is incomplete, sanitized, and cannot skip a required token-before stage',async t=>{
  const f=await fixture(t);f.input.deployCredential=async()=>{throw Error(sentinel);};const r=await f.run();
  assert.equal(r.status,'READBACK_ONLY_INCOMPLETE');assert.equal(r.code,'REMOTE_REQUEST_FAILED');assert.equal(r.stage,'token-before');assert.equal(r.network.requests,0);noSecrets(r);
});
test('provider context account must match the independently pinned expected account before credentials are used',async t=>{
  const f=await fixture(t);f.input.context.accountId='9'.repeat(32);const r=await f.run();assert.equal(r.stage,'provider-setup');assert.equal(r.code,'READBACK_ACCOUNT_MISMATCH');assert.equal(f.calls.length,0);
});
for(const alternate of [false,true])test('public-before '+(alternate?'alternate':'home')+' mismatch cannot skip into the full readback',async t=>{
  const f=await fixture(t,{public:({path,alternate:isAlternate,count,response})=>{
    if(alternate?isAlternate&&count===1:path==='/'&&count===1){response.status=200;response.body=sentinel;}
  }}),r=await f.run();assert.equal(r.status,'READBACK_ONLY_FAILED');assert.equal(r.stage,'public-before');assert.ok(!r.stages.includes('public-readback'));noSecrets(r);
});
for(const [name,change] of [
  ['raw bytes',r=>{r.body=sentinel;}],['security headers',r=>{r.headers['x-content-type-options']='wrong';}],
  ['managed prefix',r=>{r.body=Buffer.from(r.body.toString().replace('ai-train=no','ai-train=yes'));}],
])test('public readback rejects '+name+' within the existing three attempts',async t=>{
  const path=name==='managed prefix'?'/robots.txt':'/fixture-0.xml';
  const f=await fixture(t,{public:({path:p,response})=>{if(p===path)change(response);}}),r=await f.run();
  assert.equal(r.status,'READBACK_ONLY_FAILED');assert.equal(r.stage,'public-readback');assert.equal(r.code,'PUBLIC_BYTES_MISMATCH');
  assert.equal(r.readback.attempts,3);assert.equal(f.calls.filter(c=>!c.provider&&c.path===path).length,3);assert.ok(!r.stages.includes('provider-after'));noSecrets(r);
});
test('a live alternate after all 126 targets match still fails and cannot reach final token check',async t=>{
  const f=await fixture(t,{public:({alternate,count,response})=>{if(alternate&&count===2)response.status=200;}}),r=await f.run();
  assert.equal(r.code,'ALTERNATE_ENDPOINT_LIVE');assert.equal(r.status,'READBACK_ONLY_FAILED');assert.equal(r.readback.observations.filter(row=>row.matches).length,126);assert.ok(!r.stages.includes('token-final'));
});
test('120-second phase timeout is incomplete; no later stage or automatic redeploy can run',async t=>{
  const f=await fixture(t,{public:({path,advance})=>{if(path==='/fixture-10.xml')advance(120000);}}),r=await f.run();
  assert.equal(r.status,'READBACK_ONLY_INCOMPLETE');assert.equal(r.code,'PUBLIC_READBACK_STALE');assert.equal(r.readback.attempts,1);assert.ok(!r.stages.includes('provider-after'));assert.equal(r.deployCount,0);
});
test('oversized response is incomplete and cancels the phase at the existing body limit',async t=>{
  const f=await fixture(t,{public:({path,response})=>{if(path==='/fixture-0.xml')response.body=Buffer.alloc(2097153,97);}}),r=await f.run();
  assert.equal(r.code,'PUBLIC_BODY_LIMIT');assert.equal(r.status,'READBACK_ONLY_INCOMPLETE');assert.equal(r.readback.attempts,1);
});
test('version drift during the final same-version GET rejects an otherwise matching public pass',async t=>{
  const f=await fixture(t,{provider:({path,count,body})=>{if(path.endsWith('/deployments')&&count===3)body.result.deployments[0].id=uuid(99);}}),r=await f.run();
  assert.equal(r.code,'POST_VERSION_CHANGED_DURING_READBACK');assert.equal(r.stage,'public-readback');assert.equal(r.status,'READBACK_ONLY_FAILED');
});
test('fresh provider-after snapshot must agree with the expected original deployment and bindings',async t=>{
  const f=await fixture(t,{provider:({path,count,body})=>{if(path.endsWith('/settings')&&count===3)body.result.bindings=[{type:'r2_bucket'}];}}),r=await f.run();
  assert.equal(r.stage,'provider-after');assert.equal(r.status,'READBACK_ONLY_FAILED');assert.equal(r.code,'BINDINGS_DRIFT');assert.ok(!r.stages.includes('token-final'));
});
test('readonly token identity drift during provider-after is a failure with no final writer-token claim',async t=>{
  const f=await fixture(t,{provider:({path,writer,count,body})=>{if(path.endsWith('/tokens/verify')&&!writer&&count===2)body.result.id='8'.repeat(32);}}),r=await f.run();
  assert.equal(r.stage,'provider-after');assert.equal(r.code,'READONLY_TOKEN_IDENTITY');assert.equal(r.status,'READBACK_ONLY_FAILED');assert.ok(!r.tokenChecks);
});
for(const [name,change] of [
  ['target bytes',v=>{v.plan.targets.find(row=>row.path==='/fixture-0.xml').sha256='f'.repeat(64);}],
  ['headers',v=>{v.plan.headers=v.plan.headers.replace('camera=()','camera=(self)');}],
  ['staging path',v=>{v.plan.dist='/changed-staging';}],
  ['missing stage',()=>{throw Error(sentinel);}]
])test('second artifact verification rejects '+name+' after public checks',async t=>{
  const f=await fixture(t,{artifact:(v,n)=>{if(n===2)change(v);}}),r=await f.run();
  assert.equal(r.stage,'artifact-after');assert.notEqual(r.status,'READBACK_ONLY_CHECKS_PASSED');assert.ok(!r.stages.includes('token-final'));noSecrets(r);
});
for(const [name,change] of [
  ['identity',b=>{b.result.id='9'.repeat(32);}],['expiry evidence',b=>{delete b.result.expires_on;}],['disabled status',b=>{b.result.status='disabled';}]
])test('final token '+name+' drift prevents a successful result',async t=>{
  const f=await fixture(t,{provider:({path,writer,count,body})=>{if(path.endsWith('/tokens/verify')&&writer&&count===2)change(body);}});
  f.input.context.tokenPolicy.acceptUnreportedExpiry=true;const r=await f.run();assert.equal(r.stage,'token-final');assert.equal(r.status,'READBACK_ONLY_FAILED');assert.ok(r.stages.includes('artifact-after'));noSecrets(r);
});
test('accepted unreported expiry is preserved as uncertainty even after every stage passes',async t=>{
  const f=await fixture(t,{provider:({path,writer,body})=>{if(path.endsWith('/tokens/verify')&&writer)delete body.result.expires_on;}});
  f.input.context.tokenPolicy.acceptUnreportedExpiry=true;const r=await f.run();assert.equal(r.status,'READBACK_ONLY_CHECKS_PASSED');
  assert.equal(r.tokenChecks.expiryEvidence,'UNREPORTED');assert.equal(r.tokenChecks.lifetimeVerified,false);assert.equal(r.tokenChecks.rotationEnforced,false);assert.equal(r.acceptance,false);
});
test('evidence filename is new and exclusive; an existing result is never overwritten or reported as saved success',async t=>{
  const f=await fixture(t),path=join(f.root,'readback-only-'+f.input.request.operationId+'.json');await writeFile(path,sentinel);
  const r=await f.run();assert.equal(r.status,'READBACK_ONLY_INCOMPLETE');assert.equal(r.code,'READBACK_EVIDENCE_NOT_SAVED');assert.equal(r.evidenceSaved,false);assert.equal(await readFile(path,'utf8'),sentinel);
});
test('budgets remain the existing shared policy; oversized plans stop before network IO',async t=>{
  assert.deepEqual(publicReadbackPolicy,{maxTargets:512,maxTargetBytes:67108864,maxReads:1029,maxObservedBytes:144703488,phaseMs:120000,requestMs:10000,maxAttempts:3,reobserveMs:1000});
  const f=await fixture(t,{artifact:v=>{for(const row of v.plan.targets)row.bytes=2097152;}}),r=await f.run();assert.equal(r.status,'READBACK_ONLY_FAILED');assert.equal(f.calls.length,0);
});
