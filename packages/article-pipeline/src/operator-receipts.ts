import {join} from 'node:path';
import {z} from 'zod';
import {canonicalSourceStorageReceiptSchema,mediaPublicationManifestSchema,mediaProtectionReceiptSchema,sha256Schema,
 type CanonicalSourceStorageReceipt,type MediaPublicationManifest,type MediaProtectionReceipt} from '@xpotato/content-contracts';
import {fingerprint,sha256,canonicalJson} from './canonical.js';
import {safeRead} from './private-files.js';
import type {PublicationContext} from './publication-approval.js';
import type {PublicationHead,Plane} from './publication-contracts.js';
import {deriveCompactMediaRecoveryBinding} from './media-persistence.js';
import {operatorMediaRequest} from './publication-operator-plan.js';
import {mediaRuntimeLimits,type MediaWriteSessionDescriptor} from './media-write-runtime.js';
import {RuntimeOperationJournal} from './runtime-journal.js';
import {publicationProvenance} from './publication-provenance.js';

export const operatorReceiptSchema=z.object({protocol:z.literal('xpotato-operator-receipt-v1'),mode:z.literal('operator_runtime'),
 candidateSha256:sha256Schema,approvalSha256:sha256Schema,role:z.enum(['sources','publication','protection']),policySha256:sha256Schema,
 record:z.unknown(),operations:z.array(z.object({key:z.string(),outputSha256:sha256Schema,resultSha256:sha256Schema}).strict()).min(1).max(512)}).strict();
export type OperatorReceipt=z.infer<typeof operatorReceiptSchema>;
const exact=(a:unknown,b:unknown)=>{if(fingerprint(a)!==fingerprint(b))throw Error('OPERATOR_RECEIPT_BINDING_INVALID');};
const hash=(r:Record<string,unknown>,key:string)=>{const {[key]:h,...value}=r;exact(h,fingerprint(value));};
const sorted=<T extends {assetId:string}>(rows:T[])=>[...rows].sort((a,b)=>a.assetId<b.assetId?-1:a.assetId>b.assetId?1:0);
export function operatorBinding(c:PublicationContext,head:PublicationHead,policySha256:string):MediaWriteSessionDescriptor['binding']{
 return {jobId:c.v.c.store.jobId,jobFingerprint:c.v.c.store.jobFingerprint,candidateSha256:c.target,approvalSha256:head.approvalSha256,
  attemptId:c.v.c.binding.attemptId,inputSha256:c.v.c.binding.inputSha256,policySha256};
}
export function expectedReceiptObjects(c:PublicationContext,head:PublicationHead,plane:Plane,policySha256:string){
 return operatorMediaRequest({plan:c.materials.storagePlan,plane,binding:operatorBinding(c,head,policySha256),
  notAfter:new Date(Date.now()+60000).toISOString()}).objects.filter(o=>o.plane===plane);
}
export async function readOperatorReceipt(c:PublicationContext,head:PublicationHead,role:OperatorReceipt['role']){
 const pointer=head[role];if(!pointer)throw Error('OPERATOR_REQUIRED_RECEIPT_MISSING');
 const envelope=operatorReceiptSchema.parse(JSON.parse(await safeRead(join(c.folder,'artifacts',pointer+'.json'))));
 exact(fingerprint(envelope),pointer);exact([envelope.candidateSha256,envelope.approvalSha256,envelope.role],[c.target,head.approvalSha256,role]);
 const plane=role==='sources'?'source':role==='publication'?'public':'protected',objects=expectedReceiptObjects(c,head,plane,envelope.policySha256);
 exact(envelope.operations.map(o=>o.key).sort(),objects.map(o=>o.key).sort());
 const binding=operatorBinding(c,head,envelope.policySha256),journal=new RuntimeOperationJournal(join(c.folder,'runtime'),
  {jobId:binding.jobId,jobFingerprint:binding.jobFingerprint},mediaRuntimeLimits);
 const outcomes=new Map<string,{action:'uploaded'|'reused';verifiedAt:string}>();
 for(const object of objects){
  const op=envelope.operations.find(o=>o.key===object.key)!,contextSha256=fingerprint({binding,object}),operationId='media-'+plane+'-'+sha256(object.key);
  const result=await journal.inspect({operationId,kind:'media',stage:plane,attemptId:binding.attemptId,inputSha256:binding.inputSha256,contextSha256});
  if(result.state!=='verified'||result.outputSha256!==op.outputSha256||result.resultSha256!==op.resultSha256)throw Error('OPERATOR_JOURNAL_VERIFIED_RESULT_REQUIRED');
  const text=await safeRead(join(journal.directory,operationId,'output-'+op.outputSha256+'.json'));
  if(sha256(text)!==op.outputSha256)throw Error('OPERATOR_JOURNAL_OUTPUT_CHANGED');
  const output=z.object({protocol:z.literal('xpotato-media-transport-outcome-v1'),scope:z.literal('operator_runtime'),contextSha256:sha256Schema,
   stored:z.object({status:z.literal('verified'),action:z.enum(['uploaded','reused']),verifiedAt:z.iso.datetime({offset:true}),objectSha256:sha256Schema}).strict(),productionEligible:z.literal(false)}).strict().parse(JSON.parse(text));
  exact([output.contextSha256,output.stored.objectSha256],[contextSha256,object.sha256]);
  if(Date.parse(output.stored.verifiedAt)>Date.now())throw Error('OPERATOR_RECEIPT_TIME_INVALID');
  outcomes.set(object.key,{action:output.stored.action,verifiedAt:output.stored.verifiedAt});
 }
 return {envelope,outcomes};
}
export async function validateOperatorReceipts(c:PublicationContext,head:PublicationHead){
 if(c.mode!=='human'||!['human_local','existing_ai'].includes(c.artifact.scope)||c.artifact.reference)throw Error('OPERATOR_HUMAN_CANDIDATE_REQUIRED');
 const roles=['sources','publication','protection','export'] as const,count={HUMAN_APPROVED:0,MEDIA_SOURCE_STORED:1,MEDIA_PUBLISHED:2,MEDIA_PROTECTED:3,EXPORTED:4}[head.state];
 if(roles.some((r,i)=>Boolean(head[r])!==(i<count)))throw Error('OPERATOR_HEAD_STAGE_BINDING_INVALID');
 const assets=c.v.media!.registry.assets;
 let sources:CanonicalSourceStorageReceipt[]|null=null,publication:MediaPublicationManifest|null=null,protection:MediaProtectionReceipt|null=null;
 let policySha256:string|null=null;
 if(head.sources){
  const {envelope,outcomes}=await readOperatorReceipt(c,head,'sources');policySha256=envelope.policySha256;
  sources=z.array(canonicalSourceStorageReceiptSchema).parse(envelope.record);
  exact(sorted(sources),sorted(assets.map(a=>{
   const s=a.canonicalSource!,key='source/v1/objects/sha256/'+s.sha256.slice(0,2)+'/'+s.sha256+'.'+s.format,outcome=outcomes.get(key)!;
   const value={schemaVersion:1 as const,candidateSha256:c.target,contentId:c.materials.frontmatter.id,assetId:a.assetId,canonicalSha256:s.sha256,
    storageClass:s.storageClass,action:outcome.action,verifiedSizeBytes:s.sizeBytes,storedAt:outcome.verifiedAt};
   return {...value,receiptSha256:fingerprint(value)};
  })));
 }
 if(head.publication){
  if(!sources)throw Error('OPERATOR_SOURCE_PREREQUISITE_REQUIRED');
  const {envelope,outcomes}=await readOperatorReceipt(c,head,'publication');exact(envelope.policySha256,policySha256);
  publication=mediaPublicationManifestSchema.parse(envelope.record);hash(publication,'manifestSha256');
  exact(publication.authorization,{kind:'article_job',jobId:c.v.c.store.jobId,candidateSha256:c.target,humanApprovalRecordSha256:head.approvalSha256,
   canonicalSourceStorageReceiptSetSha256:fingerprint(sources),articleJobPublicMediaPermission:true});
  exact(sorted(publication.mediaSets),sorted(assets.map(a=>({assetId:a.assetId,rightsRef:a.rightsRef,
   variantManifestSha256:c.v.media!.variants.find(v=>v.assetId===a.assetId)!.manifestSha256,
   objects:[a.delivery.master,...a.delivery.variants].map((o,i)=>({purpose:i?'variant':'master',sha256:o.sha256,objectKey:o.objectKey,format:o.format,
    ...(i&&o.width?{width:o.width}:{}),contentType:o.format==='svg'?'image/svg+xml':'image/'+o.format,cacheControl:c.materials.storagePlan.profile.public.cacheControl,
    verifiedSizeBytes:o.sizeBytes,...outcomes.get(o.objectKey)}))}))));
 }
 if(head.protection){
  if(!publication)throw Error('OPERATOR_PUBLICATION_PREREQUISITE_REQUIRED');
  const {envelope,outcomes}=await readOperatorReceipt(c,head,'protection');exact(envelope.policySha256,policySha256);
  protection=mediaProtectionReceiptSchema.parse(envelope.record);hash(protection,'receiptSha256');
  const expected=expectedReceiptObjects(c,head,'protected',envelope.policySha256);
  exact({...protection,objects:[...protection.objects].sort((a,b)=>a.sourceObjectKey.localeCompare(b.sourceObjectKey))},
   {...protection,candidateSha256:c.target,approvalRecordSha256:head.approvalSha256,mediaPublicationManifestSha256:publication.manifestSha256,
    protectionClass:'cloudflare_protected_copy_v1',policyFingerprint:envelope.policySha256,objects:expected.map(o=>({sha256:o.sha256,sourceObjectKey:o.key,
     verifiedSizeBytes:o.sizeBytes,protectedObjectRef:'site-protected-v1:sha256:'+o.sha256+':'+o.key.split('.').at(-1),protectedAt:outcomes.get(o.key)!.verifiedAt})).sort((a,b)=>a.sourceObjectKey.localeCompare(b.sourceObjectKey))});
  deriveCompactMediaRecoveryBinding(publication,protection);
 }
 for(const date of [publication?.completedAt,protection?.completedAt])if(date&&Date.parse(date)>Date.now())throw Error('OPERATOR_RECEIPT_TIME_INVALID');
 if(publication&&sources&&Date.parse(publication.completedAt)<Math.max(...sources.map(s=>Date.parse(s.storedAt)),
  ...publication.mediaSets.flatMap(s=>s.objects.map(o=>Date.parse(o.verifiedAt)))))throw Error('OPERATOR_RECEIPT_TIME_INVALID');
 if(protection&&publication&&Date.parse(protection.completedAt)<Math.max(Date.parse(publication.completedAt),...protection.objects.map(o=>Date.parse(o.protectedAt))))throw Error('OPERATOR_RECEIPT_TIME_INVALID');
 if(head.export){
  if(!sources||!publication||!protection)throw Error('OPERATOR_EXPORT_CHAIN_REQUIRED');
  const manifest=await (await import('./publication-operator-export.js')).verifyOperatorExport(join(c.folder,'exports',head.export),head.export);
  exact([manifest.candidateSha256,manifest.approvalSha256,manifest.contentId,manifest.route],[c.target,head.approvalSha256,c.materials.frontmatter.id,c.materials.route]);
  const provenance=publicationProvenance(c,head,{sources,publication,protection});
  const expected={'/media/blog/':canonicalJsonFor(c.v.media!.registry),'/media-rights/blog/':canonicalJsonFor(c.v.plan!.rights),'/provenance/blog/':canonicalJsonFor(provenance)};
  for(const [fragment,text] of Object.entries(expected)){
   const files=manifest.changes.filter((v:{path:string})=>v.path.includes(fragment));if(files.length!==1||files[0].after!==text)throw Error('OPERATOR_EXPORT_RECORD_MISMATCH');
  }
  const content=manifest.changes.filter((v:{path:string;after:string|null})=>v.path.startsWith('apps/site/src/content/blog/')&&v.after!==null);
  if(content.length!==1||content[0].after!==c.materials.mdx)throw Error('OPERATOR_EXPORT_CONTENT_MISMATCH');
 }
 return {sources,publication,protection,policySha256};
}
const canonicalJsonFor=(value:unknown)=>canonicalJson(value)+'\n';
