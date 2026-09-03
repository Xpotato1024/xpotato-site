import { describe, expect, it, vi } from "vitest";
import type { MediaIngestRequest, MediaIngestResult, MediaVariantManifest } from "@xpotato/content-contracts";
import {
  getMediaVariantProfileBinding,
  deliveryProfiles,
  processAuditedMedia,
  type AuditedMediaProcessingRequest,
  type MediaIngestBoundary,
} from "./index.js";

const hash = (character: string): string => character.repeat(64);
const request: MediaIngestRequest = {
  schemaVersion: 1,
  sourcePath: ".local/media-ingest/source.heic",
  target: { contentId: "f8a847d4-8f5d-4bb0-a387-750f096479f2", semanticAssetId: "hero" },
  kind: "photo",
  profileId: "canonical-raster-srgb8-lossless-webp-v1",
  overwrite: false,
};
const ingest: MediaIngestResult = {
  schemaVersion: 1,
  semanticAssetId: "hero",
  source: { detectedFormat: "heic", sourceSha256: hash("1") },
  canonicalMaster: {
    privateRelativePath: ".local/media-ingest/canonical.webp",
    sha256: hash("2"),
    format: "webp",
    sizeBytes: 10,
  },
  processing: {
    profileId: "canonical-raster-srgb8-lossless-webp-v1",
    profileSha256: hash("3"),
    toolchainId: "media-toolchain-v1",
    toolchainSha256: hash("4"),
    metadataStripped: true,
    orientationApplied: true,
    resized: false,
    colorSpace: "srgb",
    bitDepth: 8,
  },
  warnings: [],
};
const variantProfile = getMediaVariantProfileBinding("photo-hero-v1");
const variants: MediaVariantManifest = {
  schemaVersion: 1,
  contentId: request.target.contentId,
  assetId: "hero",
  masterSha256: ingest.canonicalMaster.sha256,
  profileId: "photo-hero-v1",
  profileSha256: variantProfile.profileSha256,
  toolchainId: "media-toolchain-v1",
  toolchainSha256: hash("4"),
  status: "not_required",
  variants: [],
  warnings: [],
  manifestSha256: hash("6"),
};

describe("media processing stage order", () => {
  it("derives a stable SHA from an immutable exact machine profile", () => {
    expect(variantProfile.profileSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(Object.isFrozen(deliveryProfiles["photo-hero-v1"])).toBe(true);
    expect(Object.isFrozen(deliveryProfiles["photo-hero-v1"].widths)).toBe(true);
    expect(getMediaVariantProfileBinding("photo-hero-v1")).toEqual(variantProfile);
  });

  it("keeps the canonical ingest profile and delivery variant profile structurally separate", async () => {
    const order: string[] = [];
    const canonicalProcessor = { ingest: vi.fn(async (received: MediaIngestRequest) => {
      order.push("canonical");
      expect(received.profileId).toBe("canonical-raster-srgb8-lossless-webp-v1");
      return ingest;
    }) };
    const variantGenerator = { generate: vi.fn(async (received: {
      contentId: string;
      ingestResult: MediaIngestResult;
      profileId: "photo-hero-v1";
      profileSha256: string;
    }) => {
      order.push("variants");
      expect(received.contentId).toBe(request.target.contentId);
      expect(received.profileId).toBe("photo-hero-v1");
      expect(received.profileId).not.toBe(request.profileId);
      expect(received.profileSha256).toBe(variantProfile.profileSha256);
      return variants;
    }) };
    const boundary: MediaIngestBoundary = {
      canonicalProcessor,
      visualAuditGate: {
        assertApproved: vi.fn(async (target) => {
          order.push("visual-audit");
          expect(target.canonicalMasterSha256).toBe(ingest.canonicalMaster.sha256);
        }),
      },
      variantGenerator,
    };
    await processAuditedMedia(boundary, {
      request,
      candidateSha256: hash("7"),
      variantProfileId: "photo-hero-v1",
    });
    expect(order).toEqual(["canonical", "visual-audit", "variants"]);
    expect(canonicalProcessor.ingest).toHaveBeenCalledWith(request);
    expect(variantGenerator.generate).toHaveBeenCalledOnce();
  });

  it("does not generate variants when visual audit rejects the canonical target", async () => {
    const generate = vi.fn(async () => variants);
    const boundary: MediaIngestBoundary = {
      canonicalProcessor: { ingest: vi.fn(async () => ingest) },
      visualAuditGate: { assertApproved: vi.fn(async () => { throw new Error("visual audit rejected"); }) },
      variantGenerator: { generate },
    };
    await expect(processAuditedMedia(boundary, {
      request,
      candidateSha256: hash("7"),
      variantProfileId: "photo-hero-v1",
    })).rejects.toThrow(/rejected/);
    expect(generate).not.toHaveBeenCalled();
  });

  it("rejects an unknown delivery profile before canonical processing", async () => {
    const boundary: MediaIngestBoundary = {
      canonicalProcessor: { ingest: vi.fn(async () => ingest) },
      visualAuditGate: { assertApproved: vi.fn(async () => undefined) },
      variantGenerator: { generate: vi.fn(async () => variants) },
    };
    await expect(processAuditedMedia(boundary, {
      request,
      candidateSha256: hash("7"),
      variantProfileId: "unknown-profile" as "photo-hero-v1",
    })).rejects.toThrow(/Unknown media variant profile/);
    expect(boundary.canonicalProcessor.ingest).not.toHaveBeenCalled();
  });

  it("rejects a forged caller-supplied delivery profile SHA", async () => {
    const boundary: MediaIngestBoundary = {
      canonicalProcessor: { ingest: vi.fn(async () => ingest) },
      visualAuditGate: { assertApproved: vi.fn(async () => undefined) },
      variantGenerator: { generate: vi.fn(async () => variants) },
    };
    const forged = {
      request,
      candidateSha256: hash("7"),
      variantProfileId: "photo-hero-v1",
      variantProfileSha256: hash("f"),
    } as AuditedMediaProcessingRequest;
    await expect(processAuditedMedia(boundary, forged)).rejects.toThrow(/Caller-supplied/);
    expect(boundary.variantGenerator.generate).not.toHaveBeenCalled();
  });

  it.each([
    ["wrong profile ID", { ...variants, profileId: "photo-inline-v1" }],
    ["wrong profile SHA", { ...variants, profileSha256: hash("f") }],
  ])("rejects a generator manifest with %s", async (_label, returnedManifest) => {
    const boundary: MediaIngestBoundary = {
      canonicalProcessor: { ingest: vi.fn(async () => ingest) },
      visualAuditGate: { assertApproved: vi.fn(async () => undefined) },
      variantGenerator: { generate: vi.fn(async () => returnedManifest as MediaVariantManifest) },
    };
    await expect(processAuditedMedia(boundary, {
      request,
      candidateSha256: hash("7"),
      variantProfileId: "photo-hero-v1",
    })).rejects.toThrow(/profile binding mismatch/);
  });
});
