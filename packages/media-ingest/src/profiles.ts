import { mediaIngestProfileSchema, mediaVariantProfileSchema } from "@xpotato/content-contracts";

export const canonicalRasterProfile = mediaIngestProfileSchema.parse({
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

export const qualityProfiles = Object.freeze({
  "avif-q48": { format: "avif", quality: 48 },
  "avif-q50": { format: "avif", quality: 50 },
  "avif-q52": { format: "avif", quality: 52 },
  "avif-q55": { format: "avif", quality: 55 },
  "webp-q78": { format: "webp", quality: 78 },
  "webp-q80": { format: "webp", quality: 80 },
  "webp-q82": { format: "webp", quality: 82 },
  "jpeg-q82": { format: "jpeg", quality: 82 },
  "jpeg-q85": { format: "jpeg", quality: 85 },
  "jpeg-q86": { format: "jpeg", quality: 86 },
  "webp-lossless-c6": { format: "webp", lossless: true, compressionLevel: 6 },
  "png-lossless-optimized": { format: "png", lossless: true, optimized: true },
} as const);

const formats = (avif: keyof typeof qualityProfiles, webp: keyof typeof qualityProfiles, jpeg: keyof typeof qualityProfiles) => [
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
  "photo-overview-v1": mediaVariantProfileSchema.parse({
    schemaVersion: 1,
    id: "photo-overview-v1",
    usage: "overview",
    widths: [640, 960, 1440, 1920],
    formats: formats("avif-q52", "webp-q80", "jpeg-q85"),
    preserveOriginalWhenSmaller: true,
    upscale: false,
  }),
  "screenshot-ui-v1": mediaVariantProfileSchema.parse({
    schemaVersion: 1,
    id: "screenshot-ui-v1",
    usage: "inline",
    widths: [480, 768, 1200, 1800, 2560],
    formats: [
      { format: "webp", qualityProfileId: "webp-lossless-c6", lossless: true },
      { format: "png", qualityProfileId: "png-lossless-optimized", lossless: true },
    ],
    preserveOriginalWhenSmaller: true,
    upscale: false,
  }),
  "social-card-v1": mediaVariantProfileSchema.parse({
    schemaVersion: 1,
    id: "social-card-v1",
    usage: "social",
    widths: [],
    formats: [{ format: "png", qualityProfileId: "png-lossless-optimized", lossless: true }],
    preserveOriginalWhenSmaller: false,
    upscale: false,
  }),
});

export const publicMasterProfiles = Object.freeze({
  "photo-inline-v1": {
    longEdgeMax: 2560,
    format: "jpeg",
    quality: 90,
    chromaSubsampling: "4:4:4_if_supported_else_encoder_high_quality_default",
  },
  "photo-hero-v1": { longEdgeMax: 2560, format: "jpeg", quality: 90 },
  "photo-gallery-v1": { longEdgeMax: 1920, format: "jpeg", quality: 88 },
  "photo-overview-v1": { longEdgeMax: 2560, format: "jpeg", quality: 90 },
  "screenshot-ui-v1": { longEdgeMax: 2560, format: "png", lossless: true },
  "social-card-v1": { width: 1200, height: 630, format: "png", lossless: true, responsiveVariants: "none" },
} as const);

export const frozenRasterProfileIds = Object.freeze([
  canonicalRasterProfile.id,
  "photo-inline-v1",
  "photo-hero-v1",
  "photo-gallery-v1",
  "photo-overview-v1",
  "screenshot-ui-v1",
  "social-card-v1",
] as const);

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
