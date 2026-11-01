import {articleMediaTargets,articleMediaTargetsSha256} from "@xpotato/content-contracts/article-media-targets";
import {afterEach,describe,it,expect} from "vitest";
import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {type LocalVisualAuditRequest} from "@xpotato/content-contracts";
import {initDraft,reviseDraft,type DraftRepository} from "./draft-job.js";
import {fixtureReviewBody,fixtureReviewInputs,fixtureContentAudit} from "./content-review-fixture.js";
import {importReviewSources,importReviewEvidence,prepareContentAudit,importContentAudit} from "./content-review.js";
import {planArticleVisuals,materializeArticleVisuals,prepareVisualAudit,importVisualAudit,prepareArticleMedia,visualContext,verifiedPublicationMediaSnapshot} from "./visual-review.js";
import {fixtureVisualInput,fixtureVisualAudit} from "./visual-review-fixture.js";
import {validateCandidateMediaPlan,validateLocalVisualAudit} from "./visual-analysis.js";
import {fingerprint} from "./canonical.js";
const roots:string[]=[];afterEach(async()=>{await Promise.all(roots.splice(0).map(path=>rm(path,{recursive:true,force:true})));});
const repo:DraftRepository={commit:"a".repeat(40),fingerprint:"b".repeat(64),categories:[{id:"software",label:"ソフトウェア",status:"active"}],
 tags:[],records:[],occupiedRoutes:[],registrySnapshot:{media:"empty"}};
const repositoryRoot=resolve(".");
async function setup(processing=true){
 const root=await mkdtemp(join(tmpdir(),"visual-review-fixture-"));roots.push(root);
 const job=await initDraft(root,repo,{title:"手書きの記事と、根拠・画像を確かめる",description:"A4合成fixtureの記事です",slug:"visual-fixture",
  category:"software",pubDate:"2026-10-15",readerOutcome:"fixture",intent:"review",network:false,localMediaProcessing:processing});
 await reviseDraft(job.directory,repo,"fixture body",fixtureReviewBody);
 const input=fixtureReviewInputs();await importReviewSources(job.directory,repo,input.sources);await importReviewEvidence(job.directory,repo,input.evidence);
 const audit=await prepareContentAudit(job.directory,repo);await importContentAudit(job.directory,repo,fixtureContentAudit(audit.request.requestSha256));
 return {root,job};
}
describe("private A4 media stages",()=>{
 it("materializes actual outlined masters, gates variants behind independent audit and binds registry/output bytes",async()=>{
  const f=await setup();expect((await planArticleVisuals(f.job.directory,repo,repositoryRoot,fixtureVisualInput())).state).toBe("VISUAL_PLANNED");
  const master=await materializeArticleVisuals(f.job.directory,repo,repositoryRoot);
  expect(master.state).toBe("VISUAL_READY");expect(master.candidateSha256).toBeNull();
  await expect(prepareArticleMedia(f.job.directory,repo,repositoryRoot)).rejects.toThrow("VISUAL_AUDIT_PREREQUISITES");
  const request=(await prepareVisualAudit(f.job.directory,repo,repositoryRoot)).request as LocalVisualAuditRequest;
  const audit=fixtureVisualAudit(request);await importVisualAudit(f.job.directory,repo,repositoryRoot,audit);
  const result=await prepareArticleMedia(f.job.directory,repo,repositoryRoot);expect(result.state).toBe("MEDIA_READY");expect(result.approvalEligible).toBe(false);
  const current=await visualContext(f.job.directory,repo,repositoryRoot,false),media=current.media!;
  const reused=await verifiedPublicationMediaSnapshot(f.job.directory,{...repo,commit:'c'.repeat(40)},repositoryRoot);
  expect(reused.media?.mediaSha256).toBe(media.mediaSha256);expect(reused.candidateState).toBe('not_validated');
  expect(reused).not.toHaveProperty('state');expect(reused).not.toHaveProperty('head');
  expect(media.registry.assets.map(item=>item.role)).toEqual(["hero","social_card"]);
  expect(media.registry.assets[1]!.delivery.master).toMatchObject({width:1200,height:630,format:"png"});
  expect(media.registry.assets[0]!.delivery.variants).toHaveLength(12);
  expect(current.c.status.input).toContain("draft: true");expect(media.localObjects.every(item=>!item.path.includes(".."))).toBe(true);
  const old=await readFile(join(current.folder,current.masters!.assets[0]!.ingest.canonicalMaster.privateRelativePath));
  await writeFile(join(current.folder,current.masters!.assets[0]!.ingest.canonicalMaster.privateRelativePath),Buffer.from("edited"));
  await expect(visualContext(f.job.directory,repo,repositoryRoot)).rejects.toThrow();
  await expect(verifiedPublicationMediaSnapshot(f.job.directory,repo,repositoryRoot)).rejects.toThrow();
  await writeFile(join(current.folder,current.masters!.assets[0]!.ingest.canonicalMaster.privateRelativePath),old);
  await writeFile(join(f.job.directory,"working.md"),current.c.status.input.replace("手書きの記事","編集した記事"));
  await expect(visualContext(f.job.directory,repo,repositoryRoot)).rejects.toThrow("STALE");
 },60000);
 it("keeps rejected visual history and requires a new attempt before a different audit",async()=>{
  const f=await setup();await planArticleVisuals(f.job.directory,repo,repositoryRoot);await materializeArticleVisuals(f.job.directory,repo,repositoryRoot);
  const request=(await prepareVisualAudit(f.job.directory,repo,repositoryRoot)).request as LocalVisualAuditRequest;
  const result=await importVisualAudit(f.job.directory,repo,repositoryRoot,fixtureVisualAudit(request,false));
  expect(result.state).toBe("VISUAL_READY");expect(result.visualRevisionRequired).toBe(true);
  await expect(importVisualAudit(f.job.directory,repo,repositoryRoot,fixtureVisualAudit(request,true))).rejects.toThrow("REVISE_REQUIRED");
  await expect(prepareArticleMedia(f.job.directory,repo,repositoryRoot)).rejects.toThrow("PREREQUISITES");
  const previous=(await visualContext(f.job.directory,repo,repositoryRoot,false)).c.binding.attemptId;
  const revised=await reviseDraft(f.job.directory,repo,"visual correction");
  expect(revised.state).toBe("CREATED");expect(revised.supersededAttemptId).toBe(previous);
 },30000);
 it("requires local processing permission without changing the Job upper bound",async()=>{
  const f=await setup(false);await planArticleVisuals(f.job.directory,repo,repositoryRoot);
  await expect(materializeArticleVisuals(f.job.directory,repo,repositoryRoot)).rejects.toThrow("PERMISSION_REQUIRED");
 },30000);
});
describe("candidate media plan and audit proof",()=>{
 const request:LocalVisualAuditRequest={schemaVersion:1,protocol:"xpotato-private-visual-audit-request-v1",scope:"synthetic_fixture",
  jobId:"fixture-job",attemptId:"fixture-attempt",inputSha256:"a".repeat(64),planSha256:"b".repeat(64),mastersSha256:"c".repeat(64),
  authorPrincipalId:"fixture-author",producerPrincipalId:"deterministic-visual-executor",
  targetAssets:[{assetId:"article-hero",sha256:"d".repeat(64),path:"masters/hero.webp"},{assetId:"article-social",sha256:"e".repeat(64),path:"masters/social.webp"}],requestSha256:"f".repeat(64)};
 it("requires confirmed exact origin/key/storage profile and never elevates synthetic scope",()=>{
  expect(validateCandidateMediaPlan(null,"synthetic_fixture").confirmed).toBe(false);
  const input=fixtureVisualInput().mediaPlan!;expect(validateCandidateMediaPlan(input,"synthetic_fixture").confirmed).toBe(true);
  expect(()=>validateCandidateMediaPlan(input,"human_local")).toThrow("BINDING");
  expect(()=>validateCandidateMediaPlan({...input,profileSha256:"0".repeat(64)},"synthetic_fixture")).toThrow("BINDING");
  expect(input.profileSha256).toBe(articleMediaTargetsSha256);
 });
 it.each(["self","producer","missing","extra","hash","scope","P1"] as const)("rejects false or stale visual audit: %s",kind=>{
  const audit=fixtureVisualAudit(request);
  if(kind==="self")audit.reviewer.principalId=request.authorPrincipalId;
  if(kind==="producer")audit.reviewer.principalId=request.producerPrincipalId;
  if(kind==="missing")audit.records.pop();
  if(kind==="extra")audit.records.push({...audit.records[0]!,visualId:"unknown"});
  if(kind==="hash")audit.records[0]!.candidateArtifactSha256="0".repeat(64);
  if(kind==="scope")audit.scope="human_local";
  if(kind==="P1"){
   audit.findings.push({findingId:"issue-001",assetId:"article-hero",severity:"P1",description:"合成の未解決finding"});
   const record=audit.records[0]!;record.findings=["issue-001"];const {auditSha256,...unsigned}=record;record.auditSha256=fingerprint(unsigned);
  }
  expect(()=>validateLocalVisualAudit(audit,request)).toThrow();
 });
});
