import {mkdir} from "node:fs/promises";
import {join} from "node:path";
import {canonicalJson,fingerprint,sha256} from "./canonical.js";
import {immutable,immutableBytes,safeRead,safeReadBytes,noLinks,fail} from "./private-files.js";
import type {PublicationPort,StoredObject,ObjectRead,Plane} from "./publication-contracts.js";
export const mockProtectedPrefix="mock-only-protected-";
export const mockProtectionPolicy=Object.freeze({protocol:"xpotato-private-mock-policy-v1",
 separatePlanes:true,privateProtected:true,indefiniteLock:true,automaticExpiration:false});
export const mockPolicySha256=fingerprint(mockProtectionPolicy);
const encode=(value:StoredObject)=>({contentType:value.contentType,cacheControl:value.cacheControl,
 policySha256:value.policySha256,protectedRef:value.protectedRef});
export const storedIdentity=(value:StoredObject)=>{
 if(!Buffer.isBuffer(value.bytes))fail("PUBLICATION_OBJECT_BYTES_INVALID",3);
 return fingerprint({sha256:sha256(value.bytes),size:value.bytes.length,...encode(value)});
};
export class MemoryMockPublicationPort implements PublicationPort{
 readonly mode="mock" as const;readonly policySha256=mockPolicySha256;
 readonly capabilities={source:true,public:true,protected:true};
 readonly objects=new Map<string,StoredObject>();readonly calls:string[]=[];
 fault:"none"|"before_write"|"after_write"|"read_unknown"="none";
 async read(plane:Plane,key:string):Promise<ObjectRead>{
  this.calls.push("read:"+plane+":"+key);
  if(this.fault==="read_unknown")return {status:"unknown"};
  const object=this.objects.get(plane+":"+key);
  return object?{status:"found",object:{...object,bytes:Buffer.from(object.bytes)}}:{status:"absent",authoritative:true};
 }
 async putIfAbsent(plane:Plane,key:string,object:StoredObject){
  this.calls.push("put:"+plane+":"+key);
  const fault=this.fault;if(fault!=="read_unknown")this.fault="none";
  if(fault==="before_write")return "unknown" as const;
  const prior=this.objects.get(plane+":"+key);
  if(prior&&storedIdentity(prior)!==storedIdentity(object))fail("MOCK_IMMUTABLE_KEY_CONFLICT",3);
  if(prior)return "reused" as const;
  this.objects.set(plane+":"+key,{...object,bytes:Buffer.from(object.bytes)});
  return fault==="after_write"?"unknown" as const:"written" as const;
 }
}
// The only concrete persistence adapter is a private local mock. No network/credential/provider API exists here.
export class DirectoryMockPublicationPort implements PublicationPort{
 readonly mode="mock" as const;readonly policySha256=mockPolicySha256;
 readonly capabilities={source:true,public:true,protected:true};
 constructor(readonly root:string){}
 private folder(plane:Plane,key:string){return join(this.root,plane,sha256(key));}
 async read(plane:Plane,key:string):Promise<ObjectRead>{
  const folder=this.folder(plane,key);
  let meta:string;
  try{meta=await safeRead(join(folder,"object.json"));}
  catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT"){
   try{await safeReadBytes(join(folder,"bytes.bin"));return {status:"unknown"};}
   catch(second){if((second as NodeJS.ErrnoException).code==="ENOENT")return {status:"absent",authoritative:true};throw second;}
  }throw error;}
  const parsed=JSON.parse(meta);
  if(parsed.protocol!=="xpotato-private-mock-object-v1"||parsed.plane!==plane||parsed.key!==key)fail("MOCK_OBJECT_BINDING_INVALID",3);
  try{return {status:"found",object:{bytes:await safeReadBytes(join(folder,"bytes.bin")),
   contentType:parsed.contentType,cacheControl:parsed.cacheControl,policySha256:parsed.policySha256,protectedRef:parsed.protectedRef}};}
  catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return {status:"unknown"};throw error;}
 }
 async putIfAbsent(plane:Plane,key:string,object:StoredObject){
  const folder=this.folder(plane,key);await noLinks(folder);
  await mkdir(join(this.root,plane),{recursive:true,mode:0o700});
  try{await mkdir(folder,{mode:0o700});}
  catch(error){
   if((error as NodeJS.ErrnoException).code!=="EEXIST")throw error;
   const prior=await this.read(plane,key);
   if(prior.status!=="found")return "unknown" as const;
   if(storedIdentity(prior.object)!==storedIdentity(object))fail("MOCK_IMMUTABLE_KEY_CONFLICT",3);
   return "reused" as const;
  }
  await immutable(join(folder,"object.json"),canonicalJson({protocol:"xpotato-private-mock-object-v1",plane,key,...encode(object)})+"\n");
  await immutableBytes(join(folder,"bytes.bin"),object.bytes);return "written" as const;
 }
}
