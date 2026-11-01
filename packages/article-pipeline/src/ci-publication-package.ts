import {z} from 'zod';import {join} from 'node:path';
import {blogFrontmatterSchema,contentMediaRegistrySchema,mediaRightsRecordSchema,sha256Schema,stableIdSchema,
 compactSourceRefSchema,compactMaterialClaimBindingSchema,compactCanonicalMediaSourceRefSchema,compactAiRunRefSchema} from '@xpotato/content-contracts';
import {privateDraftOutputErrors} from '@xpotato/portable-content/private-output';
import {validatePortableMdx} from '@xpotato/portable-content';
import {articleMediaReferences} from '@xpotato/portable-content/media';
import sharp from 'sharp';import {sanitizeSvg} from '@xpotato/media-ingest';
import {canonicalJson,fingerprint,sha256} from './canonical.js';
import {splitDraft,type DraftRepository} from './draft-job.js';
import {visualContext} from './visual-review.js';import {candidateMaterials} from './candidate-material.js';
import {loadReviewPayload} from './review-journal.js';
import {assertPersistenceCapabilities} from './media-persistence.js';
import {assertPublicationRights,assertPublicPublicationMetadata} from './publication-public-metadata.js';
import {validatePublishObject,type PublishObject} from './r2-sdk-store.js';
import {safeReadBytes} from './private-files.js';
import {currentExternalAiPolicyBinding} from './disclosure.js';
const object=z.object({plane:z.enum(['source','public']),key:z.string().max(256),sha256:sha256Schema,sizeBytes:z.number().int().positive().max(24*1024*1024),
 contentType:z.string().max(64),cacheControl:z.string().max(128),base64:z.string().max(32*1024*1024)}).strict();
const evidence=z.object({jobId:stableIdSchema,sourceBundleSha256:sha256Schema,evidenceBundleSha256:sha256Schema,citationCompilationSha256:sha256Schema,
 technicalExampleVerificationSha256:sha256Schema,contentAuditSha256:sha256Schema,visualAuditSha256:sha256Schema,
 externalAiPolicyId:stableIdSchema,externalAiPolicySha256:sha256Schema}).strict();
export const ciPublicationPackageSchema=z.object({protocol:z.literal('xpotato-ci-publication-package-v1'),scope:z.enum(['existing_ai','human_local']),
 contentId:blogFrontmatterSchema.shape.id,mdx:z.string().max(2*1024*1024),registry:contentMediaRegistrySchema,
 rights:z.array(mediaRightsRecordSchema).min(1).max(50),evidence,
 sourceRefs:z.array(compactSourceRefSchema).max(200),materialClaims:z.array(compactMaterialClaimBindingSchema).max(500),
 mediaSources:z.array(compactCanonicalMediaSourceRefSchema).max(50),aiRuns:z.array(compactAiRunRefSchema).max(20),
 variantManifests:z.array(z.object({assetId:stableIdSchema,sha256:sha256Schema}).strict()).min(1).max(50),
 objects:z.array(object).min(2).max(512),semanticSha256:sha256Schema}).strict();
export type CiPublicationPackage=z.infer<typeof ciPublicationPackageSchema>;
export const ciPublicationAdmissionSchema=z.object({protocol:z.literal('xpotato-reviewed-publication-admission-v1'),contentId:blogFrontmatterSchema.shape.id,
 packageSha256:sha256Schema,semanticSha256:sha256Schema,producer:z.literal('verified-article-job-prepare-v1'),
 evidence,aiRuns:z.array(compactAiRunRefSchema).max(20)}).strict();
export type CiPublicationAdmission=z.infer<typeof ciPublicationAdmissionSchema>;
/** Authority is the normal reviewed main record, never a field supplied by
 * the downloaded package. It records producer verification, not a new audit. */
export function assertCiPublicationAdmission(p:CiPublicationPackage,bytesSha256:string,raw:unknown){
 const a=ciPublicationAdmissionSchema.parse(raw);
 if(a.contentId!==p.contentId||a.packageSha256!==bytesSha256||a.semanticSha256!==p.semanticSha256
  ||fingerprint(a.evidence)!==fingerprint(p.evidence)||fingerprint(a.aiRuns)!==fingerprint(p.aiRuns))throw Error('CI_PUBLICATION_ADMISSION_MISMATCH');
 return a;
}
/** Publication dates are operational metadata. The approval and audit subject
 * retain the complete title/body/rights/claims/images and never a code commit. */
export function publicationSemanticIdentity(p:Omit<CiPublicationPackage,'semanticSha256'>|CiPublicationPackage){
 const {pubDate:_date,updatedDate:_updated,draft:_draft,...frontmatter}=splitDraft(p.mdx).frontmatter;
 return fingerprint({protocol:p.protocol,scope:p.scope,contentId:p.contentId,frontmatter,body:splitDraft(p.mdx).body,
  registry:p.registry,rights:p.rights,evidence:p.evidence,sourceRefs:p.sourceRefs,materialClaims:p.materialClaims,
  mediaSources:p.mediaSources,aiRuns:p.aiRuns,variantManifests:p.variantManifests,objects:p.objects.map(({base64:_bytes,...o})=>o)});
}
export function publicationPackageObjects(p:CiPublicationPackage):PublishObject[]{return p.objects.map(({base64,...o})=>({...o,bytes:Buffer.from(base64,'base64')}));}
export function validateCiPublicationPackage(raw:unknown){
 const p=ciPublicationPackageSchema.parse(raw),fm=splitDraft(p.mdx).frontmatter;
 if(p.semanticSha256!==publicationSemanticIdentity(p)||fm.id!==p.contentId||p.registry.contentId!==p.contentId
  ||privateDraftOutputErrors('apps/site/src/content/blog/approved.mdx',p.mdx).length||validatePortableMdx(splitDraft(p.mdx).body).length)throw Error('CI_PUBLICATION_SUBJECT_INVALID');
 assertPublicationRights(p.rights);assertPublicPublicationMetadata({registry:p.registry,rights:p.rights,sourceRefs:p.sourceRefs,materialClaims:p.materialClaims,mediaSources:p.mediaSources,aiRuns:p.aiRuns});
 if(/libfile_|codex-thread:|chatgpt\.com\/c\/|file_[a-f0-9]{16}/iu.test(canonicalJson(p)))throw Error('CI_PUBLICATION_PRIVATE_LINEAGE_DENIED');
 const byKey=new Map<string,PublishObject>();let size=0;
 for(const [i,o] of publicationPackageObjects(p).entries()){
  validatePublishObject(o);if(Buffer.from(o.bytes).toString('base64')!==p.objects[i]!.base64||byKey.has(o.plane+':'+o.key))throw Error('CI_PUBLICATION_BYTES_INVALID');
  byKey.set(o.plane+':'+o.key,o);size+=o.sizeBytes;
 }if(size>64*1024*1024)throw Error('CI_PUBLICATION_SIZE_LIMIT');
 const expected:string[]=[];
 for(const a of p.registry.assets){
  const s=a.canonicalSource;if(a.status!=='active'||!s||!p.rights.some(r=>r.rightsId===a.rightsRef))throw Error('CI_PUBLICATION_ASSET_NOT_APPROVED');
  const source='source/v1/objects/sha256/'+s.sha256.slice(0,2)+'/'+s.sha256+'.'+s.format;
  for(const [plane,key,hash,bytes] of [['source',source,s.sha256,s.sizeBytes],...[a.delivery.master,...a.delivery.variants].map(o=>['public',o.objectKey,o.sha256,o.sizeBytes])] as const){
   const o=byKey.get(plane+':'+key);if(!o||o.sha256!==hash||o.sizeBytes!==bytes)throw Error('CI_PUBLICATION_EXACT_OBJECT_SET_REQUIRED');expected.push(plane+':'+key);
  }
 }
 if(fingerprint([...new Set(expected)].sort())!==fingerprint([...byKey.keys()].sort()))throw Error('CI_PUBLICATION_EXACT_OBJECT_SET_REQUIRED');
 const sources=new Set(p.sourceRefs.map(s=>s.sourceId));if(p.materialClaims.some(c=>!c.evidence.length||c.evidence.some(e=>e.sourceIds.some(id=>!sources.has(id)))))throw Error('CI_PUBLICATION_CLAIM_SUPPORT_REQUIRED');
 if(new Set(p.variantManifests.map(v=>v.assetId)).size!==p.registry.assets.length||p.variantManifests.length!==p.registry.assets.length||p.registry.assets.some(a=>!p.variantManifests.some(v=>v.assetId===a.assetId)))throw Error('CI_PUBLICATION_VARIANT_LINEAGE_REQUIRED');
 if(articleMediaReferences(splitDraft(p.mdx).body).some(id=>!p.registry.assets.some(a=>a.assetId===id)))throw Error('CI_PUBLICATION_MEDIA_REFERENCE_INVALID');
 if(p.scope==='existing_ai'&&(['auditor','visual_auditor'] as const).some(role=>p.aiRuns.filter(r=>r.role===role&&r.externalApiUsed===true).length!==1))throw Error('CI_PUBLICATION_AUDIT_LINEAGE_REQUIRED');
 return p;
}
export async function validateCiPublicationMedia(p:CiPublicationPackage){
 const objects=publicationPackageObjects(p);
 for(const o of objects){
  const refs=p.registry.assets.flatMap(a=>[...(a.canonicalSource?[{plane:'source',sha256:a.canonicalSource.sha256,format:a.canonicalSource.format,width:a.canonicalSource.width,height:a.canonicalSource.height}]:[]),
   ...[a.delivery.master,...a.delivery.variants].map(m=>({plane:'public',...m}))]).filter(r=>r.plane===o.plane&&r.sha256===o.sha256);
  if(!refs.length)throw Error('CI_PUBLICATION_MEDIA_PROFILE_INVALID');
  if(o.contentType==='image/svg+xml'){
   const text=Buffer.from(o.bytes).toString('utf8');sanitizeSvg(text);
   if(/<!DOCTYPE|<!ENTITY|<\?|\b(?:href|src)\s*=\s*["'](?!#)|url\(\s*["']?(?!#)/iu.test(text))throw Error('CI_PUBLICATION_ACTIVE_SVG_DENIED');
  }
  const image=sharp(o.bytes,{limitInputPixels:64*1024*1024,failOn:'error'}),meta=await image.metadata();
  if(meta.pages&&meta.pages!==1||meta.exif||meta.iptc||meta.xmp||meta.orientation||refs.some(r=>r.width!==meta.width||r.height!==meta.height||r.format!==meta.format))throw Error('CI_PUBLICATION_MEDIA_PROFILE_INVALID');
  // Decode all bounded pixels; header metadata alone is not image validity.
  await image.stats();
 }
}
/** Local, no network/approval/storage. Includes only approved-to-publish
 * material and compact lineage, never private Job/evidence bodies/history. */
export async function prepareCiPublicationPackage(directory:string,repo:DraftRepository,root:string){
 const s=await visualContext(directory,repo,root,false);
 if(!s.plan||!s.masters||!s.audit||!s.media||!['existing_ai','human_local'].includes(s.plan.scope)||s.audit.conclusion!=='pass')throw Error('CI_PUBLICATION_AUDITS_REQUIRED');
 const m=await candidateMaterials({...s,plan:s.plan,masters:s.masters,audit:s.audit,media:s.media},false);
 const contentAudit=await loadReviewPayload(s.c.journal,'audit');if(contentAudit.conclusion!=='pass'||!m.storagePlan.confirmed)throw Error('CI_PUBLICATION_AUDITS_REQUIRED');
 if(m.redirects.length||s.c.store.original)throw Error('CI_PUBLICATION_INITIAL_ARTICLE_ONLY');
 if(!s.c.store.spec.permissions.repositoryExport)throw Error('CI_PUBLICATION_PERMISSIONS_REQUIRED');
 assertPersistenceCapabilities(s.c.store.spec.permissions,s.media.registry.assets.length);
 const objects:CiPublicationPackage['objects']=[];
 for(const item of m.storagePlan.sourceObjects){
  const a=s.masters.assets.find(a=>a.ingest.canonicalMaster.sha256===item.sha256);if(!a)throw Error('CI_PUBLICATION_CANONICAL_SOURCE_MISSING');
  const bytes=await safeReadBytes(join(s.folder,a.ingest.canonicalMaster.privateRelativePath));
  objects.push({plane:'source',key:item.objectKey,sha256:item.sha256,sizeBytes:item.sizeBytes,contentType:item.objectKey.endsWith('.svg')?'image/svg+xml':'image/webp',cacheControl:'private, no-store',base64:bytes.toString('base64')});
 }
 for(const item of m.storagePlan.publicObjects){
  const local=s.media.localObjects.find(o=>o.sha256===item.sha256);if(!local)throw Error('CI_PUBLICATION_DELIVERY_MISSING');
  const bytes=await safeReadBytes(join(s.folder,local.path));objects.push({plane:'public',key:item.objectKey,sha256:item.sha256,sizeBytes:item.sizeBytes,contentType:item.contentType,cacheControl:item.cacheControl,base64:bytes.toString('base64')});
 }
 const unsigned={protocol:'xpotato-ci-publication-package-v1' as const,scope:s.plan.scope as 'existing_ai'|'human_local',contentId:m.frontmatter.id,mdx:m.mdx,registry:s.media.registry,rights:s.plan.rights,
  evidence:{jobId:s.c.store.jobId,sourceBundleSha256:m.candidate.evidence.sourceBundleSha256,evidenceBundleSha256:m.candidate.evidence.evidenceBundleSha256,
   citationCompilationSha256:m.candidate.evidence.citationCompilationSha256,technicalExampleVerificationSha256:m.candidate.evidence.technicalExampleVerificationSha256,
   contentAuditSha256:fingerprint(contentAudit),visualAuditSha256:fingerprint(s.audit),externalAiPolicyId:currentExternalAiPolicyBinding.policyId,externalAiPolicySha256:currentExternalAiPolicyBinding.policySha256},
  sourceRefs:m.provenanceProposal.sourceRefs,materialClaims:m.provenanceProposal.materialClaims,mediaSources:m.provenanceProposal.mediaSources,
  aiRuns:m.provenanceProposal.aiRuns,variantManifests:s.media.variants.map(v=>({assetId:v.assetId,sha256:v.manifestSha256})),objects};
 return validateCiPublicationPackage({...unsigned,semanticSha256:publicationSemanticIdentity(unsigned)});
}
export async function prepareCiPublicationBundle(directory:string,repo:DraftRepository,root:string){
 const p=await prepareCiPublicationPackage(directory,repo,root);await validateCiPublicationMedia(p);
 const bytes=Buffer.from(canonicalJson(p)+'\n'),admission=ciPublicationAdmissionSchema.parse({protocol:'xpotato-reviewed-publication-admission-v1',
  contentId:p.contentId,packageSha256:sha256(bytes),semanticSha256:p.semanticSha256,producer:'verified-article-job-prepare-v1',evidence:p.evidence,aiRuns:p.aiRuns});
 return {package:p,bytes,admission};
}
