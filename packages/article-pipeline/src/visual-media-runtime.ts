import {mkdir,readFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {mediaIngestResultSchema,mediaObjectRefSchema,contentMediaRegistrySchema,articleVisualMastersSchema,articleVisualMediaSchema,
 type ArticleVisualPlan,type ArticleVisualMasters,type ArticleVisualMedia,type LocalVisualAudit} from "@xpotato/content-contracts";
import {deterministicCover,SharpCanonicalMediaProcessor,SharpDeliveryVariantGenerator,generatePublicDeliveryMaster,
 canonicalRasterProfile,getMediaVariantProfileBinding,sharpToolchainSha256,inspectRasterBytes,type LocalDeliveryObject} from "@xpotato/media-ingest";
import {fingerprint,sha256} from "./canonical.js";
import {fail,noLinks,safeReadBytes,immutableBytes} from "./private-files.js";
import {validateCandidateRegistry} from "./visual-analysis.js";

const sourcePath=(directory:string,path:string)=>{
 if(!/^source-media\/[a-zA-Z0-9][a-zA-Z0-9_.-]*\.(?:png|jpe?g|webp)$/u.test(path))fail("VISUAL_SOURCE_PATH_DENIED");
 return join(directory,path);
};
export async function verifyVisualSourceInputs(directory:string,plan:ArticleVisualPlan){
 const inputs=[...(plan.visualInput.hero.kind==="local_raster"?[plan.visualInput.hero]:[]),...plan.visualInput.inline];
 for(const item of inputs)if(sha256(await safeReadBytes(sourcePath(directory,item.path)))!==item.sha256)fail("VISUAL_SOURCE_CHANGED",3);
}
export async function coverForPlan(repositoryRoot:string,frontmatter:{title:string;pubDate:string},categoryLabel:string){
 return deterministicCover({repositoryRoot,title:frontmatter.title,categoryLabel,pubDate:frontmatter.pubDate});
}
export async function materializeVisualMasters(directory:string,folder:string,plan:ArticleVisualPlan,cover:Awaited<ReturnType<typeof coverForPlan>>){
 if(fingerprint(cover.binding)!==plan.generatorBindingSha256)fail("VISUAL_GENERATOR_CHANGED",3);
 await verifyVisualSourceInputs(directory,plan);await noLinks(folder);
 await mkdir(join(folder,"generated"),{recursive:true,mode:0o700});
 const processor=new SharpCanonicalMediaProcessor("masters",folder),assets:ArticleVisualMasters["assets"]=[];
 for(const visual of plan.visualPlan.plans){
  const source=visual.role==="hero"&&plan.visualInput.hero.kind==="local_raster"?plan.visualInput.hero:plan.visualInput.inline.find(item=>item.assetId===visual.visualId);
  const bytes=source?await safeReadBytes(sourcePath(directory,source.path)):visual.role==="social_card"?cover.social:cover.hero;
  const relative="generated/"+sha256(bytes)+(source?"."+source.path.split(".").at(-1):".svg");
  if(source){
   const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
   const webp=bytes.subarray(0,4).toString()==="RIFF"&&bytes.subarray(8,12).toString()==="WEBP";
   if(!png&&!jpeg&&!webp)fail("VISUAL_SOURCE_FORMAT_DENIED");
   const meta=await inspectRasterBytes(bytes);
   if(!["jpeg","png","webp"].includes(meta.format??"")||!meta.width||!meta.height||(meta.pages??1)>1)fail("VISUAL_SOURCE_FORMAT_DENIED");
  }
  await immutableBytes(join(folder,relative),bytes);
  await noLinks(join(folder,"masters",plan.visualPlan.contentId,visual.visualId));
  const ingest=await processor.ingest({schemaVersion:1,sourcePath:join(folder,relative),
   target:{contentId:plan.visualPlan.contentId,semanticAssetId:visual.visualId},kind:source?(source.origin==="camera"?"photo":source.origin):"diagram",profileId:canonicalRasterProfile.id,overwrite:false});
  const role=visual.role;if(role!=="hero"&&role!=="social_card"&&role!=="inline")fail("VISUAL_ROLE_UNSUPPORTED");
  assets.push({assetId:visual.visualId,role,origin:source?source.origin:"deterministic_cover",alt:visual.altIntent,
   decorative:visual.decorative,rightsRef:source?.rights.rightsId??"generated-cover-rights",ingest});
 }
 const payload={schemaVersion:1 as const,protocol:"xpotato-private-visual-masters-v1" as const,planSha256:plan.planSha256,
  derivationSha256:fingerprint({generator:cover.derivationSha256,hero:assets.find(item=>item.role==="hero")!.ingest.canonicalMaster.sha256}),assets};
 const masters=articleVisualMastersSchema.parse({...payload,mastersSha256:fingerprint(payload)});
 await verifyVisualMediaBytes(folder,masters);return masters;
}
export async function prepareVisualDelivery(folder:string,plan:ArticleVisualPlan,masters:ArticleVisualMasters,audit:LocalVisualAudit){
 await verifyVisualMediaBytes(folder,masters);
 if(audit.conclusion!=="pass")fail("VISUAL_AUDIT_PREREQUISITES_MISSING",3);
 const variantGenerator=new SharpDeliveryVariantGenerator("variants",folder),variants:ArticleVisualMedia["variants"]=[],assets=[],localObjects:ArticleVisualMedia["localObjects"]=[];
 const object=(value:LocalDeliveryObject)=>{
  const ext=value.format==="jpeg"?"jpg":value.format;
  const ref=mediaObjectRefSchema.parse({sha256:value.sha256,objectKey:"media/v1/objects/sha256/"+value.sha256.slice(0,2)+"/"+value.sha256+"."+ext,
   format:value.format,width:value.width,height:value.height,sizeBytes:value.sizeBytes});
  if(!localObjects.some(item=>item.sha256===value.sha256))localObjects.push({sha256:value.sha256,path:value.privateRelativePath,contentType:value.contentType});
  return ref;
 };
 for(const master of masters.assets){
  const profileId=master.role==="social_card"?"social-card-v1":master.origin==="screenshot"||master.origin==="diagram"?"screenshot-ui-v1":master.role==="hero"?"photo-hero-v1":"photo-inline-v1";
  const binding=getMediaVariantProfileBinding(profileId);
  await noLinks(join(folder,"variants",plan.visualPlan.contentId,master.assetId));await noLinks(join(folder,"public-master","public",master.assetId));
  const manifest=await variantGenerator.generate({contentId:plan.visualPlan.contentId,ingestResult:master.ingest,...binding});
  const deliveryMaster=await generatePublicDeliveryMaster(master.ingest,profileId,"public-master",folder);
  variants.push(manifest);const ingest=master.ingest;
  assets.push({assetId:master.assetId,role:master.role,origin:master.origin,status:"active",defaultAlt:master.alt,decorative:master.decorative,
   rightsRef:master.rightsRef,provenanceRef:"visual-"+plan.planSha256,visualAuditRef:"audit-"+audit.records.find(item=>item.visualId===master.assetId)!.auditSha256,
   canonicalSource:{storageClass:"private_canonical_media_v1",sha256:ingest.canonicalMaster.sha256,format:ingest.canonicalMaster.format,
    width:ingest.canonicalMaster.width,height:ingest.canonicalMaster.height,sizeBytes:ingest.canonicalMaster.sizeBytes,
    ingestProfileId:ingest.processing.profileId,ingestProfileSha256:ingest.processing.profileSha256},
   delivery:{mode:master.role==="social_card"?"fixed":"responsive",...binding,master:object(deliveryMaster),
    variants:manifest.variants.map(item=>object(item as LocalDeliveryObject))}});
 }
 const payload={schemaVersion:1 as const,protocol:"xpotato-private-candidate-media-v1" as const,
  planSha256:plan.planSha256,mastersSha256:masters.mastersSha256,auditSha256:fingerprint(audit),
  registry:contentMediaRegistrySchema.parse({schemaVersion:1,contentId:plan.visualPlan.contentId,assets}),variants,localObjects};
 const media=articleVisualMediaSchema.parse({...payload,mediaSha256:fingerprint(payload)});
 validateCandidateRegistry(media,masters,audit);await verifyVisualMediaBytes(folder,masters,media);return media;
}
export async function verifyVisualMediaBytes(folder:string,masters:ArticleVisualMasters,media?:ArticleVisualMedia){
 for(const {ingest} of masters.assets){
  mediaIngestResultSchema.parse(ingest);
  if(ingest.processing.profileId!==canonicalRasterProfile.id||ingest.processing.profileSha256!==fingerprint(canonicalRasterProfile)
   ||ingest.processing.toolchainSha256!==sharpToolchainSha256()||!ingest.processing.metadataStripped)fail("VISUAL_INGEST_PROFILE_STALE",3);
  const bytes=await safeReadBytes(resolve(folder,ingest.canonicalMaster.privateRelativePath));
  const meta=await inspectRasterBytes(bytes);
  if(sha256(bytes)!==ingest.canonicalMaster.sha256||bytes.length!==ingest.canonicalMaster.sizeBytes
   ||meta.width!==ingest.canonicalMaster.width||meta.height!==ingest.canonicalMaster.height||meta.format!=="webp"
   ||meta.space!=="srgb"||meta.depth!=="uchar"||meta.exif||meta.xmp||meta.orientation)fail("VISUAL_CANONICAL_BYTES_INVALID",3);
 }
 if(!media)return;
 for(const item of media.localObjects){
  const bytes=await safeReadBytes(resolve(folder,item.path)),meta=await inspectRasterBytes(bytes);
  const refs=media.registry.assets.flatMap(asset=>[asset.delivery.master,...asset.delivery.variants]).filter(ref=>ref.sha256===item.sha256);
  const format=meta.format==="heif"&&meta.compression==="av1"?"avif":meta.format;
  if(!refs.length||sha256(bytes)!==item.sha256||refs.some(ref=>ref.sizeBytes!==bytes.length||ref.width!==meta.width||ref.height!==meta.height||ref.format!==format)
   ||meta.exif||meta.xmp||meta.orientation)fail("VISUAL_DELIVERY_BYTES_INVALID",3);
 }
 for(const manifest of media.variants){
  const binding=getMediaVariantProfileBinding(manifest.profileId);
  if(binding.profileSha256!==manifest.profileSha256||manifest.toolchainSha256!==sharpToolchainSha256())fail("VISUAL_DELIVERY_PROFILE_STALE",3);
 }
}
