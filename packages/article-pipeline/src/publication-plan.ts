import {join} from "node:path";
import {safeReadBytes,fail} from "./private-files.js";
import {sha256,fingerprint} from "./canonical.js";
import {mockPolicySha256,mockProtectedPrefix} from "./publication-mock-port.js";
import type {StoredObject,Plane} from "./publication-contracts.js";
import type {PublicationContext} from "./publication-approval.js";

export async function candidateObjectPlan(c:PublicationContext,policySha256:string,protectedReference:(key:string,sha256:string)=>string){
 const source=new Map<string,StoredObject>(),delivery=new Map<string,StoredObject>();
 for(const item of c.materials.storagePlan.sourceObjects){
  const asset=c.v.masters!.assets.find(asset=>asset.ingest.canonicalMaster.sha256===item.sha256);
  if(!asset)fail("PUBLICATION_CANONICAL_OBJECT_MISSING",3);
  const bytes=await safeReadBytes(join(c.v.folder,asset.ingest.canonicalMaster.privateRelativePath));
  if(sha256(bytes)!==item.sha256||bytes.length!==item.sizeBytes)fail("PUBLICATION_SOURCE_BYTES_CHANGED",3);
  source.set(item.objectKey,{bytes,contentType:"image/"+(asset.ingest.canonicalMaster.format==="svg"?"svg+xml":"webp"),
   cacheControl:"private, no-store",policySha256,protectedRef:null});
 }
 for(const item of c.materials.storagePlan.publicObjects){
  const local=c.v.media!.localObjects.find(local=>local.sha256===item.sha256);
  if(!local)fail("PUBLICATION_DELIVERY_OBJECT_MISSING",3);
  const bytes=await safeReadBytes(join(c.v.folder,local.path));
  if(sha256(bytes)!==item.sha256||bytes.length!==item.sizeBytes||local.contentType!==item.contentType)
   fail("PUBLICATION_DELIVERY_BYTES_CHANGED",3);
  const object={bytes,contentType:item.contentType,cacheControl:item.cacheControl,policySha256,protectedRef:null};
  if(delivery.has(item.objectKey)&&fingerprint(delivery.get(item.objectKey))!==fingerprint(object))fail("PUBLICATION_KEY_CONFLICT",3);
  delivery.set(item.objectKey,object);
 }
 const protectedObjects=new Map([...delivery].map(([key,value])=>[key,{...value,cacheControl:"private, no-store",
  protectedRef:protectedReference(key,sha256(value.bytes))}]));
 return {source,public:delivery,protected:protectedObjects} satisfies Record<Plane,Map<string,StoredObject>>;
}
export const mockObjectPlan=(c:PublicationContext)=>candidateObjectPlan(c,mockPolicySha256,key=>mockProtectedPrefix+sha256(key));
