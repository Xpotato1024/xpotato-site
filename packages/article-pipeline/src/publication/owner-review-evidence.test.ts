import {afterEach,describe,it,expect} from 'vitest';
import {mkdtemp,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {fingerprint,sha256} from '../canonical.js';
import {ownerReviewDerivations,registerOwnerReviewPreparation,attestOwnerReviewedConversation,assertOwnerReviewProof,
 readOwnerReviewProof,withdrawOwnerReview,type OwnerReviewSubject} from './owner-review-evidence.js';
const roots:string[]=[];afterEach(async()=>{for(const p of roots.splice(0))await rm(p,{recursive:true,force:true});});
const h='a'.repeat(64);
export function fixtureOwnerSubject(){
 const unsigned={protocol:'xpotato-private-owner-review-subject-v1' as const,origin:'existing_ai' as const,
  jobId:'job-fixture',jobFingerprint:h,attemptId:'attempt-fixture',contentId:'11111111-1111-4111-8111-111111111111',
  intakeSha256:h,manuscriptSha256:h,inputSha256:h,bodySha256:h,compiledBodySha256:h,frontmatterSha256:h,figureOrder:['figure-a','figure-b'],
  sourceBundleSha256:h,evidenceBundleSha256:h,citationCompilationSha256:h,technicalExampleVerificationSha256:h,reviewHeadSha256:h,
  priorReviewState:'preserved_not_used_as_owner_authority',planSha256:h,mastersSha256:h,rightsSha256:h,
  reviewedMedia:[{assetId:'hero',sha256:h},{assetId:'figure-a',sha256:h},{assetId:'figure-b',sha256:h}],
  canonicalMedia:[{assetId:'hero',sha256:h},{assetId:'social',sha256:h}],generatorBindingSha256:h,derivations:[...ownerReviewDerivations]};
 return {...unsigned,subjectSha256:fingerprint(unsigned)} as OwnerReviewSubject;
}
export function fixtureOwnerEvidence(s:OwnerReviewSubject){
 const text='Isolated synthetic test only: this exact original manuscript and figures were reviewed and are accepted unchanged.';
 return {source:{kind:'operator_attested_authenticated_owner_conversation' as const,channel:'chatgpt' as const,
  conversationRef:'fixture-conversation',messageRefs:['fixture-context','fixture-accept'],acceptanceMessageRef:'fixture-accept',
  messageCreatedAt:'2026-11-01T00:00:00Z',verbatimStatement:text,statementSha256:sha256(text),ownerIdentityChecked:true as const,operatorId:'fixture-operator'},
  decision:'accept_exact_previously_reviewed_content_and_figures' as const,selectedVersion:'fixture-version',
  reviewedContentSha256:s.manuscriptSha256,reviewedMedia:s.reviewedMedia,reviewedFigureOrder:s.figureOrder,permittedDerivations:[...ownerReviewDerivations]};
}
async function setup(){
 const directory=await mkdtemp(join(tmpdir(),'owner-evidence-'));roots.push(directory);const subject=fixtureOwnerSubject();
 return {directory,subject,handle:registerOwnerReviewPreparation(directory,subject),evidence:fixtureOwnerEvidence(subject)};
}
describe('operator-attested owner prior review',()=>{
 it('does not turn JSON, quote, filename or serialized proof into operator authority',async()=>{
  const x=await setup();
  await expect(assertOwnerReviewProof({protocol:'xpotato-owner-review-proof-handle-v1'})).rejects.toThrow('OPERATOR_PROOF_REQUIRED');
  await expect(attestOwnerReviewedConversation(JSON.parse(JSON.stringify(x.handle)),x.evidence)).rejects.toThrow('PREPARATION_HANDLE_REQUIRED');
  for(const value of [{approved:true,file:'approved-v11.mdx'},x.evidence.source,{...x.evidence,reviewedContentSha256:undefined}])
   await expect(attestOwnerReviewedConversation(x.handle,value)).rejects.toThrow();
  const proof=await attestOwnerReviewedConversation(x.handle,x.evidence);
  const result=await assertOwnerReviewProof(proof);expect(result.compact).toMatchObject({origin:'existing_ai',subjectSha256:x.subject.subjectSha256});
  expect(JSON.stringify(result.compact)).not.toMatch(/fixture-conversation|fixture-accept|verbatimStatement|reviewedAt|contentAudit|visualAudit/);
  await expect(assertOwnerReviewProof(JSON.parse(JSON.stringify(proof)))).rejects.toThrow('OPERATOR_PROOF_REQUIRED');
 });
 it.each(['manuscript','image','extra','missing','order','quote','identity','derivations'] as const)('rejects incomplete or changed %s mapping',async(kind)=>{
  const x=await setup(),e=structuredClone(x.evidence) as any;
  if(kind==='manuscript')e.reviewedContentSha256='b'.repeat(64);
  if(kind==='image')e.reviewedMedia[1].sha256='b'.repeat(64);
  if(kind==='extra')e.reviewedMedia.push({assetId:'extra',sha256:h});
  if(kind==='missing')e.reviewedMedia.pop();
  if(kind==='order')e.reviewedFigureOrder.reverse();
  if(kind==='quote')e.source.verbatimStatement+='changed';
  if(kind==='identity')e.source.ownerIdentityChecked=false;
  if(kind==='derivations')e.permittedDerivations.pop();
  await expect(attestOwnerReviewedConversation(x.handle,e)).rejects.toThrow();
 });
 it('invalidates old proof after replacement and binds plan/master hashes',async()=>{
  const x=await setup(),first=await attestOwnerReviewedConversation(x.handle,x.evidence);
  await expect(assertOwnerReviewProof(first,{planSha256:h,mastersSha256:'b'.repeat(64)})).rejects.toThrow('MEDIA_CHANGED');
  const secondEvidence={...x.evidence,source:{...x.evidence.source,acceptanceMessageRef:'fixture-new',messageRefs:['fixture-new'],messageCreatedAt:'2026-11-02T00:00:00Z'}};
  const second=await attestOwnerReviewedConversation(x.handle,secondEvidence);
  await expect(assertOwnerReviewProof(first)).rejects.toThrow('STALE');expect((await assertOwnerReviewProof(second)).compact.receiptSha256).not.toBe('');
  expect((await assertOwnerReviewProof(await readOwnerReviewProof(x.handle))).compact).toEqual((await assertOwnerReviewProof(second)).compact);
 });
 it('withdraws across label/operator/ref-order changes and requires a genuinely later owner acceptance',async()=>{
  const x=await setup(),proof=await attestOwnerReviewedConversation(x.handle,x.evidence);
  const source={...x.evidence.source,acceptanceMessageRef:'fixture-withdraw',messageRefs:['fixture-withdraw'],messageCreatedAt:'2026-11-02T00:00:00Z'};
  await withdrawOwnerReview(x.handle,source);await expect(assertOwnerReviewProof(proof)).rejects.toThrow('WITHDRAWN');
  for(const changed of [x.evidence,{...x.evidence,selectedVersion:'alias'},{...x.evidence,source:{...x.evidence.source,operatorId:'other'}},
   {...x.evidence,source:{...x.evidence.source,messageRefs:[...x.evidence.source.messageRefs].reverse()}},
   {...x.evidence,source:{...x.evidence.source,acceptanceMessageRef:'another-old',messageRefs:['another-old']}}])
   await expect(attestOwnerReviewedConversation(x.handle,changed)).rejects.toThrow();
  const newer={...x.evidence,source:{...x.evidence.source,acceptanceMessageRef:'fixture-new',messageRefs:['fixture-new'],messageCreatedAt:'2026-11-03T00:00:00Z'}};
  expect((await assertOwnerReviewProof(await attestOwnerReviewedConversation(x.handle,newer))).compact.origin).toBe('existing_ai');
 });
 it('keeps the atomic withdrawal frontier authoritative if history-copy writing is interrupted',async()=>{
  const x=await setup(),proof=await attestOwnerReviewedConversation(x.handle,x.evidence);
  const source={...x.evidence.source,acceptanceMessageRef:'fixture-withdraw',messageRefs:['fixture-withdraw'],messageCreatedAt:'2026-11-02T00:00:00Z'};
  await withdrawOwnerReview(x.handle,source);
  const folder=join(x.directory,'owner-review-evidence');
  // Durable state after frontier commit and before history-copy write.
  for(const file of await readdir(folder))if(file.endsWith('.withdrawn.json'))await rm(join(folder,file));
  await expect(assertOwnerReviewProof(proof)).rejects.toThrow('WITHDRAWN');
  await expect(attestOwnerReviewedConversation(x.handle,{...x.evidence,source:{...x.evidence.source,acceptanceMessageRef:'different-old',messageRefs:['different-old']}})).rejects.toThrow('NEW_OWNER_ACCEPTANCE_REQUIRED');
 });
 it('rejects secret-bearing withdrawal sources without replacing the active receipt',async()=>{
  const x=await setup(),proof=await attestOwnerReviewedConversation(x.handle,x.evidence),text='Authorization: Bearer '+('x'.repeat(80));
  await expect(withdrawOwnerReview(x.handle,{...x.evidence.source,verbatimStatement:text,statementSha256:sha256(text)})).rejects.toThrow('SOURCE_INVALID');
  expect((await assertOwnerReviewProof(proof)).compact.origin).toBe('existing_ai');
 });
 it('rejects tampered current receipts and stale subject pointers at every read',async()=>{
  const x=await setup(),proof=await attestOwnerReviewedConversation(x.handle,x.evidence),r=await assertOwnerReviewProof(proof);
  const path=join(x.directory,'owner-review-evidence',r.compact.receiptSha256+'.json'),raw=JSON.parse(await readFile(path,'utf8'));
  raw.evidence.reviewedMedia.reverse();await writeFile(path,JSON.stringify(raw));
  await expect(assertOwnerReviewProof(proof)).rejects.toThrow('RECEIPT_INVALID');
 });
});
