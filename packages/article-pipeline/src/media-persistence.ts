import type {
  CanonicalSourceStorageReceipt,
  CompactMediaRecoveryBinding,
  HumanApprovalRecord,
  MediaProtectionReceipt,
  MediaPublicationManifest,
} from "@xpotato/content-contracts";
import {
  compactMediaRecoveryBindingSchema,
  mediaProtectionReceiptSchema,
  mediaPublicationManifestSchema,
} from "@xpotato/content-contracts";
import { compareCanonicalKeys, fingerprint } from "./canonical.js";

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
  ): Promise<MediaProtectionReceipt>;
}

const withoutHash = <T extends Record<string, unknown>, K extends keyof T>(value: T, key: K): Omit<T, K> => {
  const { [key]: _hash, ...unsigned } = value;
  return unsigned;
};

const objectIdentity = (value: Readonly<{ sha256: string; objectKey: string; verifiedSizeBytes: number }>): string =>
  `${value.sha256}:${value.objectKey}:${value.verifiedSizeBytes}`;

const assertUnique = (values: readonly string[], label: string): void => {
  if (new Set(values).size !== values.length) throw new Error(`${label} contains duplicate objects`);
};

export const deriveCompactMediaRecoveryBinding = (
  publicationInput: MediaPublicationManifest,
  receiptInput: MediaProtectionReceipt,
): CompactMediaRecoveryBinding => {
  const publication = mediaPublicationManifestSchema.parse(publicationInput);
  const receipt = mediaProtectionReceiptSchema.parse(receiptInput);
  if (publication.manifestSha256 !== fingerprint(withoutHash(publication, "manifestSha256"))) {
    throw new Error("MediaPublicationManifest hash mismatch");
  }
  if (receipt.receiptSha256 !== fingerprint(withoutHash(receipt, "receiptSha256"))) {
    throw new Error("MediaProtectionReceipt hash mismatch");
  }
  if (receipt.mediaPublicationManifestSha256 !== publication.manifestSha256) {
    throw new Error("Protection receipt publication manifest binding mismatch");
  }
  if (publication.authorization.kind === "article_job") {
    if (receipt.candidateSha256 !== publication.authorization.candidateSha256) {
      throw new Error("Protection receipt candidate binding mismatch");
    }
    if (receipt.approvalRecordSha256 !== publication.authorization.humanApprovalRecordSha256) {
      throw new Error("Protection receipt approval binding mismatch");
    }
  }

  const publishedObjects = publication.mediaSets.flatMap((mediaSet) =>
    mediaSet.objects.map((object) => ({
      sha256: object.sha256,
      objectKey: object.objectKey,
      verifiedSizeBytes: object.verifiedSizeBytes,
    })),
  );
  const protectedObjects = receipt.objects.map((object) => ({
    sha256: object.sha256,
    objectKey: object.sourceObjectKey,
    verifiedSizeBytes: object.verifiedSizeBytes,
    protectedObjectRef: object.protectedObjectRef,
  }));
  const publishedIds = publishedObjects.map(objectIdentity).sort(compareCanonicalKeys);
  const protectedIds = protectedObjects.map(objectIdentity).sort(compareCanonicalKeys);
  assertUnique(publishedIds, "MediaPublicationManifest");
  assertUnique(protectedIds, "MediaProtectionReceipt");
  if (
    publishedIds.length !== protectedIds.length ||
    publishedIds.some((identity, index) => identity !== protectedIds[index])
  ) {
    throw new Error("Publication/protection object set mismatch");
  }

  const protectedByIdentity = new Map(protectedObjects.map((object) => [objectIdentity(object), object]));
  return compactMediaRecoveryBindingSchema.parse({
    protectionClass: receipt.protectionClass,
    policyFingerprint: receipt.policyFingerprint,
    mediaProtectionReceiptSha256: receipt.receiptSha256,
    objects: publishedObjects
      .map((object) => {
        const protectedObject = protectedByIdentity.get(objectIdentity(object));
        if (!protectedObject) throw new Error("Protected object missing during recovery derivation");
        return {
          sha256: object.sha256,
          publicObjectKey: object.objectKey,
          verifiedSizeBytes: object.verifiedSizeBytes,
          protectedObjectRef: protectedObject.protectedObjectRef,
        };
      })
      .sort((left, right) =>
        compareCanonicalKeys(
          `${left.publicObjectKey}:${left.sha256}`,
          `${right.publicObjectKey}:${right.sha256}`,
        ),
      ),
  });
};

export const assertCompactMediaRecoveryBinding = (
  bindingInput: CompactMediaRecoveryBinding,
  publication: MediaPublicationManifest,
  receipt: MediaProtectionReceipt,
): void => {
  const binding = compactMediaRecoveryBindingSchema.parse(bindingInput);
  const expected = deriveCompactMediaRecoveryBinding(publication, receipt);
  if (fingerprint(binding) !== fingerprint(expected)) {
    throw new Error("CompactMediaRecoveryBinding exact equality mismatch");
  }
};

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
