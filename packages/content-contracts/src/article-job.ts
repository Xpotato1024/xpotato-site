import { z } from "zod";
import {
  artifactRefSchema,
  contentCollectionSchema,
  contentIdSchema,
  httpsUrlSchema,
  isoDateTimeSchema,
  repositoryRelativePathSchema,
  sha256Schema,
  slugSchema,
  stableIdSchema,
} from "./common.js";
import {
  disclosureStageSchema,
  externalAiInputAuthorizationSchema,
  externalAiInputPolicyBindingSchema,
} from "./disclosure.js";

export const articleUpdateKindSchema = z.enum([
  "refresh",
  "correction",
  "expansion",
  "restructure",
  "metadata_only",
  "media_only",
]);
export const articleModeSchema = z.enum([
  "explanation",
  "tutorial",
  "investigation",
  "build_log",
  "incident",
  "comparative_review",
]);

export const userNoteInputSchema = z.object({ inputId: stableIdSchema, text: z.string() }).strict();
export const repositoryRefSchema = z
  .object({
    inputId: stableIdSchema,
    repository: z.string().min(1),
    commitSha: z.string().regex(/^[a-f0-9]{40}$/),
    path: repositoryRelativePathSchema.optional(),
    visibility: z.enum(["public", "private", "unknown"]),
  })
  .strict();
export const localSourceRefSchema = z
  .object({ inputId: stableIdSchema, path: z.string().min(1), artifactSha256: sha256Schema.optional() })
  .strict();

export const articleJobSpecSchema = z
  .object({
    schemaVersion: z.literal(1),
    jobId: stableIdSchema,
    operation: z.enum(["create", "update"]),
    target: z
      .object({
        collection: contentCollectionSchema,
        contentId: contentIdSchema,
        existingContentId: contentIdSchema.optional(),
        workingTitle: z.string().min(1),
        slugHint: slugSchema.optional(),
        articleMode: articleModeSchema,
        updateKind: articleUpdateKindSchema.optional(),
        allowRouteChange: z.boolean().optional(),
      })
      .strict(),
    reader: z
      .object({ outcome: z.string().min(1), assumedKnowledge: z.array(z.string().min(1)), language: z.literal("ja") })
      .strict(),
    inputs: z
      .object({
        userNotes: z.array(userNoteInputSchema),
        repositoryRefs: z.array(repositoryRefSchema),
        localSourceRefs: z.array(localSourceRefSchema),
        seedUrls: z.array(httpsUrlSchema),
        sourceDiscoveryQueries: z.array(z.string().min(1)),
      })
      .strict(),
    externalAiDisclosure: z
      .object({
        policy: externalAiInputPolicyBindingSchema,
        explicitAuthorizations: z.array(externalAiInputAuthorizationSchema),
      })
      .strict(),
    constraints: z
      .object({
        requiredClaims: z.array(z.string().min(1)),
        forbiddenClaims: z.array(z.string().min(1)),
        requiredSections: z.array(z.string().min(1)),
        forbiddenPublicationPatterns: z.array(z.string().min(1)),
      })
      .strict(),
    taxonomyHints: z.object({ categoryId: stableIdSchema.optional(), tagIds: z.array(stableIdSchema) }).strict(),
    media: z
      .object({
        suppliedMediaRefs: z.array(stableIdSchema),
        heroPreference: z.enum(["auto", "source_media", "ai_generated", "deterministic_cover"]),
        requiredInlineVisuals: z.array(z.string().min(1)),
      })
      .strict(),
    permissions: z
      .object({
        networkAccess: z.boolean(),
        externalTextAI: z.boolean(),
        externalImageAI: z.boolean(),
        localMediaProcessing: z.boolean(),
        privateCanonicalMediaStorage: z.boolean(),
        publicMediaUpload: z.boolean(),
        protectedMediaOperation: z.boolean(),
        repositoryExport: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.operation === "create") {
      if (value.target.existingContentId !== undefined || value.target.updateKind !== undefined) {
        context.addIssue({ code: "custom", message: "create job cannot contain update fields", path: ["target"] });
      }
    } else {
      if (!value.target.existingContentId || !value.target.updateKind) {
        context.addIssue({ code: "custom", message: "update job requires existingContentId and updateKind", path: ["target"] });
      }
      if (value.target.existingContentId && value.target.contentId !== value.target.existingContentId) {
        context.addIssue({ code: "custom", message: "update ContentIds must match", path: ["target", "contentId"] });
      }
    }
  });

export const articleUpdateTargetSchema = z
  .object({
    contentId: contentIdSchema,
    baseRepositoryCommit: z.string().regex(/^[a-f0-9]{40}$/),
    kind: articleUpdateKindSchema,
    allowRouteChange: z.boolean().default(false),
  })
  .strict();
export const contentRevisionDiffSchema = z
  .object({
    contentId: contentIdSchema,
    beforeMdxSha256: sha256Schema,
    afterMdxSha256: sha256Schema,
    frontmatterChangedFields: z.array(z.string().min(1)),
    routeChanged: z.boolean(),
    taxonomyChanges: z.array(z.string().min(1)),
    mediaChanges: z.array(z.object({ assetId: stableIdSchema, change: z.string().min(1) }).strict()),
    materialClaimChanges: z.array(z.object({ claimId: stableIdSchema, change: z.string().min(1) }).strict()),
  })
  .strict();

export const articleJobStateSchema = z.enum([
  "CREATED",
  "SOURCES_READY",
  "EVIDENCE_READY",
  "DRAFTED",
  "EXAMPLES_ASSESSED",
  "CONTENT_AUDITED",
  "REVISION_REQUIRED",
  "CONTENT_READY",
  "VISUAL_PLANNED",
  "VISUAL_READY",
  "VISUAL_AUDITED",
  "MEDIA_READY",
  "CANDIDATE_READY",
  "PREVIEW_VALIDATED",
  "HUMAN_REVIEW_READY",
  "HUMAN_APPROVED",
  "MEDIA_SOURCE_STORED",
  "MEDIA_PUBLISHED",
  "MEDIA_PROTECTED",
  "EXPORTED",
  "BLOCKED",
  "FAILED",
  "CANCELLED",
]);

export const semanticStageSchema = disclosureStageSchema.exclude(["image_generation"]);
export const semanticRequestEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    requestId: stableIdSchema,
    jobId: stableIdSchema,
    jobFingerprint: sha256Schema,
    stage: semanticStageSchema,
    inputArtifacts: z.array(artifactRefSchema),
    skill: z
      .object({ skillId: stableIdSchema, skillSha256: sha256Schema, referenceBundleSha256: sha256Schema })
      .strict(),
    responseSchema: z.object({ schemaId: stableIdSchema, schemaSha256: sha256Schema }).strict(),
    constraints: z
      .object({
        maxOutputBytes: z.number().int().positive(),
        publicSafetyRequired: z.boolean(),
        externalFactPolicy: z.enum(["discover_candidates_only", "fixed_sources_only"]),
      })
      .strict(),
    executionMode: z.enum(["external", "local"]),
    externalAiDisclosureManifestSha256: sha256Schema.optional(),
    requestSha256: sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.executionMode === "external" && !value.externalAiDisclosureManifestSha256) {
      context.addIssue({ code: "custom", message: "external request requires disclosure manifest", path: ["externalAiDisclosureManifestSha256"] });
    }
    if (value.executionMode === "local" && value.externalAiDisclosureManifestSha256) {
      context.addIssue({ code: "custom", message: "local request must not claim external disclosure", path: ["externalAiDisclosureManifestSha256"] });
    }
    const expectedPolicy = value.stage === "source_discovery" ? "discover_candidates_only" : "fixed_sources_only";
    if (value.constraints.externalFactPolicy !== expectedPolicy) {
      context.addIssue({ code: "custom", message: `stage requires ${expectedPolicy}`, path: ["constraints", "externalFactPolicy"] });
    }
  });

export const semanticResponseEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    requestSha256: sha256Schema,
    stage: semanticStageSchema,
    response: z.unknown(),
    runner: z
      .object({
        provider: z.string().min(1),
        model: z.string().min(1),
        snapshot: z.string().min(1).optional(),
        providerRunId: z.string().min(1).optional(),
        executionProfileId: stableIdSchema,
        providerProfileId: stableIdSchema,
        externalAiDisclosureManifestSha256: sha256Schema.optional(),
        startedAt: isoDateTimeSchema,
        finishedAt: isoDateTimeSchema,
        externalApiUsed: z.boolean(),
        toolUseSummary: z.array(z.string()).optional(),
        warnings: z.array(z.string()),
      })
      .strict(),
  })
  .strict();

export const aiExecutionProfileSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: stableIdSchema,
    semanticStageBindings: z.record(semanticStageSchema, stableIdSchema),
    imageGenerationProfileId: stableIdSchema,
    budgetProfileId: stableIdSchema,
    escalationPolicyId: stableIdSchema,
  })
  .strict();

export const publicationCandidateManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    candidateId: stableIdSchema,
    jobId: stableIdSchema,
    jobFingerprint: sha256Schema,
    baseRepositoryCommit: z.string().regex(/^[a-f0-9]{40}$/),
    article: z
      .object({
        contentId: contentIdSchema,
        mdxSha256: sha256Schema,
        frontmatterSha256: sha256Schema,
        route: z.string().startsWith("/"),
        collection: contentCollectionSchema,
        updateDiffSha256: sha256Schema.optional(),
      })
      .strict(),
    evidence: z
      .object({
        sourceBundleSha256: sha256Schema,
        evidenceBundleSha256: sha256Schema,
        claimLedgerSha256: sha256Schema,
        durableClaimLedgerProposalSha256: sha256Schema,
        citationCompilationSha256: sha256Schema,
        technicalExampleVerificationSha256: sha256Schema,
        contentAuditSha256: sha256Schema,
      })
      .strict(),
    visual: z
      .object({
        visualPlanSetSha256: sha256Schema,
        visualAuditManifestSha256: sha256Schema,
        heroAssetId: stableIdSchema.optional(),
        socialCardAssetId: stableIdSchema.optional(),
      })
      .strict(),
    media: z
      .object({
        mediaSetManifestSha256: sha256Schema,
        canonicalSourceSha256s: z.array(sha256Schema),
        ingestProfileSha256s: z.array(sha256Schema),
        variantManifestSha256s: z.array(sha256Schema),
        deliveryProfileSha256s: z.array(sha256Schema),
        canonicalSourceStoragePlanSha256: sha256Schema,
        mediaPublicationPlanSha256: sha256Schema,
        mediaRegistryProposalSha256: sha256Schema,
      })
      .strict(),
    provenanceProposalSha256: sha256Schema,
    taxonomyRegistrySha256: sha256Schema,
    contentModuleRegistrySha256: sha256Schema,
    interactiveModuleRegistrySha256: sha256Schema,
    buildConfigFingerprint: sha256Schema,
    validation: z
      .object({
        schema: z.enum(["pass", "fail"]),
        citations: z.enum(["pass", "fail"]),
        examples: z.enum(["pass", "fail", "not_applicable"]),
        durableClaimLedger: z.enum(["pass", "fail"]),
        mediaVariants: z.enum(["pass", "fail", "not_applicable"]),
        build: z.enum(["pass", "fail"]),
        seo: z.enum(["pass", "fail"]),
        accessibility: z.enum(["pass", "fail", "manual_required"]),
        performance: z.enum(["pass", "fail", "not_run"]),
      })
      .strict(),
    candidateSha256: sha256Schema,
  })
  .strict();

export const humanReviewBundleSchema = z
  .object({
    candidateSha256: sha256Schema,
    contentId: contentIdSchema,
    renderedPreviewRefs: z.array(repositoryRelativePathSchema),
    title: z.string().min(1),
    description: z.string().min(1),
    route: z.string().startsWith("/"),
    taxonomySummary: z.array(z.string()),
    materialClaims: z.array(z.object({ claimId: stableIdSchema, summary: z.string().min(1) }).strict()),
    citationSummary: z.string(),
    technicalExampleSummary: z.string(),
    unresolvedLimitations: z.array(z.string()),
    contentAuditSummary: z.string(),
    visualSummary: z.string(),
    mediaDeliverySummary: z.string(),
    plannedPrivateCanonicalSources: z.array(z.string()),
    plannedPublicMedia: z.array(z.string()),
    updateDiffRef: repositoryRelativePathSchema.optional(),
    isApproval: z.literal(false),
  })
  .strict();
export const humanApprovalRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    candidateSha256: sha256Schema,
    contentId: contentIdSchema,
    approvedAt: isoDateTimeSchema,
    reviewer: z.string().min(1),
    basis: z.string().min(1),
    confirmed: z.literal(true),
  })
  .strict();

export type ArticleJobSpec = z.infer<typeof articleJobSpecSchema>;
export type ArticleJobState = z.infer<typeof articleJobStateSchema>;
export type SemanticRequestEnvelope = z.infer<typeof semanticRequestEnvelopeSchema>;
export type PublicationCandidateManifest = z.infer<typeof publicationCandidateManifestSchema>;
export type HumanApprovalRecord = z.infer<typeof humanApprovalRecordSchema>;
