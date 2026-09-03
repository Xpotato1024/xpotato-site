import type { MediaIngestRequest, MediaIngestResult, MediaVariantManifest } from "@xpotato/content-contracts";
import { getMediaVariantProfileBinding, type MediaVariantProfileId } from "./profiles.js";

export * from "./profiles.js";
export * from "./sharp-runtime.js";

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
    contentId: string;
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
}

// Publication and protected storage intentionally do not belong to this package.
export const processAuditedMedia = async (
  boundary: MediaIngestBoundary,
  input: Readonly<AuditedMediaProcessingRequest>,
): Promise<Readonly<{ ingest: MediaIngestResult; variants: MediaVariantManifest }>> => {
  if (Object.prototype.hasOwnProperty.call(input, "variantProfileSha256")) {
    throw new Error("Caller-supplied media variant profile SHA is not accepted");
  }
  const variantProfile = getMediaVariantProfileBinding(input.variantProfileId);
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
    contentId: input.request.target.contentId,
    ingestResult: ingest,
    profileId: variantProfile.profileId,
    profileSha256: variantProfile.profileSha256,
  });
  if (variants.contentId !== input.request.target.contentId) {
    throw new Error("Media variant manifest ContentId mismatch");
  }
  if (variants.profileId !== variantProfile.profileId || variants.profileSha256 !== variantProfile.profileSha256) {
    throw new Error("Media variant manifest profile binding mismatch");
  }
  return { ingest, variants };
};
