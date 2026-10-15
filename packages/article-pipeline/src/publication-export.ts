import {mkdir,rename} from "node:fs/promises";
import {join,dirname} from "node:path";
import {randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import {publicationProvenanceRecordSchema} from "@xpotato/content-contracts";
import {assertMockCompactRegistryMedia} from "@xpotato/portable-content/compact-media";
import {privateDraftOutputErrors} from "@xpotato/portable-content/private-output";
import type {DraftRepository} from "./draft-job.js";
import {publicationCandidate,readPublicationHead} from "./publication-approval.js";
import {validateMockReceipts,verifyMockStoredObjects} from "./publication-persistence.js";
import type {PublicationPort} from "./publication-contracts.js";
import {deriveCompactMediaRecoveryBinding} from "./media-persistence.js";
import {currentExternalAiPolicyBinding,containsHardDenyMaterial} from "./disclosure.js";
import {canonicalJson,fingerprint,sha256} from "./canonical.js";
import {localFileManifest} from "./candidate-astro.js";
import {safeRead,immutable,noLinks,locked,fail,atomic} from "./private-files.js";

export type ExportChange={path:string;before:string|null;after:string|null};
export function assertExportChanges(changes:ExportChange[],expectedPaths:readonly string[],base:Readonly<Record<string,string|null>>,branch:string){
 if(!branch||branch==="main"||branch==="master"||branch==="HEAD")fail("EXPORT_FEATURE_BRANCH_REQUIRED",3);
 const actual=changes.map(change=>change.path).sort();
 if(new Set(actual).size!==actual.length||fingerprint(actual)!==fingerprint([...expectedPaths].sort()))fail("EXPORT_EXACT_PATH_SET_REQUIRED",3);
 for(const change of changes){
  if(!/^apps\/site\/src\/(?:content\/blog|content-registry)\/[a-zA-Z0-9_./-]+$/u.test(change.path)
   ||change.path.split("/").includes("..")||!(change.path in base)||base[change.path]!==change.before)fail("EXPORT_BASE_CONFLICT",3);
 }
}
export function exactExportPatch(changes:readonly ExportChange[]){
 const body=(text:string|null,prefix:string)=>text===null?"":text.replace(/\n$/u,"").split("\n").map(line=>prefix+line+"\n").join("")+(text.endsWith("\n")?"":"\\ No newline at end of file\n");
 return [...changes].sort((a,b)=>a.path<b.path?-1:1).map(change=>{
  const oldLines=change.before===null?0:change.before.replace(/\n$/u,"").split("\n").length;
  const newLines=change.after===null?0:change.after.replace(/\n$/u,"").split("\n").length;
  return "diff --git a/"+change.path+" b/"+change.path+"\n"
   +(change.before===null?"new file mode 100644\n":change.after===null?"deleted file mode 100644\n":"")
   +"--- "+(change.before===null?"/dev/null":"a/"+change.path)+"\n+++ "+(change.after===null?"/dev/null":"b/"+change.path)+"\n"
   +"@@ -"+(oldLines?"1,"+oldLines:"0,0")+" +"+(newLines?"1,"+newLines:"0,0")+" @@\n"+body(change.before,"-")+body(change.after,"+");
 }).join("");
}
const mockWrap=(record:unknown)=>({protocol:"xpotato-private-mock-export-v1",mode:"mock",productionEligible:false,record});
export const exportMockCandidate=(directory:string,repo:DraftRepository,root:string,target:string,port:PublicationPort)=>
 locked(directory,async()=>{
  const c=await publicationCandidate(directory,repo,root,target,"mock"),head=await readPublicationHead(c);
  if(!c.v.c.store.spec.permissions.repositoryExport)fail("REPOSITORY_EXPORT_PERMISSION_REQUIRED",3);
  if(!["MEDIA_PROTECTED","EXPORTED"].includes(head.state))fail("PROTECTION_REQUIRED_BEFORE_EXPORT",3);
  const receipts=await validateMockReceipts(c,head);await verifyMockStoredObjects(c,head,port);
  if(!receipts.sources||!receipts.publication||!receipts.protection)fail("EXPORT_RECEIPT_CHAIN_INCOMPLETE",3);
  const candidate=c.artifact.candidate,proposal=c.materials.provenanceProposal;
  const provenance=publicationProvenanceRecordSchema.parse({schemaVersion:1,contentId:c.materials.frontmatter.id,origin:"article_job",
   content:proposal.content,articleJob:{jobId:c.v.c.store.jobId,candidateSha256:target,approvalRecordSha256:head.approvalSha256,
    sourceBundleSha256:candidate.evidence.sourceBundleSha256,evidenceBundleSha256:candidate.evidence.evidenceBundleSha256,
    citationCompilationSha256:candidate.evidence.citationCompilationSha256,technicalExampleVerificationSha256:candidate.evidence.technicalExampleVerificationSha256,
    contentAuditSha256:candidate.evidence.contentAuditSha256,visualAuditSha256:candidate.visual.visualAuditManifestSha256,
    externalAiPolicyId:currentExternalAiPolicyBinding.policyId,externalAiPolicySha256:currentExternalAiPolicyBinding.policySha256,
    canonicalSourceStorageReceiptSetSha256:fingerprint(receipts.sources),mediaPublicationManifestSha256:receipts.publication.manifestSha256,
    mediaProtectionReceiptSha256:receipts.protection.receiptSha256},
   sourceRefs:proposal.sourceRefs,materialClaims:proposal.materialClaims,mediaSources:proposal.mediaSources,
   mediaRecovery:deriveCompactMediaRecoveryBinding(receipts.publication,receipts.protection),aiRuns:[],
   visualOrigins:[...new Set(c.v.media!.registry.assets.map(asset=>asset.origin))],exportedAt:receipts.protection.completedAt});
  const compact={protocol:"xpotato-private-mock-export-v1" as const,productionEligible:false as const,
   registry:c.v.media!.registry,provenance,rights:c.v.plan!.rights};
  assertMockCompactRegistryMedia(compact);
  if(containsHardDenyMaterial(Buffer.from(canonicalJson(provenance)))||/(?:[A-Za-z]:[\\/]|\/(?:home|Users|mnt|tmp)\/)/u.test(canonicalJson(provenance)))
   fail("EXPORT_PRIVATE_OR_SECRET_LINEAGE_DENIED",3);
  const id=c.materials.frontmatter.id,slug=/^\/blog\/([a-z0-9-]+)\/$/u.exec(c.materials.route)![1]!;
  const mediaPath="apps/site/src/content-registry/media/blog/"+id+".json",rightsPath="apps/site/src/content-registry/media-rights/blog/"+id+".json";
  const provenancePath="apps/site/src/content-registry/provenance/blog/"+id+".json",contentPath="apps/site/src/content/blog/"+slug+".mdx";
  const after:Record<string,string|null>={[contentPath]:c.materials.mdx,[mediaPath]:canonicalJson(mockWrap(compact.registry))+"\n",
   [rightsPath]:canonicalJson(mockWrap(compact.rights))+"\n",[provenancePath]:canonicalJson(mockWrap(provenance))+"\n"};
  // The mock package is deliberately rejected by production validators, even if its envelope is removed.
  if(!privateDraftOutputErrors(provenancePath,canonicalJson(provenance)).length)fail("MOCK_LINEAGE_RELEASE_GUARD_REQUIRED",3);
  if(c.materials.redirects.length)after["apps/site/src/content-registry/article-redirects/"+id+".json"]=canonicalJson(mockWrap(c.materials.redirects))+"\n";
  if(c.v.c.store.original&&c.v.c.store.original.route!==c.materials.route){
   const oldSlug=/^\/blog\/([a-z0-9-]+)\/$/u.exec(c.v.c.store.original.route)?.[1];if(!oldSlug)fail("EXPORT_UPDATE_ROUTE_INVALID",3);
   after["apps/site/src/content/blog/"+oldSlug+".mdx"]=null;
  }
  for(const path of ["apps/site/src/content-registry/media/index.ts","apps/site/src/content-registry/provenance/index.ts"]){
   const prior=await safeRead(join(root,path));
   const imported=path.includes("/media/")?mediaPath:provenancePath;
   after[path]='throw new Error("MOCK_EXPORT_NOT_FOR_NORMAL_BUILD");\n'+prior
    +'\n// xpotato-private-draft-preview-v1; simulation import only\n'
    +'import mockRecord from "./blog/'+id+'.json";\nexport const mockExportRecord = mockRecord;\n';
  }
  const base:Record<string,string|null>={},changes:ExportChange[]=[];
  for(const [path,text] of Object.entries(after)){
   try{base[path]=await safeRead(join(root,path));}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;base[path]=null;}
   changes.push({path,before:base[path]!,after:text});
  }
  const branch=execFileSync("git",["symbolic-ref","--short","HEAD"],{cwd:root,encoding:"utf8"}).trim();
  assertExportChanges(changes,Object.keys(after),base,branch);
  const patch=exactExportPatch(changes),files=changes.filter(change=>change.after!==null).map(change=>({path:change.path,sha256:sha256(change.after!),sizeBytes:Buffer.byteLength(change.after!)}));
  const unsigned={protocol:"xpotato-private-mock-export-v1",productionEligible:false,isHumanApproval:false,candidateSha256:target,
   approvalSha256:head.approvalSha256,baseCommit:c.v.c.store.baseCommit,repositoryFingerprint:c.v.c.store.repositoryFingerprint,
   contentId:id,route:c.materials.route,plannedSeo:c.materials.plannedSeo,files,changes,patchSha256:sha256(patch)};
  const manifest={...unsigned,exportSha256:fingerprint(unsigned)};
  const parent=join(c.folder,"exports"),destination=join(parent,manifest.exportSha256);
  await noLinks(parent);await mkdir(parent,{recursive:true,mode:0o700});
  const staging=join(parent,".staging-"+randomUUID());await mkdir(staging,{mode:0o700});
  for(const change of changes)if(change.after!==null){await mkdir(dirname(join(staging,"files",change.path)),{recursive:true,mode:0o700});await immutable(join(staging,"files",change.path),change.after);}
  await immutable(join(staging,"changes.patch"),patch);await immutable(join(staging,"manifest.json"),canonicalJson(manifest)+"\n");
  await immutable(join(staging,".private-draft-preview"),"xpotato-private-draft-preview-v1\nmock export; never apply to live repository\n");
  await publicationCandidate(directory,repo,root,target,"mock");
  for(const change of changes){let current:string|null=null;try{current=await safeRead(join(root,change.path));}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
   if(current!==change.before)fail("EXPORT_BASE_CONFLICT",3);}
  try{await rename(staging,destination);}catch(error){if(!["ENOTEMPTY","EEXIST"].includes((error as NodeJS.ErrnoException).code??""))throw error;}
  await verifyMockExport(destination,manifest.exportSha256);
  await atomic(join(c.folder,"head.json"),canonicalJson({...head,state:"EXPORTED",export:manifest.exportSha256})+"\n");
  return {output:destination,exportSha256:manifest.exportSha256,state:"MOCK_EXPORTED",simulation:true,productionEligible:false,isHumanApproval:false};
 });
export async function verifyMockExport(directory:string,expectedSha256:string){
 const manifest=JSON.parse(await safeRead(join(directory,"manifest.json"))),{exportSha256,...unsigned}=manifest;
 if(exportSha256!==expectedSha256||fingerprint(unsigned)!==expectedSha256||manifest.protocol!=="xpotato-private-mock-export-v1"||manifest.productionEligible!==false)
  fail("MOCK_EXPORT_MANIFEST_INVALID",3);
 const tree=await localFileManifest(directory);
 const expected=[".private-draft-preview","manifest.json","changes.patch",...manifest.files.map((file:{path:string})=>"files/"+file.path)].sort();
 if(fingerprint(tree.map(file=>file.path))!==fingerprint(expected))fail("EXPORT_FILE_SET_MISMATCH",3);
 for(const file of manifest.files)if(!/^apps\/site\/src\/(?:content\/blog|content-registry)\/[a-zA-Z0-9_./-]+$/u.test(file.path)||file.path.split("/").includes(".."))fail("EXPORT_PATH_INVALID",3);
 for(const file of manifest.files)if(sha256(await safeRead(join(directory,"files",file.path)))!==file.sha256)fail("EXPORT_FILE_HASH_MISMATCH",3);
 if(sha256(await safeRead(join(directory,"changes.patch")))!==manifest.patchSha256)fail("EXPORT_PATCH_HASH_MISMATCH",3);
 return manifest;
}
