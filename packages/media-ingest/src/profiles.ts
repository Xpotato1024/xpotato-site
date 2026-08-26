import { mediaIngestProfileSchema, mediaVariantProfileSchema } from "@xpotato/content-contracts";

export const canonicalRasterProfile = mediaIngestProfileSchema.parse({
  id: "canonical-raster-v1",
  kind: "raster",
  raster: {
    outputFormat: "webp",
    lossless: true,
    maxLongEdge: 8192,
    colorSpace: "srgb",
    bitDepth: 8,
    autoOrient: true,
    stripPrivateMetadata: true,
  },
});

const formats = (avif: string, webp: string, jpeg: string) => [
  { format: "avif" as const, qualityProfileId: avif },
  { format: "webp" as const, qualityProfileId: webp },
  { format: "jpeg" as const, qualityProfileId: jpeg },
];

export const deliveryProfiles = Object.freeze({
  "photo-inline-v1": mediaVariantProfileSchema.parse({
    schemaVersion: 1,
    id: "photo-inline-v1",
    usage: "inline",
    widths: [480, 768, 1200, 1800],
    formats: formats("avif-q50", "webp-q80", "jpeg-q85"),
    preserveOriginalWhenSmaller: true,
    upscale: false,
  }),
  "photo-hero-v1": mediaVariantProfileSchema.parse({
    schemaVersion: 1,
    id: "photo-hero-v1",
    usage: "hero",
    widths: [640, 960, 1440, 1920, 2560],
    formats: formats("avif-q55", "webp-q82", "jpeg-q86"),
    preserveOriginalWhenSmaller: true,
    upscale: false,
  }),
  "photo-gallery-v1": mediaVariantProfileSchema.parse({
    schemaVersion: 1,
    id: "photo-gallery-v1",
    usage: "gallery",
    widths: [320, 640, 960, 1280],
    formats: formats("avif-q48", "webp-q78", "jpeg-q82"),
    preserveOriginalWhenSmaller: true,
    upscale: false,
  }),
  "screenshot-v1": mediaVariantProfileSchema.parse({
    schemaVersion: 1,
    id: "screenshot-v1",
    usage: "inline",
    widths: [480, 768, 1200, 1800, 2560],
    formats: [
      { format: "webp", lossless: true },
      { format: "png", lossless: true },
    ],
    preserveOriginalWhenSmaller: true,
    upscale: false,
  }),
  "social-card-v1": mediaVariantProfileSchema.parse({
    schemaVersion: 1,
    id: "social-card-v1",
    usage: "social",
    widths: [1200],
    formats: [{ format: "png", lossless: true }],
    preserveOriginalWhenSmaller: false,
    upscale: false,
  }),
});

export const publicMasterProfiles = Object.freeze({
  "photo-inline-v1": { longEdgeMax: 2560, format: "jpeg", quality: 90 },
  "photo-hero-v1": { longEdgeMax: 2560, format: "jpeg", quality: 90 },
  "photo-gallery-v1": { longEdgeMax: 1920, format: "jpeg", quality: 88 },
  "screenshot-v1": { longEdgeMax: 2560, format: "webp", lossless: true, fallback: "png" },
  "social-card-v1": { width: 1200, height: 630, format: "png" },
} as const);

export const supportedSourceFormats = Object.freeze(["heic", "heif", "jpeg", "png", "webp", "svg"] as const);

export interface DedicatedHeifDecoderDescriptor {
  readonly kind: "dedicated-container-toolchain";
  readonly toolchainId: string;
  readonly toolchainSha256: string;
}

export const assertHeifToolchain = (format: string, descriptor?: DedicatedHeifDecoderDescriptor): void => {
  if (["heic", "heif"].includes(format.toLowerCase()) && !descriptor) {
    throw new Error("HEIC/HEIF requires a dedicated capable toolchain; default Sharp support is not assumed");
  }
};
