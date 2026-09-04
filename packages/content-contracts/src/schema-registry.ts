import type { z } from "zod";
import {
  articleJobSpecSchema,
  humanApprovalRecordSchema,
  publicationCandidateManifestSchema,
  semanticRequestEnvelopeSchema,
  semanticResponseEnvelopeSchema,
} from "./article-job.js";
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
import { legacyFreezeBaselineSchema, migrationInventorySchema } from "./migration.js";
import {
  phase4ContentCandidateManifestSchema,
  phase4ContentIdentityMapSchema,
  phase4ContentMaterializationManifestSchema,
} from "./phase4-migration.js";
import {
  phase5TaxonomyMaterializationManifestSchema,
  phase5TaxonomyRawInventorySchema,
  phase5TaxonomyReviewManifestSchema,
} from "./phase5-taxonomy.js";
import { phase6MediaRepositoryCandidateManifestSchema } from "./phase6-media-candidate.js";
import { phase6MediaLocalProcessingManifestSchema } from "./phase6-media-processing.js";
import { phase6MediaRawInventorySchema, phase6MediaReviewProposalSchema } from "./phase6-media.js";
import { publicationProvenanceRecordSchema } from "./provenance.js";
import { articleClaimRecordSchema, evidenceRecordSchema, sourceRecordSchema } from "./source-evidence.js";
import { technicalExampleRecordSchema, technicalExampleVerificationResultSchema } from "./technical-example.js";
import { visualAuditRecordSchema, visualPlanSetSchema } from "./visual.js";

export const generatedSchemaRegistry = {
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
  "legacy-freeze-baseline": legacyFreezeBaselineSchema,
  "media-ingest-request": mediaIngestRequestSchema,
  "media-ingest-result": mediaIngestResultSchema,
  "media-ingest-profile": mediaIngestProfileSchema,
  "media-protection-receipt": mediaProtectionReceiptSchema,
  "media-publication-manifest": mediaPublicationManifestSchema,
  "media-rights-record": mediaRightsRecordSchema,
  "media-variant-manifest": mediaVariantManifestSchema,
  "media-variant-profile": mediaVariantProfileSchema,
  "migration-inventory": migrationInventorySchema,
  "note-frontmatter": noteFrontmatterSchema,
  "page-frontmatter": pageFrontmatterSchema,
  "phase4-content-candidate-manifest": phase4ContentCandidateManifestSchema,
  "phase4-content-identity-map": phase4ContentIdentityMapSchema,
  "phase4-content-materialization-manifest": phase4ContentMaterializationManifestSchema,
  "phase5-taxonomy-materialization-manifest": phase5TaxonomyMaterializationManifestSchema,
  "phase5-taxonomy-raw-inventory": phase5TaxonomyRawInventorySchema,
  "phase5-taxonomy-review-manifest": phase5TaxonomyReviewManifestSchema,
  "phase6-media-local-processing-manifest": phase6MediaLocalProcessingManifestSchema,
  "phase6-media-raw-inventory": phase6MediaRawInventorySchema,
  "phase6-media-review-proposal": phase6MediaReviewProposalSchema,
  "phase6-media-repository-candidate-manifest": phase6MediaRepositoryCandidateManifestSchema,
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
} satisfies Record<string, z.ZodType>;
