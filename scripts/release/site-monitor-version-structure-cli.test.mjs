import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const cli=fileURLToPath(new URL('./site-monitor-version-structure-cli.mjs',import.meta.url));
const account='a'.repeat(32),version='22222222-2222-2222-2222-222222222222',privateMarker='fixture-private-body-marker',token='fixture-only-token-marker';
const sourceSha='c'.repeat(40);
const context={SITE_VERSION_STRUCTURE_AUTHORIZATION:'owner-approved-version-only-structure',GITHUB_REPOSITORY:'Xpotato1024/xpotato-site',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_ACTOR:'Xpotato1024',GITHUB_TRIGGERING_ACTOR:'Xpotato1024',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:sourceSha,CLOUDFLARE_SITE_MONITOR_READ_TOKEN:token};
function run({env={},event={inputs:{mode:'readonly-version-structure',account_id:account,expected_version_id:version,expected_source_sha:sourceSha}},raw,args=[],scenario='valid'}={}){
 const dir=mkdtempSync(join(tmpdir(),'version-structure-offline-'));
 try{
  const eventPath=join(dir,'event.json'),callsPath=join(dir,'calls.txt'),hook=join(dir,'hook.mjs');
  writeFileSync(eventPath,raw===undefined?JSON.stringify(event):raw);
  writeFileSync(hook,`import {appendFileSync} from 'node:fs';
globalThis.fetch=async(url,options)=>{
 appendFileSync(process.env.FIXTURE_CALLS,'GET\\n');
 const expected='https://api.cloudflare.com/client/v4/accounts/'+'a'.repeat(32)+'/workers/scripts/xpotato-site/versions/${version}';
 if(url!==expected||options.method!=='GET'||options.redirect!=='manual'||options.body!==undefined||options.headers.Authorization!=='Bearer ${token}')throw Error('${privateMarker}');
 const scenario=process.env.FIXTURE_SCENARIO;
 if(scenario==='throw')throw Error('${privateMarker}');
 if(scenario==='403')return new Response('${privateMarker}',{status:403});
 if(scenario==='redirect')return new Response('${privateMarker}',{status:302});
 if(scenario==='invalid-json')return new Response('${privateMarker}',{headers:{'content-type':'application/json'}});
 const result={id:'${version}',resources:{bindings:[],script:{etag:'${privateMarker}',handlers:null,last_deployed_from:'${privateMarker}'},script_runtime:{}},metadata:{author_id:'${privateMarker}'}};
 if(scenario==='unknown')result['${privateMarker}']='${privateMarker}';
 if(scenario==='identity')result.id='${privateMarker}';
 return Response.json({success:true,errors:[],result});
};`);
  const childEnv={...process.env,...context,GITHUB_EVENT_PATH:eventPath,FIXTURE_CALLS:callsPath,FIXTURE_SCENARIO:scenario,...env};
  // Never inherit runner preload options or real provider authentication.
  delete childEnv.NODE_OPTIONS;for(const key of Object.keys(env))if(env[key]===undefined)delete childEnv[key];
  const child=spawnSync(process.execPath,['--import',hook,cli,...args],{env:childEnv,encoding:'utf8',timeout:15000});
  assert.ifError(child.error);const output=child.stdout+child.stderr;
  for(const value of [account,version,privateMarker,token])assert.ok(!output.includes(value));
  let calls=0;try{calls=readFileSync(callsPath,'utf8').trim().split('\n').filter(Boolean).length}catch(error){if(error.code!=='ENOENT')throw error}
  return {status:child.status,stdout:child.stdout,stderr:child.stderr,calls};
 }finally{rmSync(dir,{recursive:true,force:true})}
}
test('CLI performs exactly one synthetic version GET with fixed safe receipt',()=>{
 const r=run();assert.equal(r.status,0);assert.equal(r.calls,1);assert.equal(r.stderr,'');
 const receipt=JSON.parse(r.stdout);assert.equal(receipt.status,'STRUCTURE_OBSERVED_NO_ACCEPTANCE');
 for(const key of ['acceptance','adopted','baselineUpdated','monitorActivated','deployAllowed'])assert.equal(receipt[key],false);
 assert.equal(receipt.providerMutations,0);assert.equal(receipt.scopes.script.fields.handlers,'NULL');
});
for(const scenario of ['403','redirect','invalid-json','throw','unknown','identity'])test('CLI stops after one GET on '+scenario,()=>{
 const r=run({scenario});assert.equal(r.status,1);assert.equal(r.calls,1);assert.equal(r.stderr,'');assert.ok(JSON.parse(r.stdout).status!=='STRUCTURE_OBSERVED_NO_ACCEPTANCE');
});
for(const [key,value] of [['SITE_VERSION_STRUCTURE_AUTHORIZATION',''],['GITHUB_REPOSITORY','other/repo'],['GITHUB_REF','refs/heads/other'],['GITHUB_EVENT_NAME','push'],['GITHUB_ACTOR','other'],['GITHUB_TRIGGERING_ACTOR','other'],['GITHUB_RUN_ATTEMPT','2'],['GITHUB_RUN_ATTEMPT','01'],['GITHUB_RUN_ATTEMPT',undefined],['GITHUB_EVENT_PATH',undefined]])test('CLI context guard blocks before event/auth/fetch: '+key+'='+String(value),()=>{
 const r=run({env:{[key]:value},raw:privateMarker});assert.equal(r.status,1);assert.equal(r.calls,0);assert.equal(r.stdout,'');assert.equal(r.stderr,'Version structure diagnostic blocked; no provider changes or acceptance.\n');
});
for(const options of [{raw:privateMarker},{raw:' '.repeat(1048577)},{event:null},{event:{inputs:[]}},{event:{inputs:{mode:'readonly-get'}}},{args:['unexpected']}])test('CLI rejects malformed event/mode/budget/arguments without GET '+JSON.stringify(Object.keys(options)),()=>{
 const r=run(options);assert.equal(r.status,1);assert.equal(r.calls,0);assert.equal(r.stdout,'');
});
for(const inputs of [{account_id:privateMarker,expected_version_id:version},{account_id:account,expected_version_id:privateMarker},{}])test('invalid IDs do not perform GET '+JSON.stringify(Object.keys(inputs)),()=>{
 const r=run({event:{inputs:{mode:'readonly-version-structure',expected_source_sha:sourceSha,...inputs}}});assert.equal(r.status,1);assert.equal(r.calls,0);assert.equal(JSON.parse(r.stdout).status,'CONFIGURATION_BLOCKED');
});
for(const expected of [undefined,null,{},'C'.repeat(40),'c'.repeat(39),'d'.repeat(40)])test('source SHA mismatch or malformed input blocks before credential and GET: '+typeof expected,()=>{
 const r=run({event:{inputs:{mode:'readonly-version-structure',account_id:account,expected_version_id:version,expected_source_sha:expected}},env:{CLOUDFLARE_SITE_MONITOR_READ_TOKEN:undefined}});
 assert.equal(r.status,1);assert.equal(r.calls,0);assert.equal(r.stdout,'');assert.equal(r.stderr,'Version structure diagnostic blocked; no provider changes or acceptance.\n');
});
test('main advancing between preflight and dispatch cannot GET the changed source',()=>{
 const r=run({env:{GITHUB_SHA:'d'.repeat(40)}});assert.equal(r.status,1);assert.equal(r.calls,0);assert.equal(r.stdout,'');
});
test('missing or malformed synthetic credential never performs GET',()=>{
 for(const value of [undefined,'bad']){const r=run({env:{CLOUDFLARE_SITE_MONITOR_READ_TOKEN:value}});assert.equal(r.status,1);assert.equal(r.calls,0);assert.equal(JSON.parse(r.stdout).status,'TRANSPORT_BLOCKED')}
});
test('whole workflow isolates version mode and keeps existing auth and manual owner/main guards',()=>{
 const workflow=readFileSync(new URL('../../.github/workflows/site-monitor-readiness.yml',import.meta.url),'utf8');
 assert.deepEqual([...workflow.matchAll(/^  ([a-z-]+):\n    (?:#[^\n]*\n    )*if:/gm)].map(m=>m[1]),['version-structure','fixed-get','domain-evidence','monitor-conditions','synthetic-notification']);
 const blocks=Object.fromEntries(workflow.split(/^  (?=[a-z-]+:\n)/m).slice(1).map(b=>[b.slice(0,b.indexOf(':')),b]));
 const guards=Object.fromEntries(Object.entries(blocks).map(([name,b])=>[name,b.match(/^    if: (.+)$/m)?.[1]]));
 const base="github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && github.actor == 'Xpotato1024' && github.triggering_actor == 'Xpotato1024'";
 assert.equal(guards['version-structure'],"${{ github.repository == 'Xpotato1024/xpotato-site' && "+base+" && github.run_attempt == 1 && inputs.mode == 'readonly-version-structure' && github.sha == inputs.expected_source_sha }}");
 assert.equal(guards['fixed-get'],base+" && inputs.mode == 'readonly-get'");
 assert.equal(guards['domain-evidence'],"${{ github.repository == 'Xpotato1024/xpotato-site' && "+base+" && inputs.mode == 'readonly-domain-evidence' }}");
 assert.equal(guards['monitor-conditions'],"${{ github.repository == 'Xpotato1024/xpotato-site' && "+base+" && (inputs.mode == 'readonly-monitor-conditions' || inputs.mode == 'readonly-monitor-candidate') && github.sha == inputs.expected_source_sha }}");
 assert.equal(guards['synthetic-notification'],base+" && inputs.mode == 'synthetic-failure'");
 assert.match(workflow,/^on:\n  workflow_dispatch:/m);assert.match(workflow,/^permissions:\n  contents: read\nconcurrency:/m);assert.doesNotMatch(workflow,/schedule:|pull_request:|push:|write-all|id-token:/);
 const block=blocks['version-structure'];assert.match(block,/timeout-minutes: 1/);assert.match(block,/persist-credentials: false/);
 assert.equal([...block.matchAll(/secrets\./g)].length,1);assert.match(block,/CLOUDFLARE_SITE_MONITOR_READ_TOKEN: \$\{\{ secrets\.CLOUDFLARE_SITE_MONITOR_READ_TOKEN \}\}/);
 assert.doesNotMatch(block,/inputs\.(account_id|expected_version_id)|upload-artifact|gh |curl|deploy|retry/);
 assert.deepEqual([...block.matchAll(/uses: ([^\n]+)/g)].map(m=>m[1]),['actions/checkout@11d5960a326750d5838078e36cf38b85af677262','actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020']);
 assert.equal([...block.matchAll(/run: /g)].length,1);assert.match(block,/run: node scripts\/release\/site-monitor-version-structure-cli\.mjs/);
 const ci=readFileSync(new URL('../../.github/workflows/production-path-review.yml',import.meta.url),'utf8');
 assert.match(ci,/node --test [^\n]*site-monitor-version-structure\.test\.mjs [^\n]*site-monitor-version-structure-cli\.test\.mjs/);
});
