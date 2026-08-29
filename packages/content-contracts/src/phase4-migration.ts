import { z } from "zod";
import {
  contentCollectionSchema,
  contentIdSchema,
  repositoryRelativePathSchema,
  sha256Schema,
  stableIdSchema,
} from "./common.js";
import { legacyContentIdSchema, legacyLocatorSchema } from "./migration.js";

export const phase4AllocationVersionSchema = z.literal("legacy-content-id-v1");
export const phase4CandidateVersionSchema = z.literal("legacy-portable-content-candidate-v1");
export const phase4MaterializationVersionSchema = z.literal("legacy-content-materialization-v1");

export const phase4LegacySourceIdentitySchema = z
  .object({
    repository: z.string().min(1),
    tag: z.string().min(1),
    tagObjectSha: z.string().regex(/^[a-f0-9]{40}$/u),
    commitSha: z.string().regex(/^[a-f0-9]{40}$/u),
    inventoryPayloadSha256: sha256Schema,
  })
  .strict();

export const phase4ContentIdentityEntrySchema = z
  .object({
    legacyContentId: legacyContentIdSchema,
    legacyPath: repositoryRelativePathSchema,
    collection: contentCollectionSchema,
    targetPath: repositoryRelativePathSchema,
    vNextContentId: contentIdSchema,
    disposition: z.literal("migrate"),
  })
  .strict();

export const phase4ContentIdentityMapSchema = z
  .object({
    schemaVersion: z.literal(1),
    allocationVersion: phase4AllocationVersionSchema,
    source: phase4LegacySourceIdentitySchema,
    entries: z.array(phase4ContentIdentityEntrySchema),
    mappingPayloadSha256: sha256Schema,
  })
  .strict();

const scalarSchema = z.union([z.string(), z.number(), z.boolean()]);
export const phase4LegacyMetadataValueSchema = z.union([scalarSchema, z.array(scalarSchema)]);

export const phase4PortableBodySchema = z
  .object({
    sourceBodySha256: sha256Schema,
    status: z.enum(["portable_as_is", "requires_semantic_conversion", "manual_review"]),
    candidateBodySha256: sha256Schema.optional(),
    validationErrors: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "portable_as_is") {
      if (!value.candidateBodySha256) {
        context.addIssue({ code: "custom", message: "portable_as_is requires candidateBodySha256", path: ["candidateBodySha256"] });
      }
      if (value.validationErrors.length > 0) {
        context.addIssue({ code: "custom", message: "portable_as_is cannot retain validation errors", path: ["validationErrors"] });
      }
    } else if (value.candidateBodySha256) {
      context.addIssue({ code: "custom", message: "blocked body must not claim a portable candidate hash", path: ["candidateBodySha256"] });
    }
  });

export const phase4ContentBlockerSchema = z.enum([
  "taxonomy_mapping",
  "media_mapping",
  "interactive_mapping",
  "legacy_html_review",
  "semantic_mdx_conversion",
  "project_metadata_review",
]);

export const phase4ContentCandidateSchema = z
  .object({
    candidateVersion: phase4CandidateVersionSchema,
    legacyContentId: legacyContentIdSchema,
    vNextContentId: contentIdSchema,
    legacyPath: repositoryRelativePathSchema,
    targetPath: repositoryRelativePathSchema,
    collection: contentCollectionSchema,
    title: z.string().min(1),
    description: z.string().min(1),
    draft: z.boolean(),
    stableEditorialFields: z.record(z.string(), phase4LegacyMetadataValueSchema),
    deferredTaxonomy: z.record(z.string(), z.array(z.string())),
    deferredMediaLocators: z.array(legacyLocatorSchema),
    deferredInteractiveComponents: z.array(repositoryRelativePathSchema),
    legacyHtmlStatus: z.enum(["none", "static_manual_review", "blocked_manual_review"]),
    body: phase4PortableBodySchema,
    blockers: z.array(phase4ContentBlockerSchema),
    candidatePayloadSha256: sha256Schema,
  })
  .strict();

export const phase4ContentCandidateManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    candidateVersion: phase4CandidateVersionSchema,
    source: phase4LegacySourceIdentitySchema,
    mappingPayloadSha256: sha256Schema,
    candidates: z.array(phase4ContentCandidateSchema),
    manifestPayloadSha256: sha256Schema,
  })
  .strict();

export const phase4BodyConversionSchema = z.enum([
  "portable_preserved",
  "legacy_html_to_markdown",
  "interactive_registry_conversion",
  "reviewed_editorial_update",
]);
export const phase4RemainingPhaseSchema = z.enum(["taxonomy_phase5", "media_phase6"]);
export const phase4PublicationHoldReasonSchema = z.enum(["blog_media_registry"]);

export const phase4ContentMaterializationRecordSchema = z
  .object({
    legacyContentId: legacyContentIdSchema,
    vNextContentId: contentIdSchema,
    collection: contentCollectionSchema,
    legacyPath: repositoryRelativePathSchema,
    targetPath: repositoryRelativePathSchema,
    origin: z.literal("legacy_migration"),
    sourceFileSha256: sha256Schema,
    sourceBodySha256: sha256Schema,
    targetFileSha256: sha256Schema,
    targetBodySha256: sha256Schema,
    targetFrontmatterSha256: sha256Schema,
    sourceDraft: z.boolean(),
    targetDraft: z.boolean(),
    publicationHoldReasons: z.array(phase4PublicationHoldReasonSchema),
    bodyConversion: phase4BodyConversionSchema,
    leadingTitleRemoved: z.boolean(),
    deferredTaxonomy: z.record(z.string(), z.array(z.string())),
    deferredMediaLocators: z.array(legacyLocatorSchema),
    mediaOmittedFromPortableBody: z.boolean(),
    interactiveModuleId: stableIdSchema.optional(),
    legacyHtmlRawSha256: sha256Schema.optional(),
    editorialReviewId: stableIdSchema.optional(),
    remainingPhases: z.array(phase4RemainingPhaseSchema),
  })
  .strict()
  .superRefine((value, context) => {
    const hasTaxonomy = Object.values(value.deferredTaxonomy).some((terms) => terms.length > 0);
    const hasMedia = value.deferredMediaLocators.length > 0;
    const phaseSet = new Set(value.remainingPhases);
    const holdSet = new Set(value.publicationHoldReasons);
    if (phaseSet.size !== value.remainingPhases.length) {
      context.addIssue({ code: "custom", message: "remainingPhases must be unique", path: ["remainingPhases"] });
    }
    if (holdSet.size !== value.publicationHoldReasons.length) {
      context.addIssue({ code: "custom", message: "publicationHoldReasons must be unique", path: ["publicationHoldReasons"] });
    }
    if (phaseSet.has("taxonomy_phase5") !== hasTaxonomy) {
      context.addIssue({ code: "custom", message: "taxonomy_phase5 must exactly represent deferred taxonomy", path: ["remainingPhases"] });
    }
    if (phaseSet.has("media_phase6") !== hasMedia) {
      context.addIssue({ code: "custom", message: "media_phase6 must exactly represent deferred media", path: ["remainingPhases"] });
    }
    if (value.mediaOmittedFromPortableBody !== hasMedia) {
      context.addIssue({ code: "custom", message: "media omission flag must match deferred media evidence", path: ["mediaOmittedFromPortableBody"] });
    }
    const requiresBlogMediaHold = value.collection === "blog" && !value.sourceDraft;
    if (holdSet.has("blog_media_registry") !== requiresBlogMediaHold) {
      context.addIssue({ code: "custom", message: "blog_media_registry hold must exactly represent a published legacy Blog awaiting Media Registry", path: ["publicationHoldReasons"] });
    }
    if (holdSet.size > 0 && !value.targetDraft) {
      context.addIssue({ code: "custom", message: "publication-held content must remain draft", path: ["targetDraft"] });
    }
    if (holdSet.size === 0 && value.targetDraft !== value.sourceDraft) {
      context.addIssue({ code: "custom", message: "draft state may differ only under an explicit publication hold", path: ["targetDraft"] });
    }
    if (value.bodyConversion === "interactive_registry_conversion") {
      if (!value.interactiveModuleId) {
        context.addIssue({ code: "custom", message: "interactive conversion requires module ID", path: ["interactiveModuleId"] });
      }
    } else if (value.interactiveModuleId) {
      context.addIssue({ code: "custom", message: "module ID is only valid for interactive conversion", path: ["interactiveModuleId"] });
    }
    if (value.bodyConversion === "legacy_html_to_markdown") {
      if (!value.legacyHtmlRawSha256) {
        context.addIssue({ code: "custom", message: "LegacyHtml conversion requires raw HTML hash", path: ["legacyHtmlRawSha256"] });
      }
    } else if (value.legacyHtmlRawSha256) {
      context.addIssue({ code: "custom", message: "raw HTML hash is only valid for LegacyHtml conversion", path: ["legacyHtmlRawSha256"] });
    }
    if (value.bodyConversion === "reviewed_editorial_update") {
      if (!value.editorialReviewId) {
        context.addIssue({ code: "custom", message: "reviewed editorial update requires review ID", path: ["editorialReviewId"] });
      }
    } else if (value.editorialReviewId) {
      context.addIssue({ code: "custom", message: "editorial review ID is only valid for reviewed editorial updates", path: ["editorialReviewId"] });
    }
  });

export const phase4ContentMaterializationManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    materializationVersion: phase4MaterializationVersionSchema,
    source: phase4LegacySourceIdentitySchema,
    mappingPayloadSha256: sha256Schema,
    candidateManifestPayloadSha256: sha256Schema,
    records: z.array(phase4ContentMaterializationRecordSchema),
    manifestPayloadSha256: sha256Schema,
  })
  .strict();

export type Phase4ContentIdentityEntry = z.infer<typeof phase4ContentIdentityEntrySchema>;
export type Phase4ContentIdentityMap = z.infer<typeof phase4ContentIdentityMapSchema>;
export type Phase4ContentCandidate = z.infer<typeof phase4ContentCandidateSchema>;
export type Phase4ContentCandidateManifest = z.infer<typeof phase4ContentCandidateManifestSchema>;
export type Phase4ContentMaterializationRecord = z.infer<typeof phase4ContentMaterializationRecordSchema>;
export type Phase4ContentMaterializationManifest = z.infer<typeof phase4ContentMaterializationManifestSchema>;
