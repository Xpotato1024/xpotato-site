import {reviewTree,walkReview} from "./review.js";
export function articleMediaReferences(body:string):readonly string[]{
 const tree=reviewTree(body),definitions=new Map<string,string>(),refs:string[]=[];
 type MediaNode={type:string;url?:string;identifier?:string;name?:string;attributes?:{name:string;value:unknown}[]};
 walkReview(tree,node=>{const item=node as MediaNode;if(item.type==="definition"&&item.identifier&&item.url)definitions.set(item.identifier.toLowerCase(),item.url);});
 const add=(url:string)=>{if(!/^media:[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(url))throw Error("CANDIDATE_EXTERNAL_OR_INVALID_IMAGE");refs.push(url.slice(6));};
 walkReview(tree,node=>{
  const item=node as MediaNode;
  if(item.type==="image")add(item.url??"");
  if(item.type==="imageReference")add(definitions.get((item.identifier??"").toLowerCase())??"");
  if(["mdxJsxFlowElement","mdxJsxTextElement"].includes(item.type)&&item.name==="Figure"){
   const asset=item.attributes?.find(attr=>attr.name==="asset")?.value;
   if(typeof asset!=="string")throw Error("CANDIDATE_FIGURE_ASSET_REQUIRED");add("media:"+asset);
  }
 });
 return [...new Set(refs)];
}
