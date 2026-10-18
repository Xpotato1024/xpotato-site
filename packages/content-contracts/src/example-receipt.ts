import {z} from "zod";
import {sha256Schema,stableIdSchema,isoDateTimeSchema} from "./common.js";
import {exampleVerificationClassSchema} from "./technical-example.js";
const scope=z.enum(["human_local","synthetic_fixture"]);
const binding=z.object({jobId:stableIdSchema,attemptId:stableIdSchema,jobFingerprint:sha256Schema,inputSha256:sha256Schema}).strict();
export const exampleVerificationRequestSchema=z.object({
 protocol:z.literal("xpotato-example-verification-request-v1"),scope,binding,
 bodySha256:sha256Schema,sourceBundleSha256:sha256Schema,evidencePlanSha256:sha256Schema,authorPrincipalId:stableIdSchema,
 exampleId:stableIdSchema,inputArtifactSha256:sha256Schema,source:z.string().max(262144),
 requestedClass:z.enum(["syntax_checked","sandbox_executed"]),profileId:stableIdSchema,profileSha256:sha256Schema,
 requestSha256:sha256Schema,
}).strict();
const output=z.object({text:z.string().max(1048576),sha256:sha256Schema,bytes:z.number().int().nonnegative().max(1048576)}).strict();
export const exampleVerificationReceiptSchema=z.object({
 protocol:z.literal("xpotato-example-verification-receipt-v1"),scope,requestSha256:sha256Schema,exampleId:stableIdSchema,
 inputArtifactSha256:sha256Schema,profileId:stableIdSchema,profileSha256:sha256Schema,
 keyId:stableIdSchema,principalId:stableIdSchema,implementationSha256:sha256Schema,toolchainSha256:sha256Schema,
 runtime:z.object({name:stableIdSchema,version:z.string().min(1).max(80)}).strict(),
 verifier:z.object({kind:z.enum(["parser","compiler","schema","sandbox"]),name:stableIdSchema,version:z.string().min(1).max(80)}).strict(),
 boundarySha256:sha256Schema,startedAt:isoDateTimeSchema,finishedAt:isoDateTimeSchema,
 wallTimeMs:z.number().nonnegative().max(30000),resourceOutcome:z.enum(["completed","timeout","memory_limit","pid_limit","output_limit","denied","environment_unavailable"]),
 result:z.object({class:exampleVerificationClassSchema,status:z.enum(["pass","fail","not_run","blocked"]),
  exitCode:z.number().int().nullable(),signal:z.string().min(1).nullable(),stdout:output,stderr:output,
  limitations:z.array(z.string().min(1).max(1024)).max(30)}).strict(),
 signatureHex:z.string().regex(/^[a-f0-9]{128}$/),
}).strict();
export const exampleVerifierTrustRecordSchema=z.object({
 keyId:stableIdSchema,principalId:stableIdSchema,scope,status:z.enum(["active","revoked"]),
 publicKeySpkiDerBase64:z.string().min(1).max(512),publicKeySha256:sha256Schema,
 validFrom:isoDateTimeSchema,validUntil:isoDateTimeSchema.optional(),
 bindings:z.array(z.object({profileId:stableIdSchema,profileSha256:sha256Schema,implementationSha256:sha256Schema,
  toolchainSha256:sha256Schema,runtimeVersion:z.string().min(1),verifierVersion:z.string().min(1)}).strict()).min(1).max(20),
}).strict();
export type ExampleVerificationRequest=z.infer<typeof exampleVerificationRequestSchema>;
export type ExampleVerificationReceipt=z.infer<typeof exampleVerificationReceiptSchema>;
export type ExampleVerifierTrustRecord=z.infer<typeof exampleVerifierTrustRecordSchema>;
