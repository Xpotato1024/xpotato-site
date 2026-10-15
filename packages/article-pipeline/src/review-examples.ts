import {exampleVerificationRequestSchema,technicalExampleRecordSchema,technicalExampleVerificationResultSchema,
 type LocalSourceBundle,type LocalEvidenceBundle} from "@xpotato/content-contracts";
import {classifyTechnicalExample,exampleReceiptPolicy,verifyExampleReceipt,trustedExampleVerifiers} from "@xpotato/example-verifier";
import {inspectExamples} from "@xpotato/portable-content/review";
import {fingerprint,sha256} from "./canonical.js";
import {fail} from "./private-files.js";
export type ExampleReviewBinding={jobId:string;attemptId:string;jobFingerprint:string;inputSha256:string};
export function assessReviewExamples(body:string,sources:LocalSourceBundle,bundle:LocalEvidenceBundle,binding?:ExampleReviewBinding){
 const examples=inspectExamples(body),annotations=new Map(bundle.examples.map(item=>[item.exampleId,item]));
 if(annotations.size!==bundle.examples.length||annotations.size!==examples.length||examples.some(item=>!annotations.has(item.exampleId)))fail("EXAMPLE_ANNOTATION_EXACT_SET_MISMATCH");
 const fixtureTrust=bundle.verification?.fixtureTrust??[];
 if(fixtureTrust.length&&(sources.scope!=="synthetic_fixture"||fixtureTrust.some(key=>key.scope!=="synthetic_fixture")))fail("EXAMPLE_VERIFICATION_FIXTURE_TRUST_DENIED");
 const trust=[...trustedExampleVerifiers,...fixtureTrust];
 const {verification:ignored,...plan}=bundle,planSha256=fingerprint(plan);
 const requests=new Map<string,ReturnType<typeof exampleVerificationRequestSchema.parse>>();
 const assessed=examples.map(example=>{
  const annotation=annotations.get(example.exampleId)!;
  if(annotation.materialClaimIds.some(id=>!bundle.claims.some(claim=>claim.claimId===id&&claim.claimType!=="transition")))fail("EXAMPLE_CLAIM_UNKNOWN");
  const {source,...input}=example,record=technicalExampleRecordSchema.parse({...input,intendedPurpose:annotation.intendedPurpose,requestedVerification:annotation.requestedVerification});
  const disposition=classifyTechnicalExample(example.language??"",source);
  if(annotation.observedOutput&&annotation.requestedVerification!=="evidence_observed")fail("EXAMPLE_OBSERVED_OUTPUT_CLASS_INVALID");
  if(annotation.observedOutput?.fromExampleId===example.exampleId)fail("EXAMPLE_OBSERVED_OUTPUT_SELF_REFERENCE");
  if(annotation.observedOutput&&!annotations.has(annotation.observedOutput.fromExampleId))fail("EXAMPLE_OBSERVED_OUTPUT_UNKNOWN");
  const illustrative=annotation.requestedVerification==="illustrative"||annotation.requestedVerification==="not_verifiable";
  const accepted=illustrative&&!annotation.verificationRequired&&!annotation.materialClaimIds.length;
  let request:ReturnType<typeof exampleVerificationRequestSchema.parse>|undefined;
  if(disposition.kind!=="reject"&&["syntax_checked","sandbox_executed"].includes(annotation.requestedVerification)){
   const policy=exampleReceiptPolicy(disposition.profileId,annotation.requestedVerification as "syntax_checked"|"sandbox_executed");
   if(policy.class!==annotation.requestedVerification)fail("EXAMPLE_VERIFICATION_CLASS_PROFILE_MISMATCH");
   if(binding){
    const unsigned={protocol:"xpotato-example-verification-request-v1" as const,scope:sources.scope,binding,
     bodySha256:sha256(body),sourceBundleSha256:fingerprint(sources),evidencePlanSha256:planSha256,
     authorPrincipalId:sources.authorPrincipalId,exampleId:example.exampleId,inputArtifactSha256:example.contentSha256,
     source,requestedClass:policy.class,profileId:policy.profileId,profileSha256:policy.profileSha256};
    request=exampleVerificationRequestSchema.parse({...unsigned,requestSha256:fingerprint(unsigned)});requests.set(example.exampleId,request);
   }
  }
  const result=technicalExampleVerificationResultSchema.parse({exampleId:example.exampleId,class:annotation.requestedVerification,
   status:accepted?"not_run":"blocked",inputArtifactSha256:example.contentSha256,
   limitations:["未実行。分類は実行・構文検査の証拠ではありません。",...(accepted?[]:["固定した別実行主体の検証receiptが必要です。"])]});
  return {record,result,disposition,label:"未実行",accepted,request};
 });
 const receiptMap=new Map((bundle.verification?.receipts??[]).map(receipt=>[receipt.exampleId,receipt]));
 if(receiptMap.size!==(bundle.verification?.receipts.length??0)||[...receiptMap.keys()].some(id=>!requests.has(id)))fail("EXAMPLE_VERIFICATION_RECEIPT_SET_INVALID");
 const verified=new Map<string,ReturnType<typeof verifyExampleReceipt>>();
 for(const item of assessed){
  const receipt=receiptMap.get(item.record.exampleId);if(!receipt)continue;
  const proof=verifyExampleReceipt(item.request!,receipt,trust),annotation=annotations.get(item.record.exampleId)!;
  const mismatch=annotation.expectedStdoutSha256&&annotation.expectedStdoutSha256!==proof.receipt.result.stdout.sha256
    ||annotation.expectedStderrSha256&&annotation.expectedStderrSha256!==proof.receipt.result.stderr.sha256;
  if(mismatch){
   proof.accepted=false;proof.result={...proof.result,status:"fail",limitations:[...proof.result.limitations,"取得済み出力とexpected hashが不一致です。"]};
  }
  verified.set(item.record.exampleId,proof);
  item.result=proof.result;item.accepted=proof.accepted;
  item.label=proof.result.status!=="pass"?"検証不合格／未完了":proof.result.class==="syntax_checked"?"構文・型検査済み（動作は未検証）":"sandbox実行済み（固定環境限定）";
 }
 for(const item of assessed){
  const annotation=annotations.get(item.record.exampleId)!;if(!annotation.observedOutput)continue;
  const proof=verified.get(annotation.observedOutput.fromExampleId);
  const output=proof?.receipt.result[annotation.observedOutput.stream];
  const accepted=Boolean(proof?.accepted&&proof.result.class==="sandbox_executed"&&output?.sha256===item.record.contentSha256);
  item.result=technicalExampleVerificationResultSchema.parse({exampleId:item.record.exampleId,class:"evidence_observed",
   status:accepted?"pass":"blocked",inputArtifactSha256:item.record.contentSha256,
   ...(accepted?{verifier:{kind:"evidence_binding",name:"signed-execution-output-binding",version:"1"},
    stdoutSha256:proof!.receipt.result.stdout.sha256,stderrSha256:proof!.receipt.result.stderr.sha256,
    evidenceIds:[...new Set(annotation.materialClaimIds.flatMap(id=>bundle.claims.find(claim=>claim.claimId===id)!.evidenceIds))],
    verifiedAt:proof!.receipt.finishedAt}:{}),
   limitations:["同じ固定入力の署名済みsandbox実行出力とのUTF-8 byte一致だけを検査します。記事外の実環境観測を証明しません。"]});
  item.accepted=accepted;item.label=accepted?"取得済み実行出力との一致確認済み":"未確認／実行出力と不一致";
 }
 const evaluated=assessed.map(({request,...item})=>{
  const proof=verified.get(item.record.exampleId)??verified.get(annotations.get(item.record.exampleId)!.observedOutput?.fromExampleId??"");
  const annotation=annotations.get(item.record.exampleId)!;
  return {...item,requirements:{verificationRequired:annotation.verificationRequired,materialClaimIds:annotation.materialClaimIds,
    ...(annotation.observedOutput?{observedOutput:annotation.observedOutput}:{}),
    ...(annotation.expectedStdoutSha256?{expectedStdoutSha256:annotation.expectedStdoutSha256}:{}),
    ...(annotation.expectedStderrSha256?{expectedStderrSha256:annotation.expectedStderrSha256}:{})},
   label:(sources.scope==="synthetic_fixture"&&item.result.status==="pass"?"合成fixture: ":"")+item.label,
   ...(proof?{receiptSha256:proof.receiptSha256,requestSha256:proof.requestSha256,trustRecordSha256:proof.trustRecordSha256,
    profileSha256:proof.policySha256}:{}),
  };
 });
 const exampleBlockers=evaluated.filter(item=>!item.accepted).map(item=>{
  const annotation=annotations.get(item.record.exampleId)!,proof=verified.get(item.record.exampleId)
    ??verified.get(annotation.observedOutput?.fromExampleId??"");
  let category:"input_missing"|"validation_failed"|"implementation_incomplete"|"environment_unavailable"="input_missing",code="example-receipt-missing";
  if(proof?.receipt.resourceOutcome==="environment_unavailable"){category="environment_unavailable";code="example-verifier-environment-unavailable";}
  else if(item.result.status==="fail"){category="validation_failed";code="example-verification-failed";}
  else if(annotation.observedOutput&&proof){category="validation_failed";code="example-observed-output-unverified";}
  else if(annotation.requestedVerification==="evidence_observed"&&!annotation.observedOutput){category="implementation_incomplete";code="external-observation-adapter-unavailable";}
  else if(item.disposition.kind==="reject"){category=item.disposition.reason==="unsupported verification class"?"implementation_incomplete":"validation_failed";code=category==="implementation_incomplete"?"example-profile-unavailable":"example-policy-denied";}
  else if(["illustrative","not_verifiable"].includes(annotation.requestedVerification)){category="validation_failed";code="example-material-claim-unverified";}
  else if(proof?.result.status==="not_run")code="example-not-run";
  else if(proof?.receipt.resourceOutcome==="denied"){category="validation_failed";code="example-policy-denied";}
  else if(proof?.result.status==="blocked"){category="validation_failed";code=["timeout","memory_limit","pid_limit","output_limit"].includes(proof.receipt.resourceOutcome)?"example-resource-limit-blocked":"example-verification-blocked";}
  return {exampleId:item.record.exampleId,category,code};
 });
 return {examples:evaluated,examplesReady:evaluated.every(item=>item.accepted),exampleBlockers,
  verificationRequests:[...requests.values()],verificationTrustSha256:fingerprint(trust)};
}
