
import { loadRepository } from "./article-repository.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initDraft, reviseDraft, jobDirectory } from "../packages/article-pipeline/src/draft-job.js";
import { buildDraftPreview } from "../packages/article-pipeline/src/draft-preview.js";
import { privateRoot, atomic, safeRead } from "../packages/article-pipeline/src/private-files.js";
import { readSiteContent } from "../packages/site-validators/src/site-content.js";
import { taxonomyRegistry } from "../apps/site/src/content-registry/taxonomy/index.js";
import { fingerprint } from "../packages/article-pipeline/src/canonical.js";
const repository=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const root=await privateRoot(repository);
const receiptFolder=join(repository,".local","authoring-isolation");
await mkdir(receiptFolder,{recursive:true,mode:0o700});
const receiptPath=join(receiptFolder,"receipt.json");
if(process.argv[2]==="--prepare"){
  const marker="PRIVATE_DRAFT_CANARY_"+randomUUID();
  const repo=await loadRepository();
  const job=await initDraft(root,repo,{title:"隔離試験の非公開下書き",description:"公開してはいけない人工fixture",
    slug:"private-isolation-fixture",category:"software",pubDate:"2026-10-15",readerOutcome:"隔離を検証する",intent:"review",network:false});
  await reviseDraft(jobDirectory(root,job.jobId),repo,"fixture input",
    "# 日本語の下書き\n\n"+marker+"\n\n|項目|内容|\n|---|---|\n|状態|非公開|\n\n説明[^note]\n\n[^note]: 安全な注釈。\n\n![画像未準備](https://must-not-request.invalid/image.png)\n");
  const built=await buildDraftPreview(jobDirectory(root,job.jobId),repo);
  await atomic(receiptPath,JSON.stringify({jobId:job.jobId,contentId:job.contentId,marker,previewOutput:built.output,repository:repo})+"\n");
  console.log("Private draft isolation fixture prepared; no candidate/approval created");
}else if(process.argv[2]==="--check"){
  const receipt=JSON.parse(await safeRead(receiptPath));
  const catalog=await readSiteContent();assert.ok(!catalog.catalog.some(item=>item.routeRecord.contentId===receipt.contentId));
  const scan=async(folder:string):Promise<void>=>{
    for(const entry of await readdir(folder,{withFileTypes:true})){
      const path=join(folder,entry.name);
      if(entry.isDirectory())await scan(path);
      else{const bytes=await readFile(path);for(const needle of [receipt.marker,receipt.contentId,"xpotato-private-draft-preview-v1"])assert.ok(!bytes.includes(Buffer.from(needle)),"Private draft leaked into final dist");}
    }
  };
  await scan(join(repository,"apps/site/dist"));
  console.log("Private draft isolation PASS: catalog/feed/search/final dist omit job marker and ContentId; build count=0");
}else throw Error("Expected --prepare or --check");
