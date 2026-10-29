import {canonicalSourceStorageReceiptSchema,contentMediaRegistrySchema,mediaProtectionReceiptSchema,mediaPublicationManifestSchema,
 type ContentMediaRegistry,type CanonicalSourceStorageReceipt,type MediaPublicationManifest,type MediaProtectionReceipt,type MediaRightsRecord} from '@xpotato/content-contracts';
import {articleMediaTargets} from '@xpotato/content-contracts/article-media-targets';
import {fingerprint,sha256} from './canonical.js';
import {deriveCompactMediaRecoveryBinding} from './media-persistence.js';
import {assertPublicationRights} from './publication-public-metadata.js';
import type {ObjectRead,Plane,StoredObject} from './publication-contracts.js';

/** A Server-owned read transport, supplied by application code, never by article JSON.
 * This verifier has no write, delete, config or credential method. No transport is
 * activated by the Site CLI; its live mutation gate remains closed.
 */
export interface MediaReadbackPort {
 readonly mode:'live'|'test_fixture';
 policy():Promise<{status:'unknown'}|{status:'found';authorityRevision:string;observedAt:string;fingerprint:string;
  sourcePrivate:boolean;protectedPrivate:boolean;protectedIndefiniteLock:boolean;automaticExpiration:boolean;writersSeparated:boolean}>;
 read(plane:Plane,key:string,maxBytes:number):Promise<ObjectRead>;
}
type Expected={sha256:string;sizeBytes:number;contentType:string;cacheControl:string;protectedRef:string|null};
const mime=(format:string)=>format==='svg'?'image/svg+xml':'image/'+format;
const exact=(a:unknown,b:unknown,message:string)=>{if(fingerprint(a)!==fingerprint(b))throw Error(message);};
const sorted=<T extends {assetId:string}>(items:T[])=>[...items].sort((a,b)=>a.assetId<b.assetId?-1:a.assetId>b.assetId?1:0);
function checkedHash(value:Record<string,unknown>,key:string){const {[key]:hash,...unsigned}=value;if(hash!==fingerprint(unsigned))throw Error('MEDIA_RECEIPT_HASH_INVALID');}
export async function verifyPublicationReadback(input:{registry:ContentMediaRegistry;rights:readonly MediaRightsRecord[];
 sources:readonly CanonicalSourceStorageReceipt[];publication:MediaPublicationManifest;protection:MediaProtectionReceipt},port:MediaReadbackPort){
 const registry=contentMediaRegistrySchema.parse(input.registry),sources=input.sources.map(x=>canonicalSourceStorageReceiptSchema.parse(x));
 const publication=mediaPublicationManifestSchema.parse(input.publication),protection=mediaProtectionReceiptSchema.parse(input.protection);
 if(!['live','test_fixture'].includes(port.mode))throw Error('MEDIA_READBACK_MODE_INVALID');
 if(publication.authorization.kind!=='article_job')throw Error('MEDIA_ARTICLE_JOB_BINDING_REQUIRED');
 const auth=publication.authorization,active=registry.assets.filter(a=>a.status==='active');
 if(!active.length||new Set(sources.map(x=>x.assetId)).size!==sources.length)throw Error('MEDIA_SOURCE_EXACT_SET_REQUIRED');
 for(const source of sources)checkedHash(source,'receiptSha256');
 checkedHash(publication,'manifestSha256');checkedHash(protection,'receiptSha256');
 exact(fingerprint(sources),auth.canonicalSourceStorageReceiptSetSha256,'MEDIA_SOURCE_RECEIPT_SET_MISMATCH');
 exact(sorted(sources.map(s=>({assetId:s.assetId,contentId:s.contentId,candidate:s.candidateSha256,sha:s.canonicalSha256,size:s.verifiedSizeBytes,storageClass:s.storageClass}))),
  sorted(active.map(a=>({assetId:a.assetId,contentId:registry.contentId,candidate:auth.candidateSha256,sha:a.canonicalSource?.sha256,size:a.canonicalSource?.sizeBytes,storageClass:a.canonicalSource?.storageClass}))),
  'MEDIA_SOURCE_EXACT_SET_REQUIRED');
 assertPublicationRights(input.rights);
 if(active.some(a=>input.rights.filter(r=>r.rightsId===a.rightsRef).length!==1))throw Error('MEDIA_ASSET_RIGHTS_REQUIRED');
 exact(sorted(publication.mediaSets.map(s=>({assetId:s.assetId,rightsRef:s.rightsRef,objects:s.objects.map(({purpose,sha256,objectKey,format,width,contentType,cacheControl,verifiedSizeBytes})=>({purpose,sha256,objectKey,format,...(width===undefined?{}:{width}),contentType,cacheControl,verifiedSizeBytes}))}))),
  sorted(active.map(a=>({assetId:a.assetId,rightsRef:a.rightsRef,objects:[a.delivery.master,...a.delivery.variants].map((o,i)=>({purpose:i?'variant':'master',sha256:o.sha256,objectKey:o.objectKey,format:o.format,...(i&&o.width?{width:o.width}:{}),contentType:mime(o.format),cacheControl:articleMediaTargets.public.cacheControl,verifiedSizeBytes:o.sizeBytes}))}))),
  'MEDIA_PUBLIC_EXACT_SET_REQUIRED');
 const recovery=deriveCompactMediaRecoveryBinding(publication,protection);
 if(recovery.objects.some(o=>!o.protectedObjectRef.startsWith('site-protected-v1:sha256:')))throw Error('MEDIA_SERVER_PROTECTED_REFERENCE_REQUIRED');
 const policy=await port.policy();
 if(policy.status!=='found')throw Error('MEDIA_POLICY_READ_UNKNOWN');
 const age=Date.now()-Date.parse(policy.observedAt);
 if(policy.authorityRevision!==articleMediaTargets.authority.revision||!Number.isFinite(age)||age<0||age>5*60*1000
  ||policy.fingerprint!==protection.policyFingerprint||!policy.sourcePrivate||!policy.protectedPrivate||!policy.protectedIndefiniteLock
  ||policy.automaticExpiration||!policy.writersSeparated)throw Error('MEDIA_POLICY_READBACK_REQUIRED');
 const plans:Record<Plane,Map<string,Expected>>={source:new Map(),public:new Map(),protected:new Map()};
 function add(plane:Plane,key:string,item:Expected){const old=plans[plane].get(key);if(old)exact(old,item,'MEDIA_OBJECT_KEY_CONFLICT');plans[plane].set(key,item);}
 for(const a of active){const s=a.canonicalSource!;
  add('source','source/v1/objects/sha256/'+s.sha256.slice(0,2)+'/'+s.sha256+'.'+s.format,
   {sha256:s.sha256,sizeBytes:s.sizeBytes,contentType:mime(s.format),cacheControl:'private, no-store',protectedRef:null});
  for(const o of [a.delivery.master,...a.delivery.variants]){
   add('public',o.objectKey,{sha256:o.sha256,sizeBytes:o.sizeBytes,contentType:mime(o.format),cacheControl:articleMediaTargets.public.cacheControl,protectedRef:null});
   const ref=recovery.objects.find(r=>r.publicObjectKey===o.objectKey)!;
   add('protected',o.objectKey,{sha256:o.sha256,sizeBytes:o.sizeBytes,contentType:mime(o.format),cacheControl:'private, no-store',protectedRef:ref.protectedObjectRef});
  }
 }
 const checked:Record<Plane,number>={source:0,public:0,protected:0};
 for(const plane of ['source','public','protected'] as const)for(const [key,item] of plans[plane]){
  if(item.sizeBytes<0||item.sizeBytes>24*1024*1024)throw Error('MEDIA_READBACK_SIZE_LIMIT');
  const result=await port.read(plane,key,item.sizeBytes+1);
  if(result.status==='unknown'||result.status==='absent'&&result.authoritative!==true)throw Error('MEDIA_OBJECT_READ_UNKNOWN');
  if(result.status==='absent')throw Error('MEDIA_OBJECT_MISSING');
  const object:StoredObject=result.object;
  if(object.bytes.length!==item.sizeBytes||sha256(object.bytes)!==item.sha256||object.contentType!==item.contentType
   ||object.cacheControl!==item.cacheControl||object.policySha256!==policy.fingerprint||object.protectedRef!==item.protectedRef)throw Error('MEDIA_OBJECT_READBACK_MISMATCH');
  checked[plane]++;
 }
 // A readback result is neither a human approval nor a storage/export receipt.
 return {mode:port.mode,readbackVerified:true,liveProviderVerified:port.mode==='live',productionEligible:false as const,
  authorityRevision:policy.authorityRevision,policyFingerprint:policy.fingerprint,checked,recovery};
}
