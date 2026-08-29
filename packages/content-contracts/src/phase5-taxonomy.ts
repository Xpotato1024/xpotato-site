import { z } from "zod";
import { sha256Schema } from "./common.js";
import { legacyContentIdSchema } from "./migration.js";
import { phase4LegacySourceIdentitySchema } from "./phase4-migration.js";

export const phase5TaxonomyInventoryVersionSchema = z.literal("legacy-taxonomy-raw-v1");

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

export const phase5TaxonomyRawUsageSchema = z
  .object({
    kind: phase5TaxonomyUsageKindSchema,
    occurrenceCount: z.number().int().positive(),
    affectedLegacyContentIds: uniqueLegacyContentIdsSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.occurrenceCount < value.affectedLegacyContentIds.length) {
      context.addIssue({
        code: "custom",
        message: "occurrenceCount cannot be smaller than the number of affected content IDs",
        path: ["occurrenceCount"],
      });
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
      if (!allowedUsageKinds.has(usage.kind)) {
        context.addIssue({ code: "custom", message: `usage ${usage.kind} is invalid for namespace ${value.namespace}`, path: ["usages", index, "kind"] });
      }
    }
    const usageKinds = value.usages.map((usage) => usage.kind);
    if (new Set(usageKinds).size !== usageKinds.length) {
      context.addIssue({ code: "custom", message: "usage kinds must be unique", path: ["usages"] });
    }
    const occurrenceCount = value.usages.reduce((sum, usage) => sum + usage.occurrenceCount, 0);
    if (occurrenceCount !== value.occurrenceCount) {
      context.addIssue({ code: "custom", message: "term occurrenceCount must equal the usage occurrence sum", path: ["occurrenceCount"] });
    }
    const affected = [...new Set(value.usages.flatMap((usage) => usage.affectedLegacyContentIds))].sort();
    if (affected.join("\0") !== [...value.affectedLegacyContentIds].sort().join("\0")) {
      context.addIssue({ code: "custom", message: "term affectedLegacyContentIds must equal the usage union", path: ["affectedLegacyContentIds"] });
    }
    const requiresTechnologyKind = value.usages.some((usage) => usage.kind === "project_technology");
    if (requiresTechnologyKind !== value.requiresTechnologyKind) {
      context.addIssue({ code: "custom", message: "requiresTechnologyKind must reflect project_technology usage", path: ["requiresTechnologyKind"] });
    }
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
    if (value.uniqueRawTermCount !== value.terms.length) {
      context.addIssue({ code: "custom", message: "uniqueRawTermCount must equal terms.length", path: ["uniqueRawTermCount"] });
    }
    const occurrenceCount = value.terms.reduce((sum, term) => sum + term.occurrenceCount, 0);
    if (occurrenceCount !== value.rawTermOccurrenceCount) {
      context.addIssue({ code: "custom", message: "rawTermOccurrenceCount must equal the term occurrence sum", path: ["rawTermOccurrenceCount"] });
    }
    const identities = value.terms.map((term) => `${term.namespace}\0${term.rawValue}`);
    if (new Set(identities).size !== identities.length) {
      context.addIssue({ code: "custom", message: "raw term namespace/value identities must be unique", path: ["terms"] });
    }
  });

export type Phase5TaxonomyNamespace = z.infer<typeof phase5TaxonomyNamespaceSchema>;
export type Phase5TaxonomyUsageKind = z.infer<typeof phase5TaxonomyUsageKindSchema>;
export type Phase5TaxonomyRawUsage = z.infer<typeof phase5TaxonomyRawUsageSchema>;
export type Phase5TaxonomyRawTerm = z.infer<typeof phase5TaxonomyRawTermSchema>;
export type Phase5TaxonomyRawInventory = z.infer<typeof phase5TaxonomyRawInventorySchema>;
