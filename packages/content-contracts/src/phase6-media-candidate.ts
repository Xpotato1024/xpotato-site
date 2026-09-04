import { z } from "zod";
import {
  contentIdSchema,
  repositoryRelativePathSchema,
  sha256Schema,
  stableIdSchema,
} from "./common.js";
import { legacyContentIdSchema, legacyLocatorSchema } from "./migration.js";

export const phase6MediaRepositoryCandidateVersionSchema = z.literal("legacy-media-repository-candidate-v1");
export const phase6DeterministicMediaTemplateSchema = z.enum([
  "blog-hero-geometric-v1",
  "blog-social-card-source-v1",
  "conoha-ssh-key-flow-v1",
]);

export const phase6DeterministicSourceRecordSchema = z
  .object({
    legacyContentId: legacyContentIdSchema,
    contentId: contentIdSchema,
    assetId: stableIdSchema,
    role: z.enum(["hero", "inline", "social_card"]),
    templateId: phase6DeterministicMediaTemplateSchema,
    format: z.literal("svg"),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    sha256: sha256Schema,
    sizeBytes: z.number().int().positive(),
  })
  .strict();

export const phase6RightsBindingSchema = z
  .object({
    rightsId: stableIdSchema,
    contentId: contentIdSchema,
    assetId: stableIdSchema,
    basis: z.literal("self_created"),
    publicationAuthorized: z.literal(true),
    confirmedBy: z.literal("user"),
    confirmedAt: z.iso.datetime({ offset: true }),
    acceptedReviewPayloadSha256: sha256Schema,
  })
  .strict();

export const phase6MediaProvenanceRecordSchema = z
  .object({
    provenanceId: stableIdSchema,
    legacyContentId: legacyContentIdSchema,
    contentId: contentIdSchema,
    assetId: stableIdSchema,
    origin: z.enum(["legacy_git", "legacy_nonlocal_recovery", "deterministic_generator"]),
    legacyLocator: legacyLocatorSchema.optional(),
    repositoryPath: repositoryRelativePathSchema.optional(),
    sourceSha256: sha256Schema.optional(),
    deterministicSourceSha256: sha256Schema.optional(),
    templateId: phase6DeterministicMediaTemplateSchema.optional(),
    status: z.enum(["source_verified", "source_recovery_required", "deterministic_regenerable"]),
    provenancePayloadSha256: sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.origin === "legacy_git") {
      if (!value.legacyLocator || !value.repositoryPath || !value.sourceSha256 || value.status !== "source_verified") {
        context.addIssue({ code: "custom", message: "legacy_git provenance requires exact locator/path/SHA and source_verified", path: [] });
      }
    }
    if (value.origin === "legacy_nonlocal_recovery") {
      if (!value.legacyLocator || value.sourceSha256 || value.status !== "source_recovery_required") {
        context.addIssue({ code: "custom", message: "legacy_nonlocal_recovery must retain locator without fabricating source SHA", path: [] });
      }
    }
    if (value.origin === "deterministic_generator") {
      if (!value.deterministicSourceSha256 || !value.templateId || value.status !== "deterministic_regenerable") {
        context.addIssue({ code: "custom", message: "deterministic provenance requires source SHA/template and deterministic_regenerable", path: [] });
      }
      if (value.legacyLocator || value.repositoryPath || value.sourceSha256) {
        context.addIssue({ code: "custom", message: "deterministic replacement must not claim legacy byte provenance", path: [] });
      }
    }
  });

export const phase6MediaProcessingPlanRecordSchema = z
  .object({
    legacyContentId: legacyContentIdSchema,
    contentId: contentIdSchema,
    assetId: stableIdSchema,
    role: z.enum(["hero", "inline", "overview", "social_card"]),
    sourceClass: z.enum(["svg", "raster", "nonlocal"]),
    sourceStatus: z.enum(["ready", "recovery_required"]),
    canonicalAction: z.enum(["sanitize_svg", "raster_ingest", "recover_then_raster_ingest"]),
    deliveryAction: z.enum(["fixed_svg", "responsive_variants", "social_card_png"]),
    ingestProfileId: stableIdSchema,
    variantProfileId: stableIdSchema.optional(),
    blockers: z.array(z.enum(["raster_encoder_toolchain", "nonlocal_source_recovery", "social_card_rasterizer"])),
  })
  .strict();

export const phase6MediaRepositoryCandidateManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    candidateVersion: phase6MediaRepositoryCandidateVersionSchema,
    acceptedReviewPayloadSha256: sha256Schema,
    rawInventoryManifestPayloadSha256: sha256Schema,
    reviewAcceptanceRecordPath: repositoryRelativePathSchema,
    deterministicSources: z.array(phase6DeterministicSourceRecordSchema),
    rightsBindings: z.array(phase6RightsBindingSchema),
    provenance: z.array(phase6MediaProvenanceRecordSchema),
    processingPlan: z.array(phase6MediaProcessingPlanRecordSchema),
    persistentMutationAuthorized: z.literal(false),
    manifestPayloadSha256: sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    const semanticKey = (item: { contentId: string; assetId: string }): string => `${item.contentId}\0${item.assetId}`;
    for (const [label, values] of [
      ["rights", value.rightsBindings.map(semanticKey)],
      ["provenance", value.provenance.map(semanticKey)],
      ["processing", value.processingPlan.map(semanticKey)],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: "custom", message: `${label} semantic asset bindings must be unique`, path: [] });
      }
    }
    const rights = new Set(value.rightsBindings.map(semanticKey));
    const provenance = new Set(value.provenance.map(semanticKey));
    const processing = new Set(value.processingPlan.map(semanticKey));
    if (rights.size !== provenance.size || rights.size !== processing.size || [...rights].some((key) => !provenance.has(key) || !processing.has(key))) {
      context.addIssue({ code: "custom", message: "rights/provenance/processing semantic asset sets must be identical", path: [] });
    }
    const deterministic = new Set(value.deterministicSources.map(semanticKey));
    for (const record of value.provenance.filter((item) => item.origin === "deterministic_generator")) {
      if (!deterministic.has(semanticKey(record))) {
        context.addIssue({ code: "custom", message: "deterministic provenance must resolve a deterministic source record", path: ["deterministicSources"] });
      }
    }
  });

export type Phase6DeterministicSourceRecord = z.infer<typeof phase6DeterministicSourceRecordSchema>;
export type Phase6RightsBinding = z.infer<typeof phase6RightsBindingSchema>;
export type Phase6MediaProvenanceRecord = z.infer<typeof phase6MediaProvenanceRecordSchema>;
export type Phase6MediaProcessingPlanRecord = z.infer<typeof phase6MediaProcessingPlanRecordSchema>;
export type Phase6MediaRepositoryCandidateManifest = z.infer<typeof phase6MediaRepositoryCandidateManifestSchema>;
