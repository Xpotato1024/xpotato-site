import {mkdir} from "node:fs/promises";
import {join} from "node:path";
import {createInterface} from "node:readline/promises";
import {humanApprovalRecordSchema} from "@xpotato/content-contracts";
import {validateArticleCandidate} from "./candidate-preview.js";
import type {DraftRepository} from "./draft-job.js";
import {fingerprint,canonicalJson} from "./canonical.js";
import {fail,locked,immutable,safeRead,noLinks} from "./private-files.js";
import {mockDecisionSchema,publicationHeadSchema,type PublicationHead} from "./publication-contracts.js";

export const publicationFolder=(directory:string,attemptId:string,mode:"mock"|"human")=>
 join(directory,"attempts",attemptId,"publication",mode);
export async function publicationCandidate(directory:string,repo:DraftRepository,root:string,target:string,mode:"mock"|"human"){
 const checked=await validateArticleCandidate(directory,repo,root,target);
 if(mode==="human"){
  if(!checked.artifact.approvalEligible||checked.artifact.reference||checked.artifact.scope!=="human_local"
   ||checked.v.state!=="HUMAN_REVIEW_READY"||checked.artifact.candidateSha256!==target)fail("HUMAN_CANDIDATE_REQUIRED",3);
 }else if(checked.artifact.scope!=="synthetic_fixture"||!checked.artifact.reference)fail("MOCK_SYNTHETIC_REFERENCE_REQUIRED",3);
 const folder=publicationFolder(directory,checked.v.c.binding.attemptId,mode);
 return {...checked,directory,root,target,mode,folder};
}
export type PublicationContext=Awaited<ReturnType<typeof publicationCandidate>>;
export async function readPublicationHead(c:PublicationContext){
 const head=publicationHeadSchema.parse(JSON.parse(await safeRead(join(c.folder,"head.json"))));
 if(head.candidateSha256!==c.target||head.inputSha256!==c.v.c.binding.inputSha256
  ||head.attemptId!==c.v.c.binding.attemptId||head.mode!==c.mode)fail("PUBLICATION_APPROVAL_STALE",3);
 const decision=JSON.parse(await safeRead(join(c.folder,"approval.json")));
 if(fingerprint(decision)!==head.approvalSha256)fail("PUBLICATION_APPROVAL_HASH_MISMATCH",3);
 if(c.mode==="mock"){
  const mock=mockDecisionSchema.parse(decision),{decisionSha256,...body}=mock;
  if(Date.parse(mock.decidedAt)>Date.now()||fingerprint(body)!==decisionSha256)fail("MOCK_DECISION_HASH_MISMATCH",3);
 }else{
  const human=humanApprovalRecordSchema.parse(decision);
  if(Date.parse(human.approvedAt)>Date.now())fail("HUMAN_APPROVAL_TIME_INVALID",3);
 }
 if(decision.candidateSha256!==c.target||decision.contentId!==c.materials.frontmatter.id)fail("PUBLICATION_APPROVAL_TARGET_MISMATCH",3);
 return head;
}
async function saveApproval(c:PublicationContext,decision:unknown){
 await noLinks(c.folder);await mkdir(c.folder,{recursive:true,mode:0o700});
 const approvalSha256=fingerprint(decision);
 const head:PublicationHead={protocol:"xpotato-private-publication-v1",mode:c.mode,candidateSha256:c.target,
  inputSha256:c.v.c.binding.inputSha256,attemptId:c.v.c.binding.attemptId,approvalSha256,state:"HUMAN_APPROVED",
  sources:null,publication:null,protection:null,export:null,productionEligible:false};
 await immutable(join(c.folder,"approval.json"),canonicalJson(decision)+"\n");
 // Revalidates actual inputs before activating approval; the file alone never authorizes a stage.
 await validateArticleCandidate(c.directory,c.v.repo,c.root,c.target);
 await immutable(join(c.folder,"head.json"),canonicalJson(head)+"\n");
 return {...head,isHumanApproval:c.mode==="human",simulation:c.mode==="mock"};
}
export const approveMockCandidate=(directory:string,repo:DraftRepository,root:string,target:string)=>
 locked(directory,async()=>{
  const c=await publicationCandidate(directory,repo,root,target,"mock");
  try{return {...await readPublicationHead(c),simulation:true,isHumanApproval:false};}
  catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
  const body={protocol:"xpotato-private-mock-decision-v1" as const,scope:"synthetic_fixture" as const,
   candidateSha256:target,contentId:c.materials.frontmatter.id,decision:"approve_simulation" as const,
   reviewer:"fixture-reviewer" as const,decidedAt:new Date().toISOString(),isHumanApproval:false as const,productionEligible:false as const};
  return saveApproval(c,mockDecisionSchema.parse({...body,decisionSha256:fingerprint(body)}));
 });
export async function approveHumanCandidate(directory:string,repo:DraftRepository,root:string,target:string){
 if(!process.stdin.isTTY||!process.stdout.isTTY||process.env.CI)fail("HUMAN_INTERACTIVE_TERMINAL_REQUIRED",3);
 return locked(directory,async()=>{
  const c=await publicationCandidate(directory,repo,root,target,"human"),prompt=createInterface({input:process.stdin,output:process.stdout});
  try{
   console.log("本人のみ: 本文・画像・根拠・限界・権利・保存計画と公開URLをpreviewで確認してください。承認は保存/公開操作の認可ではありません。");
   const reviewer=await prompt.question("本人の識別名: "),basis=await prompt.question("確認内容・残る制約: ");
   const confirmation=await prompt.question("承認する候補の完全SHA-256を入力（中止は空欄）: ");
   if(confirmation!==target)fail("HUMAN_APPROVAL_TARGET_MISMATCH",3);
   await validateArticleCandidate(directory,repo,root,target);
   return saveApproval(c,humanApprovalRecordSchema.parse({schemaVersion:1,candidateSha256:target,
    contentId:c.materials.frontmatter.id,approvedAt:new Date().toISOString(),reviewer,basis,confirmed:true}));
  }finally{prompt.close();}
 });
}
export function requireLivePublicationResources():never{
 return fail("LIVE_MEDIA_RESOURCES_AND_OPERATION_AUTHORIZATION_NOT_ESTABLISHED",3);
}
