import {describe,it,expect} from "vitest";
import {assertCompactRegistryMedia,assertMockCompactRegistryMedia} from "./compact-media.js";
import {renderRegistryPicture} from "./media-picture.js";
import {assertNoPrivateCandidateEnvironment,privateDraftOutputErrors} from "./private-output.js";
import type {ContentMediaRegistry,PublicationProvenanceRecord,MediaRightsRecord} from "@xpotato/content-contracts";
const h="a".repeat(64),v="b".repeat(64),contentId="f8a847d4-8f5d-4bb0-a387-750f096479f2";
const object=(sha:string,width:number,format:"jpeg"|"webp")=>({sha256:sha,objectKey:"media/v1/objects/sha256/"+sha.slice(0,2)+"/"+sha+"."+(format==="jpeg"?"jpg":format),format,width,height:width/2,sizeBytes:123});
function fixture(){
 const registry:ContentMediaRegistry={schemaVersion:1,contentId,assets:[{assetId:"hero",role:"hero",origin:"camera",status:"active",
  defaultAlt:"写真 < &",decorative:false,rightsRef:"rights-1",provenanceRef:"provenance-1",visualAuditRef:"audit-1",
  canonicalSource:{storageClass:"private_canonical_media_v1",sha256:h,format:"webp",width:640,height:320,sizeBytes:123,ingestProfileId:"canonical-raster-v1",ingestProfileSha256:h},
  delivery:{mode:"responsive",profileId:"photo-hero-v1",profileSha256:h,master:object(h,640,"jpeg"),variants:[object(v,320,"webp")]}}]};
 const rights:MediaRightsRecord[]=[{schemaVersion:1,rightsId:"rights-1",basis:"self_created",publicationAuthorized:true,confirmedBy:"user",confirmedAt:"2026-10-15T00:00:00Z"}];
 const provenance:PublicationProvenanceRecord={schemaVersion:1,contentId,origin:"article_job",content:{mdxSha256:h,frontmatterSha256:h,route:"/blog/fixture/"},sourceRefs:[],materialClaims:[],
  articleJob:{jobId:"job-1",candidateSha256:h,approvalRecordSha256:h,sourceBundleSha256:h,evidenceBundleSha256:h,citationCompilationSha256:h,
   technicalExampleVerificationSha256:h,contentAuditSha256:h,externalAiPolicyId:"policy-1",externalAiPolicySha256:h,canonicalSourceStorageReceiptSetSha256:h,
   mediaPublicationManifestSha256:h,mediaProtectionReceiptSha256:h},
  mediaSources:[{assetId:"hero",canonicalSha256:h,format:"webp",width:640,height:320,ingestProfileId:"canonical-raster-v1",ingestProfileSha256:h,storageClass:"private_canonical_media_v1"}],
  mediaRecovery:{protectionClass:"cloudflare_protected_copy_v1",policyFingerprint:h,mediaProtectionReceiptSha256:h,
   objects:[h,v].map((sha,i)=>({sha256:sha,publicObjectKey:object(sha,i?320:640,i?"webp":"jpeg").objectKey,verifiedSizeBytes:123,protectedObjectRef:"protected-"+i}))},
  exportedAt:"2026-10-15T00:00:00Z"};
 return {registry,provenance,rights};
}
describe("cleanup-safe compact media gate",()=>{
 it("validates Git records with no private Job, full persistence receipt or original upload",()=>{
  const f=fixture();expect(assertCompactRegistryMedia(f)).toEqual(f.registry);
 });
 it.each(["missing","extra","bytes","duplicate","protected-duplicate","source","lineage","rights","audit"] as const)("rejects incomplete or mismatched compact records: %s",kind=>{
  const f=fixture(),recovery=f.provenance.mediaRecovery!;
  if(kind==="missing")recovery.objects.pop();
  if(kind==="extra")recovery.objects.push({...recovery.objects[0]!,publicObjectKey:"other",protectedObjectRef:"other"});
  if(kind==="bytes")recovery.objects[0]!.verifiedSizeBytes++;
  if(kind==="duplicate")recovery.objects.push({...recovery.objects[0]!});
  if(kind==="protected-duplicate")recovery.objects[1]!.protectedObjectRef=recovery.objects[0]!.protectedObjectRef;
  if(kind==="source")f.provenance.mediaSources![0]!.canonicalSha256=v;
  if(kind==="lineage")f.provenance.articleJob!.mediaProtectionReceiptSha256=v;
  if(kind==="rights")f.rights[0]!.publicationAuthorized=false;
  if(kind==="audit")delete f.registry.assets[0]!.visualAuditRef;
  expect(()=>assertCompactRegistryMedia(f)).toThrow();
 });
});
describe("registered picture and private build boundary",()=>{
 it("escapes attributes and emits dimensions, local exact-hash URLs and responsive sources",()=>{
  const f=fixture(),html=renderRegistryPicture({registry:f.registry,assetId:"hero",priority:true,urlFor:ref=>"/__candidate_media/"+ref.sha256+"."+(ref.format==="jpeg"?"jpg":ref.format)});
  expect(html).toContain('alt="写真 &lt; &amp;"');expect(html).toContain('width="640" height="320"');
  expect(html).toContain('fetchpriority="high"');expect(html).toContain("320w");
 });
 it("rejects an unrelated hash, remote unsafe URL, duplicate width and missing alt",()=>{
  const f=fixture();expect(()=>renderRegistryPicture({registry:f.registry,assetId:"hero",urlFor:()=>"/__candidate_media/"+v+".jpg"})).toThrow();
  expect(()=>renderRegistryPicture({registry:f.registry,assetId:"hero",urlFor:ref=>"https://u:p@example.test/"+ref.objectKey})).toThrow();
  f.registry.assets[0]!.delivery.variants.push({...f.registry.assets[0]!.delivery.variants[0]!});
  expect(()=>renderRegistryPicture({registry:f.registry,assetId:"hero",urlFor:ref=>"https://assets.example.test/"+ref.objectKey})).toThrow();
 });
 it("fails normal build with any private candidate override, including an empty value",()=>{
  expect(()=>assertNoPrivateCandidateEnvironment({})).not.toThrow();
  for(const name of ["XPOTATO_ARTICLE_CANDIDATE_INPUT","XPOTATO_ARTICLE_CANDIDATE_INPUT_SHA","XPOTATO_ARTICLE_CANDIDATE_OTHER"])
   expect(()=>assertNoPrivateCandidateEnvironment({[name]:""})).toThrow("PRIVATE_CANDIDATE_ENVIRONMENT_IN_NORMAL_BUILD");
 });
 it("rejects a new private candidate artifact shape from public output",()=>{
  expect(privateDraftOutputErrors("registry.json",JSON.stringify({protocol:"xpotato-private-complete-candidate-v1"}))).toHaveLength(1);
 });
});


it("keeps reserved mock recovery identities private even after envelope removal",()=>{
 const f=fixture();
 for(const [index,object] of f.provenance.mediaRecovery!.objects.entries())object.protectedObjectRef="mock-only-protected-"+index;
 expect(()=>assertCompactRegistryMedia(f)).toThrow("MOCK_MEDIA_LINEAGE_IN_PRODUCTION");
 expect(()=>assertMockCompactRegistryMedia({...f,protocol:"xpotato-private-mock-export-v1",productionEligible:false})).not.toThrow();
 expect(privateDraftOutputErrors("provenance.json",JSON.stringify(f.provenance))).toHaveLength(1);
});
