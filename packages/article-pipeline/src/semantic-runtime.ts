import {mkdir} from "node:fs/promises";
import {join} from "node:path";
import {z} from "zod";
import {articleJobSpecSchema,type ArticleJobSpec,type SemanticRequestEnvelope,type SemanticResponseEnvelope} from "@xpotato/content-contracts";
import {canonicalJson,fingerprint,sha256} from "./canonical.js";
import {compileDisclosureManifest,createProviderPayload,containsHardDenyMaterial,type OutboundArtifact} from "./disclosure.js";
import {assertAdmittedSemanticInvocation,importExternalSemanticResponse,verifySemanticRequest,type ProviderNeutralSemanticAdapter} from "./semantic-provider.js";
import {RuntimeOperationJournal} from "./runtime-journal.js";
import {immutableBytes,noLinks,safeReadBytes} from "./private-files.js";

export function semanticResponseContract<T>(schemaId:string,schema:z.ZodType<T>){
 const bytes=Buffer.from(canonicalJson(z.toJSONSchema(schema)));
 return Object.freeze({schemaId,bytes,sha256:sha256(bytes),parse:(input:unknown)=>schema.parse(input)});
}
export interface SemanticRuntimeProfile{
 readonly executionProfileId:string;readonly providerProfileId:string;readonly provider:string;readonly model:string;readonly modelProfileId:string;readonly snapshot?:string|undefined;
 readonly maxOutputBytes:number;readonly timeoutMs:number;readonly freshContext:boolean;
}
const profileSchema=z.object({executionProfileId:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),providerProfileId:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),provider:z.string().min(1).max(120),model:z.string().min(1).max(120),modelProfileId:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),snapshot:z.string().min(1).max(120).optional(),maxOutputBytes:z.number().int().min(1).max(4194304),timeoutMs:z.number().int().min(1).max(240000),freshContext:z.boolean()}).strict();
type PhysicalBindings={skillArtifactId:string;referenceArtifactId:string;responseSchemaArtifactId:string};
/** Compilation does not execute a provider or authorize input. It reuses the
 * existing admission compiler, with no default allow or human-scope conversion.
 */
export function prepareSemanticInvocation<T>(input:{spec:ArticleJobSpec;request:SemanticRequestEnvelope;artifacts:readonly OutboundArtifact[];
 physical:PhysicalBindings;profile:SemanticRuntimeProfile;contract:ReturnType<typeof semanticResponseContract<T>>}){
 const spec=articleJobSpecSchema.parse(input.spec),request=verifySemanticRequest(input.request),profile=profileSchema.parse(input.profile);
 if(!spec.permissions.networkAccess||!spec.permissions.externalTextAI||request.executionMode!=="external")throw Error("SEMANTIC_RUNTIME_PERMISSION_REQUIRED");
 if(request.jobId!==spec.jobId||request.jobFingerprint!==fingerprint(spec))throw Error("SEMANTIC_RUNTIME_JOB_MISMATCH");
 if(!Number.isSafeInteger(profile.maxOutputBytes)||profile.maxOutputBytes<1||profile.maxOutputBytes>4*1024*1024
  ||request.constraints.maxOutputBytes>profile.maxOutputBytes||!Number.isSafeInteger(profile.timeoutMs)||profile.timeoutMs<1||profile.timeoutMs>240000)throw Error("SEMANTIC_RUNTIME_PROFILE_INVALID");
 if((request.stage==="content_audit"||request.stage==="visual_audit")&&!profile.freshContext)throw Error("SEMANTIC_RUNTIME_FRESH_CONTEXT_REQUIRED");
 const artifacts=structuredClone(input.artifacts),ids=artifacts.map(x=>x.artifactId);
 if(new Set(ids).size!==ids.length)throw Error("SEMANTIC_RUNTIME_DUPLICATE_INPUT");
 const manifest=compileDisclosureManifest({jobSpec:spec,requestId:request.requestId,stage:request.stage,artifacts});
 const payload=createProviderPayload(manifest,artifacts);
 assertAdmittedSemanticInvocation(request,manifest,payload);
 const physical=(id:string)=>{const a=artifacts.find(x=>x.artifactId===id);if(!a)throw Error("SEMANTIC_RUNTIME_PHYSICAL_INPUT_MISSING");return a;};
 if(physical(input.physical.skillArtifactId).sha256!==request.skill.skillSha256
  ||physical(input.physical.referenceArtifactId).sha256!==request.skill.referenceBundleSha256
  ||physical(input.physical.responseSchemaArtifactId).sha256!==request.responseSchema.schemaSha256
  ||sha256(input.contract.bytes)!==input.contract.sha256||input.contract.schemaId!==request.responseSchema.schemaId||input.contract.sha256!==request.responseSchema.schemaSha256)throw Error("SEMANTIC_RUNTIME_SNAPSHOT_MISMATCH");
 const declared=request.inputArtifacts.map(x=>({id:x.artifactId,sha:x.sha256,size:x.sizeBytes})).sort((a,b)=>a.id.localeCompare(b.id));
 const actual=artifacts.map(x=>({id:x.artifactId,sha:x.sha256,size:x.bytes.length})).sort((a,b)=>a.id.localeCompare(b.id));
 if(fingerprint(declared)!==fingerprint(actual)||containsHardDenyMaterial(Buffer.from(canonicalJson(request))))throw Error("SEMANTIC_RUNTIME_REQUEST_INPUT_INVALID");
 return {spec,request,profile,manifest,payload,contract:input.contract,artifacts,physical:structuredClone(input.physical)};
}

export const semanticRuntimeLimits=Object.freeze({total:15,perStage:Object.freeze({source_discovery:2,evidence:2,author:2,content_audit:3,revision:2,visual_plan:2,visual_audit:2})});
/** Only injected contract fixtures can run in this implementation revision.
 * Real activation/transport configuration and stage-to-job integration remain
 * separate gates. No API key lookup, fetch default, retry or scope promotion.
 */
export async function runSemanticInvocation<T>(input:{prepared:ReturnType<typeof prepareSemanticInvocation<T>>;journal:RuntimeOperationJournal;
 attemptId:string;inputSha256:string;adapter:ProviderNeutralSemanticAdapter;scope:"test_fixture"|"operator_runtime";signal?:AbortSignal}){
 if(input.scope!=="test_fixture")throw Error("SEMANTIC_LIVE_ACTIVATION_NOT_ESTABLISHED");
 const p=prepareSemanticInvocation(input.prepared);
 if(fingerprint(input.journal.job)!==fingerprint({jobId:p.spec.jobId,jobFingerprint:fingerprint(p.spec)})
  ||fingerprint(input.journal.limits)!==fingerprint(semanticRuntimeLimits))throw Error("SEMANTIC_RUNTIME_JOURNAL_BINDING_INVALID");
 const result=await input.journal.run({operationId:"semantic-"+p.request.requestId,kind:"semantic",stage:p.request.stage,
  attemptId:input.attemptId,inputSha256:input.inputSha256,contextSha256:fingerprint({request:p.request,profile:p.profile})},{
  timeoutMs:p.profile.timeoutMs,signal:input.signal,
  preflight:()=>assertAdmittedSemanticInvocation(p.request,p.manifest,p.payload),
  execute:async signal=>{
   signal.throwIfAborted();
   // Contract adapters receive isolated bytes. They cannot mutate the admitted
   // snapshot retained for final import validation.
   const response=await input.adapter.execute(structuredClone(p.request),structuredClone(p.manifest),createProviderPayload(p.manifest,p.payload.artifacts),signal);
   signal.throwIfAborted();
   if(response.requestSha256!==p.request.requestSha256||response.externalAiDisclosureManifestSha256!==p.manifest.manifestSha256
    ||response.modelIdentity.providerProfileId!==p.profile.providerProfileId||response.modelIdentity.modelProfileId!==p.profile.modelProfileId
    ||response.modelIdentity.snapshot!==p.profile.snapshot)throw Error("SEMANTIC_RUNTIME_TRANSPORT_LINEAGE_INVALID");
   const bytes=new Uint8Array(response.responseBytes),parsed:SemanticResponseEnvelope=importExternalSemanticResponse(p.request,p.manifest,bytes);
   const runner=parsed.runner;
   if(runner.executionProfileId!==p.profile.executionProfileId||runner.providerProfileId!==p.profile.providerProfileId
    ||runner.provider!==p.profile.provider||runner.model!==p.profile.model||runner.snapshot!==p.profile.snapshot
    ||runner.providerRunId!==response.providerRunId||Date.parse(runner.finishedAt)<Date.parse(runner.startedAt)
    ||containsHardDenyMaterial(bytes))throw Error("SEMANTIC_RUNTIME_RESPONSE_INVALID");
   p.contract.parse(parsed.response);
   const hash=sha256(bytes),folder=join(input.journal.directory,"semantic-"+p.request.requestId);
   await noLinks(folder);await mkdir(folder,{recursive:true,mode:0o700});signal.throwIfAborted();await immutableBytes(join(folder,"response-"+hash+".json"),Buffer.from(bytes));
   return {outputSha256:hash};
  }});
 if(result.state==="verified"){
  const bytes=await safeReadBytes(join(input.journal.directory,"semantic-"+p.request.requestId,"response-"+result.outputSha256+".json"),p.request.constraints.maxOutputBytes);
  if(sha256(bytes)!==result.outputSha256||containsHardDenyMaterial(bytes))throw Error("SEMANTIC_RUNTIME_ARTIFACT_INVALID");
  const parsed=importExternalSemanticResponse(p.request,p.manifest,bytes),runner=parsed.runner;
  if(runner.executionProfileId!==p.profile.executionProfileId||runner.providerProfileId!==p.profile.providerProfileId||runner.provider!==p.profile.provider||runner.model!==p.profile.model||runner.snapshot!==p.profile.snapshot||Date.parse(runner.finishedAt)<Date.parse(runner.startedAt))throw Error("SEMANTIC_RUNTIME_RESPONSE_INVALID");
  p.contract.parse(parsed.response);
 }
 return {...result,scope:"test_fixture" as const,formalStageReceipt:false as const};
}
