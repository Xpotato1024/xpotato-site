import {browserToolReviewSchema} from "@xpotato/content-contracts";
import {readFile} from "node:fs/promises";
import {it,expect} from "vitest";
import {toolHash} from "./browser-tool-adoption.js";
import {assertPrimePublicAdmission,admitsBoundedPrime} from "./prime-public-admission.js";
const admission=JSON.parse(await readFile(new URL("../../../config/browser-tools/prime-public-admission.json",import.meta.url),"utf8"));
const review=browserToolReviewSchema.parse(JSON.parse(await readFile(new URL("../../../docs/acceptance/browser-tools/prime-factorizer/v0-1-2-source-review.json",import.meta.url),"utf8")));
it("admits the exact reviewed prime only; rejects stale source/artifact/review identity",async()=>{
 const valid={...admission,reviewSha256:toolHash(JSON.stringify(browserToolReviewSchema.parse(review)))};
 expect(()=>assertPrimePublicAdmission(valid,review,valid)).not.toThrow();
 expect(await admitsBoundedPrime(admission)).toBe(true);
 expect(()=>assertPrimePublicAdmission({...admission,source:{kind:"github",repository:"https://github.com/example/other"}},review,admission)).toThrow();
 expect(await admitsBoundedPrime({...admission,toolId:"another-tool"})).toBe(false);
 expect(await admitsBoundedPrime({...admission,releaseId:"unreviewed"})).toBe(false);
 for(const key of ["sourceCommit","sourceTreeSha256","lockSha256","manifestSha256","artifactSha256","reviewSha256"]){
  const changed={...admission,[key]:"0".repeat(key==="sourceCommit"?40:64)};
  expect(()=>assertPrimePublicAdmission(changed,review,admission)).toThrow();
 }
 for(const mutate of [(r:any)=>{delete r.runtimeReview},(r:any)=>{r.sourceCommit="0".repeat(40)},(r:any)=>{r.reproducibleArtifactSha256[1]="0".repeat(64)},(r:any)=>{r.review.scope="fixture-only"}]){
  const r:any=structuredClone(review);mutate(r);
  const normalized=browserToolReviewSchema.safeParse(r);
  const p={...admission,reviewSha256:toolHash(JSON.stringify(normalized.success?normalized.data:r))};
  expect(()=>assertPrimePublicAdmission(p,r,p)).toThrow();
 }
});
