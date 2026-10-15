import {afterEach,describe,it,expect} from "vitest";
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,link} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {candidatePreviewSnapshot,previewClockGuard} from "./candidate-freshness.js";
const roots:string[]=[];afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
const attempt="attempt-11111111-1111-1111-1111-111111111111";
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),"candidate-freshness-"));roots.push(root);
 const directory=join(root,"job"),folder=join(directory,"candidates/target");
 const paths=["apps/site/src/content/blog/a.md","apps/site/public/font.woff2","packages/example-verifier/src/receipt.ts",
  "packages/site-validators/src/site-content.ts","packages/article-pipeline/src/a.ts","scripts/article-repository.ts",
  "package.json","package-lock.json","apps/site/package.json","apps/site/astro.config.mjs","docs/migration/content-id-map-v1.json"];
 const jobPaths=["job.json","base/repository.json","working.md","attempts/"+attempt+"/review/head.json",
  "attempts/"+attempt+"/visual/masters/image.png","attempts/"+attempt+"/visual/variants/image.webp","candidates/target/artifact.json","candidates/target/output/index.html"];
 for(const path of [...paths,...jobPaths.map(path=>"job/"+path)]){
  await mkdir(join(root,path,".."),{recursive:true});await writeFile(join(root,path),"original");
 }
 return {root,directory,folder,paths,jobPaths,snapshot:()=>candidatePreviewSnapshot(directory,root,attempt,folder)};
}
describe("private candidate same-byte freshness proof",()=>{
 it("detects every source/job/master/variant/candidate byte change with same length",async()=>{
  const f=await fixture(),before=await f.snapshot();
  for(const path of [...f.paths,...f.jobPaths.map(path=>"job/"+path)]){
   const file=join(f.root,path),original=await readFile(file);await writeFile(file,"mutation");
   expect(await f.snapshot(),path).not.toBe(before);await writeFile(file,original);
  }
  expect(await f.snapshot()).toBe(before);
 });
 it("binds optional absence and exact path sets, including additions and deletions",async()=>{
  const f=await fixture(),before=await f.snapshot();
  for(const name of ["working-sources.json","working-evidence.json","working-audit.json","working-visual.json","working-visual-audit.json"]){
   const path=join(f.directory,name);await writeFile(path,"{}");expect(await f.snapshot(),name).not.toBe(before);await rm(path);
  }
  await mkdir(join(f.directory,"source-media"));expect(await f.snapshot()).not.toBe(before);
  const empty=await f.snapshot();await writeFile(join(f.directory,"source-media/a.png"),"a");expect(await f.snapshot()).not.toBe(empty);
  await rm(join(f.directory,"source-media/a.png"));expect(await f.snapshot()).toBe(empty);
 });
 it("rejects optional linked trees/files and hardlinks instead of trusting a matching hash",async()=>{
  const f=await fixture();await symlink(join(f.root,"apps/site/public"),join(f.directory,"source-media"),"dir");
  await expect(f.snapshot()).rejects.toThrow("SYMLINK_PATH_DENIED");await rm(join(f.directory,"source-media"));
  await link(join(f.directory,"working.md"),join(f.directory,"working-visual.json"));
  await expect(f.snapshot()).rejects.toThrow("INPUT_FILE_INVALID");
 });
});
describe("preview semantic clock predicates",()=>{
 it("rejects rollback inside the same UTC day and invalid clocks while allowing forward time",()=>{
  const start=Date.parse("2026-10-15T12:00:00Z"),end=start+1000;
  const clock=previewClockGuard("2026-10-16",start,end,[{reviewedAt:new Date(start).toISOString(),nested:{finishedAt:new Date(end).toISOString()}}]);
  expect(()=>clock(end+1000)).not.toThrow();expect(()=>clock(start)).toThrow("CANDIDATE_PREVIEW_CLOCK_STALE");
  expect(()=>clock(NaN)).toThrow();expect(()=>previewClockGuard("2026-10-16",end,start,[])).toThrow();
  expect(()=>previewClockGuard("2026-10-16",start,end,[{confirmedAt:new Date(end+1).toISOString()}])).toThrow();
 });
 it("expires when a future publication day becomes current, including across UTC midnight",()=>{
  const end=Date.parse("2026-10-15T23:59:59.999Z"),clock=previewClockGuard("2026-10-16",end-1000,end,[]);
  expect(()=>clock(end)).not.toThrow();expect(()=>clock(end+1)).toThrow("CANDIDATE_PREVIEW_CLOCK_STALE");
  const current=previewClockGuard("2026-10-15",end-1000,end,[]);expect(()=>current(end+1)).not.toThrow();
 });
});
