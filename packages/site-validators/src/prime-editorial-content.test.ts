import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {describe,it,expect} from 'vitest';
import {checkedPreservedPrimeDescription,preservedPrimeContentSha256,primeEditorialCandidates,reviewedPrimeTitle} from './prime-editorial-content.js';
import {checkBrowserToolInstallations} from './browser-tool-installation.js';
import {checkPhase5TaxonomyMaterialization} from './phase5-taxonomy-materialization.js';
import {validateManualEditorialRevisions} from './manual-editorial-revisions.js';
import {fingerprint,sha256} from '@xpotato/content-contracts/canonical';
import {parse} from 'yaml';
const path='apps/site/src/content/tools/prime-factorizer.mdx';
const baseline=execFileSync('git',['-c','core.fsmonitor=false','show','6bf8bae4ddabe23c2d20f52a83fa24e5e0628f65:'+path],{encoding:'utf8',env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1'}});
const oldDescription=JSON.parse(baseline.match(/^"description": (.+)$/mu)![1]!);
const candidate=await readFile(resolve(path),'utf8');
const previous=execFileSync('git',['-c','core.fsmonitor=false','show','f46580665c0cf6fab8a68f83ba54b6b896979dd4:'+path],{encoding:'utf8',env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1'}});
describe('closed preserved Prime editorial source candidates',()=>{
 it('retains the original migration content and description',()=>{
  expect(checkedPreservedPrimeDescription(baseline,preservedPrimeContentSha256,oldDescription)).toBe(oldDescription);
 });
 it('admits only the exact reviewed source candidate and its metadata',()=>{
  expect(checkedPreservedPrimeDescription(candidate,preservedPrimeContentSha256,oldDescription)).toBe(primeEditorialCandidates[2]!.description);
  expect(primeEditorialCandidates[2]!.reviewDocument).toBe('docs/acceptance/prime-factorizer-seo-20261102.md');
  expect(reviewedPrimeTitle(candidate)).toBe('素因数分解計算機');
 });
 it('retains the preceding exact editorial candidate for verification and recovery',()=>{
  expect(checkedPreservedPrimeDescription(previous,preservedPrimeContentSha256,oldDescription)).toBe(primeEditorialCandidates[0]!.description);
  expect(primeEditorialCandidates[0]!.reviewDocument).toBe('docs/acceptance/ios-brave-copy-share-20261031.md');
 });
 it('retains the immediately preceding share-help removal candidate',()=>{
  const prior=execFileSync('git',['show','080e2de:'+path],{encoding:'utf8'});
  expect(checkedPreservedPrimeDescription(prior,preservedPrimeContentSha256,oldDescription)).toBe(primeEditorialCandidates[1]!.description);
  expect(reviewedPrimeTitle(prior)).toBeUndefined();
 });
 it('limits the title exception to the exact source, path and original title',()=>{
  const check=(targetPath=path,current=candidate,originalTitle='素因数分解機')=>{
   const before=candidate.replace('"title": "素因数分解計算機"',`"title": "${originalTitle}"`);
   const metadata=parse(current.split(/^---\s*$/mu)[1]!);
   const ledger={schemaVersion:1,baseline:'phase5-taxonomy-materialization-v1',createdPages:[],revisions:[{targetPath,beforeMdxSha256:sha256(before),summary:'Exact Prime title exception test',provenance:{schemaVersion:1,contentId:metadata.id,origin:'manual',content:{mdxSha256:sha256(current),frontmatterSha256:fingerprint(metadata),route:'/tools/prime-factorizer/'},sourceRefs:[],materialClaims:[],exportedAt:'2026-11-02T00:00:00Z'}}]};
   return validateManualEditorialRevisions(new Map([[targetPath,before]]),new Map([[targetPath,current]]),ledger);
  };
  expect(check().revisions).toHaveLength(1);
  expect(()=>check(path.replace('prime-factorizer.mdx','other.mdx'))).toThrow('protected metadata');
  expect(()=>check(path,candidate+'\n')).toThrow('protected metadata');
  expect(()=>check(path,candidate,'別の計算機')).toThrow('protected metadata');
 });
 it.each([
  (s:string)=>s+'\n',
  (s:string)=>s.replace('WebAssembly','Unreviewed fastest'),
  (s:string)=>s.replace('bca48f98-c89a-457f-84d8-168f941fe469','bca48f98-c89a-457f-84d8-168f941fe460'),
  (s:string)=>s.replace('"draft": false','"draft": true'),
  (s:string)=>s.replace('"pubDate": "2025-09-17"','"pubDate": "2026-10-31"'),
  (s:string)=>s.replace('"updatedDate": "2026-11-02"','"updatedDate": "2026-11-03"'),
  (s:string)=>s.replace('"title": "素因数分解計算機"','"title": "別の計算機"'),
  (s:string)=>s.replace('"category": "calculation"','"category": "other"'),
  (s:string)=>s.replace('  - "math"','  - "unreviewed"'),
  (s:string)=>s.replace('module="prime-factorizer"','module="other"')
 ])('rejects any unreviewed byte or identity/publication change',change=>{
  expect(()=>checkedPreservedPrimeDescription(change(candidate),preservedPrimeContentSha256,oldDescription)).toThrow('explicit editorial review');
  expect(reviewedPrimeTitle(change(candidate))).toBeUndefined();
 });
 it('does not replace the baseline hash or its placement description',()=>{
  expect(()=>checkedPreservedPrimeDescription(candidate,'0'.repeat(64),oldDescription)).toThrow();
  expect(()=>checkedPreservedPrimeDescription(candidate,preservedPrimeContentSha256,'Unreviewed baseline')).toThrow();
 });
 it('passes the real installation gate with immutable migration, pin and generated files',async()=>{
  await expect(checkBrowserToolInstallations(resolve('.'))).resolves.toBeUndefined();
 },30000);
 it('binds the current manual editorial ledger over all frozen migration content',async()=>{
  await expect(checkPhase5TaxonomyMaterialization()).resolves.toBeDefined();
 },30000);
});
