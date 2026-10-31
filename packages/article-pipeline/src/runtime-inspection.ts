import {resolve} from "node:path";
import {z} from "zod";
import {containsHardDenyMaterial,verifyDisclosureManifest} from "./disclosure.js";
import {verifySemanticRequest} from "./semantic-provider.js";
import {inspectMediaWriteSession} from "./media-write-runtime.js";
import {inside,safeRead,fail} from "./private-files.js";

/** Secret-free descriptor inspection only. Never resolves a credential,
 * instantiates a transport, mutates a job, or interprets desired as observed.
 */
export async function inspectRuntimeFile(repository:string,from:string,kind:"session"|"request"){
 const local=resolve(repository,".local"),path=resolve(repository,from);
 if(!inside(local,path)||!path.endsWith(".json")||from.split(/[\\/]/u).some(p=>p===".."||/^(?:\.aws|\.codex|\.ssh|credentials(?:\..*)?|secrets?(?:\..*)?|\.env.*)$/iu.test(p)))fail("RUNTIME_INSPECT_PATH_DENIED");
 const text=await safeRead(path,512*1024);if(containsHardDenyMaterial(Buffer.from(text)))fail("RUNTIME_INSPECT_SECRET_DENIED");
 try{
 const data:unknown=JSON.parse(text);
 if(kind==="session"){
  const d=inspectMediaWriteSession(data),counts={source:0,public:0,protected:0};for(const o of d.objects)counts[o.plane]++;
  return {kind,descriptorValid:true,authorityRevision:d.authorityRevision,expiresAt:d.expiresAt,objects:counts,
   observedProviderState:false,approvalVerified:false,credentialsVerified:false,liveReady:false,productionEligible:false};
 }
 const p=z.object({request:z.unknown(),manifest:z.unknown()}).strict().parse(data),request=verifySemanticRequest(p.request);
 const manifest=verifyDisclosureManifest(p.manifest as Parameters<typeof verifyDisclosureManifest>[0]);
 if(request.executionMode!=="external"||request.externalAiDisclosureManifestSha256!==manifest.manifestSha256
  ||request.jobId!==manifest.jobId||request.jobFingerprint!==manifest.jobFingerprint||request.requestId!==manifest.requestId||request.stage!==manifest.stage)throw Error("RUNTIME_INSPECT_REQUEST_BINDING_INVALID");
 return {kind,envelopeValid:true,stage:request.stage,requestSha256:request.requestSha256,
  exactPayloadAdmissionVerified:false,skillEligibilityVerified:false,liveReady:false,productionEligible:false};
 }catch{ return fail("RUNTIME_INSPECT_INPUT_INVALID"); }
}
