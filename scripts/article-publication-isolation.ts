import {mkdtemp,mkdir,readFile,writeFile,cp,rename,readdir} from "node:fs/promises";
import {join} from "node:path";
import {stringify} from "yaml";
import {fingerprint,sha256} from "../packages/article-pipeline/src/canonical.js";
import {readMockExportData} from "../packages/article-pipeline/src/publication-cleanup-fixture.js";
import {randomUUID} from "node:crypto";
import {createRequire} from "node:module";
import {repository,loadRepository} from "./article-repository.js";
import {initDraft,reviseDraft} from "../packages/article-pipeline/src/draft-job.js";
import {privateRoot,safeRead,atomic} from "../packages/article-pipeline/src/private-files.js";
import {fixtureReviewBody,fixtureReviewInputs,fixtureContentAudit} from "../packages/article-pipeline/src/content-review-fixture.js";
import {importReviewSources,importReviewEvidence,prepareContentAudit,importContentAudit} from "../packages/article-pipeline/src/content-review.js";
import {fixtureVisualInput,fixtureVisualAudit} from "../packages/article-pipeline/src/visual-review-fixture.js";
import {planArticleVisuals,materializeArticleVisuals,prepareVisualAudit,importVisualAudit,prepareArticleMedia} from "../packages/article-pipeline/src/visual-review.js";
import {buildArticleCandidate} from "../packages/article-pipeline/src/candidate-review.js";
import {approveMockCandidate,publicationCandidate,readPublicationHead} from "../packages/article-pipeline/src/publication-approval.js";
import {DirectoryMockPublicationPort} from "../packages/article-pipeline/src/publication-mock-port.js";
import {persistMockMedia,validateMockReceipts} from "../packages/article-pipeline/src/publication-persistence.js";
import {exportMockCandidate,verifyMockExport} from "../packages/article-pipeline/src/publication-export.js";
import assert from "node:assert/strict";
import {renderMockExportAfterJobRemoval} from "../packages/article-pipeline/src/publication-cleanup-fixture.js";

const receiptFolder=join(repository,".local/article-publication-isolation");
if(process.argv.includes("--check")){
 const receipt=JSON.parse(await safeRead(join(receiptFolder,"receipt.json")));
 async function scan(folder:string):Promise<void>{for(const entry of await readdir(folder,{withFileTypes:true})){
  const path=join(folder,entry.name);if(entry.isDirectory())await scan(path);else{
   const text=await readFile(path);for(const marker of [receipt.marker,receipt.target,receipt.exportSha256,"mock-only-protected-"])
    assert.ok(!text.includes(Buffer.from(marker)),"Mock publication artifact leaked: "+entry.name);
  }
 }}
 await scan(join(repository,"apps/site/dist"));console.log("Private publication isolation PASS: no mock source/export/provenance/recovery bytes in public dist.");process.exit(0);
}
const root=await privateRoot(repository),repo=await loadRepository(),marker="PRIVATE_PUBLICATION_"+randomUUID();
const job=await initDraft(root,repo,{title:"保存と承認の合成fixture",description:"実サービスの成功を表さないローカルmock検証です。",
 slug:"private-publication-fixture",category:"software",pubDate:new Date().toISOString().slice(0,10),
 readerOutcome:"mockで承認と保存とexportの境界を確認",intent:"publish",network:false,localMediaProcessing:true});
const body=fixtureReviewBody.replace(/^# /u,"## ")+"\n"+marker+"\n";
await reviseDraft(job.directory,repo,"synthetic publication fixture",body);
const inputs=fixtureReviewInputs(body);
await importReviewSources(job.directory,repo,inputs.sources);await importReviewEvidence(job.directory,repo,inputs.evidence);
const audit=await prepareContentAudit(job.directory,repo);await importContentAudit(job.directory,repo,fixtureContentAudit(audit.request.requestSha256));
await planArticleVisuals(job.directory,repo,repository,fixtureVisualInput());await materializeArticleVisuals(job.directory,repo,repository);
const visual=(await prepareVisualAudit(job.directory,repo,repository)).request;
await importVisualAudit(job.directory,repo,repository,fixtureVisualAudit(visual));await prepareArticleMedia(job.directory,repo,repository);
const candidate=await buildArticleCandidate(job.directory,repo,repository,true),target=candidate.targetSha256;
const port=new DirectoryMockPublicationPort(join(root,".mock-media-provider"));
await assert.rejects(()=>persistMockMedia(job.directory,repo,repository,target,"source",port));
await approveMockCandidate(job.directory,repo,repository,target);
await assert.rejects(()=>persistMockMedia(job.directory,repo,repository,target,"public",port),/STAGE_ORDER/u);
await persistMockMedia(job.directory,repo,repository,target,"source",port);
await assert.rejects(()=>exportMockCandidate(job.directory,repo,repository,target,port),/PROTECTION_REQUIRED/u);
await persistMockMedia(job.directory,repo,repository,target,"public",port);
await persistMockMedia(job.directory,repo,repository,target,"protected",port);
const exported=await exportMockCandidate(job.directory,repo,repository,target,port);
const manifest=await verifyMockExport(exported.output,exported.exportSha256);
await mkdir(receiptFolder,{recursive:true,mode:0o700});
const cleanupPackage=join(receiptFolder,"cleanup-"+randomUUID());await cp(exported.output,cleanupPackage,{recursive:true,errorOnExist:true});
const unavailable=job.directory+".temporarily-unavailable";
let cleanup;
await rename(job.directory,unavailable);
try{cleanup=await renderMockExportAfterJobRemoval(repository,cleanupPackage,exported.exportSha256,port);}
finally{await rename(unavailable,job.directory);}
assert.equal(cleanup.productionEligible,false);
const original=await safeRead(join(job.directory,"working.md"));
try{
 await writeFile(join(job.directory,"working.md"),original+"\n承認後の変更\n");
 await assert.rejects(()=>exportMockCandidate(job.directory,repo,repository,target,port));
}finally{await writeFile(join(job.directory,"working.md"),original);}
// Four real executor update paths on an explicitly synthetic published-repository model.
let previous=await readMockExportData(exported.output,exported.exportSha256),currentBody=body,previousOutput=exported.output,currentHero:Buffer|null=null;
const updates=[];

for(const kind of ["body","title","hero","route"] as const){
 console.log("Mock update fixture: "+kind);
 const storedBefore=new Set(await readdir(join(root,".mock-media-provider/public")));
 const snapshot={...repo.registrySnapshot};
 for(const file of previous.manifest.files)if(file.path.includes("/content-registry/"))
  snapshot[file.path]=await safeRead(join(previousOutput,"files",file.path));
 const beforeSource=previous.mdx,beforeRoute=previous.manifest.route,beforeSlug=beforeRoute.split("/")[2]!;
 const record={contentId:previous.frontmatter.id,collection:"blog",slug:beforeSlug,route:beforeRoute,source:beforeSource,
  sourceSha256:sha256(beforeSource),registrySha256:fingerprint(snapshot)};
 const updateRepo={...repo,registrySnapshot:snapshot,records:[...repo.records,record],occupiedRoutes:[...repo.occupiedRoutes,beforeRoute],
  fingerprint:fingerprint({base:repo.fingerprint,record,snapshot})};
 const nextSlug=kind==="route"?"private-publication-moved":beforeSlug;
 const updated=await initDraft(root,updateRepo,{contentId:record.contentId,slug:nextSlug,allowRouteChange:kind==="route",
  updateKind:kind==="hero"?"media_only":"correction",intent:"publish",network:false,localMediaProcessing:true});
 if(kind==="body")currentBody+="\n本文更新の合成fixtureです。\n";
 const fm={...previous.frontmatter,draft:true,...(kind==="title"?{title:"タイトル更新の合成fixture"}:{})};
 const input="---\n"+stringify(fm,{lineWidth:0}).trimEnd()+"\n---\n"+currentBody;
 await reviseDraft(updated.directory,updateRepo,"synthetic update "+kind,input);
 const review=fixtureReviewInputs(currentBody);
 await importReviewSources(updated.directory,updateRepo,review.sources);await importReviewEvidence(updated.directory,updateRepo,review.evidence);
 const contentRequest=await prepareContentAudit(updated.directory,updateRepo);
 await importContentAudit(updated.directory,updateRepo,fixtureContentAudit(contentRequest.request.requestSha256));
 const visualInput=fixtureVisualInput();
 if(kind==="hero"||currentHero){
  const sharp=createRequire(join(repository,"packages/media-ingest/package.json"))("sharp");
  const bytes=currentHero&&kind!=="hero"?currentHero:await sharp({create:{width:1200,height:630,channels:3,background:"#71529a"}}).png().toBuffer();
  currentHero=bytes;
  await mkdir(join(updated.directory,"source-media"),{mode:0o700});await writeFile(join(updated.directory,"source-media/hero.png"),bytes);
  visualInput.hero={kind:"local_raster",origin:"diagram",assetId:"article-hero",path:"source-media/hero.png",sha256:sha256(bytes),
   alt:"合成fixtureの装飾図形",decorative:true,rights:{schemaVersion:1,rightsId:"mock-hero-rights",basis:"self_created",
    publicationAuthorized:true,ownerOrSource:"人工fixture。本人の実権利確認ではありません。",confirmedBy:"user",confirmedAt:new Date().toISOString()}};
 }
 await planArticleVisuals(updated.directory,updateRepo,repository,visualInput);await materializeArticleVisuals(updated.directory,updateRepo,repository);
 const visualRequest=(await prepareVisualAudit(updated.directory,updateRepo,repository)).request;
 await importVisualAudit(updated.directory,updateRepo,repository,fixtureVisualAudit(visualRequest));await prepareArticleMedia(updated.directory,updateRepo,repository);
 const next=await buildArticleCandidate(updated.directory,updateRepo,repository,true);
 assert.notEqual(next.targetSha256,target);await approveMockCandidate(updated.directory,updateRepo,repository,next.targetSha256);
 for(const plane of ["source","public","protected"] as const)await persistMockMedia(updated.directory,updateRepo,repository,next.targetSha256,plane,port);
 const result=await exportMockCandidate(updated.directory,updateRepo,repository,next.targetSha256,port);
 const data=await readMockExportData(result.output,result.exportSha256);
 assert.equal(data.frontmatter.id,record.contentId);
 const objects=(registry:typeof data.registry)=>registry.assets.flatMap(asset=>[asset.delivery.master,...asset.delivery.variants]).map(object=>object.objectKey).sort();
 if(kind==="body"||kind==="route")assert.deepEqual(objects(data.registry),objects(previous.registry));
 if(kind==="title")assert.notEqual(data.registry.assets.find(asset=>asset.role==="social_card")!.delivery.master.sha256,previous.registry.assets.find(asset=>asset.role==="social_card")!.delivery.master.sha256);
 if(kind==="hero")assert.notEqual(data.registry.assets.find(asset=>asset.role==="hero")!.delivery.master.sha256,previous.registry.assets.find(asset=>asset.role==="hero")!.delivery.master.sha256);
 if(kind==="route"){
  assert.equal(data.provenance.content.route,"/blog/private-publication-moved/");
  assert.ok(data.manifest.changes.some((change:{path:string})=>change.path.includes("article-redirects")));
 }
 for(const key of storedBefore)assert.ok((await readdir(join(root,".mock-media-provider/public"))).includes(key));
 updates.push({kind,target:next.targetSha256,exportSha256:result.exportSha256,route:data.manifest.route,oldObjectsRetained:true});
 previous=data;previousOutput=result.output;
}
const context=await publicationCandidate(job.directory,repo,repository,target,"mock"),head=await readPublicationHead(context);
await validateMockReceipts(context,head);
assert.equal(head.state,"EXPORTED");assert.equal(exported.productionEligible,false);
await mkdir(join(repository,".local/article-publication-isolation"),{recursive:true,mode:0o700});
await atomic(join(repository,".local/article-publication-isolation/receipt.json"),JSON.stringify({protocol:"xpotato-private-publication-fixture-v1",
 job:job.directory,jobId:job.jobId,marker,target,exportSha256:exported.exportSha256,output:exported.output,cleanup,updates,
 candidateSha256:null,isHumanApproval:false,productionEligible:false})+"\n");
console.log("Private publication mock PASS: synthetic decision, source/public/protected read-back receipts, exact private export; real human approval/provider/publication not performed.");
