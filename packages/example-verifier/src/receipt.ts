import {createPublicKey,verify} from "node:crypto";
import {exampleVerificationReceiptSchema,exampleVerificationRequestSchema,exampleVerifierTrustRecordSchema,
 technicalExampleVerificationResultSchema,type ExampleVerifierTrustRecord} from "@xpotato/content-contracts";
import {canonicalJson,fingerprint,sha256} from "@xpotato/content-contracts/canonical";
import {exampleReceiptPolicy,versionMatches} from "./receipt-policy.js";
export const exampleReceiptSignatureDomain="xpotato-example-verification-receipt-v1\n";
function fail(code:string):never{throw Error("EXAMPLE_VERIFICATION_"+code);}
export function verifyExampleReceipt(requestInput:unknown,receiptInput:unknown,trustInput:readonly ExampleVerifierTrustRecord[]){
 const request=exampleVerificationRequestSchema.parse(requestInput),receipt=exampleVerificationReceiptSchema.parse(receiptInput);
 const {requestSha256,...requestBody}=request;
 const policy=exampleReceiptPolicy(request.profileId,request.requestedClass);
 if(fingerprint(requestBody)!==requestSha256||sha256(request.source)!==request.inputArtifactSha256
  ||Buffer.from(request.source,"utf8").toString("utf8")!==request.source||Buffer.byteLength(request.source)>262144||request.profileSha256!==policy.profileSha256||request.requestedClass!==policy.class)fail("REQUEST_INVALID");
 if(receipt.scope!==request.scope||receipt.requestSha256!==requestSha256||receipt.exampleId!==request.exampleId
  ||receipt.inputArtifactSha256!==request.inputArtifactSha256||receipt.profileId!==request.profileId
  ||receipt.profileSha256!==policy.profileSha256||receipt.boundarySha256!==policy.boundarySha256
  ||receipt.result.class!==request.requestedClass)fail("TARGET_OR_PROFILE_MISMATCH");
 const trust=trustInput.map(record=>exampleVerifierTrustRecordSchema.parse(record));
 if(new Set(trust.map(record=>record.keyId)).size!==trust.length)fail("TRUST_KEY_DUPLICATE");
 const key=trust.find(record=>record.keyId===receipt.keyId&&record.status==="active"&&record.scope===request.scope);
 if(!key||key.principalId!==receipt.principalId||receipt.principalId===request.authorPrincipalId)fail("UNTRUSTED_OR_SELF_EXECUTOR");
 const finished=Date.parse(receipt.finishedAt),started=Date.parse(receipt.startedAt);
 if(!Number.isFinite(finished)||!Number.isFinite(started)||finished>Date.now()||finished<started||finished-started>30000||started<Date.parse(key.validFrom)
  ||key.validUntil&&finished>Date.parse(key.validUntil))fail("TIME_OR_KEY_VALIDITY_INVALID");
 const approved=key.bindings.some(item=>item.profileId===receipt.profileId&&item.profileSha256===receipt.profileSha256
  &&item.implementationSha256===receipt.implementationSha256&&item.toolchainSha256===receipt.toolchainSha256
  &&item.runtimeVersion===receipt.runtime.version&&item.verifierVersion===receipt.verifier.version);
 if(!approved||receipt.runtime.name!==policy.runtime||!versionMatches(receipt.runtime.version,policy.version)
  ||receipt.verifier.kind!==policy.mode||receipt.verifier.name!==policy.verifier)fail("RUNNER_BINDING_INVALID");
 const keyBytes=Buffer.from(key.publicKeySpkiDerBase64,"base64");
 if(keyBytes.toString("base64")!==key.publicKeySpkiDerBase64||sha256(keyBytes)!==key.publicKeySha256)fail("KEY_HASH_INVALID");
 let publicKey;try{publicKey=createPublicKey({key:keyBytes,format:"der",type:"spki"});}catch{return fail("KEY_INVALID");}
 if(publicKey.asymmetricKeyType!=="ed25519")fail("KEY_ALGORITHM_INVALID");
 const {signatureHex,...unsigned}=receipt;
 if(!verify(null,Buffer.from(exampleReceiptSignatureDomain+canonicalJson(unsigned)),publicKey,Buffer.from(signatureHex,"hex")))fail("SIGNATURE_INVALID");
 for(const output of [receipt.result.stdout,receipt.result.stderr]){
  if(Buffer.from(output.text,"utf8").toString("utf8")!==output.text||Buffer.byteLength(output.text)!==output.bytes||sha256(output.text)!==output.sha256)fail("OUTPUT_HASH_MISMATCH");
 }
 if(receipt.result.stdout.bytes+receipt.result.stderr.bytes>1048576)fail("OUTPUT_CAP_EXCEEDED");
 const observed=receipt.result.status==="pass"||receipt.result.status==="fail";
 if(!observed&&(receipt.result.exitCode!==null||receipt.result.signal!==null||receipt.result.stdout.bytes!==0))fail("UNEXECUTED_RESULT_INVALID");
 if(receipt.result.status==="pass"&&(receipt.result.exitCode!==0||receipt.result.signal!==null||receipt.resourceOutcome!=="completed"||receipt.wallTimeMs>15000||finished-started>15000))fail("FALSE_PASS");
 const result=technicalExampleVerificationResultSchema.parse({exampleId:request.exampleId,class:request.requestedClass,
  status:receipt.result.status,verifier:receipt.verifier,executionProfileId:request.profileId,inputArtifactSha256:request.inputArtifactSha256,
  stdoutSha256:receipt.result.stdout.sha256,stderrSha256:receipt.result.stderr.sha256,
  ...(receipt.result.exitCode!==null?{exitCode:receipt.result.exitCode}:{}),limitations:receipt.result.limitations,
  ...(observed?{verifiedAt:receipt.finishedAt}:{})});
 return {receipt,receiptSha256:fingerprint(receipt),requestSha256,trustRecordSha256:fingerprint(key),result,
  policySha256:policy.profileSha256,accepted:result.status==="pass"};
}
