import { contentIdSchema } from "@xpotato/content-contracts/common";
import { articleMediaReferences } from "@xpotato/portable-content/media";
import { assertEditablePath, parseDraft } from "./draft.js";
import { assertWorkingBranch } from "./git.js";
import { assertMediaBudget, mediaPolicy, MiB, type MediaKind } from "./policy.js";

export const mediaHandoffPolicy = Object.freeze({ maxAssets: 32, bundleBytes: 64 * MiB });
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

function parsePrepared(value: unknown): PreparedHandoffMedia {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    value.protocol !== "xpotato-private-editor-media-v1" ||
    typeof value.originalName !== "string" ||
    value.originalName.length < 1 ||
    value.originalName.length > 255 ||
    /[/\\\x00-\x1f\x7f]/u.test(value.originalName) ||
    !object(value.metadata)
  ) {
    throw Error("MEDIA_HANDOFF_PREPARED_INVALID");
  }
  const metadata = value.metadata;
  if (
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
    !/^[a-z0-9-]{1,120}$/u.test(metadata.transform) ||
    !encodedBytes(value.masterBase64, metadata.bytes) ||
    !encodedBytes(value.previewBase64, metadata.previewBytes)
  ) {
    throw Error("MEDIA_HANDOFF_PREPARED_INVALID");
  }
  assertMediaBudget(metadata.kind as MediaKind, metadata.bytes);
  if (metadata.kind !== "photo" && (metadata.lossy || metadata.resized)) {
    throw Error("MEDIA_HANDOFF_TECHNICAL_TRANSFORM_INVALID");
  }
  // 実画像のdecode・寸法・hash検査は、既存の媒体取込処理が副作用より前に行う。
  return value as unknown as PreparedHandoffMedia;
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
  const source = value.source;
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
    source: {
      contentId: source.contentId as string,
      branch: source.branch,
      commit: source.commit,
      path: source.path,
      sha256: source.sha256,
    },
    assets,
  };
  if (new TextEncoder().encode(JSON.stringify(result)).length > mediaHandoffPolicy.bundleBytes) {
    throw Error("MEDIA_HANDOFF_BYTES_LIMIT");
  }
  return result;
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
  bundle: MediaHandoff,
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
