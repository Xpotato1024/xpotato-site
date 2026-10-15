import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {mkdir,readdir,readFile} from "node:fs/promises";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {loadRepository} from "./article-repository.js";
import {initDraft,reviseDraft} from "../packages/article-pipeline/src/draft-job.js";
import {privateRoot,atomic,safeRead} from "../packages/article-pipeline/src/private-files.js";
import {fingerprint,sha256} from "../packages/article-pipeline/src/canonical.js";
import {fixtureReviewBody,fixtureReviewInputs,fixtureContentAudit} from "../packages/article-pipeline/src/content-review-fixture.js";
import {importReviewSources,importReviewEvidence,prepareContentAudit,importContentAudit,buildContentReviewBundle} from "../packages/article-pipeline/src/content-review.js";
import {inspectExamples} from "@xpotato/portable-content/review";
import {readSiteContent} from "../packages/site-validators/src/site-content.js";

const repository=resolve(dirname(fileURLToPath(import.meta.url)),".."),root=await privateRoot(repository);
const receiptFolder=join(repository,".local/article-review-isolation");await mkdir(receiptFolder,{recursive:true,mode:0o700});
const receiptPath=join(receiptFolder,"receipt.json");
if(process.argv[2]==="--prepare"){
 const marker="PRIVATE_REVIEW_CANARY_"+randomUUID(),privateSourceMarker="PRIVATE_SOURCE_CANARY_"+randomUUID();
 const repo=await loadRepository(),job=await initDraft(root,repo,{title:"非公開の合成内容review",description:"人工fixture。正式候補ではありません",
  slug:"private-review-isolation-fixture",category:"software",pubDate:"2026-10-15",readerOutcome:"内容工程と正式候補の区別を確認",intent:"review",network:false});
 const fence=String.fromCharCode(96).repeat(3);
 const body=fixtureReviewBody+"\n"+marker+"\n\n|項目|状態|\n|---|---|\n|画像|未準備|\n\n"+fence+"javascript\nthrow Error('illustration only; must not execute');\n"+fence+"\n";
 await reviseDraft(job.directory,repo,"synthetic content review fixture",body);
 const {sources,evidence}=fixtureReviewInputs(body),first=sources.sources[0]!;
 const disclosure={...first.disclosure,subject:{kind:"artifact" as const,id:"s0002",sha256:sha256(privateSourceMarker)}};
 sources.sources.push({record:{...first.record,sourceId:"s0002",kind:"user_log",title:"非公開の合成資料",
  locator:{kind:"artifact",artifactSha256:sha256(privateSourceMarker)},snapshotSha256:sha256(privateSourceMarker),
  publicSafe:false,citation:{eligible:false},externalAiDisclosureRef:fingerprint(disclosure)},snapshot:privateSourceMarker,disclosure});
 evidence.sourceBundleSha256=fingerprint(sources);
 evidence.examples=inspectExamples(body).map(example=>({exampleId:example.exampleId,intendedPurpose:"合成の未実行表示用",requestedVerification:"illustrative",
  verificationRequired:false,materialClaimIds:[]}));
 await importReviewSources(job.directory,repo,sources);await importReviewEvidence(job.directory,repo,evidence);
 const prepared=await prepareContentAudit(job.directory,repo);await importContentAudit(job.directory,repo,fixtureContentAudit(prepared.request.requestSha256));
 const bundle=await buildContentReviewBundle(job.directory,repo);
 assert.equal(bundle.contentState,"CONTENT_READY");assert.equal(bundle.approvalEligible,false);assert.ok(!bundle.html.includes(privateSourceMarker));
 await atomic(receiptPath,JSON.stringify({jobId:job.jobId,contentId:job.contentId,marker,privateSourceMarker,
  output:bundle.output,scope:"synthetic_fixture",approvalEligible:false})+"\n");
 console.log("Private content-review fixture prepared: synthetic independent-principal check; no real human audit, candidate or approval");
}else if(process.argv[2]==="--check"){
 const receipt=JSON.parse(await safeRead(receiptPath)),catalog=await readSiteContent();
 assert.ok(!catalog.catalog.some(item=>item.routeRecord.contentId===receipt.contentId));
 async function scan(folder:string):Promise<void>{for(const entry of await readdir(folder,{withFileTypes:true})){
  const path=join(folder,entry.name);if(entry.isDirectory())await scan(path);else{
   const bytes=await readFile(path);
   for(const needle of [receipt.marker,receipt.privateSourceMarker,receipt.contentId,"xpotato-private-draft-preview-v1","article-private-review-journal-v1"])
    assert.ok(!bytes.includes(Buffer.from(needle)),"Private review leaked into final dist");
  }
 }}
 await scan(join(repository,"apps/site/dist"));
 console.log("Private content-review isolation PASS: production catalog/feed/search/dist omit draft, private source, review bundle and receipts; build count=0");
}else throw Error("Expected --prepare or --check");
