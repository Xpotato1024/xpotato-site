import {it,expect,vi} from "vitest";import {mkdtemp,mkdir,writeFile,readdir} from "node:fs/promises";import {join} from "node:path";import {tmpdir} from "node:os";
import {articleCli} from "./cli.js";import type {DraftRepository} from "./draft-job.js";
import {inspectRuntimeFile} from "./runtime-inspection.js";import {articleMediaTargets} from "@xpotato/content-contracts/article-media-targets";
import {fingerprint} from "./canonical.js";import {currentExternalAiPolicyBinding} from "./disclosure.js";import {fingerprintSemanticRequest} from "./semantic-provider.js";
const h="a".repeat(64);
async function fixture(){const root=await mkdtemp(join(tmpdir(),"runtime-inspect-"));await mkdir(join(root,".local"));return root;}
const descriptor=()=>({schemaVersion:1,sessionId:"fixture-session",authorityRevision:articleMediaTargets.authority.revision,expiresAt:new Date(Date.now()+60000).toISOString(),binding:{jobId:"job-1",jobFingerprint:h,candidateSha256:h,approvalSha256:h,attemptId:"attempt-1",inputSha256:h,policySha256:h},objects:[{plane:"public",key:"media/v1/objects/sha256/aa/"+h+".png",sha256:h,sizeBytes:1,contentType:"image/png",cacheControl:articleMediaTargets.public.cacheControl}]});
it("CLI inspects a secret-free descriptor without a job, connection or observed-state claim",async()=>{
 const root=await fixture();await writeFile(join(root,".local/session.json"),JSON.stringify(descriptor()));const fetcher=vi.fn(()=>{throw Error("NETWORK_FORBIDDEN");});vi.stubGlobal("fetch",fetcher);
 try{const output:unknown[]=[];expect(await articleCli(["article","runtime","inspect-session","--from",".local/session.json"],root,async()=>({} as DraftRepository),v=>output.push(v))).toBe(0);
 expect(output[0]).toMatchObject({descriptorValid:true,observedProviderState:false,approvalVerified:false,credentialsVerified:false,liveReady:false,productionEligible:false,objects:{source:0,public:1,protected:0}});
 expect(await readdir(join(root,".local"))).toEqual(["session.json"]);expect(fetcher).not.toHaveBeenCalled();}finally{vi.unstubAllGlobals();}
});
it("rejects secret/unknown fields, private paths and expired descriptors without disclosing inputs",async()=>{
 const root=await fixture();await writeFile(join(root,"outside.json"),"{}");await expect(inspectRuntimeFile(root,"outside.json","session")).rejects.toThrow("PATH_DENIED");
 await writeFile(join(root,".local/session.json"),JSON.stringify({...descriptor(),extra:"Authorization: fixture-only"}));await expect(inspectRuntimeFile(root,".local/session.json","session")).rejects.toThrow("SECRET_DENIED");
 await writeFile(join(root,".local/session.json"),JSON.stringify({...descriptor(),privateOrigins:["private-provider-locator"]}));await expect(inspectRuntimeFile(root,".local/session.json","session")).rejects.toThrow();
 await writeFile(join(root,".local/session.json"),JSON.stringify({...descriptor(),expiresAt:new Date(Date.now()-1).toISOString()}));await expect(inspectRuntimeFile(root,".local/session.json","session")).rejects.toThrow("INPUT_INVALID");
});
it("request inspection validates hashes but explicitly does not admit physical payloads or Skills",async()=>{
 const root=await fixture(),body={schemaVersion:1 as const,jobId:"job-1",jobFingerprint:h,requestId:"request-1",stage:"evidence" as const,...currentExternalAiPolicyBinding,entries:[],secretScanResultSha256:h},manifest={...body,manifestSha256:fingerprint(body)};
 const unsigned={schemaVersion:1 as const,requestId:"request-1",jobId:"job-1",jobFingerprint:h,stage:"evidence" as const,inputArtifacts:[],skill:{skillId:"fixture-skill",skillSha256:h,referenceBundleSha256:h},responseSchema:{schemaId:"fixture-schema",schemaSha256:h},constraints:{maxOutputBytes:1024,publicSafetyRequired:true,externalFactPolicy:"fixed_sources_only" as const},executionMode:"external" as const,externalAiDisclosureManifestSha256:manifest.manifestSha256};
 const request={...unsigned,requestSha256:fingerprintSemanticRequest(unsigned)};await writeFile(join(root,".local/request.json"),JSON.stringify({request,manifest}));
 expect(await inspectRuntimeFile(root,".local/request.json","request")).toMatchObject({envelopeValid:true,exactPayloadAdmissionVerified:false,skillEligibilityVerified:false,liveReady:false,productionEligible:false});
 await writeFile(join(root,".local/request.json"),JSON.stringify({request:{...request,requestSha256:"b".repeat(64)},manifest}));await expect(inspectRuntimeFile(root,".local/request.json","request")).rejects.toThrow("INPUT_INVALID");
});
