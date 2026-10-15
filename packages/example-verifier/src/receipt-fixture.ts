// Ephemeral test keys only. No key produced here is admitted by the operational trust store.
import {createRequire} from "node:module";
import {generateKeyPairSync,sign,type KeyObject} from "node:crypto";
import {readFileSync} from "node:fs";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,dirname} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
import {spawn} from "node:child_process";
import {exampleVerificationReceiptSchema,type ExampleVerificationReceipt,type ExampleVerificationRequest,type ExampleVerifierTrustRecord} from "@xpotato/content-contracts";
import {canonicalJson,fingerprint,sha256} from "@xpotato/content-contracts/canonical";
import {exampleReceiptPolicy} from "./receipt-policy.js";
import {exampleReceiptSignatureDomain} from "./receipt.js";
const worker=new URL("../../../scripts/fixtures/verify-json-receipt.mjs",import.meta.url);
const implementationSha256=fingerprint({worker:sha256(readFileSync(worker)),canonical:sha256(readFileSync(new URL("../../content-contracts/src/canonical.ts",import.meta.url)))});
let binarySha256:string|undefined;
export function signFixtureReceipt(unsigned:Omit<ExampleVerificationReceipt,"signatureHex">,privateKey:KeyObject){
 return exampleVerificationReceiptSchema.parse({...unsigned,signatureHex:sign(null,Buffer.from(exampleReceiptSignatureDomain+canonicalJson(unsigned)),privateKey).toString("hex")});
}
export function receiptFixture(request:ExampleVerificationRequest,stdout="",status:"pass"|"fail"|"not_run"|"blocked"="pass"){
 const {publicKey,privateKey}=generateKeyPairSync("ed25519"),keyBytes=publicKey.export({format:"der",type:"spki"});
 const policy=exampleReceiptPolicy(request.profileId,request.requestedClass),time=new Date(Date.now()-1000).toISOString();
 binarySha256??=sha256(readFileSync(process.execPath));
 const output=(text:string)=>({text,bytes:Buffer.byteLength(text),sha256:sha256(text)});
 const unsigned:Omit<ExampleVerificationReceipt,"signatureHex">={protocol:"xpotato-example-verification-receipt-v1",scope:"synthetic_fixture",
  requestSha256:request.requestSha256,exampleId:request.exampleId,inputArtifactSha256:request.inputArtifactSha256,
  profileId:policy.profileId,profileSha256:policy.profileSha256,keyId:"fixture-key-"+sha256(keyBytes).slice(0,12),principalId:"fixture-executor",
  implementationSha256,toolchainSha256:binarySha256,runtime:{name:policy.runtime,version:policy.version.split(".").length<3?policy.version+".0":policy.version},
  verifier:{kind:policy.mode,name:policy.verifier,version:process.versions.node},boundarySha256:policy.boundarySha256,
  startedAt:time,finishedAt:time,wallTimeMs:0,resourceOutcome:"completed",
  result:{class:policy.class,status,exitCode:status==="pass"?0:status==="fail"?1:null,signal:null,
   stdout:output(stdout),stderr:output(""),limitations:["合成fixtureの署名・整合検査。sandboxの実動作を示すものではありません。"]}};
 const trust:ExampleVerifierTrustRecord={keyId:unsigned.keyId,principalId:unsigned.principalId,scope:"synthetic_fixture",status:"active",
  publicKeySpkiDerBase64:keyBytes.toString("base64"),publicKeySha256:sha256(keyBytes),validFrom:"2026-01-01T00:00:00.000Z",
  bindings:[{profileId:policy.profileId,profileSha256:policy.profileSha256,implementationSha256,toolchainSha256:binarySha256,
   runtimeVersion:unsigned.runtime.version,verifierVersion:unsigned.verifier.version}]};
 return {privateKey,trust,unsigned,receipt:signFixtureReceipt(unsigned,privateKey)};
}
export async function runFixtureJsonVerifier(request:ExampleVerificationRequest){
 if(request.scope!=="synthetic_fixture"||request.profileId!=="json-parse-v1")throw Error("Fixture worker scope/profile only");
 const fixture=receiptFixture(request),cwd=await mkdtemp(join(tmpdir(),"example-receipt-worker-"));
 const child=spawn(process.execPath,["--import",pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href,fileURLToPath(worker)],{cwd,stdio:["pipe","pipe","pipe"],
  env:{PATH:dirname(process.execPath),LANG:"C.UTF-8",LC_ALL:"C.UTF-8",TZ:"UTC",HOME:cwd,TMPDIR:cwd}});
 let stdout="",stderr="";const timer=setTimeout(()=>child.kill("SIGKILL"),25000);
 child.stdout.on("data",bytes=>{stdout+=bytes;if(Buffer.byteLength(stdout)>2097152)child.kill("SIGKILL");});
 child.stderr.on("data",bytes=>{stderr+=bytes;if(Buffer.byteLength(stderr)>1048576)child.kill("SIGKILL");});
 try{
  const exit=await new Promise<{code:number|null;signal:NodeJS.Signals|null}>((resolve,reject)=>{
   child.once("error",reject);child.once("exit",(code,signal)=>resolve({code,signal}));
   child.stdin.end(JSON.stringify({request,keyId:fixture.trust.keyId,principalId:fixture.trust.principalId,
    privateKeyPkcs8DerBase64:fixture.privateKey.export({format:"der",type:"pkcs8"}).toString("base64")}));
  });
  if(exit.code!==0||exit.signal||stderr)throw Error("Fixture verifier transport failed");
  return {...fixture,receipt:exampleVerificationReceiptSchema.parse(JSON.parse(stdout))};
 }finally{clearTimeout(timer);if(child.exitCode===null&&child.signalCode===null)child.kill("SIGKILL");await rm(cwd,{recursive:true,force:true});}
}
