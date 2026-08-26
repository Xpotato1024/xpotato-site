import { describe, expect, it } from "vitest";
import type { MediaProtectionReceipt, MediaPublicationManifest } from "@xpotato/content-contracts";
import { fingerprint } from "./canonical.js";
import { assertCompactMediaRecoveryBinding, deriveCompactMediaRecoveryBinding } from "./media-persistence.js";

const hash = (character: string): string => character.repeat(64);
const objectKey = (sha256: string, extension = "webp"): string =>
  `media/v1/objects/sha256/${sha256.slice(0, 2)}/${sha256}.${extension}`;

const publicationFixture = (): MediaPublicationManifest => {
  const unsigned = {
    schemaVersion: 1 as const,
    authorization: {
      kind: "article_job" as const,
      jobId: "job-1",
      candidateSha256: hash("1"),
      humanApprovalRecordSha256: hash("2"),
      canonicalSourceStorageReceiptSetSha256: hash("3"),
      articleJobPublicMediaPermission: true as const,
    },
    mediaSets: [
      {
        assetId: "hero",
        rightsRef: "rights-1",
        variantManifestSha256: hash("4"),
        objects: [
          {
            purpose: "master" as const,
            sha256: hash("a"),
            objectKey: objectKey(hash("a")),
            format: "webp" as const,
            contentType: "image/webp",
            cacheControl: "public, max-age=31536000, immutable" as const,
            action: "uploaded" as const,
            verifiedSizeBytes: 100,
            verifiedAt: "2026-08-27T00:00:00Z",
          },
          {
            purpose: "variant" as const,
            sha256: hash("b"),
            objectKey: objectKey(hash("b")),
            format: "webp" as const,
            width: 768,
            contentType: "image/webp",
            cacheControl: "public, max-age=31536000, immutable" as const,
            action: "uploaded" as const,
            verifiedSizeBytes: 50,
            verifiedAt: "2026-08-27T00:00:00Z",
          },
        ],
      },
    ],
    completedAt: "2026-08-27T00:00:00Z",
  };
  return { ...unsigned, manifestSha256: fingerprint(unsigned) };
};

const receiptFixture = (publication: MediaPublicationManifest): MediaProtectionReceipt => {
  const unsigned = {
    schemaVersion: 1 as const,
    candidateSha256: hash("1"),
    approvalRecordSha256: hash("2"),
    mediaPublicationManifestSha256: publication.manifestSha256,
    protectionClass: "cloudflare_protected_copy_v1" as const,
    objects: publication.mediaSets[0]!.objects.map((object, index) => ({
      sha256: object.sha256,
      sourceObjectKey: object.objectKey,
      verifiedSizeBytes: object.verifiedSizeBytes,
      protectedObjectRef: `protected-object-${index + 1}`,
      protectedAt: "2026-08-27T00:00:01Z",
    })),
    policyFingerprint: hash("5"),
    completedAt: "2026-08-27T00:00:01Z",
  };
  return { ...unsigned, receiptSha256: fingerprint(unsigned) };
};

const resignReceipt = (receipt: MediaProtectionReceipt): MediaProtectionReceipt => {
  const { receiptSha256: _receiptSha256, ...unsigned } = receipt;
  return { ...unsigned, receiptSha256: fingerprint(unsigned) };
};

describe("cleanup-safe media recovery derivation", () => {
  it("derives the exact Git binding from publication manifest and full protection receipt", () => {
    const publication = publicationFixture();
    const receipt = receiptFixture(publication);
    const binding = deriveCompactMediaRecoveryBinding(publication, receipt);
    expect(binding.mediaProtectionReceiptSha256).toBe(receipt.receiptSha256);
    expect(binding.objects.map((object) => object.publicObjectKey)).toEqual(
      publication.mediaSets[0]!.objects.map((object) => object.objectKey).sort(),
    );
    expect(() => assertCompactMediaRecoveryBinding(binding, publication, receipt)).not.toThrow();
  });

  it("rejects a mismatched object hash/key/size", () => {
    const publication = publicationFixture();
    const receipt = receiptFixture(publication);
    const mismatched = resignReceipt({
      ...receipt,
      objects: receipt.objects.map((object, index) => index === 0 ? { ...object, verifiedSizeBytes: object.verifiedSizeBytes + 1 } : object),
    });
    expect(() => deriveCompactMediaRecoveryBinding(publication, mismatched)).toThrow(/object set mismatch/);
  });

  it("rejects an extra protected object", () => {
    const publication = publicationFixture();
    const receipt = receiptFixture(publication);
    const extra = resignReceipt({ ...receipt, objects: [...receipt.objects, { ...receipt.objects[0]!, protectedObjectRef: "protected-object-extra" }] });
    expect(() => deriveCompactMediaRecoveryBinding(publication, extra)).toThrow(/duplicate|object set mismatch/);
  });

  it("rejects a missing protected object", () => {
    const publication = publicationFixture();
    const receipt = receiptFixture(publication);
    const missing = resignReceipt({ ...receipt, objects: receipt.objects.slice(0, 1) });
    expect(() => deriveCompactMediaRecoveryBinding(publication, missing)).toThrow(/object set mismatch/);
  });

  it("rejects extra or missing objects in an asserted Git binding", () => {
    const publication = publicationFixture();
    const receipt = receiptFixture(publication);
    const binding = deriveCompactMediaRecoveryBinding(publication, receipt);
    expect(() => assertCompactMediaRecoveryBinding({ ...binding, objects: binding.objects.slice(0, 1) }, publication, receipt)).toThrow(/exact equality/);
    expect(() => assertCompactMediaRecoveryBinding({ ...binding, objects: [...binding.objects, binding.objects[0]!] }, publication, receipt)).toThrow(/exact equality/);
  });
});
