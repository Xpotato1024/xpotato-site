import {sha256Schema} from '@xpotato/content-contracts';
import {fingerprint,sha256} from '../canonical.js';
import type {PublicationStorage} from '../media/r2-sdk-store.js';
import {validateCiPublicationContext,type CiPublicationContext} from './ci-publication.js';
import {validateCiPublicationPackage,validateCiPublicationMedia,publicationPackageObjects} from './ci-publication-package.js';
import {storeVerifiedMediaObjects,type PublicationProgress} from './ci-media-storage.js';

/** The protected owner/manual main run selects these exact package bytes.
 * Package/admission JSON is not authority. Registration is only A/B/C storage
 * for review: no article existence, Git admission, preimage, date or export.
 * The later publish path still requires its reviewed main admission and reads
 * the exact selected objects again; this receipt cannot authorize that path. */
export async function registerCiMediaPackage(rawBytes:Uint8Array,input:{
 storage:PublicationStorage;context:CiPublicationContext;packageSha256:string;
 mode:'register-media'|'verify-media-only';now?:()=>Date;
 progress?:(event:PublicationProgress)=>Promise<void>;
}){
 const context=validateCiPublicationContext(input.context);
 if(!['register-media','verify-media-only'].includes(input.mode))throw Error('CI_MEDIA_REGISTRATION_MODE_REQUIRED');
 const packageSha256=sha256Schema.parse(input.packageSha256),bytes=Buffer.from(rawBytes);
 if(bytes.length===0||bytes.length>96*1024*1024||sha256(bytes)!==packageSha256)throw Error('PUBLICATION_PACKAGE_HASH_MISMATCH');
 const p=validateCiPublicationPackage(JSON.parse(bytes.toString('utf8')));
 await validateCiPublicationMedia(p);
 const now=input.now??(()=>new Date());
 const {objects,protectedObjects,outcomes}=await storeVerifiedMediaObjects(publicationPackageObjects(p),{
  storage:input.storage,mode:input.mode==='verify-media-only'?'verify-only':'publish',now,...(input.progress?{progress:input.progress}:{}),
 });
 const registration={protocol:'xpotato-ci-media-registration-authorization-v1' as const,...context,
  purpose:'review-media-registration-only' as const,packageSha256,semanticSha256:p.semanticSha256};
 const objectRecords=[...objects,...protectedObjects].map(({bytes:_bytes,...object})=>({
  ...object,...outcomes.get(object.plane+':'+object.key)!,
 }));
 const value={protocol:'xpotato-ci-media-registration-result-v1' as const,contentId:p.contentId,
  packageSha256,semanticSha256:p.semanticSha256,registrySha256:fingerprint(p.registry),rightsSha256:fingerprint(p.rights),
  registration,configurationSha256:input.storage.configurationSha256,
  configurationEvidenceBasis:'owner-reviewed-configuration-v1' as const,
  objects:objectRecords,objectSetSha256:fingerprint(objectRecords.map(({action:_action,verifiedAt:_at,...object})=>object)),
  assets:p.registry.assets.map(asset=>({assetId:asset.assetId,rightsRef:asset.rightsRef,
   canonicalSha256:asset.canonicalSource!.sha256,
   variantManifestSha256:p.variantManifests.find(v=>v.assetId===asset.assetId)!.sha256,
   delivery:[asset.delivery.master,...asset.delivery.variants].map(object=>({
    objectKey:object.objectKey,sha256:object.sha256,sizeBytes:object.sizeBytes,
    url:'https://assets.xpotato.net/'+object.objectKey,
   })),
  })),
  completedAt:now().toISOString(),storageVerified:true as const,
  canonicalFilesApplied:false as const,articleDeployed:false as const,exportAuthorized:false as const,
 };
 return {...value,receiptSha256:fingerprint(value)};
}
