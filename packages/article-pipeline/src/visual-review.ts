import {mkdir} from "node:fs/promises";
import {join} from "node:path";
import {z} from "zod";
import {articleStageReceiptSchema,articleVisualPlanSchema,articleVisualMastersSchema,articleVisualMediaSchema,sha256Schema,
 type ArticleJobState,type LocalSourceBundle,type ArticleVisualPlan,type ArticleVisualMasters,type ArticleVisualMedia,type LocalVisualAudit} from "@xpotato/content-contracts";
import {contentReviewContext} from "./content-review.js";
import {loadReviewPayload,writeReviewArtifact,readReviewJson} from "./review-journal.js";
import {splitDraft,type DraftRepository} from "./draft-job.js";
import {canonicalJson,fingerprint,sha256} from "./canonical.js";
import {safeRead,immutable,atomic,noLinks,locked,fail} from "./private-files.js";
import {canTransition} from "./state-machine.js";
import {assembleVisualPlan,defaultVisualInput} from "./visual-plan.js";
import {makeVisualAuditRequest,validateLocalVisualAudit,validateCandidateRegistry} from "./visual-analysis.js";
import {readAuditSkill} from "./agent-audit.js";

const headSchema=z.object({schemaVersion:z.literal(1),protocol:z.literal("xpotato-private-visual-journal-v1"),
 reviewHeadSha256:sha256Schema,receipts:z.array(sha256Schema).max(12),
 bindings:z.record(z.string(),sha256Schema),outputs:z.record(z.string(),sha256Schema),rejection:sha256Schema.nullable()}).strict();
const states:Record<string,ArticleJobState>={"visual-plan":"VISUAL_PLANNED","visual-master":"VISUAL_READY",
 "visual-audit":"VISUAL_AUDITED",media:"MEDIA_READY",candidate:"CANDIDATE_READY",preview:"PREVIEW_VALIDATED",review:"HUMAN_REVIEW_READY"};
const baseOutputs=["plan","masters","auditRequest"];
const requirements=(stage:string,rejected=false)=>{
 const index=Object.keys(states).indexOf(stage);
 if(index<0)fail("VISUAL_STAGE_INVALID",3);
 return {inputs:index>=2||rejected?["visual","audit"]:["visual"],
  outputs:index===0?["plan"]:index<3?baseOutputs:index===3?[...baseOutputs,"media"]:[...baseOutputs,"media","candidate","preview","review"]};
};
const exact=(value:Record<string,unknown>,keys:readonly string[])=>fingerprint(Object.keys(value).sort())===fingerprint([...keys].sort());
export const visualFolder=(directory:string,attemptId:string)=>join(directory,"attempts",attemptId,"visual");
const workingPath=(directory:string,role:string)=>join(directory,role==="visual"?"working-visual.json":"working-visual-audit.json");
const existingHead=async(folder:string)=>{try{return headSchema.parse(await readReviewJson(join(folder,"head.json")));}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return null;throw error;}};
export async function visualContext(directory:string,repo:DraftRepository,repositoryRoot:string,derive=true){
 const c=await contentReviewContext(directory,repo);
 if(c.journal.state!=="CONTENT_READY")fail("VISUAL_CONTENT_AUDIT_PREREQUISITES_MISSING",3);
 const sources=await loadReviewPayload(c.journal,"sources") as LocalSourceBundle;
 const visualSkill=sources.scope==="existing_ai"?await readAuditSkill(directory,"visual"):undefined;
 const folder=visualFolder(directory,c.binding.attemptId),stored=await existingHead(folder);
 const head=stored??headSchema.parse({schemaVersion:1,protocol:"xpotato-private-visual-journal-v1",
  reviewHeadSha256:fingerprint(c.journal.head),receipts:[],bindings:{},outputs:{},rejection:null});
 if(head.reviewHeadSha256!==fingerprint(c.journal.head))fail("VISUAL_UPSTREAM_REVIEW_STALE",3);
 let state:ArticleJobState="CONTENT_READY",previous=c.journal.head.receipts.at(-1)??null,lastStage="";
 for(const hash of head.receipts){
  const receipt=articleStageReceiptSchema.parse(await readReviewJson(join(folder,"receipts",hash+".json")));
  const {receiptSha256,...unsigned}=receipt,required=requirements(receipt.stage);
  if(receiptSha256!==hash||fingerprint(unsigned)!==hash||receipt.previousReceiptSha256!==previous
   ||receipt.jobId!==c.binding.jobId||receipt.attemptId!==c.binding.attemptId||receipt.jobFingerprint!==c.binding.jobFingerprint
   ||receipt.inputSha256!==c.binding.inputSha256||receipt.from!==state||states[receipt.stage]!==receipt.to
   ||receipt.profileId!=="local-article-visual-v1"||receipt.result!=="success"||!canTransition(state,receipt.to)
   ||!exact(receipt.inputs,required.inputs)||!exact(receipt.outputs,required.outputs))fail("VISUAL_RECEIPT_INVALID",3);
  for(const [key,value] of Object.entries(receipt.inputs))if(head.bindings[key]!==value)fail("VISUAL_RECEIPT_INPUT_SET_INVALID",3);
  for(const [key,value] of Object.entries(receipt.outputs))if(head.outputs[key]!==value)fail("VISUAL_RECEIPT_OUTPUT_SET_INVALID",3);
  previous=hash;state=receipt.to;lastStage=receipt.stage;
 }
 const required=lastStage?requirements(lastStage,Boolean(head.rejection)):{inputs:[],outputs:[]};
 if(!exact(head.bindings,required.inputs)||!exact(head.outputs,required.outputs))fail("VISUAL_HEAD_REQUIRED_SET_INVALID",3);
 for(const [role,hash] of Object.entries(head.bindings)){
  const data=await readReviewJson(join(folder,"artifacts",hash+".json"));
  if(fingerprint(data)!==hash||fingerprint(await readReviewJson(workingPath(directory,role)))!==hash)fail("VISUAL_WORKING_INPUT_STALE",3);
 }
 for(const hash of Object.values(head.outputs))if(fingerprint(await readReviewJson(join(folder,"artifacts",hash+".json")))!==hash)fail("VISUAL_OUTPUT_HASH_MISMATCH",3);
 const payload=(name:string)=>readReviewJson(join(folder,"artifacts",head.outputs[name]!+".json"));
 let plan:ArticleVisualPlan|undefined,masters:ArticleVisualMasters|undefined,audit:LocalVisualAudit|undefined,media:ArticleVisualMedia|undefined;
 const frontmatter=splitDraft(c.status.input).frontmatter,categoryLabel=repo.categories.find(item=>item.id===frontmatter.category)!.label;
 let cover:Awaited<ReturnType<typeof import("./visual-media-runtime.js").coverForPlan>>|undefined;
 if(head.outputs.plan){
  plan=articleVisualPlanSchema.parse(await payload("plan"));
  const runtime=await import("./visual-media-runtime.js");cover=await runtime.coverForPlan(repositoryRoot,frontmatter,categoryLabel);
  const expected=assembleVisualPlan(c,sources,plan.visualInput,fingerprint(cover.binding),plan.rights.find(item=>item.rightsId==="generated-cover-rights")!.confirmedAt);
  if(fingerprint(expected)!==head.outputs.plan||fingerprint(plan.visualInput)!==head.bindings.visual)fail("VISUAL_PLAN_SEMANTIC_MISMATCH",3);
  await runtime.verifyVisualSourceInputs(directory,plan);
  if(head.outputs.masters){
   masters=articleVisualMastersSchema.parse(await payload("masters"));
   if(masters.planSha256!==plan.planSha256)fail("VISUAL_MASTERS_PLAN_MISMATCH",3);
   await runtime.verifyVisualMediaBytes(folder,masters);
   if(derive&&fingerprint(await runtime.materializeVisualMasters(directory,folder,plan,cover))!==head.outputs.masters)fail("VISUAL_MASTER_REPRODUCTION_MISMATCH",3);
   const request=makeVisualAuditRequest(plan,masters,visualSkill);
   if(fingerprint(request)!==head.outputs.auditRequest)fail("VISUAL_AUDIT_REQUEST_MISMATCH",3);
   if(head.bindings.audit){
    audit=validateLocalVisualAudit(await readReviewJson(join(folder,"artifacts",head.bindings.audit+".json")),request);
    if(Boolean(head.rejection)!==(audit.conclusion!=="pass")||head.rejection&&head.rejection!==head.bindings.audit)fail("VISUAL_AUDIT_STATE_MISMATCH",3);
    if(["VISUAL_AUDITED","MEDIA_READY","CANDIDATE_READY","PREVIEW_VALIDATED","HUMAN_REVIEW_READY"].includes(state)&&audit.conclusion!=="pass")fail("VISUAL_AUDIT_PREREQUISITE_INVALID",3);
   }
   if(head.outputs.media){
    if(!audit)fail("VISUAL_AUDIT_MISSING",3);
    media=articleVisualMediaSchema.parse(await payload("media"));validateCandidateRegistry(media,masters,audit);
    await runtime.verifyVisualMediaBytes(folder,masters,media);
    if(derive&&fingerprint(await runtime.prepareVisualDelivery(folder,plan,masters,audit))!==head.outputs.media)fail("VISUAL_VARIANT_REPRODUCTION_MISMATCH",3);
   }
  }
 }
 if(head.rejection&&(state!=="VISUAL_READY"||!audit))fail("VISUAL_REJECTION_STATE_INVALID",3);
 if(head.outputs.candidate){const {verifyCandidateOutputs}=await import("./candidate-integrity.js");await verifyCandidateOutputs({directory,repositoryRoot,c,head,folder,plan:plan!,masters:masters!,audit:audit!,media:media!});}
 const baseline:Record<string,string|null>={};
 for(const role of ["visual","audit"]){try{baseline[role]=sha256(await safeRead(workingPath(directory,role)));}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;baseline[role]=null;}}
 const fresh=async()=>{
  await c.fresh();
  if(fingerprint(await existingHead(folder))!==fingerprint(stored))fail("VISUAL_HEAD_CHANGED_DURING_COMMIT",3);
 };
 return {directory,repo,repositoryRoot,c,sources,folder,head,state,plan,masters,audit,media,cover,frontmatter,categoryLabel,baseline,fresh,visualSkill};
}
export type VisualContext=Awaited<ReturnType<typeof visualContext>>;
export const visualPayload=(v:VisualContext,name:string)=>readReviewJson(join(v.folder,"artifacts",v.head.outputs[name]!+".json"));
export async function commitVisual(v:VisualContext,input:{role?:"visual"|"audit";payload?:unknown;outputs?:Record<string,unknown>;stages:string[];rejected?:boolean}){
 const head=headSchema.parse(v.head);
 await noLinks(v.folder);await mkdir(join(v.folder,"receipts"),{recursive:true,mode:0o700});
 if(input.role){const hash=await writeReviewArtifact(v.folder,input.payload);if(head.bindings[input.role]&&head.bindings[input.role]!==hash)fail("VISUAL_CHANGED_REVISE_REQUIRED",3);head.bindings[input.role]=hash;}
 for(const [name,value] of Object.entries(input.outputs??{}))head.outputs[name]=await writeReviewArtifact(v.folder,value);
 if(input.rejected)head.rejection=head.bindings.audit!;
 let state=v.state;
 for(const stage of input.stages){
  const to=states[stage];if(!to||!canTransition(state,to)||head.rejection)fail("VISUAL_STAGE_ORDER_INVALID",3);
  const time=new Date().toISOString(),required=requirements(stage);
  const unsigned={schemaVersion:1,...v.c.binding,previousReceiptSha256:head.receipts.at(-1)??v.c.journal.head.receipts.at(-1)??null,
   from:state,to,stage,profileId:"local-article-visual-v1",inputs:Object.fromEntries(required.inputs.map(key=>[key,head.bindings[key]!])),
   outputs:Object.fromEntries(required.outputs.map(key=>[key,head.outputs[key]!])),result:"success",startedAt:time,finishedAt:time};
  const receipt=articleStageReceiptSchema.parse({...unsigned,receiptSha256:fingerprint(unsigned)});
  await immutable(join(v.folder,"receipts",receipt.receiptSha256+".json"),canonicalJson(receipt)+"\n");head.receipts.push(receipt.receiptSha256);state=to;
 }
 await v.fresh();
 if(input.role){
  let current:string|null=null;try{current=sha256(await safeRead(workingPath(v.directory,input.role)));}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
  if(current!==v.baseline[input.role])fail("VISUAL_INPUT_CHANGED_DURING_IMPORT",3);
  await atomic(workingPath(v.directory,input.role),canonicalJson(input.payload)+"\n");
 }
 const plan=(input.outputs?.plan??v.plan) as ArticleVisualPlan|undefined;
 if(plan)await (await import("./visual-media-runtime.js")).verifyVisualSourceInputs(v.directory,plan);
 await v.fresh();
 for(const [role,hash] of Object.entries(head.bindings))if(fingerprint(await readReviewJson(workingPath(v.directory,role)))!==hash)fail("VISUAL_INPUT_CHANGED_DURING_COMMIT",3);
 await atomic(join(v.folder,"head.json"),canonicalJson(head)+"\n");return {head,state};
}
const result=<T extends Record<string,unknown>>(v:VisualContext,state:string,extra:T)=>({...v.c.binding,state,productionEligible:false,approvalEligible:false,candidateSha256:null,...extra});
export const planArticleVisuals=(directory:string,repo:DraftRepository,repositoryRoot:string,input:unknown=defaultVisualInput)=>locked(directory,async()=>{
 const v=await visualContext(directory,repo,repositoryRoot);
 if(v.head.bindings.visual){if(fingerprint(input)!==v.head.bindings.visual)fail("VISUAL_CHANGED_REVISE_REQUIRED",3);return result(v,v.state,{planSha256:v.plan!.planSha256,reused:true});}
 if(v.state!=="CONTENT_READY")fail("VISUAL_STAGE_ORDER_INVALID",3);
 const runtime=await import("./visual-media-runtime.js"),cover=await runtime.coverForPlan(repositoryRoot,v.frontmatter,v.categoryLabel);
 const plan=assembleVisualPlan(v.c,v.sources,input,fingerprint(cover.binding),new Date().toISOString());
 await runtime.verifyVisualSourceInputs(directory,plan);
 const next=await commitVisual(v,{role:"visual",payload:plan.visualInput,outputs:{plan},stages:["visual-plan"]});
 return result(v,next.state,{planSha256:plan.planSha256,scope:plan.scope});
});
export const materializeArticleVisuals=(directory:string,repo:DraftRepository,repositoryRoot:string)=>locked(directory,async()=>{
 const v=await visualContext(directory,repo,repositoryRoot);
 if(!v.c.store.spec.permissions.localMediaProcessing)fail("LOCAL_MEDIA_PROCESSING_PERMISSION_REQUIRED",3);
 if(v.masters)return result(v,v.state,{mastersSha256:v.masters.mastersSha256,reused:true});
 if(v.state!=="VISUAL_PLANNED")fail("VISUAL_PLAN_REQUIRED",3);
 const masters=await (await import("./visual-media-runtime.js")).materializeVisualMasters(directory,v.folder,v.plan!,v.cover!);
 const auditRequest=makeVisualAuditRequest(v.plan!,masters,v.visualSkill);
 const next=await commitVisual(v,{outputs:{masters,auditRequest},stages:["visual-master"]});
 return result(v,next.state,{mastersSha256:masters.mastersSha256,images:masters.assets.map(item=>({assetId:item.assetId,sha256:item.ingest.canonicalMaster.sha256,path:join(v.folder,item.ingest.canonicalMaster.privateRelativePath)}))});
});
export const prepareVisualAudit=(directory:string,repo:DraftRepository,repositoryRoot:string)=>locked(directory,async()=>{
 const v=await visualContext(directory,repo,repositoryRoot);
 if(v.state!=="VISUAL_READY"||v.head.rejection)fail("VISUAL_AUDIT_PREREQUISITES_MISSING",3);
 return result(v,v.state,{request:makeVisualAuditRequest(v.plan!,v.masters!,v.visualSkill),requestPath:join(v.folder,"artifacts",v.head.outputs.auditRequest!+".json")});
});
export const importVisualAudit=(directory:string,repo:DraftRepository,repositoryRoot:string,input:unknown)=>locked(directory,async()=>{
 const v=await visualContext(directory,repo,repositoryRoot);
 if(v.head.bindings.audit){if(fingerprint(input)!==v.head.bindings.audit)fail("VISUAL_CHANGED_REVISE_REQUIRED",3);return result(v,v.state,{reused:true,visualRevisionRequired:Boolean(v.head.rejection)});}
 if(v.state!=="VISUAL_READY")fail("VISUAL_AUDIT_PREREQUISITES_MISSING",3);
 const audit=validateLocalVisualAudit(input,makeVisualAuditRequest(v.plan!,v.masters!,v.visualSkill)),passed=audit.conclusion==="pass";
 const next=await commitVisual(v,{role:"audit",payload:audit,stages:passed?["visual-audit"]:[],rejected:!passed});
 return result(v,next.state,{visualRevisionRequired:!passed,auditSha256:fingerprint(audit)});
});
export const prepareArticleMedia=(directory:string,repo:DraftRepository,repositoryRoot:string)=>locked(directory,async()=>{
 const v=await visualContext(directory,repo,repositoryRoot);
 if(!v.c.store.spec.permissions.localMediaProcessing)fail("LOCAL_MEDIA_PROCESSING_PERMISSION_REQUIRED",3);
 if(v.media)return result(v,v.state,{mediaSha256:v.media.mediaSha256,reused:true});
 if(v.state!=="VISUAL_AUDITED"||v.head.rejection)fail("VISUAL_AUDIT_PREREQUISITES_MISSING",3);
 const media=await (await import("./visual-media-runtime.js")).prepareVisualDelivery(v.folder,v.plan!,v.masters!,v.audit!);
 const next=await commitVisual(v,{outputs:{media},stages:["media"]});
 return result(v,next.state,{mediaSha256:media.mediaSha256,registrySha256:fingerprint(media.registry)});
});
