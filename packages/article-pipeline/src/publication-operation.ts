import {mkdir} from "node:fs/promises";
import {join} from "node:path";
import {operationIntentSchema,type PublicationPort,type StoredObject,type Plane} from "./publication-contracts.js";
import {fingerprint,canonicalJson,sha256} from "./canonical.js";
import {safeRead,atomic,noLinks,fail} from "./private-files.js";
import {storedIdentity,mockPolicySha256} from "./publication-mock-port.js";

export type OperationBinding={candidateSha256:string;approvalSha256:string;attemptId:string;inputSha256:string};
export async function persistMockObject(input:{folder:string;binding:OperationBinding;port:PublicationPort;
 plane:Plane;key:string;object:StoredObject;fresh:()=>Promise<void>}){
 const {folder,binding,port,plane,key,object,fresh}=input;
 if(port.mode!=="mock"||!port.capabilities[plane])fail("MOCK_PERSISTENCE_CAPABILITY_REQUIRED",3);
 const metadataSha256=fingerprint({contentType:object.contentType,cacheControl:object.cacheControl,
  policySha256:object.policySha256,protectedRef:object.protectedRef});
 const body={protocol:"xpotato-private-media-operation-v1" as const,mode:"mock" as const,...binding,
  plane,key,objectSha256:sha256(object.bytes),metadataSha256,policySha256:port.policySha256};
 const id=fingerprint(body),path=join(folder,"operations",id+".json");
 let prior:ReturnType<typeof operationIntentSchema.parse>|null=null;
 try{prior=operationIntentSchema.parse(JSON.parse(await safeRead(path)));}
 catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
 if(prior){const {status,...existing}=prior;if(fingerprint(existing)!==id)fail("PUBLICATION_INTENT_BINDING_INVALID",3);}
 await fresh();
 const before=await port.read(plane,key);
 if(before.status==="absent"&&before.authoritative!==true)fail("PUBLICATION_READ_UNKNOWN_STOP",4);
 if(before.status==="unknown")fail("PUBLICATION_READ_UNKNOWN_STOP",4);
 if(before.status==="found"&&storedIdentity(before.object)!==storedIdentity(object))fail("PUBLICATION_IMMUTABLE_OBJECT_CONFLICT",3);
 if(prior?.status==="verified"&&before.status==="absent")fail("PUBLICATION_VERIFIED_OBJECT_MISSING",3);
 let action:"uploaded"|"reused"="reused";
 if(before.status==="absent"){
  // Authoritative absence is required even when recovering a pending/unknown write.
  await noLinks(path);await mkdir(join(folder,"operations"),{recursive:true,mode:0o700});
  await atomic(path,canonicalJson({...body,status:"pending"})+"\n");
  await fresh();
  if(!port.capabilities[plane]||port.policySha256!==mockPolicySha256||object.policySha256!==port.policySha256)fail("MOCK_PROVIDER_GATE_CLOSED",3);
  let outcome:"written"|"reused"|"unknown";
  try{outcome=await port.putIfAbsent(plane,key,object);}catch{outcome="unknown";}
  action=outcome==="written"?"uploaded":"reused"; // Reconciled unknown cannot prove which writer created the object.
 }
 const after=await port.read(plane,key);
 if(after.status!=="found")fail("PUBLICATION_WRITE_RESULT_UNKNOWN_STOP",4);
 if(!port.capabilities[plane]||port.policySha256!==mockPolicySha256)fail("MOCK_PROVIDER_GATE_CLOSED",3);
 if(storedIdentity(after.object)!==storedIdentity(object))fail("PUBLICATION_READBACK_MISMATCH",3);
 await fresh();
 await mkdir(join(folder,"operations"),{recursive:true,mode:0o700});
 await atomic(path,canonicalJson({...body,status:"verified"})+"\n");
 return {action,verifiedAt:new Date().toISOString()};
}
