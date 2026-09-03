import { z } from "zod";
import { contentIdSchema, repositoryRelativePathSchema, sha256Schema, stableIdSchema } from "./common.js";
import { legacyContentIdSchema } from "./migration.js";

export const phase6MediaLocalProcessingVersionSchema = z.literal("legacy-media-local-processing-v1");

export const phase6LocalProcessedObjectSchema = z
  .object({
    sha256: sha256Schema,
    artifactRelativePath: repositoryRelativePathSchema,
    format: z.enum(["jpeg", "png", "webp", "avif", "svg"]),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    sizeBytes: z.number().int().nonnegative(),
    contentType: z.string().min(1),
  })
  .strict();

const phase6LocalProcessingRecordBaseSchema = z.object({
  legacyContentId: legacyContentIdSchema,
  contentId: contentIdSchema,
  assetId: stableIdSchema,
  role: z.enum(["hero", "inline", "overview", "social_card"]),
  ingestProfileId: stableIdSchema,
});

export const phase6LocalProcessedMediaRecordSchema = phase6LocalProcessingRecordBaseSchema
  .extend({
    status: z.literal("processed"),
    sourceSha256: sha256Schema,
    canonical: phase6LocalProcessedObjectSchema,
    deliveryMaster: phase6LocalProcessedObjectSchema,
    variantProfileId: stableIdSchema.optional(),
    variantManifestSha256: sha256Schema.optional(),
    variants: z.array(phase6LocalProcessedObjectSchema),
    blockers: z.array(z.never()).length(0),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.variantProfileId && !value.variantManifestSha256 && value.variants.length > 0) {
      context.addIssue({ code: "custom", message: "generated variants require a manifest SHA", path: ["variantManifestSha256"] });
    }
  });

export const phase6LocalDeferredMediaRecordSchema = phase6LocalProcessingRecordBaseSchema
  .extend({
    status: z.literal("deferred_nonlocal"),
    blockers: z.tuple([z.literal("nonlocal_source_recovery")]),
  })
  .strict();

export const phase6LocalMediaProcessingRecordSchema = z.discriminatedUnion("status", [
  phase6LocalProcessedMediaRecordSchema,
  phase6LocalDeferredMediaRecordSchema,
]);

export const phase6MediaLocalProcessingManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    processingVersion: phase6MediaLocalProcessingVersionSchema,
    repositoryCandidateManifestPayloadSha256: sha256Schema,
    toolchainId: z.literal("media-toolchain-v1"),
    toolchainSha256: sha256Schema,
    semanticAssetCount: z.number().int().nonnegative(),
    processedAssetCount: z.number().int().nonnegative(),
    deferredAssetCount: z.number().int().nonnegative(),
    records: z.array(phase6LocalMediaProcessingRecordSchema),
    persistentMutationAuthorized: z.literal(false),
    manifestPayloadSha256: sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.records.length !== value.semanticAssetCount) {
      context.addIssue({ code: "custom", message: "semanticAssetCount must equal record count", path: ["semanticAssetCount"] });
    }
    const processed = value.records.filter((record) => record.status === "processed").length;
    const deferred = value.records.filter((record) => record.status === "deferred_nonlocal").length;
    if (processed !== value.processedAssetCount) {
      context.addIssue({ code: "custom", message: "processedAssetCount mismatch", path: ["processedAssetCount"] });
    }
    if (deferred !== value.deferredAssetCount) {
      context.addIssue({ code: "custom", message: "deferredAssetCount mismatch", path: ["deferredAssetCount"] });
    }
    const keys = value.records.map((record) => `${record.contentId}\0${record.assetId}`);
    if (new Set(keys).size !== keys.length) {
      context.addIssue({ code: "custom", message: "local processing semantic asset keys must be unique", path: ["records"] });
    }
  });

export type Phase6LocalProcessedObject = z.infer<typeof phase6LocalProcessedObjectSchema>;
export type Phase6LocalMediaProcessingRecord = z.infer<typeof phase6LocalMediaProcessingRecordSchema>;
export type Phase6MediaLocalProcessingManifest = z.infer<typeof phase6MediaLocalProcessingManifestSchema>;
