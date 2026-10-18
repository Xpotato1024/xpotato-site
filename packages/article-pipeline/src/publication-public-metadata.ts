import {mediaRightsRecordSchema,type MediaRightsRecord} from "@xpotato/content-contracts";
import {containsHardDenyMaterial} from "./disclosure.js";
import {canonicalJson} from "./canonical.js";
import {fail} from "./private-files.js";
export function assertPublicPublicationMetadata(value:unknown){
 if(containsHardDenyMaterial(Buffer.from(canonicalJson(value))))fail("EXPORT_SECRET_METADATA_DENIED",3);
 const scan=(item:unknown,key=""):void=>{
  if(typeof item==="string"){
   const validateUrl=(text:string)=>{
    const url=new URL(text);
    if(url.protocol!=="https:"||url.username||url.password||[...url.searchParams.keys()].some(key=>/token|secret|sig|credential|key|auth|session|code/iu.test(key)))
     fail("EXPORT_CAPABILITY_OR_UNSAFE_URL_DENIED",3);
   };
   if(/url$/iu.test(key))validateUrl(item);
   const text=item.replace(/\b[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s<>"')]+/gu,url=>{validateUrl(url);return "<public-url>";});
   const route=key==="route"&&/^\/(?:blog|tools)\/[a-z0-9-]+\/$/u.test(text);
   if(!route&&(/(?:[A-Za-z]:[\\/]|\\\\[^\\\s]+\\)/u.test(text)
    ||/(?:^|[^\p{L}\p{N}_])\/(?!\/)[^\s<>"']+/u.test(text)))
    fail("EXPORT_PRIVATE_LOCATOR_DENIED",3);
  }else if(item&&typeof item==="object")for(const [child,value] of Object.entries(item))scan(value,child);
 };
 scan(value);
}
export function assertPublicationRights(records:readonly MediaRightsRecord[]){
 for(const input of records){
  const record=mediaRightsRecordSchema.parse(input);
  if(!record.publicationAuthorized||record.basis==="unknown"||Date.parse(record.confirmedAt)>Date.now())fail("PUBLICATION_RIGHTS_UNCONFIRMED",3);
  if(["licensed","public_domain"].includes(record.basis)&&(!record.ownerOrSource||!record.licenseId&&!record.licenseUrl))
   fail("PUBLICATION_LICENSE_METADATA_REQUIRED",3);
 }
 assertPublicPublicationMetadata(records);
}
