import { contentIdSchema } from "@xpotato/content-contracts/common";
import { articleMediaReferences } from "@xpotato/portable-content/media";
import { assertEditablePath, parseDraft } from "./draft.js";
import { assertWorkingBranch } from "./git.js";
import { assertMediaBudget, mediaPolicy, MiB, type MediaKind } from "./policy.js";

export const mediaHandoffPolicy = Object.freeze({
  maxAssets: 32,
  bundleBytes: 64 * MiB,
  manifestBytes: 512 * 1024,
});
const sha256 = /^[a-f0-9]{64}$/u;
const assetId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const base64 = /^[A-Za-z0-9+/]*={0,2}$/u;

export interface PreparedHandoffMedia {
  schemaVersion: 1;
  protocol: "xpotato-private-editor-media-v1";
  originalName: string;
  metadata: {
    schemaVersion: 1;
    profile: "editor-draft-media-v1";
    kind: MediaKind;
    sourceSha256: string;
    sha256: string;
    previewSha256: string;
    sourceBytes: number;
    bytes: number;
    previewBytes: number;
    mime: "image/webp";
    width: number;
    height: number;
    lossy: boolean;
    resized: boolean;
    metadataStripped: true;
    sourceRetained: false;
    transform: string;
    animation?: {
      frameCount: number;
      durationMs: number;
      loop: number;
      delaysMs: number[];
    };
    playbackSha256?: string;
  };
  masterBase64: string;
  previewBase64: string;
}

export interface MediaHandoff {
  schemaVersion: 1;
  protocol: "xpotato-private-draft-media-handoff-v1";
  repository: string;
  source: {
    contentId: string;
    branch: string;
    commit: string;
    path: string;
    sha256: string;
  };
  assets: {
    assetId: string;
    prepared: PreparedHandoffMedia;
    expectedRemoteSha256?: string;
  }[];
}

export interface MediaHandoffManifest {
  schemaVersion: 1;
  protocol: "xpotato-private-draft-media-manifest-v1";
  repository: string;
  source: MediaHandoff["source"];
  assets: {
    assetId: string;
    metadata: PreparedHandoffMedia["metadata"];
    expectedRemoteSha256?: string;
  }[];
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function positiveInteger(value: unknown, maximum: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= maximum;
}

function encodedBytes(value: unknown, bytes: number): value is string {
  if (
    typeof value !== "string" ||
    value.length !== Math.ceil(bytes / 3) * 4 ||
    !base64.test(value)
  ) {
    return false;
  }
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return (value.length / 4) * 3 - padding === bytes;
}

function parseMetadata(metadata: unknown): PreparedHandoffMedia["metadata"] {
  if (
    !object(metadata) ||
    metadata.schemaVersion !== 1 ||
    metadata.profile !== "editor-draft-media-v1" ||
    !["photo", "technical", "animation"].includes(String(metadata.kind)) ||
    typeof metadata.sha256 !== "string" ||
    !sha256.test(metadata.sha256) ||
    typeof metadata.sourceSha256 !== "string" ||
    !sha256.test(metadata.sourceSha256) ||
    typeof metadata.previewSha256 !== "string" ||
    !sha256.test(metadata.previewSha256) ||
    !positiveInteger(metadata.sourceBytes, mediaPolicy.inputBytes) ||
    !positiveInteger(metadata.bytes, mediaPolicy[metadata.kind as MediaKind].maxBytes) ||
    !positiveInteger(metadata.previewBytes, mediaPolicy.previewBytes) ||
    !positiveInteger(metadata.width, mediaPolicy.maxDimension) ||
    !positiveInteger(metadata.height, mediaPolicy.maxDimension) ||
    metadata.width * metadata.height > mediaPolicy.maxPixels ||
    metadata.mime !== "image/webp" ||
    typeof metadata.lossy !== "boolean" ||
    typeof metadata.resized !== "boolean" ||
    metadata.metadataStripped !== true ||
    metadata.sourceRetained !== false ||
    typeof metadata.transform !== "string" ||
    !/^[a-z0-9-]{1,120}$/u.test(metadata.transform)
  ) {
    throw Error("MEDIA_HANDOFF_PREPARED_INVALID");
  }
  assertMediaBudget(metadata.kind as MediaKind, metadata.bytes);
  if (metadata.kind !== "photo" && (metadata.lossy || metadata.resized)) {
    throw Error("MEDIA_HANDOFF_TECHNICAL_TRANSFORM_INVALID");
  }
  let animation: PreparedHandoffMedia["metadata"]["animation"];
  if (metadata.animation !== undefined || metadata.kind === "animation") {
    const input = metadata.animation;
    if (
      metadata.kind !== "animation" ||
      !object(input) ||
      !positiveInteger(input.frameCount, mediaPolicy.maxFrames) ||
      typeof input.durationMs !== "number" ||
      !Number.isSafeInteger(input.durationMs) ||
      input.durationMs < 0 ||
      input.durationMs > mediaPolicy.maxDurationMs ||
      typeof input.loop !== "number" ||
      !Number.isSafeInteger(input.loop) ||
      input.loop < 0 ||
      input.loop > 65535 ||
      !Array.isArray(input.delaysMs) ||
      input.delaysMs.length !== input.frameCount ||
      input.delaysMs.some(
        (delay: unknown) =>
          typeof delay !== "number" ||
          !Number.isSafeInteger(delay) ||
          delay < 0 ||
          delay > mediaPolicy.maxDurationMs,
      ) ||
      input.delaysMs.reduce((sum: number, delay: number) => sum + delay, 0) !== input.durationMs ||
      metadata.width * metadata.height * input.frameCount > mediaPolicy.maxPixels
    ) {
      throw Error("MEDIA_HANDOFF_ANIMATION_INVALID");
    }
    animation = {
      frameCount: input.frameCount,
      durationMs: input.durationMs,
      loop: input.loop,
      delaysMs: [...input.delaysMs] as number[],
    };
  }
  if (
    metadata.playbackSha256 !== undefined &&
    (metadata.kind !== "animation" ||
      typeof metadata.playbackSha256 !== "string" ||
      !sha256.test(metadata.playbackSha256))
  ) {
    throw Error("MEDIA_HANDOFF_ANIMATION_INVALID");
  }
  // 予約へ残すmetadataに、入力の任意fieldや画像本体を持ち込まない。
  return {
    schemaVersion: 1,
    profile: "editor-draft-media-v1",
    kind: metadata.kind as MediaKind,
    sourceSha256: metadata.sourceSha256,
    sha256: metadata.sha256,
    previewSha256: metadata.previewSha256,
    sourceBytes: metadata.sourceBytes,
    bytes: metadata.bytes,
    previewBytes: metadata.previewBytes,
    mime: "image/webp",
    width: metadata.width,
    height: metadata.height,
    lossy: metadata.lossy,
    resized: metadata.resized,
    metadataStripped: true,
    sourceRetained: false,
    transform: metadata.transform,
    ...(animation ? { animation } : {}),
    ...(typeof metadata.playbackSha256 === "string"
      ? { playbackSha256: metadata.playbackSha256 }
      : {}),
  };
}

function parsePrepared(value: unknown): PreparedHandoffMedia {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    value.protocol !== "xpotato-private-editor-media-v1" ||
    typeof value.originalName !== "string" ||
    value.originalName.length < 1 ||
    value.originalName.length > 255 ||
    /[/\\\x00-\x1f\x7f]/u.test(value.originalName)
  ) {
    throw Error("MEDIA_HANDOFF_PREPARED_INVALID");
  }
  const metadata = parseMetadata(value.metadata);
  if (
    !encodedBytes(value.masterBase64, metadata.bytes) ||
    !encodedBytes(value.previewBase64, metadata.previewBytes)
  ) {
    throw Error("MEDIA_HANDOFF_PREPARED_INVALID");
  }
  // 実画像のdecode・寸法・hash検査は、既存の媒体取込処理が副作用より前に行う。
  return {
    schemaVersion: 1,
    protocol: "xpotato-private-editor-media-v1",
    originalName: value.originalName,
    metadata,
    masterBase64: value.masterBase64,
    previewBase64: value.previewBase64,
  };
}

function parseSource(source: Record<string, unknown>): MediaHandoff["source"] {
  if (
    !contentIdSchema.safeParse(source.contentId).success ||
    typeof source.branch !== "string" ||
    typeof source.path !== "string" ||
    typeof source.commit !== "string" ||
    !/^[a-f0-9]{40}$/u.test(source.commit) ||
    typeof source.sha256 !== "string" ||
    !sha256.test(source.sha256)
  ) {
    throw Error("MEDIA_HANDOFF_SOURCE_INVALID");
  }
  assertWorkingBranch(source.branch);
  assertEditablePath(source.path);
  return {
    contentId: source.contentId as string,
    branch: source.branch,
    commit: source.commit,
    path: source.path,
    sha256: source.sha256,
  };
}

export function parseMediaHandoff(value: unknown): MediaHandoff {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    value.protocol !== "xpotato-private-draft-media-handoff-v1" ||
    typeof value.repository !== "string" ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(value.repository) ||
    !object(value.source) ||
    !Array.isArray(value.assets) ||
    value.assets.length === 0 ||
    value.assets.length > mediaHandoffPolicy.maxAssets
  ) {
    throw Error("MEDIA_HANDOFF_INVALID");
  }
  const source = parseSource(value.source);
  const seen = new Set<string>();
  let encodedSize = 0;
  const assets = value.assets.map((item: unknown) => {
    if (
      !object(item) ||
      typeof item.assetId !== "string" ||
      item.assetId.length > 100 ||
      !assetId.test(item.assetId) ||
      (item.expectedRemoteSha256 !== undefined &&
        (typeof item.expectedRemoteSha256 !== "string" || !sha256.test(item.expectedRemoteSha256)))
    ) {
      throw Error("MEDIA_HANDOFF_ASSET_INVALID");
    }
    if (seen.has(item.assetId)) {
      throw Error("MEDIA_HANDOFF_DUPLICATE_ASSET");
    }
    seen.add(item.assetId);
    const prepared = parsePrepared(item.prepared);
    encodedSize += prepared.masterBase64.length + prepared.previewBase64.length;
    if (encodedSize > mediaHandoffPolicy.bundleBytes) {
      throw Error("MEDIA_HANDOFF_BYTES_LIMIT");
    }
    return {
      assetId: item.assetId,
      prepared,
      ...(typeof item.expectedRemoteSha256 === "string"
        ? { expectedRemoteSha256: item.expectedRemoteSha256 }
        : {}),
    };
  });
  const result: MediaHandoff = {
    schemaVersion: 1,
    protocol: "xpotato-private-draft-media-handoff-v1",
    repository: value.repository,
    source,
    assets,
  };
  if (new TextEncoder().encode(JSON.stringify(result)).length > mediaHandoffPolicy.bundleBytes) {
    throw Error("MEDIA_HANDOFF_BYTES_LIMIT");
  }
  return result;
}

/** Image bytes travel separately; the manifest fixes their source and replacement conditions. */
export function parseMediaHandoffManifest(value: unknown): MediaHandoffManifest {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    value.protocol !== "xpotato-private-draft-media-manifest-v1" ||
    typeof value.repository !== "string" ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(value.repository) ||
    !object(value.source) ||
    !Array.isArray(value.assets) ||
    value.assets.length === 0 ||
    value.assets.length > mediaHandoffPolicy.maxAssets
  ) {
    throw Error("MEDIA_HANDOFF_MANIFEST_INVALID");
  }
  if (new TextEncoder().encode(JSON.stringify(value)).length > mediaHandoffPolicy.manifestBytes) {
    throw Error("MEDIA_HANDOFF_MANIFEST_BYTES_LIMIT");
  }
  const source = parseSource(value.source);
  const seen = new Set<string>();
  const assets = value.assets.map((item: unknown) => {
    if (
      !object(item) ||
      typeof item.assetId !== "string" ||
      item.assetId.length > 100 ||
      !assetId.test(item.assetId) ||
      (item.expectedRemoteSha256 !== undefined &&
        (typeof item.expectedRemoteSha256 !== "string" ||
          !sha256.test(item.expectedRemoteSha256))) ||
      Object.keys(item).some(
        (key) => !["assetId", "metadata", "expectedRemoteSha256"].includes(key),
      )
    ) {
      throw Error("MEDIA_HANDOFF_ASSET_INVALID");
    }
    if (seen.has(item.assetId)) {
      throw Error("MEDIA_HANDOFF_DUPLICATE_ASSET");
    }
    seen.add(item.assetId);
    return {
      assetId: item.assetId,
      metadata: parseMetadata(item.metadata),
      ...(typeof item.expectedRemoteSha256 === "string"
        ? { expectedRemoteSha256: item.expectedRemoteSha256 }
        : {}),
    };
  });
  return {
    schemaVersion: 1,
    protocol: "xpotato-private-draft-media-manifest-v1",
    repository: value.repository,
    source,
    assets,
  };
}

export function mediaHandoffManifest(bundle: MediaHandoff): MediaHandoffManifest {
  const parsed = parseMediaHandoff(bundle);
  return parseMediaHandoffManifest({
    schemaVersion: 1,
    protocol: "xpotato-private-draft-media-manifest-v1",
    repository: parsed.repository,
    source: parsed.source,
    assets: parsed.assets.map((entry) => ({
      assetId: entry.assetId,
      metadata: entry.prepared.metadata,
      ...(entry.expectedRemoteSha256 ? { expectedRemoteSha256: entry.expectedRemoteSha256 } : {}),
    })),
  });
}

export function mediaHandoffReferences(source: string): string[] {
  const parsed = parseDraft(source);
  const refs = [...articleMediaReferences(parsed.body)];
  if (parsed.data.hero !== undefined) {
    if (typeof parsed.data.hero !== "string" || !assetId.test(parsed.data.hero)) {
      throw Error("MEDIA_HANDOFF_HERO_INVALID");
    }
    refs.push(parsed.data.hero);
  }
  return [...new Set(refs)].sort();
}

export async function assertMediaHandoffSource(
  bundle: Pick<MediaHandoff, "repository" | "source"> & { assets: readonly { assetId: string }[] },
  input: { repository: string; branch: string; commit: string; path: string; source: string },
): Promise<void> {
  const parsed = parseDraft(input.source);
  if (
    bundle.repository !== input.repository ||
    bundle.source.branch !== input.branch ||
    bundle.source.commit !== input.commit ||
    bundle.source.path !== input.path ||
    bundle.source.contentId !== parsed.data.id ||
    parsed.data.draft !== true
  ) {
    throw Error("MEDIA_HANDOFF_SOURCE_MISMATCH");
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.source));
  const actual = Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  if (actual !== bundle.source.sha256) {
    throw Error("MEDIA_HANDOFF_SOURCE_HASH_MISMATCH");
  }
  const refs = mediaHandoffReferences(input.source);
  const ids = bundle.assets.map((asset) => asset.assetId).sort();
  if (refs.length !== ids.length || refs.some((ref, index) => ref !== ids[index])) {
    throw Error("MEDIA_HANDOFF_REFERENCES_MISMATCH");
  }
}
