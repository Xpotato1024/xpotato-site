import {fromHtml} from "hast-util-from-html";
import type {ArticleVisualMedia,CandidateBuildInput} from "@xpotato/content-contracts";
import type {candidateMaterials} from "./candidate-material.js";
import {fail} from "./private-files.js";
import {renderRegistryPicture} from "@xpotato/portable-content/media-picture";
import {reviewTree,walkReview} from "@xpotato/portable-content/review";
import {fingerprint,sha256} from "./canonical.js";
type Node={type:string;tagName?:string;value?:string;properties?:Record<string,unknown>;children?:Node[]};
const text=(node:Node):string=>node.value??(node.children??[]).map(text).join("");
const prop=(node:Node,name:string)=>node.properties?.[name];
export function candidateBodyText(root:Node){
 const descendants=(node:Node):Node[]=>[node,...(node.children??[]).flatMap(descendants)];
 const hasClass=(node:Node,name:string)=>(prop(node,'className') as string[]|undefined)?.includes(name);
 const mains=descendants(root).filter(node=>node.tagName==='main'&&prop(node,'id')==='main-content');
 if(mains.length!==1)fail('CANDIDATE_BODY_MISSING',3);
 const articles=(mains[0]!.children??[]).filter(node=>node.tagName==='article');
 if(articles.length!==1)fail('CANDIDATE_BODY_MISSING',3);
 const regions=descendants(articles[0]!).filter(node=>hasClass(node,'prose')&&(hasClass(node,'article-lead')||hasClass(node,'article-body')));
 if(regions.filter(node=>hasClass(node,'article-body')).length!==1||regions.filter(node=>hasClass(node,'article-lead')).length>1)fail('CANDIDATE_BODY_MISSING',3);
 return regions.map(text).join('\n');
}
export function inspectCandidateHtml(html:string,materials:Awaited<ReturnType<typeof candidateMaterials>>,media:ArticleVisualMedia,overlay:Pick<CandidateBuildInput,"localMediaUrls">){
 const root=fromHtml(html) as unknown as Node,nodes:Node[]=[];const walk=(node:Node)=>{nodes.push(node);for(const child of node.children??[])walk(child);};walk(root);
 const byTag=(tag:string)=>nodes.filter(node=>node.tagName===tag);
 const meta=(key:string)=>byTag("meta").filter(node=>prop(node,"name")===key||prop(node,"property")===key).map(node=>String(prop(node,"content")??""));
 const one=(values:string[],expected:string,code:string)=>{if(values.length!==1||values[0]!==expected)fail(code,3);};
 one(byTag("h1").map(text),materials.frontmatter.title,"CANDIDATE_TITLE_MISMATCH");
 one(byTag("title").map(text),materials.seo.title+" | Xpotato","CANDIDATE_SEO_TITLE_MISMATCH");
 one(meta("description"),materials.seo.description,"CANDIDATE_DESCRIPTION_MISMATCH");
 const canonical=byTag("link").filter(node=>(prop(node,"rel") as string[]|undefined)?.includes("canonical")).map(node=>String(prop(node,"href")));
 one(canonical,materials.plannedSeo.canonical,"CANDIDATE_CANONICAL_MISMATCH");
 if(!meta("robots").some(value=>value.split(/,\s*/u).includes("noindex"))||!meta("xpotato-private-draft-preview-v1").length)fail("CANDIDATE_PRIVATE_MARKER_MISSING",3);
 one(meta("og:url"),materials.plannedSeo.canonical,"CANDIDATE_OG_URL_MISMATCH");
 one(meta("og:title"),materials.seo.title,"CANDIDATE_OG_TITLE_MISMATCH");
 if(materials.plannedSeo.image){
  one(meta("og:image"),materials.plannedSeo.image.url,"CANDIDATE_OG_IMAGE_MISMATCH");
  one(meta("og:image:width"),String(materials.plannedSeo.image.width),"CANDIDATE_OG_IMAGE_MISMATCH");
  one(meta("og:image:height"),String(materials.plannedSeo.image.height),"CANDIDATE_OG_IMAGE_MISMATCH");
 }else if(meta("og:image").length)fail("CANDIDATE_UNCONFIRMED_OG_IMAGE",3);
 if(nodes.some(node=>["astro-island","iframe","object","embed"].includes(node.tagName??"")))fail("CANDIDATE_UNADMITTED_RUNTIME",3);
 const ids=new Set(nodes.map(node=>prop(node,"id")).filter((value):value is string=>typeof value==="string"));
 for(const binding of materials.analysis.citationManifest.bindings){
  if(![...ids].some(id=>id.toLowerCase().endsWith("fn-"+binding.footnote.toLowerCase())))fail("CANDIDATE_CITATION_FOOTNOTE_MISSING",3);
 }
 for(const node of byTag("a").filter(node=>prop(node,"dataFootnoteRef")!==undefined)){
  const href=String(prop(node,"href")??"");if(!href.startsWith("#")||!ids.has(decodeURIComponent(href.slice(1))))fail("CANDIDATE_FOOTNOTE_LINK_INVALID",3);
 }
 const displayed=new Set<string>();
 for(const image of byTag("img")){
  const src=String(prop(image,"src")??""),assetId=prop(image,"dataMediaAsset");
  if(!src.startsWith("/")||src.startsWith("//"))fail("CANDIDATE_REMOTE_IMAGE_DENIED",3);
  if(typeof assetId!=="string"){if(src!=="/xpotato-logo.svg")fail("CANDIDATE_UNREGISTERED_IMAGE",3);continue;}
  const asset=media.registry.assets.find(item=>item.assetId===assetId&&item.status==="active");
  if(!asset||src!==overlay.localMediaUrls[asset.delivery.master.sha256]
   ||Number(prop(image,"width"))!==asset.delivery.master.width||Number(prop(image,"height"))!==asset.delivery.master.height
   ||typeof prop(image,"alt")!=="string")fail("CANDIDATE_RENDERED_MEDIA_MISMATCH",3);
  if(asset.decorative&&prop(image,"alt")!==""||!asset.decorative&&!String(prop(image,"alt")).trim())fail("CANDIDATE_IMAGE_ALT_INVALID",3);
  displayed.add(assetId);
 }
 const expected=media.registry.assets.filter(item=>item.role!=="social_card").map(item=>item.assetId).sort();
 if(JSON.stringify([...displayed].sort())!==JSON.stringify(expected))fail("CANDIDATE_DISPLAYED_IMAGE_SET_MISMATCH",3);
 const pictures=byTag("picture");
 let sourceCount=0;
 for(const picture of pictures){
  const image=picture.children?.find(node=>node.tagName==="img"),assetId=image&&prop(image,"dataMediaAsset");
  if(typeof assetId!=="string")fail("CANDIDATE_PICTURE_UNREGISTERED",3);
  const asset=media.registry.assets.find(item=>item.assetId===assetId)!;
  const expectedHtml=renderRegistryPicture({registry:media.registry,assetId,urlFor:object=>overlay.localMediaUrls[object.sha256]!,priority:asset.role==="hero"});
  const parsed=fromHtml(expectedHtml,{fragment:true}) as unknown as Node;
  const expected=parsed.children?.find(node=>node.tagName==="picture")!;
  const shape=(node:Node)=>(node.children??[]).filter(child=>child.type==="element").map(child=>({tag:child.tagName,properties:child.properties}));
  if(fingerprint(shape(picture))!==fingerprint(shape(expected)))fail("CANDIDATE_PICTURE_SOURCE_SET_MISMATCH",3);
  sourceCount+=(picture.children??[]).filter(node=>node.tagName==="source").length;
 }
 if(sourceCount!==byTag("source").length)fail("CANDIDATE_SOURCE_OUTSIDE_PICTURE",3);
 const normalize=(value:string)=>value.replace(/\s+/gu," ").trim(),bodyText=normalize(candidateBodyText(root));
 walkReview(reviewTree(materials.analysis.compiled),node=>{
  const value=node as {type:string;value?:string};
  if(["text","inlineCode"].includes(value.type)&&value.value?.trim()&&!bodyText.includes(normalize(value.value)))fail("CANDIDATE_BODY_TEXT_MISSING",3);
 });
 const codeBlocks=byTag("pre").flatMap(node=>(node.children??[]).filter(child=>child.tagName==="code").map(text));
 const expectedCode:string[]=[];
 walkReview(reviewTree(materials.analysis.compiled),node=>{const value=node as {type:string;value?:string};if(value.type==="code")expectedCode.push(value.value??"");});
 if(fingerprint(codeBlocks.map(value=>value.replace(/\n$/u,"")))!==fingerprint(expectedCode.map(value=>value.replace(/\n$/u,""))))fail("CANDIDATE_CODE_CONTENT_MISMATCH",3);
 const structured=[];
 for(const script of byTag("script")){
  const src=prop(script,"src");
  if(src!==undefined){if(!["/scripts/mobile-menu.js","/scripts/code-copy.js"].includes(String(src)))fail("CANDIDATE_SCRIPT_UNREGISTERED",3);}
  else{
   if(prop(script,"type")!=="application/ld+json")fail("CANDIDATE_INLINE_EXECUTABLE_DENIED",3);
   structured.push(JSON.parse(text(script)));
  }
 }
 if(!materials.seo.noindex){
  const articles=structured.filter(item=>item["@type"]==="BlogPosting");
  if(articles.length!==1||articles[0].headline!==materials.frontmatter.title||articles[0].url!==materials.plannedSeo.canonical
   ||articles[0].datePublished!==materials.frontmatter.pubDate)fail("CANDIDATE_ARTICLE_METADATA_MISMATCH",3);
  if(materials.plannedSeo.image&&articles[0].image?.contentUrl!==materials.plannedSeo.image.url)fail("CANDIDATE_STRUCTURED_IMAGE_MISMATCH",3);
 }
 return {htmlSha256:sha256(html),displayedAssetIds:[...displayed].sort(),manualChecks:["実端末・支援技術・全文の読みやすさは本人reviewの対象です。"]};
}
export function candidatePreviewHeaders(htmls:readonly string[]){
 const scripts=new Set<string>(),styles=new Set<string>();
 for(const html of htmls){
  const root=fromHtml(html) as unknown as Node;
  const walk=(node:Node)=>{
   if(node.tagName==="script"&&prop(node,"src")===undefined)scripts.add("'sha256-"+Buffer.from(sha256(text(node)),"hex").toString("base64")+"'");
   if(node.tagName==="style")styles.add("'sha256-"+Buffer.from(sha256(text(node)),"hex").toString("base64")+"'");
   for(const child of node.children??[])walk(child);
  };walk(root);
 }
 return {"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow, noarchive","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff",
  "Content-Security-Policy":"default-src 'none'; script-src 'self' "+[...scripts].sort().join(" ")+"; style-src 'self' "+[...styles].sort().join(" ")+"; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; frame-src 'none'; worker-src 'none'; form-action 'self'"};
}
