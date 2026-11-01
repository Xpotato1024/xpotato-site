import {publicationProvenanceRecordSchema,type CanonicalSourceStorageReceipt,type MediaPublicationManifest,type MediaProtectionReceipt} from '@xpotato/content-contracts';
import type {PublicationContext} from './publication-approval.js';
import type {PublicationHead} from './publication-contracts.js';
import {deriveCompactMediaRecoveryBinding} from './media-persistence.js';
import {currentExternalAiPolicyBinding} from './disclosure.js';
import {fingerprint} from './canonical.js';
export function publicationProvenance(c:PublicationContext,head:PublicationHead,receipts:{sources:CanonicalSourceStorageReceipt[];publication:MediaPublicationManifest;protection:MediaProtectionReceipt}){
 const candidate=c.artifact.candidate,proposal=c.materials.provenanceProposal;
 return publicationProvenanceRecordSchema.parse({schemaVersion:1,contentId:c.materials.frontmatter.id,origin:'article_job',content:proposal.content,
  articleJob:{jobId:c.v.c.store.jobId,candidateSha256:c.target,approvalRecordSha256:head.approvalSha256,
   sourceBundleSha256:candidate.evidence.sourceBundleSha256,evidenceBundleSha256:candidate.evidence.evidenceBundleSha256,
   citationCompilationSha256:candidate.evidence.citationCompilationSha256,technicalExampleVerificationSha256:candidate.evidence.technicalExampleVerificationSha256,
   contentAuditSha256:candidate.evidence.contentAuditSha256,visualAuditSha256:candidate.visual.visualAuditManifestSha256,
   externalAiPolicyId:currentExternalAiPolicyBinding.policyId,externalAiPolicySha256:currentExternalAiPolicyBinding.policySha256,
   canonicalSourceStorageReceiptSetSha256:fingerprint(receipts.sources),mediaPublicationManifestSha256:receipts.publication.manifestSha256,
   mediaProtectionReceiptSha256:receipts.protection.receiptSha256},sourceRefs:proposal.sourceRefs,materialClaims:proposal.materialClaims,
  mediaSources:proposal.mediaSources,mediaRecovery:deriveCompactMediaRecoveryBinding(receipts.publication,receipts.protection),aiRuns:proposal.aiRuns,
  visualOrigins:[...new Set(c.v.media!.registry.assets.map(a=>a.origin))],exportedAt:receipts.protection.completedAt});
}
