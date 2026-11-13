import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, expect, it } from "vitest";
import { mediaAnimationSchema } from "@xpotato/content-contracts";
import { animationFromMetadata, inspectAnimationBytes, encodeAnimation, animationContactSheet } from "./animation.js";
import { canonicalAnimationProfile, canonicalRasterProfile, getMediaVariantProfileBinding } from "./profiles.js";
import { SharpCanonicalMediaProcessor, SharpDeliveryVariantGenerator, generatePublicDeliveryMaster } from "./sharp-runtime.js";

const temporary: string[] = [];
afterEach(async () => { for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true }); });
async function gif() {
  const pixels = Buffer.concat(["ff0000", "00ff00", "0000ff"].map(color => Buffer.from(color.repeat(32 * 16), "hex")));
  return sharp(pixels, { raw: { width: 32, height: 48, channels: 3, pageHeight: 16 } }).gif({ loop: 2, delay: [50, 120, 200] }).toBuffer();
}
it("preserves every decoded GIF frame, unequal delay and loop in canonical animated WebP", async () => {
  const source = await gif(), converted = await encodeAnimation(source), metadata = await inspectAnimationBytes(converted.data);
  expect(metadata).toMatchObject({ format: "webp", width: 32, height: 16, animation: { frameCount: 3, delaysMs: [50, 120, 200], loop: 2 } });
  const decode = (bytes: Buffer) => sharp(bytes, { animated: true }).ensureAlpha().raw().toBuffer();
  expect(await decode(converted.data)).toEqual(await decode(source));
  const sheet = await animationContactSheet(converted.data);
  expect(sheet.frameIndices).toEqual([0, 1, 2]);expect((await sharp(sheet.data).metadata()).format).toBe("webp");
});
it("uses a distinct audited profile, generates only moving WebP variants, and refuses silent static flattening", async () => {
  const root = await mkdtemp(join(tmpdir(), "media-motion-"));temporary.push(root);
  const path = join(root, "source.gif");await writeFile(path, await gif());
  const input = { schemaVersion: 1 as const, sourcePath: path, target: { contentId: "f8a847d4-8f5d-4bb0-a387-750f096479f2", semanticAssetId: "motion" }, kind: "diagram" as const, overwrite: false as const };
  const processor = new SharpCanonicalMediaProcessor("canonical", root);
  await expect(processor.ingest({ ...input, profileId: canonicalRasterProfile.id })).rejects.toThrow("ANIMATION_REQUIRES_EXPLICIT_PROFILE");
  const result = await processor.ingest({ ...input, profileId: canonicalAnimationProfile.id });
  const binding = getMediaVariantProfileBinding("animation-inline-v1");
  const variants = await new SharpDeliveryVariantGenerator("variants", root).generate({ contentId: input.target.contentId, ingestResult: result, ...binding });
  expect(result.canonicalMaster.animation?.frameCount).toBe(3);expect(variants.variants).toHaveLength(1);
  for (const item of variants.variants) {
    expect(item.format).toBe("webp");expect([item.width, item.height]).toEqual([32, 16]);
    await inspectAnimationBytes(await readFile(join(root, item.privateRelativePath)), result.canonicalMaster.animation);
  }
  const master = await generatePublicDeliveryMaster(result, "animation-inline-v1", "public", root);
  expect(master.contentType).toBe("image/webp");expect([master.width, master.height]).toEqual([32, 16]);
  await expect(generatePublicDeliveryMaster(result, "screenshot-ui-v1", "public", root)).rejects.toThrow("ANIMATION_DELIVERY_PROFILE_MISMATCH");
});
it("rejects malformed frames, unauthorized timing changes, static input and resource overflow", async () => {
  const source = await gif(), inspected = await inspectAnimationBytes(source);
  await expect(inspectAnimationBytes(source, { ...inspected.animation, loop: 0 })).rejects.toThrow("ANIMATION_TIMING_CHANGED");
  await expect(inspectAnimationBytes(source.subarray(0, source.length - 15))).rejects.toThrow();
  const still = await sharp({ create: { width: 1, height: 1, channels: 3, background: "red" } }).webp().toBuffer();
  await expect(inspectAnimationBytes(still)).rejects.toThrow("ANIMATION_PROFILE_INVALID");
  expect(() => animationFromMetadata({ ...inspected.metadata, width: 8192, pageHeight: 8192 })).toThrow("ANIMATION_PROFILE_INVALID");
  expect(mediaAnimationSchema.safeParse({ frameCount: 2, delaysMs: [50], loop: 0 }).success).toBe(false);
  expect(mediaAnimationSchema.safeParse({ frameCount: 3, delaysMs: [60000, 60000, 60000], loop: 0 }).success).toBe(false);
});

it("coalesces identical holds only when every pixel and time interval is unchanged", async () => {
  const pixels = Buffer.concat(["ff0000", "ff0000", "0000ff"].map(color => Buffer.from(color.repeat(32 * 16), "hex")));
  const source = await sharp(pixels, { raw: { width: 32, height: 48, channels: 3, pageHeight: 16 } })
    .gif({ keepDuplicateFrames: true, loop: 0, delay: [100, 150, 200] }).toBuffer();
  const converted = await encodeAnimation(source);
  expect((await inspectAnimationBytes(source)).animation.frameCount).toBe(3);
  expect(converted.animation).toEqual({ frameCount: 2, delaysMs: [250, 200], loop: 0 });
  const { assertAnimationPlaybackEquivalent } = await import("./animation.js");
  await expect(assertAnimationPlaybackEquivalent(source, converted.data)).resolves.toMatch(/^[a-f0-9]{64}$/u);
  // Same total duration, changed boundary: a duration-only check would miss it.
  const changedTiming = await sharp(source, { animated: true }).webp({ lossless: true, delay: [100, 100, 250], loop: 0 }).toBuffer();
  await expect(assertAnimationPlaybackEquivalent(source, changedTiming)).rejects.toThrow("ANIMATION_PLAYBACK_CHANGED");
  const changedPixels = await sharp(source, { animated: true }).negate().webp({ lossless: true, delay: [100, 150, 200], loop: 0 }).toBuffer();
  await expect(assertAnimationPlaybackEquivalent(source, changedPixels)).rejects.toThrow("ANIMATION_PLAYBACK_CHANGED");
  const changedLoop = await sharp(source, { animated: true }).webp({ lossless: true, delay: [100, 150, 200], loop: 1 }).toBuffer();
  await expect(assertAnimationPlaybackEquivalent(source, changedLoop)).rejects.toThrow("ANIMATION_PLAYBACK_CHANGED");
});

it("bounds timeline thumbnails even for an extreme source aspect ratio", async () => {
  const pixels=Buffer.concat(["ff0000","0000ff"].map(c=>Buffer.from(c.repeat(8192),"hex")));
  const source=await sharp(pixels,{raw:{width:1,height:16384,channels:3,pageHeight:8192}}).gif({loop:0,delay:[50,50]}).toBuffer();
  const sheet=await animationContactSheet(source),metadata=await sharp(sheet.data).metadata();
  expect(metadata.width).toBeLessThanOrEqual(1280);expect(metadata.height).toBeLessThanOrEqual(798);
  expect(metadata.width!*metadata.height!).toBeLessThanOrEqual(1280*798);
});

it("omits heavier lossless resizes and retains the smaller full-width master as a variant",async()=>{
 const root=await mkdtemp(join(tmpdir(),"motion-byte-choice-"));temporary.push(root);
 const pixels=Buffer.alloc(800*16*2*3);
 for(let frame=0;frame<2;frame++)for(let y=0;y<16;y++)for(let x=0;x<800;x++){
  const offset=((frame*16+y)*800+x)*3,value=(x%2===frame)?255:0;
  pixels[offset]=value;pixels[offset+1]=value;pixels[offset+2]=value;
 }
 const source=await sharp(pixels,{raw:{width:800,height:32,channels:3,pageHeight:16}}).gif({loop:0,delay:[50,150]}).toBuffer();
 const path=join(root,"stripe.gif");await writeFile(path,source);
 const input={schemaVersion:1 as const,sourcePath:path,target:{contentId:"f8a847d4-8f5d-4bb0-a387-750f096479f2",semanticAssetId:"motion"},kind:"diagram" as const,profileId:canonicalAnimationProfile.id,overwrite:false as const};
 const ingest=await new SharpCanonicalMediaProcessor("canonical",root).ingest(input),canonical=await readFile(join(root,ingest.canonicalMaster.privateRelativePath));
 const master=await generatePublicDeliveryMaster(ingest,"animation-inline-v1","public",root),resized=await encodeAnimation(canonical,480);
 expect(resized.data.length).toBeGreaterThan(master.sizeBytes);
 const variants=await new SharpDeliveryVariantGenerator("variants",root).generate({contentId:input.target.contentId,ingestResult:ingest,...getMediaVariantProfileBinding("animation-inline-v1")});
 expect(variants.variants.every(v=>v.sizeBytes<=master.sizeBytes&&v.width<=master.width)).toBe(true);
 expect(variants.variants.some(v=>v.sha256===master.sha256&&v.width===master.width)).toBe(true);
 expect(variants.variants.some(v=>v.width===480)).toBe(false);
});
