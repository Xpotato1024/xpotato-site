import {mkdtemp,mkdir} from "node:fs/promises";
import {join} from "node:path";
import {contentMediaRegistrySchema,mediaRightsRecordSchema,publicationProvenanceRecordSchema} from "@xpotato/content-contracts";
import {assertMockCompactRegistryMedia} from "@xpotato/portable-content/compact-media";
import {reviewTree} from "@xpotato/portable-content/review";
import {verifyMockExport} from "./publication-export.js";
import {splitDraft} from "./draft-job.js";
import {buildPrivateCandidateAstro,removeOwnedCandidateTemp} from "./candidate-astro.js";
import type {PublicationPort} from "./publication-contracts.js";
import {safeRead,immutableBytes,fail} from "./private-files.js";
import {fingerprint,sha256} from "./canonical.js";

export async function readMockExportData(folder:string,expectedSha256:string){
 const manifest=await verifyMockExport(folder,expectedSha256),id=manifest.contentId as string;
 const read=async(path:string)=>{
  const envelope=JSON.parse(await safeRead(join(folder,"files",path)));
  if(envelope.protocol!=="xpotato-private-mock-export-v1"||envelope.mode!=="mock"||envelope.productionEligible!==false)
   fail("MOCK_EXPORT_RECORD_SCOPE_INVALID",3);
  return envelope.record;
 };
 const registry=contentMediaRegistrySchema.parse(await read("apps/site/src/content-registry/media/blog/"+id+".json"));
 const rightsInput=await read("apps/site/src/content-registry/media-rights/blog/"+id+".json");
 if(!Array.isArray(rightsInput))fail("EXPORT_RIGHTS_SET_INVALID",3);
 const rights=rightsInput.map(record=>mediaRightsRecordSchema.parse(record));
 const provenance=publicationProvenanceRecordSchema.parse(await read("apps/site/src/content-registry/provenance/blog/"+id+".json"));
 const slug=/^\/blog\/([a-z0-9-]+)\/$/u.exec(manifest.route)?.[1];if(!slug)fail("EXPORT_ROUTE_INVALID",3);
 const mdx=await safeRead(join(folder,"files/apps/site/src/content/blog",slug+".mdx")),parsed=splitDraft(mdx);
 if(parsed.frontmatter.id!==id||parsed.frontmatter.draft||sha256(mdx)!==provenance.content.mdxSha256
  ||fingerprint(parsed.frontmatter)!==provenance.content.frontmatterSha256||provenance.content.route!==manifest.route
  ||provenance.articleJob?.candidateSha256!==manifest.candidateSha256||provenance.articleJob?.approvalRecordSha256!==manifest.approvalSha256)
  fail("EXPORT_CONTENT_PROVENANCE_BINDING_INVALID",3);
 assertMockCompactRegistryMedia({protocol:"xpotato-private-mock-export-v1",productionEligible:false,registry,rights,provenance});
 const tree=reviewTree(parsed.body),sourceIds=new Set(provenance.sourceRefs.map(source=>source.sourceId));
 if(sourceIds.size!==provenance.sourceRefs.length||new Set(provenance.materialClaims.map(claim=>claim.claimId)).size!==provenance.materialClaims.length)
  fail("EXPORT_CLAIM_OR_SOURCE_DUPLICATE",3);
 for(const claim of provenance.materialClaims){
  const block=tree.children?.[claim.locator.blockIndex??-1];
  if(!block)fail("EXPORT_CLAIM_LOCATOR_MISSING",3);
  const raw=parsed.body.slice(block.position?.start.offset,block.position?.end.offset);
  if(claim.claimType!=="limitation"&&!claim.evidence.length)fail("EXPORT_CLAIM_SUPPORT_MISSING",3);
  for(const evidence of claim.evidence)if(!evidence.sourceIds.length||evidence.sourceIds.some(id=>!sourceIds.has(id))
   ||sha256(evidence.propositionSummary)!==claim.statementSha256||!raw.includes(evidence.propositionSummary))
   fail("EXPORT_COMPACT_CLAIM_BINDING_INVALID",3);
 }
 return {manifest,registry,rights,provenance,mdx,frontmatter:parsed.frontmatter};
}
// Fresh private fixture: only exported compact records + durable mock recovery objects. No Article Job argument/read.
export async function renderMockExportAfterJobRemoval(repositoryRoot:string,folder:string,expectedSha256:string,port:PublicationPort){
 const data=await readMockExportData(folder,expectedSha256),base=join(repositoryRoot,".local/article-publication-cleanup-render");
 await mkdir(base,{recursive:true,mode:0o700});const mediaFolder=await mkdtemp(join(base,"fixture-"));
 const localObjects=[];
 for(const object of data.provenance.mediaRecovery!.objects){
  const recovered=await port.read("protected",object.publicObjectKey);
  if(recovered.status!=="found"||recovered.object.protectedRef!==object.protectedObjectRef
   ||recovered.object.policySha256!==data.provenance.mediaRecovery!.policyFingerprint
   ||sha256(recovered.object.bytes)!==object.sha256||recovered.object.bytes.length!==object.verifiedSizeBytes)
   fail("MOCK_DURABLE_RECOVERY_READBACK_INVALID",3);
  const path=object.sha256+".bin";await immutableBytes(join(mediaFolder,path),recovered.object.bytes);
  localObjects.push({sha256:object.sha256,path,contentType:recovered.object.contentType});
 }
 const built=await buildPrivateCandidateAstro({repositoryRoot,contentId:data.frontmatter.id,route:data.manifest.route,mdx:data.mdx,
  candidateInputSha256:data.manifest.candidateSha256,scope:"synthetic_fixture",reference:true,planConfirmed:false,
  plannedSeo:data.manifest.plannedSeo,mediaFolder,media:{registry:data.registry,localObjects}});
 if(!built.html.includes("data-media-asset")||!built.html.includes("xpotato-private-draft-preview-v1"))fail("MOCK_CLEANUP_RENDER_INVALID",3);
 const result={contentId:data.frontmatter.id,route:data.manifest.route,htmlSha256:sha256(built.html),
  outputTreeSha256:built.outputTreeSha256,privateBuildCount:1,normalBuildCount:0,productionEligible:false};
 await removeOwnedCandidateTemp(built.root,repositoryRoot);return result;
}
