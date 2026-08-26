import { z } from "zod";
import { httpsUrlSchema, isoDateTimeSchema, sha256Schema, stableIdSchema } from "./common.js";

export const externalAiDisclosureModeSchema = z.enum(["allow_exact", "allow_derived_only", "deny"]);
export const externalAiDisclosureBasisSchema = z.enum(["system_policy", "repository_policy", "user_authorized"]);
export const disclosureStageSchema = z.enum([
  "source_discovery",
  "evidence",
  "author",
  "content_audit",
  "revision",
  "visual_plan",
  "visual_audit",
  "image_generation",
]);

export const externalAiInputPolicyBindingSchema = z
  .object({ policyId: stableIdSchema, policySha256: sha256Schema })
  .strict();
export const externalAiInputAuthorizationSchema = z
  .object({
    inputRef: stableIdSchema,
    requestedMode: z.enum(["allow_exact", "allow_derived_only"]),
    authorizedBy: z.literal("user"),
  })
  .strict();

export const externalAiDisclosureRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    subject: z.object({ kind: z.enum(["source", "artifact"]), id: stableIdSchema, sha256: sha256Schema }).strict(),
    mode: externalAiDisclosureModeSchema,
    basis: externalAiDisclosureBasisSchema,
    policyId: stableIdSchema,
    policySha256: sha256Schema,
    authorizedBy: z.enum(["user", "repository_policy", "system_policy"]).optional(),
    authorizedAt: isoDateTimeSchema.optional(),
    derivedArtifactPolicyId: stableIdSchema.optional(),
    notes: z.array(z.string()),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.basis === "user_authorized" && value.authorizedBy !== "user") {
      context.addIssue({ code: "custom", message: "user_authorized requires authorizedBy=user", path: ["authorizedBy"] });
    }
    if (value.mode === "allow_derived_only" && !value.derivedArtifactPolicyId) {
      context.addIssue({
        code: "custom",
        message: "allow_derived_only requires a derivation policy",
        path: ["derivedArtifactPolicyId"],
      });
    }
  });

export const externalAiDisclosureManifestEntrySchema = z
  .object({
    requestArtifactId: stableIdSchema,
    requestArtifactSha256: sha256Schema,
    disclosureRecordSha256: sha256Schema,
    sourceSubjectSha256: sha256Schema.optional(),
    modeUsed: z.enum(["exact", "derived"]),
  })
  .strict();

export const externalAiDisclosureManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    jobId: stableIdSchema,
    jobFingerprint: sha256Schema,
    requestId: stableIdSchema,
    stage: disclosureStageSchema,
    policyId: stableIdSchema,
    policySha256: sha256Schema,
    entries: z.array(externalAiDisclosureManifestEntrySchema),
    secretScanResultSha256: sha256Schema,
    manifestSha256: sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    const keys = value.entries.map((entry) => `${entry.requestArtifactId}:${entry.requestArtifactSha256}`);
    if (new Set(keys).size !== keys.length) {
      context.addIssue({ code: "custom", message: "manifest entries must be unique", path: ["entries"] });
    }
  });

export const externalAiAdmissionClassSchema = z.enum([
  "public_anonymous_web_v1",
  "public_github_revision_v1",
  "article_job_brief_v1",
  "user_note_or_log_v1",
  "private_repository_or_document_v1",
  "raw_user_image_v1",
  "approved_publication_derivative_v1",
  "secret_or_capability_material_v1",
  "unknown_v1",
]);

const privateJobInputClassSchema = z.enum([
  "article_job_brief_v1",
  "user_note_or_log_v1",
  "private_repository_or_document_v1",
  "raw_user_image_v1",
]);

export const externalAiAdmissionProvenanceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("public_anonymous_https_acquisition_v1"),
      artifactSha256: sha256Schema,
      finalUrl: httpsUrlSchema,
      anonymousReadable: z.literal(true),
      credentialsUsed: z.literal(false),
      secretScanResultSha256: sha256Schema,
      acquisitionReceiptSha256: sha256Schema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("public_github_revision_acquisition_v1"),
      artifactSha256: sha256Schema,
      repository: z.string().min(1),
      commitSha: z.string().regex(/^[a-f0-9]{40}$/),
      blobSha256: sha256Schema,
      anonymousReadable: z.literal(true),
      credentialsUsed: z.literal(false),
      secretScanResultSha256: sha256Schema,
      acquisitionReceiptSha256: sha256Schema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("article_job_input_v1"),
      inputRef: stableIdSchema,
      inputClass: privateJobInputClassSchema,
      artifactSha256: sha256Schema,
      representation: z.enum(["raw", "derived"]),
      sourceSubjectSha256: sha256Schema.optional(),
      derivationRecordSha256: sha256Schema.optional(),
    })
    .strict()
    .superRefine((value, context) => {
      if (value.representation === "derived") {
        if (!value.sourceSubjectSha256) {
          context.addIssue({ code: "custom", message: "derived input requires sourceSubjectSha256", path: ["sourceSubjectSha256"] });
        }
        if (!value.derivationRecordSha256) {
          context.addIssue({ code: "custom", message: "derived input requires derivationRecordSha256", path: ["derivationRecordSha256"] });
        }
      } else if (value.sourceSubjectSha256 || value.derivationRecordSha256) {
        context.addIssue({ code: "custom", message: "raw input cannot claim derived lineage", path: ["representation"] });
      }
    }),
  z
    .object({
      kind: z.literal("approved_publication_derivative_lineage_v1"),
      sourceSubjectSha256: sha256Schema,
      derivativeSha256: sha256Schema,
      privacyBoundaryRecordSha256: sha256Schema,
      approvedStages: z.array(disclosureStageSchema).min(1),
      secretScanResultSha256: sha256Schema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("secret_or_capability_detection_v1"),
      artifactSha256: sha256Schema,
      detectedKind: z.string().min(1),
      detectionRecordSha256: sha256Schema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("unknown_v1"),
      artifactSha256: sha256Schema,
      reason: z.string().min(1),
    })
    .strict(),
]);

export const externalAiDisclosurePolicyProfileSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: stableIdSchema,
    providerNeutral: z.literal(true),
    unknownDefault: z.literal("deny"),
    classes: z.record(
      externalAiAdmissionClassSchema,
      z
        .object({
          mode: externalAiDisclosureModeSchema,
          basis: externalAiDisclosureBasisSchema,
          requiresExplicitAuthorization: z.boolean(),
          hardDeny: z.boolean(),
        })
        .strict(),
    ),
    hardDenyKinds: z.array(z.string().min(1)).min(1),
  })
  .strict();

export type ExternalAiDisclosureMode = z.infer<typeof externalAiDisclosureModeSchema>;
export type ExternalAiDisclosureRecord = z.infer<typeof externalAiDisclosureRecordSchema>;
export type ExternalAiDisclosureManifest = z.infer<typeof externalAiDisclosureManifestSchema>;
export type ExternalAiAdmissionClass = z.infer<typeof externalAiAdmissionClassSchema>;
export type ExternalAiAdmissionProvenance = z.infer<typeof externalAiAdmissionProvenanceSchema>;
export type ExternalAiDisclosurePolicyProfile = z.infer<typeof externalAiDisclosurePolicyProfileSchema>;
