import {mkdir,readFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {mediaIngestResultSchema,mediaObjectRefSchema,contentMediaRegistrySchema,articleVisualMastersSchema,articleVisualMediaSchema,
 type ArticleVisualPlan,type ArticleVisualMasters,type ArticleVisualMedia,type LocalVisualAudit} from "@xpotato/content-contracts";
import {deterministicCover,deterministicBlogSocialCard,SharpCanonicalMediaProcessor,SharpDeliveryVariantGenerator,generatePublicDeliveryMaster,
 canonicalRasterProfile,canonicalAnimationProfile,inspectAnimationBytes,assertAnimationPlaybackEquivalent,animationPlaybackFingerprint,animationContactSheet,getMediaVariantProfileBinding,sharpToolchainSha256,inspectRasterBytes,sanitizeSvg,type LocalDeliveryObject} from "@xpotato/media-ingest";
import {fingerprint,sha256} from "../canonical.js";
import {fail,noLinks,safeReadBytes,immutableBytes} from "../private-files.js";
import {validateCandidateRegistry} from "./visual-analysis.js";

const sourcePath=(directory:string,path:string)=>{
 if(!/^source-media\/[a-zA-Z0-9][a-zA-Z0-9_.-]*\.(?:png|jpe?g|webp|gif|svg)$/u.test(path))fail("VISUAL_SOURCE_PATH_DENIED");
 return join(directory,path);
};
export async function verifyVisualSourceInputs(directory:string,plan:ArticleVisualPlan){
 const inputs=[...(plan.visualInput.hero.kind==="local_raster"?[plan.visualInput.hero]:[]),...plan.visualInput.inline];
 for(const item of inputs)if(sha256(await safeReadBytes(sourcePath(directory,item.path)))!==item.sha256)fail("VISUAL_SOURCE_CHANGED",3);
 const hero=plan.visualInput.hero;
 if(hero.kind==='local_raster'&&hero.origin==='ai_generated'){
  const {readDraftStore}=await import("../draft-job.js"),{readExistingArticleInput}=await import("../existing-article-intake.js");
  const store=await readDraftStore(directory);if(!store.receivedInput||!hero.receivedLineage)fail('VISUAL_RECEIVED_AI_HERO_BINDING_REQUIRED');
  const intake=await readExistingArticleInput(join(directory,'..','existing-inputs',store.receivedInput.inputSha256),store.spec.target.contentId,store.receivedInput.inputSha256);
  const asset=intake.artifacts.find(a=>a.id===hero.receivedLineage!.artifactId);
  if(!asset||asset.role!=='hero'||asset.origin!=='ai_generated'||asset.sha256!==hero.sha256
   ||!asset.lineageIds.some(id=>intake.artifacts.some(a=>a.id===id&&a.role==='lineage'&&a.sha256===hero.receivedLineage!.lineageSha256)))fail('VISUAL_RECEIVED_AI_HERO_BINDING_REQUIRED');
 }
}
export async function coverForPlan(repositoryRoot:string,frontmatter:{id:string;title:string;pubDate:string;cardDisplay?:{lines?:string[]|undefined}|undefined},categoryLabel:string){
 const hero=await deterministicCover({repositoryRoot,title:frontmatter.title,categoryLabel,pubDate:frontmatter.pubDate});
 const social=await deterministicBlogSocialCard({repositoryRoot,contentId:frontmatter.id,title:frontmatter.title,categoryLabel,cardDisplay:frontmatter.cardDisplay});
 const binding={hero:hero.binding,social:social.binding};
 return {hero:hero.hero,social:social.svg,binding,derivationSha256:fingerprint(binding)};
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
  const animated=source?.kind==="local_raster"&&Boolean(source.animation);
  if(source?.kind==='local_svg'){
   const svg=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
   if(/<!|@import|<(?:image|foreignObject)\b|(?:href|src)\s*=\s*["']\s*(?!#)|url\(\s*["']?\s*(?!#)/iu.test(svg))fail('VISUAL_SVG_EXTERNAL_OR_ACTIVE_DENIED');
   sanitizeSvg(svg);
  }else if(source){
   const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
   const webp=bytes.subarray(0,4).toString()==="RIFF"&&bytes.subarray(8,12).toString()==="WEBP";
   if(animated){
    if(!webp&&!/^GIF8[79]a$/u.test(bytes.subarray(0,6).toString()))fail("VISUAL_SOURCE_FORMAT_DENIED");
    await inspectAnimationBytes(bytes);
   }else{
    if(!png&&!jpeg&&!webp)fail("VISUAL_SOURCE_FORMAT_DENIED");
    const meta=await inspectRasterBytes(bytes);
    if(!["jpeg","png","webp"].includes(meta.format??"")||!meta.width||!meta.height||(meta.pages??1)>1)fail("VISUAL_SOURCE_FORMAT_DENIED");
   }
  }
  await immutableBytes(join(folder,relative),bytes);
  await noLinks(join(folder,"masters",plan.visualPlan.contentId,visual.visualId));
  const ingest=await processor.ingest({schemaVersion:1,sourcePath:join(folder,relative),
   target:{contentId:plan.visualPlan.contentId,semanticAssetId:visual.visualId},kind:source?(source.origin==="camera"||source.origin==='ai_generated'?"photo":source.origin):"diagram",profileId:animated?canonicalAnimationProfile.id:canonicalRasterProfile.id,overwrite:false});
  const role=visual.role;if(role!=="hero"&&role!=="social_card"&&role!=="inline")fail("VISUAL_ROLE_UNSUPPORTED");
  let sheet:ArticleVisualMasters["assets"][number]["animationContactSheet"];
  if(animated){
   const sample=await animationContactSheet(await safeReadBytes(join(folder,ingest.canonicalMaster.privateRelativePath)));
   const hash=sha256(sample.data),path="generated/"+hash+".webp";
   await immutableBytes(join(folder,path),sample.data);sheet={path,sha256:hash,frameIndices:sample.frameIndices};
  }
  assets.push({assetId:visual.visualId,role,origin:source?source.origin:"deterministic_cover",alt:visual.altIntent,
   decorative:visual.decorative,rightsRef:source?.rights.rightsId??"generated-cover-rights",ingest,
   ...(source?.kind==="local_raster"&&source.animation?{posterAssetId:source.animation.posterAssetId}:{}),
   ...(sheet?{animationContactSheet:sheet}:{})});
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
   format:value.format,width:value.width,height:value.height,sizeBytes:value.sizeBytes,...(value.animation?{animation:value.animation}:{})});
  if(!localObjects.some(item=>item.sha256===value.sha256))localObjects.push({sha256:value.sha256,path:value.privateRelativePath,contentType:value.contentType});
  return ref;
 };
 for(const master of masters.assets){
  const profileId=master.ingest.canonicalMaster.animation?"animation-inline-v1":master.role==="social_card"?"social-card-v1":master.origin==="screenshot"||master.origin==="diagram"?"screenshot-ui-v1":master.role==="hero"?"photo-hero-v1":"photo-inline-v1";
  const binding=getMediaVariantProfileBinding(profileId);
  await noLinks(join(folder,"variants",plan.visualPlan.contentId,master.assetId));await noLinks(join(folder,"public-master","public",master.assetId));
  const manifest=await variantGenerator.generate({contentId:plan.visualPlan.contentId,ingestResult:master.ingest,...binding});
  const deliveryMaster=await generatePublicDeliveryMaster(master.ingest,profileId,"public-master",folder);
  variants.push(manifest);const ingest=master.ingest;
  assets.push({assetId:master.assetId,role:master.role,origin:master.origin,status:"active",defaultAlt:master.alt,decorative:master.decorative,
   rightsRef:master.rightsRef,provenanceRef:"visual-"+plan.planSha256,visualAuditRef:"audit-"+audit.records.find(item=>item.visualId===master.assetId)!.auditSha256,
   canonicalSource:{storageClass:"private_canonical_media_v1",sha256:ingest.canonicalMaster.sha256,format:ingest.canonicalMaster.format,
    width:ingest.canonicalMaster.width,height:ingest.canonicalMaster.height,sizeBytes:ingest.canonicalMaster.sizeBytes,
    ingestProfileId:ingest.processing.profileId,ingestProfileSha256:ingest.processing.profileSha256,
    ...(ingest.canonicalMaster.animation?{animation:ingest.canonicalMaster.animation}:{})},
   delivery:{mode:master.posterAssetId?"animated":master.role==="social_card"?"fixed":"responsive",
    ...(master.posterAssetId?{posterAssetId:master.posterAssetId}:{}),...binding,master:object(deliveryMaster),
    variants:manifest.variants.map(item=>object(item as LocalDeliveryObject))}});
 }
 const payload={schemaVersion:1 as const,protocol:"xpotato-private-candidate-media-v1" as const,
  planSha256:plan.planSha256,mastersSha256:masters.mastersSha256,auditSha256:fingerprint(audit),
  registry:contentMediaRegistrySchema.parse({schemaVersion:1,contentId:plan.visualPlan.contentId,assets}),variants,localObjects};
 const media=articleVisualMediaSchema.parse({...payload,mediaSha256:fingerprint(payload)});
 validateCandidateRegistry(media,masters,audit);await verifyVisualMediaBytes(folder,masters,media);return media;
}
export async function verifyVisualMediaBytes(folder:string,masters:ArticleVisualMasters,media?:ArticleVisualMedia){
 for(const master of masters.assets){
  const {ingest}=master;mediaIngestResultSchema.parse(ingest);
  if(Boolean(ingest.canonicalMaster.animation)!==Boolean(master.animationContactSheet&&master.posterAssetId))fail("VISUAL_ANIMATION_AUDIT_INPUT_MISSING",3);
  if(master.animationContactSheet){
   const sheet=await safeReadBytes(resolve(folder,master.animationContactSheet.path));
   if(sha256(sheet)!==master.animationContactSheet.sha256)fail("VISUAL_ANIMATION_AUDIT_INPUT_CHANGED",3);
  }
  const profile=ingest.canonicalMaster.animation?canonicalAnimationProfile:canonicalRasterProfile;
  if(ingest.processing.profileId!==profile.id||ingest.processing.profileSha256!==fingerprint(profile)
   ||ingest.processing.toolchainSha256!==sharpToolchainSha256()||!ingest.processing.metadataStripped)fail("VISUAL_INGEST_PROFILE_STALE",3);
  const bytes=await safeReadBytes(resolve(folder,ingest.canonicalMaster.privateRelativePath));
  const animated=ingest.canonicalMaster.animation?await inspectAnimationBytes(bytes,ingest.canonicalMaster.animation):null;
  const meta=animated?.metadata??await inspectRasterBytes(bytes);
  if(animated&&await animationPlaybackFingerprint(bytes)!==ingest.processing.animationPlaybackSha256)fail("VISUAL_ANIMATION_PLAYBACK_PROOF_INVALID",3);
  if(animated){
   const expected=await animationContactSheet(bytes),actual=master.animationContactSheet!;
   if(sha256(expected.data)!==actual.sha256||fingerprint(expected.frameIndices)!==fingerprint(actual.frameIndices))fail("VISUAL_ANIMATION_AUDIT_DERIVATION_INVALID",3);
  }
  if(!animated&&(meta.pages??1)!==1)fail("VISUAL_UNEXPECTED_ANIMATION",3);
  if(sha256(bytes)!==ingest.canonicalMaster.sha256||bytes.length!==ingest.canonicalMaster.sizeBytes
   ||meta.width!==ingest.canonicalMaster.width||(animated?.height??meta.height)!==ingest.canonicalMaster.height||meta.format!=="webp"
   ||meta.space!=="srgb"||meta.depth!=="uchar"||meta.exif||meta.xmp||meta.orientation)fail("VISUAL_CANONICAL_BYTES_INVALID",3);
 }
 if(!media)return;
 for(const item of media.localObjects){
  const bytes=await safeReadBytes(resolve(folder,item.path));
  const owner=media.registry.assets.find(a=>[a.delivery.master,...a.delivery.variants].some(o=>o.sha256===item.sha256));
  const objectRef=owner&&[owner.delivery.master,...owner.delivery.variants].find(o=>o.sha256===item.sha256);
  const animated=owner?.delivery.mode==="animated"?await inspectAnimationBytes(bytes,objectRef?.animation):null;
  const meta=animated?.metadata??await inspectRasterBytes(bytes);
  if(!animated&&(meta.pages??1)!==1)fail("VISUAL_UNEXPECTED_ANIMATION",3);
  if(animated){const canonical=masters.assets.find(a=>a.assetId===owner!.assetId)!.ingest.canonicalMaster;
   await assertAnimationPlaybackEquivalent(await safeReadBytes(resolve(folder,canonical.privateRelativePath)),bytes,animated.width);}
  const refs=media.registry.assets.flatMap(asset=>[asset.delivery.master,...asset.delivery.variants]).filter(ref=>ref.sha256===item.sha256);
  const format=meta.format==="heif"&&meta.compression==="av1"?"avif":meta.format;
  if(!refs.length||sha256(bytes)!==item.sha256||refs.some(ref=>ref.sizeBytes!==bytes.length||ref.width!==meta.width||ref.height!==(animated?.height??meta.height)||ref.format!==format)
   ||meta.exif||meta.xmp||meta.orientation)fail("VISUAL_DELIVERY_BYTES_INVALID",3);
 }
 for(const manifest of media.variants){
  const binding=getMediaVariantProfileBinding(manifest.profileId);
  if(binding.profileSha256!==manifest.profileSha256||manifest.toolchainSha256!==sharpToolchainSha256())fail("VISUAL_DELIVERY_PROFILE_STALE",3);
 }
}
