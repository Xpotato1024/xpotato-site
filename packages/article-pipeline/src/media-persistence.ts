import type {
  CanonicalSourceStorageReceipt,
  CompactMediaRecoveryBinding,
  HumanApprovalRecord,
  MediaProtectionReceipt,
  MediaPublicationManifest,
} from "@xpotato/content-contracts";

export interface ApprovedMediaPersistencePlan {
  readonly candidateSha256: string;
  readonly approval: HumanApprovalRecord;
  readonly canonicalSourceSha256s: readonly string[];
  readonly publicObjectSha256s: readonly string[];
}

export interface PrivateCanonicalSourceStoragePort {
  storeApprovedSources(plan: ApprovedMediaPersistencePlan): Promise<readonly CanonicalSourceStorageReceipt[]>;
}

export interface PublicDeliveryPublicationPort {
  publishApprovedObjects(
    plan: ApprovedMediaPersistencePlan,
    canonicalReceipts: readonly CanonicalSourceStorageReceipt[],
  ): Promise<MediaPublicationManifest>;
}

export interface ProtectedExactByteStoragePort {
  protectPublishedObjects(
    plan: ApprovedMediaPersistencePlan,
    publication: MediaPublicationManifest,
  ): Promise<Readonly<{ receipt: MediaProtectionReceipt; recovery: CompactMediaRecoveryBinding }>>;
}

export interface MediaPersistenceCapabilities {
  readonly privateCanonicalMediaStorage: boolean;
  readonly publicMediaUpload: boolean;
  readonly protectedMediaOperation: boolean;
}

export const assertPersistenceCapabilities = (capabilities: MediaPersistenceCapabilities, requiredMediaCount: number): void => {
  if (requiredMediaCount === 0) return;
  if (!capabilities.privateCanonicalMediaStorage) throw new Error("Private canonical media storage capability required");
  if (!capabilities.publicMediaUpload) throw new Error("Public media upload capability required");
  if (!capabilities.protectedMediaOperation) throw new Error("Protected exact-byte storage capability required");
};
