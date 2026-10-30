import {it,expect,vi} from "vitest";import {z} from "zod";
import {mkdtemp,readFile,writeFile} from "node:fs/promises";import {tmpdir} from "node:os";import {join} from "node:path";
import type {ArticleJobSpec,SemanticRequestEnvelope,SemanticResponseEnvelope} from "@xpotato/content-contracts";
import {fingerprint,sha256} from "./canonical.js";
import {compileDisclosureManifest,currentExternalAiPolicyBinding,type OutboundArtifact} from "./disclosure.js";
import {fingerprintSemanticRequest,type ProviderNeutralSemanticAdapter} from "./semantic-provider.js";
import {prepareSemanticInvocation,runSemanticInvocation,semanticResponseContract,semanticRuntimeLimits} from "./semantic-runtime.js";
import {RuntimeOperationJournal} from "./runtime-journal.js";
const h="a".repeat(64);
it("keeps semantic stage budgets fixed before any journal is constructed",()=>{
 expect(Reflect.set(semanticRuntimeLimits.perStage,"author",15)).toBe(false);expect(semanticRuntimeLimits.perStage.author).toBe(2);
});
function artifact(id:string,bytes:Uint8Array):OutboundArtifact{
 const hash=sha256(bytes),provenance={kind:"public_anonymous_https_acquisition_v1" as const,artifactSha256:hash,finalUrl:"https://example.invalid/contract-fixture",anonymousReadable:true as const,credentialsUsed:false as const,secretScanResultSha256:h,acquisitionReceiptSha256:h};
 const disclosure={schemaVersion:1 as const,subject:{kind:"artifact" as const,id,sha256:hash},mode:"allow_exact" as const,basis:"repository_policy" as const,...currentExternalAiPolicyBinding,notes:["inert test fixture only"]};
 return {artifactId:id,sha256:hash,bytes,required:true,admissionProvenance:provenance,admissionProvenanceSha256:fingerprint(provenance),disclosureRecord:disclosure,disclosureRecordSha256:fingerprint(disclosure)};
}
async function setup(){
 const contract=semanticResponseContract("fixture-summary-v1",z.object({summary:z.string()}).strict()),artifacts=[artifact("skill",Buffer.from("fixed fixture skill")),artifact("references",Buffer.from("fixed fixture references")),artifact("schema",contract.bytes),artifact("evidence",Buffer.from("fixed fixture evidence"))];
 const spec:ArticleJobSpec={schemaVersion:1,jobId:"job-1",operation:"create",target:{collection:"blog",contentId:"f8a847d4-8f5d-4bb0-a387-750f096479f2",workingTitle:"fixture",articleMode:"explanation"},reader:{outcome:"fixture",assumedKnowledge:[],language:"ja"},inputs:{userNotes:[],repositoryRefs:[],localSourceRefs:[],seedUrls:[],sourceDiscoveryQueries:[]},externalAiDisclosure:{policy:currentExternalAiPolicyBinding,explicitAuthorizations:[]},constraints:{requiredClaims:[],forbiddenClaims:[],requiredSections:[],forbiddenPublicationPatterns:[]},taxonomyHints:{tagIds:[]},media:{suppliedMediaRefs:[],heroPreference:"auto",requiredInlineVisuals:[]},permissions:{networkAccess:true,externalTextAI:true,externalImageAI:false,localMediaProcessing:false,privateCanonicalMediaStorage:false,publicMediaUpload:false,protectedMediaOperation:false,repositoryExport:false}};
 const manifest=compileDisclosureManifest({jobSpec:spec,requestId:"request-1",stage:"evidence",artifacts});
 const unsigned={schemaVersion:1 as const,requestId:"request-1",jobId:spec.jobId,jobFingerprint:fingerprint(spec),stage:"evidence" as const,inputArtifacts:artifacts.map(a=>({artifactId:a.artifactId,sha256:a.sha256,mediaType:"text/plain",sizeBytes:a.bytes.length})),skill:{skillId:"fixture-skill",skillSha256:artifacts[0]!.sha256,referenceBundleSha256:artifacts[1]!.sha256},responseSchema:{schemaId:contract.schemaId,schemaSha256:contract.sha256},constraints:{maxOutputBytes:4096,publicSafetyRequired:true,externalFactPolicy:"fixed_sources_only" as const},executionMode:"external" as const,externalAiDisclosureManifestSha256:manifest.manifestSha256};
 const request:SemanticRequestEnvelope={...unsigned,requestSha256:fingerprintSemanticRequest(unsigned)},profile={executionProfileId:"fixture-execution",providerProfileId:"fixture-provider-v1",provider:"fixture",model:"fixture-model",modelProfileId:"fixture-model-v1",maxOutputBytes:4096,timeoutMs:1000,freshContext:true};
 const args={spec,request,artifacts,physical:{skillArtifactId:"skill",referenceArtifactId:"references",responseSchemaArtifactId:"schema"},profile,contract};
 const response=(value:unknown={summary:"fixture only"}):SemanticResponseEnvelope=>({schemaVersion:1,requestSha256:request.requestSha256,stage:request.stage,response:value,runner:{provider:profile.provider,model:profile.model,providerRunId:"fixture-run",executionProfileId:profile.executionProfileId,providerProfileId:profile.providerProfileId,externalAiDisclosureManifestSha256:manifest.manifestSha256,startedAt:"2026-10-30T00:00:00Z",finishedAt:"2026-10-30T00:00:01Z",externalApiUsed:true,warnings:["contract simulation, no provider call"]}});
 const execute=vi.fn(async()=>({responseBytes:Buffer.from(JSON.stringify(response())),requestSha256:request.requestSha256,externalAiDisclosureManifestSha256:manifest.manifestSha256,providerRunId:"fixture-run",modelIdentity:{providerProfileId:profile.providerProfileId,modelProfileId:profile.modelProfileId}}));
 const journal=new RuntimeOperationJournal(await mkdtemp(join(tmpdir(),"semantic-runtime-")),{jobId:spec.jobId,jobFingerprint:fingerprint(spec)},semanticRuntimeLimits);
 return {args,response,execute,journal,adapter:{execute} as ProviderNeutralSemanticAdapter};
}
it("prepares admitted physical snapshots without I/O, executes once, strictly imports and reuses verified bytes",async()=>{
 const x=await setup(),prepared=prepareSemanticInvocation(x.args);expect(x.execute).not.toHaveBeenCalled();
 expect(prepared.payload.artifacts.every(a=>Object.keys(a).sort().join(",")==="artifactId,bytes,sha256")).toBe(true);
 const input={prepared,journal:x.journal,attemptId:"attempt-1",inputSha256:h,adapter:x.adapter,scope:"test_fixture" as const};
 const result=await runSemanticInvocation(input);expect(result).toMatchObject({state:"verified",reused:false,formalStageReceipt:false,productionEligible:false});
 expect(await runSemanticInvocation(input)).toMatchObject({state:"verified",reused:true});expect(x.execute).toHaveBeenCalledTimes(1);
 expect(x.execute.mock.calls[0]?.length).toBe(4);
 const file=join(x.journal.directory,"semantic-request-1","response-"+result.outputSha256+".json");expect(JSON.parse(await readFile(file,"utf8")).response.summary).toBe("fixture only");await writeFile(file,"corrupted");await expect(runSemanticInvocation(input)).rejects.toThrow("ARTIFACT_INVALID");
});
it("denies missing permissions, denied/stale bytes, wrong snapshots and extra physical inputs before execution",async()=>{
 const x=await setup();
 for(const mutate of [(a:any)=>a.spec.permissions.externalTextAI=false,(a:any)=>a.spec.permissions.networkAccess=false,(a:any)=>a.artifacts[3].bytes[0]^=1,(a:any)=>a.artifacts.push(a.artifacts[0]),(a:any)=>a.physical.skillArtifactId="missing",(a:any)=>{a.artifacts[3].disclosureRecord.mode="deny";a.artifacts[3].disclosureRecordSha256=fingerprint(a.artifacts[3].disclosureRecord);}]){
  const a={...x.args,spec:structuredClone(x.args.spec),artifacts:structuredClone(x.args.artifacts),physical:{...x.args.physical}};mutate(a);expect(()=>prepareSemanticInvocation(a)).toThrow();
 }
 expect(x.execute).not.toHaveBeenCalled();
});
it("keeps wrong response schema/model/lineage unknown and does not retry the adapter",async()=>{
 for(const change of ["schema","model","lineage"]){const x=await setup();x.execute.mockImplementation(async()=>({responseBytes:Buffer.from(JSON.stringify(x.response(change==="schema"?{summary:"x",extra:true}:{summary:"x"}))),requestSha256:change==="lineage"?"b".repeat(64):x.args.request.requestSha256,externalAiDisclosureManifestSha256:x.args.request.externalAiDisclosureManifestSha256!,providerRunId:"fixture-run",modelIdentity:{providerProfileId:x.args.profile.providerProfileId,modelProfileId:change==="model"?"other":x.args.profile.modelProfileId}}));
  const input={prepared:prepareSemanticInvocation(x.args),journal:x.journal,attemptId:"attempt-1",inputSha256:h,adapter:x.adapter,scope:"test_fixture" as const};expect(await runSemanticInvocation(input)).toMatchObject({state:"unknown"});await expect(runSemanticInvocation(input)).rejects.toThrow("NO_RESEND");expect(x.execute).toHaveBeenCalledTimes(1);
 }
});
it("blocks live activation and requires fresh audit context without changing human schemas",async()=>{
 const x=await setup();await expect(runSemanticInvocation({prepared:prepareSemanticInvocation(x.args),journal:x.journal,attemptId:"attempt-1",inputSha256:h,adapter:x.adapter,scope:"operator_runtime"})).rejects.toThrow("LIVE_ACTIVATION");expect(x.execute).not.toHaveBeenCalled();
 const request={...x.args.request,stage:"content_audit" as const};request.requestSha256=fingerprintSemanticRequest(request);
 expect(()=>prepareSemanticInvocation({...x.args,request,profile:{...x.args.profile,freshContext:false}})).toThrow("FRESH_CONTEXT");
});
