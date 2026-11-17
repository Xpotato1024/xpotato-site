import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {matchManagedRobots} from './managed-robots-policy.mjs';
import {createPublicReadback,publicReadbackReport} from './manual-deployment-public.mjs';
import {assertScriptSourceParity,currentManualControlPaths} from './manual-deployment-source-policy.mjs';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/managed-robots-20261104.json',import.meta.url),'utf8'));
const body=Buffer.from(fixture.body),prefix=body.subarray(0,2676),origin=body.subarray(2676);
const hash=b=>createHash('sha256').update(b).digest('hex');
const target={path:'/robots.txt',bytes:70,sha256:'cc7aa07ebda6b8ac79827a8b110a8941101ed035f58b2b26b677974683b7f9bb'};
const image={versionId:'11111111-1111-4111-8111-111111111111',accountSubdomain:'example'};
const headers={'content-security-policy':"default-src 'self'",'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
  'permissions-policy':'camera=()','cache-control':'public, max-age=0, must-revalidate'};
const headerRules='/*\n'+Object.entries(headers).map(([key,value])=>'  '+key+': '+value).join('\n')+'\n';
function reader(responseBody=body,{status=200,responseHeaders=headers,alternateStatus=404}={}) {
  const calls=[];let versionChecks=0;
  const publicReader=createPublicReadback({wait:async()=>{},fetchImpl:async(url,options)=>{
    calls.push({url,...options});
    return new Response(url.includes('.workers.dev/')?'missing':responseBody,
      {status:url.includes('.workers.dev/')?alternateStatus:status,headers:responseHeaders});
  }});
  return {calls,published:(targets=[target])=>publicReader.published({targets,headers:headerRules},image,async()=>{versionChecks++;}),
    versionChecks:()=>versionChecks};
}
async function mismatch(responseBody,options) {
  const r=reader(responseBody,options);let report;
  await assert.rejects(()=>r.published(),error=>{
    assert.equal(error.message,'PUBLIC_BYTES_MISMATCH');report=publicReadbackReport(error);return true;
  });
  assert.equal(report.status,'pending');assert.equal(report.attempts,3);assert.equal(report.requests,3);
  assert.ok(report.observations.every(row=>!row.matches));
  assert.ok(r.calls.every(call=>call.method==='GET'&&call.redirect==='manual'));
  assert.ok(!JSON.stringify(report).includes('User-agent:'));
  return report;
}

test('public capture preserves independently pinned raw, prefix and origin bytes',()=>{
  assert.equal(fixture.source,'https://xpotato.net/robots.txt');
  assert.equal(body.length,2746);assert.equal(fixture.bytes,2746);
  assert.equal(hash(body),'e07c5a6227eb2ffc1ab7eb292edb475334a70596a311302ab56406151b94a677');assert.equal(hash(body),fixture.sha256);
  assert.equal(prefix.length,fixture.prefixBytes);assert.equal(hash(prefix),fixture.prefixSha256);
  assert.equal(origin.length,fixture.originBytes);assert.equal(hash(origin),fixture.originSha256);
  assert.equal(origin.toString(),'User-agent: *\nAllow: /\nSitemap: https://xpotato.net/sitemap-index.xml\n');
  assert.ok(prefix.includes('Content-Signal: search=yes,ai-train=no,use=reference\n'));
  // These observed named groups include search crawlers: this is not a promise
  // that every search bot is allowed, or verification of edge enforcement.
  assert.ok(prefix.includes('User-agent: Baiduspider\nDisallow: /'));
  assert.ok(prefix.includes('User-agent: GPTBot\nDisallow: /'));
});
test('every one-byte change anywhere in the observed response fails managed admission',()=>{
  for(let i=0;i<body.length;i++){
    const changed=Buffer.from(body);changed[i]^=1;
    assert.equal(matchManagedRobots(target,changed),null,'byte '+i);
  }
});
test('known managed response verifies with separate raw and origin facts and real header hashes',async()=>{
  const r=reader(),report=await r.published(),row=report.observations[0];
  assert.equal(report.status,'verified');assert.equal(report.attempts,1);assert.equal(report.requests,3);
  assert.equal(report.observedBytes,body.length+14);assert.equal(r.versionChecks(),1);
  assert.equal(row.matches,true);assert.equal(row.bodyMatch,'cloudflare-managed-robots');
  assert.equal(row.expected.bytes,70);assert.equal(row.expected.sha256,target.sha256);
  assert.equal(row.actual.bytes,2746);assert.equal(row.actual.sha256,fixture.sha256);
  assert.deepEqual(row.managedRobots,{policy:'cloudflare-managed-robots-20261104',
    prefix:{bytes:2676,sha256:fixture.prefixSha256},origin:{bytes:70,sha256:target.sha256}});
  assert.equal(row.expected.headersSha256,row.actual.headersSha256);
  assert.ok(r.calls.every(call=>call.method==='GET'&&call.redirect==='manual'));
  assert.ok(!JSON.stringify(report).includes(fixture.body));
  assert.equal(r.calls[0].url,'https://xpotato.net/robots.txt');
  assert.ok(r.calls[2].url.includes('11111111-xpotato-site.example.workers.dev/'));
});
test('unchanged origin follows exact mode without claiming any managed policy setting',async()=>{
  const report=await reader(origin).published(),row=report.observations[0];
  assert.equal(row.bodyMatch,'exact');assert.equal(row.matches,true);assert.ok(!Object.hasOwn(row,'managedRobots'));
  assert.equal(row.actual.bytes,70);assert.equal(row.actual.sha256,target.sha256);
});
for(const [name,changed] of [
  ['arbitrary prefix',Buffer.concat([Buffer.from('# not Cloudflare\n'),origin])],
  ['marker-only prefix',Buffer.concat([Buffer.from('# BEGIN Cloudflare Managed content\n# END Cloudflare Managed Content\n'),origin])],
  ['new allow directive',Buffer.from(body.toString().replace('Allow: /','Disallow: /'))],
  ['new content signal',Buffer.from(body.toString().replace('ai-train=no','ai-train=yes'))],
  ['changed named crawler',Buffer.from(body.toString().replace('GPTBot','XPTBot'))],
  ['missing prefix byte',body.subarray(1)],
  ['CRLF normalization',Buffer.from(body.toString().replaceAll('\n','\r\n'))],
  ['suffix corruption',Buffer.from(body.toString().replace('sitemap-index.xml','sitemap-other.xml'))],
  ['missing final LF',body.subarray(0,-1)],
  ['inserted separator',Buffer.concat([prefix,Buffer.from('\n'),origin])],
  ['appended directive',Buffer.concat([body,Buffer.from('Disallow: /\n')])],
  ['doubled prefix',Buffer.concat([prefix,body])],
  ['reordered origin',Buffer.concat([origin,prefix])],
  ['UTF-8 BOM',Buffer.concat([Buffer.from([239,187,191]),body])]
])test('readback rejects '+name+' with bounded sanitized raw observations',async()=>{
  const report=await mismatch(changed),row=report.observations[0];
  assert.equal(row.bodyMatch,'mismatch');assert.ok(!Object.hasOwn(row,'managedRobots'));
  assert.equal(row.actual.bytes,changed.length);assert.equal(row.actual.sha256,hash(changed));
});
test('fixed prefix cannot override a changed artifact origin even when its exact suffix matches',async()=>{
  for(const text of ['User-agent: *\nDisallow: /\n','User-agent: *\nDisallow: /private/\nAllow: /\n',
    'User-agent: GPTBot\nDisallow: /private/\n','User-agent: *\nCrawl-delay: 10\n',
    origin.toString().replace('xpotato.net','example.net'),origin.toString().replaceAll('\n','\r\n')]){
    const next=Buffer.from(text),nextTarget={path:'/robots.txt',bytes:next.length,sha256:hash(next)};
    assert.equal(matchManagedRobots(nextTarget,Buffer.concat([prefix,next])),null);
    const r=reader(Buffer.concat([prefix,next]));
    await assert.rejects(()=>r.published([nextTarget]),/PUBLIC_BYTES_MISMATCH/);
    // A future origin may still be served byte-for-byte without a managed prefix.
    const exact=await reader(next).published([nextTarget]);assert.equal(exact.observations[0].bodyMatch,'exact');
  }
});
test('managed body must match the selected artifact size and digest as well as the known origin',()=>{
  for(const patch of [{bytes:69},{bytes:71},{sha256:'0'.repeat(64)}])assert.equal(matchManagedRobots({...target,...patch},body),null);
});
for(const name of Object.keys(headers))test('managed robots cannot bypass missing or changed '+name,async()=>{
  for(const value of [undefined,'wrong']){
    const responseHeaders={...headers};if(value===undefined)delete responseHeaders[name];else responseHeaders[name]=value;
    const report=await mismatch(body,{responseHeaders});
    assert.notEqual(report.observations[0].expected.headersSha256,report.observations[0].actual.headersSha256);
    assert.equal(report.observations[0].bodyMatch,'cloudflare-managed-robots');
  }
});
test('managed robots body served as 404 cannot verify',async()=>{await mismatch(body,{status:404});});
test('managed body with redirect or HTTP error stops immediately and never follows Location',async()=>{
  for(const status of [301,302,403,500]){
    const r=reader(body,{status});
    await assert.rejects(()=>r.published(),error=>{
      assert.equal(error.message,'PUBLIC_HTTP_OR_REDIRECT');assert.equal(publicReadbackReport(error).requests,1);return true;
    });
    assert.equal(r.calls.length,1);
  }
});
test('accepted managed robots still require disabled alternate endpoints and a stable version',async()=>{
  await assert.rejects(()=>reader(body,{alternateStatus:200}).published(),/ALTERNATE_ENDPOINT_LIVE/);
  const r=createPublicReadback({fetchImpl:async()=>new Response(body,{headers})});
  await assert.rejects(()=>r.published({targets:[target],headers:headerRules},image,async()=>{throw Error('POST_VERSION_CHANGED');}),/POST_VERSION_CHANGED/);
});
test('ordinary HTML, sitemap, JS and other robots paths retain exact byte matching',async()=>{
  for(const path of ['/','/sitemap-index.xml','/_astro/application.js','/folder/robots.txt','/Robots.txt','/robots.txt/']){
    const row={...target,path};assert.equal(matchManagedRobots(row,body),null);
    const r=reader();await assert.rejects(()=>r.published([row]),/PUBLIC_BYTES_MISMATCH/);
  }
});
test('only pending mismatches are retried while managed robots and ordinary exact files stay verified',async()=>{
  const calls=[];let sitemapReads=0,versionChecks=0;
  const ordinary=Buffer.from('<html>approved</html>'),sitemap=Buffer.from('<xml>approved</xml>');
  const targets=[target,{path:'/',bytes:ordinary.length,sha256:hash(ordinary)},
    {path:'/sitemap-index.xml',bytes:sitemap.length,sha256:hash(sitemap)}];
  const r=createPublicReadback({wait:async()=>{},fetchImpl:async url=>{
    calls.push(url);const path=new URL(url).pathname;
    return new Response(url.includes('.workers.dev/')?'missing':path==='/robots.txt'?body:path==='/'?ordinary:++sitemapReads===1?'old':sitemap,
      {status:url.includes('.workers.dev/')?404:200,headers});
  }});
  const report=await r.published({targets,headers:headerRules},image,async()=>{versionChecks++;});
  assert.equal(report.status,'verified');assert.equal(report.attempts,2);assert.equal(report.requests,6);assert.equal(versionChecks,2);
  assert.deepEqual(report.observations.map(row=>[row.path,row.matches]),[['/robots.txt',true],['/',true],['/sitemap-index.xml',false],['/sitemap-index.xml',true]]);
});
test('new module and fixture remain protected source inputs when reusing an older artifact',()=>{
  const row=path=>({path,mode:'100644',type:'blob',sha:'a'.repeat(40)});
  const tree=path=>({truncated:false,tree:[...currentManualControlPaths.map(row),...path?[row(path)]:[]]});
  for(const path of ['release/deployment/managed-robots-policy.mjs','release/deployment/fixtures/managed-robots-20261104.json']){
    assert.throws(()=>assertScriptSourceParity([tree(),tree(path)],'current'),/BUILD_OR_POLICY_SCRIPTS_CHANGED/);
    const changed=tree(path);changed.tree.at(-1).sha='b'.repeat(40);
    assert.throws(()=>assertScriptSourceParity([tree(path),changed],'current'),/BUILD_OR_POLICY_SCRIPTS_CHANGED/);
  }
});
