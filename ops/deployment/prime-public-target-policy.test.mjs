import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {publicTargetBodyLimit} from './prime-public-target-policy.mjs';
import {createPublicReadback} from './manual-deployment-public.mjs';
test('only fingerprinted prime chunk admits a finite 6MB readback',()=>{
 assert.equal(publicTargetBodyLimit('/_astro/PrimeFactorizer.Abc_123-x.js',4668012),4668012);
 for(const path of ['/big.js','/_astro/other.Abc.js','/_astro/PrimeFactorizer.js','/_astro/PrimeFactorizer.Abc.js?x'])
  assert.throws(()=>publicTargetBodyLimit(path,2097153));
 assert.throws(()=>publicTargetBodyLimit('/_astro/PrimeFactorizer.Abc.js',6000001));
 for(const n of [-1,NaN,Infinity,1.5])assert.throws(()=>publicTargetBodyLimit('/',n));
 assert.equal(publicTargetBodyLimit('/',100),100);
});
test('large fixed prime bytes are verified, not truncated or accepted by prefix',async()=>{
 const body=Buffer.alloc(4668012,65),path='/_astro/PrimeFactorizer.Abc.js';
 const image={versionId:'20000000-0000-0000-0000-000000000000',accountSubdomain:'fixture-only'};
 const sha256=createHash('sha256').update(body).digest('hex');
 const make=extra=>createPublicReadback({fetchImpl:async url=>new Response(url.includes('workers.dev')?'missing':Buffer.concat([body,Buffer.alloc(extra)]),{status:url.includes('workers.dev')?404:200})});
 await make(0).published({targets:[{path,bytes:body.length,sha256}]},image);
 await assert.rejects(()=>make(1).published({targets:[{path,bytes:body.length,sha256}]},image));
});
