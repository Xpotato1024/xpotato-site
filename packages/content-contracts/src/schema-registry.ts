import type { z } from "zod";
import { articleJobSpecSchema, humanApprovalRecordSchema, publicationCandidateManifestSchema } from "./article-job.js";
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
import { externalAiDisclosureManifestSchema, externalAiDisclosureRecordSchema } from "./disclosure.js";
import {
  canonicalSourceStorageReceiptSchema,
  compactMediaRecoveryBindingSchema,
  contentMediaRegistrySchema,
  mediaIngestRequestSchema,
  mediaIngestResultSchema,
  mediaProtectionReceiptSchema,
  mediaPublicationManifestSchema,
  mediaRightsRecordSchema,
  mediaVariantManifestSchema,
} from "./media.js";
import { migrationInventorySchema } from "./migration.js";
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
  "external-ai-disclosure-record": externalAiDisclosureRecordSchema,
  "human-approval-record": humanApprovalRecordSchema,
  "interactive-module-record": interactiveModuleRecordSchema,
  "media-ingest-request": mediaIngestRequestSchema,
  "media-ingest-result": mediaIngestResultSchema,
  "media-protection-receipt": mediaProtectionReceiptSchema,
  "media-publication-manifest": mediaPublicationManifestSchema,
  "media-rights-record": mediaRightsRecordSchema,
  "media-variant-manifest": mediaVariantManifestSchema,
  "migration-inventory": migrationInventorySchema,
  "note-frontmatter": noteFrontmatterSchema,
  "page-frontmatter": pageFrontmatterSchema,
  "project-frontmatter": projectFrontmatterSchema,
  "publication-candidate-manifest": publicationCandidateManifestSchema,
  "publication-provenance": publicationProvenanceRecordSchema,
  "search-document": searchDocumentSchema,
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
