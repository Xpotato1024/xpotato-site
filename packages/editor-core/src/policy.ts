export const KiB = 1024,
  MiB = 1024 * KiB;
/** Sole machine-readable owner; docs and the editor display these values. */
export const mediaPolicy = Object.freeze({
  version: 1,
  inputBytes: 24 * MiB,
  quotaBytes: 2_000_000_000,
  previewBytes: 256 * KiB,
  maxPixels: 64 * 1024 * 1024,
  maxDimension: 8192,
  maxFrames: 600,
  maxDurationMs: 120000,
  leaseMs: 15 * 60 * 1000,
  rawHours: 24,
  photo: { maxBytes: 4 * MiB, targetBytes: MiB, maxEdge: 2560, quality: 0.83 },
  technical: { maxBytes: 8 * MiB, targetBytes: 2 * MiB },
  animation: { maxBytes: 8 * MiB, targetBytes: 4 * MiB },
});
export type MediaKind = "photo" | "technical" | "animation";
export function assertMediaBudget(kind: MediaKind, size: number): void {
  if (!Number.isSafeInteger(size) || size <= 0 || size > mediaPolicy[kind].maxBytes)
    throw Error("MEDIA_BYTES_LIMIT");
}
export function sniffMedia(
  bytes: Uint8Array,
): "image/png" | "image/jpeg" | "image/webp" | "image/gif" | "image/heic" {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes[0] === 137 && ascii(1, 4) === "PNG" && bytes[4] === 13 && bytes[5] === 10)
    return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (["GIF87a", "GIF89a"].includes(ascii(0, 6))) return "image/gif";
  if (ascii(4, 8) === "ftyp" && /heic|heix|hevc|hevx|mif1|msf1/u.test(ascii(8, 48)))
    return "image/heic";
  throw Error("MEDIA_FORMAT_UNSUPPORTED");
}
export function classifyContainer(bytes: Uint8Array): { mime: string; animated: boolean } {
  const mime = sniffMedia(bytes);
  const ascii = String.fromCharCode(...bytes.slice(0, 64));
  return {
    mime,
    animated:
      mime === "image/gif" ||
      (mime === "image/webp" &&
        (ascii.includes("ANIM") ||
          (ascii.slice(12, 16) === "VP8X" && Boolean((bytes[20] ?? 0) & 2)))),
  };
}
export const retentionPolicy = Object.freeze({
  warnDays: 30,
  archiveDays: 60,
  candidateDays: 90,
  graceDays: 30,
  rejectedDays: 30,
  reviewLeaseDays: 7,
  maxHoldDays: 90,
});
export function quotaState(used: number, reserved = 0) {
  const total = used + reserved;
  return {
    used,
    reserved,
    limit: mediaPolicy.quotaBytes,
    ratio: total / mediaPolicy.quotaBytes,
    state:
      total >= mediaPolicy.quotaBytes
        ? "full"
        : total >= mediaPolicy.quotaBytes * 0.9
          ? "cleanup"
          : total >= mediaPolicy.quotaBytes * 0.75
            ? "warning"
            : "normal",
  } as const;
}
