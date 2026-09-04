import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { fingerprint } from "@xpotato/content-contracts/canonical";
import {
  canonicalRasterProfile,
  diagramSvgProfile,
  getMediaVariantProfileBinding,
} from "./profiles.js";
import {
  generatePublicDeliveryMaster,
  sanitizeSvg,
  SharpCanonicalMediaProcessor,
  SharpDeliveryVariantGenerator,
} from "./sharp-runtime.js";

const root = ".local/test-media-runtime";
const contentId = "f8a847d4-8f5d-4bb0-a387-750f096479f2";

afterEach(async () => {
  await rm(resolve(process.cwd(), root), { recursive: true, force: true });
});

describe("Sharp media runtime", () => {
  it("sanitizes deterministic SVG and rasterizes a fixed social PNG", async () => {
    await mkdir(resolve(process.cwd(), root), { recursive: true });
    const sourcePath = `${root}/social.svg`;
    await writeFile(resolve(process.cwd(), sourcePath), '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#123456"/></svg>\n');
    const processor = new SharpCanonicalMediaProcessor(`${root}/canonical`);
    const ingest = await processor.ingest({
      schemaVersion: 1,
      sourcePath,
      target: { contentId, semanticAssetId: "social-card" },
      kind: "diagram",
      profileId: diagramSvgProfile.id,
      overwrite: false,
    });
    expect(ingest.processing.profileSha256).toBe(fingerprint(diagramSvgProfile));
    expect(ingest.canonicalMaster.format).toBe("svg");
    const master = await generatePublicDeliveryMaster(ingest, "social-card-v1", `${root}/public`);
    expect(master.format).toBe("png");
    expect([master.width, master.height]).toEqual([1200, 630]);
  });

  it("creates lossless canonical raster and bounded screenshot variants with the real ContentId", async () => {
    await mkdir(resolve(process.cwd(), root), { recursive: true });
    const sourcePath = `${root}/screen.png`;
    const source = await sharp({
      create: { width: 900, height: 500, channels: 4, background: { r: 16, g: 32, b: 48, alpha: 1 } },
    }).png().toBuffer();
    await writeFile(resolve(process.cwd(), sourcePath), source);
    const processor = new SharpCanonicalMediaProcessor(`${root}/canonical`);
    const ingest = await processor.ingest({
      schemaVersion: 1,
      sourcePath,
      target: { contentId, semanticAssetId: "overview" },
      kind: "screenshot",
      profileId: canonicalRasterProfile.id,
      overwrite: false,
    });
    expect(ingest.canonicalMaster.format).toBe("webp");
    expect(ingest.processing.metadataStripped).toBe(true);
    const binding = getMediaVariantProfileBinding("screenshot-ui-v1");
    const variants = await new SharpDeliveryVariantGenerator(`${root}/variants`).generate({
      contentId,
      ingestResult: ingest,
      profileId: binding.profileId,
      profileSha256: binding.profileSha256,
    });
    expect(variants.contentId).toBe(contentId);
    expect(variants.status).toBe("generated");
    expect(new Set(variants.variants.map((item) => item.format))).toEqual(new Set(["webp", "png"]));
    expect(Math.max(...variants.variants.map((item) => item.width))).toBeLessThanOrEqual(900);
    const publicMaster = await generatePublicDeliveryMaster(ingest, "screenshot-ui-v1", `${root}/public`);
    expect(publicMaster.format).toBe("png");
    expect(publicMaster.width).toBe(900);
  });

  it("fails closed on active or externally referenced SVG", () => {
    expect(() => sanitizeSvg('<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>')).toThrow(/active content/);
    expect(() => sanitizeSvg('<svg viewBox="0 0 10 10"><image href="https://example.com/x.png"/></svg>')).toThrow(/external references/);
  });
});
