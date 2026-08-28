import type { MediaIngestRequest, MediaIngestResult, MediaVariantManifest } from "@xpotato/content-contracts";
import { deliveryProfiles } from "./profiles.js";

export * from "./profiles.js";

export type MediaVariantProfileId = keyof typeof deliveryProfiles;

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
  generate(input: Readonly<{
    ingestResult: MediaIngestResult;
    profileId: MediaVariantProfileId;
    profileSha256: string;
  }>): Promise<MediaVariantManifest>;
}

export interface MediaIngestBoundary {
  readonly visualAuditGate: VisualAuditGate;
  readonly canonicalProcessor: CanonicalMediaProcessor;
  readonly variantGenerator: DeliveryVariantGenerator;
}

export interface AuditedMediaProcessingRequest {
  readonly request: MediaIngestRequest;
  readonly candidateSha256: string;
  readonly variantProfileId: MediaVariantProfileId;
  readonly variantProfileSha256: string;
}

// Publication and protected storage intentionally do not belong to this package.
export const processAuditedMedia = async (
  boundary: MediaIngestBoundary,
  input: Readonly<AuditedMediaProcessingRequest>,
): Promise<Readonly<{ ingest: MediaIngestResult; variants: MediaVariantManifest }>> => {
  if (!(input.variantProfileId in deliveryProfiles)) {
    throw new Error(`Unknown media variant profile: ${input.variantProfileId}`);
  }
  const ingest = await boundary.canonicalProcessor.ingest(input.request);
  if (ingest.processing.profileId !== input.request.profileId) {
    throw new Error("Canonical ingest result profile binding mismatch");
  }
  await boundary.visualAuditGate.assertApproved({
    semanticAssetId: input.request.target.semanticAssetId,
    candidateSha256: input.candidateSha256,
    canonicalMasterSha256: ingest.canonicalMaster.sha256,
    canonicalPrivateRelativePath: ingest.canonicalMaster.privateRelativePath,
  });
  const variants = await boundary.variantGenerator.generate({
    ingestResult: ingest,
    profileId: input.variantProfileId,
    profileSha256: input.variantProfileSha256,
  });
  if (variants.profileId !== input.variantProfileId || variants.profileSha256 !== input.variantProfileSha256) {
    throw new Error("Media variant manifest profile binding mismatch");
  }
  return { ingest, variants };
};
