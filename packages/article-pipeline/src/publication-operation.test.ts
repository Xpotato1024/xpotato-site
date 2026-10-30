import {articleRoute} from "@xpotato/content-contracts";
import {afterEach,describe,it,expect} from "vitest";
import {mkdtemp,mkdir,rm,readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {persistMockObject} from "./publication-operation.js";
import {MemoryMockPublicationPort,DirectoryMockPublicationPort,mockPolicySha256,mockProtectedPrefix} from "./publication-mock-port.js";
import {sha256,fingerprint} from "./canonical.js";
import {assertExportChanges,exactExportPatch} from "./publication-export.js";
import {approveHumanCandidate,requireLivePublicationResources} from "./publication-approval.js";
import {humanApprovalRecordSchema} from "@xpotato/content-contracts";
import {candidateRoutePlan} from "./publication-update.js";
import {mockDecisionSchema} from "./publication-contracts.js";
const roots:string[]=[];afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
const binding={candidateSha256:"a".repeat(64),approvalSha256:"b".repeat(64),attemptId:"attempt-fixture",inputSha256:"c".repeat(64)};
async function fixture(){
 const folder=await mkdtemp(join(tmpdir(),"mock-publication-"));roots.push(folder);
 const port=new MemoryMockPublicationPort(),bytes=Buffer.from("privacy-normalized-fixture");
 const key="media/v1/objects/sha256/"+sha256(bytes).slice(0,2)+"/"+sha256(bytes)+".webp";
 const object={bytes,contentType:"image/webp",cacheControl:"public, max-age=31536000, immutable",policySha256:mockPolicySha256,protectedRef:null};
 return {folder,binding,port,plane:"public" as const,key,object,fresh:async()=>{}};
}
describe("unknown immutable writes use durable intent and authoritative read-back",()=>{
 it("reads before/after one write and verifies/reuses exact bytes",async()=>{
  const input=await fixture();expect((await persistMockObject(input)).action).toBe("uploaded");
  expect((await persistMockObject(input)).action).toBe("reused");
  expect(input.port.calls.filter(call=>call.startsWith("put:"))).toHaveLength(1);
 });
 it("accepts an unknown-after-commit only after matching read-back; restart preserves provider state",async()=>{
  const input=await fixture();input.port.fault="after_write";
  await persistMockObject(input);
  const calls=input.port.calls.length;await persistMockObject({...input});
  expect(input.port.calls.slice(calls).every(call=>call.startsWith("read:"))).toBe(true);
  expect(input.port.objects.size).toBe(1);
 });
 it("keeps unknown-before-write pending, then re-reads authoritative absence before retry",async()=>{
  const input=await fixture();input.port.fault="before_write";
  await expect(persistMockObject(input)).rejects.toThrow("PUBLICATION_WRITE_RESULT_UNKNOWN_STOP");
  expect(input.port.objects.size).toBe(0);const calls=input.port.calls.length;
  await persistMockObject({...input});
  expect(input.port.calls[calls]).toMatch(/^read:/u);
  expect(input.port.calls.slice(calls).filter(call=>call.startsWith("put:"))).toHaveLength(1);
 });
 it("never retries while reading the result remains unknown",async()=>{
  const input=await fixture();input.port.fault="read_unknown";
  await expect(persistMockObject(input)).rejects.toThrow("PUBLICATION_READ_UNKNOWN_STOP");
  await expect(persistMockObject({...input})).rejects.toThrow("PUBLICATION_READ_UNKNOWN_STOP");
  expect(input.port.calls.some(call=>call.startsWith("put:"))).toBe(false);
 });
 it.each(["bytes","contentType","cacheControl","policySha256","protectedRef"] as const)("rejects same-key changed %s without overwrite",async(field)=>{
  const input=await fixture();await persistMockObject(input);
  const altered={...input.object,[field]:field==="bytes"?Buffer.from("different"):field==="protectedRef"?"mock-only-other":"wrong"};
  input.port.objects.set("public:"+input.key,altered);
  await expect(persistMockObject(input)).rejects.toThrow("PUBLICATION_IMMUTABLE_OBJECT_CONFLICT");
  expect(input.port.calls.filter(call=>call.startsWith("put:"))).toHaveLength(1);
 });
 it("does not silently repair a formerly verified object that disappears",async()=>{
  const input=await fixture();await persistMockObject(input);input.port.objects.clear();
  await expect(persistMockObject(input)).rejects.toThrow("PUBLICATION_VERIFIED_OBJECT_MISSING");
 });
 it("checks capability and input freshness before writing",async()=>{
  const input=await fixture();input.port.capabilities.public=false;
  await expect(persistMockObject(input)).rejects.toThrow("MOCK_PERSISTENCE_CAPABILITY_REQUIRED");
  input.port.capabilities.public=true;
  await expect(persistMockObject({...input,fresh:async()=>{throw Error("changed");}})).rejects.toThrow("changed");
  expect(input.port.calls.some(call=>call.startsWith("put:"))).toBe(false);
 });
});
describe("approval lanes and exact patch boundaries",()=>{
 it("cannot turn a mock decision into a HumanApprovalRecord and refuses noninteractive human lane",async()=>{
  const body={protocol:"xpotato-private-mock-decision-v1",scope:"synthetic_fixture",candidateSha256:binding.candidateSha256,
   contentId:"f8a847d4-8f5d-4bb0-a387-750f096479f2",decision:"approve_simulation",reviewer:"fixture-reviewer",
   decidedAt:"2026-10-15T00:00:00Z",isHumanApproval:false,productionEligible:false};
  const mock=mockDecisionSchema.parse({...body,decisionSha256:fingerprint(body)});
  expect(humanApprovalRecordSchema.safeParse(mock).success).toBe(false);
  await expect(approveHumanCandidate("unused",{} as never,"unused",binding.candidateSha256)).rejects.toThrow("HUMAN_INTERACTIVE_TERMINAL_REQUIRED");
  expect(requireLivePublicationResources).toThrow("LIVE_MEDIA_RESOURCES_AND_OPERATION_AUTHORIZATION_NOT_ESTABLISHED");
 });
 it("requires every exact path and base preimage; main and extra/missing paths fail before application",()=>{
  const path="apps/site/src/content/blog/fixture.mdx",change={path,before:"old\n",after:"new\n"},base={[path]:"old\n"};
  expect(()=>assertExportChanges([change],[path],base,"codex/fixture")).not.toThrow();
  expect(()=>assertExportChanges([change],[path],base,"main")).toThrow();
  expect(()=>assertExportChanges([change],[path],{[path]:"concurrent edit"},"codex/fixture")).toThrow("EXPORT_BASE_CONFLICT");
  expect(()=>assertExportChanges([], [path],base,"codex/fixture")).toThrow("EXPORT_EXACT_PATH_SET_REQUIRED");
  expect(()=>assertExportChanges([change,change],[path],base,"codex/fixture")).toThrow("EXPORT_EXACT_PATH_SET_REQUIRED");
  const patch=exactExportPatch([change]);expect(patch).toContain("-old\n+new\n");
  expect(exactExportPatch([{path,before:null,after:"new"}])).toContain("\\ No newline at end of file");
 });
});


describe("candidate-bound route updates",()=>{
 const base={contentId:"f8a847d4-8f5d-4bb0-a387-750f096479f2",before:"/blog/old/",after:articleRoute("f8a847d4-8f5d-4bb0-a387-750f096479f2"),allow:true,occupied:[],redirects:[]};
 it("requires explicit permission and emits a same-ContentId 301 before approval",()=>{
  expect(()=>candidateRoutePlan({...base,allow:false})).toThrow("CANDIDATE_ROUTE_CHANGE_NOT_ADMITTED");
  expect(candidateRoutePlan(base)).toMatchObject([{contentId:base.contentId,sourcePath:base.before,targetPath:base.after,status:301}]);
 });
 it("refuses route/source collisions, duplicate redirects and cycles",()=>{
  expect(()=>candidateRoutePlan({...base,occupied:[base.after]})).toThrow("CANDIDATE_ROUTE_COLLISION");
  expect(()=>candidateRoutePlan({...base,redirects:[{sourcePath:base.before,targetPath:"/tools/"}]})).toThrow("SOURCE_CONFLICT");
  expect(()=>candidateRoutePlan({...base,redirects:[{sourcePath:base.after,targetPath:base.before}]})).toThrow("CYCLE");
 });
});

it("retains an unknown committed write across executor restart without a second put",async()=>{
 const input=await fixture(),originalPut=input.port.putIfAbsent.bind(input.port);
 input.port.putIfAbsent=async(...args)=>{
  await originalPut(...args);input.port.fault="read_unknown";return "unknown";
 };
 await expect(persistMockObject(input)).rejects.toThrow("PUBLICATION_WRITE_RESULT_UNKNOWN_STOP");
 expect(input.port.objects.size).toBe(1);
 await expect(persistMockObject({...input})).rejects.toThrow("PUBLICATION_READ_UNKNOWN_STOP");
 input.port.fault="none";expect((await persistMockObject({...input})).action).toBe("reused");
 expect(input.port.calls.filter(call=>call.startsWith("put:"))).toHaveLength(1);
});

it("refuses nonauthoritative absence and capability revocation immediately before put",async()=>{
 const input=await fixture();
 input.port.read=async()=>({status:"absent",authoritative:false} as never);
 await expect(persistMockObject(input)).rejects.toThrow("PUBLICATION_READ_UNKNOWN_STOP");
 expect(input.port.calls.some(call=>call.startsWith("put:"))).toBe(false);
 const second=await fixture();let checks=0;
 await expect(persistMockObject({...second,fresh:async()=>{if(++checks===2)second.port.capabilities.public=false;}})).rejects.toThrow("MOCK_PROVIDER_GATE_CLOSED");
 expect(second.port.calls.some(call=>call.startsWith("put:"))).toBe(false);
});
it("reconciles a thrown write result by reading existing bytes without repeating it",async()=>{
 const input=await fixture(),put=input.port.putIfAbsent.bind(input.port);
 input.port.putIfAbsent=async(...args)=>{await put(...args);throw Error("transport response lost");};
 expect((await persistMockObject(input)).action).toBe("reused");
 expect((await persistMockObject({...input})).action).toBe("reused");
 expect(input.port.calls.filter(call=>call.startsWith("put:"))).toHaveLength(1);
});

it("rejects a different candidate and forged human operational states without creating any human approval record",async()=>{
 const input=await fixture(),contentId="f8a847d4-8f5d-4bb0-a387-750f096479f2";
 const body={protocol:"xpotato-private-mock-decision-v1",scope:"synthetic_fixture",candidateSha256:binding.candidateSha256,
  contentId,decision:"approve_simulation",reviewer:"fixture-reviewer",decidedAt:"2026-10-15T00:00:00Z",isHumanApproval:false,productionEligible:false};
 const mock=mockDecisionSchema.parse({...body,decisionSha256:fingerprint(body)});
 await writeFile(join(input.folder,"approval.json"),JSON.stringify(mock));
 const head={protocol:"xpotato-private-publication-v1",mode:"mock",candidateSha256:binding.candidateSha256,
  inputSha256:binding.inputSha256,attemptId:binding.attemptId,approvalSha256:fingerprint(mock),state:"HUMAN_APPROVED",
  sources:null,publication:null,protection:null,export:null,productionEligible:false};
 await writeFile(join(input.folder,"head.json"),JSON.stringify(head));
 const context={folder:input.folder,target:"d".repeat(64),mode:"mock",v:{c:{binding}},materials:{frontmatter:{id:contentId}}};
 const {readPublicationHead}=await import("./publication-approval.js");
 await expect(readPublicationHead(context as never)).rejects.toThrow("PUBLICATION_APPROVAL_STALE");
 await writeFile(join(input.folder,"head.json"),JSON.stringify({...head,mode:"human",state:"MEDIA_PROTECTED",sources:"a".repeat(64),publication:"b".repeat(64),protection:"c".repeat(64)}));
 await expect(readPublicationHead({...context,target:binding.candidateSha256,mode:"human"} as never)).rejects.toThrow("LIVE_PERSISTENCE_JOURNAL_NOT_ESTABLISHED");
 expect(humanApprovalRecordSchema.safeParse(mock).success).toBe(false);
});

it("recovers an empty interrupted directory after restart without overwriting partial objects",async()=>{
 const input=await fixture(),root=join(input.folder,"provider"),folder=join(root,"public",sha256(input.key));
 await mkdir(folder,{recursive:true});
 const orphan=join(root,"public",".staging-interrupted");await mkdir(orphan);await writeFile(join(orphan,"object.json"),"partial staging");
 const port=new DirectoryMockPublicationPort(root);
 expect((await port.read("public",input.key)).status).toBe("absent");
 expect((await persistMockObject({...input,port})).action).toBe("uploaded");
 expect((await persistMockObject({...input,port:new DirectoryMockPublicationPort(root)})).action).toBe("reused");
 const second=await fixture(),otherRoot=join(second.folder,"provider"),partial=join(otherRoot,"public",sha256(second.key));
 await mkdir(partial,{recursive:true});await writeFile(join(partial,"bytes.bin"),"partial object");
 await expect(persistMockObject({...second,port:new DirectoryMockPublicationPort(otherRoot)})).rejects.toThrow("PUBLICATION_READ_UNKNOWN_STOP");
 expect(await readFile(join(partial,"bytes.bin"),"utf8")).toBe("partial object");
});
