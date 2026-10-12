import {describe,expect,it} from 'vitest';
import {fingerprint} from '@xpotato/content-contracts/canonical';
import {resolvePublishedSeoImage} from './seo-media.js';
import type {ContentMediaRegistry,MediaPublicationManifest,MediaProtectionReceipt,MediaRightsRecord} from '@xpotato/content-contracts';
const hash='a'.repeat(64), key=`media/v1/objects/sha256/aa/${hash}.webp`;
const fixture=()=>{
  const registry:ContentMediaRegistry={schemaVersion:1,contentId:'38f4cc36-81fb-4d7c-8063-686eb8000352',assets:[{assetId:'hero',role:'hero',origin:'diagram',status:'active',provenanceRef:'proof-1',rightsRef:'rights-1',defaultAlt:'合成検証画像',delivery:{mode:'fixed',master:{sha256:hash,objectKey:key,format:'webp',width:1200,height:630,sizeBytes:100},variants:[]}}]};
  const rights:MediaRightsRecord={schemaVersion:1,rightsId:'rights-1',basis:'self_created',publicationAuthorized:true,confirmedBy:'user',confirmedAt:'2026-10-06T00:00:00Z'};
  const unsigned={schemaVersion:1 as const,authorization:{kind:'article_job' as const,jobId:'fixture',candidateSha256:'1'.repeat(64),humanApprovalRecordSha256:'2'.repeat(64),canonicalSourceStorageReceiptSetSha256:'3'.repeat(64),articleJobPublicMediaPermission:true as const},mediaSets:[{assetId:'hero',rightsRef:'rights-1',variantManifestSha256:'4'.repeat(64),objects:[{purpose:'master' as const,sha256:hash,objectKey:key,format:'webp' as const,contentType:'image/webp',cacheControl:'public, max-age=31536000, immutable' as const,action:'uploaded' as const,verifiedSizeBytes:100,verifiedAt:'2026-10-06T00:00:00Z'}]}],completedAt:'2026-10-06T00:00:00Z'};
  const publication:MediaPublicationManifest={...unsigned,manifestSha256:fingerprint(unsigned)};
  const protectedUnsigned={schemaVersion:1 as const,candidateSha256:'1'.repeat(64),approvalRecordSha256:'2'.repeat(64),mediaPublicationManifestSha256:publication.manifestSha256,protectionClass:'cloudflare_protected_copy_v1' as const,objects:[{sha256:hash,sourceObjectKey:key,verifiedSizeBytes:100,protectedObjectRef:'protected-1',protectedAt:'2026-10-06T00:00:00Z'}],policyFingerprint:'5'.repeat(64),completedAt:'2026-10-06T00:00:00Z'};
  const protection:MediaProtectionReceipt={...protectedUnsigned,receiptSha256:fingerprint(protectedUnsigned)};
  return {contentId:registry.contentId,contentPublished:true,publicOrigin:'https://media.example.com/',registry,rights:[rights],publication,protection};
};
describe('publication/protection-gated SEO media foundation',()=>{
  it('omits unpublished, unconfigured and incomplete inputs',()=>{
    const input=fixture();
    for(const change of [{contentPublished:false},{publicOrigin:undefined},{registry:undefined},{publication:undefined},{protection:undefined}])expect(resolvePublishedSeoImage({...input,...change})).toBeUndefined();
  });
  it('derives only exact registered/public/protected bytes with rights and dimensions',()=>expect(resolvePublishedSeoImage(fixture())).toEqual({url:'https://media.example.com/'+key,width:1200,height:630,alt:'合成検証画像'}));
  it('rejects receipt mismatch, unauthorized rights, wrong identity and dimensions',()=>{
    const input=fixture();
    expect(()=>resolvePublishedSeoImage({...input,protection:{...input.protection,mediaPublicationManifestSha256:'6'.repeat(64)}})).toThrow();
    expect(()=>resolvePublishedSeoImage({...input,rights:[{...input.rights[0]!,publicationAuthorized:false}]})).toThrow();
    expect(()=>resolvePublishedSeoImage({...input,contentId:'00000000-0000-4000-8000-000000000000'})).toThrow();
    input.registry.assets[0]!.delivery.master.width=undefined;
    expect(()=>resolvePublishedSeoImage(input)).toThrow();
  });
});
