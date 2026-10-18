import { watch, writeFileSync } from "node:fs";
import { request } from "node:http";

import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, writeFile, rm, symlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fingerprint, sha256 } from "./canonical.js";
import { initDraft, guideDraft, reviseDraft, jobDirectory, readDraftStore, type DraftRepository } from "./draft-job.js";
import { buildDraftPreview, serveDraftPreview } from "./draft-preview.js";
import { locked, privateRoot, safeRead } from "./private-files.js";
import { renderDraftMarkdown } from "@xpotato/portable-content/draft";
import { privateDraftOutputErrors } from "@xpotato/portable-content/private-output";
import { articleCli } from "./cli.js";

const roots:string[]=[];
const temp=async()=>{const dir=await mkdtemp(join(tmpdir(),"article-job-test-"));roots.push(dir);return dir;};
afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
const repo:DraftRepository={commit:"a".repeat(40),fingerprint:"b".repeat(64),categories:[{id:"software",label:"ソフトウェア",status:"active"}],
  tags:[{id:"typescript",label:"TypeScript",status:"active"}],records:[],occupiedRoutes:[],registrySnapshot:{"media":"empty"}};
const options={title:"日本語の作業稿",description:"非公開の説明",slug:"private-example",category:"software",pubDate:"2026-10-15",
  readerOutcome:"自分で手順を試せる",intent:"review" as const,network:false};
const make=async()=>{const root=await temp(),job=await initDraft(root,repo,options);return {root,job,directory:jobDirectory(root,job.jobId)};};

describe("private human draft job",()=>{
  it("allocates one UUID, resumes without advancing state and keeps permission/disclosure bounds",async()=>{
    const {root,job,directory}=await make();const other=await initDraft(root,repo,{...options,slug:"second"});
    expect(job.contentId).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u);
    expect(other.contentId).not.toBe(job.contentId);
    expect((await guideDraft(directory,repo)).currentState).toBe("CREATED");
    const stored=await readDraftStore(directory);
    expect(stored.spec.permissions).toEqual({networkAccess:false,externalTextAI:false,externalImageAI:false,localMediaProcessing:false,
      privateCanonicalMediaStorage:false,publicMediaUpload:false,protectedMediaOperation:false,repositoryExport:false});
    const clone=await initDraft(root,repo,{intent:"publish",network:false,fromJob:job.jobId});
    expect(clone.contentId).toBe(job.contentId);expect(clone.jobId).not.toBe(job.jobId);
    expect((await readDraftStore(clone.directory)).jobFingerprint).not.toBe(stored.jobFingerprint);
  });
  it("pins exact update bytes/route/registry/base with the same ContentId",async()=>{
    const id="11111111-1111-4111-8111-111111111111";
    const source="---\nid: "+id+"\ntitle: 既存記事\ndescription: 既存の説明\npubDate: '2026-10-01'\ncategory: software\ntags: []\ndraft: false\n---\n元の本文\n";
    const record={contentId:id,collection:"blog",slug:"existing",route:"/blog/existing/",source,sourceSha256:sha256(source),registrySha256:fingerprint(repo.registrySnapshot)};
    const updateRepo={...repo,records:[record],occupiedRoutes:[record.route]};
    const root=await temp(),job=await initDraft(root,updateRepo,{intent:"review",network:false,contentId:id,updateKind:"correction"});
    expect(job.contentId).toBe(id);
    const stored=await readDraftStore(job.directory);
    expect(stored.spec.target.allowRouteChange).toBe(false);
    expect(stored.baseCommit).toBe(repo.commit);
    expect(await readFile(join(job.directory,"base/original.md"),"utf8")).toBe(source);
    expect(await readFile(join(job.directory,"base/registries.json"),"utf8")).toContain("empty");
    await expect(initDraft(root,updateRepo,{intent:"review",network:false,contentId:id,slug:"renamed"})).rejects.toThrow("ROUTE_CHANGE");
  });
  it("imports body-only and full Markdown, normalizes LF and reuses unchanged input",async()=>{
    const {directory}=await make();
    const first=await reviseDraft(directory,repo,"import","# 日本語\r\n\r\n本文です。\r\n");
    expect(first.state).toBe("CREATED");
    const text=await readFile(join(directory,"working.md"),"utf8");expect(text).not.toContain("\r");
    const second=await reviseDraft(directory,repo,"import",text);
    expect(second.reused).toBe(true);
    const explicit=await reviseDraft(directory,repo,"人が再検証を要求");
    expect(explicit.attemptId).not.toBe(first.attemptId);
    await expect(reviseDraft(directory,repo,"import",text.replace("draft: true","draft: false"))).rejects.toThrow("PUBLICATION_CHANGED");
    await expect(reviseDraft(directory,repo,"import",text.replace("category: software","category: unknown"))).rejects.toThrow("TAXONOMY");
    await expect(reviseDraft(directory,repo,"import","password: private-value")).rejects.toThrow("SECRET");
  });
  it.each(["HUMAN_REVIEW_READY","HUMAN_APPROVED"] as const)("invalidates historical %s on external edit and preserves old evidence",async(state)=>{
    const {directory}=await make(),stored=await readDraftStore(directory);
    const attemptPath=join(directory,"attempts",stored.activeAttemptId,"attempt.json");
    const attempt=JSON.parse(await readFile(attemptPath,"utf8"));
    await writeFile(attemptPath,JSON.stringify({...attempt,state,candidateSha256:"c".repeat(64),approvalSha256:"d".repeat(64)}));
    const oldAttempt=await readFile(attemptPath,"utf8"),served=await serveDraftPreview(directory,repo);
    try{
      expect((await fetch(served.url)).status).toBe(200);
      await writeFile(join(directory,"working.md"),(await readFile(join(directory,"working.md"),"utf8"))+"\n編集しました。\n");
      const guide=await guideDraft(directory,repo);
      expect(guide.currentState).toBeNull();expect(guide.stale).toBe(true);expect(guide.candidateHash).toBeNull();
      expect((await fetch(served.url)).status).toBe(410);
      await expect(buildDraftPreview(directory,repo)).rejects.toThrow("STALE");
      const next=await reviseDraft(directory,repo,"本文修正");
      expect(next.state).toBe("CREATED");expect(next.oldArtifactsStale).toBe(true);
      expect(await readFile(attemptPath,"utf8")).toBe(oldAttempt);
      expect((await guideDraft(directory,repo)).currentState).toBe("CREATED");
    }finally{await new Promise<void>(resolve=>served.server.close(()=>resolve()));}
  });
  it("fails closed on locks, path escapes, symlinks, corrupted snapshots and changed repository input",async()=>{
    const {root,directory}=await make();
    await locked(directory,async()=>{await expect(reviseDraft(directory,repo,"race","# changed")).rejects.toThrow("JOB_LOCKED");});
    expect(()=>jobDirectory(root,"../working")).toThrow("JOB_ID");
    await expect(privateRoot(root,join(root,"apps/site/dist"))).rejects.toThrow("PRIVATE_ROOT");
    const outside=await temp();await writeFile(join(outside,"target.md"),"private");
    await symlink(join(outside,"target.md"),join(directory,"linked.md"));
    await expect(safeRead(join(directory,"linked.md"))).rejects.toThrow("SYMLINK");
    const store=await readDraftStore(directory);
    await writeFile(join(directory,"attempts",store.activeAttemptId,"body.md"),"corrupt");
    await expect(guideDraft(directory,repo)).rejects.toThrow("BINDING");
  });

  it.each([false,true])("preserves a concurrent external editor write (import=%s)",async(importing)=>{
    const {directory}=await make(),before=await readDraftStore(directory);
    const current=await readFile(join(directory,"working.md"),"utf8"),external=current+"\n外部エディターの新しい編集\n";
    let edited=false;
    const watcher=watch(join(directory,"attempts"),(_event,name)=>{
      if(!edited&&String(name).startsWith("attempt-")){edited=true;writeFileSync(join(directory,"working.md"),external);}
    });
    try{
      await expect(reviseDraft(directory,repo,"concurrent editor",importing?"取込み本文":undefined)).rejects.toThrow("WORKING_CHANGED");
      expect(edited).toBe(true);expect(await readFile(join(directory,"working.md"),"utf8")).toBe(external);
      expect((await readDraftStore(directory)).activeAttemptId).toBe(before.activeAttemptId);
      expect((await guideDraft(directory,repo)).stale).toBe(true);
    }finally{watcher.close();}
  });
  it("limits serving to loopback, GET/HEAD and exact generated page; reserves preview output markers",async()=>{
    const {directory}=await make(),built=await buildDraftPreview(directory,repo);
    expect(built.manifest.productionEligible).toBe(false);expect(built.manifest.mode).toBe("draft");
    expect(built.manifest.displayedImageSha256s).toEqual([]);
    expect(privateDraftOutputErrors("manifest.json",JSON.stringify(built.manifest))).toHaveLength(1);
    expect(privateDraftOutputErrors("job.json",await readFile(join(directory,"job.json"),"utf8"))).toHaveLength(1);
    expect(privateDraftOutputErrors("index.html",built.html)).toHaveLength(1);
    expect(privateDraftOutputErrors(".local/article-jobs/job/working.md")).toHaveLength(1);
    const served=await serveDraftPreview(directory,repo);
    try{
      const address=served.server.address();expect(typeof address==="object"&&address?.address).toBe("127.0.0.1");
      const response=await fetch(served.url);expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
      expect(await new Promise<number>(resolve=>{
        request(served.url,{headers:{Host:"evil.invalid"}},res=>{res.resume();resolve(res.statusCode!);}).end();
      })).toBe(403);
      expect((await fetch(served.url,{headers:{origin:"https://evil.invalid"}})).status).toBe(403);
      expect((await fetch(served.url,{method:"POST"})).status).toBe(405);
      expect((await fetch(served.url+"manifest.json")).status).toBe(404);
      expect((await fetch(served.url+"working.md")).status).toBe(404);
      expect(await (await fetch(served.url,{method:"HEAD"})).text()).toBe("");
    }finally{await new Promise<void>(resolve=>served.server.close(()=>resolve()));}
  });

  it.each(['<Callout title="unterminated','{unclosed'])("returns input exit 2 for malformed MDX: %s",async(text)=>{
    const {root,job,directory}=await make(),checkout=join(root,"checkout");await mkdir(checkout);
    const input=join(root,"bad.md");await writeFile(input,text);
    const before=await readFile(join(directory,"working.md"),"utf8"),messages:unknown[]=[];
    expect(await articleCli(["article","draft","import","--root",root,"--job",job.jobId,"--from",input],checkout,async()=>repo,value=>messages.push(value))).toBe(2);
    expect(JSON.stringify(messages)).toContain("INPUT_VALIDATION_FAILED");
    expect(await readFile(join(directory,"working.md"),"utf8")).toBe(before);
  });
  it("keeps unprepared and noninteractive publication commands blocked",async()=>{
    const {root,job}=await make(),messages:unknown[]=[];
    const checkout=join(root,"checkout");await mkdir(checkout);
    for(const action of ["approve","candidate","export","media"]){
      expect(await articleCli(["article",action,"--root",root,"--job",job.jobId,"--candidate","a".repeat(64)],checkout,async()=>repo,value=>messages.push(value))).toBe(3);
    }
    expect(JSON.stringify(messages)).not.toContain("HUMAN_APPROVED");
  });
});
describe("non-executing Markdown preview",()=>{
  it("renders Japanese tables/code/footnotes and shows media/module placeholders without requests",async()=>{
    const body="# 日本語\n\n| 項目 | 内容 |\n| --- | --- |\n| 入力 | 安全 |\n\n説明[^note]。\n\n[^note]: 注釈です。\n\n[BT][BT][BT]js\nimport danger from 'not-executed';\n[BT][BT][BT]\n\n![説明](https://example.invalid/private.png)\n\n<Callout kind=\"note\" title=\"注意\">\n\n日本語の補足です。\n\n</Callout>\n";
    const rendered=await renderDraftMarkdown(("[相対リンク](../next/)\n\n"+body).replaceAll("[BT]","`"));
    expect(rendered.html).toContain("<table>");expect(rendered.html).toContain("注釈です");
    expect(rendered.html).toContain("画像未準備");expect(rendered.html).toContain("注意");
    expect(rendered.html).not.toMatch(/<img|<script|<iframe|https:\/\/example[.]invalid/u);
  });
  it.each(['import x from "./danger.js"','{process.exit(1)}','<script>alert(1)</script>','<iframe src="https://remote.invalid" />',
    '<Callout {...props}>危険</Callout>','[危険](javascript:alert%281%29)','<LinkCard href="javascript:alert(1)" title="x" />'])("rejects unsafe input before rendering: %s",async body=>{
    await expect(renderDraftMarkdown(body)).rejects.toThrow();
  });
});
