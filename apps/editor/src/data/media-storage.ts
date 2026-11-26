import type { LocalMedia } from "./storage.js";

export type StoredMedia = LocalMedia & {
  blobBytes: ArrayBuffer;
  blobType: string;
  blobSha256: string;
};

export type MediaVersion = Pick<LocalMedia, "id" | "sha256" | "remoteId">;

export async function encodeStoredMedia(media: LocalMedia): Promise<StoredMedia> {
  const { blob, ...metadata } = media;
  const bytes = await blob.arrayBuffer();
  // Persist owned bytes, not a browser's file-backed Blob handle. The latter can outlive
  // its backing resource across IndexedDB reads, page reloads and image rendering.
  return {
    ...metadata,
    blobBytes: bytes,
    blobType: blob.type,
    blobSha256: media.sha256,
    // Already-open older CMS tabs still expect this field. New readers use the bytes above.
    blob: new Blob([bytes], { type: blob.type }),
  };
}

export async function decodeStoredMedia(stored: StoredMedia | LocalMedia): Promise<LocalMedia> {
  const { blobBytes, blobType, blobSha256, ...metadata } = stored as Partial<StoredMedia> & LocalMedia;
  if (blobBytes instanceof ArrayBuffer && blobType !== undefined && blobSha256 === stored.sha256) {
    return { ...metadata, blob: new Blob([blobBytes], { type: blobType }) };
  }
  try {
    return {
      ...metadata,
      blob: new Blob([await stored.blob.arrayBuffer()], { type: stored.blob.type }),
    };
  } catch {
    // Keep an unreadable legacy record's identity and annotations available. A restore
    // can replace its cache bytes; one bad image must not hide every other image.
    return metadata;
  }
}

export function mergeRestoredMedia(
  incoming: StoredMedia,
  current: StoredMedia | LocalMedia | undefined,
  expected: MediaVersion | undefined,
): StoredMedia {
  if (!current) {
    if (expected) throw Error("DRAFT_MEDIA_LOCAL_CONFLICT");
    return incoming;
  }
  const unchanged =
    expected !== undefined &&
    current.id === expected.id &&
    current.sha256 === expected.sha256 &&
    current.remoteId === expected.remoteId;
  const alreadyRestored =
    Boolean(incoming.remoteId) &&
    current.remoteId === incoming.remoteId && current.sha256 === incoming.sha256;
  if (!unchanged && !alreadyRestored) throw Error("DRAFT_MEDIA_LOCAL_CONFLICT");
  return {
    ...incoming,
    id: current.id,
    originalName: current.originalName,
    ...(current.alt !== undefined ? { alt: current.alt } : {}),
    ...(current.caption !== undefined ? { caption: current.caption } : {}),
    ...(current.credit !== undefined ? { credit: current.credit } : {}),
    ...(current.creditUrl !== undefined ? { creditUrl: current.creditUrl } : {}),
  };
}
