import {mkdir} from "node:fs/promises";
import {join} from "node:path";
import {canonicalSourceStorageReceiptSchema,mediaPublicationManifestSchema,mediaProtectionReceiptSchema,
 type CanonicalSourceStorageReceipt,type MediaPublicationManifest,type MediaProtectionReceipt,type ContentMediaRegistry} from "@xpotato/content-contracts";
import type {DraftRepository} from "./draft-job.js";
import {publicationCandidate,readPublicationHead,type PublicationContext} from "./publication-approval.js";
import {publicationHeadSchema,type PublicationHead,type PublicationPort,type Plane} from "./publication-contracts.js";
import {mockObjectPlan} from "./publication-plan.js";
import {persistMockObject} from "./publication-operation.js";
import {mockPolicySha256,mockProtectedPrefix,storedIdentity} from "./publication-mock-port.js";
import {candidatePreviewSnapshot} from "./candidate-freshness.js";
import {candidateDirectory} from "./candidate-review.js";
import {deriveCompactMediaRecoveryBinding,assertPersistenceCapabilities} from "./media-persistence.js";
import {canonicalJson,fingerprint,sha256} from "./canonical.js";
import {safeRead,immutable,atomic,noLinks,locked,fail} from "./private-files.js";
type Role="sources"|"publication"|"protection";
export async function readMockReceipt(c:PublicationContext,head:PublicationHead,role:Role){
 const hash=head[role];if(!hash)fail("PUBLICATION_REQUIRED_RECEIPT_MISSING",3);
 const envelope=JSON.parse(await safeRead(join(c.folder,"artifacts",hash+".json")));
 if(envelope.protocol!=="xpotato-private-mock-receipt-v1"||envelope.mode!=="mock"||envelope.productionEligible!==false
  ||envelope.role!==role||envelope.candidateSha256!==c.target||envelope.approvalSha256!==head.approvalSha256
  ||fingerprint(envelope.record)!==hash)fail("PUBLICATION_RECEIPT_BINDING_INVALID",3);
 return envelope.record as unknown;
}
const checkHash=(value:Record<string,unknown>,key:string)=>{
 const {[key]:hash,...unsigned}=value;if(hash!==fingerprint(unsigned))fail("PUBLICATION_RECEIPT_HASH_MISMATCH",3);
};
const exact=(a:unknown,b:unknown)=>{if(fingerprint(a)!==fingerprint(b))fail("PUBLICATION_RECEIPT_EXACT_SET_MISMATCH",3);};
const ordered=<T extends {assetId:string}>(items:T[])=>[...items].sort((a,b)=>a.assetId<b.assetId?-1:a.assetId>b.assetId?1:0);
const objectExpected=(asset:ContentMediaRegistry["assets"][number])=>
 [asset.delivery.master,...asset.delivery.variants].map((object,index)=>({purpose:index===0?"master":"variant",sha256:object.sha256,
 objectKey:object.objectKey,format:object.format,...(index&&object.width?{width:object.width}:{}),
 contentType:"image/"+(object.format==="svg"?"svg+xml":object.format),cacheControl:"public, max-age=31536000, immutable",verifiedSizeBytes:object.sizeBytes}));
export async function validateMockReceipts(c:PublicationContext,head:PublicationHead){
 const assets=c.v.media!.registry.assets;
 const roles=["sources","publication","protection","export"] as const;
 const count={HUMAN_APPROVED:0,MEDIA_SOURCE_STORED:1,MEDIA_PUBLISHED:2,MEDIA_PROTECTED:3,EXPORTED:4}[head.state];
 if(roles.some((role,index)=>Boolean(head[role])!==(index<count)))fail("PUBLICATION_HEAD_STAGE_BINDING_INVALID",3);
 let sources:CanonicalSourceStorageReceipt[]|null=null,publication:MediaPublicationManifest|null=null,protection:MediaProtectionReceipt|null=null;
 if(head.sources){
  const input=await readMockReceipt(c,head,"sources");if(!Array.isArray(input))fail("PUBLICATION_SOURCE_SET_INVALID",3);
  sources=input.map(value=>canonicalSourceStorageReceiptSchema.parse(value));
  for(const record of sources){checkHash(record,"receiptSha256");if(Date.parse(record.storedAt)>Date.now())fail("PUBLICATION_RECEIPT_TIME_INVALID",3);}
  exact(ordered(sources.map(record=>({assetId:record.assetId,candidateSha256:record.candidateSha256,contentId:record.contentId,
   canonicalSha256:record.canonicalSha256,storageClass:record.storageClass,verifiedSizeBytes:record.verifiedSizeBytes}))),
   ordered(assets.map(asset=>({assetId:asset.assetId,candidateSha256:c.target,contentId:c.materials.frontmatter.id,
    canonicalSha256:asset.canonicalSource!.sha256,storageClass:asset.canonicalSource!.storageClass,verifiedSizeBytes:asset.canonicalSource!.sizeBytes}))));
 }
 if(head.publication){
  if(!sources)fail("PUBLICATION_SOURCE_PREREQUISITE_MISSING",3);
  publication=mediaPublicationManifestSchema.parse(await readMockReceipt(c,head,"publication"));checkHash(publication,"manifestSha256");
  exact(publication.authorization,{kind:"article_job",jobId:c.v.c.store.jobId,candidateSha256:c.target,
   humanApprovalRecordSha256:head.approvalSha256,canonicalSourceStorageReceiptSetSha256:fingerprint(sources),articleJobPublicMediaPermission:true});
  exact(ordered(publication.mediaSets.map(asset=>({...asset,objects:asset.objects.map(({action,verifiedAt,...object})=>object)}))),
   ordered(assets.map(asset=>({assetId:asset.assetId,rightsRef:asset.rightsRef,
    variantManifestSha256:c.v.media!.variants.find(record=>record.assetId===asset.assetId)!.manifestSha256,objects:objectExpected(asset)}))));
 }
 if(head.protection){
  if(!publication)fail("PUBLICATION_PROTECTION_ORDER_INVALID",3);
  protection=mediaProtectionReceiptSchema.parse(await readMockReceipt(c,head,"protection"));
  if(protection.policyFingerprint!==mockPolicySha256||protection.objects.some(object=>object.protectedObjectRef!==mockProtectedPrefix+sha256(object.sourceObjectKey)))
   fail("MOCK_PROTECTION_POLICY_OR_REF_INVALID",3);
  deriveCompactMediaRecoveryBinding(publication,protection);
 }
 if(head.export)await (await import("./publication-export.js")).verifyMockExport(join(c.folder,"exports",head.export),head.export);
 return {sources,publication,protection};
}
export async function verifyMockStoredObjects(c:PublicationContext,head:PublicationHead,port:PublicationPort){
 const plan=await mockObjectPlan(c);
 for(const [role,plane] of [["sources","source"],["publication","public"],["protection","protected"]] as const){
  if(!head[role])continue;
  for(const [key,object] of plan[plane]){
   const found=await port.read(plane,key);
   if(found.status!=="found"||storedIdentity(found.object)!==storedIdentity(object))fail("PUBLICATION_STORED_OBJECT_OR_POLICY_INVALID",3);
  }
 }
 return plan;
}
export const persistMockMedia=(directory:string,repo:DraftRepository,root:string,target:string,plane:Plane,port:PublicationPort)=>
 locked(directory,async()=>{
  const c=await publicationCandidate(directory,repo,root,target,"mock"),head=await readPublicationHead(c);
  const permissions=c.v.c.store.spec.permissions;assertPersistenceCapabilities(permissions,c.v.media!.registry.assets.length);
  if(port.mode!=="mock"||port.policySha256!==mockPolicySha256||!port.capabilities[plane])fail("MOCK_PROVIDER_GATE_CLOSED",3);
  await validateMockReceipts(c,head);const plan=await verifyMockStoredObjects(c,head,port);
  const role:Role=plane==="source"?"sources":plane==="public"?"publication":"protection";
  if(head[role])return {state:head.state,mode:"mock",simulation:true,reused:true,productionEligible:false};
  const expected={source:"HUMAN_APPROVED",public:"MEDIA_SOURCE_STORED",protected:"MEDIA_PUBLISHED"};
  if(head.state!==expected[plane])fail("PUBLICATION_STAGE_ORDER_INVALID",3);
  const baseline=await candidatePreviewSnapshot(directory,root,c.v.c.store.activeAttemptId,candidateDirectory(directory,target),true);
  const fresh=async()=>{
   if(fingerprint(await readPublicationHead(c))!==fingerprint(head))fail("PUBLICATION_HEAD_CHANGED",3);
   if(await candidatePreviewSnapshot(directory,root,c.v.c.store.activeAttemptId,candidateDirectory(directory,target),true)!==baseline)
    fail("PUBLICATION_APPROVAL_STALE",3);
  };
  const outcomes=new Map<string,{action:"uploaded"|"reused";verifiedAt:string}>();
  const binding={candidateSha256:target,approvalSha256:head.approvalSha256,attemptId:c.v.c.binding.attemptId,inputSha256:c.v.c.binding.inputSha256};
  for(const [key,object] of plan[plane]){
   if(plane==="protected"){
    const source=await port.read("public",key),expectedPublic=plan.public.get(key)!;
    if(source.status!=="found"||storedIdentity(source.object)!==storedIdentity(expectedPublic))fail("PROTECTION_SOURCE_BYTES_INVALID",3);
   }
   outcomes.set(key,await persistMockObject({folder:c.folder,binding,port,plane,key,object,fresh}));
  }
  let record:unknown;
  const time=new Date().toISOString();
  if(plane==="source"){
   record=c.v.media!.registry.assets.map(asset=>{
    const source=asset.canonicalSource!,key="source/v1/objects/sha256/"+source.sha256.slice(0,2)+"/"+source.sha256+"."+source.format;
    const result=outcomes.get(key)!;
    const value={schemaVersion:1,candidateSha256:target,contentId:c.materials.frontmatter.id,assetId:asset.assetId,
     canonicalSha256:source.sha256,storageClass:source.storageClass,action:result.action,verifiedSizeBytes:source.sizeBytes,storedAt:result.verifiedAt};
    return canonicalSourceStorageReceiptSchema.parse({...value,receiptSha256:fingerprint(value)});
   });
  }else if(plane==="public"){
   const sources=(await validateMockReceipts(c,head)).sources!;
   const value={schemaVersion:1,authorization:{kind:"article_job",jobId:c.v.c.store.jobId,candidateSha256:target,
    humanApprovalRecordSha256:head.approvalSha256,canonicalSourceStorageReceiptSetSha256:fingerprint(sources),articleJobPublicMediaPermission:true},
    mediaSets:c.v.media!.registry.assets.map(asset=>({assetId:asset.assetId,rightsRef:asset.rightsRef,
     variantManifestSha256:c.v.media!.variants.find(item=>item.assetId===asset.assetId)!.manifestSha256,
     objects:objectExpected(asset).map(object=>({...object,...outcomes.get(object.objectKey)}))})),completedAt:time};
   record=mediaPublicationManifestSchema.parse({...value,manifestSha256:fingerprint(value)});
  }else{
   const value={schemaVersion:1,candidateSha256:target,approvalRecordSha256:head.approvalSha256,
    mediaPublicationManifestSha256:(await validateMockReceipts(c,head)).publication!.manifestSha256,protectionClass:"cloudflare_protected_copy_v1",policyFingerprint:mockPolicySha256,
    objects:[...plan.protected].map(([key,object])=>({sha256:sha256(object.bytes),sourceObjectKey:key,verifiedSizeBytes:object.bytes.length,
     protectedObjectRef:object.protectedRef!,protectedAt:outcomes.get(key)!.verifiedAt})),completedAt:time};
   record=mediaProtectionReceiptSchema.parse({...value,receiptSha256:fingerprint(value)});
  }
  const hash=fingerprint(record);
  await noLinks(c.folder);await mkdir(join(c.folder,"artifacts"),{recursive:true,mode:0o700});
  await immutable(join(c.folder,"artifacts",hash+".json"),canonicalJson({protocol:"xpotato-private-mock-receipt-v1",mode:"mock",
   productionEligible:false,candidateSha256:target,approvalSha256:head.approvalSha256,role,record})+"\n");
  const next=publicationHeadSchema.parse({...head,[role]:hash,state:{source:"MEDIA_SOURCE_STORED",public:"MEDIA_PUBLISHED",protected:"MEDIA_PROTECTED"}[plane]});
  await validateMockReceipts(c,next);await fresh();
  await atomic(join(c.folder,"head.json"),canonicalJson(next)+"\n");
  return {state:next.state,mode:"mock",simulation:true,productionEligible:false,artifactSha256:hash};
 });
