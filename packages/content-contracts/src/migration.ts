import { z } from "zod";
import { contentCollectionSchema, contentIdSchema, isoDateTimeSchema, repositoryRelativePathSchema, sha256Schema, stableIdSchema } from "./common.js";

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
    referencedMediaPaths: z.array(repositoryRelativePathSchema),
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
export const legacyMediaRecordSchema = z
  .object({
    legacyPath: repositoryRelativePathSchema,
    sourceFileSha256: sha256Schema,
    sizeBytes: z.number().int().nonnegative(),
    detectedFormat: z.string().min(1),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    referencedByContentIds: z.array(z.string().min(1)),
    likelyOrigin: z.enum(["wordpress", "project", "tool", "site_asset", "unknown"]),
  })
  .strict();
export const mediaMigrationRecordSchema = z
  .object({
    legacyPath: repositoryRelativePathSchema,
    disposition: z.enum(["r2_content_media", "git_site_asset", "regenerated", "retired"]),
    contentBindings: z
      .array(z.object({ contentId: contentIdSchema, semanticAssetId: stableIdSchema, role: z.string().min(1) }).strict())
      .optional(),
    publicObjectSha256: sha256Schema.optional(),
    publicObjectKey: z.string().min(1).optional(),
    rationale: z.string().min(1).optional(),
  })
  .strict();
export const migrationInventorySchema = z
  .object({
    schemaVersion: z.literal(1),
    snapshot: legacySnapshotIdentitySchema,
    content: z.array(legacyContentRecordSchema),
    contentMappings: z.array(contentMigrationRecordSchema),
    routes: z.array(legacyRouteRecordSchema),
    routeParity: z.array(routeParityRecordSchema),
    media: z.array(legacyMediaRecordSchema),
    mediaMappings: z.array(mediaMigrationRecordSchema),
  })
  .strict();

export type MigrationInventory = z.infer<typeof migrationInventorySchema>;
