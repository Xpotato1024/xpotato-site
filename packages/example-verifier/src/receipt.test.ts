import {describe,it,expect} from "vitest";
import {exampleVerificationRequestSchema} from "@xpotato/content-contracts";
import {fingerprint,sha256} from "@xpotato/content-contracts/canonical";
import {exampleReceiptPolicy} from "./receipt-policy.js";
import {verifyExampleReceipt} from "./receipt.js";
import {receiptFixture,signFixtureReceipt,runFixtureJsonVerifier} from "./receipt-fixture.js";
const policy=exampleReceiptPolicy("json-parse-v1");
export const request=(source='{"input":4}')=>{
 const unsigned={protocol:"xpotato-example-verification-request-v1" as const,scope:"synthetic_fixture" as const,
  binding:{jobId:"fixture-job",attemptId:"fixture-attempt",jobFingerprint:"a".repeat(64),inputSha256:"b".repeat(64)},
  bodySha256:"c".repeat(64),sourceBundleSha256:"d".repeat(64),evidencePlanSha256:"e".repeat(64),authorPrincipalId:"fixture-writer",
  exampleId:"example-001",inputArtifactSha256:sha256(source),source,requestedClass:policy.class,profileId:policy.profileId,profileSha256:policy.profileSha256};
 return exampleVerificationRequestSchema.parse({...unsigned,requestSha256:fingerprint(unsigned)});
};
describe("authenticated acquired example verification receipts",()=>{
 it.each(['{"input":4}','{"input":}'])("imports actual strict JSON parsing from a separate fixed worker: %s",async(source)=>{
  const req=request(source),fixture=await runFixtureJsonVerifier(req),proof=verifyExampleReceipt(req,fixture.receipt,[fixture.trust]);
  expect(proof.result.class).toBe("syntax_checked");
  expect(proof.accepted).toBe(source==='{"input":4}');
  expect(proof.receipt.result.exitCode).toBe(proof.accepted?0:1);
  expect(proof.receipt.result.stderr.text).toBe(proof.accepted?"":"JSON syntax invalid\n");
 },30000);
 it("rejects a signature mutation and any unregistered key",()=>{
  const req=request(),f=receiptFixture(req);
  expect(()=>verifyExampleReceipt(req,{...f.receipt,signatureHex:"0".repeat(128)},[f.trust])).toThrow("SIGNATURE");
  expect(()=>verifyExampleReceipt(req,f.receipt,[])).toThrow("UNTRUSTED");
 });
 it.each(["input","request","profile","implementation","toolchain","runtime","boundary","self","revoked","key","output","false-pass","future"] as const)("rejects signed inconsistent %s evidence",kind=>{
  const req=request(),f=receiptFixture(req),unsigned=structuredClone(f.unsigned),trust=structuredClone(f.trust);
  if(kind==="input")unsigned.inputArtifactSha256="0".repeat(64);
  if(kind==="request")unsigned.requestSha256="0".repeat(64);
  if(kind==="profile")unsigned.profileSha256="0".repeat(64);
  if(kind==="implementation")unsigned.implementationSha256="0".repeat(64);
  if(kind==="toolchain")unsigned.toolchainSha256="0".repeat(64);
  if(kind==="runtime")unsigned.runtime.version="99.0.0";
  if(kind==="boundary")unsigned.boundarySha256="0".repeat(64);
  if(kind==="self"){unsigned.principalId=req.authorPrincipalId;trust.principalId=req.authorPrincipalId;}
  if(kind==="revoked")trust.status="revoked";
  if(kind==="key")trust.publicKeySha256="0".repeat(64);
  if(kind==="output")unsigned.result.stdout.text="invented output";
  if(kind==="false-pass")unsigned.result.exitCode=1;
  if(kind==="future"){unsigned.startedAt="2099-01-01T00:00:00.000Z";unsigned.finishedAt=unsigned.startedAt;}
  expect(()=>verifyExampleReceipt(req,signFixtureReceipt(unsigned,f.privateKey),[trust])).toThrow();
 });
 it("records an authenticated timeout as failure without relaxing the successful profile limit",()=>{
  const req=request(),f=receiptFixture(req,"","fail"),unsigned=structuredClone(f.unsigned);
  unsigned.resourceOutcome="timeout";unsigned.wallTimeMs=15020;unsigned.result.exitCode=null;unsigned.result.signal="SIGKILL";
  unsigned.startedAt=new Date(Date.now()-16000).toISOString();unsigned.finishedAt=new Date(Date.now()-980).toISOString();
  expect(verifyExampleReceipt(req,signFixtureReceipt(unsigned,f.privateKey),[f.trust]).accepted).toBe(false);
  unsigned.result.status="pass";unsigned.result.exitCode=0;unsigned.result.signal=null;unsigned.resourceOutcome="completed";
  expect(()=>verifyExampleReceipt(req,signFixtureReceipt(unsigned,f.privateKey),[f.trust])).toThrow("FALSE_PASS");
 });
 it.each(["fail","not_run","blocked"] as const)("never accepts a signed %s as successful",status=>{
  const req=request(),f=receiptFixture(req,"",status);
  expect(verifyExampleReceipt(req,f.receipt,[f.trust]).accepted).toBe(false);
 });
});
