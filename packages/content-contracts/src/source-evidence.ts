import { z } from "zod";
import {
  httpsUrlSchema,
  isoDateSchema,
  isoDateTimeSchema,
  repositoryRelativePathSchema,
  sha256Schema,
  stableIdSchema,
} from "./common.js";

export const sourceLocatorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("web"), canonicalUrl: httpsUrlSchema }).strict(),
  z
    .object({
      kind: z.literal("github"),
      repository: z.string().regex(/^[^/\s]+\/[^/\s]+$/),
      commitSha: z.string().regex(/^[a-f0-9]{40}$/),
      path: repositoryRelativePathSchema.optional(),
      blobSha256: sha256Schema.optional(),
    })
    .strict(),
  z.object({ kind: z.literal("doi"), doi: z.string().min(1) }).strict(),
  z
    .object({
      kind: z.literal("repository"),
      path: repositoryRelativePathSchema,
      commitSha: z.string().regex(/^[a-f0-9]{40}$/),
      blobSha256: sha256Schema,
    })
    .strict(),
  z
    .object({ kind: z.literal("artifact"), artifactSha256: sha256Schema, publicDescription: z.string().min(1).optional() })
    .strict(),
]);

export const citationMetadataSchema = z
  .object({
    eligible: z.boolean(),
    title: z.string().min(1).optional(),
    publisher: z.string().min(1).optional(),
    canonicalUrl: httpsUrlSchema.optional(),
    publishedAt: isoDateSchema.optional(),
    retrievedAt: isoDateTimeSchema.optional(),
    repository: z.string().min(1).optional(),
    commitSha: z.string().regex(/^[a-f0-9]{40}$/).optional(),
    path: repositoryRelativePathSchema.optional(),
  })
  .strict();

export const sourceRecordSchema = z
  .object({
    sourceId: stableIdSchema,
    kind: z.enum([
      "official_doc",
      "standard",
      "paper",
      "web_page",
      "github_file",
      "github_commit",
      "github_release",
      "repository_doc",
      "user_note",
      "user_log",
      "local_image",
      "local_file",
    ]),
    locator: sourceLocatorSchema,
    title: z.string().min(1).optional(),
    publisher: z.string().min(1).optional(),
    publishedAt: isoDateSchema.optional(),
    retrievedAt: isoDateTimeSchema.optional(),
    snapshotSha256: sha256Schema.optional(),
    revision: z.string().min(1).optional(),
    trustClass: z.enum(["primary", "authoritative_secondary", "secondary", "user_supplied"]),
    freshness: z.enum(["stable", "time_sensitive"]),
    publicSafe: z.boolean(),
    citation: citationMetadataSchema,
    externalAiDisclosureRef: sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.citation.eligible && !value.publicSafe) {
      context.addIssue({ code: "custom", message: "citation eligibility requires publicSafe", path: ["citation", "eligible"] });
    }
  });

export const sourceRefSchema = z.object({ sourceId: stableIdSchema, sourceRecordSha256: sha256Schema }).strict();
export const evidenceInterpretationSchema = z.enum([
  "explicit",
  "direct_observation",
  "reasonable_inference",
  "user_experience",
  "recommendation_basis",
  "unknown",
]);
export const evidenceRecordSchema = z
  .object({
    evidenceId: stableIdSchema,
    proposition: z.string().min(1),
    sourceRefs: z.array(sourceRefSchema).min(1),
    interpretation: evidenceInterpretationSchema,
    confidence: z.enum(["high", "medium", "low", "not_available"]),
    freshnessChecked: z.boolean(),
    ambiguityIds: z.array(stableIdSchema),
  })
  .strict();
export const ambiguityRecordSchema = z
  .object({
    ambiguityId: stableIdSchema,
    subject: z.string().min(1),
    reason: z.string().min(1),
    candidateInterpretations: z.array(z.string().min(1)),
    resolution: z.enum(["unresolved", "resolved", "not_required"]),
    resolvedByEvidenceId: stableIdSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.resolution === "resolved" && !value.resolvedByEvidenceId) {
      context.addIssue({ code: "custom", message: "resolved ambiguity requires evidence", path: ["resolvedByEvidenceId"] });
    }
  });

export const articleClaimTypeSchema = z.enum([
  "source_fact",
  "user_experience",
  "inference",
  "recommendation",
  "transition",
  "limitation",
]);
export const articleClaimRecordSchema = z
  .object({
    claimId: stableIdSchema,
    draftSpan: z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive(), text: z.string() }).strict(),
    text: z.string().min(1),
    claimType: articleClaimTypeSchema,
    evidenceIds: z.array(stableIdSchema),
    confidence: z.enum(["high", "medium", "low"]),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.draftSpan.end <= value.draftSpan.start) {
      context.addIssue({ code: "custom", message: "draft span end must be greater than start", path: ["draftSpan", "end"] });
    }
    if (["source_fact", "user_experience", "inference"].includes(value.claimType) && value.evidenceIds.length === 0) {
      context.addIssue({ code: "custom", message: `${value.claimType} requires evidence`, path: ["evidenceIds"] });
    }
  });

export type SourceRecord = z.infer<typeof sourceRecordSchema>;
export type EvidenceRecord = z.infer<typeof evidenceRecordSchema>;
export type ArticleClaimRecord = z.infer<typeof articleClaimRecordSchema>;
