import { z } from "zod";
import { artifactRefSchema, contentIdSchema, sha256Schema, stableIdSchema } from "./common.js";

export const visualSourceRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("source_media"), sourceId: stableIdSchema, artifactSha256: sha256Schema }).strict(),
  z.object({ kind: z.literal("evidence"), evidenceId: stableIdSchema, evidenceRecordSha256: sha256Schema }).strict(),
  z.object({ kind: z.literal("claim"), claimId: stableIdSchema, claimRecordSha256: sha256Schema }).strict(),
]);

export const visualPlanSchema = z
  .object({
    visualId: stableIdSchema,
    role: z.enum(["hero", "inline", "gallery", "overview", "social_card"]),
    origin: z.enum(["source_media", "diagram", "ai_generated", "deterministic_cover"]),
    purpose: z.string().min(1),
    sourceRefs: z.array(visualSourceRefSchema),
    requiredFacts: z.array(z.string().min(1)),
    forbiddenImplications: z.array(z.string().min(1)),
    altIntent: z.string().min(1),
    decorative: z.boolean(),
    rightsRequired: z.literal(true),
  })
  .strict();

export const visualPlanSetSchema = z
  .object({
    schemaVersion: z.literal(1),
    contentId: contentIdSchema,
    articleSha256: sha256Schema,
    plans: z.array(visualPlanSchema),
    planSetSha256: sha256Schema,
  })
  .strict();

export const imageGenerationRequestSchema = z
  .object({
    schemaVersion: z.literal(1),
    requestId: stableIdSchema,
    jobId: stableIdSchema,
    visualId: stableIdSchema,
    executionProfileId: stableIdSchema,
    inputArtifacts: z.array(artifactRefSchema),
    promptArtifact: artifactRefSchema,
    externalAiDisclosureManifestSha256: sha256Schema,
    requestSha256: sha256Schema,
  })
  .strict();

export const generatedImageRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    requestSha256: sha256Schema,
    providerProfileId: stableIdSchema,
    provider: z.string().min(1),
    model: z.string().min(1),
    rawArtifactSha256: sha256Schema,
    generationMetadataSha256: sha256Schema,
    externalAiDisclosureManifestSha256: sha256Schema,
  })
  .strict();

export const visualAuditRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    visualId: stableIdSchema,
    candidateArtifactSha256: sha256Schema,
    independentContext: z.literal(true),
    checks: z
      .object({
        factualAlignment: z.enum(["pass", "fail", "not_applicable"]),
        forbiddenImplications: z.enum(["pass", "fail"]),
        rights: z.enum(["pass", "fail"]),
        accessibility: z.enum(["pass", "fail", "manual_required"]),
        quality: z.enum(["pass", "fail", "manual_required"]),
      })
      .strict(),
    findings: z.array(z.string()),
    outcome: z.enum(["approved", "revision_required", "blocked"]),
    auditSha256: sha256Schema,
  })
  .strict();

export type VisualPlanSet = z.infer<typeof visualPlanSetSchema>;
export type VisualAuditRecord = z.infer<typeof visualAuditRecordSchema>;
