import { describe, expect, it } from "vitest";
import { assertHeifToolchain, canonicalRasterProfile, deliveryProfiles, publicMasterProfiles } from "./profiles.js";

describe("frozen media processing profiles", () => {
  it("uses the canonical lossless sRGB 8-bit profile without upscale", () => {
    expect(canonicalRasterProfile.raster).toMatchObject({
      outputFormat: "webp",
      lossless: true,
      maxLongEdge: 8192,
      colorSpace: "srgb",
      bitDepth: 8,
      autoOrient: true,
      stripPrivateMetadata: true,
    });
  });

  it("fixes initial responsive width sets and social dimensions", () => {
    expect(deliveryProfiles["photo-inline-v1"].widths).toEqual([480, 768, 1200, 1800]);
    expect(deliveryProfiles["photo-hero-v1"].widths).toEqual([640, 960, 1440, 1920, 2560]);
    expect(deliveryProfiles["photo-gallery-v1"].widths).toEqual([320, 640, 960, 1280]);
    expect(publicMasterProfiles["social-card-v1"]).toEqual({ width: 1200, height: 630, format: "png" });
  });

  it("does not assume default HEIC support", () => {
    expect(() => assertHeifToolchain("heic")).toThrow(/dedicated/);
    expect(() => assertHeifToolchain("jpeg")).not.toThrow();
  });
});
