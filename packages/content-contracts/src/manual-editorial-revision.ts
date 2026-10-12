import { z } from "zod";
import { repositoryRelativePathSchema, sha256Schema } from "./common.js";
import { publicationProvenanceRecordSchema } from "./provenance.js";

/** Manual fixed-page edits overlay immutable migration evidence; they cannot publish articles. */
export const manualEditorialRevisionLedgerSchema = z.object({
  schemaVersion: z.literal(1),
  baseline: z.literal("phase5-taxonomy-materialization-v1"),
  createdPages: z.array(z.object({
    targetPath: repositoryRelativePathSchema.regex(/^apps\/site\/src\/content\/pages\/[^/]+\.mdx$/u),
    provenance: publicationProvenanceRecordSchema.refine(record => record.origin === "manual", "manual origin required"),
  }).strict()),
  revisions: z.array(z.object({
    targetPath: repositoryRelativePathSchema,
    beforeMdxSha256: sha256Schema,
    summary: z.string().min(1),
    provenance: publicationProvenanceRecordSchema.refine(record => record.origin === "manual", "manual origin required"),
  }).strict()),
}).strict();
export type ManualEditorialRevisionLedger = z.infer<typeof manualEditorialRevisionLedgerSchema>;
