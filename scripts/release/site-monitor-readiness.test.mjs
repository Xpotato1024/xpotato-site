import test from 'node:test';
import assert from 'node:assert/strict';
import {probeWorkerMetadata} from './site-monitor-readiness.mjs';
const accountId='a'.repeat(32),version='11111111-2222-3333-4444-555555555555';
const fixture=path=>path.endsWith('/deployments')?{deployments:[{id:version,strategy:'percentage',versions:[{version_id:version,percentage:100}]}]}:path.includes('/versions/')?{id:version,resources:{bindings:{}}}:path.endsWith('/script-settings')?{}:path.endsWith('/settings')?{bindings:[]}:path.endsWith('/scripts')?[{id:'xpotato-site',tag:'b'.repeat(32)}]:path.endsWith('/domains')?[]:path.endsWith('/tokens/verify')?{id:'c'.repeat(32),status:'active'}:path.includes('/scripts/')?{enabled:false,previews_enabled:false}:{subdomain:'existing-account'};
const credentialProvider=async()=>'fixture-token-not-a-secret';
test('scope probe only sends fixed GETs, emits no raw values and never grants authority',async()=>{
 const calls=[];const receipt=await probeWorkerMetadata({accountId,credentialProvider,fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json({success:true,errors:[],result:fixture(new URL(url).pathname)})}});
 assert.equal(receipt.status,'REQUIRED_GET_ACCESSIBLE_NO_LIVE_ACCEPTANCE');assert.equal(calls.length,9);
 assert.ok(calls.every(c=>new URL(c.url).origin==='https://api.cloudflare.com'&&c.options.method==='GET'&&c.options.redirect==='manual'&&!c.options.body));
 assert.equal(receipt.deployAllowed,false);assert.equal(receipt.providerMutations,0);assert.equal(receipt.acceptance,false);assert.equal(receipt.baselineUpdated,false);assert.equal(receipt.completePaginationVerified,false);
 assert.ok(!JSON.stringify(receipt).includes(accountId));assert.ok(!JSON.stringify(receipt).includes(version));
});
test('403 stops without broadening permissions or printing the error body',async()=>{
 let calls=0;const receipt=await probeWorkerMetadata({accountId,credentialProvider,fetchImpl:async()=>{calls++;return Response.json({secret:'do-not-print'},{status:403})}});
 assert.equal(receipt.status,'SCOPE_OR_RESPONSE_BLOCKED');assert.equal(calls,1);assert.equal(receipt.receipts[0].status,'REMOTE_HTTP_403');assert.ok(!JSON.stringify(receipt).includes('do-not-print'));
});
test('unknown deployment identity stops before using provider-controlled URL fields',async()=>{
 let calls=0;const receipt=await probeWorkerMetadata({accountId,credentialProvider,fetchImpl:async()=>{calls++;return Response.json({success:true,errors:[],result:{deployments:[{versions:[{version_id:'../../other'}]}]}})}});
 assert.equal(calls,1);assert.equal(receipt.status,'SCOPE_OR_RESPONSE_BLOCKED');
});
test('invalid account input performs no credential lookup or network',async()=>{
 const forbidden=()=>{throw Error('must not run')};const receipt=await probeWorkerMetadata({accountId:'https://other',credentialProvider:forbidden,fetchImpl:forbidden});assert.equal(receipt.status,'INVALID_ACCOUNT');assert.deepEqual(receipt.receipts,[]);
});

test('a rerun by another triggering actor is rejected before Secret/provider access',async()=>{
 const {spawnSync}=await import('node:child_process');
 const response=spawnSync(process.execPath,[new URL('./site-monitor-readiness-cli.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')],{encoding:'utf8',env:{SITE_MONITOR_AUTHORIZATION:'owner-approved-fixed-get-probe',GITHUB_REPOSITORY:'Xpotato1024/xpotato-site',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_ACTOR:'Xpotato1024',GITHUB_TRIGGERING_ACTOR:'other-user',PROBE_ACCOUNT_ID:accountId,CLOUDFLARE_SITE_MONITOR_READ_TOKEN:'fixture-only-token'}});
 assert.equal(response.status,1);assert.equal(response.stdout,'');assert.match(response.stderr,/Readiness probe blocked/);
});
