import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {mkdir,readdir,readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {createRequire} from "node:module";
import {repository,loadRepository} from "./article-repository.js";
import {initDraft,reviseDraft} from "../packages/article-pipeline/src/draft-job.js";
import {privateRoot,atomic,safeRead} from "../packages/article-pipeline/src/private-files.js";
import {fingerprint,sha256} from "../packages/article-pipeline/src/canonical.js";
import {fixtureReviewBody,fixtureReviewInputs,fixtureContentAudit} from "../packages/article-pipeline/src/content-review-fixture.js";
import {importReviewSources,importReviewEvidence,prepareContentAudit,importContentAudit} from "../packages/article-pipeline/src/content-review.js";
import {inspectExamples} from "@xpotato/portable-content/review";
import {planArticleVisuals,materializeArticleVisuals,prepareVisualAudit,importVisualAudit,prepareArticleMedia,visualContext} from "../packages/article-pipeline/src/visual-review.js";
import {fixtureVisualInput,fixtureVisualAudit} from "../packages/article-pipeline/src/visual-review-fixture.js";
import {buildArticleCandidate} from "../packages/article-pipeline/src/candidate-review.js";
import {validateArticleCandidate,serveArticleCandidate} from "../packages/article-pipeline/src/candidate-preview.js";
import {readSiteContent} from "../packages/site-validators/src/site-content.js";

const root=await privateRoot(repository),receiptFolder=join(repository,".local/article-visual-isolation");
await mkdir(receiptFolder,{recursive:true,mode:0o700});const receiptPath=join(receiptFolder,"receipt.json");
if(process.argv[2]==="--prepare"){
 const marker="PRIVATE_VISUAL_CANARY_"+randomUUID(),privateCss="a4-"+randomUUID().replaceAll("-","");
 const repo=await loadRepository(),job=await initDraft(root,repo,{title:"手書きの記事と、根拠・画像を確かめる",description:"根拠と画像を確かめるA4の合成fixtureです。実在する製品の記事ではありません。",
  slug:"private-visual-candidate-fixture",category:"software",pubDate:"2026-10-15",readerOutcome:"合成fixtureで完全previewを検証",intent:"review",network:false,localMediaProcessing:true});
 const fence=String.fromCharCode(96).repeat(3);
 const body=fixtureReviewBody.replace(/^# /u,"## ")+"\n"+marker+"\n\n|項目|確認対象|\n|---|---|\n|画像|登録済みの実バイト|\n|根拠|ローカルの合成資料|\n\n"
  +'<Callout kind="note" title="合成資料について">\nこの表示は試験用です。実在製品の観測ではありません。\n</Callout>\n\n'
  +'![装飾用の幾何学模様](media:fixture-shapes)\n\n<Gallery label="登録画像">\n<Figure asset="fixture-shapes" alt="装飾用の幾何学模様" caption="人工の図形です。測定値やUIの再現ではありません。" />\n</Gallery>\n\n'
  +fence+'html\n<div class="[--'+privateCss+':private]">&lt;script&gt;この例は実行しません&lt;/script&gt;</div>\n'+fence+"\n";
 await reviseDraft(job.directory,repo,"synthetic A4 fixture",body);
 const input=fixtureReviewInputs(body);
 input.evidence.examples=inspectExamples(body).map(example=>({exampleId:example.exampleId,intendedPurpose:"表示・エスケープの合成fixture。実行対象ではありません。",requestedVerification:"illustrative",verificationRequired:false,materialClaimIds:[]}));
 await importReviewSources(job.directory,repo,input.sources);await importReviewEvidence(job.directory,repo,input.evidence);
 const contentAudit=await prepareContentAudit(job.directory,repo);await importContentAudit(job.directory,repo,fixtureContentAudit(contentAudit.request.requestSha256));
 const sharp=createRequire(join(repository,"packages/media-ingest/package.json"))("sharp");
 const png=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect width="1200" height="600" fill="#f6f3ec"/><circle cx="400" cy="300" r="160" fill="#745399"/><rect x="650" y="150" width="250" height="300" rx="50" fill="#bfa1d0"/></svg>')).png().withExif({IFD0:{Artist:marker}}).toBuffer();
 await mkdir(join(job.directory,"source-media"),{mode:0o700});await writeFile(join(job.directory,"source-media/shapes.png"),png,{mode:0o600});
 const visual=fixtureVisualInput();
 visual.inline.push({kind:"local_raster",origin:"diagram",assetId:"fixture-shapes",path:"source-media/shapes.png",sha256:sha256(png),
  alt:"装飾用の幾何学模様",decorative:true,rights:{schemaVersion:1,rightsId:"fixture-shapes-rights",basis:"self_created",publicationAuthorized:true,
   ownerOrSource:"人工fixtureの図形。実際の利用者による権利確認を表すものではありません。",confirmedBy:"user",confirmedAt:new Date().toISOString()}});
 await planArticleVisuals(job.directory,repo,repository,visual);await materializeArticleVisuals(job.directory,repo,repository);
 await assert.rejects(()=>prepareArticleMedia(job.directory,repo,repository),/VISUAL_AUDIT_PREREQUISITES/u);
 const request=(await prepareVisualAudit(job.directory,repo,repository)).request;
 await importVisualAudit(job.directory,repo,repository,fixtureVisualAudit(request));await prepareArticleMedia(job.directory,repo,repository);
 await assert.rejects(()=>buildArticleCandidate(job.directory,repo,repository),/CANDIDATE_CONFIRMED_HUMAN_INPUTS_REQUIRED/u);
 const built=await buildArticleCandidate(job.directory,repo,repository,true),checked=await validateArticleCandidate(job.directory,repo,repository,built.targetSha256);
 assert.equal(built.candidateSha256,null);assert.equal(built.approvalEligible,false);assert.equal(built.state,"MEDIA_READY");
 assert.equal(checked.artifact.reference,true);assert.equal(checked.artifact.isApproval,false);
 assert.equal((await buildArticleCandidate(job.directory,repo,repository,true)).reused,true);
 const bytesPath=join(built.output,"output",checked.materials.route.slice(1),"index.html"),html=await safeRead(bytesPath);
 assert.ok(html.includes("data-media-asset"));assert.ok(!html.includes(marker+"<script>"));assert.ok(html.includes("fn-"));
 const server=await serveArticleCandidate(job.directory,repo,repository,built.targetSha256);
 try{
  assert.equal((await fetch(server.url)).status,200);
  assert.equal((await fetch(server.articleUrl)).status,200);
  for(const path of ["artifact.json","candidate.mdx","registry.json","input.json","output/.private-draft-preview","%2e%2e/job.json","?x=1"]){
   assert.equal((await fetch(server.url+path)).status,404,path);
  }
  assert.equal((await fetch(server.url,{method:"POST"})).status,405);
  assert.equal((await fetch(server.url,{headers:{Origin:"https://outside.invalid"}})).status,403);
  const original=await safeRead(join(job.directory,"working.md"));await writeFile(join(job.directory,"working.md"),original+"\n編集後\n");
  assert.equal((await fetch(server.articleUrl)).status,410);await writeFile(join(job.directory,"working.md"),original);
 }finally{await new Promise<void>(resolve=>{server.server.close(resolve);server.server.closeAllConnections();});}
 await writeFile(bytesPath,html.replace("登録済みの実バイト","差し替えた表示"));
 await assert.rejects(()=>validateArticleCandidate(job.directory,repo,repository,built.targetSha256),/CANDIDATE_OUTPUT_FILE_SET_CHANGED/u);await writeFile(bytesPath,html);
 const current=await visualContext(job.directory,repo,repository,false);
 await atomic(receiptPath,JSON.stringify({job:job.directory,jobId:job.jobId,contentId:job.contentId,marker,privateCss,targetSha256:built.targetSha256,
  output:built.output,htmlSha256:checked.artifact.preview.htmlSha256,artifactSha256:checked.artifact.artifactSha256,
  mediaSha256s:current.media!.localObjects.map(item=>item.sha256),canonicalSha256s:current.masters!.assets.map(item=>item.ingest.canonicalMaster.sha256),
  scope:"synthetic_fixture",candidateSha256:null,approvalEligible:false,privateBuildCount:1})+"\n");
 console.log("Private A4 fixture PASS: shared Astro layout, actual media/footnotes/code, typed synthetic audits; no real approval candidate. Private build count=1; normal build count=0.");
}else if(process.argv[2]==="--check"){
 const receipt=JSON.parse(await safeRead(receiptPath)),catalog=await readSiteContent();
 assert.ok(!catalog.catalog.some(item=>item.routeRecord.contentId===receipt.contentId));
 const forbidden=[receipt.marker,receipt.privateCss,receipt.contentId,receipt.targetSha256,receipt.artifactSha256,
  "xpotato-private-draft-preview-v1","xpotato-private-complete-candidate-v1",...receipt.canonicalSha256s,...receipt.mediaSha256s];
 async function scan(folder:string):Promise<void>{for(const entry of await readdir(folder,{withFileTypes:true})){
  const path=join(folder,entry.name);if(entry.isDirectory())await scan(path);else{
   const bytes=await readFile(path);assert.ok(!receipt.mediaSha256s.includes(sha256(bytes)),"Private image bytes leaked");
   for(const needle of forbidden)assert.ok(!bytes.includes(Buffer.from(needle)),"Private A4 fixture leaked: "+entry.name);
  }
 }}
 await scan(join(repository,"apps/site/dist"));
 console.log("Private A4 isolation PASS: public catalog/feed/search/dist omit candidate/source/registry/image bytes and private Tailwind canary. Private build count=0; normal build count=0.");
}else throw Error("Expected --prepare or --check");
