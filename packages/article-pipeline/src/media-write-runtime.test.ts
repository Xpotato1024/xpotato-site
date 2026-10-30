import {it,expect,vi} from "vitest";
import {mkdtemp} from "node:fs/promises";import {tmpdir} from "node:os";import {join} from "node:path";
import {articleMediaTargets} from "@xpotato/content-contracts/article-media-targets";
import {createServerConditionalMediaWriter,inspectMediaWriteSession,storeMediaObjectWithJournal,mediaRuntimeLimits,type ServerMediaWriteSession,type MediaWriteSessionDescriptor} from "./media-write-runtime.js";
import {RuntimeOperationJournal} from "./runtime-journal.js";
import {sha256} from "./canonical.js";import type {Plane,StoredObject,ObjectRead} from "./publication-contracts.js";
const bytes=Buffer.from("inert-contract-fixture"),hash=sha256(bytes),key="media/v1/objects/sha256/"+hash.slice(0,2)+"/"+hash+".png",h="a".repeat(64);
function setup(){
 const descriptor:MediaWriteSessionDescriptor={schemaVersion:1,sessionId:"fixture-session",authorityRevision:articleMediaTargets.authority.revision,expiresAt:new Date(Date.now()+60000).toISOString(),binding:{jobId:"job-1",jobFingerprint:h,candidateSha256:h,approvalSha256:h,attemptId:"attempt-1",inputSha256:h,policySha256:h},objects:[
  {plane:"public",key,sha256:hash,sizeBytes:bytes.length,contentType:"image/png",cacheControl:articleMediaTargets.public.cacheControl},
  {plane:"protected",key,sha256:hash,sizeBytes:bytes.length,contentType:"image/png",cacheControl:"private, no-store"}]};
 const stored=new Map<string,StoredObject>(),object=(plane:Plane):StoredObject=>({bytes:Buffer.from(bytes),contentType:"image/png",cacheControl:plane==="public"?articleMediaTargets.public.cacheControl:"private, no-store",policySha256:h,protectedRef:plane==="protected"?"site-protected-v1:sha256:"+hash+":png":null});
 const inspect=vi.fn(async(plane:Plane,k:string):Promise<ObjectRead>=>{const o=stored.get(plane+":"+k);return o?{status:"found",object:structuredClone(o)}:{status:"absent",authoritative:true};});
 const policy=vi.fn(async()=>({status:"found" as const,authorityRevision:articleMediaTargets.authority.revision,observedAt:new Date().toISOString(),fingerprint:h,sourcePrivate:true,protectedPrivate:true,protectedIndefiniteLock:true,automaticExpiration:false,writersSeparated:true}));
 const approve=vi.fn(async()=>{}),grant=vi.fn(async(plane:Plane,k:string)=>({plane,key:k,method:"PUT" as const,url:"https://account.r2.cloudflarestorage.com/"+plane+"/"+k+"?sig=fixture-only",headers:{"if-none-match":"*","content-type":"image/png","cache-control":plane==="public"?articleMediaTargets.public.cacheControl:"private, no-store"}}));
 const session:ServerMediaWriteSession={descriptor,privateOrigins:["https://account.r2.cloudflarestorage.com"],assertApproved:approve,policy,inspect,authorizePut:grant};
 const fetcher=vi.fn(async(url:string|URL|Request,init?:RequestInit)=>{const plane=new URL(String(url)).pathname.split("/")[1] as Plane;stored.set(plane+":"+key,{...object(plane),bytes:Buffer.from(init!.body as ArrayBuffer)});return new Response(null,{status:201});});
 return {descriptor,stored,object,inspect,policy,approve,grant,fetcher,session,writer:()=>createServerConditionalMediaWriter({session,fetcher:fetcher as typeof fetch,mode:"test_fixture"})};
}
it("constructs without I/O and conditionally creates only exact admitted bytes with mandatory readback",async()=>{
 const x=setup(),w=x.writer();expect(x.fetcher).not.toHaveBeenCalled();expect(x.approve).not.toHaveBeenCalled();
 expect(await w.store("public",key,bytes)).toMatchObject({status:"verified",action:"uploaded",objectSha256:hash});
 const [url,request]=x.fetcher.mock.calls[0]!;expect(String(url)).toContain("/public/"+key);expect(request).toMatchObject({method:"PUT",redirect:"error",credentials:"omit"});expect(new Headers(request!.headers).get("if-none-match")).toBe("*");
 expect(x.inspect).toHaveBeenCalledTimes(2);expect(x.approve.mock.calls.length).toBeGreaterThanOrEqual(3);
 await expect(w.store("public",key,Buffer.from("wrong"))).rejects.toThrow("NOT_ADMITTED");expect(x.fetcher).toHaveBeenCalledTimes(1);
});
it("reuses matching objects, stops on collision/unknown and never overwrites",async()=>{
 const x=setup();x.stored.set("public:"+key,x.object("public"));expect(await x.writer().store("public",key,bytes)).toMatchObject({status:"verified",action:"reused"});expect(x.fetcher).not.toHaveBeenCalled();
 x.stored.set("public:"+key,{...x.object("public"),bytes:Buffer.from("collision")});expect(await x.writer().store("public",key,bytes)).toEqual({status:"conflict"});
 x.inspect.mockResolvedValue({status:"unknown"});expect(await x.writer().store("public",key,bytes)).toEqual({status:"unknown"});expect(x.fetcher).not.toHaveBeenCalled();
});
it("rejects wrong grants or unsafe policy before PUT and keeps live activation closed",async()=>{
 for(const change of [{key:"another"},{plane:"source"},{url:"https://other.r2.cloudflarestorage.com/object"},{url:"https://account.r2.cloudflarestorage.com/public/another-object"},{url:"https://account.r2.cloudflarestorage.com/"+key},{url:"http://127.0.0.1/object"},{headers:{"if-none-match":"not-star"}}]){
  const x=setup(),original=x.grant.getMockImplementation()!;x.grant.mockImplementation(async(p,k)=>({...await original(p,k),...change}) as any);
  expect(await x.writer().store("public",key,bytes)).toEqual({status:"unknown"});expect(x.fetcher).not.toHaveBeenCalled();
 }
 const x=setup();x.policy.mockResolvedValue({...await x.policy(),protectedIndefiniteLock:false});expect(await x.writer().store("public",key,bytes)).toEqual({status:"unknown"});expect(x.grant).not.toHaveBeenCalled();
 const y=setup(),w=createServerConditionalMediaWriter({session:y.session,fetcher:y.fetcher as typeof fetch,mode:"operator_runtime"});await expect(w.store("public",key,bytes)).rejects.toThrow("LIVE_ACTIVATION");expect(y.approve).not.toHaveBeenCalled();
});
it("requires verified public bytes before protected writes and verifies the protected reference",async()=>{
 const x=setup();expect(await x.writer().store("protected",key,bytes)).toEqual({status:"unknown"});expect(x.fetcher).not.toHaveBeenCalled();
 x.stored.set("public:"+key,x.object("public"));expect(await x.writer().store("protected",key,bytes)).toMatchObject({status:"verified",action:"uploaded"});expect(x.stored.get("protected:"+key)?.protectedRef).toBe("site-protected-v1:sha256:"+hash+":png");
});
it("cancels a delayed grant without a later PUT and rejects expiry after signing",async()=>{
 const x=setup(),c=new AbortController();let finish:((v:any)=>void)|undefined;
 x.grant.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const running=x.writer().store("public",key,bytes,c.signal);
 for(let n=0;n<100&&!finish;n++)await new Promise(r=>setTimeout(r,1));c.abort();expect(await running).toEqual({status:"unknown"});finish?.({plane:"public",key,method:"PUT",url:"https://account.r2.cloudflarestorage.com/object",headers:{}});await Promise.resolve();expect(x.fetcher).not.toHaveBeenCalled();
 vi.useFakeTimers({toFake:["Date"]});try{const y=setup(),original=y.grant.getMockImplementation()!;y.grant.mockImplementation(async(p,k)=>{const g=await original(p,k);vi.setSystemTime(Date.now()+70000);return g;});expect(await y.writer().store("public",key,bytes)).toEqual({status:"unknown"});expect(y.fetcher).not.toHaveBeenCalled();}finally{vi.useRealTimers();}
});
it("journals verified writes, rechecks reuse and preserves unknown without resending",async()=>{
 const x=setup(),directory=await mkdtemp(join(tmpdir(),"media-runtime-")),journal=new RuntimeOperationJournal(directory,{jobId:"job-1",jobFingerprint:h},mediaRuntimeLimits),writer=x.writer();
 const args={writer,journal,plane:"public" as const,key,bytes};expect(await storeMediaObjectWithJournal(args)).toMatchObject({state:"verified",reused:false,formalStorageReceipt:false});
 expect(await storeMediaObjectWithJournal(args)).toMatchObject({state:"verified",reused:true});expect(x.fetcher).toHaveBeenCalledTimes(1);
 x.stored.clear();await expect(storeMediaObjectWithJournal(args)).rejects.toThrow("READBACK_REQUIRED");expect(x.fetcher).toHaveBeenCalledTimes(1);
 const y=setup();y.fetcher.mockRejectedValue(Error("Authorization: do-not-persist"));const j=new RuntimeOperationJournal(await mkdtemp(join(tmpdir(),"media-unknown-")),{jobId:"job-1",jobFingerprint:h},mediaRuntimeLimits),a={...args,writer:y.writer(),journal:j};expect(await storeMediaObjectWithJournal(a)).toMatchObject({state:"unknown"});await expect(storeMediaObjectWithJournal(a)).rejects.toThrow("NO_RESEND");expect(y.fetcher).toHaveBeenCalledTimes(1);
});
it("distinguishes desired descriptors from observation and rejects malformed or expired plans",()=>{
 const x=setup();expect(inspectMediaWriteSession(x.descriptor).objects).toHaveLength(2);
 for(const d of [{...x.descriptor,expiresAt:new Date(Date.now()-1).toISOString()},{...x.descriptor,authorityRevision:"b".repeat(40)},{...x.descriptor,objects:[x.descriptor.objects[0],x.descriptor.objects[0]]}])expect(()=>inspectMediaWriteSession(d)).toThrow();
});
it("does not let a returned descriptor mutate the approval binding used by writer or journal",async()=>{
 const x=setup(),writer=x.writer(),copy=writer.descriptor;copy.binding.candidateSha256="b".repeat(64);copy.binding.approvalSha256="c".repeat(64);
 expect(writer.descriptor.binding).toEqual(x.descriptor.binding);
 expect(Reflect.set(writer,"descriptor",copy)).toBe(false);
 const journal=new RuntimeOperationJournal(await mkdtemp(join(tmpdir(),"media-binding-")),{jobId:"job-1",jobFingerprint:h},mediaRuntimeLimits);
 expect(await storeMediaObjectWithJournal({writer,journal,plane:"public",key,bytes})).toMatchObject({state:"verified"});
 expect(x.approve.mock.calls.every(([binding]:any[])=>binding.candidateSha256===h&&binding.approvalSha256===h)).toBe(true);
});
it("sanitizes callback failures at preflight and readback API boundaries",async()=>{
 const x=setup(),w=x.writer();x.approve.mockRejectedValue(Error("Authorization: inert-private-callback"));
 await expect(w.assertReady("public",new AbortController().signal)).rejects.toThrow(/^MEDIA_WRITE_PREFLIGHT_REQUIRED$/u);
 await expect(w.verifyStored("public",key)).rejects.toThrow(/^MEDIA_WRITE_READBACK_REQUIRED$/u);
 expect(x.fetcher).not.toHaveBeenCalled();
});
it("accepts a conditional-write race only after matching readback, never trusting HTTP success alone",async()=>{
 const x=setup();x.fetcher.mockImplementation(async()=>{x.stored.set("public:"+key,x.object("public"));return new Response(null,{status:412});});
 expect(await x.writer().store("public",key,bytes)).toMatchObject({status:"verified",action:"reused"});
 const y=setup();y.fetcher.mockResolvedValue(new Response(null,{status:200}));expect(await y.writer().store("public",key,bytes)).toEqual({status:"unknown"});expect(y.fetcher).toHaveBeenCalledTimes(1);
});
it("keeps canonical source writes private and excludes raw camera-original formats",async()=>{
 const x=setup(),source="source/v1/objects/sha256/"+hash.slice(0,2)+"/"+hash+".webp";
 x.descriptor.objects.push({plane:"source",key:source,sha256:hash,sizeBytes:bytes.length,contentType:"image/webp",cacheControl:"private, no-store"});
 x.grant.mockImplementation(async(p,k)=>({plane:p,key:k,method:"PUT",url:"https://account.r2.cloudflarestorage.com/source/"+k,headers:{"if-none-match":"*","content-type":"image/webp","cache-control":"private, no-store"}}));
 x.fetcher.mockImplementation(async()=>{x.stored.set("source:"+source,{bytes,contentType:"image/webp",cacheControl:"private, no-store",policySha256:h,protectedRef:null});return new Response(null,{status:201});});
 expect(await x.writer().store("source",source,bytes)).toMatchObject({status:"verified",action:"uploaded"});
 expect(()=>inspectMediaWriteSession({...x.descriptor,objects:[{...x.descriptor.objects[2],key:source.replace(/webp$/u,"jpg"),contentType:"image/jpeg"}]})).toThrow("KEY_INVALID");
});
