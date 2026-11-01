import {afterEach,describe,it,expect} from "vitest";
import {mkdtemp,mkdir,writeFile,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {candidatePublicationDateBlockers} from "./candidate-policy.js";
import {candidateBuildFingerprint} from "./candidate-material.js";
const roots:string[]=[];afterEach(async()=>{for(const path of roots.splice(0))await rm(path,{recursive:true,force:true});});
describe("candidate publication readiness date",()=>{
 it("blocks tomorrow until JST midnight, permits today/past and allows the new local publication day immediately",()=>{
  const end=new Date("2026-10-15T14:59:59.999Z");
  expect(candidatePublicationDateBlockers("2026-10-16",end)).toEqual(["future-publication-date"]);
  expect(candidatePublicationDateBlockers("2026-10-15",end)).toEqual([]);
  expect(candidatePublicationDateBlockers("2026-10-14",end)).toEqual([]);
  expect(candidatePublicationDateBlockers("2026-10-16",new Date("2026-10-15T15:00:00.000Z"))).toEqual([]);
 });
 it("does not silently accept an invalid date or clock",()=>{
  expect(()=>candidatePublicationDateBlockers("2026-02-30")).toThrow();
  expect(()=>candidatePublicationDateBlockers("2026-10-15",new Date("invalid"))).toThrow("CANDIDATE_CLOCK_INVALID");
 });
});
describe("candidate source and package resolution fingerprint",()=>{
 it("invalidates root/workspace package-only edits while source and lock bytes stay unchanged",async()=>{
  const root=await mkdtemp(join(tmpdir(),"candidate-fingerprint-"));roots.push(root);
  const dirs=["apps/site/src","apps/site/public","packages/portable-content/src","packages/content-contracts/src","packages/media-ingest/src","packages/article-pipeline/src","docs/migration","scripts"];
  for(const dir of dirs)await mkdir(join(root,dir),{recursive:true});
  for(const file of ["package.json","package-lock.json","apps/site/package.json","packages/portable-content/package.json","apps/site/astro.config.mjs","docs/migration/content-id-map-v1.json","scripts/article-repository.ts"])
   await writeFile(join(root,file),"{}");
  await writeFile(join(root,"packages/portable-content/src/a.ts"),"export const value=1;\n");
  await writeFile(join(root,"packages/portable-content/src/b.ts"),"export const value=2;\n");
  const before=await candidateBuildFingerprint(root);expect(await candidateBuildFingerprint(root)).toBe(before);
  await writeFile(join(root,"packages/portable-content/package.json"),JSON.stringify({exports:{"./media-picture":"./src/b.ts"}}));
  const workspaceChanged=await candidateBuildFingerprint(root);expect(workspaceChanged).not.toBe(before);
  await writeFile(join(root,"package.json"),JSON.stringify({type:"module"}));
  expect(await candidateBuildFingerprint(root)).not.toBe(workspaceChanged);
 });
});
