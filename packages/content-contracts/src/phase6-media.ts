import { z } from "zod";
import {
  contentIdSchema,
  repositoryRelativePathSchema,
  sha256Schema,
} from "./common.js";
import { legacyContentIdSchema, legacyLocatorSchema } from "./migration.js";
import { phase4LegacySourceIdentitySchema } from "./phase4-migration.js";

export const phase6MediaInventoryVersionSchema = z.literal("legacy-media-raw-v1");

export const phase6MediaReferenceKindSchema = z.enum([
  "frontmatter_hero_image",
  "frontmatter_og_image",
  "frontmatter_cover_image",
  "frontmatter_overview_image",
  "frontmatter_preview_image",
  "body_reference",
]);

export const phase6MediaRoleHintSchema = z.enum([
  "hero",
  "social_card",
  "overview",
  "inline",
  "unresolved",
]);

export const phase6MediaContentBindingSchema = z
  .object({
    legacyContentId: legacyContentIdSchema,
    vNextContentId: contentIdSchema,
    targetPath: repositoryRelativePathSchema,
    referenceKinds: z.array(phase6MediaReferenceKindSchema).min(1),
    roleHints: z.array(phase6MediaRoleHintSchema).min(1),
  })
  .strict();

const phase6MediaRecordBaseSchema = z.object({
  legacyLocator: legacyLocatorSchema,
  likelyOrigin: z.enum(["wordpress", "project", "tool", "site_asset", "unknown"]),
  referencedByLegacyContentIds: z.array(legacyContentIdSchema).min(1),
  contentBindings: z.array(phase6MediaContentBindingSchema).min(1),
  rightsReviewStatus: z.literal("pending_human_review"),
  publicationStatus: z.literal("blocked"),
  recordPayloadSha256: sha256Schema,
});

export const phase6GitVerifiedMediaRecordSchema = phase6MediaRecordBaseSchema
  .extend({
    verificationStatus: z.literal("git_verified"),
    sourceFileSha256: sha256Schema,
    sizeBytes: z.number().int().nonnegative(),
    detectedFormat: z.string().min(1),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  })
  .strict();

export const phase6UnresolvedMediaRecordSchema = phase6MediaRecordBaseSchema
  .extend({
    verificationStatus: z.literal("unresolved_non_local"),
    unresolvedReason: z.enum(["non_git_locator", "missing_git_object"]),
  })
  .strict();

export const phase6MediaRawRecordSchema = z.discriminatedUnion("verificationStatus", [
  phase6GitVerifiedMediaRecordSchema,
  phase6UnresolvedMediaRecordSchema,
]);

export const phase6MediaRawInventorySchema = z
  .object({
    schemaVersion: z.literal(1),
    inventoryVersion: phase6MediaInventoryVersionSchema,
    source: phase4LegacySourceIdentitySchema,
    phase4MaterializationManifestPayloadSha256: sha256Schema,
    legacyInventoryPayloadSha256: sha256Schema,
    sourceContentCount: z.number().int().nonnegative(),
    mediaPendingContentCount: z.number().int().nonnegative(),
    uniqueLocatorCount: z.number().int().nonnegative(),
    gitVerifiedLocatorCount: z.number().int().nonnegative(),
    unresolvedLocatorCount: z.number().int().nonnegative(),
    records: z.array(phase6MediaRawRecordSchema),
    manifestPayloadSha256: sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.records.length !== value.uniqueLocatorCount) {
      context.addIssue({ code: "custom", message: "uniqueLocatorCount must equal record count", path: ["uniqueLocatorCount"] });
    }
    const gitVerified = value.records.filter((record) => record.verificationStatus === "git_verified").length;
    const unresolved = value.records.filter((record) => record.verificationStatus === "unresolved_non_local").length;
    if (gitVerified !== value.gitVerifiedLocatorCount) {
      context.addIssue({ code: "custom", message: "gitVerifiedLocatorCount mismatch", path: ["gitVerifiedLocatorCount"] });
    }
    if (unresolved !== value.unresolvedLocatorCount) {
      context.addIssue({ code: "custom", message: "unresolvedLocatorCount mismatch", path: ["unresolvedLocatorCount"] });
    }
  });

export type Phase6MediaReferenceKind = z.infer<typeof phase6MediaReferenceKindSchema>;
export type Phase6MediaRoleHint = z.infer<typeof phase6MediaRoleHintSchema>;
export type Phase6MediaContentBinding = z.infer<typeof phase6MediaContentBindingSchema>;
export type Phase6MediaRawRecord = z.infer<typeof phase6MediaRawRecordSchema>;
export type Phase6MediaRawInventory = z.infer<typeof phase6MediaRawInventorySchema>;
