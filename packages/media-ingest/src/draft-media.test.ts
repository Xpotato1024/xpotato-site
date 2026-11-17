import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { prepareDraftMedia, decodeHeif } from "./draft-media.js";
import { assertAnimationPlaybackEquivalent } from "./animation.js";
import { mediaPolicy } from "@xpotato/editor-core/policy";
const image = () =>
  sharp({
    create: {
      width: 32,
      height: 24,
      channels: 4,
      background: { r: 123, g: 31, b: 223, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
async function motion() {
  const pixels = Buffer.concat(
    ["ff0000", "00ff00", "0000ff"].map((color) => Buffer.from(color.repeat(32 * 16), "hex")),
  );
  return sharp(pixels, { raw: { width: 32, height: 48, channels: 3, pageHeight: 16 } })
    .gif({ loop: 2, delay: [50, 120, 200] })
    .toBuffer();
}
describe("Draft and AI media use the same bounded policy", () => {
  it("requires acknowledgement before a lossy photo derivative", async () => {
    await expect(prepareDraftMedia(await image(), "photo")).rejects.toThrow(
      "LOSSY_CONVERSION_REQUIRES_ACKNOWLEDGEMENT",
    );
    const result = await prepareDraftMedia(await image(), "photo", { allowLossy: true });
    expect(result.metadata).toMatchObject({
      kind: "photo",
      mime: "image/webp",
      lossy: true,
      metadataStripped: true,
      sourceRetained: false,
      width: 32,
      height: 24,
    });
    expect(result.metadata.sha256).not.toBe(result.metadata.sourceSha256);
    expect(result.master.length).toBeLessThanOrEqual(mediaPolicy.photo.maxBytes);
  });
  it("preserves all decoded technical pixels and alpha without upscaling", async () => {
    const input = await image(),
      result = await prepareDraftMedia(input, "technical");
    const decode = (bytes: Buffer) => sharp(bytes).ensureAlpha().raw().toBuffer();
    expect(await decode(result.master)).toEqual(await decode(input));
    expect(result.metadata).toMatchObject({ lossy: false, resized: false, width: 32, height: 24 });
    expect(result.preview.length).toBeLessThanOrEqual(mediaPolicy.previewBytes);
  });
  it("keeps every animation interval and loop while converting to WebP", async () => {
    const input = await motion(),
      result = await prepareDraftMedia(input, "animation");
    expect(result.metadata.animation).toEqual({
      frameCount: 3,
      loop: 2,
      delaysMs: [50, 120, 200],
      durationMs: 370,
    });
    await expect(assertAnimationPlaybackEquivalent(input, result.master)).resolves.toBe(
      result.metadata.playbackSha256,
    );
    expect(result.metadata.lossy).toBe(false);
    expect((await sharp(result.preview).metadata()).pages ?? 1).toBe(1);
  });
  it("refuses to flatten animation or claim a still picture is animated", async () => {
    await expect(prepareDraftMedia(await motion(), "photo", { allowLossy: true })).rejects.toThrow(
      "ANIMATION_PROFILE_REQUIRED",
    );
    await expect(prepareDraftMedia(await image(), "animation")).rejects.toThrow(
      "ANIMATION_REQUIRED",
    );
  });
  it("removes private EXIF in the retained and preview bytes", async () => {
    const input = await sharp(await image())
      .withExif({ IFD0: { Artist: "PRIVATE-FIXTURE", Copyright: "PRIVATE-FIXTURE" } })
      .jpeg()
      .toBuffer();
    const result = await prepareDraftMedia(input, "photo", { allowLossy: true });
    expect((await sharp(result.master).metadata()).exif).toBeUndefined();
    expect((await sharp(result.preview).metadata()).exif).toBeUndefined();
    expect(result.master.includes(Buffer.from("PRIVATE-FIXTURE"))).toBe(false);
  });
  it("rejects inputs and decoder budgets before consuming excessive resources", async () => {
    await expect(
      prepareDraftMedia(Buffer.alloc(mediaPolicy.inputBytes + 1), "technical"),
    ).rejects.toThrow("INPUT_BYTES_LIMIT");
    await expect(decodeHeif(new Uint8Array(1), 999999)).rejects.toThrow("HEIC_DECODE_BUDGET");
    await expect(decodeHeif(new Uint8Array([0, 1, 2, 3]), 1000)).rejects.toThrow();
  });
  it("bounds dimensions during photo conversion and preserves aspect ratio", async () => {
    const input = await sharp({
      create: { width: 3000, height: 1500, channels: 3, background: "white" },
    })
      .jpeg()
      .toBuffer();
    const result = await prepareDraftMedia(input, "photo", { allowLossy: true });
    expect([result.metadata.width, result.metadata.height]).toEqual([2560, 1280]);
    expect(result.metadata.resized).toBe(true);
  });
});
