import { z } from "zod";
import { repositoryRelativePathSchema, sha256Schema, stableIdSchema } from "./common.js";
import { tagRecordSchema } from "./content.js";
import { legacyContentIdSchema } from "./migration.js";
import { phase4LegacySourceIdentitySchema } from "./phase4-migration.js";

export const phase5TaxonomyInventoryVersionSchema = z.literal("legacy-taxonomy-raw-v1");
export const phase5TaxonomyReviewVersionSchema = z.literal("legacy-taxonomy-review-v1");
export const phase5TaxonomyMaterializationVersionSchema = z.literal("legacy-taxonomy-materialization-v1");

export const phase5TaxonomyNamespaceSchema = z.enum([
  "blog_category",
  "note_subject",
  "tool_category",
  "tag",
]);

export const phase5TaxonomyUsageKindSchema = z.enum([
  "blog_category",
  "blog_tag",
  "note_subject",
  "note_tag",
  "project_tag",
  "project_technology",
  "tool_category",
  "tool_tag",
]);

const uniqueLegacyContentIdsSchema = z.array(legacyContentIdSchema).min(1).superRefine((values, context) => {
  if (new Set(values).size !== values.length) {
    context.addIssue({ code: "custom", message: "affectedLegacyContentIds must be unique" });
  }
});
const uniqueStableIdsSchema = z.array(stableIdSchema).superRefine((values, context) => {
  if (new Set(values).size !== values.length) context.addIssue({ code: "custom", message: "stable IDs must be unique" });
});
const uniqueStringsSchema = z.array(z.string().min(1)).superRefine((values, context) => {
  if (new Set(values).size !== values.length) context.addIssue({ code: "custom", message: "values must be unique" });
});

export const phase5TaxonomyRawUsageSchema = z
  .object({
    kind: phase5TaxonomyUsageKindSchema,
    occurrenceCount: z.number().int().positive(),
    affectedLegacyContentIds: uniqueLegacyContentIdsSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.occurrenceCount < value.affectedLegacyContentIds.length) {
      context.addIssue({ code: "custom", message: "occurrenceCount cannot be smaller than the number of affected content IDs", path: ["occurrenceCount"] });
    }
  });

export const phase5TaxonomyRawTermSchema = z
  .object({
    namespace: phase5TaxonomyNamespaceSchema,
    rawValue: z.string().min(1),
    normalizedValue: z.string().min(1),
    occurrenceCount: z.number().int().positive(),
    usages: z.array(phase5TaxonomyRawUsageSchema).min(1),
    affectedLegacyContentIds: uniqueLegacyContentIdsSchema,
    requiresTechnologyKind: z.boolean(),
    termPayloadSha256: sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    const allowedUsageKinds = value.namespace === "blog_category"
      ? new Set(["blog_category"])
      : value.namespace === "note_subject"
        ? new Set(["note_subject"])
        : value.namespace === "tool_category"
          ? new Set(["tool_category"])
          : new Set(["blog_tag", "note_tag", "project_tag", "project_technology", "tool_tag"]);
    for (const [index, usage] of value.usages.entries()) {
      if (!allowedUsageKinds.has(usage.kind)) context.addIssue({ code: "custom", message: `usage ${usage.kind} is invalid for namespace ${value.namespace}`, path: ["usages", index, "kind"] });
    }
    const usageKinds = value.usages.map((usage) => usage.kind);
    if (new Set(usageKinds).size !== usageKinds.length) context.addIssue({ code: "custom", message: "usage kinds must be unique", path: ["usages"] });
    const occurrenceCount = value.usages.reduce((sum, usage) => sum + usage.occurrenceCount, 0);
    if (occurrenceCount !== value.occurrenceCount) context.addIssue({ code: "custom", message: "term occurrenceCount must equal the usage occurrence sum", path: ["occurrenceCount"] });
    const affected = [...new Set(value.usages.flatMap((usage) => usage.affectedLegacyContentIds))].sort();
    if (affected.join("\0") !== [...value.affectedLegacyContentIds].sort().join("\0")) context.addIssue({ code: "custom", message: "term affectedLegacyContentIds must equal the usage union", path: ["affectedLegacyContentIds"] });
    const requiresTechnologyKind = value.usages.some((usage) => usage.kind === "project_technology");
    if (requiresTechnologyKind !== value.requiresTechnologyKind) context.addIssue({ code: "custom", message: "requiresTechnologyKind must reflect project_technology usage", path: ["requiresTechnologyKind"] });
  });

export const phase5TaxonomyRawInventorySchema = z
  .object({
    schemaVersion: z.literal(1),
    inventoryVersion: phase5TaxonomyInventoryVersionSchema,
    source: phase4LegacySourceIdentitySchema,
    mappingPayloadSha256: sha256Schema,
    candidateManifestPayloadSha256: sha256Schema,
    materializationManifestPayloadSha256: sha256Schema,
    sourceCandidateCount: z.number().int().positive(),
    taxonomyPendingContentCount: z.number().int().nonnegative(),
    rawTermOccurrenceCount: z.number().int().nonnegative(),
    uniqueRawTermCount: z.number().int().nonnegative(),
    terms: z.array(phase5TaxonomyRawTermSchema),
    manifestPayloadSha256: sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.uniqueRawTermCount !== value.terms.length) context.addIssue({ code: "custom", message: "uniqueRawTermCount must equal terms.length", path: ["uniqueRawTermCount"] });
    const occurrenceCount = value.terms.reduce((sum, term) => sum + term.occurrenceCount, 0);
    if (occurrenceCount !== value.rawTermOccurrenceCount) context.addIssue({ code: "custom", message: "rawTermOccurrenceCount must equal the term occurrence sum", path: ["rawTermOccurrenceCount"] });
    const identities = value.terms.map((term) => `${term.namespace}\0${term.rawValue}`);
    if (new Set(identities).size !== identities.length) context.addIssue({ code: "custom", message: "raw term namespace/value identities must be unique", path: ["terms"] });
  });

export const phase5TaxonomyDispositionSchema = z.enum(["active", "alias", "merge", "retire"]);
export const phase5TaxonomyDecisionRationaleSchema = z.enum([
  "canonical", "spelling_variant", "semantic_merge", "category_repartition", "typo", "one_off", "redundant_metadata",
]);

export const phase5TaxonomyReviewDecisionSchema = z
  .object({
    namespace: phase5TaxonomyNamespaceSchema,
    rawValue: z.string().min(1),
    disposition: phase5TaxonomyDispositionSchema,
    targetId: stableIdSchema.optional(),
    supplementalTagIds: uniqueStableIdsSchema,
    rationale: phase5TaxonomyDecisionRationaleSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.disposition === "retire") {
      if (value.targetId) context.addIssue({ code: "custom", message: "retired raw term must not have targetId", path: ["targetId"] });
      if (value.supplementalTagIds.length > 0) context.addIssue({ code: "custom", message: "retired raw term must not add supplemental tags", path: ["supplementalTagIds"] });
    } else if (!value.targetId) context.addIssue({ code: "custom", message: "non-retired raw term requires targetId", path: ["targetId"] });
    if (value.namespace !== "blog_category" && value.supplementalTagIds.length > 0) context.addIssue({ code: "custom", message: "supplemental tags are only valid for Blog category migration", path: ["supplementalTagIds"] });
  });

export const phase5TaxonomyReviewManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    reviewVersion: phase5TaxonomyReviewVersionSchema,
    rawInventoryManifestPayloadSha256: sha256Schema,
    decisions: z.array(phase5TaxonomyReviewDecisionSchema),
    canonicalTags: z.array(tagRecordSchema),
    reviewPayloadSha256: sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    const decisionIdentities = value.decisions.map((decision) => `${decision.namespace}\0${decision.rawValue}`);
    if (new Set(decisionIdentities).size !== decisionIdentities.length) context.addIssue({ code: "custom", message: "review decisions must have unique raw identities", path: ["decisions"] });
    const tagIds = value.canonicalTags.map((tag) => tag.id);
    const tagSlugs = value.canonicalTags.map((tag) => tag.slug);
    if (new Set(tagIds).size !== tagIds.length) context.addIssue({ code: "custom", message: "canonical tag IDs must be unique", path: ["canonicalTags"] });
    if (new Set(tagSlugs).size !== tagSlugs.length) context.addIssue({ code: "custom", message: "canonical tag slugs must be unique", path: ["canonicalTags"] });
    const tagIdSet = new Set(tagIds);
    for (const [index, decision] of value.decisions.entries()) {
      if (decision.namespace === "tag" && decision.targetId && !tagIdSet.has(decision.targetId)) context.addIssue({ code: "custom", message: `tag target ${decision.targetId} is not defined`, path: ["decisions", index, "targetId"] });
      for (const tagId of decision.supplementalTagIds) if (!tagIdSet.has(tagId)) context.addIssue({ code: "custom", message: `supplemental tag ${tagId} is not defined`, path: ["decisions", index, "supplementalTagIds"] });
    }
  });

export const phase5TaxonomyMaterializationRecordSchema = z
  .object({
    legacyContentId: legacyContentIdSchema,
    targetPath: repositoryRelativePathSchema,
    phase4TargetFileSha256: sha256Schema,
    finalTargetFileSha256: sha256Schema,
    finalFrontmatterSha256: sha256Schema,
    categoryId: stableIdSchema.optional(),
    subjectId: stableIdSchema.optional(),
    toolCategoryId: stableIdSchema.optional(),
    tagIds: uniqueStableIdsSchema,
    stackIds: uniqueStableIdsSchema,
    retiredRawTerms: uniqueStringsSchema,
    appliedRawTermCount: z.number().int().nonnegative(),
    recordPayloadSha256: sha256Schema,
  })
  .strict();

export const phase5TaxonomyMaterializationManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    materializationVersion: phase5TaxonomyMaterializationVersionSchema,
    phase4MaterializationManifestPayloadSha256: sha256Schema,
    rawInventoryManifestPayloadSha256: sha256Schema,
    reviewPayloadSha256: sha256Schema,
    taxonomyRegistryPayloadSha256: sha256Schema,
    records: z.array(phase5TaxonomyMaterializationRecordSchema),
    manifestPayloadSha256: sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    const contentIds = value.records.map((record) => record.legacyContentId);
    const targetPaths = value.records.map((record) => record.targetPath);
    if (new Set(contentIds).size !== contentIds.length) context.addIssue({ code: "custom", message: "materialization LegacyContentIds must be unique", path: ["records"] });
    if (new Set(targetPaths).size !== targetPaths.length) context.addIssue({ code: "custom", message: "materialization targetPaths must be unique", path: ["records"] });
  });

export type Phase5TaxonomyNamespace = z.infer<typeof phase5TaxonomyNamespaceSchema>;
export type Phase5TaxonomyUsageKind = z.infer<typeof phase5TaxonomyUsageKindSchema>;
export type Phase5TaxonomyRawUsage = z.infer<typeof phase5TaxonomyRawUsageSchema>;
export type Phase5TaxonomyRawTerm = z.infer<typeof phase5TaxonomyRawTermSchema>;
export type Phase5TaxonomyRawInventory = z.infer<typeof phase5TaxonomyRawInventorySchema>;
export type Phase5TaxonomyReviewDecision = z.infer<typeof phase5TaxonomyReviewDecisionSchema>;
export type Phase5TaxonomyReviewManifest = z.infer<typeof phase5TaxonomyReviewManifestSchema>;
export type Phase5TaxonomyMaterializationRecord = z.infer<typeof phase5TaxonomyMaterializationRecordSchema>;
export type Phase5TaxonomyMaterializationManifest = z.infer<typeof phase5TaxonomyMaterializationManifestSchema>;
