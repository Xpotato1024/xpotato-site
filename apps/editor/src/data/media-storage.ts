import type { LocalDraft, LocalMedia } from "./storage.js";
import { localDraftIdentity, matchingLocalDrafts } from "./draft-identity.js";

export type StoredMedia = Omit<LocalMedia, "blob"> & {
  blob?: Blob;
  blobBytes: ArrayBuffer;
  blobType: string;
  blobSha256: string;
};

export type MediaVersion = Pick<LocalMedia, "id" | "sha256" | "remoteId">;

/** Only an aborted transaction may authorize the bytes-only retry. */
export class MediaBlobWriteAborted extends Error {
  constructor(cause: unknown) {
    super("LOCAL_MEDIA_BLOB_WRITE_ABORTED", { cause });
  }
}

export function isBlobStorageError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    ["UnknownError", "DataCloneError"].includes(error.name) &&
    /\bBlob(?:\/File)?\b/iu.test(error.message)
  );
}

export async function withMediaBlobFallback<T>(
  write: (includeCompatibilityBlob: boolean) => Promise<T>,
): Promise<T> {
  try {
    return await write(true);
  } catch (error) {
    if (!(error instanceof MediaBlobWriteAborted)) throw error;
    return write(false);
  }
}

export function mediaWithoutCompatibilityBlob(stored: StoredMedia): StoredMedia {
  const { blob: _blob, ...bytes } = stored;
  return bytes;
}

export function assertMediaRestoreDraft(expected: LocalDraft, current: LocalDraft | undefined) {
  const identity = localDraftIdentity(expected);
  if (
    !current ||
    current.id !== expected.id ||
    !identity ||
    matchingLocalDrafts([current], identity).length !== 1
  ) {
    throw Error("DRAFT_MEDIA_LOCAL_CONFLICT");
  }
}

export function assertMediaCopySource(expected: LocalDraft, current: LocalDraft | undefined) {
  if (!current || Boolean(current.archived) !== Boolean(expected.archived)) {
    throw Error("DRAFT_MEDIA_LOCAL_CONFLICT");
  }
  // An explicit copy may start in the archive. Changing its archive state during the
  // operation is a conflict; an unchanged archive flag does not change article identity.
  assertMediaRestoreDraft(expected, { ...current, archived: false });
}

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
    // Older open tabs can read this field when their browser can persist Blobs.
    blob: new Blob([bytes], { type: blob.type }),
  };
}

export async function decodeStoredMedia(stored: StoredMedia | LocalMedia): Promise<LocalMedia> {
  const { blobBytes, blobType, blobSha256, ...metadata } = stored as Partial<StoredMedia> &
    LocalMedia;
  if (blobBytes instanceof ArrayBuffer && blobType !== undefined && blobSha256 === stored.sha256) {
    return { ...metadata, blob: new Blob([blobBytes], { type: blobType }) };
  }
  try {
    return {
      ...metadata,
      blob: new Blob([await metadata.blob.arrayBuffer()], { type: metadata.blob.type }),
    };
  } catch {
    // Keep an unreadable legacy record's identity and annotations available. A restore
    // can replace its cache bytes; one bad image must not hide every other image.
    return {
      ...metadata,
      blob: metadata.blob ?? new Blob([], blobType ? { type: blobType } : {}),
    };
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
    current.remoteId === incoming.remoteId &&
    current.sha256 === incoming.sha256;
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
