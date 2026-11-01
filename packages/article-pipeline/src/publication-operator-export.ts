import {mkdir,rename,rm} from 'node:fs/promises';
import {join,dirname,resolve,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {assertArticleRoute} from '@xpotato/content-contracts';
import {assertCompactRegistryMedia} from '@xpotato/portable-content/compact-media';
import {privateDraftOutputErrors} from '@xpotato/portable-content/private-output';
import {publicationHeadSchema} from './publication-contracts.js';
import {readPublicationHead} from './publication-approval.js';
import {validateOperatorReceipts} from './operator-receipts.js';
import {publicationProvenance} from './publication-provenance.js';
import {operatorRegistryIndexChanges} from './publication-export-patch.js';
import {assertExportChanges,exactExportPatch,publicationFileSlug,verifyExportArtifact,type ExportChange} from './publication-export.js';
import {assertPublicationRights,assertPublicPublicationMetadata} from './publication-public-metadata.js';
import {verifyPublicationReadback} from './media-readback.js';
import {operatorPublicationReadback,type OneShotServerBindings} from './publication-operator-runtime.js';
import {isApprovedOperation} from './operator-capability.js';
import type {OneShotPublicationOperation} from './publication-operator-plan.js';
import {fingerprint,sha256,canonicalJson} from './canonical.js';
import {safeRead,immutable,noLinks,locked,inside,atomic} from './private-files.js';

export const verifyOperatorExport=(directory:string,hash:string)=>verifyExportArtifact(directory,hash,'operator');
/** Produces only a private, exact patch. It never applies changes, commits,
 * pushes, merges, dispatches a deployment or changes provider configuration.
 * There is deliberately no user JSON/CLI flag that supplies a trusted port.
 */
export async function exportOneShotOperatorCandidate(operation:OneShotPublicationOperation,bindings:OneShotServerBindings,signal?:AbortSignal){
 if(!isApprovedOperation(operation))throw Error('OPERATOR_APPROVED_EXECUTABLE_HANDLE_REQUIRED');
 const initial=await operation.readContext(signal);
 return locked(initial.directory,async()=>{
  const c=await operation.readContext(signal),head=await readPublicationHead(c),receipts=await validateOperatorReceipts(c,head);
  if(!['MEDIA_PROTECTED','EXPORTED'].includes(head.state)||!receipts.sources||!receipts.publication||!receipts.protection)
   throw Error('OPERATOR_COMPLETE_PROTECTION_REQUIRED');
  const port=await operatorPublicationReadback(operation,bindings,signal);
  const recheck=async()=>{
   signal?.throwIfAborted();await operation.readContext(signal);
   // This verifier independently checks every actual A/B/C byte, metadata,
   // protected reference, policy age and before/after policy identity. Its
   // generic supplied-port result is not itself treated as admission.
   await verifyPublicationReadback({registry:c.v.media!.registry,rights:c.v.plan!.rights,sources:receipts.sources!,
    publication:receipts.publication!,protection:receipts.protection!},port);
   signal?.throwIfAborted();await operation.readContext(signal);
  };
  await recheck();
  if(head.export){await verifyOperatorExport(join(c.folder,'exports',head.export),head.export);
   return {output:join(c.folder,'exports',head.export),exportSha256:head.export,state:'EXPORTED',reused:true,productionEligible:false as const};}
  const repo=c.v.repo,provenance=publicationProvenance(c,head,{sources:receipts.sources,publication:receipts.publication,protection:receipts.protection});
  const compact={registry:c.v.media!.registry,rights:c.v.plan!.rights,provenance};
  assertCompactRegistryMedia(compact);assertPublicationRights(compact.rights);assertPublicPublicationMetadata(compact);
  const id=c.materials.frontmatter.id,slug=publicationFileSlug(repo,id);assertArticleRoute(c.materials.route,id);
  const mediaPath='apps/site/src/content-registry/media/blog/'+id+'.json',rightsPath='apps/site/src/content-registry/media-rights/blog/'+id+'.json',
   provenancePath='apps/site/src/content-registry/provenance/blog/'+id+'.json',contentPath='apps/site/src/content/blog/'+slug+'.mdx';
  const after:Record<string,string|null>={[contentPath]:c.materials.mdx,[mediaPath]:canonicalJson(compact.registry)+'\n',
   [rightsPath]:canonicalJson(compact.rights)+'\n',[provenancePath]:canonicalJson(provenance)+'\n'};
  if(c.materials.redirects.length)after['apps/site/src/content-registry/article-redirects/'+id+'.json']=canonicalJson(c.materials.redirects)+'\n';
  if(c.v.c.store.original&&c.v.c.store.original.route!==c.materials.route&&repo.records.find(r=>r.contentId===id)?.slug!==slug){
   const old=/^\/blog\/([a-z0-9-]+)\/$/u.exec(c.v.c.store.original.route)?.[1];if(!old)throw Error('EXPORT_UPDATE_ROUTE_INVALID');
   after['apps/site/src/content/blog/'+old+'.mdx']=null;
  }
  const optionalRead=async(path:string)=>{try{return await safeRead(join(c.root,path));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;return null;}};
  const registryRead=async(path:string)=>repo.registrySnapshot[path]??await optionalRead(path);
  Object.assign(after,operatorRegistryIndexChanges({id,provenanceSha256:fingerprint(provenance),
   media:(await registryRead('apps/site/src/content-registry/media/index.ts'))!,provenance:(await registryRead('apps/site/src/content-registry/provenance/index.ts'))!,
   rights:await registryRead('apps/site/src/content-registry/media-rights/index.ts'),redirects:await registryRead('apps/site/src/content-registry/redirects.ts'),routeChanged:c.materials.redirects.length>0}));
  const base:Record<string,string|null>={},changes:ExportChange[]=[];
  for(const [path,text] of Object.entries(after)){
   const physical=await optionalRead(path),original=repo.records.find(r=>path==='apps/site/src/content/'+r.collection+'/'+r.slug+'.mdx');
   base[path]=repo.registrySnapshot[path]??original?.source??physical;
   if(base[path]!==physical)throw Error('EXPORT_BASE_CONFLICT');
   if(text!==null&&privateDraftOutputErrors(path,text).length)throw Error('OPERATOR_EXPORT_PRIVATE_OR_FIXTURE_LINEAGE_DENIED');
   changes.push({path,before:physical,after:text});
  }
  const branch=execFileSync('git',['symbolic-ref','--short','HEAD'],{cwd:c.root,encoding:'utf8',windowsHide:true}).trim();
  assertExportChanges(changes,Object.keys(after),base,branch);
  const patch=exactExportPatch(changes),files=changes.filter(x=>x.after!==null).map(x=>({path:x.path,sha256:sha256(x.after!),sizeBytes:Buffer.byteLength(x.after!)}));
  const body={protocol:'xpotato-operator-export-v1',productionEligible:false,isHumanApproval:true,candidateSha256:c.target,approvalSha256:head.approvalSha256,
   baseCommit:c.v.c.store.baseCommit,repositoryFingerprint:c.v.c.store.repositoryFingerprint,
   previous:c.v.c.store.original?{route:c.v.c.store.original.route,mdxSha256:c.v.c.store.original.sourceSha256,fileSlug:repo.records.find(r=>r.contentId===id)?.slug}:null,
   fileSlug:slug,contentId:id,route:c.materials.route,plannedSeo:c.materials.plannedSeo,files,changes,patchSha256:sha256(patch)};
  const manifest={...body,exportSha256:fingerprint(body)},parent=join(c.folder,'exports'),destination=join(parent,manifest.exportSha256);
  await noLinks(parent);await mkdir(parent,{recursive:true,mode:0o700});const staging=join(parent,'.staging-'+randomUUID());await mkdir(staging,{mode:0o700});
  for(const change of changes)if(change.after!==null){await mkdir(dirname(join(staging,'files',change.path)),{recursive:true,mode:0o700});await immutable(join(staging,'files',change.path),change.after);}
  await immutable(join(staging,'manifest.json'),canonicalJson(manifest)+'\n');await immutable(join(staging,'changes.patch'),patch);
  await immutable(join(staging,'.private-draft-preview'),'xpotato-private-draft-preview-v1\noperator export; review exact patch before application\n');
  await recheck();
  if(fingerprint(await readPublicationHead(await operation.readContext(signal)))!==fingerprint(head))throw Error('OPERATOR_HEAD_CHANGED');
  for(const change of changes)if(await optionalRead(change.path)!==base[change.path])throw Error('EXPORT_BASE_CONFLICT');
  try{await rename(staging,destination);}catch(error){
   if(!['EEXIST','ENOTEMPTY'].includes((error as NodeJS.ErrnoException).code??''))throw error;
   if(!inside(parent,resolve(staging))||!basename(staging).startsWith('.staging-'))throw Error('EXPORT_STAGING_DELETE_DENIED');
   await noLinks(staging);await rm(staging,{recursive:true});
  }
  await verifyOperatorExport(destination,manifest.exportSha256);
  await atomic(join(c.folder,'head.json'),canonicalJson(publicationHeadSchema.parse({...head,state:'EXPORTED',export:manifest.exportSha256}))+'\n');
  return {output:destination,exportSha256:manifest.exportSha256,state:'EXPORTED',reused:false,productionEligible:false as const};
 });
}
