import {publicationCandidateManifestSchema,humanReviewBundleSchema} from "./article-job.js";
import {z} from "zod";
import {contentIdSchema,isoDateTimeSchema,repositoryRelativePathSchema,sha256Schema,stableIdSchema} from "./common.js";
import {mediaRightsRecordSchema,mediaIngestResultSchema,mediaVariantManifestSchema,contentMediaRegistrySchema} from "./media.js";
import {visualPlanSetSchema,visualAuditRecordSchema,visualSourceRefSchema} from "./visual.js";
import {articleReviewScopeSchema,independentReviewerSchema} from "./article-review.js";
import {articleRoute} from './article-route.js';

export const candidateMediaPlanConfirmationSchema=z.object({
 schemaVersion:z.literal(1),scope:articleReviewScopeSchema,profileId:z.literal("article-media-targets-v1"),
 profileSha256:sha256Schema,confirmation:z.object({kind:z.literal("human"),principalId:stableIdSchema,
  confirmedProfileSha256:sha256Schema,confirmedAt:isoDateTimeSchema,purpose:z.literal("candidate_planning_only")}).strict(),
}).strict();
const sourceFields={assetId:stableIdSchema,path:repositoryRelativePathSchema,sha256:sha256Schema,alt:z.string().min(1),
 decorative:z.boolean(),rights:mediaRightsRecordSchema,sourceRefs:z.array(visualSourceRefSchema).optional(),requiredFacts:z.array(z.string().min(1)).optional()};
const rasterInput=z.object({...sourceFields,kind:z.literal("local_raster"),origin:z.enum(["camera","screenshot","diagram","ai_generated"]),
 receivedLineage:z.object({artifactId:stableIdSchema,lineageSha256:sha256Schema}).strict().optional()}).strict();
const diagramInput=z.object({...sourceFields,kind:z.literal('local_svg'),origin:z.literal('diagram')}).strict();
export const articleVisualInputSchema=z.object({schemaVersion:z.literal(1),
 hero:z.union([z.object({kind:z.literal("deterministic_cover")}).strict(),rasterInput]),
 inline:z.array(z.union([rasterInput,diagramInput])).max(12),mediaPlan:candidateMediaPlanConfirmationSchema.nullable(),
}).strict();
export const articleVisualPlanSchema=z.object({schemaVersion:z.literal(1),protocol:z.literal("xpotato-private-visual-plan-v1"),
 jobId:stableIdSchema,attemptId:stableIdSchema,inputSha256:sha256Schema,reviewHeadSha256:sha256Schema,scope:articleReviewScopeSchema,
 authorPrincipalId:stableIdSchema,producerPrincipalId:stableIdSchema,visualInput:articleVisualInputSchema,
 visualPlan:visualPlanSetSchema,frontmatterSha256:sha256Schema,generatorBindingSha256:sha256Schema,
 rights:z.array(mediaRightsRecordSchema),planSha256:sha256Schema}).strict();
export const articleVisualMastersSchema=z.object({schemaVersion:z.literal(1),protocol:z.literal("xpotato-private-visual-masters-v1"),
 planSha256:sha256Schema,derivationSha256:sha256Schema,assets:z.array(z.object({assetId:stableIdSchema,
 role:z.enum(["hero","social_card","inline"]),origin:z.enum(["deterministic_cover","camera","screenshot","diagram","ai_generated"]),
 alt:z.string().min(1),decorative:z.boolean(),rightsRef:stableIdSchema,ingest:mediaIngestResultSchema}).strict()).min(2),
 mastersSha256:sha256Schema}).strict();
export const localVisualAuditRequestSchema=z.object({schemaVersion:z.literal(1),protocol:z.literal("xpotato-private-visual-audit-request-v1"),
 scope:articleReviewScopeSchema,jobId:stableIdSchema,attemptId:stableIdSchema,inputSha256:sha256Schema,
 planSha256:sha256Schema,mastersSha256:sha256Schema,authorPrincipalId:stableIdSchema,producerPrincipalId:stableIdSchema,
 targetAssets:z.array(z.object({assetId:stableIdSchema,sha256:sha256Schema,path:repositoryRelativePathSchema}).strict()).min(2),
 skill:z.object({skillId:z.literal("independent-visual-audit"),skillSha256:sha256Schema}).strict().optional(),
 requestSha256:sha256Schema}).strict();
export const localVisualAuditSchema=z.object({schemaVersion:z.literal(1),protocol:z.literal("xpotato-private-visual-audit-v1"),
 scope:articleReviewScopeSchema,requestSha256:sha256Schema,reviewer:independentReviewerSchema,
 publicationSafetyReviewed:z.literal(true),independence:z.object({separateReview:z.literal(true),identitiesConfirmed:z.literal(true),basis:z.string().min(1)}).strict(),
 findings:z.array(z.object({findingId:stableIdSchema,assetId:stableIdSchema,severity:z.enum(["P0","P1","P2"]),description:z.string().min(1)}).strict()),
 records:z.array(visualAuditRecordSchema).min(2),conclusion:z.enum(["pass","revision_required","blocked"]),
 reviewedAt:isoDateTimeSchema}).strict().refine(v=>(v.scope==="existing_ai")===(v.reviewer.kind==="agent"),{message:"Agent audit and human audit scopes must remain separate"});
export const articleVisualMediaSchema=z.object({schemaVersion:z.literal(1),protocol:z.literal("xpotato-private-candidate-media-v1"),
 planSha256:sha256Schema,mastersSha256:sha256Schema,auditSha256:sha256Schema,
 registry:contentMediaRegistrySchema,variants:z.array(mediaVariantManifestSchema).min(2),
 localObjects:z.array(z.object({sha256:sha256Schema,path:repositoryRelativePathSchema,contentType:z.string().min(1)}).strict()).min(2),
 mediaSha256:sha256Schema}).strict();
export const candidatePreviewReceiptSchema=z.object({schemaVersion:z.literal(1),protocol:z.literal("xpotato-private-candidate-preview-v1"),
 candidateInputSha256:sha256Schema,contentId:contentIdSchema,route:z.string().startsWith("/"),
 outputTreeSha256:sha256Schema,htmlSha256:sha256Schema,buildConfigSha256:sha256Schema,
 localMediaSha256s:z.array(sha256Schema),plannedSeoSha256:sha256Schema,
 validation:z.object({schema:z.literal("pass"),citations:z.literal("pass"),examples:z.literal("pass"),
  media:z.literal("pass"),build:z.literal("pass"),seo:z.literal("pass"),hydration:z.literal("pass"),
  accessibility:z.literal("manual_required"),performance:z.literal("not_run")}).strict(),
 previewSha256:sha256Schema}).strict();
export type ArticleVisualInput=z.infer<typeof articleVisualInputSchema>;
export type ArticleVisualPlan=z.infer<typeof articleVisualPlanSchema>;
export type ArticleVisualMasters=z.infer<typeof articleVisualMastersSchema>;
export type LocalVisualAuditRequest=z.infer<typeof localVisualAuditRequestSchema>;
export type LocalVisualAudit=z.infer<typeof localVisualAuditSchema>;
export type ArticleVisualMedia=z.infer<typeof articleVisualMediaSchema>;

export const candidateBuildInputSchema=z.object({schemaVersion:z.literal(1),protocol:z.literal("xpotato-private-candidate-build-input-v1"),
 candidateInputSha256:sha256Schema,contentId:contentIdSchema,route:z.string().regex(/^\/articles\/[0-7][0-9abcdefghjkmnpqrstvwxyz]{25}\/$/u),
 buildRoot:z.string().min(1),contentRoot:z.string().min(1),targetPath:repositoryRelativePathSchema,mdxSha256:sha256Schema,
 overlayFiles:z.array(z.object({path:repositoryRelativePathSchema,sha256:sha256Schema}).strict()).min(1),
 registry:contentMediaRegistrySchema,localMediaUrls:z.record(sha256Schema,z.string().regex(/^\/__candidate_media\/[a-f0-9]{64}\.(?:jpg|png|webp|avif)$/u)),
 plannedSeo:z.object({canonical:z.url(),image:z.object({url:z.url(),width:z.number().int().positive(),height:z.number().int().positive(),alt:z.string().optional()}).strict().nullable()}).strict(),
 scope:articleReviewScopeSchema,reference:z.boolean(),planConfirmed:z.boolean(),productionEligible:z.literal(false)}).strict().refine(v=>v.route===articleRoute(v.contentId),{message:'Article route must encode the exact ContentId',path:['route']});
export type CandidateBuildInput=z.infer<typeof candidateBuildInputSchema>;

export const articleCandidateArtifactSchema=z.object({schemaVersion:z.literal(1),protocol:z.literal("xpotato-private-complete-candidate-v1"),
 scope:articleReviewScopeSchema,reference:z.boolean(),jobId:stableIdSchema,attemptId:stableIdSchema,inputSha256:sha256Schema,
 targetSha256:sha256Schema,candidateSha256:sha256Schema.nullable(),approvalEligible:z.boolean(),productionEligible:z.literal(false),isApproval:z.literal(false),
 candidate:publicationCandidateManifestSchema,preview:candidatePreviewReceiptSchema,review:humanReviewBundleSchema,
 candidateInputSha256:sha256Schema,mediaSha256:sha256Schema,visualPlanSha256:sha256Schema,reviewHeadSha256:sha256Schema,
 files:z.array(z.object({path:repositoryRelativePathSchema,sha256:sha256Schema,sizeBytes:z.number().int().nonnegative()}).strict()).min(1),
 blockers:z.array(z.string()),artifactSha256:sha256Schema}).strict();
export type ArticleCandidateArtifact=z.infer<typeof articleCandidateArtifactSchema>;
