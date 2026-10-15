// Test-only coordinator. It never evaluates target code; its one child parses strict JSON data.
import {spawn} from "node:child_process";
import {readFileSync} from "node:fs";
import {createPrivateKey,sign} from "node:crypto";
import {performance} from "node:perf_hooks";
import {canonicalJson,fingerprint,sha256} from "../../packages/content-contracts/src/canonical.ts";
import {exampleReceiptPolicy} from "../../packages/example-verifier/src/receipt-policy.ts";
const domain="xpotato-example-verification-receipt-v1\n";
const implementationSha256=fingerprint({worker:sha256(readFileSync(new URL(import.meta.url))),canonical:sha256(readFileSync(new URL("../../packages/content-contracts/src/canonical.ts",import.meta.url)))});
const toolchainSha256=sha256(readFileSync(process.execPath));
let input="";for await(const chunk of process.stdin){input+=chunk;if(Buffer.byteLength(input)>2097152)throw Error("Fixture request cap");}
const envelope=JSON.parse(input),request=envelope.request,policy=exampleReceiptPolicy("json-parse-v1");
const {requestSha256,...unsignedRequest}=request;
if(request.scope!=="synthetic_fixture"||request.profileId!=="json-parse-v1"||request.profileSha256!==policy.profileSha256
 ||fingerprint(unsignedRequest)!==requestSha256||sha256(request.source)!==request.inputArtifactSha256||Buffer.byteLength(request.source)>262144)throw Error("Fixture request denied");
const parser='let input="";for await(const bytes of process.stdin){input+=bytes;if(Buffer.byteLength(input)>262144){process.exitCode=1;process.stderr.write("Input cap\\n");break;}}if(!process.exitCode){try{JSON.parse(input);}catch{process.exitCode=1;process.stderr.write("JSON syntax invalid\\n");}}';
const startedAt=new Date().toISOString(),clock=performance.now();
const child=spawn(process.execPath,["--input-type=module","--eval",parser],{cwd:process.cwd(),stdio:["pipe","pipe","pipe"],
 env:{PATH:process.env.PATH??"",LANG:"C.UTF-8",LC_ALL:"C.UTF-8",TZ:"UTC",HOME:process.cwd(),TMPDIR:process.cwd()}});
let stdout="",stderr="",capped=false,timedOut=false;
const collect=(stream,bytes)=>{if(Buffer.byteLength(stdout)+Buffer.byteLength(stderr)+bytes.length>1048576){capped=true;child.kill("SIGKILL");return;}if(stream==="stdout")stdout+=bytes;else stderr+=bytes;};
child.stdout.on("data",bytes=>collect("stdout",bytes));child.stderr.on("data",bytes=>collect("stderr",bytes));
const timer=setTimeout(()=>{timedOut=true;child.kill("SIGKILL");},15000);
const outcome=await new Promise((resolve,reject)=>{child.once("error",reject);child.once("exit",(exitCode,signal)=>resolve({exitCode,signal}));child.stdin.end(request.source);});
clearTimeout(timer);
const finishedAt=new Date().toISOString(),wallTimeMs=performance.now()-clock;
const output=text=>({text,bytes:Buffer.byteLength(text),sha256:sha256(text)});
const unsigned={protocol:"xpotato-example-verification-receipt-v1",scope:"synthetic_fixture",requestSha256,exampleId:request.exampleId,
 inputArtifactSha256:request.inputArtifactSha256,profileId:policy.profileId,profileSha256:policy.profileSha256,
 keyId:envelope.keyId,principalId:envelope.principalId,implementationSha256,toolchainSha256,
 runtime:{name:"node",version:process.versions.node},verifier:{kind:"parser",name:policy.verifier,version:process.versions.node},
 boundarySha256:policy.boundarySha256,startedAt,finishedAt,wallTimeMs,
 resourceOutcome:timedOut?"timeout":capped?"output_limit":"completed",
 result:{class:"syntax_checked",status:outcome.exitCode===0&&!timedOut&&!capped?"pass":"fail",
 exitCode:outcome.exitCode,signal:outcome.signal,stdout:output(stdout),stderr:output(stderr),
 limitations:["合成JSON fixtureの実際の構文検査。対象JSONをプログラムとして実行しません。OS sandboxの実行検証ではありません。"]}};
const key=createPrivateKey({key:Buffer.from(envelope.privateKeyPkcs8DerBase64,"base64"),format:"der",type:"pkcs8"});
const signatureHex=sign(null,Buffer.from(domain+canonicalJson(unsigned)),key).toString("hex");
process.stdout.write(JSON.stringify({...unsigned,signatureHex})+"\n");
