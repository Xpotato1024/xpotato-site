import {contentMediaRegistrySchema,publicationProvenanceRecordSchema,mediaRightsRecordSchema,
 type ContentMediaRegistry,type PublicationProvenanceRecord,type MediaRightsRecord} from "@xpotato/content-contracts";
import {fingerprint} from "@xpotato/content-contracts/canonical";
// Build-only validation from cleanup-safe Git records. Never imports a private job or operational full receipt.
function validateCompactRegistryMedia(input:{registry:ContentMediaRegistry;provenance:PublicationProvenanceRecord;rights:readonly MediaRightsRecord[]}){
 const registry=contentMediaRegistrySchema.parse(input.registry),provenance=publicationProvenanceRecordSchema.parse(input.provenance);
 const recovery=provenance.mediaRecovery;
 if(provenance.contentId!==registry.contentId||!provenance.articleJob||!recovery
  ||provenance.articleJob.mediaProtectionReceiptSha256!==recovery.mediaProtectionReceiptSha256)throw Error("COMPACT_MEDIA_PROTECTION_LINEAGE_REQUIRED");
 const expected=new Map<string,{sha256:string;publicObjectKey:string;verifiedSizeBytes:number}>();
 const active=registry.assets.filter(item=>item.status==="active"),sources=[];
 for(const asset of active){
  const rights=input.rights.filter(item=>item.rightsId===asset.rightsRef);
  if(rights.length!==1||!mediaRightsRecordSchema.parse(rights[0]).publicationAuthorized||rights[0]!.basis==="unknown")throw Error("COMPACT_MEDIA_RIGHTS_REQUIRED");
  if(!asset.canonicalSource||!asset.visualAuditRef)throw Error("COMPACT_MEDIA_SOURCE_OR_AUDIT_REQUIRED");
  const source=asset.canonicalSource;
  sources.push({assetId:asset.assetId,canonicalSha256:source.sha256,format:source.format,...(source.width===undefined?{}:{width:source.width}),...(source.height===undefined?{}:{height:source.height}),
   ingestProfileId:source.ingestProfileId,ingestProfileSha256:source.ingestProfileSha256,storageClass:source.storageClass});
  for(const object of [asset.delivery.master,...asset.delivery.variants]){
   const record={sha256:object.sha256,publicObjectKey:object.objectKey,verifiedSizeBytes:object.sizeBytes};
   const existing=expected.get(object.objectKey);
   if(existing&&fingerprint(existing)!==fingerprint(record))throw Error("COMPACT_MEDIA_OBJECT_CONFLICT");
   expected.set(object.objectKey,record);
  }
 }
 const actual=recovery.objects.map(({sha256,publicObjectKey,verifiedSizeBytes})=>({sha256,publicObjectKey,verifiedSizeBytes}));
 const sorted=(items:readonly {publicObjectKey:string}[])=>[...items].sort((a,b)=>a.publicObjectKey<b.publicObjectKey?-1:a.publicObjectKey>b.publicObjectKey?1:0);
 if(new Set(actual.map(item=>item.publicObjectKey)).size!==actual.length||new Set(recovery.objects.map(item=>item.protectedObjectRef)).size!==recovery.objects.length
  ||fingerprint(sorted(actual))!==fingerprint(sorted([...expected.values()])))throw Error("COMPACT_MEDIA_RECOVERY_EXACT_SET_REQUIRED");
 const sortedSources=(items:readonly {assetId:string}[])=>[...items].sort((a,b)=>a.assetId<b.assetId?-1:a.assetId>b.assetId?1:0);
 if(fingerprint(sortedSources(sources))!==fingerprint(sortedSources(provenance.mediaSources??[])))throw Error("COMPACT_MEDIA_SOURCE_EXACT_SET_REQUIRED");
 return registry;
}


type CompactInput=Parameters<typeof validateCompactRegistryMedia>[0];
export function assertCompactRegistryMedia(input:CompactInput){
 if(input.provenance.mediaRecovery?.objects.some(object=>object.protectedObjectRef.startsWith("mock-only-")))
  throw Error("MOCK_MEDIA_LINEAGE_IN_PRODUCTION");
 return validateCompactRegistryMedia(input);
}
/** Private simulation verification only; retains reserved identities, never converts them to live receipts. */
export function assertMockCompactRegistryMedia(input:CompactInput & {protocol:"xpotato-private-mock-export-v1";productionEligible:false}){
 if(input.protocol!=="xpotato-private-mock-export-v1"||input.productionEligible!==false
  ||!input.provenance.mediaRecovery?.objects.length
  ||input.provenance.mediaRecovery.objects.some(object=>!object.protectedObjectRef.startsWith("mock-only-protected-")))
  throw Error("MOCK_COMPACT_SCOPE_REQUIRED");
 return validateCompactRegistryMedia(input);
}
