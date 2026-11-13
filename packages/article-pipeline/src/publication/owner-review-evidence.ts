import {z} from 'zod';
import {join} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {contentIdSchema,sha256Schema,stableIdSchema} from '@xpotato/content-contracts';
import {canonicalJson,fingerprint,sha256} from '../canonical.js';
import {containsHardDenyMaterial} from '../disclosure.js';
import {safeRead,immutable,atomic,noLinks,locked} from '../private-files.js';

export const ownerReviewDerivations=['metadata_stripping','lossless_canonical_normalization','bounded_delivery_resize','site_owned_social_card'] as const;
const identity=z.object({assetId:stableIdSchema,sha256:sha256Schema}).strict();
export const ownerReviewSubjectSchema=z.object({
 protocol:z.literal('xpotato-private-owner-review-subject-v1'),origin:z.literal('existing_ai'),
 jobId:stableIdSchema,jobFingerprint:sha256Schema,attemptId:stableIdSchema,contentId:contentIdSchema,
 intakeSha256:sha256Schema,manuscriptSha256:sha256Schema,inputSha256:sha256Schema,bodySha256:sha256Schema,
 compiledBodySha256:sha256Schema,frontmatterSha256:sha256Schema,figureOrder:z.array(stableIdSchema).max(100),
 sourceBundleSha256:sha256Schema,evidenceBundleSha256:sha256Schema,citationCompilationSha256:sha256Schema,
 technicalExampleVerificationSha256:sha256Schema,reviewHeadSha256:sha256Schema,
 priorReviewState:z.string().min(1).max(80),planSha256:sha256Schema,mastersSha256:sha256Schema,rightsSha256:sha256Schema,
 reviewedMedia:z.array(identity).min(1).max(26),canonicalMedia:z.array(identity).min(2).max(26),
 generatorBindingSha256:sha256Schema,derivations:z.tuple([z.literal(ownerReviewDerivations[0]),z.literal(ownerReviewDerivations[1]),z.literal(ownerReviewDerivations[2]),z.literal(ownerReviewDerivations[3])]),
 subjectSha256:sha256Schema,
}).strict();
export type OwnerReviewSubject=z.infer<typeof ownerReviewSubjectSchema>;
const sourceSchema=z.object({
 kind:z.literal('operator_attested_authenticated_owner_conversation'),channel:z.enum(['chatgpt','slack','phone_number','teams']),
 conversationRef:z.string().min(1).max(512),messageRefs:z.array(z.string().min(1).max(512)).min(1).max(12),
 acceptanceMessageRef:z.string().min(1).max(512),messageCreatedAt:z.iso.datetime(),
 verbatimStatement:z.string().min(1).max(16384),statementSha256:sha256Schema,
 ownerIdentityChecked:z.literal(true),operatorId:stableIdSchema,
}).strict();
export const ownerReviewOperatorEvidenceSchema=z.object({
 source:sourceSchema,decision:z.literal('accept_exact_previously_reviewed_content_and_figures'),
 selectedVersion:z.string().min(1).max(200),
 reviewedContentSha256:sha256Schema,reviewedMedia:z.array(identity).min(1).max(26),
 reviewedFigureOrder:z.array(stableIdSchema).max(100),permittedDerivations:ownerReviewSubjectSchema.shape.derivations,
}).strict();
const receiptSchema=z.object({protocol:z.literal('xpotato-private-owner-review-receipt-v1'),subject:ownerReviewSubjectSchema,
 evidence:ownerReviewOperatorEvidenceSchema,recordedAt:z.iso.datetime(),receiptSha256:sha256Schema}).strict();
const headSchema=z.object({protocol:z.literal('xpotato-private-owner-review-head-v1'),subjectSha256:sha256Schema,receiptSha256:sha256Schema}).strict();
export type OwnerReviewPreparation=Readonly<{protocol:'xpotato-owner-review-preparation-handle-v1'}>;
export type OwnerReviewProof=Readonly<{protocol:'xpotato-owner-review-proof-handle-v1'}>;
const preparations=new WeakMap<object,{directory:string;subject:OwnerReviewSubject}>();
const proofs=new WeakMap<object,{preparation:OwnerReviewPreparation;receiptSha256:string}>();
const folder=(directory:string)=>join(directory,'owner-review-evidence');
const sourceIdentity=(source:z.infer<typeof sourceSchema>)=>fingerprint({channel:source.channel,conversationRef:source.conversationRef,messageRef:source.acceptanceMessageRef});
async function latestWithdrawal(root:string){
 try{
  const record=z.object({protocol:z.literal('xpotato-private-owner-review-withdrawal-v1'),receiptSha256:sha256Schema,
   revokedSourceIdentities:z.array(sha256Schema).min(1).max(100),source:sourceSchema,recordedAt:z.iso.datetime(),withdrawalSha256:sha256Schema}).strict().parse(JSON.parse(await safeRead(join(root,'last-withdrawal.json'))));
  const {withdrawalSha256,...unsigned}=record;
  if(fingerprint(unsigned)!==withdrawalSha256||sha256(record.source.verbatimStatement)!==record.source.statementSha256)throw Error('OWNER_REVIEW_WITHDRAWAL_INVALID');
  return record;
 }catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;return null;}
}
function verifySubject(input:unknown){
 const subject=ownerReviewSubjectSchema.parse(input),{subjectSha256,...unsigned}=subject;
 if(fingerprint(unsigned)!==subjectSha256||new Set(subject.reviewedMedia.map(a=>a.assetId)).size!==subject.reviewedMedia.length
  ||new Set(subject.canonicalMedia.map(a=>a.assetId)).size!==subject.canonicalMedia.length)throw Error('OWNER_REVIEW_SUBJECT_INVALID');
 return subject;
}
/** Internal deterministic producer boundary. A deserialized subject is not a handle.
 * No owner authority is minted here. The producer revalidates physical bytes. */
export function registerOwnerReviewPreparation(directory:string,input:unknown):OwnerReviewPreparation{
 const subject=verifySubject(input),handle=Object.freeze({protocol:'xpotato-owner-review-preparation-handle-v1' as const});
 preparations.set(handle,{directory,subject});return handle;
}
export function ownerReviewPreparationDetails(handle:OwnerReviewPreparation){
 const stored=preparations.get(handle);if(!stored)throw Error('OWNER_REVIEW_PREPARATION_HANDLE_REQUIRED');
 return {directory:stored.directory,subject:structuredClone(stored.subject)};
}
function verifyEvidence(subject:OwnerReviewSubject,input:unknown){
 const e=ownerReviewOperatorEvidenceSchema.parse(input);
 if(sha256(e.source.verbatimStatement)!==e.source.statementSha256||new Set(e.source.messageRefs).size!==e.source.messageRefs.length
  ||!e.source.messageRefs.includes(e.source.acceptanceMessageRef)||Date.parse(e.source.messageCreatedAt)>Date.now()
  ||e.reviewedContentSha256!==subject.manuscriptSha256||fingerprint(e.reviewedMedia)!==fingerprint(subject.reviewedMedia)
  ||fingerprint(e.reviewedFigureOrder)!==fingerprint(subject.figureOrder)||fingerprint(e.permittedDerivations)!==fingerprint(subject.derivations))
  throw Error('OWNER_REVIEW_EXACT_MAPPING_REQUIRED');
 if(containsHardDenyMaterial(Buffer.from(canonicalJson(e))))throw Error('OWNER_REVIEW_PRIVATE_SECRET_DENIED');
 return e;
}
const makeProof=(preparation:OwnerReviewPreparation,receiptSha256:string):OwnerReviewProof=>{
 const proof=Object.freeze({protocol:'xpotato-owner-review-proof-handle-v1' as const});proofs.set(proof,{preparation,receiptSha256});return proof;
};
/** PRIVILEGED OPERATOR boundary, never exposed through a generic JSON/--from
 * importer. The operator must inspect the real authenticated owner conversation
 * and prove its selected version maps to these exact original bytes. This code
 * validates that mapping; it does NOT authenticate an external conversation.
 * The operator also checks the latest owner instructions across Jobs; this local
 * directory cannot discover a withdrawal in another Job or conversation.
 * An article/file label/quote alone is insufficient. No audit PASS is created. */
export async function attestOwnerReviewedConversation(preparation:OwnerReviewPreparation,input:unknown):Promise<OwnerReviewProof>{
 const {directory,subject}=ownerReviewPreparationDetails(preparation),evidence=verifyEvidence(subject,input),root=folder(directory);
 return locked(directory,async()=>{
  await noLinks(root);await mkdir(root,{recursive:true,mode:0o700});
  // Reusing the same source attestation after withdrawal is not a new grant.
  const sourceKey=sourceIdentity(evidence.source),withdrawal=await latestWithdrawal(root);
  if(withdrawal&&(withdrawal.revokedSourceIdentities.includes(sourceKey)||Date.parse(evidence.source.messageCreatedAt)<=Date.parse(withdrawal.source.messageCreatedAt)))throw Error('OWNER_REVIEW_NEW_OWNER_ACCEPTANCE_REQUIRED');
  try{await safeRead(join(root,sourceKey+'.withdrawn.json'));throw Error('OWNER_REVIEW_WITHDRAWN');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const unsigned={protocol:'xpotato-private-owner-review-receipt-v1' as const,subject,evidence,recordedAt:new Date().toISOString()};
  const receipt={...unsigned,receiptSha256:fingerprint(unsigned)};
  await immutable(join(root,receipt.receiptSha256+'.json'),canonicalJson(receipt)+'\n');
  await atomic(join(root,'head.json'),canonicalJson({protocol:'xpotato-private-owner-review-head-v1',subjectSha256:subject.subjectSha256,receiptSha256:receipt.receiptSha256})+'\n');
  return makeProof(preparation,receipt.receiptSha256);
 });
}
async function readCurrent(preparation:OwnerReviewPreparation,expectedReceipt?:string){
 const {directory,subject}=ownerReviewPreparationDetails(preparation),root=folder(directory);
 const head=headSchema.parse(JSON.parse(await safeRead(join(root,'head.json'))));
 if(head.subjectSha256!==subject.subjectSha256||expectedReceipt&&head.receiptSha256!==expectedReceipt)throw Error('OWNER_REVIEW_STALE');
 const receipt=receiptSchema.parse(JSON.parse(await safeRead(join(root,head.receiptSha256+'.json')))),{receiptSha256,...unsigned}=receipt;
 if(fingerprint(unsigned)!==receiptSha256||receiptSha256!==head.receiptSha256||fingerprint(receipt.subject)!==fingerprint(subject)
  ||Date.parse(receipt.recordedAt)>Date.now())throw Error('OWNER_REVIEW_RECEIPT_INVALID');
 verifyEvidence(subject,receipt.evidence);
 const sourceKey=sourceIdentity(receipt.evidence.source),withdrawal=await latestWithdrawal(root);
 if(withdrawal&&(withdrawal.revokedSourceIdentities.includes(sourceKey)||Date.parse(receipt.evidence.source.messageCreatedAt)<=Date.parse(withdrawal.source.messageCreatedAt)))throw Error('OWNER_REVIEW_WITHDRAWN');
 try{await safeRead(join(root,sourceKey+'.withdrawn.json'));throw Error('OWNER_REVIEW_WITHDRAWN');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 return receipt;
}
export async function readOwnerReviewProof(preparation:OwnerReviewPreparation){
 return makeProof(preparation,(await readCurrent(preparation)).receiptSha256);
}
export async function assertOwnerReviewProof(proof:OwnerReviewProof,expected?:{planSha256:string;mastersSha256:string}){
 const stored=proofs.get(proof);if(!stored)throw Error('OWNER_REVIEW_OPERATOR_PROOF_REQUIRED');
 const receipt=await readCurrent(stored.preparation,stored.receiptSha256),s=receipt.subject;
 if(expected&&(s.planSha256!==expected.planSha256||s.mastersSha256!==expected.mastersSha256))throw Error('OWNER_REVIEW_MEDIA_CHANGED');
 return {subject:s,compact:{protocol:'owner-reviewed-existing-ai-v1' as const,origin:'existing_ai' as const,
  subjectSha256:s.subjectSha256,receiptSha256:receipt.receiptSha256,intakeSha256:s.intakeSha256,
  reviewedContentSha256:s.manuscriptSha256,reviewedMediaSetSha256:fingerprint(s.reviewedMedia)}};
}
/** Local withdrawal blocks future preparation within this Job directory only.
 * The operator must honor later withdrawals across other Jobs. Already exported/main
 * admissions need separate removal/replacement on main; no global revocation
 * is claimed. Historical receipts and audit results are never deleted. */
export async function withdrawOwnerReview(preparation:OwnerReviewPreparation,source:unknown){
 const {directory,subject}=ownerReviewPreparationDetails(preparation),evidence=sourceSchema.parse(source);
 if(sha256(evidence.verbatimStatement)!==evidence.statementSha256||!evidence.messageRefs.includes(evidence.acceptanceMessageRef)||Date.parse(evidence.messageCreatedAt)>Date.now()
  ||containsHardDenyMaterial(Buffer.from(canonicalJson(evidence))))throw Error('OWNER_REVIEW_SOURCE_INVALID');
 return locked(directory,async()=>{
  const receipt=await readCurrent(preparation),key=sourceIdentity(receipt.evidence.source);
  if(Date.parse(evidence.messageCreatedAt)<Date.parse(receipt.evidence.source.messageCreatedAt))throw Error('OWNER_REVIEW_WITHDRAWAL_ORDER_INVALID');
  const prior=await latestWithdrawal(folder(directory)),revokedSourceIdentities=[...new Set([...(prior?.revokedSourceIdentities??[]),key])];
  if(revokedSourceIdentities.length>100)throw Error('OWNER_REVIEW_WITHDRAWAL_HISTORY_LIMIT');
  const unsigned={protocol:'xpotato-private-owner-review-withdrawal-v1',receiptSha256:receipt.receiptSha256,revokedSourceIdentities,source:evidence,recordedAt:new Date().toISOString()};
  const record={...unsigned,withdrawalSha256:fingerprint(unsigned)};
  // Commit the complete revocation frontier atomically first. If the history
  // copy fails afterward, no old/renamed attestation can regain authority.
  await atomic(join(folder(directory),'last-withdrawal.json'),canonicalJson(record)+'\n');
  await immutable(join(folder(directory),key+'.withdrawn.json'),canonicalJson(record)+'\n');
  return {withdrawn:true,receiptSha256:receipt.receiptSha256};
 });
}
