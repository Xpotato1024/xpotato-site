import {readdir} from "node:fs/promises";
import {join} from "node:path";
import {stringify} from "yaml";
import {publicationCandidateManifestSchema,type CandidateBuildInput,type ArticleVisualPlan,type ArticleVisualMasters,type ArticleVisualMedia,type LocalVisualAudit} from "@xpotato/content-contracts";
import {articleMediaTargets} from "@xpotato/content-contracts/article-media-targets";
import {pathToFileURL} from "node:url";
import type {SeoOverride} from "@xpotato/content-contracts";
import {canonicalJson,fingerprint,sha256} from "./canonical.js";
import {splitDraft} from "./draft-job.js";
import type {contentReviewContext} from "./content-review.js";
import {loadReviewOutput,loadReviewPayload} from "./review-journal.js";
import {localFileManifest} from "./candidate-astro.js";
import {candidatePublicationDateBlockers} from "./candidate-policy.js";
import {validateCandidateMediaPlan} from "./visual-analysis.js";
import {fail,safeRead} from "./private-files.js";
export type CandidateSnapshot={directory:string;repositoryRoot:string;c:Awaited<ReturnType<typeof contentReviewContext>>;
 plan:ArticleVisualPlan;masters:ArticleVisualMasters;audit:LocalVisualAudit;media:ArticleVisualMedia};
const unique=(values:string[])=>[...new Set(values)].sort();
export async function candidateBuildFingerprint(repositoryRoot:string){
 const paths=["apps/site/public"];
 for(const parent of ["apps","packages"])for(const entry of await readdir(join(repositoryRoot,parent),{withFileTypes:true})){
  if(entry.name.startsWith("."))continue;
  if(entry.isSymbolicLink())fail("CANDIDATE_WORKSPACE_LINK_DENIED",3);
  if(!entry.isDirectory())continue;
  const path=parent+"/"+entry.name+"/src";
  try{await readdir(join(repositoryRoot,path));paths.push(path);}
  catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
 }
 const files=[];
 for(const path of paths)for(const item of await localFileManifest(join(repositoryRoot,path))){
  if(/\.(?:test|spec)\.[^.]+$/u.test(item.path)||item.path==="env.d.ts")continue;
  files.push({path:path+"/"+item.path,sha256:item.sha256});
 }
 for(const parent of ["apps","packages"]){
  for(const entry of await readdir(join(repositoryRoot,parent),{withFileTypes:true})){
   if(entry.name.startsWith("."))continue;
   if(entry.isSymbolicLink())fail("CANDIDATE_WORKSPACE_LINK_DENIED",3);
   if(!entry.isDirectory())continue;
   const path=parent+"/"+entry.name+"/package.json";
   try{files.push({path,sha256:sha256(await safeRead(join(repositoryRoot,path)))});}
   catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
  }
 }
 for(const path of ["package.json","package-lock.json","apps/site/astro.config.mjs","docs/migration/content-id-map-v1.json","scripts/article-repository.ts"]){
  files.push({path,sha256:sha256(await safeRead(join(repositoryRoot,path)))});
 }
 return fingerprint({profile:"private-candidate-shared-layout-v1",node:process.version,platform:process.platform,arch:process.arch,files:files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)});
}
export async function candidateMaterials(s:CandidateSnapshot,reference:boolean){
 const fm=splitDraft(s.c.status.input).frontmatter,analysis=await loadReviewOutput(s.c.journal,"analysis");
 const contentAudit=await loadReviewPayload(s.c.journal,"audit"),plan=validateCandidateMediaPlan(s.plan.visualInput.mediaPlan,s.plan.scope);
 const dateBlockers=candidatePublicationDateBlockers(fm.pubDate);
 const eligible=!dateBlockers.length&&!reference&&s.plan.scope==="human_local"&&s.audit.scope==="human_local"&&contentAudit.scope==="human_local"&&plan.confirmed;
 const blockers=[...(reference?["reference-preview-not-approval-candidate"]:[]),...(s.plan.scope==="synthetic_fixture"?["synthetic-fixture-not-real-review"]:[]),...plan.blockers,...dateBlockers];
 if(!reference&&dateBlockers.length)fail("CANDIDATE_PUBLICATION_DATE_FUTURE",3);
 if(!reference&&!eligible)fail("CANDIDATE_CONFIRMED_HUMAN_INPUTS_REQUIRED",3);
 const frontmatter={...fm,draft:false},mdx="---\n"+stringify(frontmatter,{lineWidth:0}).trimEnd()+"\n---\n"+analysis.compiled;
 const slug=s.c.store.spec.target.slugHint;if(!slug||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug))fail("CANDIDATE_ROUTE_INVALID");
 const route="/blog/"+slug+"/";
 if(s.c.store.original&&s.c.store.original.route!==route)fail("CANDIDATE_ROUTE_CHANGE_NOT_ADMITTED",3);
 const policyPath=(path:string)=>pathToFileURL(join(s.repositoryRoot,"apps/site/src/lib",path)).href;
 const {siteConfig}=await import(policyPath("site-config.ts")) as {siteConfig:{site:{canonicalOrigin:string}}};
 const {deriveContentSeo}=await import(policyPath("seo.ts")) as {deriveContentSeo:(input:{title:string;description:string;route:string;canonicalOrigin:string;seo?:SeoOverride|undefined})=>{title:string;description:string;canonical:string;noindex:boolean}};
 const seo=deriveContentSeo({title:frontmatter.title,description:frontmatter.description,route,canonicalOrigin:siteConfig.site.canonicalOrigin,seo:frontmatter.seo});
 for(const value of [seo.canonical]){
  const url=new URL(value);if(url.protocol!=="https:"||url.username||url.password||url.hash)fail("CANDIDATE_SEO_URL_UNSAFE");
 }
 const social=s.media.registry.assets.find(item=>item.role==="social_card")!,socialMaster=social.delivery.master;
 const plannedSeo:CandidateBuildInput["plannedSeo"]={canonical:seo.canonical,image:plan.confirmed&&!seo.noindex?
  {url:articleMediaTargets.publicOrigin+"/"+socialMaster.objectKey,width:socialMaster.width!,height:socialMaster.height!,
   ...(social.decorative?{}:{alt:social.defaultAlt})}:null};
 const sourceEntries=s.media.registry.assets.map(asset=>({assetId:asset.assetId,storageClass:"private_canonical_media_v1",
  sha256:asset.canonicalSource!.sha256,sizeBytes:asset.canonicalSource!.sizeBytes,
  objectKey:"source/v1/objects/sha256/"+asset.canonicalSource!.sha256.slice(0,2)+"/"+asset.canonicalSource!.sha256+"."+asset.canonicalSource!.format}));
 const publicEntries=s.media.registry.assets.flatMap(asset=>[asset.delivery.master,...asset.delivery.variants].map(object=>({
  assetId:asset.assetId,rightsRef:asset.rightsRef,...object,contentType:"image/"+(object.format==="svg"?"svg+xml":object.format),
  url:articleMediaTargets.publicOrigin+"/"+object.objectKey,cacheControl:articleMediaTargets.public.cacheControl})));
 const sourceObjects=[...new Map(sourceEntries.map(item=>[item.objectKey,{...item,assetIds:sourceEntries.filter(ref=>ref.objectKey===item.objectKey).map(ref=>ref.assetId).sort()}])).values()].map(({assetId,...item})=>item).sort((a,b)=>a.objectKey.localeCompare(b.objectKey));
 const publicObjects=[...new Map(publicEntries.map(item=>[item.objectKey,{...item,assetIds:unique(publicEntries.filter(ref=>ref.objectKey===item.objectKey).map(ref=>ref.assetId)),rightsRefs:unique(publicEntries.filter(ref=>ref.objectKey===item.objectKey).map(ref=>ref.rightsRef))}])).values()].map(({assetId,rightsRef,...item})=>item).sort((a,b)=>a.objectKey.localeCompare(b.objectKey));
 const storagePlan={profile:articleMediaTargets,confirmation:s.plan.visualInput.mediaPlan,confirmed:plan.confirmed,
  sourceObjects,publicObjects,protectedObjects:publicObjects.map(({sha256,objectKey,sizeBytes})=>({sha256,objectKey,sizeBytes})),
  providerConnected:false,sourceStored:false,published:false,protected:false};
 const before=s.c.store.original?await safeRead(join(s.directory,"base/original.md")):null;
 const updateDiff=before===null?null:{schemaVersion:1,beforeSha256:sha256(before),afterSha256:sha256(mdx),before,after:mdx};
 const provenanceProposal={schemaVersion:1,contentId:frontmatter.id,content:{mdxSha256:sha256(mdx),frontmatterSha256:fingerprint(frontmatter),route},
  sourceRefs:analysis.sourceRefs,materialClaims:analysis.materialClaims,mediaSources:s.media.registry.assets.map(asset=>({assetId:asset.assetId,canonicalSha256:asset.canonicalSource!.sha256,format:asset.canonicalSource!.format,ingestProfileId:asset.canonicalSource!.ingestProfileId,ingestProfileSha256:asset.canonicalSource!.ingestProfileSha256,storageClass:asset.canonicalSource!.storageClass,...(asset.canonicalSource!.width?{width:asset.canonicalSource!.width}:{}),...(asset.canonicalSource!.height?{height:asset.canonicalSource!.height}:{})})),
  rightsSha256:fingerprint(s.plan.rights),visualAuditSha256:fingerprint(s.audit),sourcePlanSha256:fingerprint({profile:articleMediaTargets.source,objects:sourceObjects,confirmation:s.plan.visualInput.mediaPlan}),
  publicationPlanSha256:fingerprint(storagePlan),postApprovalReceiptsRequired:true};
 const registry=JSON.parse(await safeRead(join(s.directory,"base/registries.json"))) as Record<string,string>;
 const part=(name:string)=>{
  const entries=Object.entries(registry).filter(([path])=>path.includes("/"+name));if(!entries.length)fail("CANDIDATE_REGISTRY_SNAPSHOT_MISSING",3);
  return fingerprint(Object.fromEntries(entries));
 };
 const buildConfigFingerprint=fingerprint({source:await candidateBuildFingerprint(s.repositoryRoot),mode:reference?"reference":"candidate"});
 const projection={schemaVersion:1,protocol:"xpotato-private-candidate-input-v1",...s.c.binding,scope:s.plan.scope,reference,
  readinessBlockers:blockers,mdxSha256:sha256(mdx),reviewHeadSha256:fingerprint(s.c.journal.head),visualPlanSha256:s.plan.planSha256,
  mastersSha256:s.masters.mastersSha256,visualAuditSha256:fingerprint(s.audit),mediaSha256:s.media.mediaSha256,
  storagePlanSha256:fingerprint(storagePlan),provenanceProposalSha256:fingerprint(provenanceProposal),buildConfigFingerprint};
 const candidateInputSha256=fingerprint(projection);
 const manifestBase={schemaVersion:1,candidateId:"candidate-"+candidateInputSha256,jobId:s.c.store.jobId,jobFingerprint:s.c.store.jobFingerprint,
  baseRepositoryCommit:s.c.store.baseCommit,article:{contentId:frontmatter.id,mdxSha256:sha256(mdx),frontmatterSha256:fingerprint(frontmatter),route,collection:"blog",
   ...(updateDiff?{updateDiffSha256:fingerprint(updateDiff)}:{})},
  evidence:{sourceBundleSha256:analysis.sourceBundleSha256,evidenceBundleSha256:analysis.evidenceBundleSha256,claimLedgerSha256:fingerprint(analysis.bundle.claims),
   durableClaimLedgerProposalSha256:fingerprint({sourceRefs:analysis.sourceRefs,materialClaims:analysis.materialClaims}),
   citationCompilationSha256:analysis.citationCompilationSha256,technicalExampleVerificationSha256:fingerprint(analysis.examples),contentAuditSha256:fingerprint(contentAudit)},
  visual:{visualPlanSetSha256:fingerprint(s.plan.visualPlan),visualAuditManifestSha256:fingerprint(s.audit),
   heroAssetId:s.media.registry.assets.find(item=>item.role==="hero")!.assetId,socialCardAssetId:social.assetId},
  media:{mediaSetManifestSha256:s.media.mediaSha256,canonicalSourceSha256s:unique(s.masters.assets.map(item=>item.ingest.canonicalMaster.sha256)),
   ingestProfileSha256s:unique(s.masters.assets.map(item=>item.ingest.processing.profileSha256)),
   variantManifestSha256s:unique(s.media.variants.map(item=>item.manifestSha256)),deliveryProfileSha256s:unique(s.media.variants.map(item=>item.profileSha256)),
   canonicalSourceStoragePlanSha256:provenanceProposal.sourcePlanSha256,mediaPublicationPlanSha256:fingerprint(storagePlan),mediaRegistryProposalSha256:fingerprint(s.media.registry)},
  provenanceProposalSha256:fingerprint(provenanceProposal),taxonomyRegistrySha256:part("taxonomy"),contentModuleRegistrySha256:part("content-modules"),interactiveModuleRegistrySha256:part("interactive"),buildConfigFingerprint,
  validation:{schema:"pass",citations:"pass",examples:"pass",durableClaimLedger:"pass",mediaVariants:"pass",build:"pass",seo:"pass",accessibility:"manual_required",performance:"not_run"}};
 const candidate=publicationCandidateManifestSchema.parse({...manifestBase,candidateSha256:fingerprint(manifestBase)});
 return {reference,eligible,blockers,frontmatter,mdx,route,seo,plannedSeo,analysis,contentAudit,storagePlan,updateDiff,provenanceProposal,projection,candidateInputSha256,candidate};
}
