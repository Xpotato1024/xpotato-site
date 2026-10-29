import {describe,it,expect} from 'vitest';
import {verifyPublicationReadback,type MediaReadbackPort} from './media-readback.js';
import {fingerprint,sha256} from './canonical.js';
import {articleMediaTargets} from '@xpotato/content-contracts/article-media-targets';
import type {ContentMediaRegistry,MediaRightsRecord} from '@xpotato/content-contracts';
import type {StoredObject as ObjectValue,Plane} from './publication-contracts.js';
function fixture(){
 const h='a'.repeat(64),policy='b'.repeat(64),contentId='00000000-0000-4000-8000-000000000001';
 const source=Buffer.from('canonical bytes'),delivery=Buffer.from('public bytes'),s=sha256(source),d=sha256(delivery);
 const key='media/v1/objects/sha256/'+d.slice(0,2)+'/'+d+'.png',ref='site-protected-v1:sha256:'+d+':png';
 const registry={schemaVersion:1,contentId,assets:[{assetId:'social',role:'social_card',origin:'deterministic_cover',status:'active',rightsRef:'rights',provenanceRef:'proof',visualAuditRef:'audit',defaultAlt:'見出し',
  canonicalSource:{storageClass:'private_canonical_media_v1',sha256:s,format:'webp',width:1200,height:630,sizeBytes:source.length,ingestProfileId:'canonical',ingestProfileSha256:h},
  delivery:{mode:'fixed',master:{sha256:d,objectKey:key,format:'png',width:1200,height:630,sizeBytes:delivery.length},variants:[]}}]} as ContentMediaRegistry;
 const sign=<T extends object>(value:T,k:string)=>({...value,[k]:fingerprint(value)});
 const sources=[sign({schemaVersion:1,candidateSha256:h,contentId,assetId:'social',canonicalSha256:s,storageClass:'private_canonical_media_v1',action:'uploaded',verifiedSizeBytes:source.length,storedAt:'2026-10-29T00:00:00Z'},'receiptSha256')];
 const publication=sign({schemaVersion:1,authorization:{kind:'article_job',jobId:'job',candidateSha256:h,humanApprovalRecordSha256:h,canonicalSourceStorageReceiptSetSha256:fingerprint(sources),articleJobPublicMediaPermission:true},
  mediaSets:[{assetId:'social',rightsRef:'rights',variantManifestSha256:h,objects:[{purpose:'master',sha256:d,objectKey:key,format:'png',contentType:'image/png',cacheControl:articleMediaTargets.public.cacheControl,action:'uploaded',verifiedSizeBytes:delivery.length,verifiedAt:'2026-10-29T00:00:00Z'}]}],completedAt:'2026-10-29T00:00:00Z'},'manifestSha256');
 const protection=sign({schemaVersion:1,candidateSha256:h,approvalRecordSha256:h,mediaPublicationManifestSha256:publication.manifestSha256,protectionClass:'cloudflare_protected_copy_v1',policyFingerprint:policy,objects:[{sha256:d,sourceObjectKey:key,verifiedSizeBytes:delivery.length,protectedObjectRef:ref,protectedAt:'2026-10-29T00:00:00Z'}],completedAt:'2026-10-29T00:00:00Z'},'receiptSha256');
 const rights=[{schemaVersion:1,rightsId:'rights',basis:'self_created',publicationAuthorized:true,confirmedBy:'user',confirmedAt:'2026-10-29T00:00:00Z'}] as MediaRightsRecord[];
 const objects:Record<Plane,Map<string,ObjectValue>>={source:new Map(),public:new Map(),protected:new Map()};
 objects.source.set('source/v1/objects/sha256/'+s.slice(0,2)+'/'+s+'.webp',{bytes:source,contentType:'image/webp',cacheControl:'private, no-store',policySha256:policy,protectedRef:null});
 objects.public.set(key,{bytes:delivery,contentType:'image/png',cacheControl:articleMediaTargets.public.cacheControl,policySha256:policy,protectedRef:null});
 objects.protected.set(key,{bytes:delivery,contentType:'image/png',cacheControl:'private, no-store',policySha256:policy,protectedRef:ref});
 const policyRecord={status:'found' as const,authorityRevision:articleMediaTargets.authority.revision,observedAt:new Date().toISOString(),fingerprint:policy,sourcePrivate:true,protectedPrivate:true,protectedIndefiniteLock:true,automaticExpiration:false,writersSeparated:true};
 const port:MediaReadbackPort={mode:'test_fixture',policy:async()=>policyRecord,read:async(plane,k,max)=>{const value=objects[plane].get(k);expect(max).toBe((value?.bytes.length??0)+1);return value?{status:'found',object:value}:{status:'absent',authoritative:true};}};
 return {input:{registry,rights,sources,publication,protection} as unknown as Parameters<typeof verifyPublicationReadback>[0],port,objects,key,policyRecord};
}
describe('provider-neutral read-only media verification',()=>{
 it('verifies exact source/public/protected bytes and derives compact identity, without granting publication',async()=>{
  const x=fixture(),r=await verifyPublicationReadback(x.input,x.port);
  expect(r).toMatchObject({mode:'test_fixture',readbackVerified:true,liveProviderVerified:false,productionEligible:false,checked:{source:1,public:1,protected:1}});
  expect(r.recovery.objects[0]!.protectedObjectRef).toBe(x.input.protection.objects[0]!.protectedObjectRef);
 });
 it('distinguishes unknown, authoritative absence and changed bytes/metadata',async()=>{
  for(const status of ['unknown','absent'] as const){const x=fixture();x.port.read=async()=>status==='unknown'?{status}:{status,authoritative:true};await expect(verifyPublicationReadback(x.input,x.port)).rejects.toThrow(status==='unknown'?'MEDIA_OBJECT_READ_UNKNOWN':'MEDIA_OBJECT_MISSING');}
  for(const change of [{bytes:Buffer.from('wrong')},{cacheControl:'public'},{protectedRef:'wrong'}]){
   const x=fixture(),original=x.objects.protected.get(x.key)!;x.objects.protected.set(x.key,{...original,...change});
   x.port.read=async(p,k)=>({status:'found',object:x.objects[p].get(k)!});
   await expect(verifyPublicationReadback(x.input,x.port)).rejects.toThrow('MEDIA_OBJECT_READBACK_MISMATCH');
  }
 });
 it('requires fresh accepted policy and privilege/privacy/lock evidence before object reads',async()=>{
  for(const bad of [{observedAt:'2020-01-01T00:00:00Z'},{protectedIndefiniteLock:false},{automaticExpiration:true},{sourcePrivate:false},{writersSeparated:false},{authorityRevision:'c'.repeat(40)}]){
   const x=fixture();Object.assign(x.policyRecord,bad);x.port.read=async()=>{throw Error('unexpected object read');};
   await expect(verifyPublicationReadback(x.input,x.port)).rejects.toThrow('MEDIA_POLICY_READBACK_REQUIRED');
  }
 });
 it('rejects broken receipt, source set or rights instead of certifying a later plane',async()=>{
  for(const mutate of [(x:ReturnType<typeof fixture>)=>{x.input.sources=[];},(x:ReturnType<typeof fixture>)=>{x.input.rights[0]!.publicationAuthorized=false;},(x:ReturnType<typeof fixture>)=>{x.input.protection.approvalRecordSha256='c'.repeat(64);}]){
   const x=fixture();mutate(x);await expect(verifyPublicationReadback(x.input,x.port)).rejects.toThrow();
  }
 });
});
