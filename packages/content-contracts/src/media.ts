import { z } from "zod";
import {
  contentIdSchema,
  isoDateTimeSchema,
  repositoryRelativePathSchema,
  sha256Schema,
  stableIdSchema,
} from "./common.js";

const rasterFormatSchema = z.enum(["jpeg", "png", "webp", "avif"]);
const mediaFormatSchema = z.enum(["jpeg", "png", "webp", "avif", "svg"]);
const dimensionsShape = { width: z.number().int().positive().optional(), height: z.number().int().positive().optional() };

export const mediaIngestRequestSchema = z
  .object({
    schemaVersion: z.literal(1),
    sourcePath: z.string().min(1),
    target: z.object({ contentId: contentIdSchema, semanticAssetId: stableIdSchema }).strict(),
    kind: z.enum(["photo", "screenshot", "diagram"]),
    profileId: stableIdSchema,
    overwrite: z.literal(false),
  })
  .strict();
export const mediaIngestProfileSchema = z
  .object({
    id: stableIdSchema,
    kind: z.enum(["raster", "diagram_svg"]),
    raster: z
      .object({
        outputFormat: z.literal("webp"),
        lossless: z.literal(true),
        losslessCompressionLevel: z.number().int().min(0).max(9),
        maxLongEdge: z.number().int().positive(),
        upscale: z.literal(false),
        colorSpace: z.literal("srgb"),
        bitDepth: z.literal(8),
        alpha: z.literal("preserve_if_present"),
        orientation: z.literal("normalize_pixels"),
        privateMetadata: z.literal("strip"),
      })
      .strict()
      .optional(),
    svg: z
      .object({ sanitize: z.literal(true), allowScript: z.literal(false), allowExternalReferences: z.literal(false) })
      .strict()
      .optional(),
  })
  .strict();
export const mediaIngestResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    semanticAssetId: stableIdSchema,
    source: z
      .object({
        detectedFormat: z.string().min(1),
        sourceSha256: sha256Schema,
        ...dimensionsShape,
        orientationMetadataPresent: z.boolean().optional(),
      })
      .strict(),
    canonicalMaster: z
      .object({
        privateRelativePath: repositoryRelativePathSchema,
        sha256: sha256Schema,
        format: z.enum(["webp", "svg"]),
        ...dimensionsShape,
        sizeBytes: z.number().int().nonnegative(),
      })
      .strict(),
    processing: z
      .object({
        profileId: stableIdSchema,
        profileSha256: sha256Schema,
        toolchainId: stableIdSchema,
        toolchainSha256: sha256Schema,
        metadataStripped: z.boolean(),
        orientationApplied: z.boolean(),
        resized: z.boolean(),
        colorSpace: z.literal("srgb").optional(),
        bitDepth: z.literal(8).optional(),
      })
      .strict(),
    warnings: z.array(z.string()),
  })
  .strict();

export const mediaVariantProfileSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: stableIdSchema,
    usage: z.enum(["inline", "hero", "gallery", "overview", "social"]),
    widths: z.array(z.number().int().positive()),
    formats: z.array(
      z
        .object({
          format: rasterFormatSchema,
          qualityProfileId: stableIdSchema.optional(),
          lossless: z.boolean().optional(),
        })
        .strict(),
    ),
    preserveOriginalWhenSmaller: z.boolean(),
    upscale: z.literal(false),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.widths).size !== value.widths.length || !value.widths.every((width, index) => index === 0 || width > value.widths[index - 1]!)) {
      context.addIssue({ code: "custom", message: "widths must be unique and ascending", path: ["widths"] });
    }
  });
export const mediaVariantRecordSchema = z
  .object({
    sha256: sha256Schema,
    privateRelativePath: repositoryRelativePathSchema,
    format: rasterFormatSchema,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    sizeBytes: z.number().int().nonnegative(),
    contentType: z.string().min(1),
  })
  .strict();
export const mediaVariantManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    contentId: contentIdSchema,
    assetId: stableIdSchema,
    masterSha256: sha256Schema,
    profileId: stableIdSchema,
    profileSha256: sha256Schema,
    toolchainId: stableIdSchema,
    toolchainSha256: sha256Schema,
    status: z.enum(["generated", "not_required"]),
    variants: z.array(mediaVariantRecordSchema),
    warnings: z.array(z.string()),
    manifestSha256: sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "not_required" && value.variants.length !== 0) {
      context.addIssue({ code: "custom", message: "not_required manifest must be empty", path: ["variants"] });
    }
  });

export const mediaRightsRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    rightsId: stableIdSchema,
    basis: z.enum([
      "self_created",
      "ai_generated_authorized",
      "licensed",
      "public_domain",
      "permission_granted",
      "limited_excerpt",
      "unknown",
    ]),
    publicationAuthorized: z.boolean(),
    ownerOrSource: z.string().min(1).optional(),
    sourceUrl: z.url().optional(),
    licenseId: z.string().min(1).optional(),
    licenseUrl: z.url().optional(),
    attributionText: z.string().min(1).optional(),
    scope: z
      .object({
        commercialUse: z.union([z.boolean(), z.literal("unknown")]).optional(),
        modification: z.union([z.boolean(), z.literal("unknown")]).optional(),
        redistribution: z.union([z.boolean(), z.literal("unknown")]).optional(),
      })
      .strict()
      .optional(),
    confirmedBy: z.enum(["system_policy", "user", "migration_review"]),
    confirmedAt: isoDateTimeSchema,
    notes: z.array(z.string()).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.publicationAuthorized && value.basis === "unknown") {
      context.addIssue({ code: "custom", message: "unknown rights cannot authorize publication", path: ["basis"] });
    }
  });

export const canonicalMediaSourceRefSchema = z
  .object({
    storageClass: z.literal("private_canonical_media_v1"),
    sha256: sha256Schema,
    format: z.enum(["webp", "svg"]),
    ...dimensionsShape,
    sizeBytes: z.number().int().nonnegative(),
    ingestProfileId: stableIdSchema,
    ingestProfileSha256: sha256Schema,
  })
  .strict();
export const mediaObjectRefSchema = z
  .object({
    sha256: sha256Schema,
    objectKey: z.string().regex(/^media\/v1\/objects\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}\.(?:jpe?g|png|webp|avif|svg)$/),
    format: mediaFormatSchema,
    ...dimensionsShape,
    sizeBytes: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((value, context) => {
    const identity = /\/sha256\/([a-f0-9]{2})\/([a-f0-9]{64})\./u.exec(value.objectKey);
    if (!identity || identity[1] !== value.sha256.slice(0, 2) || identity[2] !== value.sha256) {
      context.addIssue({ code: "custom", message: "public object key must match the exact content SHA-256", path: ["objectKey"] });
    }
  });
export const mediaDeliverySetSchema = z
  .object({
    mode: z.enum(["fixed", "responsive"]),
    profileId: stableIdSchema.optional(),
    profileSha256: sha256Schema.optional(),
    master: mediaObjectRefSchema,
    variants: z.array(mediaObjectRefSchema.safeExtend({ width: z.number().int().positive(), height: z.number().int().positive() })),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.mode === "responsive" && (!value.profileId || !value.profileSha256)) {
      context.addIssue({ code: "custom", message: "responsive delivery requires profile identity", path: ["profileId"] });
    }
  });
export const mediaAssetRecordSchema = z
  .object({
    assetId: stableIdSchema,
    role: z.enum(["hero", "inline", "gallery", "overview", "social_card", "download"]),
    origin: z.enum(["camera", "screenshot", "diagram", "ai_generated", "deterministic_cover"]),
    canonicalSource: canonicalMediaSourceRefSchema.optional(),
    delivery: mediaDeliverySetSchema,
    defaultAlt: z.string().min(1).optional(),
    decorative: z.boolean().optional(),
    provenanceRef: stableIdSchema,
    rightsRef: stableIdSchema,
    visualAuditRef: stableIdSchema.optional(),
    status: z.enum(["active", "retired"]),
  })
  .strict();
export const contentMediaRegistrySchema = z
  .object({ schemaVersion: z.literal(1), contentId: contentIdSchema, assets: z.array(mediaAssetRecordSchema) })
  .strict()
  .superRefine((value, context) => {
    const ids = value.assets.map((asset) => asset.assetId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: "custom", message: "asset IDs must be unique within a ContentId", path: ["assets"] });
    }
  });

export const canonicalSourceStorageReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    candidateSha256: sha256Schema,
    contentId: contentIdSchema,
    assetId: stableIdSchema,
    canonicalSha256: sha256Schema,
    storageClass: z.literal("private_canonical_media_v1"),
    action: z.enum(["uploaded", "reused"]),
    verifiedSizeBytes: z.number().int().nonnegative(),
    storedAt: isoDateTimeSchema,
    receiptSha256: sha256Schema,
  })
  .strict();

const articleJobPublicationAuthorizationSchema = z
  .object({
    kind: z.literal("article_job"),
    jobId: stableIdSchema,
    candidateSha256: sha256Schema,
    humanApprovalRecordSha256: sha256Schema,
    canonicalSourceStorageReceiptSetSha256: sha256Schema,
    articleJobPublicMediaPermission: z.literal(true),
  })
  .strict();
const migrationPublicationAuthorizationSchema = z
  .object({
    kind: z.literal("migration"),
    migrationPlanSha256: sha256Schema,
    operatorAuthorizationRecordSha256: sha256Schema,
    canonicalSourceStorageReceiptSetSha256: sha256Schema,
  })
  .strict();
export const mediaPublicationAuthorizationSchema = z.discriminatedUnion("kind", [
  articleJobPublicationAuthorizationSchema,
  migrationPublicationAuthorizationSchema,
]);
export const mediaPublicationManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    authorization: mediaPublicationAuthorizationSchema,
    mediaSets: z.array(
      z
        .object({
          assetId: stableIdSchema,
          rightsRef: stableIdSchema,
          variantManifestSha256: sha256Schema,
          objects: z.array(
            z
              .object({
                purpose: z.enum(["master", "variant"]),
                sha256: sha256Schema,
                objectKey: z.string().min(1),
                format: mediaFormatSchema,
                width: z.number().int().positive().optional(),
                contentType: z.string().min(1),
                cacheControl: z.literal("public, max-age=31536000, immutable"),
                action: z.enum(["uploaded", "reused"]),
                verifiedSizeBytes: z.number().int().nonnegative(),
                verifiedAt: isoDateTimeSchema,
              })
              .strict(),
          ),
        })
        .strict(),
    ),
    completedAt: isoDateTimeSchema,
    manifestSha256: sha256Schema,
  })
  .strict();

export const mediaProtectionReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    candidateSha256: sha256Schema,
    approvalRecordSha256: sha256Schema,
    mediaPublicationManifestSha256: sha256Schema,
    protectionClass: z.literal("cloudflare_protected_copy_v1"),
    objects: z.array(
      z
        .object({
          sha256: sha256Schema,
          sourceObjectKey: z.string().min(1),
          verifiedSizeBytes: z.number().int().nonnegative(),
          protectedObjectRef: stableIdSchema,
          protectedAt: isoDateTimeSchema,
        })
        .strict(),
    ),
    policyFingerprint: sha256Schema,
    completedAt: isoDateTimeSchema,
    receiptSha256: sha256Schema,
  })
  .strict();

export const compactMediaRecoveryBindingSchema = z
  .object({
    protectionClass: z.literal("cloudflare_protected_copy_v1"),
    policyFingerprint: sha256Schema,
    mediaProtectionReceiptSha256: sha256Schema,
    objects: z.array(
      z
        .object({
          sha256: sha256Schema,
          publicObjectKey: z.string().min(1),
          verifiedSizeBytes: z.number().int().nonnegative(),
          protectedObjectRef: stableIdSchema,
        })
        .strict(),
    ),
  })
  .strict();

export type MediaIngestRequest = z.infer<typeof mediaIngestRequestSchema>;
export type MediaIngestResult = z.infer<typeof mediaIngestResultSchema>;
export type MediaVariantProfile = z.infer<typeof mediaVariantProfileSchema>;
export type MediaVariantManifest = z.infer<typeof mediaVariantManifestSchema>;
export type ContentMediaRegistry = z.infer<typeof contentMediaRegistrySchema>;
export type MediaRightsRecord = z.infer<typeof mediaRightsRecordSchema>;
export type CanonicalSourceStorageReceipt = z.infer<typeof canonicalSourceStorageReceiptSchema>;
export type MediaPublicationManifest = z.infer<typeof mediaPublicationManifestSchema>;
export type MediaProtectionReceipt = z.infer<typeof mediaProtectionReceiptSchema>;
export type CompactMediaRecoveryBinding = z.infer<typeof compactMediaRecoveryBindingSchema>;
