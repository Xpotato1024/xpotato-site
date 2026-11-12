import {z} from 'zod';import {stringify} from 'yaml';
import {blogFrontmatterSchema,articleRoute,publicationProvenanceRecordSchema,canonicalSourceStorageReceiptSchema,mediaPublicationManifestSchema,mediaProtectionReceiptSchema} from '@xpotato/content-contracts';
import {assertCompactRegistryMedia} from '@xpotato/portable-content/compact-media';
import {validateCiPublicationPackage,validateCiPublicationMedia,assertCiPublicationAdmission,publicationPackageObjects,type CiPublicationPackage} from './ci-publication-package.js';
import {assertObjectMatches,type PublicationStorage,type PublishObject} from "../media/r2-sdk-store.js";
import {fingerprint,sha256,canonicalJson} from "../canonical.js";import {splitDraft,type DraftRepository} from "../draft-job.js";
import {deriveCompactMediaRecoveryBinding} from "../media/media-persistence.js";
import {publicationFileSlug,exactExportPatch,assertExportChanges,type ExportChange} from './publication-export.js';
import {publicationRegistryIndexChanges} from './publication-export-patch.js';
import {assertPublicPublicationMetadata} from './publication-public-metadata.js';
import {assertPublicationRevisionBase,assertPublicationRevisionGit,revisionPaths} from './publication-revision.js';
const contextSchema=z.object({repository:z.literal('Xpotato1024/xpotato-site'),event:z.literal('workflow_dispatch'),ref:z.literal('refs/heads/main'),
 actor:z.literal('Xpotato1024'),triggeringActor:z.literal('Xpotato1024'),environment:z.literal('site-production'),
 runId:z.string().regex(/^[1-9][0-9]*$/u),attempt:z.literal(1),sourceSha:z.string().regex(/^[a-f0-9]{40}$/u)}).strict();
export type CiPublicationContext=z.infer<typeof contextSchema>;
export const validateCiPublicationContext=(raw:unknown)=>contextSchema.parse(raw);
export type PublicationProgress={phase:'store'|'verified'|'final_readback';plane:PublishObject['plane'];key:string;sha256:string};
export function publicationDayJst(now:Date){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function publicationMdx(p:CiPublicationPackage,now:Date){
 const parsed=splitDraft(p.mdx),{updatedDate:_updated,...fm}=parsed.frontmatter;
 const previous=p.revision?.previous,day=publicationDayJst(now);
 if(previous&&(day<previous.pubDate||previous.updatedDate&&day<previous.updatedDate))throw Error('CI_UPDATE_CLOCK_BEFORE_PUBLISHED_VERSION');
 if (previous && fm.publishedAt !== previous.publishedAt) throw Error('CI_UPDATE_PUBLICATION_INSTANT_CHANGED');
 if (previous && ['metadata_only','media_only'].includes(p.revision!.kind) && fm.updatedAt !== previous.updatedAt) throw Error('CI_UPDATE_NON_MATERIAL_INSTANT_CHANGED');
 if (previous?.updatedAt && fm.updatedAt && Date.parse(fm.updatedAt) < Date.parse(previous.updatedAt)) throw Error('CI_UPDATE_INSTANT_BEFORE_PUBLISHED_VERSION');
 const date=previous?{pubDate:previous.pubDate,...(['metadata_only','media_only'].includes(p.revision!.kind)?
  (previous.updatedDate?{updatedDate:previous.updatedDate}:{}):{updatedDate:day})}:{pubDate:day};
 // Astro's frontmatter reader also recognizes YAML 1.1 timestamps. Quote
 // ambiguous strings so the portable date contract remains a string there.
 // Preserve only explicitly supplied instants; reject stale mismatches after the publication date changes.
 const output = blogFrontmatterSchema.parse({...fm,...date,draft:false});
 for (const instant of [output.publishedAt, output.updatedAt]) if (instant && Date.parse(instant) > now.valueOf()) throw Error('CI_PUBLICATION_INSTANT_IN_FUTURE');
 return '---\n'+stringify(output,{lineWidth:0,compat:'yaml-1.1'}).trimEnd()+'\n---\n'+parsed.body;
}
/** One protected CI job is the approval authority. The package contains no
 * executable code/ports or self-issued human approval. No credential issuance,
 * policy scan, signer/broker, commit, push, merge or deploy is performed here. */
export async function publishCiPackage(raw:unknown,input:{storage:PublicationStorage;context:CiPublicationContext;repo:DraftRepository;
 base:Readonly<Record<string,string|null>>;admission:unknown;packageSha256:string;mode:'publish'|'verify-only';repositoryRoot?:string;now?:()=>Date;progress?:(event:PublicationProgress)=>Promise<void>}){
 const p=validateCiPublicationPackage(raw),context=validateCiPublicationContext(input.context),now=input.now??(()=>new Date());
 assertCiPublicationAdmission(p,input.packageSha256,input.admission);await validateCiPublicationMedia(p);
 if(context.sourceSha!==input.repo.commit||!['publish','verify-only'].includes(input.mode))throw Error('CI_PUBLICATION_CONTEXT_CHANGED');
 if(!p.revision&&input.repo.records.some(r=>r.contentId===p.contentId))throw Error('CI_PUBLICATION_CREATE_TARGET_EXISTS');
 const slug=publicationFileSlug(input.repo,p.contentId),contentPath='apps/site/src/content/blog/'+slug+'.mdx';
 const previous=p.revision?assertPublicationRevisionBase(p.contentId,p.revision,input.repo,input.base):null;
 if(p.revision){
  if(!input.repositoryRoot)throw Error('CI_UPDATE_GIT_BASE_REQUIRED');
  assertPublicationRevisionGit(input.repositoryRoot,context.sourceSha,p.contentId,p.revision);
  if(['metadata_only','media_only'].includes(p.revision.kind)&&splitDraft(input.base[contentPath]!).body!==splitDraft(p.mdx).body)throw Error('CI_UPDATE_KIND_BODY_CHANGED');
 }else if(input.base[contentPath]!==null)throw Error('CI_PUBLICATION_BASE_CONFLICT');
 for(const name of ['media','provenance'])if(typeof input.base['apps/site/src/content-registry/'+name+'/index.ts']!=='string')throw Error('CI_PUBLICATION_BASE_REQUIRED');
 // The first article creates the rights index. Null is verified absence from
 // the repository snapshot; undefined is an incomplete snapshot, not absence.
 const rightsBase=input.base['apps/site/src/content-registry/media-rights/index.ts'];
 if(rightsBase!==null&&typeof rightsBase!=='string')throw Error('CI_PUBLICATION_BASE_REQUIRED');
 if(!p.revision)for(const name of ['media','provenance','media-rights'])if(input.base['apps/site/src/content-registry/'+name+'/blog/'+p.contentId+'.json']!==null)throw Error('CI_PUBLICATION_BASE_CONFLICT');
 const indices={media:input.base['apps/site/src/content-registry/media/index.ts']!,rights:rightsBase,provenance:input.base['apps/site/src/content-registry/provenance/index.ts']!};
 if(p.revision){
  const aliases={media:'articleMedia_',rights:'articleRights_',provenance:'articleProvenance_'},suffix=p.contentId.replaceAll('-','_');
  for(const name of ['media','rights','provenance'] as const){
   const source=indices[name];if(typeof source!=='string'||source!==input.repo.registrySnapshot['apps/site/src/content-registry/'+(name==='rights'?'media-rights':name)+'/index.ts'])throw Error('CI_UPDATE_INDEX_BASE_CONFLICT');
   const line='import '+aliases[name]+suffix+' from "./blog/'+p.contentId+'.json";';
   if(source.split(line).length!==2||source.split('from "./blog/'+p.contentId+'.json"').length!==2)throw Error('CI_UPDATE_INDEX_BASE_CONFLICT');
  }
  const alias='articleProvenance_'+suffix;
  if(indices.media.split('contentMediaRegistrySchema.parse(articleMedia_'+suffix+'),').length!==2
   ||indices.rights!.split('"'+p.contentId+'":articleRights_'+suffix+',').length!==2)throw Error('CI_UPDATE_INDEX_BASE_CONFLICT');
  if(indices.provenance.split('{contentId:'+alias+'.contentId,provenanceSha256:"'+fingerprint(previous!.provenance)+'"},').length!==2)throw Error('CI_UPDATE_INDEX_BASE_CONFLICT');
 }
 // Validate the existing index grammar before storage. This pure projection is
 // discarded; no provisional receipt or provenance is emitted.
 publicationRegistryIndexChanges({id:p.contentId,provenanceSha256:p.semanticSha256,...indices,redirects:null,routeChanged:false});
 // Keep date/clock validation before any storage, but discard this projection.
 // The canonical date is frozen only after every storage readback succeeds.
 publicationMdx(p,now());
 const route=articleRoute(p.contentId);
 const approval={protocol:'xpotato-github-environment-publication-approval-v1',...context,semanticSha256:p.semanticSha256},approvalSha256=fingerprint(approval);
 const objects=publicationPackageObjects(p),outcomes=new Map<string,{action:'uploaded'|'reused';verifiedAt:string}>();
 const verify=async(o:PublishObject)=>{const r=await input.storage.read(o);if(r.status==='absent')throw Error('R2_OBJECT_ABSENT');assertObjectMatches(o,r);return r;};
 const store=async(o:PublishObject)=>{
  await input.progress?.({phase:'store',plane:o.plane,key:o.key,sha256:o.sha256});
  const action=input.mode==='verify-only'?(await verify(o),'reused' as const):await input.storage.putIfAbsent(o);
  await verify(o);outcomes.set(o.plane+':'+o.key,{action,verifiedAt:now().toISOString()});
  await input.progress?.({phase:'verified',plane:o.plane,key:o.key,sha256:o.sha256});
 };
 for(const o of objects.filter(o=>o.plane==='source'))await store(o);
 for(const o of objects.filter(o=>o.plane==='public')){await store(o);assertObjectMatches(o,await input.storage.readPublic(o));}
 const protectedObjects:PublishObject[]=[];
 for(const o of objects.filter(o=>o.plane==='public')){
  const actual=await verify(o);if(actual.status!=='found')throw Error('CI_PUBLICATION_PUBLIC_BYTES_REQUIRED');
  const copy:PublishObject={...o,plane:'protected',bytes:actual.bytes,cacheControl:'private, no-store'};await store(copy);protectedObjects.push(copy);
 }
 // All data is re-read before emitting any canonical files. A partial/unknown
 // operation produces no export; neither ETag nor hash-shaped keys are proof.
 for(const o of [...objects,...protectedObjects]){await input.progress?.({phase:'final_readback',plane:o.plane,key:o.key,sha256:o.sha256});await verify(o);}
 for(const o of objects.filter(o=>o.plane==='public'))assertObjectMatches(o,await input.storage.readPublic(o));
 // One export instant owns MDX dates and all completion/provenance timestamps.
 // Revalidate the clock here too: storage never authorizes a backwards date.
 const exportedAt=now(),mdx=publicationMdx(p,exportedAt),frontmatter=splitDraft(mdx).frontmatter,
  assets=p.registry.assets,at=exportedAt.toISOString(),publicationDay=publicationDayJst(exportedAt);
 const sources=assets.map(a=>{const s=a.canonicalSource!,key='source/v1/objects/sha256/'+s.sha256.slice(0,2)+'/'+s.sha256+'.'+s.format,o=outcomes.get('source:'+key)!;
  const record={schemaVersion:1,candidateSha256:p.semanticSha256,contentId:p.contentId,assetId:a.assetId,canonicalSha256:s.sha256,storageClass:s.storageClass,action:o.action,verifiedSizeBytes:s.sizeBytes,storedAt:o.verifiedAt};
  return canonicalSourceStorageReceiptSchema.parse({...record,receiptSha256:fingerprint(record)});});
 const publicationValue={schemaVersion:1,authorization:{kind:'article_job',jobId:p.evidence.jobId,candidateSha256:p.semanticSha256,humanApprovalRecordSha256:approvalSha256,
  canonicalSourceStorageReceiptSetSha256:fingerprint(sources),articleJobPublicMediaPermission:true},
  mediaSets:assets.map(a=>({assetId:a.assetId,rightsRef:a.rightsRef,variantManifestSha256:p.variantManifests.find(v=>v.assetId===a.assetId)!.sha256,
   objects:[a.delivery.master,...a.delivery.variants].map((o,i)=>({purpose:i?'variant':'master',sha256:o.sha256,objectKey:o.objectKey,format:o.format,...(i&&o.width?{width:o.width}:{}),
    contentType:o.format==='svg'?'image/svg+xml':'image/'+o.format,cacheControl:'public, max-age=31536000, immutable',verifiedSizeBytes:o.sizeBytes,...outcomes.get('public:'+o.objectKey)}))})),completedAt:at};
 const publication=mediaPublicationManifestSchema.parse({...publicationValue,manifestSha256:fingerprint(publicationValue)});
 const protectionValue={schemaVersion:1,candidateSha256:p.semanticSha256,approvalRecordSha256:approvalSha256,mediaPublicationManifestSha256:publication.manifestSha256,
  protectionClass:'cloudflare_protected_copy_v1',policyFingerprint:input.storage.configurationSha256,
  objects:protectedObjects.map(o=>({sha256:o.sha256,sourceObjectKey:o.key,verifiedSizeBytes:o.sizeBytes,protectedObjectRef:'site-protected-v1:sha256:'+o.sha256+':'+o.key.split('.').at(-1),protectedAt:outcomes.get('protected:'+o.key)!.verifiedAt})),completedAt:at};
 const protection=mediaProtectionReceiptSchema.parse({...protectionValue,receiptSha256:fingerprint(protectionValue)});
 const provenance=publicationProvenanceRecordSchema.parse({schemaVersion:1,contentId:p.contentId,origin:'article_job',content:{mdxSha256:sha256(mdx),frontmatterSha256:fingerprint(frontmatter),route,
   ...(p.revision?{updateDiffSha256:fingerprint({kind:p.revision.kind,previous:p.revision.previous,
    after:{mdxSha256:sha256(mdx),mediaSha256:fingerprint(p.registry),rightsSha256:fingerprint(p.rights)}})}:{})},
  ...(p.revision?{revision:p.revision}:{}),
  articleJob:{...p.evidence,candidateSha256:p.semanticSha256,approvalRecordSha256:approvalSha256,canonicalSourceStorageReceiptSetSha256:fingerprint(sources),
   mediaPublicationManifestSha256:publication.manifestSha256,mediaProtectionReceiptSha256:protection.receiptSha256},
  sourceRefs:p.sourceRefs,materialClaims:p.materialClaims,mediaSources:p.mediaSources,aiRuns:p.aiRuns,visualOrigins:[...new Set(assets.map(a=>a.origin))],
  mediaRecovery:deriveCompactMediaRecoveryBinding(publication,protection),exportedAt:at});
 assertCompactRegistryMedia({registry:p.registry,rights:p.rights,provenance});assertPublicPublicationMetadata({registry:p.registry,rights:p.rights,provenance});
 const after:Record<string,string>={[contentPath]:mdx,...Object.fromEntries([['media',p.registry],['media-rights',p.rights],['provenance',provenance]].map(([name,value])=>['apps/site/src/content-registry/'+name+'/blog/'+p.contentId+'.json',canonicalJson(value)+'\n']))};
 Object.assign(after,publicationRegistryIndexChanges({id:p.contentId,provenanceSha256:fingerprint(provenance),media:input.base['apps/site/src/content-registry/media/index.ts']!,
  rights:rightsBase,provenance:input.base['apps/site/src/content-registry/provenance/index.ts']!,redirects:null,routeChanged:false}));
 const changes:ExportChange[]=Object.entries(after).map(([path,text])=>({path,before:input.base[path]??null,after:text}));
 assertExportChanges(changes,Object.keys(after),input.base,'article-publication/'+p.contentId);
 const rollback=p.revision?{protocol:'xpotato-ci-publication-rollback-v1',contentId:p.contentId,previous:p.revision.previous,
  expectedPostimages:changes.map(c=>({path:c.path,sha256:sha256(c.after!)})),
  patch:exactExportPatch(changes.map(c=>({path:c.path,before:c.after,after:c.before})))}:undefined;
 return {protocol:'xpotato-ci-publication-result-v1',semanticSha256:p.semanticSha256,approval,configurationSha256:input.storage.configurationSha256,
  configurationEvidenceBasis:'owner-reviewed-configuration-v1',sources,publication,protection,provenance,changes,patch:exactExportPatch(changes),
  publicationDay,pubDate:frontmatter.pubDate,storageVerified:true,canonicalFilesApplied:false,articleDeployed:false,...(rollback?{rollback}:{})};
}
