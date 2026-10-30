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
 const resign=(record:any,key:string)=>{delete record[key];record[key]=fingerprint(record);};
 const bind=(x:ReturnType<typeof fixture>)=>{for(const source of x.input.sources)resign(source,'receiptSha256');const p=x.input.publication;if(p.authorization.kind!=='article_job')throw Error('fixture');p.authorization.canonicalSourceStorageReceiptSetSha256=fingerprint(x.input.sources);resign(p,'manifestSha256');x.input.protection.mediaPublicationManifestSha256=p.manifestSha256;resign(x.input.protection,'receiptSha256');};
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
 it('rechecks policy after every plane and bounds a stalled transport',async()=>{
  const x=fixture();let policies=0;x.port.policy=async()=>({...x.policyRecord,sourcePrivate:++policies===1});
  await expect(verifyPublicationReadback(x.input,x.port)).rejects.toThrow('MEDIA_POLICY_READBACK_REQUIRED');expect(policies).toBe(2);
  const y=fixture();let signal:AbortSignal|undefined;y.port.read=async(_p,_k,_m,s)=>{signal=s;return new Promise(()=>{});};
  await expect(verifyPublicationReadback(y.input,y.port,{timeoutMs:20})).rejects.toThrow('MEDIA_READBACK_DEADLINE');expect(signal?.aborted).toBe(true);
 });
 it('rejects metadata changes even when a transport returns the right bytes',async()=>{
  for(const change of [{contentType:'image/jpeg'},{policySha256:'c'.repeat(64)},{bytes:Buffer.from('same length!')}]){
   const x=fixture();x.objects.public.set(x.key,{...x.objects.public.get(x.key)!,...change});x.port.read=async(p,k)=>({status:'found',object:x.objects[p].get(k)!});
   await expect(verifyPublicationReadback(x.input,x.port)).rejects.toThrow('MEDIA_OBJECT_READBACK_MISMATCH');
  }
 });
 it('does not turn a caller supplied live label into provider acceptance',async()=>{
  const x=fixture();x.port={...x.port,mode:'live'};expect(await verifyPublicationReadback(x.input,x.port)).toMatchObject({mode:'live',liveProviderVerified:false,productionEligible:false});
 });
 it('rejects re-signed semantic asset, MIME, rights and approval mismatches',async()=>{
  for(const mutate of [(x:ReturnType<typeof fixture>)=>{x.input.sources[0]!.assetId='other';},(x:ReturnType<typeof fixture>)=>{x.input.publication.mediaSets[0]!.objects[0]!.contentType='image/jpeg';},(x:ReturnType<typeof fixture>)=>{x.input.publication.mediaSets[0]!.rightsRef='other';},(x:ReturnType<typeof fixture>)=>{x.input.protection.approvalRecordSha256='c'.repeat(64);}]){
   const x=fixture();mutate(x);bind(x);await expect(verifyPublicationReadback(x.input,x.port)).rejects.toThrow();
  }
 });
 it('reads one shared physical object per plane but refuses conflicting metadata for that key',async()=>{
  const x=fixture(),asset=structuredClone(x.input.registry.assets[0]!);asset.assetId='shared';asset.role='inline';x.input.registry.assets.push(asset);
  x.input.sources=[...x.input.sources,{...x.input.sources[0]!,assetId:'shared'}];x.input.publication.mediaSets.push({...structuredClone(x.input.publication.mediaSets[0]!),assetId:'shared'});bind(x);
  expect(await verifyPublicationReadback(x.input,x.port)).toMatchObject({checked:{source:1,public:1,protected:1}});
  asset.delivery.master.sizeBytes++;x.input.publication.mediaSets[1]!.objects[0]!.verifiedSizeBytes++;bind(x);
  await expect(verifyPublicationReadback(x.input,x.port)).rejects.toThrow(/conflict/iu);
 });
 it('rejects broken receipt, source set or rights instead of certifying a later plane',async()=>{
  for(const mutate of [(x:ReturnType<typeof fixture>)=>{x.input.sources=[];},(x:ReturnType<typeof fixture>)=>{x.input.rights[0]!.publicationAuthorized=false;},(x:ReturnType<typeof fixture>)=>{x.input.protection.approvalRecordSha256='c'.repeat(64);}]){
   const x=fixture();mutate(x);await expect(verifyPublicationReadback(x.input,x.port)).rejects.toThrow();
  }
 });
});
