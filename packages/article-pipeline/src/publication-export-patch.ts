import {fail} from "./private-files.js";
const guard='throw new Error("MOCK_EXPORT_NOT_FOR_NORMAL_BUILD");\n';
const marker="// xpotato-private-draft-preview-v1; simulation import only\n";
function inject(before:string,needle:string,entry:string,alias:string,path:string,mock=true){
 if(!mock&&(before.includes(guard)||before.includes(marker)))fail('EXPORT_MOCK_BASE_DENIED',3);
 let source=(before.startsWith(guard)?before.slice(guard.length):before).replace(marker,"");
 const line='import '+alias+' from "'+path+'";\n';
 source=source.replace(line,"").replace(entry,"");
 if(alias.startsWith("articleProvenance_"))source=source.replace(new RegExp('\\{contentId:'+alias+'(?:\\.record)?\\.contentId,provenanceSha256:"[a-f0-9]{64}"\\},',"gu"),"");
 if(source.split(needle).length!==2)fail("EXPORT_REGISTRY_PROJECTION_CONFLICT",3);
 return (mock?guard+marker:'')+line+source.replace(needle,needle+entry);
}
type RegistryInput={id:string;provenanceSha256:string;media:string;provenance:string;rights:string|null;redirects:string|null;routeChanged:boolean};
export const mockRegistryIndexChanges=(input:RegistryInput)=>registryIndexChanges(input,true);
export const publicationRegistryIndexChanges=(input:RegistryInput)=>registryIndexChanges(input,false);
function registryIndexChanges(input:RegistryInput,mock:boolean){
 const id=input.id.replaceAll("-","_"),mediaAlias="articleMedia_"+id,provAlias="articleProvenance_"+id,rightsAlias="articleRights_"+id;
 const result:Record<string,string>={};
 result["apps/site/src/content-registry/media/index.ts"]=inject(input.media,
  "export const mediaRegistries = Object.freeze([","contentMediaRegistrySchema.parse("+mediaAlias+(mock?".record":"")+"),",mediaAlias,"./blog/"+input.id+".json",mock);
 result["apps/site/src/content-registry/provenance/index.ts"]=inject(input.provenance,
  "export const publicationProvenanceRegistry: readonly ProvenanceRegistryEntry[] = Object.freeze([",
  '{contentId:'+provAlias+(mock?'.record':'')+'.contentId,provenanceSha256:"'+input.provenanceSha256+'"},',provAlias,"./blog/"+input.id+".json",mock);
 result["apps/site/src/content-registry/media-rights/index.ts"]=inject(input.rights??"export const articleMediaRights = Object.freeze({});\n",
  "export const articleMediaRights = Object.freeze({",'"'+input.id+'":'+rightsAlias+(mock?'.record':'')+',',rightsAlias,"./blog/"+input.id+".json",mock);
 if(input.routeChanged){
  if(input.redirects===null)fail("EXPORT_REDIRECT_BASE_REQUIRED",3);
  const alias="articleRedirect_"+id;
  result["apps/site/src/content-registry/redirects.ts"]=inject(input.redirects,
   "export const applicationRedirects = [","..."+alias+(mock?".record":"")+",",alias,"./article-redirects/"+input.id+".json",mock);
 }
 return result;
}
