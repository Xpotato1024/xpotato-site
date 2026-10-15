import {fromHtml} from "hast-util-from-html";
import {renderRegistryPicture} from "@xpotato/portable-content/media-picture";
import type {contentMediaContext} from "./media-context.js";
type Node={type:string;tagName?:string;properties?:Record<string,unknown>;children?:Node[];position?:{start:{offset?:number};end:{offset?:number}}};
export function renderMarkdownMedia(html:string,context:ReturnType<typeof contentMediaContext>){
 const root=fromHtml(html,{fragment:true}) as unknown as Node,patches:{start:number;end:number;text:string}[]=[];
 function walk(node:Node){
  if(node.tagName==="img"&&typeof node.properties?.src==="string"&&node.properties.src.startsWith("media:")){
   if(!context)throw Error("MARKDOWN_MEDIA_REGISTRY_MISSING");
   const assetId=node.properties.src.slice(6),start=node.position?.start.offset,end=node.position?.end.offset;
   if(start===undefined||end===undefined||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(assetId))throw Error("MARKDOWN_MEDIA_REFERENCE_INVALID");
   patches.push({start,end,text:renderRegistryPicture({registry:context.registry,urlFor:context.urlFor,assetId,
    ...(typeof node.properties.alt==="string"?{alt:node.properties.alt}:{})})});
  }
  for(const child of node.children??[])walk(child);
 }
 walk(root);let result=html;
 for(const patch of patches.sort((a,b)=>b.start-a.start))result=result.slice(0,patch.start)+patch.text+result.slice(patch.end);
 return result;
}
