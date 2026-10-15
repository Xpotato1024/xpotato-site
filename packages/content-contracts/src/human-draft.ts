import { z } from "zod";
import { contentIdSchema, sha256Schema, stableIdSchema, isoDateTimeSchema } from "./common.js";
import { blogFrontmatterSchema } from "./content.js";

export const humanDraftInputSchema = z.object({
  schemaVersion:z.literal(1), jobId:stableIdSchema, attemptId:stableIdSchema, contentId:contentIdSchema,
  sourceArtifactSha256:sha256Schema, producer:z.literal("human"), importedAt:isoDateTimeSchema,
}).strict();
export const humanDraftArtifactSchema = z.object({
  schemaVersion:z.literal(1), draftId:stableIdSchema, contentId:contentIdSchema,
  bodyArtifactSha256:sha256Schema, frontmatter:blogFrontmatterSchema,
  producer:z.object({kind:z.literal("human"), input:humanDraftInputSchema}).strict(),
}).strict().superRefine((value,context)=>{
  if(value.contentId!==value.producer.input.contentId || value.frontmatter.id!==value.contentId || value.frontmatter.draft!==true)
    context.addIssue({code:"custom",message:"Human working draft identity/draft binding differs"});
});
export const draftPreviewManifestSchema = z.object({
  schemaVersion:z.literal(1), mode:z.literal("draft"), jobId:stableIdSchema, attemptId:stableIdSchema,
  contentId:contentIdSchema, inputSha256:sha256Schema, bodySha256:sha256Schema, htmlSha256:sha256Schema,
  profile:z.literal("private-markdown-draft-v1"), displayedImageSha256s:z.array(sha256Schema),
  warnings:z.array(z.string()), productionEligible:z.literal(false),
}).strict();
