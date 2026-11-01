import {z} from "zod";
import {sha256Schema,stableIdSchema,isoDateTimeSchema} from "./common.js";
import {sourceRecordSchema,evidenceRecordSchema,articleClaimRecordSchema,ambiguityRecordSchema} from "./source-evidence.js";
import {externalAiDisclosureRecordSchema} from "./disclosure.js";
import {articleJobStateSchema} from "./article-job.js";
import {exampleVerificationReceiptSchema,exampleVerifierTrustRecordSchema} from "./example-receipt.js";
import {exampleVerificationClassSchema} from "./technical-example.js";

export const articleReviewScopeSchema=z.enum(["human_local","synthetic_fixture","existing_ai"]);
export const agentAuditExecutionSchema=z.object({
 protocol:z.literal("xpotato-private-hosted-agent-audit-observation-v1"),
 contextRef:z.string().regex(/^codex-thread:[a-f0-9-]{36}$/u),freshContext:z.literal(true),
 stage:z.enum(["content","visual"]),skillId:z.enum(["independent-article-audit","independent-visual-audit"]),
 skillSha256:sha256Schema,requestSha256:sha256Schema,responseSha256:sha256Schema,completedAt:isoDateTimeSchema,
}).strict();
export const independentReviewerSchema=z.discriminatedUnion("kind",[
 z.object({kind:z.literal("human"),principalId:stableIdSchema}).strict(),
 z.object({kind:z.literal("agent"),principalId:stableIdSchema,execution:agentAuditExecutionSchema}).strict(),
]);
export const localSourceBundleSchema=z.object({
  schemaVersion:z.literal(1),scope:articleReviewScopeSchema,authorPrincipalId:stableIdSchema,
  existingInput:z.object({inputSha256:sha256Schema,manuscriptSha256:sha256Schema}).strict().optional(),
  sources:z.array(z.object({record:sourceRecordSchema,snapshot:z.string().max(262144),
    disclosure:externalAiDisclosureRecordSchema}).strict()).max(100),
}).strict().refine(v=>(v.scope==="existing_ai")===Boolean(v.existingInput),{message:"Existing AI scope requires exact received input binding"});
export const localEvidenceBundleSchema=z.object({
  schemaVersion:z.literal(1),bodySha256:sha256Schema,sourceBundleSha256:sha256Schema,
  evidence:z.array(evidenceRecordSchema).max(500),claims:z.array(articleClaimRecordSchema).max(500),
  ambiguities:z.array(ambiguityRecordSchema).max(100),
  extracts:z.array(z.object({evidenceId:stableIdSchema,sourceId:stableIdSchema,start:z.number().int().nonnegative(),
    end:z.number().int().positive(),textSha256:sha256Schema}).strict()).max(1000),
  examples:z.array(z.object({exampleId:stableIdSchema,requestedVerification:exampleVerificationClassSchema,
    intendedPurpose:z.string().min(1),verificationRequired:z.boolean(),materialClaimIds:z.array(stableIdSchema),
    observedOutput:z.object({fromExampleId:stableIdSchema,stream:z.enum(["stdout","stderr"])}).strict().optional(),
    expectedStdoutSha256:sha256Schema.optional(),expectedStderrSha256:sha256Schema.optional(),
  }).strict()).max(100),
  verification:z.object({receipts:z.array(exampleVerificationReceiptSchema).max(100),
    fixtureTrust:z.array(exampleVerifierTrustRecordSchema).max(20).optional()}).strict().optional(),
  receivedCitationMarkers:z.array(z.object({start:z.number().int().nonnegative(),end:z.number().int().positive(),
    sourceIds:z.array(stableIdSchema).min(1).max(20)}).strict()).max(200).optional(),
}).strict();
export const contentAuditRecordSchema=z.object({
  schemaVersion:z.literal(1),scope:articleReviewScopeSchema,requestSha256:sha256Schema,
  reviewer:independentReviewerSchema,
  independence:z.object({separateReview:z.literal(true),authorIdentityConfirmed:z.literal(true),basis:z.string().min(1)}).strict(),
  coveredClaimIds:z.array(stableIdSchema),materialCoverage:z.enum(["complete","incomplete"]),
  findings:z.array(z.object({severity:z.enum(["P0","P1","P2"]),message:z.string().min(1),claimIds:z.array(stableIdSchema)}).strict()),
  conclusion:z.enum(["pass","revision_required","blocked"]),reviewedAt:isoDateTimeSchema,
}).strict().refine(v=>(v.scope==="existing_ai")===(v.reviewer.kind==="agent"),{message:"Agent audit and human audit scopes must remain separate"});
export const articleStageReceiptSchema=z.object({
  schemaVersion:z.literal(1),jobId:stableIdSchema,attemptId:stableIdSchema,jobFingerprint:sha256Schema,
  inputSha256:sha256Schema,previousReceiptSha256:sha256Schema.nullable(),
  from:articleJobStateSchema,to:articleJobStateSchema,stage:stableIdSchema,profileId:stableIdSchema,
  inputs:z.record(z.string(),sha256Schema),outputs:z.record(z.string(),sha256Schema),
  result:z.enum(["success","revision_required","blocked_env"]),startedAt:isoDateTimeSchema,finishedAt:isoDateTimeSchema,
  receiptSha256:sha256Schema,
}).strict();
export const articleReviewBundleManifestSchema=z.object({
  schemaVersion:z.literal(1),mode:z.literal("content-review"),jobId:stableIdSchema,attemptId:stableIdSchema,
  inputSha256:sha256Schema,bodySha256:sha256Schema,reviewInputsSha256:sha256Schema,
  htmlSha256:sha256Schema,artifactSha256:sha256Schema,contentState:articleJobStateSchema,
  candidateSha256:z.null(),approvalEligible:z.literal(false),productionEligible:z.literal(false),
  blockers:z.array(z.object({category:z.enum(["input_missing","validation_failed","implementation_incomplete","environment_unavailable","approval_pending"]),
    code:stableIdSchema}).strict()),
}).strict();
export type LocalSourceBundle=z.infer<typeof localSourceBundleSchema>;
export type LocalEvidenceBundle=z.infer<typeof localEvidenceBundleSchema>;
export type ContentAuditRecord=z.infer<typeof contentAuditRecordSchema>;
export type ArticleStageReceipt=z.infer<typeof articleStageReceiptSchema>;
