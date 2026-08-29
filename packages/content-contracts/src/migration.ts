import { z } from "zod";
import { contentCollectionSchema, contentIdSchema, isoDateTimeSchema, repositoryRelativePathSchema, sha256Schema, stableIdSchema } from "./common.js";

export const legacyLocatorSchema = z.string().min(1).refine((value) => !value.includes("\0"), "NUL is forbidden");
export const legacyContentIdSchema = z
  .string()
  .regex(/^(?:blog|notes|projects|tools|pages):[^:\0]+(?:\/[^:\0]+)*$/u, "deterministic legacy content ID required");

export const legacySnapshotIdentitySchema = z
  .object({
    repository: z.string().min(1),
    commitSha: z.string().regex(/^[a-f0-9]{40}$/),
    tag: z.string().min(1).optional(),
    generatedAt: isoDateTimeSchema,
    generatorVersion: z.string().min(1),
  })
  .strict();
export const legacyContentRecordSchema = z
  .object({
    collection: contentCollectionSchema,
    legacyPath: repositoryRelativePathSchema,
    legacyContentId: z.string().min(1),
    title: z.string().min(1),
    draft: z.boolean(),
    bodySha256: sha256Schema,
    frontmatterSha256: sha256Schema,
    referencedMediaPaths: z.array(legacyLocatorSchema),
    referencedInteractiveComponents: z.array(repositoryRelativePathSchema),
  })
  .strict();
export const contentMigrationRecordSchema = z
  .object({
    legacyContentId: z.string().min(1),
    disposition: z.enum(["migrate", "merge", "retire"]),
    vNextContentId: contentIdSchema.optional(),
    rationale: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (["merge", "retire"].includes(value.disposition) && !value.rationale) {
      context.addIssue({ code: "custom", message: "merge/retire requires rationale", path: ["rationale"] });
    }
  });
export const legacyRouteRecordSchema = z
  .object({
    urlPath: z.string().startsWith("/"),
    sourceKind: z.enum(["content", "static_page", "redirect", "generated_archive", "tool"]),
    statusCode: z.number().int().optional(),
    target: z.string().optional(),
  })
  .strict();
export const routeParityRecordSchema = z
  .object({
    legacyPath: z.string().startsWith("/"),
    disposition: z.enum(["same", "redirect", "retired", "provider_redirect"]),
    vNextPath: z.string().startsWith("/").optional(),
    reason: z.string().min(1).optional(),
  })
  .strict();
export const verifiedLegacyMediaRecordSchema = z
  .object({
    verificationStatus: z.literal("git_verified"),
    legacyPath: legacyLocatorSchema,
    sourceFileSha256: sha256Schema,
    sizeBytes: z.number().int().nonnegative(),
    detectedFormat: z.string().min(1),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    referencedByContentIds: z.array(z.string().min(1)),
    likelyOrigin: z.enum(["wordpress", "project", "tool", "site_asset", "unknown"]),
  })
  .strict();
export const unresolvedLegacyMediaRecordSchema = z
  .object({
    verificationStatus: z.literal("unresolved_non_local"),
    legacyPath: legacyLocatorSchema,
    referencedByContentIds: z.array(legacyContentIdSchema),
    likelyOrigin: z.enum(["wordpress", "project", "tool", "site_asset", "unknown"]),
    reason: z.enum(["non_git_locator", "missing_git_object"]),
  })
  .strict();
export const legacyMediaRecordSchema = z.discriminatedUnion("verificationStatus", [
  verifiedLegacyMediaRecordSchema,
  unresolvedLegacyMediaRecordSchema,
]);
export const mediaMigrationRecordSchema = z
  .object({
    legacyPath: legacyLocatorSchema,
    disposition: z.enum(["r2_content_media", "git_site_asset", "regenerated", "retired"]),
    contentBindings: z
      .array(z.object({ contentId: contentIdSchema, semanticAssetId: stableIdSchema, role: z.string().min(1) }).strict())
      .optional(),
    publicObjectSha256: sha256Schema.optional(),
    publicObjectKey: z.string().min(1).optional(),
    rationale: z.string().min(1).optional(),
  })
  .strict();

export const legacyTaxonomyRecordSchema = z
  .object({
    namespace: z.string().min(1),
    rawValue: z.string().min(1),
    normalizedValue: z.string().min(1),
    usageCount: z.number().int().nonnegative(),
    contentIds: z.array(legacyContentIdSchema),
  })
  .strict();

export const legacyInteractiveRecordSchema = z
  .object({
    componentPath: repositoryRelativePathSchema,
    usedByContentIds: z.array(legacyContentIdSchema),
    framework: z.string().min(1),
    hydrationDirective: z.string().min(1).optional(),
    disposition: z.enum(["registry_module", "rewrite", "retire"]).optional(),
    vNextModuleId: stableIdSchema.optional(),
  })
  .strict();

const staticLegacyHtmlRecordSchema = z
  .object({
    contentId: legacyContentIdSchema,
    extractionStatus: z.literal("static"),
    rawHtmlSha256: sha256Schema,
    disposition: z.enum(["convert_mdx", "manual_review", "retire"]),
  })
  .strict();
const blockedLegacyHtmlRecordSchema = z
  .object({
    contentId: legacyContentIdSchema,
    extractionStatus: z.literal("blocked"),
    blocker: z.string().min(1),
    disposition: z.literal("manual_review"),
  })
  .strict();
export const legacyHtmlRecordSchema = z.discriminatedUnion("extractionStatus", [
  staticLegacyHtmlRecordSchema,
  blockedLegacyHtmlRecordSchema,
]);

export const migrationInventorySchema = z
  .object({
    schemaVersion: z.literal(1),
    hashRuleVersion: z.literal("legacy-source-bytes-v1"),
    snapshot: legacySnapshotIdentitySchema,
    content: z.array(legacyContentRecordSchema),
    contentMappings: z.array(contentMigrationRecordSchema),
    routes: z.array(legacyRouteRecordSchema),
    routeParity: z.array(routeParityRecordSchema),
    media: z.array(legacyMediaRecordSchema),
    mediaMappings: z.array(mediaMigrationRecordSchema),
    taxonomy: z.array(legacyTaxonomyRecordSchema),
    interactive: z.array(legacyInteractiveRecordSchema),
    legacyHtml: z.array(legacyHtmlRecordSchema),
    inventoryPayloadSha256: sha256Schema,
  })
  .strict();

const collectionCountsSchema = z
  .object({
    blog: z.number().int().nonnegative(),
    projects: z.number().int().nonnegative(),
    notes: z.number().int().nonnegative(),
    tools: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative(),
  })
  .strict();

const legacyBuildIdentitySchema = z.object({
  nodeVersion: z.string().min(1),
  npmVersion: z.string().min(1),
  packageLockBlobSha: z.string().regex(/^[a-f0-9]{40}$/u),
  endpointPathsSha256: sha256Schema,
  nonHtmlManifestSha256: sha256Schema,
  fileCount: z.number().int().nonnegative(),
  equivalenceProfileId: z.literal("legacy-build-equivalence-v1"),
});

const legacyBuildBaselineSchema = z.discriminatedUnion("status", [
  legacyBuildIdentitySchema
    .extend({
      status: z.literal("PASS"),
      rawByteIdentical: z.boolean(),
      equivalenceVerified: z.literal(true),
      observedRawDistManifestSha256: z.array(sha256Schema).min(2),
      differingHtmlArtifactCount: z.number().int().nonnegative(),
      permittedTiePermutationCount: z.number().int().nonnegative(),
      permittedGeneratedMetadataVarianceCount: z.number().int().nonnegative(),
    })
    .strict(),
  legacyBuildIdentitySchema
    .extend({
      status: z.literal("FAIL"),
      equivalenceVerified: z.literal(false),
      observedRawDistManifestSha256: z.array(sha256Schema).optional(),
      differingArtifactCount: z.number().int().nonnegative(),
      failureCode: z.string().min(1),
    })
    .strict(),
]);

export const legacyFreezeBaselineSchema = z
  .object({
    schemaVersion: z.literal(2),
    repository: z.string().min(1),
    tag: z.string().min(1),
    tagObjectSha: z.string().regex(/^[a-f0-9]{40}$/u),
    commitSha: z.string().regex(/^[a-f0-9]{40}$/u),
    generatorVersion: z.string().min(1),
    hashRuleVersion: z.literal("legacy-source-bytes-v1"),
    inventoryPayloadSha256: sha256Schema,
    publishedContentCounts: collectionCountsSchema,
    totalContentCounts: collectionCountsSchema,
    totalContentCount: z.number().int().nonnegative(),
    routeCount: z.number().int().nonnegative(),
    wordpressQueryIdentityCount: z.number().int().nonnegative(),
    gitMediaCount: z.number().int().nonnegative(),
    gitMediaBytes: z.number().int().nonnegative(),
    taxonomyRecordCount: z.number().int().nonnegative(),
    interactiveRecordCount: z.number().int().nonnegative(),
    legacyHtmlRecordCount: z.number().int().nonnegative(),
    unresolvedMediaReferenceCount: z.number().int().nonnegative(),
    designTimeBaseline: z
      .object({
        publishedContentCounts: collectionCountsSchema,
        gitMediaBytes: z.number().int().nonnegative(),
        wordpressQueryIdentityCount: z.number().int().nonnegative(),
        interactiveRecordCount: z.number().int().nonnegative(),
      })
      .strict(),
    legacyBuild: legacyBuildBaselineSchema,
  })
  .strict();

export type LegacySnapshotIdentity = z.infer<typeof legacySnapshotIdentitySchema>;
export type LegacyContentRecord = z.infer<typeof legacyContentRecordSchema>;
export type LegacyMediaRecord = z.infer<typeof legacyMediaRecordSchema>;
export type LegacyTaxonomyRecord = z.infer<typeof legacyTaxonomyRecordSchema>;
export type LegacyInteractiveRecord = z.infer<typeof legacyInteractiveRecordSchema>;
export type LegacyHtmlRecord = z.infer<typeof legacyHtmlRecordSchema>;
export type MigrationInventory = z.infer<typeof migrationInventorySchema>;
export type LegacyFreezeBaseline = z.infer<typeof legacyFreezeBaselineSchema>;
