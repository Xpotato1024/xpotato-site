import {z} from "zod";
import {articleMediaTargets} from "@xpotato/content-contracts/article-media-targets";
import {sha256Schema,stableIdSchema} from "@xpotato/content-contracts";
import {RuntimeOperationJournal} from "./runtime-journal.js";
import {immutableBytes,noLinks,safeReadBytes} from "./private-files.js";
import {mkdir} from "node:fs/promises";
import {join} from "node:path";
import {runtimeDeadline} from "./runtime-deadline.js";
import {fingerprint,sha256} from "./canonical.js";
import type {MediaReadbackPort} from "./media-readback.js";
import type {ObjectRead,Plane,StoredObject} from "./publication-contracts.js";

const objectSchema=z.object({plane:z.enum(["source","public","protected"]),key:z.string().max(256),sha256:sha256Schema,
 sizeBytes:z.number().int().positive().max(24*1024*1024),contentType:z.string().max(64),cacheControl:z.string().max(128)}).strict();
export const mediaWriteSessionDescriptorSchema=z.object({schemaVersion:z.literal(1),sessionId:stableIdSchema.max(120),
 authorityRevision:z.string().regex(/^[a-f0-9]{40}$/u),expiresAt:z.iso.datetime({offset:true}),
 binding:z.object({jobId:stableIdSchema,jobFingerprint:sha256Schema,candidateSha256:sha256Schema,approvalSha256:sha256Schema,attemptId:stableIdSchema,
  inputSha256:sha256Schema,policySha256:sha256Schema}).strict(),
 objects:z.array(objectSchema).min(1).max(512)}).strict();
export type MediaWriteSessionDescriptor=z.infer<typeof mediaWriteSessionDescriptorSchema>;
export type MediaWriteObject=z.infer<typeof objectSchema>;
const keyPattern=/^(source|media)\/v1\/objects\/sha256\/([a-f0-9]{2})\/([a-f0-9]{64})\.(webp|svg|png|jpg|jpeg|avif)$/u;
export function inspectMediaWriteSession(input:unknown,now=Date.now()){
 const d=mediaWriteSessionDescriptorSchema.parse(input),expires=Date.parse(d.expiresAt);
 if(d.authorityRevision!==articleMediaTargets.authority.revision||!Number.isFinite(now)||expires<=now||expires-now>900000)throw Error("MEDIA_WRITE_SESSION_INVALID");
 const keys=new Set<string>();
 for(const o of d.objects){
  const m=keyPattern.exec(o.key),id=o.plane+":"+o.key;
  if(!m||m[2]!==o.sha256.slice(0,2)||m[3]!==o.sha256||m[1]!==(o.plane==="source"?"source":"media")
   ||o.plane==="source"&&!["webp","svg"].includes(m[4]!))throw Error("MEDIA_WRITE_KEY_INVALID");
  const format=m[4]==="jpg"?"jpeg":m[4],mime=format==="svg"?"image/svg+xml":"image/"+format;
  if(o.contentType!==mime||o.cacheControl!==(o.plane==="public"?articleMediaTargets.public.cacheControl:"private, no-store")||keys.has(id))throw Error("MEDIA_WRITE_OBJECT_SET_INVALID");
  keys.add(id);
 }
 return d;
}

/** Trusted Server/operator code owns signing, exact-key grants, authoritative
 * absence and approval revalidation. These callbacks cannot come from JSON.
 * Descriptor validation is not live policy/credential/resource verification.
 */
export interface ServerMediaWriteSession{
 readonly descriptor:MediaWriteSessionDescriptor;
 readonly privateOrigins:readonly string[];
 assertApproved(binding:MediaWriteSessionDescriptor["binding"],plane:Plane,signal:AbortSignal):Promise<void>;
 policy:MediaReadbackPort["policy"];
 inspect(plane:Plane,key:string,maxBytes:number,signal:AbortSignal):Promise<ObjectRead>;
 authorizePut(plane:Plane,key:string,signal:AbortSignal):Promise<{
  plane:Plane;key:string;method:"PUT";url:string;headers:Readonly<Record<string,string>>;
 }|null>;
}
export type MediaStoreOutcome={status:"verified";action:"uploaded"|"reused";verifiedAt:string;objectSha256:string}|{status:"unknown"|"conflict"};

export function createServerConditionalMediaWriter(input:{session:ServerMediaWriteSession;fetcher:typeof fetch;mode:"test_fixture"|"operator_runtime"}){
 const session=input.session,descriptor=inspectMediaWriteSession(session.descriptor),origins=new Set<string>();
 if(session.privateOrigins.length<1||session.privateOrigins.length>3)throw Error("MEDIA_WRITE_ORIGIN_INVALID");
 for(const text of session.privateOrigins){try{const u=new URL(text);if(u.protocol!=="https:"||u.username||u.password||u.pathname!=="/"||u.search||u.hash||u.port||!u.hostname.endsWith(".r2.cloudflarestorage.com"))throw Error();origins.add(u.origin);}catch{throw Error("MEDIA_WRITE_ORIGIN_INVALID");}}
 const policy=async(plane:Plane,signal:AbortSignal)=>{
  inspectMediaWriteSession(descriptor);signal.throwIfAborted();await session.assertApproved(structuredClone(descriptor.binding),plane,signal);signal.throwIfAborted();
  const p=await session.policy(signal);signal.throwIfAborted();const age=p.status==="found"?Date.now()-Date.parse(p.observedAt):NaN;
  if(p.status!=="found"||p.authorityRevision!==descriptor.authorityRevision||p.fingerprint!==descriptor.binding.policySha256
   ||!Number.isFinite(age)||age<0||age>300000||!p.sourcePrivate||!p.protectedPrivate||!p.protectedIndefiniteLock||p.automaticExpiration||!p.writersSeparated)throw Error("MEDIA_WRITE_POLICY_REQUIRED");
 };
 const matches=(actual:StoredObject,expected:MediaWriteObject)=>sha256(actual.bytes)===expected.sha256&&actual.bytes.length===expected.sizeBytes
  &&actual.contentType===expected.contentType&&actual.cacheControl===expected.cacheControl&&actual.policySha256===descriptor.binding.policySha256
  &&actual.protectedRef===(expected.plane==="protected"?"site-protected-v1:sha256:"+expected.sha256+":"+expected.key.split(".").at(-1):null);
 return {get descriptor(){return structuredClone(descriptor);},
  async verifyStored(plane:Plane,key:string,outer?:AbortSignal){
   if(input.mode!=="test_fixture")throw Error("MEDIA_LIVE_ACTIVATION_NOT_ESTABLISHED");
   return runtimeDeadline(10000,outer,async signal=>{const expected=descriptor.objects.find(o=>o.plane===plane&&o.key===key);if(!expected)throw Error("MEDIA_WRITE_NOT_ADMITTED");await policy(plane,signal);const object=await session.inspect(plane,key,expected.sizeBytes+1,signal);signal.throwIfAborted();if(object.status!=="found"||!matches(object.object,expected))throw Error("MEDIA_WRITE_READBACK_REQUIRED");await policy(plane,signal);});
  },
  async assertReady(plane:Plane,signal:AbortSignal){if(input.mode!=="test_fixture")throw Error("MEDIA_LIVE_ACTIVATION_NOT_ESTABLISHED");await policy(plane,signal);},
  async store(plane:Plane,key:string,bytesInput:Uint8Array,outerSignal?:AbortSignal):Promise<MediaStoreOutcome>{
  if(input.mode!=="test_fixture")throw Error("MEDIA_LIVE_ACTIVATION_NOT_ESTABLISHED");
  const expected=descriptor.objects.find(o=>o.plane===plane&&o.key===key),bytes=new Uint8Array(bytesInput);
  if(!expected||sha256(bytes)!==expected.sha256||bytes.length!==expected.sizeBytes)throw Error("MEDIA_WRITE_NOT_ADMITTED");
  const control=new AbortController(),abort=()=>control.abort();outerSignal?.addEventListener("abort",abort,{once:true});
  let timer:ReturnType<typeof setTimeout>|undefined,stop:(()=>void)|undefined;
  const expired=new Promise<MediaStoreOutcome>(resolve=>{stop=()=>resolve({status:"unknown"});control.signal.addEventListener("abort",stop,{once:true});timer=setTimeout(abort,10000);if(outerSignal?.aborted)abort();});
  const operation=async():Promise<MediaStoreOutcome>=>{try{
   const signal=control.signal;await policy(plane,signal);
   const before=await session.inspect(plane,key,expected.sizeBytes+1,signal);signal.throwIfAborted();
   if(before.status==="found"){
    if(!matches(before.object,expected))return {status:"conflict"};await policy(plane,signal);
    return {status:"verified",action:"reused",verifiedAt:new Date().toISOString(),objectSha256:expected.sha256};
   }
   if(before.status!=="absent"||before.authoritative!==true)return {status:"unknown"};
   if(plane==="protected"){const source=descriptor.objects.find(o=>o.plane==="public"&&o.key===key);if(!source)throw Error("MEDIA_PUBLIC_SOURCE_REQUIRED");const read=await session.inspect("public",key,source.sizeBytes+1,signal);signal.throwIfAborted();if(read.status!=="found"||!matches(read.object,source)||source.sha256!==expected.sha256||source.sizeBytes!==expected.sizeBytes)throw Error("MEDIA_PUBLIC_SOURCE_REQUIRED");}
   const grant=await session.authorizePut(plane,key,signal);signal.throwIfAborted();
   if(!grant||grant.plane!==plane||grant.key!==key||grant.method!=="PUT")throw Error("MEDIA_WRITE_GRANT_INVALID");
   const url=new URL(grant.url),headers=new Headers(grant.headers);
   // R2 path-style grants must address one bucket plus the exact admitted key.
   // The Server owns the bucket identity; matching grant metadata alone must
   // not allow a different object path on the same approved account origin.
   const prefix=url.pathname.slice(0,-key.length);
   if(url.protocol!=="https:"||url.username||url.password||url.hash||!origins.has(url.origin)
    ||!url.pathname.endsWith("/"+key)||!/^\/[^/%]+\/$/u.test(prefix)
    ||headers.get("if-none-match")!=="*"||headers.get("content-type")!==expected.contentType||headers.get("cache-control")!==expected.cacheControl
    ||headers.has("cookie")||headers.has("proxy-authorization"))throw Error("MEDIA_WRITE_GRANT_INVALID");
   // Recheck after asynchronous authorization; an expired/revoked grant must
   // not start a PUT. No header or signature is added to a Server grant.
   await policy(plane,signal);signal.throwIfAborted();
   const response=await input.fetcher(url.href,{method:"PUT",headers,body:Uint8Array.from(bytes).buffer,redirect:"error",credentials:"omit",signal});
   await response.body?.cancel().catch(()=>{});signal.throwIfAborted();
   if(response.redirected||![200,201,204,412].includes(response.status))return {status:"unknown"};
   const after=await session.inspect(plane,key,expected.sizeBytes+1,signal);signal.throwIfAborted();
   if(after.status!=="found")return {status:"unknown"};if(!matches(after.object,expected))return {status:"conflict"};
   await policy(plane,signal);
   return {status:"verified",action:response.status===412?"reused":"uploaded",verifiedAt:new Date().toISOString(),objectSha256:expected.sha256};
  }catch{return {status:"unknown"};}};
  try{return await Promise.race([operation(),expired]);}finally{clearTimeout(timer);if(stop)control.signal.removeEventListener("abort",stop);outerSignal?.removeEventListener("abort",abort);}
 }};
}

/** Sidecar plan identity includes exact candidate/approval/policy and complete
 * physical object metadata. It is never a MediaPublicationManifest/receipt.
 */
export const mediaWritePlanSha256=(descriptor:MediaWriteSessionDescriptor)=>fingerprint(inspectMediaWriteSession(descriptor));

export const mediaRuntimeLimits=Object.freeze({total:512,perStage:{source:512,public:512,protected:512}});
export async function storeMediaObjectWithJournal(input:{writer:ReturnType<typeof createServerConditionalMediaWriter>;
 journal:RuntimeOperationJournal;plane:Plane;key:string;bytes:Uint8Array;signal?:AbortSignal}){
 const d=inspectMediaWriteSession(input.writer.descriptor),object=d.objects.find(o=>o.plane===input.plane&&o.key===input.key);
 if(!object||sha256(input.bytes)!==object.sha256||input.bytes.length!==object.sizeBytes)throw Error("MEDIA_WRITE_NOT_ADMITTED");
 if(fingerprint(input.journal.job)!==fingerprint({jobId:d.binding.jobId,jobFingerprint:d.binding.jobFingerprint})
  ||fingerprint(input.journal.limits)!==fingerprint(mediaRuntimeLimits))throw Error("MEDIA_WRITE_JOURNAL_BINDING_INVALID");
 const operationId="media-"+input.plane+"-"+sha256(input.key),contextSha256=fingerprint({binding:d.binding,object});
 const result=await input.journal.run({operationId,kind:"media",stage:input.plane,attemptId:d.binding.attemptId,
  inputSha256:d.binding.inputSha256,contextSha256},{timeoutMs:30000,signal:input.signal,
  preflight:signal=>input.writer.assertReady(input.plane,signal),execute:async signal=>{
   const stored=await input.writer.store(input.plane,input.key,input.bytes,signal);
   if(stored.status!=="verified")throw Error("MEDIA_WRITE_NOT_VERIFIED");
   const record={protocol:"xpotato-media-transport-outcome-v1",scope:"test_fixture",contextSha256,stored,productionEligible:false},bytes=Buffer.from(JSON.stringify(record));
   const folder=join(input.journal.directory,operationId);await noLinks(folder);await mkdir(folder,{recursive:true,mode:0o700});
   await immutableBytes(join(folder,"output-"+sha256(bytes)+".json"),bytes);return {outputSha256:sha256(bytes)};
  }});
 if(result.state==="verified"){
  const bytes=await safeReadBytes(join(input.journal.directory,operationId,"output-"+result.outputSha256+".json"));
  if(sha256(bytes)!==result.outputSha256||JSON.parse(bytes.toString("utf8")).contextSha256!==contextSha256)throw Error("MEDIA_WRITE_SIDECAR_INVALID");
  await input.writer.verifyStored(input.plane,input.key,input.signal);
 }
 return {...result,scope:"test_fixture" as const,formalStorageReceipt:false as const};
}
