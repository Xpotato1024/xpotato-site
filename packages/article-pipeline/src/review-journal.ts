import {z} from "zod";
import {mkdir} from "node:fs/promises";
import {join} from "node:path";
import {articleStageReceiptSchema,sha256Schema,type ArticleJobState} from "@xpotato/content-contracts";
import {canonicalJson,fingerprint,sha256} from "./canonical.js";
import {safeRead,noLinks,immutable,atomic,fail} from "./private-files.js";
import {validateLocalSources,analyzeLocalEvidence,makeContentAuditRequest,validateContentAudit} from "./review-analysis.js";
import {canTransition} from "./state-machine.js";
import {readAuditSkill} from "./agent-audit.js";
export type ReviewBinding={jobId:string;attemptId:string;jobFingerprint:string;inputSha256:string};
const roles=["sources","evidence","audit"] as const;
export type ReviewRole=typeof roles[number];
const headSchema=z.object({schemaVersion:z.literal(1),profile:z.literal("article-private-review-journal-v1"),receipts:z.array(sha256Schema).max(10),
 bindings:z.object({sources:sha256Schema.optional(),evidence:sha256Schema.optional(),audit:sha256Schema.optional()}).strict(),
 outputs:z.record(z.string(),sha256Schema)}).strict();
export const reviewDirectory=(directory:string,attemptId:string)=>{
 if(!/^attempt-[a-f0-9-]{36}$/u.test(attemptId))fail("ATTEMPT_ID_INVALID");
 return join(directory,"attempts",attemptId,"review");
};
export const workingReviewPath=(directory:string,role:ReviewRole)=>join(directory,"working-"+role+".json");
export const readReviewJson=async(path:string)=>JSON.parse(await safeRead(path));
const allowed:Readonly<Record<string,ArticleJobState>>={sources:"SOURCES_READY",evidence:"EVIDENCE_READY",draft:"DRAFTED",
 examples:"EXAMPLES_ASSESSED",audit:"CONTENT_AUDITED",content:"CONTENT_READY",revision:"REVISION_REQUIRED"};
const exactKeys=(value:Record<string,unknown>,expected:readonly string[])=>fingerprint(Object.keys(value).sort())===fingerprint([...expected].sort());
const stageRequirements=(stage:string)=>{
 const audited=stage==="audit"||stage==="content"||stage==="revision";
 return {inputs:stage==="sources"?["sources"]:audited?["sources","evidence","audit"]:["sources","evidence"],
  outputs:stage==="sources"?[]:["analysis","auditRequest"]};
};
export const readReviewJournal=async(directory:string,binding:ReviewBinding,checkInputs=true)=>{
 const folder=reviewDirectory(directory,binding.attemptId);
 let raw:unknown;try{raw=await readReviewJson(join(folder,"head.json"));}catch(error){
  if((error as NodeJS.ErrnoException).code==="ENOENT")return {head:headSchema.parse({schemaVersion:1,profile:"article-private-review-journal-v1",receipts:[],bindings:{},outputs:{}}),state:"CREATED" as ArticleJobState,folder};
  throw error;
 }
 const head=headSchema.parse(raw);let state:ArticleJobState="CREATED",previous:string|null=null;
 for(const hash of head.receipts){
  const receipt=articleStageReceiptSchema.parse(await readReviewJson(join(folder,"receipts",hash+".json")));
  const {receiptSha256,...unsigned}=receipt;
  if(receiptSha256!==hash||fingerprint(unsigned)!==hash||receipt.previousReceiptSha256!==previous
   ||receipt.jobId!==binding.jobId||receipt.attemptId!==binding.attemptId||receipt.jobFingerprint!==binding.jobFingerprint
   ||receipt.inputSha256!==binding.inputSha256||receipt.from!==state||allowed[receipt.stage]!==receipt.to
   ||receipt.profileId!=="local-content-review-v1"||!canTransition(state,receipt.to))fail("REVIEW_RECEIPT_BINDING_INVALID",3);
  const required=stageRequirements(receipt.stage);
  if(!exactKeys(receipt.inputs,required.inputs)||!exactKeys(receipt.outputs,required.outputs))fail("REVIEW_RECEIPT_REQUIRED_SET_INVALID",3);
  const expectedResult=receipt.stage==="revision"?"revision_required":receipt.stage==="audit"?null:"success";
  if(expectedResult&&receipt.result!==expectedResult||receipt.stage==="audit"&&receipt.result!=="success"&&receipt.result!=="revision_required")fail("REVIEW_RECEIPT_RESULT_INVALID",3);
  for(const [role,value] of Object.entries(receipt.inputs))if(!roles.includes(role as ReviewRole)||head.bindings[role as ReviewRole]!==value)fail("REVIEW_RECEIPT_INPUT_SET_INVALID",3);
  for(const [name,value] of Object.entries(receipt.outputs))if(head.outputs[name]!==value)fail("REVIEW_RECEIPT_OUTPUT_SET_INVALID",3);
  if(receipt.to==="CONTENT_READY"&&receipt.result!=="success")fail("REVIEW_RECEIPT_RESULT_INVALID",3);
  state=receipt.to;previous=hash;
 }
 const lastStage=head.receipts.length?articleStageReceiptSchema.parse(await readReviewJson(join(folder,"receipts",head.receipts.at(-1)!+".json"))).stage:undefined;
 const required=lastStage?stageRequirements(lastStage):{inputs:[],outputs:[]};
 if(!exactKeys(head.bindings,required.inputs)||!exactKeys(head.outputs,required.outputs))fail("REVIEW_HEAD_REQUIRED_SET_INVALID",3);
 for(const role of roles){
  const hash=head.bindings[role];if(!hash)continue;
  const payload=await readReviewJson(join(folder,"artifacts",hash+".json"));
  if(fingerprint(payload)!==hash)fail("REVIEW_ARTIFACT_HASH_MISMATCH",3);
  if(checkInputs&&fingerprint(await readReviewJson(workingReviewPath(directory,role)))!==hash)fail("REVIEW_INPUT_CHANGED_OLD_AUDIT_STALE",3);
 }
 for(const hash of Object.values(head.outputs))if(fingerprint(await readReviewJson(join(folder,"artifacts",hash+".json")))!==hash)fail("REVIEW_OUTPUT_HASH_MISMATCH",3);
 // Hash equality alone cannot establish that a recorded stage actually met its prerequisites.
 const payload=(hash:string)=>readReviewJson(join(folder,"artifacts",hash+".json"));
 let analysis:ReturnType<typeof analyzeLocalEvidence>|undefined;
 if(head.bindings.sources)validateLocalSources(await payload(head.bindings.sources));
 if(head.bindings.evidence){
  const body=await safeRead(join(directory,"attempts",binding.attemptId,"body.md"));
  analysis=analyzeLocalEvidence(body,await payload(head.bindings.sources!),await payload(head.bindings.evidence),binding);
  const request=makeContentAuditRequest(binding,analysis,analysis.sources.scope==="existing_ai"?await readAuditSkill(directory,"content"):undefined);
  if(fingerprint(analysis)!==head.outputs.analysis||fingerprint(request)!==head.outputs.auditRequest)fail("REVIEW_SEMANTIC_OUTPUT_MISMATCH",3);
  if(["EXAMPLES_ASSESSED","CONTENT_AUDITED","CONTENT_READY","REVISION_REQUIRED"].includes(state)&&!analysis.examplesReady)fail("REVIEW_EXAMPLES_PREREQUISITE_INVALID",3);
 }
 if(head.bindings.audit){
  if(!analysis)fail("REVIEW_AUDIT_PREREQUISITE_INVALID",3);
  const audit=validateContentAudit(await payload(head.bindings.audit),makeContentAuditRequest(binding,analysis,analysis.sources.scope==="existing_ai"?await readAuditSkill(directory,"content"):undefined));
  const passed=audit.conclusion==="pass";
  if(state==="CONTENT_READY"&&!passed||state==="REVISION_REQUIRED"&&passed)fail("REVIEW_AUDIT_STATE_MISMATCH",3);
  for(const hash of head.receipts){
   const receipt=articleStageReceiptSchema.parse(await readReviewJson(join(folder,"receipts",hash+".json")));
   if(receipt.stage==="audit"&&receipt.result!==(passed?"success":"revision_required"))fail("REVIEW_AUDIT_RESULT_MISMATCH",3);
  }
 }
 return {head,state,folder};
};
export const loadReviewPayload=async(journal:Awaited<ReturnType<typeof readReviewJournal>>,role:ReviewRole)=>{
 const hash=journal.head.bindings[role];if(!hash)fail("REVIEW_"+role.toUpperCase()+"_MISSING",3);
 return readReviewJson(join(journal.folder,"artifacts",hash+".json"));
};
export const loadReviewOutput=async(journal:Awaited<ReturnType<typeof readReviewJournal>>,name:string)=>{
 const hash=journal.head.outputs[name];if(!hash)fail("REVIEW_OUTPUT_MISSING",3);
 return readReviewJson(join(journal.folder,"artifacts",hash+".json"));
};
export const writeReviewArtifact=async(folder:string,value:unknown)=>{
 await noLinks(folder);await mkdir(join(folder,"artifacts"),{recursive:true,mode:0o700});
 const encoded=canonicalJson(value)+"\n";if(Buffer.byteLength(encoded)>2*1024*1024)fail("REVIEW_ARTIFACT_TOO_LARGE");
 const hash=fingerprint(value);await immutable(join(folder,"artifacts",hash+".json"),canonicalJson(value)+"\n");return hash;
};
export const commitReviewStages=async(directory:string,binding:ReviewBinding,journal:Awaited<ReturnType<typeof readReviewJournal>>,
 input:{role?:ReviewRole;expectedWorkingSha256?:string|null;payload?:unknown;outputs?:Readonly<Record<string,unknown>>;stages:readonly {stage:keyof typeof allowed;result?:"success"|"revision_required"|"blocked_env"}[]},
 assertFresh:()=>Promise<void>)=>{
 const head=headSchema.parse(journal.head),folder=journal.folder;
 await noLinks(folder);await mkdir(join(folder,"receipts"),{recursive:true,mode:0o700});
 if(input.role){
  const hash=await writeReviewArtifact(folder,input.payload);
  if(head.bindings[input.role]&&head.bindings[input.role]!==hash)fail("REVIEW_INPUT_CHANGED_REVISE_REQUIRED",3);
  head.bindings[input.role]=hash;
 }
 for(const [key,value] of Object.entries(input.outputs??{}))head.outputs[key]=await writeReviewArtifact(folder,value);
 let state=journal.state;
 for(const stage of input.stages){
  const to=allowed[stage.stage];if(!to||!canTransition(state,to))fail("REVIEW_STAGE_ORDER_INVALID",3);
  const time=new Date().toISOString();
  const unsigned={schemaVersion:1,...binding,previousReceiptSha256:head.receipts.at(-1)??null,from:state,to,stage:stage.stage,
   profileId:"local-content-review-v1",inputs:{...head.bindings},outputs:{...head.outputs},result:stage.result??"success",startedAt:time,finishedAt:time};
  const receipt=articleStageReceiptSchema.parse({...unsigned,receiptSha256:fingerprint(unsigned)});
  await immutable(join(folder,"receipts",receipt.receiptSha256+".json"),canonicalJson(receipt)+"\n");
  head.receipts.push(receipt.receiptSha256);state=to;
 }
 await assertFresh();
 if(input.role){
  let now:string|null=null;
  try{now=sha256(await safeRead(workingReviewPath(directory,input.role)));}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
  if(now!==input.expectedWorkingSha256)fail("REVIEW_WORKING_INPUT_CHANGED_DURING_IMPORT",3);
  await atomic(workingReviewPath(directory,input.role),canonicalJson(input.payload)+"\n");
 }
 // External editors do not take the CLI lock; recheck at activation.
 await assertFresh();
 for(const role of roles)if(head.bindings[role]&&fingerprint(await readReviewJson(workingReviewPath(directory,role)))!==head.bindings[role])fail("REVIEW_INPUT_CHANGED_DURING_COMMIT",3);
 await atomic(join(folder,"head.json"),canonicalJson(head)+"\n");
 return {head,state,folder};
};
