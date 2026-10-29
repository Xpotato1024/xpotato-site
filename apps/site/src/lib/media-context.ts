import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {candidateBuildInputSchema,type ContentMediaRegistry,type CandidateBuildInput} from "@xpotato/content-contracts";
import {articleMediaTargets} from "@xpotato/content-contracts/article-media-targets";
import {mediaObjectUrl,type MediaUrlResolver} from "@xpotato/portable-content/media-picture";
import {mediaRegistries} from "../content-registry/media/index.js";
import type {PublishedSeoImage} from "./seo.js";
import {publishedMediaEvidence} from '../content-registry/media-evidence/index.js';
import {compactSocialImage} from './compact-social-image.js';
let cached:CandidateBuildInput|undefined;
export function candidateBuildOverlay(){
 const path=process.env.XPOTATO_ARTICLE_CANDIDATE_INPUT;
 if(!path)return undefined;
 if(!cached){const text=readFileSync(path,"utf8");if(createHash("sha256").update(text).digest("hex")!==process.env.XPOTATO_ARTICLE_CANDIDATE_INPUT_SHA)throw Error("CANDIDATE_BUILD_INPUT_HASH_MISMATCH");cached=candidateBuildInputSchema.parse(JSON.parse(text));}
 return cached;
}
export function contentMediaContext(contentId:string):{registry:ContentMediaRegistry;urlFor:MediaUrlResolver;candidate:boolean;image?:PublishedSeoImage}|undefined{
 const overlay=candidateBuildOverlay();
 if(overlay?.contentId===contentId){
  if(overlay.registry.contentId!==contentId)throw Error("CANDIDATE_MEDIA_CONTENT_ID_MISMATCH");
  return {registry:overlay.registry,candidate:true,...(overlay.plannedSeo.image?{image:overlay.plannedSeo.image}:{}),
   urlFor:object=>{const url=overlay.localMediaUrls[object.sha256];if(!url)throw Error("CANDIDATE_MEDIA_BYTES_MISSING");return url;}};
 }
 const matches=mediaRegistries.filter(item=>item.contentId===contentId);
 if(matches.length>1)throw Error("CONTENT_MEDIA_REGISTRY_DUPLICATE");
 if(!matches[0]?.assets.length)return undefined;
 const registry=matches[0],evidence=publishedMediaEvidence[contentId];
 const image=evidence?compactSocialImage({registry,evidence,publicOrigin:articleMediaTargets.publicOrigin}):undefined;
 if(registry.assets.some(asset=>asset.role==='social_card'&&asset.status==='active')&&!image)throw Error('SOCIAL_PUBLICATION_EVIDENCE_REQUIRED');
 return {registry,candidate:false,...(image?{image}:{}),urlFor:object=>mediaObjectUrl(articleMediaTargets.publicOrigin,object)};
}
