import type { MediaIngestRequest, MediaIngestResult, MediaVariantManifest } from "@xpotato/content-contracts";

export * from "./profiles.js";

export interface VisualAuditGate {
  assertApproved(input: Readonly<{
    semanticAssetId: string;
    candidateSha256: string;
    canonicalMasterSha256: string;
    canonicalPrivateRelativePath: string;
  }>): Promise<void>;
}

export interface CanonicalMediaProcessor {
  ingest(request: MediaIngestRequest): Promise<MediaIngestResult>;
}

export interface DeliveryVariantGenerator {
  generate(input: Readonly<{ ingestResult: MediaIngestResult; profileId: string; profileSha256: string }>): Promise<MediaVariantManifest>;
}

export interface MediaIngestBoundary {
  readonly visualAuditGate: VisualAuditGate;
  readonly canonicalProcessor: CanonicalMediaProcessor;
  readonly variantGenerator: DeliveryVariantGenerator;
}

// Publication and protected storage intentionally do not belong to this package.
export const processAuditedMedia = async (
  boundary: MediaIngestBoundary,
  input: Readonly<{ request: MediaIngestRequest; candidateSha256: string; profileSha256: string }>,
): Promise<Readonly<{ ingest: MediaIngestResult; variants: MediaVariantManifest }>> => {
  const ingest = await boundary.canonicalProcessor.ingest(input.request);
  await boundary.visualAuditGate.assertApproved({
    semanticAssetId: input.request.target.semanticAssetId,
    candidateSha256: input.candidateSha256,
    canonicalMasterSha256: ingest.canonicalMaster.sha256,
    canonicalPrivateRelativePath: ingest.canonicalMaster.privateRelativePath,
  });
  const variants = await boundary.variantGenerator.generate({
    ingestResult: ingest,
    profileId: input.request.profileId,
    profileSha256: input.profileSha256,
  });
  return { ingest, variants };
};
