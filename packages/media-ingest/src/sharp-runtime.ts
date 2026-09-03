import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import sharp from "sharp";
import {
  mediaIngestResultSchema,
  mediaVariantManifestSchema,
  type MediaIngestRequest,
  type MediaIngestResult,
  type MediaVariantManifest,
} from "@xpotato/content-contracts";
import { fingerprint, sha256 } from "@xpotato/content-contracts/canonical";
import {
  canonicalRasterProfile,
  deliveryProfiles,
  diagramSvgProfile,
  getMediaVariantProfileBinding,
  publicMasterProfiles,
  qualityProfiles,
  type MediaVariantProfileId,
} from "./profiles.js";

export const mediaToolchainId = "media-toolchain-v1" as const;

const canonicalSharpVersions = (): Record<string, string> => Object.fromEntries(
  Object.entries(sharp.versions)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0),
);

export const sharpToolchainSha256 = (): string => fingerprint({
  id: mediaToolchainId,
  sharpPackageVersion: "0.35.4",
  versions: canonicalSharpVersions(),
});

export interface LocalDeliveryObject {
  readonly sha256: string;
  readonly privateRelativePath: string;
  readonly format: "jpeg" | "png" | "webp" | "avif" | "svg";
  readonly width: number;
  readonly height: number;
  readonly sizeBytes: number;
  readonly contentType: string;
}

const toRepositoryRelative = (absolutePath: string): string => relative(process.cwd(), absolutePath).replaceAll("\\", "/");
const sourceAbsolutePath = (sourcePath: string): string => isAbsolute(sourcePath) ? sourcePath : resolve(process.cwd(), sourcePath);
const extensionFor = (format: LocalDeliveryObject["format"]): string => format === "jpeg" ? "jpg" : format;
const contentTypeFor = (format: LocalDeliveryObject["format"]): string => format === "svg" ? "image/svg+xml" : `image/${format}`;

const outputPath = async (
  root: string,
  contentId: string,
  assetId: string,
  sha: string,
  format: LocalDeliveryObject["format"],
): Promise<Readonly<{ absolute: string; relative: string }>> => {
  const absolute = resolve(process.cwd(), root, contentId, assetId, `${sha}.${extensionFor(format)}`);
  await mkdir(dirname(absolute), { recursive: true });
  return { absolute, relative: toRepositoryRelative(absolute) };
};

const normalizedSvg = (source: string): string => source.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trimEnd() + "\n";

export const sanitizeSvg = (source: string): string => {
  const normalized = normalizedSvg(source);
  if (!/^\s*<svg\b/iu.test(normalized)) throw new Error("SVG source must begin with an svg element");
  if (!/\bviewBox\s*=\s*["'][^"']+["']/iu.test(normalized)) throw new Error("SVG source requires a viewBox");
  if (/<(?:script|foreignObject)\b/iu.test(normalized)) throw new Error("SVG active content is forbidden");
  if (/\son[a-z]+\s*=/iu.test(normalized)) throw new Error("SVG event handlers are forbidden");
  if (/\b(?:href|src)\s*=\s*["']\s*(?:https?:|data:|javascript:|\/\/)/iu.test(normalized)) throw new Error("SVG external references are forbidden");
  if (/url\(\s*["']?\s*(?:https?:|data:|\/\/)/iu.test(normalized)) throw new Error("SVG external CSS references are forbidden");
  return normalized;
};

const svgDimensions = (source: string): Readonly<{ width?: number; height?: number }> => {
  const width = /\bwidth\s*=\s*["']([0-9]+(?:\.[0-9]+)?)/iu.exec(source)?.[1];
  const height = /\bheight\s*=\s*["']([0-9]+(?:\.[0-9]+)?)/iu.exec(source)?.[1];
  if (width && height) return { width: Math.round(Number(width)), height: Math.round(Number(height)) };
  const viewBox = /\bviewBox\s*=\s*["']\s*[-+0-9.]+\s+[-+0-9.]+\s+([-+0-9.]+)\s+([-+0-9.]+)/iu.exec(source);
  if (!viewBox) return {};
  return { width: Math.round(Number(viewBox[1])), height: Math.round(Number(viewBox[2])) };
};

const canonicalProfileHash = (profileId: string): string => {
  if (profileId === canonicalRasterProfile.id) return fingerprint(canonicalRasterProfile);
  if (profileId === diagramSvgProfile.id) return fingerprint(diagramSvgProfile);
  throw new Error(`Unsupported canonical ingest profile: ${profileId}`);
};

export class SharpCanonicalMediaProcessor {
  public constructor(private readonly root = ".local/migration/phase6/canonical") {}

  public async ingest(request: MediaIngestRequest): Promise<MediaIngestResult> {
    const sourcePath = sourceAbsolutePath(request.sourcePath);
    const sourceBytes = await readFile(sourcePath);
    const sourceSha256 = sha256(sourceBytes);
    const toolchainSha256 = sharpToolchainSha256();

    if (request.profileId === diagramSvgProfile.id) {
      const source = sanitizeSvg(sourceBytes.toString("utf8"));
      const canonicalBytes = Buffer.from(source, "utf8");
      const canonicalSha256 = sha256(canonicalBytes);
      const dimensions = svgDimensions(source);
      const path = await outputPath(this.root, request.target.contentId, request.target.semanticAssetId, canonicalSha256, "svg");
      await writeFile(path.absolute, canonicalBytes);
      return mediaIngestResultSchema.parse({
        schemaVersion: 1,
        semanticAssetId: request.target.semanticAssetId,
        source: {
          detectedFormat: "svg",
          sourceSha256,
          ...(dimensions.width ? { width: dimensions.width } : {}),
          ...(dimensions.height ? { height: dimensions.height } : {}),
        },
        canonicalMaster: {
          privateRelativePath: path.relative,
          sha256: canonicalSha256,
          format: "svg",
          ...(dimensions.width ? { width: dimensions.width } : {}),
          ...(dimensions.height ? { height: dimensions.height } : {}),
          sizeBytes: canonicalBytes.byteLength,
        },
        processing: {
          profileId: diagramSvgProfile.id,
          profileSha256: canonicalProfileHash(diagramSvgProfile.id),
          toolchainId: mediaToolchainId,
          toolchainSha256,
          metadataStripped: true,
          orientationApplied: false,
          resized: false,
        },
        warnings: [],
      });
    }

    if (request.profileId !== canonicalRasterProfile.id) throw new Error(`Unsupported canonical ingest profile: ${request.profileId}`);
    const metadata = await sharp(sourceBytes, { failOn: "error" }).metadata();
    if (!metadata.width || !metadata.height || !metadata.format) throw new Error("Raster metadata is incomplete");
    const longEdge = Math.max(metadata.width, metadata.height);
    const resized = longEdge > canonicalRasterProfile.raster!.maxLongEdge;
    let pipeline = sharp(sourceBytes, { failOn: "error" }).rotate().toColourspace("srgb");
    if (resized) {
      pipeline = pipeline.resize({
        width: canonicalRasterProfile.raster!.maxLongEdge,
        height: canonicalRasterProfile.raster!.maxLongEdge,
        fit: "inside",
        withoutEnlargement: true,
      });
    }
    const output = await pipeline.webp({ lossless: true, effort: canonicalRasterProfile.raster!.losslessCompressionLevel }).toBuffer({ resolveWithObject: true });
    const canonicalSha256 = sha256(output.data);
    const path = await outputPath(this.root, request.target.contentId, request.target.semanticAssetId, canonicalSha256, "webp");
    await writeFile(path.absolute, output.data);
    return mediaIngestResultSchema.parse({
      schemaVersion: 1,
      semanticAssetId: request.target.semanticAssetId,
      source: {
        detectedFormat: metadata.format,
        sourceSha256,
        width: metadata.width,
        height: metadata.height,
        orientationMetadataPresent: metadata.orientation !== undefined,
      },
      canonicalMaster: {
        privateRelativePath: path.relative,
        sha256: canonicalSha256,
        format: "webp",
        width: output.info.width,
        height: output.info.height,
        sizeBytes: output.data.byteLength,
      },
      processing: {
        profileId: canonicalRasterProfile.id,
        profileSha256: canonicalProfileHash(canonicalRasterProfile.id),
        toolchainId: mediaToolchainId,
        toolchainSha256,
        metadataStripped: true,
        orientationApplied: metadata.orientation !== undefined && metadata.orientation !== 1,
        resized,
        colorSpace: "srgb",
        bitDepth: 8,
      },
      warnings: [],
    });
  }
}

const encode = async (
  input: Buffer,
  width: number | undefined,
  format: "jpeg" | "png" | "webp" | "avif",
  profileId: string,
): Promise<Readonly<{ data: Buffer; width: number; height: number }>> => {
  let pipeline = sharp(input, { failOn: "error" });
  if (width !== undefined) pipeline = pipeline.resize({ width, withoutEnlargement: true });
  if (format === "png") pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
  if (format === "webp") {
    const quality = qualityProfiles[profileId as keyof typeof qualityProfiles];
    pipeline = quality && "lossless" in quality && quality.lossless
      ? pipeline.webp({ lossless: true, effort: "compressionLevel" in quality ? quality.compressionLevel : 6 })
      : pipeline.webp({ quality: quality && "quality" in quality ? quality.quality : 80 });
  }
  if (format === "avif") {
    const quality = qualityProfiles[profileId as keyof typeof qualityProfiles];
    pipeline = pipeline.avif({ quality: quality && "quality" in quality ? quality.quality : 50 });
  }
  if (format === "jpeg") {
    const quality = qualityProfiles[profileId as keyof typeof qualityProfiles];
    pipeline = pipeline.jpeg({ quality: quality && "quality" in quality ? quality.quality : 85 });
  }
  const result = await pipeline.toBuffer({ resolveWithObject: true });
  return { data: result.data, width: result.info.width, height: result.info.height };
};

export class SharpDeliveryVariantGenerator {
  public constructor(private readonly root = ".local/migration/phase6/variants") {}

  public async generate(input: Readonly<{
    contentId: string;
    ingestResult: MediaIngestResult;
    profileId: MediaVariantProfileId;
    profileSha256: string;
  }>): Promise<MediaVariantManifest> {
    const binding = getMediaVariantProfileBinding(input.profileId);
    if (binding.profileSha256 !== input.profileSha256) throw new Error("Variant profile hash mismatch");
    const profile = deliveryProfiles[input.profileId];
    if (profile.usage === "social") {
      const payload = {
        schemaVersion: 1 as const,
        contentId: input.contentId,
        assetId: input.ingestResult.semanticAssetId,
        masterSha256: input.ingestResult.canonicalMaster.sha256,
        profileId: binding.profileId,
        profileSha256: binding.profileSha256,
        toolchainId: mediaToolchainId,
        toolchainSha256: sharpToolchainSha256(),
        status: "not_required" as const,
        variants: [],
        warnings: [],
      };
      return mediaVariantManifestSchema.parse({ ...payload, manifestSha256: fingerprint(payload) });
    }
    const canonicalPath = sourceAbsolutePath(input.ingestResult.canonicalMaster.privateRelativePath);
    const canonicalBytes = await readFile(canonicalPath);
    const metadata = await sharp(canonicalBytes).metadata();
    if (!metadata.width || !metadata.height) throw new Error("Canonical master dimensions are required for variants");
    const targets = profile.widths.filter((width) => width <= metadata.width!);
    if (targets.length === 0 && profile.preserveOriginalWhenSmaller) targets.push(metadata.width);
    const variants = [];
    for (const width of targets) {
      for (const formatSpec of profile.formats) {
        const encoded = await encode(canonicalBytes, width, formatSpec.format, formatSpec.qualityProfileId ?? "");
        const objectSha = sha256(encoded.data);
        const path = await outputPath(this.root, input.contentId, input.ingestResult.semanticAssetId, objectSha, formatSpec.format);
        await writeFile(path.absolute, encoded.data);
        variants.push({
          sha256: objectSha,
          privateRelativePath: path.relative,
          format: formatSpec.format,
          width: encoded.width,
          height: encoded.height,
          sizeBytes: encoded.data.byteLength,
          contentType: contentTypeFor(formatSpec.format),
        });
      }
    }
    const payload = {
      schemaVersion: 1 as const,
      contentId: input.contentId,
      assetId: input.ingestResult.semanticAssetId,
      masterSha256: input.ingestResult.canonicalMaster.sha256,
      profileId: binding.profileId,
      profileSha256: binding.profileSha256,
      toolchainId: mediaToolchainId,
      toolchainSha256: sharpToolchainSha256(),
      status: "generated" as const,
      variants,
      warnings: [],
    };
    return mediaVariantManifestSchema.parse({ ...payload, manifestSha256: fingerprint(payload) });
  }
}

export const generatePublicDeliveryMaster = async (
  ingestResult: MediaIngestResult,
  profileId: MediaVariantProfileId,
  root = ".local/migration/phase6/public-master",
): Promise<LocalDeliveryObject> => {
  const input = await readFile(sourceAbsolutePath(ingestResult.canonicalMaster.privateRelativePath));
  const profile = publicMasterProfiles[profileId];
  if (profileId === "social-card-v1") {
    const result = await sharp(input, { failOn: "error" }).resize({ width: 1200, height: 630, fit: "fill" }).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer({ resolveWithObject: true });
    const objectSha = sha256(result.data);
    const path = await outputPath(root, "public", ingestResult.semanticAssetId, objectSha, "png");
    await writeFile(path.absolute, result.data);
    return { sha256: objectSha, privateRelativePath: path.relative, format: "png", width: result.info.width, height: result.info.height, sizeBytes: result.data.byteLength, contentType: "image/png" };
  }
  if (!("longEdgeMax" in profile)) throw new Error(`Unsupported public master profile: ${profileId}`);
  let pipeline = sharp(input, { failOn: "error" }).resize({ width: profile.longEdgeMax, height: profile.longEdgeMax, fit: "inside", withoutEnlargement: true });
  let format: "jpeg" | "png";
  if (profile.format === "png") {
    format = "png";
    pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
  } else {
    format = "jpeg";
    pipeline = pipeline.jpeg({ quality: profile.quality, ...(profileId === "photo-inline-v1" ? { chromaSubsampling: "4:4:4" } : {}) });
  }
  const result = await pipeline.toBuffer({ resolveWithObject: true });
  const objectSha = sha256(result.data);
  const path = await outputPath(root, "public", ingestResult.semanticAssetId, objectSha, format);
  await writeFile(path.absolute, result.data);
  return { sha256: objectSha, privateRelativePath: path.relative, format, width: result.info.width, height: result.info.height, sizeBytes: result.data.byteLength, contentType: contentTypeFor(format) };
};
