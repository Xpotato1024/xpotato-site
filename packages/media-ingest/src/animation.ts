import sharp, { type Metadata } from "sharp";
import { sha256 } from "@xpotato/content-contracts/canonical";
import { mediaAnimationSchema, type MediaAnimation } from "@xpotato/content-contracts";
import { canonicalAnimationProfile } from "./profiles.js";

export const animationLimits = Object.freeze({
  maxBytes: 24 * 1024 * 1024,
  maxFrames: canonicalAnimationProfile.animation!.maxFrames,
  maxTotalPixels: canonicalAnimationProfile.animation!.maxTotalPixels,
  maxDurationMs: canonicalAnimationProfile.animation!.maxDurationMs,
});
export type AnimationInspection = { width: number; height: number; format: "gif" | "webp"; animation: MediaAnimation; metadata: Metadata };

export function animationFromMetadata(metadata: Metadata): AnimationInspection {
  const frameCount = metadata.pages ?? 1, width = metadata.width, height = metadata.pageHeight;
  if (!["gif", "webp"].includes(metadata.format ?? "") || !width || !height || frameCount < 2
    || frameCount > animationLimits.maxFrames || width * height * frameCount > animationLimits.maxTotalPixels
    || width > 8192 || height > 8192) throw Error("ANIMATION_PROFILE_INVALID");
  const animation = mediaAnimationSchema.parse({ frameCount, delaysMs: metadata.delay, loop: metadata.loop ?? 1 });
  return { width, height, format: metadata.format as "gif" | "webp", animation, metadata };
}
export function assertAnimationTiming(actual: MediaAnimation, expected: MediaAnimation) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error("ANIMATION_TIMING_CHANGED");
}
function assertCompleteContainer(bytes: Uint8Array) {
  const data = Buffer.from(bytes);
  if (data.subarray(0, 4).toString() === "RIFF") {
    if (data.length < 12 || data.readUInt32LE(4) + 8 !== data.length || data.subarray(8, 12).toString() !== "WEBP") throw Error("ANIMATION_CONTAINER_TRUNCATED");
    let offset = 12;
    while (offset < data.length) {
      if (offset + 8 > data.length) throw Error("ANIMATION_CONTAINER_TRUNCATED");
      const length = data.readUInt32LE(offset + 4);offset += 8 + length + (length % 2);
      if (offset > data.length) throw Error("ANIMATION_CONTAINER_TRUNCATED");
    }
    return;
  }
  if (!/^GIF8[79]a$/u.test(data.subarray(0, 6).toString()) || data.length < 14) throw Error("ANIMATION_CONTAINER_INVALID");
  let offset = 13 + ((data[10]! & 128) ? 3 * 2 ** ((data[10]! & 7) + 1) : 0), frames = 0;
  const subblocks = () => {
    while (true) {
      if (offset >= data.length) throw Error("ANIMATION_CONTAINER_TRUNCATED");
      const length = data[offset++]!;if (!length) return;offset += length;
      if (offset > data.length) throw Error("ANIMATION_CONTAINER_TRUNCATED");
    }
  };
  while (offset < data.length) {
    const marker = data[offset++]!;
    if (marker === 0x3b) {
      if (offset !== data.length || frames < 2) throw Error("ANIMATION_CONTAINER_INVALID");
      return;
    }
    if (marker === 0x21) { if (offset >= data.length) throw Error("ANIMATION_CONTAINER_TRUNCATED");offset++;subblocks();continue; }
    if (marker !== 0x2c || offset + 9 > data.length) throw Error("ANIMATION_CONTAINER_INVALID");
    const packed = data[offset + 8]!;offset += 9;
    if (packed & 128) offset += 3 * 2 ** ((packed & 7) + 1);
    if (offset >= data.length) throw Error("ANIMATION_CONTAINER_TRUNCATED");
    const codeSize = data[offset++]!;if (codeSize < 2 || codeSize > 8) throw Error("ANIMATION_CONTAINER_INVALID");
    subblocks();frames++;
  }
  throw Error("ANIMATION_CONTAINER_TRUNCATED");
}

/** Metadata bounds are checked before a full decode of every frame. */
export async function inspectAnimationBytes(bytes: Buffer | Uint8Array, expected?: MediaAnimation): Promise<AnimationInspection> {
  if (bytes.length > animationLimits.maxBytes) throw Error("ANIMATION_BYTES_LIMIT");
  assertCompleteContainer(bytes);
  const image = sharp(bytes, { animated: true, limitInputPixels: animationLimits.maxTotalPixels, failOn: "error" });
  const result = animationFromMetadata(await image.metadata());
  if (expected) assertAnimationTiming(result.animation, expected);
  await image.stats();
  return result;
}
/** Adjacent identical RGBA frames may be coalesced by WebP. Compare the
 * complete piecewise-constant playback, never just total duration or samples. */
async function playbackRuns(bytes: Buffer, width?: number) {
  const source = await inspectAnimationBytes(bytes);
  let image = sharp(bytes, { animated: true, limitInputPixels: animationLimits.maxTotalPixels, failOn: "error" }).toColourspace("srgb");
  if (width !== undefined) image = image.resize({ width, withoutEnlargement: true });
  const decoded = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const height = decoded.info.height / source.animation.frameCount, stride = decoded.info.width * height * 4;
  if (!Number.isInteger(height) || decoded.data.length !== stride * source.animation.frameCount) throw Error("ANIMATION_DECODE_SET_INVALID");
  const runs: { sha256: string; durationMs: number }[] = [];
  for (let frame = 0; frame < source.animation.frameCount; frame++) {
    const hash = sha256(decoded.data.subarray(frame * stride, (frame + 1) * stride)), durationMs = source.animation.delaysMs[frame]!;
    const last = runs.at(-1);
    if (last?.sha256 === hash) last.durationMs += durationMs;else runs.push({ sha256: hash, durationMs });
  }
  return { width: decoded.info.width, height, loop: source.animation.loop, runs };
}
export const animationPlaybackFingerprint = async (bytes: Buffer, resizedWidth?: number) => sha256(JSON.stringify(await playbackRuns(bytes, resizedWidth)));
export async function assertAnimationPlaybackEquivalent(source: Buffer, output: Buffer, resizedWidth?: number) {
  const before = await playbackRuns(source, resizedWidth), after = await playbackRuns(output);
  if (JSON.stringify(before) !== JSON.stringify(after)) throw Error("ANIMATION_PLAYBACK_CHANGED");
  return sha256(JSON.stringify(before));
}

export async function encodeAnimation(bytes: Buffer, width?: number): Promise<{ data: Buffer; width: number; height: number; animation: MediaAnimation; playbackSha256: string }> {
  const source = await inspectAnimationBytes(bytes);
  let pipeline = sharp(bytes, { animated: true, limitInputPixels: animationLimits.maxTotalPixels, failOn: "error" }).toColourspace("srgb");
  if (width !== undefined) pipeline = pipeline.resize({ width, withoutEnlargement: true });
  const data = await pipeline.webp({ lossless: true, exact: true, effort: 6, loop: source.animation.loop, delay: source.animation.delaysMs }).toBuffer();
  const result = await inspectAnimationBytes(data);
  const playbackSha256 = await assertAnimationPlaybackEquivalent(bytes, data, width);
  if (result.metadata.exif || result.metadata.iptc || result.metadata.xmp || result.metadata.orientation) throw Error("ANIMATION_PRIVATE_METADATA_RETAINED");
  return { data, width: result.width, height: result.height, animation: result.animation, playbackSha256 };
}
/** Twelve time-ordered samples supplement (not replace) the all-frame decoder
 * check. The sheet is private review evidence, never a publication object. */
export async function animationContactSheet(bytes: Buffer) {
  const source = await inspectAnimationBytes(bytes);
  const count = Math.min(12, source.animation.frameCount);
  const indices = [...new Set(Array.from({ length: count }, (_, i) =>
    Math.round(i * (source.animation.frameCount - 1) / (count - 1))))];
  const width = 320, imageHeight = 240, labelHeight = 26;
  const columns = Math.min(4, indices.length), rows = Math.ceil(indices.length / columns);
  const composites = [];
  for (const [position, frame] of indices.entries()) {
    const thumbnail = await sharp(bytes, { page: frame, pages: 1, limitInputPixels: animationLimits.maxTotalPixels, failOn: "error" })
      .resize({ width, height: imageHeight, fit: "contain", withoutEnlargement: true, background: "white" }).png().toBuffer();
    const time = source.animation.delaysMs.slice(0, frame).reduce((sum, delay) => sum + delay, 0);
    const label = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + labelHeight
      + '"><rect width="100%" height="100%" fill="white"/><text x="8" y="18" fill="#222" font-size="14" font-family="sans-serif">frame '
      + frame + ' / ' + time + ' ms</text></svg>');
    const left = (position % columns) * width, top = Math.floor(position / columns) * (imageHeight + labelHeight);
    composites.push({ input: thumbnail, left, top }, { input: label, left, top: top + imageHeight });
  }
  const data = await sharp({ create: { width: columns * width, height: rows * (imageHeight + labelHeight), channels: 3, background: "white" } })
    .composite(composites).webp({ lossless: true, effort: 6 }).toBuffer();
  return { data, frameIndices: indices };
}
