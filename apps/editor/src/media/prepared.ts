import { mediaPolicy, assertMediaBudget, type MediaKind } from "@xpotato/editor-core/policy";
import { inspectImage } from "@xpotato/editor-core/image-inspection";
import type { LocalMedia } from "../data/storage.js";
import { hashBlob } from "./optimize.js";
export async function importPreparedMedia(file: File, draftId: string): Promise<LocalMedia> {
  if (file.size <= 0 || file.size > 13 * 1024 * 1024) throw Error("PREPARED_MEDIA_BYTES_LIMIT");
  const bundle = JSON.parse(await file.text()) as {
    schemaVersion?: unknown;
    protocol?: unknown;
    metadata?: Record<string, unknown>;
    masterBase64?: unknown;
    previewBase64?: unknown;
    originalName?: unknown;
  };
  const m = bundle.metadata;
  if (
    bundle.schemaVersion !== 1 ||
    bundle.protocol !== "xpotato-private-editor-media-v1" ||
    !m ||
    m.schemaVersion !== 1 ||
    m.profile !== "editor-draft-media-v1" ||
    typeof bundle.masterBase64 !== "string" ||
    typeof bundle.originalName !== "string" ||
    bundle.originalName.length > 255
  )
    throw Error("PREPARED_MEDIA_INVALID");
  const kind = m.kind as MediaKind;
  if (!["photo", "technical", "animation"].includes(kind)) throw Error("MEDIA_KIND_INVALID");
  if (
    typeof m.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(m.sha256) ||
    typeof m.sourceSha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(m.sourceSha256) ||
    typeof m.sourceBytes !== "number" ||
    !Number.isSafeInteger(m.sourceBytes) ||
    m.sourceBytes <= 0 ||
    m.sourceBytes > mediaPolicy.inputBytes ||
    typeof m.transform !== "string" ||
    !/^[a-z0-9-]{1,120}$/u.test(m.transform) ||
    m.mime !== "image/webp"
  )
    throw Error("PREPARED_MEDIA_INVALID");
  if (
    !/^[A-Za-z0-9+/]*={0,2}$/u.test(bundle.masterBase64) ||
    bundle.masterBase64.length > Math.ceil(mediaPolicy[kind].maxBytes / 3) * 4
  )
    throw Error("MEDIA_BYTES_LIMIT");
  const bytes = Uint8Array.from(atob(bundle.masterBase64), (character) => character.charCodeAt(0));
  assertMediaBudget(kind, bytes.length);
  const actual = inspectImage(bytes, kind);
  if (
    actual.mime !== m.mime ||
    actual.width !== m.width ||
    actual.height !== m.height ||
    bytes.length !== m.bytes
  )
    throw Error("PREPARED_MEDIA_METADATA_MISMATCH");
  const blob = new Blob([bytes], { type: actual.mime });
  if ((await hashBlob(blob)) !== m.sha256) throw Error("PREPARED_MEDIA_HASH_MISMATCH");
  // Source lineage is declared by the producer; public-media approval remains independent.
  return {
    id: crypto.randomUUID(),
    draftId,
    assetId: "figure-" + crypto.randomUUID().slice(0, 8),
    blob,
    originalBytes: m.sourceBytes,
    sourceSha256: m.sourceSha256,
    sha256: m.sha256,
    kind,
    transform: m.transform,
    createdAt: new Date().toISOString(),
    originalName: bundle.originalName,
    sourceRetained: false,
  };
}
