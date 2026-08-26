import { z } from "zod";
import { contentIdSchema, httpsUrlSchema, isoDateTimeSchema, repositoryRelativePathSchema, sha256Schema, stableIdSchema } from "./common.js";
import { evidenceInterpretationSchema } from "./source-evidence.js";
import { compactMediaRecoveryBindingSchema } from "./media.js";

export const compactSourceRefSchema = z.discriminatedUnion("kind", [
  z
    .object({
      sourceId: stableIdSchema,
      sourceRecordSha256: sha256Schema,
      kind: z.literal("url"),
      canonicalUrl: httpsUrlSchema,
      publisher: z.string().min(1).optional(),
      publishedAt: z.iso.date().optional(),
      retrievedAt: isoDateTimeSchema,
      snapshotSha256: sha256Schema.optional(),
    })
    .strict(),
  z
    .object({
      sourceId: stableIdSchema,
      sourceRecordSha256: sha256Schema,
      kind: z.literal("github"),
      repository: z.string().min(1),
      commitSha: z.string().regex(/^[a-f0-9]{40}$/),
      path: repositoryRelativePathSchema.optional(),
      blobSha256: sha256Schema.optional(),
    })
    .strict(),
  z.object({ sourceId: stableIdSchema, sourceRecordSha256: sha256Schema, kind: z.literal("doi"), doi: z.string().min(1) }).strict(),
  z
    .object({
      sourceId: stableIdSchema,
      sourceRecordSha256: sha256Schema,
      kind: z.literal("repository_doc"),
      path: repositoryRelativePathSchema,
      commitSha: z.string().regex(/^[a-f0-9]{40}$/),
      blobSha256: sha256Schema,
    })
    .strict(),
  z
    .object({
      sourceId: stableIdSchema,
      sourceRecordSha256: sha256Schema,
      kind: z.literal("user_supplied"),
      publicDescription: z.string().min(1),
      artifactSha256: sha256Schema.optional(),
    })
    .strict(),
]);

export const compactMaterialClaimBindingSchema = z
  .object({
    claimId: stableIdSchema,
    statementSha256: sha256Schema,
    locator: z.object({ headingId: stableIdSchema.optional(), blockIndex: z.number().int().nonnegative().optional() }).strict(),
    claimType: z.enum(["source_fact", "user_experience", "inference", "recommendation", "limitation"]),
    evidence: z.array(
      z
        .object({
          evidenceId: stableIdSchema,
          propositionSummary: z.string().min(1),
          propositionSha256: sha256Schema,
          interpretation: evidenceInterpretationSchema,
          sourceIds: z.array(stableIdSchema).min(1),
          freshnessChecked: z.boolean(),
        })
        .strict(),
    ),
    limitations: z.array(z.string()).optional(),
  })
  .strict();

export const compactCanonicalMediaSourceRefSchema = z
  .object({
    assetId: stableIdSchema,
    canonicalSha256: sha256Schema,
    format: z.enum(["webp", "svg"]),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    ingestProfileId: stableIdSchema,
    ingestProfileSha256: sha256Schema,
    storageClass: z.literal("private_canonical_media_v1"),
  })
  .strict();
export const compactAiRunRefSchema = z
  .object({
    role: z.enum([
      "source_discovery",
      "evidence",
      "author",
      "auditor",
      "reviser",
      "visual_planner",
      "visual_auditor",
      "image_generator",
    ]),
    provider: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    snapshot: z.string().min(1).optional(),
    skillId: stableIdSchema.optional(),
    skillSha256: sha256Schema.optional(),
    requestSha256: sha256Schema.optional(),
    responseSha256: sha256Schema.optional(),
    externalApiUsed: z.boolean(),
    externalDisclosurePolicyId: stableIdSchema.optional(),
    externalDisclosurePolicySha256: sha256Schema.optional(),
    externalDisclosureManifestSha256: sha256Schema.optional(),
    externalDisclosureModeSummary: z.enum(["none", "exact", "derived", "mixed"]).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.externalApiUsed) {
      for (const key of [
        "externalDisclosurePolicyId",
        "externalDisclosurePolicySha256",
        "externalDisclosureManifestSha256",
      ] as const) {
        if (!value[key]) context.addIssue({ code: "custom", message: `external run requires ${key}`, path: [key] });
      }
      if (!value.externalDisclosureModeSummary || value.externalDisclosureModeSummary === "none") {
        context.addIssue({ code: "custom", message: "external run requires external disclosure mode", path: ["externalDisclosureModeSummary"] });
      }
    } else if (value.externalDisclosureModeSummary && value.externalDisclosureModeSummary !== "none") {
      context.addIssue({ code: "custom", message: "local run disclosure mode must be none", path: ["externalDisclosureModeSummary"] });
    }
  });

export const publicationProvenanceRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    contentId: contentIdSchema,
    origin: z.enum(["article_job", "legacy_migration", "manual"]),
    content: z
      .object({ mdxSha256: sha256Schema, frontmatterSha256: sha256Schema, route: z.string().startsWith("/"), updateDiffSha256: sha256Schema.optional() })
      .strict(),
    articleJob: z
      .object({
        jobId: stableIdSchema,
        candidateSha256: sha256Schema,
        approvalRecordSha256: sha256Schema,
        sourceBundleSha256: sha256Schema,
        evidenceBundleSha256: sha256Schema,
        citationCompilationSha256: sha256Schema,
        technicalExampleVerificationSha256: sha256Schema,
        contentAuditSha256: sha256Schema,
        visualAuditSha256: sha256Schema.optional(),
        externalAiPolicyId: stableIdSchema,
        externalAiPolicySha256: sha256Schema,
        canonicalSourceStorageReceiptSetSha256: sha256Schema,
        mediaPublicationManifestSha256: sha256Schema,
        mediaProtectionReceiptSha256: sha256Schema,
      })
      .strict()
      .optional(),
    sourceRefs: z.array(compactSourceRefSchema),
    materialClaims: z.array(compactMaterialClaimBindingSchema),
    mediaSources: z.array(compactCanonicalMediaSourceRefSchema).optional(),
    mediaRecovery: compactMediaRecoveryBindingSchema.optional(),
    aiRuns: z.array(compactAiRunRefSchema).optional(),
    exampleVerification: z
      .object({ manifestSha256: sha256Schema, profileRegistrySha256: sha256Schema })
      .strict()
      .optional(),
    visualOrigins: z.array(z.enum(["camera", "screenshot", "diagram", "ai_generated", "deterministic_cover"])).optional(),
    exportedAt: isoDateTimeSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.origin === "article_job" && !value.articleJob) {
      context.addIssue({ code: "custom", message: "Article Job provenance requires Article Job lineage", path: ["articleJob"] });
    }
  });

export type PublicationProvenanceRecord = z.infer<typeof publicationProvenanceRecordSchema>;
export type CompactMaterialClaimBinding = z.infer<typeof compactMaterialClaimBindingSchema>;
