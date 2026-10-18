import {unified} from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkGfm from "remark-gfm";
import type {SourceRecord} from "@xpotato/content-contracts";
import {fingerprint,sha256} from "@xpotato/content-contracts/canonical";
import {validatePortableMdx} from "./index.js";
type Node={type:string;children?:Node[];value?:string;lang?:string|null;identifier?:string;position?:{start:{offset?:number};end:{offset?:number}}};
export const reviewTree=(body:string):Node=>{
  if(validatePortableMdx(body).length)throw Error("REVIEW_MARKDOWN_INVALID");
  return unified().use(remarkParse).use(remarkMdx).use(remarkGfm).parse(body) as unknown as Node;
};
export function walkReview(node:Node,visit:(node:Node,parents:readonly Node[])=>void,parents:readonly Node[]=[]):void{
 visit(node,parents);for(const child of node.children??[])walkReview(child,visit,[...parents,node]);
}
export const inspectExamples=(body:string)=>{
 const examples:{exampleId:string;draftSha256:string;sourceSpan:{start:number;end:number};kind:"code";language?:string;contentSha256:string;source:string}[]=[];
 walkReview(reviewTree(body),node=>{
  if(node.type!=="code")return;
  const start=node.position?.start.offset,end=node.position?.end.offset;
  if(start===undefined||end===undefined)throw Error("EXAMPLE_POSITION_MISSING");
  examples.push({exampleId:"example-"+String(examples.length+1).padStart(3,"0"),draftSha256:sha256(body),
   sourceSpan:{start,end},kind:"code",...(node.lang?{language:node.lang}:{}),contentSha256:sha256(node.value??""),source:node.value??""});
 });
 return examples;
};
const escapedAt=(raw:string,index:number)=>{
 let slashes=0;for(let i=index-1;i>=0&&raw[i]==="\\";i--)slashes++;return slashes%2===1;
};
const markdownText=(text:string)=>text.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
 .replaceAll("\r"," ").replaceAll("\n"," ").replace(/[\\[\]()\x60*_!{}]/gu,char=>"\\"+char);
function publicFootnote(source:SourceRecord):string{
 if(!source.publicSafe||!source.citation.eligible||!source.citation.title)throw Error("CITATION_NOT_PUBLIC_ELIGIBLE");
 const citation=source.citation;
 let label=markdownText(citation.title!);
 if(citation.publisher)label+=" — "+markdownText(citation.publisher);
 if(citation.canonicalUrl){
  const url=new URL(citation.canonicalUrl);
  if(url.protocol!=="https:"||url.username||url.password||/[<>\s\\]/u.test(citation.canonicalUrl))throw Error("CITATION_URL_INVALID");
  label+=". <"+url.href+">";
 }else if(source.locator.kind==="artifact"&&source.locator.publicDescription){
  label+="（"+markdownText(source.locator.publicDescription)+" / SHA-256: "+source.locator.artifactSha256+"）";
 }else throw Error("CITATION_PUBLIC_REPRESENTATION_MISSING");
 return label;
}
export const compileArticleCitations=(body:string,sources:readonly SourceRecord[])=>{
 const tree=reviewTree(body),map=new Map(sources.map(source=>[source.sourceId,source]));
 if(map.size!==sources.length)throw Error("DUPLICATE_SOURCE_ID");
 const definitions:string[]=[],references=new Set<string>(),used:string[]=[],patches:{start:number;end:number;text:string}[]=[];
 walkReview(tree,(node,parents)=>{
  // Markdown may absorb a reserved logical marker into a link label or reference definition.
  if(node.type==="definition"&&(node.identifier??"").startsWith("@"))throw Error("CITATION_LOCATION_UNSUPPORTED");
  if(["link","linkReference","image","imageReference"].includes(node.type)){
   const raw=body.slice(node.position?.start.offset??0,node.position?.end.offset??0);
   for(const marker of raw.matchAll(/\[@/gu))if(!escapedAt(raw,marker.index))throw Error("CITATION_LOCATION_UNSUPPORTED");
  }
  if(node.type==="footnoteDefinition"){definitions.push((node.identifier??"").toLowerCase());return;}
  if(node.type==="footnoteReference"){references.add((node.identifier??"").toLowerCase());return;}
  if(node.type!=="text")return;
  const start=node.position?.start.offset,end=node.position?.end.offset;
  if(start===undefined||end===undefined)return;
  const raw=body.slice(start,end);
  for(const marker of raw.matchAll(/\[\^([^\]\n]+)\]/gu))if(!escapedAt(raw,marker.index))references.add(marker[1]!.toLowerCase());
  const seen=new Set<number>();
  for(const marker of raw.matchAll(/\[@[^\]\n]*\]/gu)){
   if(escapedAt(raw,marker.index))continue;
   if(parents.some(parent=>["link","linkReference","image","footnoteDefinition"].includes(parent.type)))throw Error("CITATION_LOCATION_UNSUPPORTED");
   seen.add(marker.index);
   const ids=marker[0].slice(2,-1).split(/[ \t]+@/u).map(id=>/^S\d{4}$/u.test(id)?id.toLowerCase():id);
   if(ids.some(id=>!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id))||new Set(ids).size!==ids.length)throw Error("CITATION_MARKER_INVALID");
   const labels=ids.map(id=>{
    const source=map.get(id);if(!source)throw Error("CITATION_SOURCE_UNKNOWN");publicFootnote(source);
    if(!used.includes(id))used.push(id);return "[^cite-"+(used.indexOf(id)+1)+"]";
   });
   patches.push({start:start+marker.index,end:start+marker.index+marker[0].length,text:labels.join("")});
  }
  for(const marker of raw.matchAll(/\[@/gu))if(!escapedAt(raw,marker.index)&&!seen.has(marker.index))throw Error("CITATION_MARKER_INVALID");
 });
 if(new Set(definitions).size!==definitions.length)throw Error("FOOTNOTE_DUPLICATE");
 if(definitions.some(id=>/^cite-\d+$/u.test(id)))throw Error("FOOTNOTE_RESERVED_LABEL");
 if(definitions.some(id=>!references.has(id))||[...references].some(id=>!definitions.includes(id)))throw Error("FOOTNOTE_ORPHAN_OR_MISSING");
 let compiled=body;
 for(const patch of [...patches].sort((a,b)=>b.start-a.start))compiled=compiled.slice(0,patch.start)+patch.text+compiled.slice(patch.end);
 if(used.length)compiled=compiled.trimEnd()+"\n\n"+used.map((id,index)=>"[^cite-"+(index+1)+"]: "+publicFootnote(map.get(id)!)).join("\n")+"\n";
 const bindings=used.map((id,index)=>({sourceId:id,sourceRecordSha256:fingerprint(map.get(id)!),footnote:"cite-"+(index+1)}));
 const manifest={schemaVersion:1,bodySha256:sha256(body),compiledSha256:sha256(compiled),bindings};
 return {compiled,manifest,compilationSha256:fingerprint(manifest),patches,tree};
};
