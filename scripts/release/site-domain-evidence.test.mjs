import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {probeDomainEvidence} from './site-domain-evidence.mjs';

const accountId='a'.repeat(32),expectedCredentialId='c'.repeat(32),expectedWorkerTag='b'.repeat(32);
const now=Date.parse('2026-10-08T00:00:00Z'),secret='fixture-private-secret-token';
const envelope=result=>({success:true,errors:[],result});
const domain={id:'fixture-domain',service:'xpotato-site',hostname:'xpotato.net',environment:'production'};
const inventory=(rows=[domain])=>({...envelope(structuredClone(rows)),result_info:{page:1,per_page:100,count:rows.length,total_count:rows.length}});
const bodies=()=>[envelope({id:expectedCredentialId,status:'active'}),envelope([{id:'xpotato-site',tag:expectedWorkerTag}]),inventory()];
const paths=['tokens/verify','workers/scripts','workers/domains'].map(p=>'/client/v4/accounts/'+accountId+'/'+p);
const checkKeys=['configuration','boundedOperation','transport','tokenEnvelope','tokenIdentity','tokenActive','tokenOptionalTimes','workerEnvelope','workerRows','workerIdentity','domainEnvelope','domainInventory','domainOwnership'];
const flags=['deployAllowed','acceptance','baselineUpdated','monitorActivated','routesTested','publicHttpTested','settingsTested'];
function safe(result){
 assert.deepEqual(Object.keys(result),['status','checks','deployAllowed','acceptance','providerMutations','baselineUpdated','monitorActivated','routesTested','publicHttpTested','settingsTested']);
 assert.ok(['DOMAIN_EVIDENCE_MATCH_NO_LIVE_ACCEPTANCE','DOMAIN_EVIDENCE_BLOCKED'].includes(result.status));
 assert.deepEqual(Object.keys(result.checks),checkKeys);
 assert.ok(Object.values(result.checks).every(v=>['PASS','FAIL'].includes(v)));
 flags.forEach(k=>assert.equal(result[k],false));assert.equal(result.providerMutations,0);
 const output=JSON.stringify(result);
 for(const value of [accountId,expectedCredentialId,expectedWorkerTag,secret,'fixture-private','fixture-domain','xpotato.net','evil.invalid'])assert.ok(!output.includes(value));
}
async function run({responses=bodies(),override={},respond}={}){
 const calls=[];let lookups=0;
 const options={accountId,expectedCredentialId,expectedWorkerTag,clock:()=>now,
  credentialProvider:async()=>{lookups++;return secret},
  fetchImpl:async(url,request)=>{const index=calls.length;calls.push({url,request});return respond?respond(index,url,request,responses):Response.json(responses[index])},...override};
 const result=await probeDomainEvidence(options);safe(result);
 return {result,calls,lookups};
}
async function blocked(responses,check,count){
 const r=await run({responses});assert.equal(r.result.status,'DOMAIN_EVIDENCE_BLOCKED');assert.equal(r.result.checks[check],'FAIL');assert.equal(r.calls.length,count);return r;
}
test('three exact ordered unfiltered GETs use one frozen credential and no authority',async()=>{
 const r=await run();assert.equal(r.result.status,'DOMAIN_EVIDENCE_MATCH_NO_LIVE_ACCEPTANCE');assert.equal(r.lookups,1);assert.equal(r.calls.length,3);
 assert.ok(Object.values(r.result.checks).every(v=>v==='PASS'));
 r.calls.forEach(({url,request},i)=>{assert.equal(url,'https://api.cloudflare.com'+paths[i]);assert.equal(new URL(url).search,'');assert.equal(request.method,'GET');assert.equal(request.redirect,'manual');assert.equal(request.body,undefined);assert.equal(request.headers.Authorization,'Bearer '+secret)});
});
for(const key of ['accountId','expectedCredentialId','expectedWorkerTag'])
 for(const value of [undefined,null,42,'', 'A'.repeat(32),'a'.repeat(31),'https://evil.invalid/'])
 test('invalid prior '+key+' blocks before credentials and IO: '+String(value),async()=>{
  const r=await run({override:{[key]:value}});assert.equal(r.calls.length,0);assert.equal(r.lookups,0);assert.equal(r.result.checks.configuration,'FAIL');
 });
for(const key of ['credentialProvider','fetchImpl','clock','signal'])test('invalid dependency '+key+' has fixed output',async()=>{
 const r=await run({override:{[key]:null}});assert.equal(r.calls.length,0);assert.equal(r.result.checks.configuration,'FAIL');
});
for(const [name,result,check] of [
 ['wrong ID',{id:'d'.repeat(32),status:'active'},'tokenIdentity'],
 ['missing ID',{status:'active'},'tokenIdentity'],['number ID',{id:42,status:'active'},'tokenIdentity'],
 ['null',null,'tokenIdentity'],['array',[],'tokenIdentity'],
 ['missing status',{id:expectedCredentialId},'tokenActive'],
 ['disabled',{id:expectedCredentialId,status:'disabled'},'tokenActive'],
 ['expired',{id:expectedCredentialId,status:'expired'},'tokenActive'],
 ['boolean status',{id:expectedCredentialId,status:true},'tokenActive']
])test('token '+name+' stops before scripts/domains',()=>{const r=bodies();r[0]=envelope(result);return blocked(r,check,1)});
for(const key of ['expires_on','not_before'])for(const value of [null,42,'bad-date',new Date(now+(key==='expires_on'?-1:1)).toISOString()])
 test('malformed or ineffective token time '+key+' '+String(value),()=>{const r=bodies();r[0].result[key]=value;return blocked(r,'tokenOptionalTimes',1)});
test('optional token dates accepted only if present and effective',async()=>{
 const r=bodies();r[0].result.expires_on=new Date(now+60000).toISOString();r[0].result.not_before=new Date(now-1).toISOString();
 assert.equal((await run({responses:r})).result.status,'DOMAIN_EVIDENCE_MATCH_NO_LIVE_ACCEPTANCE');
});
for(const [name,rows,check] of [
 ['wrong tag',[{id:'xpotato-site',tag:'d'.repeat(32)}],'workerIdentity'],
 ['wrong name',[{id:'other',tag:expectedWorkerTag}],'workerIdentity'],
 ['missing tag',[{id:'xpotato-site'}],'workerIdentity'],
 ['empty',[],'workerIdentity'],
 ['duplicate name',[{id:'xpotato-site',tag:expectedWorkerTag},{id:'xpotato-site',tag:'d'.repeat(32)}],'workerIdentity'],
 ['duplicate immutable tag',[{id:'xpotato-site',tag:expectedWorkerTag},{id:'other',tag:expectedWorkerTag}],'workerIdentity'],
 ['malformed row',[null],'workerRows'],['primitive row',[42],'workerRows'],['object',{},'workerRows']
])test('worker '+name+' stops before domains',()=>{const r=bodies();r[1]=envelope(rows);return blocked(r,check,2)});
for(const info of [null,{count:2},{page:2},{total_count:2},{total_pages:2},{per_page:0}])
 test('contradictory optional scripts pagination '+JSON.stringify(info),()=>{const r=bodies();r[1].result_info=info;return blocked(r,'workerRows',2)});
test('unrelated scripts do not change observed target identity',async()=>{
 const r=bodies();r[1].result.push({id:'other',tag:'d'.repeat(32)});assert.equal((await run({responses:r})).result.status,'DOMAIN_EVIDENCE_MATCH_NO_LIVE_ACCEPTANCE');
});
for(const [name,make] of [
 ['missing info',r=>delete r.result_info],['null info',r=>r.result_info=null],
 ...['page','per_page','count','total_count'].map(k=>['missing '+k,r=>delete r.result_info[k]]),
 ['page two',r=>r.result_info.page=2],['zero page size',r=>r.result_info.per_page=0],
 ['count mismatch',r=>r.result_info.count=0],['partial inventory',r=>r.result_info.total_count=2],
 ['small page',r=>r.result_info.per_page=0],['total pages null',r=>r.result_info.total_pages=null],
 ['total pages string',r=>r.result_info.total_pages='1'],['total pages zero',r=>r.result_info.total_pages=0],
 ['multiple pages',r=>r.result_info.total_pages=2],['unsafe count',r=>r.result_info.total_count=Number.MAX_SAFE_INTEGER+1],
 ['primitive row',r=>r.result=[42]],['malformed row',r=>delete r.result[0].environment],
 ['duplicate IDs',r=>Object.assign(r,inventory([domain,{...domain,hostname:'other.example'}]))],
 ['case duplicate host',r=>Object.assign(r,inventory([domain,{...domain,id:'other',service:'other',hostname:'XPOTATO.NET'}]))],
 ['dot duplicate host',r=>Object.assign(r,inventory([domain,{...domain,id:'other',service:'other',hostname:'xpotato.net.'}]))]
])test('domain incomplete/malformed inventory '+name,()=>{const r=bodies();make(r[2]);return blocked(r,'domainInventory',3)});
for(const [name,rows] of [
 ['reassigned',[{...domain,service:'other'}]],['extra site domain',[domain,{...domain,id:'other',hostname:'other.example'}]],
 ['wrong environment',[{...domain,environment:'staging'}]],['case changed',[{...domain,hostname:'XPOTATO.NET'}]],['empty',[]]
])test('domain ownership '+name+' is blocked',()=>{const r=bodies();r[2]=inventory(rows);return blocked(r,'domainOwnership',3)});
for(const errors of [[],null])for(const pages of [undefined,1])test('shared PR70/71 domains contract '+JSON.stringify({errors,pages}),async()=>{
 const r=bodies();r[2]=inventory([domain,{...domain,id:'other',service:'other',hostname:'other.example'}]);r[2].errors=errors;if(pages!==undefined)r[2].result_info.total_pages=pages;
 assert.equal((await run({responses:r})).result.status,'DOMAIN_EVIDENCE_MATCH_NO_LIVE_ACCEPTANCE');
});
for(let index=0;index<3;index++)for(const [name,make] of [
 ['null',()=>null],['array',()=>[]],['missing success',r=>({errors:[],result:r.result})],
 ['false success',r=>({...r,success:false})],['string success',r=>({...r,success:'true'})],
 ['missing errors',r=>{delete r.errors;return r}],['object errors',r=>({...r,errors:{}})],
 ['provider error',r=>({...r,errors:[{message:'fixture-private'}]})],
 ['missing result',r=>{delete r.result;return r}]
])test('envelope stage '+index+' '+name,()=>{const r=bodies();r[index]=make(r[index]);return blocked(r,['tokenEnvelope','workerEnvelope','domainEnvelope'][index],index+1)});
for(let index=0;index<2;index++)test('null errors allowed only for domains: '+index,()=>{const r=bodies();r[index].errors=null;return blocked(r,['tokenEnvelope','workerEnvelope'][index],index+1)});
test('provider secret markers, arbitrary keys and malicious URLs never leave fixed output or affect next requests',async()=>{
 const r=bodies();for(const b of r){b['fixture-private']=secret;b.messages=[{url:'https://evil.invalid/'+secret}]}
 r[0].result['fixture-private']=secret;r[1].result[0].url='https://evil.invalid/';r[2].result[0].token=secret;
 const outcome=await run({responses:r});assert.equal(outcome.result.status,'DOMAIN_EVIDENCE_MATCH_NO_LIVE_ACCEPTANCE');assert.equal(outcome.calls.length,3);
});
for(let index=0;index<3;index++)for(const [name,make] of [
 ['redirect',()=>new Response('',{status:302,headers:{Location:'https://evil.invalid/'}})],
 ['403',()=>Response.json({message:secret},{status:403})],['429',()=>Response.json({message:secret},{status:429})],
 ['500',()=>new Response(secret,{status:500})],['invalid JSON',()=>new Response(secret,{headers:{'Content-Type':'application/json'}})],
 ['wrong content type',()=>new Response(secret,{headers:{'Content-Type':'text/plain'}})],
 ['advertised size',()=>new Response('{}',{headers:{'Content-Type':'application/json','Content-Length':'1048577'}})],
 ['stream size',()=>new Response(' '.repeat(1048577),{headers:{'Content-Type':'application/json'}})]
])test('transport stage '+index+' '+name+' never retries',async()=>{
 const r=await run({respond:(i,u,o,bs)=>i===index?make():Response.json(bs[i])});
 assert.equal(r.result.status,'DOMAIN_EVIDENCE_BLOCKED');assert.equal(r.result.checks.transport,'FAIL');assert.equal(r.calls.length,index+1);
});
test('credential exception and fetch exception remain fixed',async()=>{
 const a=await run({override:{credentialProvider:async()=>{throw Error(secret)}}});assert.equal(a.calls.length,0);
 const b=await run({respond:()=>{throw Error('https://evil.invalid/'+secret)}});assert.equal(b.calls.length,1);assert.equal(b.result.status,'DOMAIN_EVIDENCE_BLOCKED');
});
test('cancellation before operation performs no IO',async()=>{
 const c=new AbortController();c.abort();const r=await run({override:{signal:c.signal}});assert.equal(r.calls.length,0);assert.equal(r.lookups,0);assert.equal(r.result.checks.boundedOperation,'FAIL');
});
test('cancellation during credential lookup prevents first fetch',async()=>{
 const c=new AbortController();const r=await run({override:{signal:c.signal,credentialProvider:async()=>{c.abort();return secret}}});assert.equal(r.calls.length,0);assert.equal(r.result.status,'DOMAIN_EVIDENCE_BLOCKED');
});
for(const index of [0,1,2])test('cancellation during response body stage '+index+' prevents later reads and success',async()=>{
 const c=new AbortController();
 const r=await run({override:{signal:c.signal},respond:(i,u,o,bs)=>{const response=Response.json(bs[i]);return {status:200,headers:response.headers,body:{getReader(){const reader=response.body.getReader();return {async read(){const chunk=await reader.read();if(!chunk.done&&i===index)c.abort();return chunk},cancel:()=>reader.cancel(),releaseLock:()=>reader.releaseLock()}}}}}});
 assert.equal(r.result.status,'DOMAIN_EVIDENCE_BLOCKED');assert.equal(r.calls.length,index+1);assert.equal(r.result.checks.boundedOperation,'FAIL');
});
for(const bad of [NaN,Infinity,now-1,now+30000])test('nonfinite/backwards/expired operation clock '+String(bad),async()=>{
 let reads=0;const r=await run({override:{clock:()=>++reads===1?now:bad}});assert.equal(r.calls.length,0);assert.equal(r.lookups,0);assert.equal(r.result.checks.boundedOperation,'FAIL');
});
test('30 second deadline checked again after final body',async()=>{
 let time=now;const r=await run({override:{clock:()=>time},respond:(i,u,o,bs)=>{if(i===2)time=now+30000;return Response.json(bs[i])}});
 assert.equal(r.calls.length,3);assert.equal(r.result.status,'DOMAIN_EVIDENCE_BLOCKED');
});
test('mutating caller inputs after await cannot retarget identities or credential',async()=>{
 let lookups=0;const options={accountId,expectedCredentialId,expectedWorkerTag,clock:()=>now,credentialProvider:async()=>{lookups++;options.accountId='d'.repeat(32);options.expectedWorkerTag='d'.repeat(32);options.expectedCredentialId='d'.repeat(32);return secret},fetchImpl:async()=>Response.json(bodies()[calls++])};let calls=0;
 const result=await probeDomainEvidence(options);safe(result);assert.equal(result.status,'DOMAIN_EVIDENCE_MATCH_NO_LIVE_ACCEPTANCE');assert.equal(calls,3);assert.equal(lookups,1);
});
test('hung body remains bounded by shared ten second transport timeout',async()=>{
 const r=await run({respond:()=>new Response(new ReadableStream({start(){}}),{headers:{'Content-Type':'application/json'}})});
 assert.equal(r.result.status,'DOMAIN_EVIDENCE_BLOCKED');assert.equal(r.result.checks.boundedOperation,'FAIL');assert.equal(r.calls.length,1);
});
const cliEnv={SITE_DOMAIN_EVIDENCE_AUTHORIZATION:'owner-approved-three-get-domain-evidence',PROBE_MODE:'readonly-domain-evidence',GITHUB_REPOSITORY:'Xpotato1024/xpotato-site',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_ACTOR:'Xpotato1024',GITHUB_TRIGGERING_ACTOR:'Xpotato1024',PROBE_ACCOUNT_ID:accountId,PROBE_EXPECTED_CREDENTIAL_ID:expectedCredentialId,PROBE_EXPECTED_WORKER_TAG:expectedWorkerTag,CLOUDFLARE_SITE_MONITOR_READ_TOKEN:secret};
function cli(overrides={},args=[],expectedCalls=0){
 const preload='let calls=0,lookups=0;const env={...process.env};process.env=new Proxy(env,{get(t,k){if(k==="CLOUDFLARE_SITE_MONITOR_READ_TOKEN")lookups++;return t[k]}});const rows='+JSON.stringify(bodies())+';globalThis.fetch=async(url,request)=>{if(url!=="https://api.cloudflare.com"+'+JSON.stringify(paths)+'[calls]||request.method!=="GET"||request.redirect!=="manual")throw Error("fixture-private");return Response.json(rows[calls++])};process.on("exit",()=>{if(calls!=='+expectedCalls+'||lookups!=='+(expectedCalls?1:0)+')process.exitCode=86})';
 return spawnSync(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(preload),fileURLToPath(new URL('./site-domain-evidence-cli.mjs',import.meta.url)),...args],{encoding:'utf8',env:{...cliEnv,...overrides},timeout:5000});
}
for(const key of ['SITE_DOMAIN_EVIDENCE_AUTHORIZATION','PROBE_MODE','GITHUB_REPOSITORY','GITHUB_REF','GITHUB_EVENT_NAME','GITHUB_ACTOR','GITHUB_TRIGGERING_ACTOR'])
 test('CLI guard '+key+' blocks credentials and IO',()=>{const r=cli({[key]:'wrong'});assert.equal(r.status,1);assert.equal(r.stdout,'');assert.equal(r.stderr,'Domain evidence blocked; no provider changes or baseline updates.\n')});
test('CLI extra argument blocks credentials and IO',()=>{const r=cli({},['extra']);assert.equal(r.status,1);assert.equal(r.stdout,'')});
test('CLI missing prior identity blocks credentials and IO',()=>{const r=cli({PROBE_EXPECTED_CREDENTIAL_ID:''});assert.equal(r.status,1);safe(JSON.parse(r.stdout))});
test('CLI synthetic happy path has fixed checks only',()=>{const r=cli({},[],3);assert.equal(r.status,0,r.stderr);safe(JSON.parse(r.stdout))});
test('manual workflow candidate stays hard blocked and existing owner job intact',()=>{
 const workflow=readFileSync(new URL('../../.github/workflows/site-monitor-readiness.yml',import.meta.url),'utf8');
 const candidate=workflow.split('  domain-evidence:\n')[1].split('  synthetic-notification:\n')[0];
 assert.ok(candidate.includes('if: ${{ false &&'));for(const guard of ["github.event_name == 'workflow_dispatch'","github.ref == 'refs/heads/main'","github.actor == 'Xpotato1024'","github.triggering_actor == 'Xpotato1024'","inputs.mode == 'readonly-domain-evidence'"])assert.ok(candidate.includes(guard));
 assert.ok(!workflow.includes('schedule:'));assert.ok(!workflow.includes('contents: write'));assert.ok(candidate.includes('persist-credentials: false'));
 assert.ok(workflow.includes("inputs.mode == 'readonly-get'"));assert.ok(workflow.includes('node scripts/release/site-monitor-readiness-cli.mjs'));
 assert.ok(readFileSync(new URL('../../.github/workflows/production-path-review.yml',import.meta.url),'utf8').includes('scripts/release/site-domain-evidence.test.mjs'));
});
