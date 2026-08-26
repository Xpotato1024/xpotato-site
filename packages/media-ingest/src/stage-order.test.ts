import { describe, expect, it, vi } from "vitest";
import type { MediaIngestRequest, MediaIngestResult, MediaVariantManifest } from "@xpotato/content-contracts";
import { processAuditedMedia, type MediaIngestBoundary } from "./index.js";

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
const variants: MediaVariantManifest = {
  schemaVersion: 1,
  contentId: request.target.contentId,
  assetId: "hero",
  masterSha256: ingest.canonicalMaster.sha256,
  profileId: "photo-hero-v1",
  profileSha256: hash("5"),
  toolchainId: "media-toolchain-v1",
  toolchainSha256: hash("4"),
  status: "not_required",
  variants: [],
  warnings: [],
  manifestSha256: hash("6"),
};

describe("media processing stage order", () => {
  it("materializes canonical audit target before visual audit and variants", async () => {
    const order: string[] = [];
    const boundary: MediaIngestBoundary = {
      canonicalProcessor: { ingest: vi.fn(async () => { order.push("canonical"); return ingest; }) },
      visualAuditGate: {
        assertApproved: vi.fn(async (target) => {
          order.push("visual-audit");
          expect(target.canonicalMasterSha256).toBe(ingest.canonicalMaster.sha256);
        }),
      },
      variantGenerator: { generate: vi.fn(async () => { order.push("variants"); return variants; }) },
    };
    await processAuditedMedia(boundary, { request, candidateSha256: hash("7"), profileSha256: hash("5") });
    expect(order).toEqual(["canonical", "visual-audit", "variants"]);
  });

  it("does not generate variants when visual audit rejects the canonical target", async () => {
    const generate = vi.fn(async () => variants);
    const boundary: MediaIngestBoundary = {
      canonicalProcessor: { ingest: vi.fn(async () => ingest) },
      visualAuditGate: { assertApproved: vi.fn(async () => { throw new Error("visual audit rejected"); }) },
      variantGenerator: { generate },
    };
    await expect(processAuditedMedia(boundary, { request, candidateSha256: hash("7"), profileSha256: hash("5") })).rejects.toThrow(/rejected/);
    expect(generate).not.toHaveBeenCalled();
  });
});
