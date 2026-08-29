import { z } from "zod";
import { contentCollectionSchema, contentIdSchema, repositoryRelativePathSchema, sha256Schema } from "./common.js";
import { legacyContentIdSchema, legacyLocatorSchema } from "./migration.js";

export const phase4AllocationVersionSchema = z.literal("legacy-content-id-v1");
export const phase4CandidateVersionSchema = z.literal("legacy-portable-content-candidate-v1");

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

export type Phase4ContentIdentityEntry = z.infer<typeof phase4ContentIdentityEntrySchema>;
export type Phase4ContentIdentityMap = z.infer<typeof phase4ContentIdentityMapSchema>;
export type Phase4ContentCandidate = z.infer<typeof phase4ContentCandidateSchema>;
export type Phase4ContentCandidateManifest = z.infer<typeof phase4ContentCandidateManifestSchema>;
