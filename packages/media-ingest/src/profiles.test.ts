import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertHeifToolchain,
  canonicalRasterProfile,
  deliveryProfiles,
  frozenRasterProfileIds,
  getMediaVariantProfileBinding,
  publicMasterProfiles,
  qualityProfiles,
} from "./profiles.js";

describe("frozen media processing profiles", () => {
  it("uses the exact canonical-raster-srgb8-lossless-webp-v1 semantics", () => {
    expect(canonicalRasterProfile).toEqual({
      id: "canonical-raster-srgb8-lossless-webp-v1",
      kind: "raster",
      raster: {
        outputFormat: "webp",
        lossless: true,
        losslessCompressionLevel: 6,
        maxLongEdge: 8192,
        upscale: false,
        colorSpace: "srgb",
        bitDepth: 8,
        alpha: "preserve_if_present",
        orientation: "normalize_pixels",
        privateMetadata: "strip",
      },
    });
  });

  it("exports every frozen v1 ID without a silent alias or rename", () => {
    expect(frozenRasterProfileIds).toEqual([
      "canonical-raster-srgb8-lossless-webp-v1",
      "photo-inline-v1",
      "photo-hero-v1",
      "photo-gallery-v1",
      "photo-overview-v1",
      "screenshot-ui-v1",
      "social-card-v1",
    ]);
    expect(deliveryProfiles).not.toHaveProperty("screenshot-v1");
  });

  it("fixes all photo widths, public masters, and numeric quality profiles", () => {
    expect(deliveryProfiles["photo-inline-v1"].widths).toEqual([480, 768, 1200, 1800]);
    expect(deliveryProfiles["photo-hero-v1"].widths).toEqual([640, 960, 1440, 1920, 2560]);
    expect(deliveryProfiles["photo-gallery-v1"].widths).toEqual([320, 640, 960, 1280]);
    expect(deliveryProfiles["photo-overview-v1"].widths).toEqual([640, 960, 1440, 1920]);
    expect(publicMasterProfiles["photo-inline-v1"]).toEqual({
      longEdgeMax: 2560,
      format: "jpeg",
      quality: 90,
      chromaSubsampling: "4:4:4_if_supported_else_encoder_high_quality_default",
    });
    expect(publicMasterProfiles["photo-hero-v1"]).toEqual({ longEdgeMax: 2560, format: "jpeg", quality: 90 });
    expect(publicMasterProfiles["photo-gallery-v1"]).toEqual({ longEdgeMax: 1920, format: "jpeg", quality: 88 });
    expect(publicMasterProfiles["photo-overview-v1"]).toEqual({ longEdgeMax: 2560, format: "jpeg", quality: 90 });
    expect(deliveryProfiles["photo-inline-v1"].formats.map((format) => format.qualityProfileId)).toEqual(["avif-q50", "webp-q80", "jpeg-q85"]);
    expect(deliveryProfiles["photo-hero-v1"].formats.map((format) => format.qualityProfileId)).toEqual(["avif-q55", "webp-q82", "jpeg-q86"]);
    expect(deliveryProfiles["photo-gallery-v1"].formats.map((format) => format.qualityProfileId)).toEqual(["avif-q48", "webp-q78", "jpeg-q82"]);
    expect(deliveryProfiles["photo-overview-v1"].formats.map((format) => format.qualityProfileId)).toEqual(["avif-q52", "webp-q80", "jpeg-q85"]);
    expect(qualityProfiles).toMatchObject({
      "avif-q48": { quality: 48 }, "avif-q50": { quality: 50 }, "avif-q52": { quality: 52 }, "avif-q55": { quality: 55 },
      "webp-q78": { quality: 78 }, "webp-q80": { quality: 80 }, "webp-q82": { quality: 82 },
      "jpeg-q82": { quality: 82 }, "jpeg-q85": { quality: 85 }, "jpeg-q86": { quality: 86 },
    });
  });

  it("keeps screenshot and social outputs lossless with the frozen dimensions", () => {
    expect(publicMasterProfiles["screenshot-ui-v1"]).toEqual({ longEdgeMax: 2560, format: "png", lossless: true });
    expect(deliveryProfiles["screenshot-ui-v1"].formats).toEqual([
      { format: "webp", qualityProfileId: "webp-lossless-c6", lossless: true },
      { format: "png", qualityProfileId: "png-lossless-optimized", lossless: true },
    ]);
    expect(publicMasterProfiles["social-card-v1"]).toEqual({
      width: 1200,
      height: 630,
      format: "png",
      lossless: true,
      responsiveVariants: "none",
    });
    expect(deliveryProfiles["social-card-v1"].widths).toEqual([]);
  });

  it("resolves every Phase 6 review variant profile against the frozen registry", async () => {
    const proposal = JSON.parse(
      await readFile(resolve(process.cwd(), "docs/migration/media-review-proposal-v1.json"), "utf8"),
    ) as {
      decisions: Array<{ assetPlans: Array<{ variantProfileId?: string }> }>;
      blogPublicationPlans: Array<{ socialCard: { variantProfileId: string } }>;
    };
    const ids = [
      ...proposal.decisions.flatMap((decision) => decision.assetPlans.map((plan) => plan.variantProfileId).filter((value): value is string => value !== undefined)),
      ...proposal.blogPublicationPlans.map((plan) => plan.socialCard.variantProfileId),
    ];
    expect(ids).not.toContain("project-overview-v1");
    expect(ids.filter((id) => id === "screenshot-ui-v1")).toHaveLength(3);
    for (const id of ids) expect(() => getMediaVariantProfileBinding(id)).not.toThrow();
  });

  it("does not assume default HEIC support", () => {
    expect(() => assertHeifToolchain("heic")).toThrow(/dedicated/);
    expect(() => assertHeifToolchain("jpeg")).not.toThrow();
  });
});
