import type {ContentMediaRegistry} from "@xpotato/content-contracts";
type Asset=ContentMediaRegistry["assets"][number];
type ObjectRef=Asset["delivery"]["master"];
const escape=(s:string)=>s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
export type MediaUrlResolver=(object:ObjectRef)=>string;
type PictureInput={registry:ContentMediaRegistry;assetId:string;urlFor:MediaUrlResolver;alt?:string;priority?:boolean;sizes?:string};
export const mediaObjectUrl=(origin:string,object:ObjectRef)=>{
 const url=new URL(origin);
 if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash)throw Error("MEDIA_ORIGIN_INVALID");
 return new URL(object.objectKey,url).href;
};
function singlePicture(input:PictureInput,asset:Asset):string{
 const {registry,urlFor,priority=false}=input,master=asset.delivery.master;
 if(!master.width||!master.height||!master.sizeBytes)throw Error("MEDIA_DIMENSIONS_OR_BYTES_MISSING");
 const alt=asset.decorative?"":input.alt??asset.defaultAlt;
 if(alt===undefined||!asset.decorative&&!alt.trim())throw Error("MEDIA_ALT_REQUIRED");
 const safeUrl=(object:ObjectRef)=>{
  const value=urlFor(object);
  if(value==="/__candidate_media/"+object.sha256+"."+(object.format==="jpeg"?"jpg":object.format))return value;
  const url=new URL(value);
  if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||!url.pathname.endsWith("/"+object.objectKey))throw Error("MEDIA_DELIVERY_URL_INVALID");
  return value;
 };
 const sources:string[]=[];
 if(asset.delivery.mode!=="fixed"){
  const pairs=new Set<string>();
  for(const item of asset.delivery.variants){
   const pair=item.format+":"+item.width;
   if(!item.width||!item.height||item.width>master.width||pairs.has(pair)
    ||Math.abs(item.height-item.width*master.height/master.width)>1)throw Error("MEDIA_VARIANT_DIMENSIONS_INVALID");
   pairs.add(pair);
  }
  for(const format of ["avif","webp","jpeg","png"]){
   const items=asset.delivery.variants.filter(item=>item.format===format).sort((a,b)=>a.width-b.width);
   if(items.length)sources.push('<source type="image/'+format+'" srcset="'+escape(items.map(item=>safeUrl(item)+" "+item.width+"w").join(", "))
    +'" sizes="'+escape(input.sizes??"(min-width: 1000px) 920px, calc(100vw - 40px)")+'" />');
  }
  if(!sources.length)throw Error("MEDIA_RESPONSIVE_VARIANTS_MISSING");
 }
 const image='<img src="'+escape(safeUrl(master))+'" width="'+master.width+'" height="'+master.height+'" alt="'+escape(alt)
  +'" loading="'+(priority?"eager":"lazy")+'" decoding="async"'+(priority?' fetchpriority="high"':"")+' data-media-asset="'+escape(asset.assetId)+'" />';
 return '<picture class="registry-media" data-media-content-id="'+escape(registry.contentId)+'">'+sources.join("")+image+"</picture>";
}
export function renderRegistryPicture(input:PictureInput):string{
 const {registry,assetId}=input,matches=registry.assets.filter(item=>item.assetId===assetId&&item.status==="active");
 if(matches.length!==1)throw Error("MEDIA_ASSET_NOT_UNIQUE_ACTIVE");
 const asset=matches[0]!;
 if(asset.delivery.mode!=="animated")return singlePicture(input,asset);
 const poster=registry.assets.find(a=>a.assetId===asset.delivery.posterAssetId&&a.status==="active");
 if(!poster||poster.delivery.mode==="animated"||!asset.canonicalSource?.animation)throw Error("MEDIA_ANIMATION_POSTER_INVALID");
 const master=asset.delivery.master,stillMaster=poster.delivery.master;
 if(!master.width||!master.height||!stillMaster.width||!stillMaster.height
  ||Math.abs(master.height/master.width-stillMaster.height/stillMaster.width)>1/Math.max(master.width,stillMaster.width))throw Error("MEDIA_ANIMATION_POSTER_ASPECT_INVALID");
 const alt=asset.decorative?"":input.alt??asset.defaultAlt;
 const still=singlePicture({...input,...(alt===undefined?{}:{alt})},poster),active=singlePicture(input,asset);
 return '<span class="article-motion" data-article-motion data-playing="false"><span data-motion-view>'+still
  +'</span><template data-motion-picture>'+active+'</template><button type="button" class="article-motion-toggle" data-motion-toggle hidden aria-label="動きを再生" aria-pressed="false" title="再生">'
  +'<svg class="motion-play" aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>'
  +'<svg class="motion-pause" aria-hidden="true" viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg></button></span>';
}
