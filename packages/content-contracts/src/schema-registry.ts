import {articleCandidateArtifactSchema} from "./article/article-visual.js";
import {existingAiContentAuditResponseSchema,existingAiVisualAuditResponseSchema} from "./article/existing-ai-audit.js";
import {candidateBuildInputSchema} from "./article/article-visual.js";
import {candidateMediaPlanConfirmationSchema,articleVisualInputSchema,articleVisualPlanSchema,articleVisualMastersSchema,localVisualAuditRequestSchema,localVisualAuditSchema,articleVisualMediaSchema,candidatePreviewReceiptSchema} from "./article/article-visual.js";
import {exampleVerificationRequestSchema,exampleVerificationReceiptSchema,exampleVerifierTrustRecordSchema} from "./example-receipt.js";
import {localSourceBundleSchema,localEvidenceBundleSchema,contentAuditRecordSchema,articleStageReceiptSchema,articleReviewBundleManifestSchema} from "./article/article-review.js";
import { browserToolManifestSchema, browserToolPinSchema, browserToolReviewSchema } from "./browser-tool.js";
import { humanDraftInputSchema, humanDraftArtifactSchema, draftPreviewManifestSchema } from "./article/human-draft.js";
import { editorialProvenanceRegistrySchema } from "./article/editorial-provenance.js";
import type { z } from "zod";
import {
  articleJobSpecSchema,
  humanApprovalRecordSchema,
  publicationCandidateManifestSchema,
  semanticRequestEnvelopeSchema,
  semanticResponseEnvelopeSchema,
} from "./article/article-job.js";
import {
  blogFrontmatterSchema,
  contentDiscoveryRecordSchema,
  contentModuleRecordSchema,
  discoveryProfileSchema,
  interactiveModuleRecordSchema,
  noteFrontmatterSchema,
  pageFrontmatterSchema,
  projectFrontmatterSchema,
  searchDocumentSchema,
  siteConfigSchema,
  taxonomyRegistrySchema,
  toolBindingRecordSchema,
  toolFrontmatterSchema,
} from "./content.js";
import {
  externalAiAdmissionProvenanceSchema,
  externalAiDisclosureManifestSchema,
  externalAiDisclosurePolicyProfileSchema,
  externalAiDisclosureRecordSchema,
  externalAiInputPolicyBindingSchema,
} from "./disclosure.js";
import {
  canonicalSourceStorageReceiptSchema,
  compactMediaRecoveryBindingSchema,
  contentMediaRegistrySchema,
  mediaIngestRequestSchema,
  mediaIngestResultSchema,
  mediaIngestProfileSchema,
  mediaProtectionReceiptSchema,
  mediaPublicationManifestSchema,
  mediaRightsRecordSchema,
  mediaVariantManifestSchema,
  mediaVariantProfileSchema,
} from "./media.js";
import { publicationProvenanceRecordSchema } from "./provenance.js";
import { articleClaimRecordSchema, evidenceRecordSchema, sourceRecordSchema } from "./article/source-evidence.js";
import { technicalExampleRecordSchema, technicalExampleVerificationResultSchema } from "./technical-example.js";
import { visualAuditRecordSchema, visualPlanSetSchema } from "./article/visual.js";

export const generatedSchemaRegistry = {
  "example-verification-request":exampleVerificationRequestSchema,
  "example-verification-receipt":exampleVerificationReceiptSchema,
  "example-verifier-trust-record":exampleVerifierTrustRecordSchema,
  "local-source-bundle":localSourceBundleSchema,
  "local-evidence-bundle":localEvidenceBundleSchema,
  "content-audit-record":contentAuditRecordSchema,
  "article-stage-receipt":articleStageReceiptSchema,
  "article-review-bundle-manifest":articleReviewBundleManifestSchema,
  "browser-tool-manifest": browserToolManifestSchema,
  "browser-tool-pin": browserToolPinSchema,
  "browser-tool-review": browserToolReviewSchema,
  "human-draft-input": humanDraftInputSchema,
  "human-draft-artifact": humanDraftArtifactSchema,
  "draft-preview-manifest": draftPreviewManifestSchema,
  "article-claim-record": articleClaimRecordSchema,
  "article-job-spec": articleJobSpecSchema,
  "blog-frontmatter": blogFrontmatterSchema,
  "canonical-source-storage-receipt": canonicalSourceStorageReceiptSchema,
  "compact-media-recovery-binding": compactMediaRecoveryBindingSchema,
  "content-discovery-record": contentDiscoveryRecordSchema,
  "content-media-registry": contentMediaRegistrySchema,
  "content-module-record": contentModuleRecordSchema,
  "discovery-profile": discoveryProfileSchema,
  "evidence-record": evidenceRecordSchema,
  "external-ai-disclosure-manifest": externalAiDisclosureManifestSchema,
  "external-ai-disclosure-policy-profile": externalAiDisclosurePolicyProfileSchema,
  "external-ai-disclosure-record": externalAiDisclosureRecordSchema,
  "external-ai-admission-provenance": externalAiAdmissionProvenanceSchema,
  "external-ai-input-policy-binding": externalAiInputPolicyBindingSchema,
  "human-approval-record": humanApprovalRecordSchema,
  "interactive-module-record": interactiveModuleRecordSchema,
  "editorial-provenance-registry": editorialProvenanceRegistrySchema,
  "media-ingest-request": mediaIngestRequestSchema,
  "media-ingest-result": mediaIngestResultSchema,
  "media-ingest-profile": mediaIngestProfileSchema,
  "media-protection-receipt": mediaProtectionReceiptSchema,
  "media-publication-manifest": mediaPublicationManifestSchema,
  "media-rights-record": mediaRightsRecordSchema,
  "media-variant-manifest": mediaVariantManifestSchema,
  "media-variant-profile": mediaVariantProfileSchema,
  "note-frontmatter": noteFrontmatterSchema,
  "page-frontmatter": pageFrontmatterSchema,
  "project-frontmatter": projectFrontmatterSchema,
  "publication-candidate-manifest": publicationCandidateManifestSchema,
  "publication-provenance": publicationProvenanceRecordSchema,
  "search-document": searchDocumentSchema,
  "semantic-request-envelope": semanticRequestEnvelopeSchema,
  "semantic-response-envelope": semanticResponseEnvelopeSchema,
  "site-config": siteConfigSchema,
  "source-record": sourceRecordSchema,
  "taxonomy-registry": taxonomyRegistrySchema,
  "technical-example-record": technicalExampleRecordSchema,
  "technical-example-verification-result": technicalExampleVerificationResultSchema,
  "tool-binding-record": toolBindingRecordSchema,
  "tool-frontmatter": toolFrontmatterSchema,
  "visual-audit-record": visualAuditRecordSchema,
  "visual-plan-set": visualPlanSetSchema,
  "candidate-media-plan-confirmation": candidateMediaPlanConfirmationSchema,
  "article-visual-input": articleVisualInputSchema,
  "article-visual-plan": articleVisualPlanSchema,
  "article-visual-masters": articleVisualMastersSchema,
  "local-visual-audit-request": localVisualAuditRequestSchema,
  "local-visual-audit": localVisualAuditSchema,
  "article-visual-media": articleVisualMediaSchema,
  "candidate-preview-receipt": candidatePreviewReceiptSchema,
  "candidate-build-input": candidateBuildInputSchema,
  "article-candidate-artifact": articleCandidateArtifactSchema,
  "existing-ai-content-audit-response": existingAiContentAuditResponseSchema,
  "existing-ai-visual-audit-response": existingAiVisualAuditResponseSchema,
} satisfies Record<string, z.ZodType>;
