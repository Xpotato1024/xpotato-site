import {mkdir} from "node:fs/promises";
import {join} from "node:path";
import {articleReviewBundleManifestSchema,type LocalSourceBundle} from "@xpotato/content-contracts";
import {renderDraftMarkdown} from "@xpotato/portable-content/draft";
import {inspectExamples} from "@xpotato/portable-content/review";
import {canonicalJson,fingerprint,sha256} from "./canonical.js";
import {assertCurrentDraft,readDraftStore,splitDraft,type DraftRepository} from "./draft-job.js";
import {locked,fail,safeRead,immutable,noLinks} from "./private-files.js";
import {validateLocalSources,analyzeLocalEvidence,makeContentAuditRequest,validateContentAudit} from "./review-analysis.js";
import {writeReviewArtifact,readReviewJournal,loadReviewPayload,loadReviewOutput,commitReviewStages,type ReviewBinding} from "./review-journal.js";
import {privateDraftMarker,draftPreviewHeaders,draftPreviewStyle,servePrivatePreview} from "./draft-preview.js";

const bindingFor=(store:Awaited<ReturnType<typeof readDraftStore>>,inputSha256:string):ReviewBinding=>({
 jobId:store.jobId,attemptId:store.activeAttemptId,jobFingerprint:store.jobFingerprint,inputSha256,
});
async function context(directory:string,repo:DraftRepository){
 const store=await readDraftStore(directory),status=await assertCurrentDraft(directory,store,repo),binding=bindingFor(store,status.inputSha256);
 const journal=await readReviewJournal(directory,binding);
 const baseline:Record<string,string|null>={};
 for(const role of ["sources","evidence","audit"]){
  try{baseline[role]=sha256(await safeRead(join(directory,"working-"+role+".json")));}catch(error){
   if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;baseline[role]=null;
  }
 }
 const fresh=async()=>{
  const latest=await readDraftStore(directory),current=await assertCurrentDraft(directory,latest,repo);
  if(latest.activeAttemptId!==store.activeAttemptId||current.inputSha256!==binding.inputSha256)fail("REVIEW_DRAFT_CHANGED_DURING_COMMIT",3);
  const now=await readReviewJournal(directory,binding);
  if(fingerprint(now.head)!==fingerprint(journal.head))fail("REVIEW_HEAD_CHANGED_DURING_COMMIT",3);
 };
 return {store,status,binding,journal,fresh,baseline,body:splitDraft(status.input).body};
}
const result=<T extends Record<string,unknown>>(binding:ReviewBinding,state:string,extra:T)=>({...binding,state,productionEligible:false,candidateSha256:null,...extra});
export const importReviewSources=(directory:string,repo:DraftRepository,input:unknown)=>locked(directory,async()=>{
 const c=await context(directory,repo),sources=validateLocalSources(input),hash=fingerprint(sources);
 if(c.journal.head.bindings.sources){
  if(c.journal.head.bindings.sources!==hash)fail("REVIEW_INPUT_CHANGED_REVISE_REQUIRED",3);
  return result(c.binding,c.journal.state,{reused:true,sourceBundleSha256:hash});
 }
 if(c.journal.state!=="CREATED")fail("REVIEW_STAGE_ORDER_INVALID",3);
 const next=await commitReviewStages(directory,c.binding,c.journal,{role:"sources",expectedWorkingSha256:c.baseline.sources!,payload:sources,stages:[{stage:"sources"}]},c.fresh);
 return result(c.binding,next.state,{reused:false,sourceBundleSha256:hash,scope:sources.scope});
});
export const importReviewEvidence=(directory:string,repo:DraftRepository,input:unknown)=>locked(directory,async()=>{
 const c=await context(directory,repo),sources=await loadReviewPayload(c.journal,"sources");
 const analysis=analyzeLocalEvidence(c.body,sources,input,c.binding),hash=fingerprint(analysis.bundle);
 if(c.journal.head.bindings.evidence){
  if(c.journal.head.bindings.evidence!==hash)fail("REVIEW_INPUT_CHANGED_REVISE_REQUIRED",3);
  return result(c.binding,c.journal.state,{reused:true,examplesReady:analysis.examplesReady,blockers:analysis.exampleBlockers,examples:analysis.examples.map(example=>({exampleId:example.record.exampleId,label:example.label,status:example.result.status}))});
 }
 if(c.journal.state!=="SOURCES_READY")fail("REVIEW_STAGE_ORDER_INVALID",3);
 const request=makeContentAuditRequest(c.binding,analysis);
 const next=await commitReviewStages(directory,c.binding,c.journal,{role:"evidence",expectedWorkingSha256:c.baseline.evidence!,payload:analysis.bundle,
  outputs:{analysis,auditRequest:request},stages:[{stage:"evidence"},{stage:"draft"},...(analysis.examplesReady?[{stage:"examples"}]:[])]},c.fresh);
 return result(c.binding,next.state,{examplesReady:analysis.examplesReady,
  examples:analysis.examples.map(example=>({exampleId:example.record.exampleId,label:example.label,status:example.result.status})),
  ...(analysis.examplesReady?{contentAuditRequestSha256:request.requestSha256}:{blockers:analysis.exampleBlockers})});
});
export const prepareContentAudit=(directory:string,repo:DraftRepository)=>locked(directory,async()=>{
 const c=await context(directory,repo);
 if(c.journal.state!=="EXAMPLES_ASSESSED")fail("CONTENT_AUDIT_PREREQUISITES_MISSING",3);
 const analysis=analyzeLocalEvidence(c.body,await loadReviewPayload(c.journal,"sources"),await loadReviewPayload(c.journal,"evidence"),c.binding);
 const request=makeContentAuditRequest(c.binding,analysis);
 if(fingerprint(request)!==fingerprint(await loadReviewOutput(c.journal,"auditRequest")))fail("CONTENT_AUDIT_REQUEST_STALE",3);
 await c.fresh();
 return result(c.binding,c.journal.state,{request,
  requestPath:join(c.journal.folder,"artifacts",fingerprint(request)+".json"),
  notice:"独立した人が固定本文・資料・引用・例の結果を確認します。自己確認を独立監査へ昇格しません。"});
});
export const importContentAudit=(directory:string,repo:DraftRepository,input:unknown)=>locked(directory,async()=>{
 const c=await context(directory,repo);
 if(!["EXAMPLES_ASSESSED","CONTENT_READY","REVISION_REQUIRED"].includes(c.journal.state))fail("CONTENT_AUDIT_PREREQUISITES_MISSING",3);
 const analysis=analyzeLocalEvidence(c.body,await loadReviewPayload(c.journal,"sources"),await loadReviewPayload(c.journal,"evidence"),c.binding);
 const request=makeContentAuditRequest(c.binding,analysis),audit=validateContentAudit(input,request),hash=fingerprint(audit);
 if(c.journal.head.bindings.audit){
  if(c.journal.head.bindings.audit!==hash)fail("REVIEW_INPUT_CHANGED_REVISE_REQUIRED",3);
  return result(c.binding,c.journal.state,{reused:true});
 }
 const pass=audit.conclusion==="pass";
 const next=await commitReviewStages(directory,c.binding,c.journal,{role:"audit",expectedWorkingSha256:c.baseline.audit!,payload:audit,
  stages:[{stage:"audit",result:pass?"success":"revision_required"},{stage:pass?"content":"revision",result:pass?"success":"revision_required"}]},c.fresh);
 return result(c.binding,next.state,{scope:audit.scope,contentAuditSha256:hash,approvalEligible:false});
});
export const inspectDraftExamples=(directory:string,repo:DraftRepository)=>locked(directory,async()=>{
 const c=await context(directory,repo);
 return {jobId:c.store.jobId,attemptId:c.store.activeAttemptId,bodySha256:sha256(c.body),
  examples:inspectExamples(c.body).map(({source,...example})=>({...example,label:"未実行"})),productionEligible:false};
});
export const contentReviewReadiness=(state:string,scope?:LocalSourceBundle["scope"],examplesReady?:boolean,exampleBlockers?:readonly {category:"input_missing"|"validation_failed"|"implementation_incomplete"|"environment_unavailable";code:string}[])=>({
 approvalEligible:false as const,productionEligible:false as const,candidateSha256:null,
 blockers:[
  ...(state==="REVISION_REQUIRED"?[{category:"validation_failed" as const,code:"content-audit-revision-required"}]
    :state!=="CONTENT_READY"?[{category:"input_missing" as const,code:"independent-content-audit-incomplete"}]:[]),
  ...(examplesReady===false?(exampleBlockers?.length?exampleBlockers.map(({category,code})=>({category,code}))
    :[{category:"input_missing" as const,code:"valid-example-verification-receipt-required"}]):[]),
  ...(scope==="synthetic_fixture"?[{category:"validation_failed" as const,code:"synthetic-fixture-not-real-review"}]:[]),
  ...["hero-master-missing","social-card-missing","media-registry-missing","visual-audit-missing",
    "public-origin-unconfirmed","object-key-profile-unconfirmed","storage-plan-unconfirmed"].map(code=>({category:"input_missing" as const,code})),
  ...["candidate-builder-unimplemented","candidate-preview-unimplemented"].map(code=>({category:"implementation_incomplete" as const,code})),
 ],
});
const escape=(text:string)=>text.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
export const buildContentReviewBundle=(directory:string,repo:DraftRepository)=>locked(directory,async()=>{
 const c=await context(directory,repo);
 let analysis:ReturnType<typeof analyzeLocalEvidence>|undefined;
 if(c.journal.head.bindings.evidence)analysis=analyzeLocalEvidence(c.body,await loadReviewPayload(c.journal,"sources"),await loadReviewPayload(c.journal,"evidence"),c.binding);
 if(c.journal.head.bindings.audit&&analysis)validateContentAudit(await loadReviewPayload(c.journal,"audit"),makeContentAuditRequest(c.binding,analysis));
 const sources=c.journal.head.bindings.sources?validateLocalSources(await loadReviewPayload(c.journal,"sources")):undefined;
 const readiness=contentReviewReadiness(c.journal.state,sources?.scope,analysis?.examplesReady,analysis?.exampleBlockers),rendered=await renderDraftMarkdown(analysis?.compiled??c.body);
 const document={schemaVersion:1,mode:"content-review",...c.binding,contentState:c.journal.state,
  scope:sources?.scope??"human_local",...readiness,bodySha256:sha256(c.body),reviewInputsSha256:fingerprint(c.journal.head.bindings),
  sources:analysis?.sourceRefs??[],materialClaims:analysis?.materialClaims??[],examples:analysis?.examples??[],
  citationManifest:analysis?.citationManifest??null,audit:c.journal.head.bindings.audit?await loadReviewPayload(c.journal,"audit"):null,
  media:{hero:null,socialCard:null,registry:null,visualAudit:null},publicationPlan:{origin:null,objectKeyProfile:null,storagePlan:null},
  warnings:["非公開の内容review資料です。正式候補・公開承認ではありません。","出典は取込み済みローカルsnapshotだけを照合しました。URLへ接続していません。","画像は未準備。候補のSEO・画像実物・公開予定設定は未検証です。"]};
 const html='<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="'+privateDraftMarker+'" content="content-review;productionEligible=false"><title>非公開内容review</title><style>'+draftPreviewStyle+'</style></head><body><header><h1>'+escape(splitDraft(c.status.input).frontmatter.title)+'</h1><p>正式候補・公開承認ではありません。HUMAN_REVIEW_READY未成立。</p><p>内容工程: '+escape(c.journal.state)+'</p><ul>'+readiness.blockers.map(blocker=>'<li>'+escape(blocker.category+": "+blocker.code)+'</li>').join("")+'</ul></header><main>'+rendered.html+'</main><section aria-label="検証範囲"><h2>根拠・例・監査</h2><pre>'+escape(canonicalJson(document))+'</pre></section></body></html>\n';
 const manifest=articleReviewBundleManifestSchema.parse({schemaVersion:1,mode:"content-review",jobId:c.store.jobId,
  attemptId:c.store.activeAttemptId,inputSha256:c.binding.inputSha256,bodySha256:sha256(c.body),reviewInputsSha256:fingerprint(c.journal.head.bindings),
  htmlSha256:sha256(html),artifactSha256:fingerprint(document),contentState:c.journal.state,...readiness});
 const output=join(directory,"content-reviews",c.store.activeAttemptId,fingerprint(manifest));
 await noLinks(output);await mkdir(output,{recursive:true,mode:0o700});
 await immutable(join(output,"index.html"),html);await immutable(join(output,"review.json"),canonicalJson(document)+"\n");
 await immutable(join(output,"manifest.json"),canonicalJson(manifest)+"\n");
 await immutable(join(output,".private-draft-preview"),privateDraftMarker+"\n");await c.fresh();
 return {...manifest,output,html,headers:draftPreviewHeaders};
});

export const serveContentReviewBundle=async(directory:string,repo:DraftRepository,port=0,refreshRepository?:()=>Promise<DraftRepository>)=>{
 const built=await buildContentReviewBundle(directory,repo);
 const {html,headers,...manifest}=built;
 return servePrivatePreview({html,manifest,output:built.output},async()=>locked(directory,async()=>{
  const c=await context(directory,refreshRepository?await refreshRepository():repo);
  if(c.store.activeAttemptId!==built.attemptId||c.binding.inputSha256!==built.inputSha256
   ||fingerprint(c.journal.head.bindings)!==built.reviewInputsSha256)fail("CONTENT_REVIEW_PREVIEW_STALE",3);
 }),port);
};

export const prepareExampleVerification=(directory:string,repo:DraftRepository,input:unknown)=>locked(directory,async()=>{
 const c=await context(directory,repo);
 if(c.journal.state!=="SOURCES_READY")fail("EXAMPLE_VERIFICATION_PREPARE_STAGE_INVALID",3);
 const analysis=analyzeLocalEvidence(c.body,await loadReviewPayload(c.journal,"sources"),input,c.binding);
 const bundle={protocol:"xpotato-example-verification-request-bundle-v1",...c.binding,scope:analysis.sources.scope,
  requests:analysis.verificationRequests,unverifiedExamples:analysis.examples.filter(item=>!item.accepted).map(item=>({exampleId:item.record.exampleId,label:item.label})),
  productionEligible:false};
 const hash=await writeReviewArtifact(c.journal.folder,bundle);await c.fresh();
 return result(c.binding,c.journal.state,{requestBundleSha256:hash,requestPath:join(c.journal.folder,"artifacts",hash+".json"),
  requestCount:bundle.requests.length,requests:bundle.requests.map(item=>({exampleId:item.exampleId,requestSha256:item.requestSha256,profileId:item.profileId})),
  notice:"別実行主体へ非公開の固定requestを渡してください。このCLIは例を実行しません。receiptをevidenceへ添付してimportします。"});
});
