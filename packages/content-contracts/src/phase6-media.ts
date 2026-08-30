import { z } from "zod";
import {
  contentIdSchema,
  repositoryRelativePathSchema,
  sha256Schema,
  stableIdSchema,
} from "./common.js";
import { legacyContentIdSchema, legacyLocatorSchema } from "./migration.js";
import { phase4LegacySourceIdentitySchema } from "./phase4-migration.js";

export const phase6MediaInventoryVersionSchema = z.literal("legacy-media-raw-v1");
export const phase6MediaReviewVersionSchema = z.literal("legacy-media-review-proposal-v1");

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
    repositoryPath: repositoryRelativePathSchema,
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

export const phase6MediaReviewDispositionSchema = z.enum([
  "migrate_existing",
  "recover_nonlocal_source",
  "replace_with_deterministic_cover",
]);
export const phase6MediaKindCandidateSchema = z.enum(["photo", "screenshot", "diagram", "deterministic_cover"]);
export const phase6RightsBasisCandidateSchema = z.enum(["self_created", "limited_excerpt", "unknown"]);

export const phase6MediaAssetPlanSchema = z
  .object({
    legacyContentId: legacyContentIdSchema,
    contentId: contentIdSchema,
    assetId: stableIdSchema,
    role: z.enum(["hero", "inline", "overview", "social_card"]),
    alsoUsedInline: z.boolean().optional(),
    sourceAction: z.enum(["ingest_git_object", "recover_nonlocal_source", "generate_deterministic"]),
    ingestProfileId: stableIdSchema.optional(),
    variantProfileId: stableIdSchema.optional(),
  })
  .strict();

export const phase6MediaReviewDecisionSchema = z
  .object({
    legacyLocator: legacyLocatorSchema,
    disposition: phase6MediaReviewDispositionSchema,
    mediaKindCandidate: phase6MediaKindCandidateSchema,
    rightsBasisCandidate: phase6RightsBasisCandidateSchema,
    rightsReviewStatus: z.literal("pending_human_review"),
    publicationAuthorized: z.literal(false),
    assetPlans: z.array(phase6MediaAssetPlanSchema).min(1),
    rationale: z.enum([
      "verified_svg_content_asset",
      "project_overview_candidate",
      "legacy_photo_candidate",
      "third_party_ui_screenshot_candidate",
      "missing_generic_placeholder",
      "nonlocal_legacy_hero_source",
    ]),
    decisionPayloadSha256: sha256Schema,
  })
  .strict();

export const phase6BlogPublicationPlanSchema = z
  .object({
    legacyContentId: legacyContentIdSchema,
    contentId: contentIdSchema,
    targetPath: repositoryRelativePathSchema,
    hero: z
      .object({
        assetId: z.literal("hero"),
        origin: z.enum(["legacy_media", "deterministic_cover"]),
        sourceLocator: legacyLocatorSchema.optional(),
      })
      .strict(),
    socialCard: z
      .object({
        assetId: z.literal("social-card"),
        origin: z.literal("deterministic_cover"),
        variantProfileId: z.literal("social-card-v1"),
      })
      .strict(),
    reviewStatus: z.literal("pending_human_review"),
    publicationStatus: z.literal("blocked"),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.hero.origin === "legacy_media" && !value.hero.sourceLocator) {
      context.addIssue({ code: "custom", message: "legacy_media hero requires sourceLocator", path: ["hero", "sourceLocator"] });
    }
    if (value.hero.origin === "deterministic_cover" && value.hero.sourceLocator) {
      context.addIssue({ code: "custom", message: "deterministic hero must not retain a legacy source locator", path: ["hero", "sourceLocator"] });
    }
  });

export const phase6MediaReviewProposalSchema = z
  .object({
    schemaVersion: z.literal(1),
    reviewVersion: phase6MediaReviewVersionSchema,
    rawInventoryManifestPayloadSha256: sha256Schema,
    decisions: z.array(phase6MediaReviewDecisionSchema),
    blogPublicationPlans: z.array(phase6BlogPublicationPlanSchema),
    reviewStatus: z.literal("pending_operator_acceptance"),
    persistentMutationAuthorized: z.literal(false),
    reviewPayloadSha256: sha256Schema,
  })
  .strict();

export type Phase6MediaReferenceKind = z.infer<typeof phase6MediaReferenceKindSchema>;
export type Phase6MediaRoleHint = z.infer<typeof phase6MediaRoleHintSchema>;
export type Phase6MediaContentBinding = z.infer<typeof phase6MediaContentBindingSchema>;
export type Phase6MediaRawRecord = z.infer<typeof phase6MediaRawRecordSchema>;
export type Phase6MediaRawInventory = z.infer<typeof phase6MediaRawInventorySchema>;
export type Phase6MediaAssetPlan = z.infer<typeof phase6MediaAssetPlanSchema>;
export type Phase6MediaReviewDecision = z.infer<typeof phase6MediaReviewDecisionSchema>;
export type Phase6BlogPublicationPlan = z.infer<typeof phase6BlogPublicationPlanSchema>;
export type Phase6MediaReviewProposal = z.infer<typeof phase6MediaReviewProposalSchema>;
