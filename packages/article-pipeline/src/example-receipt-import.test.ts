import {articleCli} from "./cli.js";
import {afterEach,describe,it,expect} from "vitest";
import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {exampleVerificationRequestSchema,type LocalEvidenceBundle,type ExampleVerificationReceipt} from "@xpotato/content-contracts";
import {receiptFixture,signFixtureReceipt,runFixtureJsonVerifier} from "@xpotato/example-verifier/fixture";
import {privateDraftOutputErrors} from "@xpotato/portable-content/private-output";
import {initDraft,reviseDraft,guideDraft,type DraftRepository} from "./draft-job.js";
import {fixtureReviewBody,fixtureReviewInputs,fixtureContentAudit} from "./content-review-fixture.js";
import {importReviewSources,importReviewEvidence,prepareExampleVerification,prepareContentAudit,importContentAudit,buildContentReviewBundle} from "./content-review.js";
import {fingerprint,sha256} from "./canonical.js";
const roots:string[]=[];afterEach(async()=>{await Promise.all(roots.splice(0).map(path=>rm(path,{recursive:true,force:true})));});
const repo:DraftRepository={commit:"a".repeat(40),fingerprint:"b".repeat(64),categories:[{id:"software",label:"ソフトウェア",status:"active"}],
 tags:[],records:[],occupiedRoutes:[],registrySnapshot:{media:"empty"}};
const fence=String.fromCharCode(96).repeat(3);
async function setup(source='{"input":4}',language="json",observed?:string,human=false){
 const root=await mkdtemp(join(tmpdir(),"acquired-example-receipt-"));roots.push(root);
 const body=fixtureReviewBody+"\n"+fence+language+"\n"+source+"\n"+fence+"\n"+(observed===undefined?"":"\n"+fence+"text\n"+observed+"\n"+fence+"\n");
 const job=await initDraft(root,repo,{title:"合成検証",description:"取得済み検証証拠の試験",slug:"receipt-test",category:"software",pubDate:"2026-10-15",
  readerOutcome:"fixture",intent:"review",network:false});
 await reviseDraft(job.directory,repo,"fixture body",body);
 const inputs=fixtureReviewInputs(body);
 if(human)inputs.sources.scope="human_local";
 inputs.evidence.sourceBundleSha256=fingerprint(inputs.sources);
 inputs.evidence.examples=[{exampleId:"example-001",intendedPurpose:"合成入力の検査",requestedVerification:language==="json"?"syntax_checked":"sandbox_executed",verificationRequired:true,materialClaimIds:[]}];
 if(observed!==undefined)inputs.evidence.examples.push({exampleId:"example-002",intendedPurpose:"合成の観測出力照合",requestedVerification:"evidence_observed",
  verificationRequired:true,materialClaimIds:[],observedOutput:{fromExampleId:"example-001",stream:"stdout"}});
 await importReviewSources(job.directory,repo,inputs.sources);
 return {root,body,job,...inputs};
}
async function prepared(f:Awaited<ReturnType<typeof setup>>){
 const result=await prepareExampleVerification(f.job.directory,repo,f.evidence);
 const bundle=JSON.parse(await readFile(result.requestPath,"utf8"));
 return {bundle,request:exampleVerificationRequestSchema.parse(bundle.requests[0])};
}
function attach(evidence:LocalEvidenceBundle,fixture:ReturnType<typeof receiptFixture>,receipt:ExampleVerificationReceipt=fixture.receipt){
 return {...evidence,verification:{receipts:[receipt],fixtureTrust:[fixture.trust]}};
}
describe("acquired verification into the immutable Article Job",()=>{
 it("reaches CONTENT_READY using real separate-process JSON syntax evidence, without candidate/approval authority",async()=>{
  const f=await setup(),p=await prepared(f),fixture=await runFixtureJsonVerifier(p.request),input=attach(f.evidence,fixture);
  expect(privateDraftOutputErrors("request.json",JSON.stringify(p.bundle))).not.toHaveLength(0);
  expect(privateDraftOutputErrors("receipt.json",JSON.stringify(fixture.receipt))).not.toHaveLength(0);
  const result=await importReviewEvidence(f.job.directory,repo,input);
  expect(result.state).toBe("EXAMPLES_ASSESSED");await expect(prepareExampleVerification(f.job.directory,repo,f.evidence)).rejects.toThrow("PREPARE_STAGE_INVALID");expect(result.examples).toMatchObject([{status:"pass",label:"合成fixture: 構文・型検査済み（動作は未検証）"}]);
  const audit=await prepareContentAudit(f.job.directory,repo);await importContentAudit(f.job.directory,repo,fixtureContentAudit(audit.request.requestSha256));
  const review=await buildContentReviewBundle(f.job.directory,repo);
  expect(review.contentState).toBe("CONTENT_READY");expect(review.approvalEligible).toBe(false);expect(review.candidateSha256).toBeNull();
  expect(review.html).toContain(fingerprint(fixture.receipt));
  input.verification.receipts[0]!.result.stdout.text="edited";
  await writeFile(join(f.job.directory,"working-evidence.json"),JSON.stringify(input));
  expect((await guideDraft(f.job.directory,repo)).currentState).toBeNull();
 },30000);
 it("prepares a private request through the CLI without printing source code",async()=>{
  const f=await setup(),path=join(f.root,"evidence-plan.json"),output:unknown[]=[];
  await writeFile(path,JSON.stringify(f.evidence));
  expect(await articleCli(["article","examples","prepare","--job",f.job.jobId,"--root",f.root,"--from",path,"--json"],process.cwd(),async()=>repo,value=>output.push(value))).toBe(0);
  expect(output.at(-1)).toMatchObject({requestCount:1,productionEligible:false,candidateSha256:null});
  expect(JSON.stringify(output)).not.toContain('{"input":4}');expect(JSON.stringify(output)).not.toContain("合成仕様の");
 });
 it("hard-denies secret-looking acquired stdout even with a valid fixture signature",async()=>{
  const f=await setup(),p=await prepared(f),fixture=receiptFixture(p.request,"Authorization: Bearer TEST_ONLY_"+ "a".repeat(32));
  await expect(importReviewEvidence(f.job.directory,repo,attach(f.evidence,fixture))).rejects.toThrow("EVIDENCE_SECRET_DENIED");
 });
 it("keeps a synthetic Node parser-only receipt distinct from runtime execution",async()=>{
  const f=await setup("const value = 1 + 2","javascript");
  f.evidence.examples[0]!.requestedVerification="syntax_checked";
  const p=await prepared(f),fixture=receiptFixture(p.request);
  const result=await importReviewEvidence(f.job.directory,repo,attach(f.evidence,fixture));
  expect(result.state).toBe("EXAMPLES_ASSESSED");
  expect(result.examples?.[0]!.label).toBe("合成fixture: 構文・型検査済み（動作は未検証）");
 });
 it.each([false,true])("returns a failing CLI result for unexecuted/environment-blocked proof: %s",async(environment)=>{
  const f=await setup(),p=await prepared(f),fixture=receiptFixture(p.request,"",environment?"blocked":"not_run");
  const receipt=environment?signFixtureReceipt({...fixture.unsigned,resourceOutcome:"environment_unavailable"},fixture.privateKey):fixture.receipt;
  const path=join(f.root,"evidence-proof.json"),output:unknown[]=[];
  await writeFile(path,JSON.stringify(attach(f.evidence,fixture,receipt)));
  expect(await articleCli(["article","evidence","import","--job",f.job.jobId,"--root",f.root,"--from",path,"--json"],process.cwd(),async()=>repo,value=>output.push(value))).toBe(environment?4:2);
  expect(output.at(-1)).toMatchObject({state:"DRAFTED",examplesReady:false,productionEligible:false});
 });
 it("stores a real parser failure as DRAFTED and refuses audit",async()=>{
  const f=await setup('{"input":}'),p=await prepared(f),fixture=await runFixtureJsonVerifier(p.request);
  const result=await importReviewEvidence(f.job.directory,repo,attach(f.evidence,fixture));
  expect(result.state).toBe("DRAFTED");expect(result.examplesReady).toBe(false);expect(result.examples).toMatchObject([{status:"fail"}]);
  await expect(prepareContentAudit(f.job.directory,repo)).rejects.toThrow("PREREQUISITES");
 },30000);
 it.each(["not_run","blocked"] as const)("does not promote an authenticated %s record",async(status)=>{
  const f=await setup(),p=await prepared(f),fixture=receiptFixture(p.request,"",status);
  expect((await importReviewEvidence(f.job.directory,repo,attach(f.evidence,fixture))).state).toBe("DRAFTED");
 });
 it("does not promote a passing process when expected output differs",async()=>{
  const f=await setup();f.evidence.examples[0]!.expectedStdoutSha256=sha256("unobserved output");
  const p=await prepared(f),fixture=receiptFixture(p.request);
  const result=await importReviewEvidence(f.job.directory,repo,attach(f.evidence,fixture));
  expect(result.state).toBe("DRAFTED");expect(result.examples).toMatchObject([{status:"fail"}]);
 });
 it("distinguishes an authenticated unavailable verifier from missing input and verification failure",async()=>{
  const f=await setup(),p=await prepared(f),fixture=receiptFixture(p.request,"","blocked");
  const receipt=signFixtureReceipt({...fixture.unsigned,resourceOutcome:"environment_unavailable"},fixture.privateKey);
  await importReviewEvidence(f.job.directory,repo,attach(f.evidence,fixture,receipt));
  const review=await buildContentReviewBundle(f.job.directory,repo);
  expect(review.contentState).toBe("DRAFTED");
  expect(review.blockers).toContainEqual({category:"environment_unavailable",code:"example-verifier-environment-unavailable"});
 });
 it.each(["completed","timeout","memory_limit","pid_limit","output_limit","denied"] as const)("reports received blocked proof without claiming a missing receipt: %s",async(resourceOutcome)=>{
  const f=await setup(),p=await prepared(f),fixture=receiptFixture(p.request,"","blocked");
  const receipt=signFixtureReceipt({...fixture.unsigned,resourceOutcome},fixture.privateKey);
  const result=await importReviewEvidence(f.job.directory,repo,attach(f.evidence,fixture,receipt));
  expect(result.state).toBe("DRAFTED");expect(result.examplesReady).toBe(false);
  const code=resourceOutcome==="denied"?"example-policy-denied":resourceOutcome==="completed"?"example-verification-blocked":"example-resource-limit-blocked";
  if(!("blockers" in result))throw new Error("missing blockers");
  expect(result.blockers).toContainEqual({exampleId:"example-001",category:"validation_failed",code});
  const review=await buildContentReviewBundle(f.job.directory,repo);
  expect(review.blockers).toContainEqual({category:"validation_failed",code});
  await expect(prepareContentAudit(f.job.directory,repo)).rejects.toThrow("PREREQUISITES");
 });
 it("refuses fixture trust as an operational verifier and has no operational default key",async()=>{
  const f=await setup('{"input":4}',"json",undefined,true),p=await prepared(f),fixture=receiptFixture(p.request);
  await expect(importReviewEvidence(f.job.directory,repo,attach(f.evidence,fixture))).rejects.toThrow("FIXTURE_TRUST_DENIED");
  const receipt=signFixtureReceipt({...fixture.unsigned,scope:"human_local"},fixture.privateKey);
  await expect(importReviewEvidence(f.job.directory,repo,{...f.evidence,verification:{receipts:[receipt]}})).rejects.toThrow("UNTRUSTED");
 });
 it.each(["signature","duplicate","extra","self"] as const)("rejects %s proof before advancing state",async(kind)=>{
  const f=await setup(),p=await prepared(f),fixture=receiptFixture(p.request),input=attach(f.evidence,fixture);
  if(kind==="signature")input.verification.receipts[0]!.signatureHex="0".repeat(128);
  if(kind==="duplicate")input.verification.receipts.push(fixture.receipt);
  if(kind==="extra")input.verification.receipts[0]!.exampleId="unknown";
  if(kind==="self"){
   fixture.trust.principalId="fixture-writer";
   input.verification.receipts[0]=signFixtureReceipt({...fixture.unsigned,principalId:"fixture-writer"},fixture.privateKey);
  }
  await expect(importReviewEvidence(f.job.directory,repo,input)).rejects.toThrow();
  expect((await guideDraft(f.job.directory,repo)).currentState).toBe("SOURCES_READY");
 });
 it("binds a receipt to the exact attempt, and retains old successful history",async()=>{
  const f=await setup(),p=await prepared(f),fixture=receiptFixture(p.request),input=attach(f.evidence,fixture);
  await importReviewEvidence(f.job.directory,repo,input);
  await reviseDraft(f.job.directory,repo,"new attempt");
  await importReviewSources(f.job.directory,repo,f.sources);
  await expect(importReviewEvidence(f.job.directory,repo,input)).rejects.toThrow("TARGET_OR_PROFILE");
 });
 it.each(["3","invented"] as const)("checks synthetic signed sandbox output binding without executing target code: %s",async(observed)=>{
  const f=await setup("1 + 2","javascript",observed),p=await prepared(f),fixture=receiptFixture(p.request,"3");
  const result=await importReviewEvidence(f.job.directory,repo,attach(f.evidence,fixture));
  expect(result.examplesReady).toBe(observed==="3");expect(result.state).toBe(observed==="3"?"EXAMPLES_ASSESSED":"DRAFTED");
  expect(result.examples?.[1]!.status).toBe(observed==="3"?"pass":"blocked");
  if(observed==="3")expect(result.examples?.[1]!.label).toContain("合成fixture");
 });
});
