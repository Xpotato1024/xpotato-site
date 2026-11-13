import {articleMediaTargets,articleMediaTargetsSha256} from "@xpotato/content-contracts/article-media-targets";
import {afterEach,describe,it,expect} from "vitest";
import {mkdtemp,readFile,writeFile,rm,mkdir} from "node:fs/promises";
import sharp from "sharp";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {type LocalVisualAuditRequest} from "@xpotato/content-contracts";
import {initDraft,reviseDraft,type DraftRepository} from "../draft-job.js";
import {fixtureReviewBody,fixtureReviewInputs,fixtureContentAudit} from "../review/content-review-fixture.js";
import {importReviewSources,importReviewEvidence,prepareContentAudit,importContentAudit} from "../review/content-review.js";
import {planArticleVisuals,materializeArticleVisuals,prepareVisualAudit,importVisualAudit,prepareArticleMedia,visualContext,verifiedPublicationMediaSnapshot} from "./visual-review.js";
import {fixtureVisualInput,fixtureVisualAudit} from "./visual-review-fixture.js";
import {validateCandidateMediaPlan,validateLocalVisualAudit} from "./visual-analysis.js";
import {fingerprint,sha256} from "../canonical.js";
import {verifyVisualMediaBytes} from "./visual-media-runtime.js";
const roots:string[]=[];afterEach(async()=>{await Promise.all(roots.splice(0).map(path=>rm(path,{recursive:true,force:true})));});
const repo:DraftRepository={commit:"a".repeat(40),fingerprint:"b".repeat(64),categories:[{id:"software",label:"ソフトウェア",status:"active"}],
 tags:[],records:[],occupiedRoutes:[],registrySnapshot:{media:"empty"}};
const repositoryRoot=resolve(".");
async function setup(processing=true,body=fixtureReviewBody){
 const root=await mkdtemp(join(tmpdir(),"visual-review-fixture-"));roots.push(root);
 const job=await initDraft(root,repo,{title:"手書きの記事と、根拠・画像を確かめる",description:"A4合成fixtureの記事です",slug:"visual-fixture",
  category:"software",pubDate:"2026-10-15",readerOutcome:"fixture",intent:"review",network:false,localMediaProcessing:processing});
 await reviseDraft(job.directory,repo,"fixture body",body);
 const input=fixtureReviewInputs(body);await importReviewSources(job.directory,repo,input.sources);await importReviewEvidence(job.directory,repo,input.evidence);
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

it("keeps animation, independent poster and timeline evidence in the formal audited media flow",async()=>{
 const body=fixtureReviewBody+'\n<Figure asset="motion" alt="合成の動作例" />\n',f=await setup(true,body);
 const pixels=Buffer.concat(["ff0000","0000ff"].map(color=>Buffer.from(color.repeat(32*16),"hex")));
 const motion=await sharp(pixels,{raw:{width:32,height:32,channels:3,pageHeight:16}}).gif({loop:0,delay:[50,150]}).toBuffer();
 const poster=await sharp({create:{width:32,height:16,channels:3,background:"red"}}).png().toBuffer();
 await mkdir(join(f.job.directory,"source-media"));
 await writeFile(join(f.job.directory,"source-media/motion.gif"),motion);
 await writeFile(join(f.job.directory,"source-media/poster.png"),poster);
 const evidence=fixtureReviewInputs(body).evidence.evidence[0]!,input=fixtureVisualInput();
 input.inline=[["motion","motion.gif",motion],["motion-poster","poster.png",poster]].map(([id,file,bytes])=>({
  kind:"local_raster" as const,origin:"screenshot" as const,assetId:id as string,path:"source-media/"+file,sha256:sha256(bytes as Buffer),
  alt:"合成fixtureの状態表示",decorative:false,
  rights:{schemaVersion:1 as const,rightsId:id+"-rights",basis:"self_created" as const,publicationAuthorized:true,
   ownerOrSource:"Synthetic fixture",confirmedBy:"user" as const,confirmedAt:new Date().toISOString(),notes:["実在する製品や人の承認ではないテスト専用データ。"]},
  sourceRefs:[{kind:"evidence" as const,evidenceId:evidence.evidenceId,evidenceRecordSha256:fingerprint(evidence)}],
  requiredFacts:[evidence.proposition],...(id==="motion"?{animation:{posterAssetId:"motion-poster"}}:{})
 }));
 await planArticleVisuals(f.job.directory,repo,repositoryRoot,input);
 const planned=await visualContext(f.job.directory,repo,repositoryRoot,false);
 expect(planned.plan!.visualPlan.plans.find(p=>p.visualId==="motion")!.forbiddenImplications).toEqual(["固定根拠にない実測値・性能・精度を画像だけから推定しない"]);
 await materializeArticleVisuals(f.job.directory,repo,repositoryRoot);
 const request=(await prepareVisualAudit(f.job.directory,repo,repositoryRoot)).request as LocalVisualAuditRequest;
 const target=request.targetAssets.find(a=>a.assetId==="motion")!;
 expect(target.animationContactSheet?.frameIndices).toEqual([0,1]);
 expect(request.targetAssets.map(a=>a.assetId).sort()).toEqual(["article-hero","article-social","motion","motion-poster"]);
 await expect(prepareArticleMedia(f.job.directory,repo,repositoryRoot)).rejects.toThrow("VISUAL_AUDIT_PREREQUISITES");
 await importVisualAudit(f.job.directory,repo,repositoryRoot,fixtureVisualAudit(request));
 await prepareArticleMedia(f.job.directory,repo,repositoryRoot);
 const current=await visualContext(f.job.directory,repo,repositoryRoot,false);
 expect(current.media!.registry.assets.find(a=>a.assetId==="motion")!.delivery).toMatchObject({mode:"animated",posterAssetId:"motion-poster"});
 expect(current.media!.registry.assets.find(a=>a.assetId==="motion-poster")!.delivery.mode).toBe("responsive");
 const forged=structuredClone(current.masters!),master=forged.assets.find(a=>a.assetId==="motion")!,hash=sha256(poster),path="generated/"+hash+".webp";
 await writeFile(join(current.folder,path),poster);
 master.animationContactSheet={...master.animationContactSheet!,path,sha256:hash};
 await expect(verifyVisualMediaBytes(current.folder,forged)).rejects.toThrow("VISUAL_ANIMATION_AUDIT_DERIVATION_INVALID");
},60000);

it("replays a separately bound social layout through the ordinary visual journal and rejects changes",async()=>{
 const f=await setup(),input=fixtureVisualInput(),before=await readFile(join(f.job.directory,"working.md"),"utf8");
 const c=await visualContext(f.job.directory,repo,repositoryRoot,false),title=c.frontmatter.title;
 input.socialCardDisplay={titleSha256:sha256(title),lines:["手書きの記事と、","根拠・画像を確かめる"]};
 await planArticleVisuals(f.job.directory,repo,repositoryRoot,input);
 await materializeArticleVisuals(f.job.directory,repo,repositoryRoot);
 const replay=await visualContext(f.job.directory,repo,repositoryRoot);
 expect(replay.plan!.visualInput.socialCardDisplay).toEqual(input.socialCardDisplay);
 expect(replay.cover!.binding.social.layout.lines).toEqual(input.socialCardDisplay.lines);
 expect(await readFile(join(f.job.directory,"working.md"),"utf8")).toBe(before);
 const path=join(f.job.directory,"working-visual.json"),changed=JSON.parse(await readFile(path,"utf8"));
 changed.socialCardDisplay.lines=["手書きの記事と、根拠・","画像を確かめる"];await writeFile(path,JSON.stringify(changed));
 await expect(visualContext(f.job.directory,repo,repositoryRoot)).rejects.toThrow("VISUAL_WORKING_INPUT_STALE");
},30000);

it.each(['profile-id','confirmed-hash','future-time','executor-principal','extra-destination','wrong-scope'] as const)('rejects an unbound or expanded storage planning confirmation: %s',kind=>{
 const input=structuredClone(fixtureVisualInput().mediaPlan!) as any;
 if(kind==='profile-id')input.profileId='other-storage';
 if(kind==='confirmed-hash')input.confirmation.confirmedProfileSha256='0'.repeat(64);
 if(kind==='future-time')input.confirmation.confirmedAt='2999-01-01T00:00:00Z';
 if(kind==='executor-principal')input.confirmation.principalId='deterministic-visual-executor';
 if(kind==='extra-destination')input.publicOrigin='https://other.example.test';
 if(kind==='wrong-scope')input.scope='existing_ai';
 expect(()=>validateCandidateMediaPlan(input,'synthetic_fixture')).toThrow();
});
it('planning confirmation has no publication, rights, owner proof or persistence side effects',()=>{
 const input=fixtureVisualInput().mediaPlan!,before=JSON.stringify(input),result=validateCandidateMediaPlan(input,'synthetic_fixture');
 expect(result.plan!.profile.persistentMutationAuthorized).toBe(false);
 expect(result.plan!.confirmation.confirmation.purpose).toBe('candidate_planning_only');
 expect(Object.keys(result).sort()).toEqual(['blockers','confirmed','plan']);expect(JSON.stringify(input)).toBe(before);
});
