import {browserToolReviewSchema} from "@xpotato/content-contracts";
import {readFile} from "node:fs/promises";
import {it,expect} from "vitest";
import {toolHash} from "./browser-tool-adoption.js";
import {assertToolPublicAdmission,admitsPublicTool} from "./public-admission.js";
const admission=JSON.parse(await readFile(new URL("../../../../config/browser-tools/public-admissions.json",import.meta.url),"utf8")).releases[0];
const review=browserToolReviewSchema.parse(JSON.parse(await readFile(new URL("../../../../docs/acceptance/browser-tools/prime-factorizer/"+admission.releaseId+"-source-review.json",import.meta.url),"utf8")));
it("admits the exact reviewed tool only; rejects stale source/artifact/review identity",async()=>{
 const valid={...admission,reviewSha256:toolHash(JSON.stringify(browserToolReviewSchema.parse(review)))};
 expect(()=>assertToolPublicAdmission(valid,review,valid)).not.toThrow();
 expect(await admitsPublicTool(admission)).toBe(true);
 expect(()=>assertToolPublicAdmission({...admission,source:{kind:"github",repository:"https://github.com/example/other"}},review,admission)).toThrow();
 expect(await admitsPublicTool({...admission,toolId:"another-tool"})).toBe(false);
 expect(await admitsPublicTool({...admission,releaseId:"unreviewed"})).toBe(false);
 for(const key of ["sourceCommit","sourceTreeSha256","lockSha256","manifestSha256","artifactSha256","reviewSha256"]){
  const changed={...admission,[key]:"0".repeat(key==="sourceCommit"?40:64)};
  expect(()=>assertToolPublicAdmission(changed,review,admission)).toThrow();
 }
 for(const mutate of [(r:any)=>{delete r.runtimeReview},(r:any)=>{r.sourceCommit="0".repeat(40)},(r:any)=>{r.reproducibleArtifactSha256[1]="0".repeat(64)},(r:any)=>{r.review.scope="fixture-only"}]){
  const r:any=structuredClone(review);mutate(r);
  const normalized=browserToolReviewSchema.safeParse(r);
  const p={...admission,reviewSha256:toolHash(JSON.stringify(normalized.success?normalized.data:r))};
  expect(()=>assertToolPublicAdmission(p,r,p,{bounded:true})).toThrow();
 }
});
