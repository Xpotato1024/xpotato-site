import { describe, expect, it, vi } from "vitest";
import {
  assertMediaRestoreDraft,
  assertMediaCopySource,
  decodeStoredMedia,
  encodeStoredMedia,
  mergeRestoredMedia,
  isBlobStorageError,
  MediaBlobWriteAborted,
  mediaWithoutCompatibilityBlob,
  withMediaBlobFallback,
} from "./media-storage.js";
import { createDraftForCollection, updateDraft } from "@xpotato/editor-core/draft";
import type { LocalDraft, LocalMedia } from "./storage.js";

function image(): LocalMedia {
  return {
    id: "local-image",
    draftId: "local-draft",
    assetId: "diagram",
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" }),
    originalBytes: 20,
    sourceSha256: "a".repeat(64),
    sha256: "b".repeat(64),
    kind: "technical",
    transform: "technical-webp-lossless-v1",
    createdAt: "2026-11-26T00:00:00.000Z",
    remoteId: "remote-image",
    originalName: "構成図.png",
    sourceRetained: false,
    alt: "保存済みの説明",
    caption: "保存済みの注記",
    credit: "図の出典",
    creditUrl: "https://example.com/source",
  };
}

describe("durable local media bytes", () => {
  it("persists bytes and MIME independently of the original Blob and recreates a fresh Blob", async () => {
    const media = image();
    const stored = await encodeStoredMedia(media);
    expect(stored.blob).not.toBe(media.blob);
    expect(await stored.blob!.arrayBuffer()).toEqual(await media.blob.arrayBuffer());
    expect(stored.blobBytes).toEqual(await media.blob.arrayBuffer());
    expect(stored.blobType).toBe("image/webp");
    const first = await decodeStoredMedia(structuredClone(stored));
    const second = await decodeStoredMedia(structuredClone(stored));
    expect(first.blob).not.toBe(media.blob);
    expect(second.blob).not.toBe(first.blob);
    expect(first.blob.type).toBe(media.blob.type);
    expect(await first.blob.arrayBuffer()).toEqual(await media.blob.arrayBuffer());
    expect({ ...first, blob: undefined }).toEqual({ ...media, blob: undefined });
    expect(first).not.toHaveProperty("blobBytes");
    expect(first).not.toHaveProperty("blobSha256");
  });

  it("reads a legacy Blob into owned memory without changing its media identity or notes", async () => {
    const media = image();
    const restored = await decodeStoredMedia(media);
    expect(restored.blob).not.toBe(media.blob);
    expect(await restored.blob.arrayBuffer()).toEqual(await media.blob.arrayBuffer());
    expect({ ...restored, blob: undefined }).toEqual({ ...media, blob: undefined });
  });

  it("reads exact bytes and MIME when the browser could not persist the compatibility Blob", async () => {
    const media = image();
    const stored = await encodeStoredMedia(media);
    const bytesOnly = mediaWithoutCompatibilityBlob(stored);
    expect(bytesOnly).not.toHaveProperty("blob");
    expect(stored.blob).toBeInstanceOf(Blob);
    const restored = await decodeStoredMedia(structuredClone(bytesOnly));
    expect(restored.blob.type).toBe(media.blob.type);
    expect(await restored.blob.arrayBuffer()).toEqual(await media.blob.arrayBuffer());
    expect(restored.id).toBe(media.id);
    expect(restored.remoteId).toBe(media.remoteId);
    expect(restored).not.toHaveProperty("blobBytes");
  });

  it("keeps damaged byte-only cache metadata readable for remote repair", async () => {
    const stored = mediaWithoutCompatibilityBlob(await encodeStoredMedia(image()));
    const restored = await decodeStoredMedia({ ...stored, blobSha256: "c".repeat(64) });
    expect(restored.id).toBe(stored.id);
    expect(restored.sha256).toBe(stored.sha256);
    expect(restored.blob).toBeInstanceOf(Blob);
    expect(restored.blob.size).toBe(0);
  });

  it("reads an older tab's changed Blob when its preserved byte copy belongs to the previous hash", async () => {
    const stored = await encodeStoredMedia(image());
    const edited = {
      ...stored,
      blob: new Blob(["older tab edit"], { type: "image/png" }),
      sha256: "c".repeat(64),
    };
    const restored = await decodeStoredMedia(edited);
    expect(await restored.blob.text()).toBe("older tab edit");
    expect(restored.blob.type).toBe("image/png");
    expect(restored).not.toHaveProperty("blobBytes");
  });

  it("keeps unreadable legacy metadata available for recovery without hiding other media", async () => {
    const broken = image();
    Object.defineProperty(broken.blob, "arrayBuffer", {
      value: async () => {
        throw new DOMException("The backing file is unavailable", "NotReadableError");
      },
    });
    const intact = { ...image(), id: "other-image", assetId: "other" };
    const restored = await Promise.all([broken, intact].map(decodeStoredMedia));
    expect(restored[0]).toEqual(broken);
    expect(await restored[1]!.blob.arrayBuffer()).toEqual(await intact.blob.arrayBuffer());
    await expect(encodeStoredMedia(broken)).rejects.toThrow("backing file");
  });
});

describe("retrying an aborted Blob storage write", () => {
  const blobFailure = () =>
    new DOMException("Error preparing Blob/File data to be stored in object store", "UnknownError");

  it("recognizes Blob-specific engine failures without treating quota or generic clone failures as unsupported Blobs", () => {
    expect(isBlobStorageError(blobFailure())).toBe(true);
    expect(isBlobStorageError(new DOMException("Blob could not be cloned", "DataCloneError"))).toBe(
      true,
    );
    for (const error of [
      new DOMException("Blob exceeds storage quota", "QuotaExceededError"),
      new DOMException("Value could not be cloned", "DataCloneError"),
      new DOMException("Unknown database failure", "UnknownError"),
      new DOMException("Blob transaction aborted", "AbortError"),
      Error("DRAFT_MEDIA_LOCAL_CONFLICT"),
    ])
      expect(isBlobStorageError(error)).toBe(false);
  });

  it("keeps the same identity and bytes and waits for confirmed abort before retrying once", async () => {
    const stored = await encodeStoredMedia(image());
    const attempts: boolean[] = [];
    let aborted: (reason: unknown) => void = () => {};
    const result = withMediaBlobFallback(async (includeBlob) => {
      attempts.push(includeBlob);
      if (includeBlob)
        return new Promise<typeof stored>((_resolve, reject) => {
          aborted = reject;
        });
      return mediaWithoutCompatibilityBlob(stored);
    });
    await Promise.resolve();
    expect(attempts).toEqual([true]);
    aborted(new MediaBlobWriteAborted(blobFailure()));
    const saved = await result;
    expect(attempts).toEqual([true, false]);
    expect(saved.id).toBe(stored.id);
    expect(saved.draftId).toBe(stored.draftId);
    expect(saved.blobBytes).toEqual(stored.blobBytes);
    expect(saved.blobType).toBe(stored.blobType);
    expect(saved).not.toHaveProperty("blob");
  });

  it("does not retry a Blob error before abort is confirmed or a business conflict", async () => {
    for (const error of [blobFailure(), Error("DRAFT_MEDIA_LOCAL_CONFLICT")]) {
      const write = vi.fn(async () => {
        throw error;
      });
      await expect(withMediaBlobFallback(write)).rejects.toBe(error);
      expect(write).toHaveBeenCalledTimes(1);
    }
  });

  it("stops when the bytes-only attempt fails, including a new destination conflict", async () => {
    const conflict = Error("DRAFT_MEDIA_LOCAL_CONFLICT");
    const write = vi.fn(async (includeBlob: boolean) => {
      if (includeBlob) throw new MediaBlobWriteAborted(blobFailure());
      throw conflict;
    });
    await expect(withMediaBlobFallback(write)).rejects.toBe(conflict);
    expect(write.mock.calls).toEqual([[true], [false]]);
  });
});

describe("restoring one asset into a local draft", () => {
  const draft: LocalDraft = {
    id: "local-draft",
    source: createDraftForCollection({
      collection: "projects",
      id: "11111111-1111-4111-8111-111111111111",
    }),
    path: "content/projects/example.mdx",
    sourceBranch: "content/example",
    workingBranch: "content/example",
    baseCommit: "a".repeat(40),
    savedAt: "2026-11-26T00:00:00.000Z",
    producer: "mixed",
  };

  it("requires the destination draft to remain active with the same content and branch", () => {
    for (const current of [
      undefined,
      { ...draft, id: "other-local-draft" },
      { ...draft, archived: true },
      { ...draft, workingBranch: "content/other" },
      { ...draft, path: "content/projects/other.mdx" },
      {
        ...draft,
        source: createDraftForCollection({
          collection: "projects",
          id: "22222222-2222-4222-8222-222222222222",
        }),
      },
    ]) {
      expect(() => assertMediaRestoreDraft(draft, current)).toThrow("DRAFT_MEDIA_LOCAL_CONFLICT");
    }
    expect(() =>
      assertMediaRestoreDraft(draft, {
        ...draft,
        source: updateDraft(draft.source, {}, "画像の取得中に加えた未同期の本文。"),
      }),
    ).not.toThrow();
  });

  it("requires a copy source to still exist with the same identity and archive state even without images", () => {
    expect(() => assertMediaCopySource(draft, undefined)).toThrow("DRAFT_MEDIA_LOCAL_CONFLICT");
    expect(() => assertMediaCopySource(draft, { ...draft, archived: true })).toThrow(
      "DRAFT_MEDIA_LOCAL_CONFLICT",
    );
    expect(() =>
      assertMediaCopySource(draft, { ...draft, workingBranch: "content/changed" }),
    ).toThrow("DRAFT_MEDIA_LOCAL_CONFLICT");
    const archived = { ...draft, archived: true };
    expect(() => assertMediaCopySource(archived, archived)).not.toThrow();
    expect(() => assertMediaCopySource(archived, draft)).toThrow("DRAFT_MEDIA_LOCAL_CONFLICT");
  });

  it("preserves notes edited while the image download was in flight", async () => {
    const previous = image();
    const {
      alt: _alt,
      caption: _caption,
      credit: _credit,
      creditUrl: _creditUrl,
      ...bare
    } = previous;
    const incoming = await encodeStoredMedia({
      ...bare,
      id: "downloaded-copy",
      blob: new Blob(["restored"], { type: "image/webp" }),
    });
    const current = {
      ...previous,
      alt: "取得中に編集した説明",
      caption: "取得中に編集した注記",
      credit: "更新した出典",
    };
    const next = mergeRestoredMedia(incoming, current, previous);
    expect(next.id).toBe(previous.id);
    expect(next.alt).toBe(current.alt);
    expect(next.caption).toBe(current.caption);
    expect(next.credit).toBe(current.credit);
    expect(next.creditUrl).toBe(current.creditUrl);
    expect((await decodeStoredMedia(next)).blob.size).toBe(8);
    expect(await next.blob!.text()).toBe("restored");
  });

  it("reuses a concurrent identical restoration instead of adding another record", async () => {
    const incoming = await encodeStoredMedia(image());
    const first = mergeRestoredMedia(incoming, undefined, undefined);
    const second = mergeRestoredMedia({ ...incoming, id: "second-download" }, first, undefined);
    expect(second.id).toBe(first.id);
  });

  it("does not reintroduce a failed compatibility Blob while preserving current image notes", async () => {
    const current = await encodeStoredMedia(image());
    const incoming = mediaWithoutCompatibilityBlob(current);
    const saved = mergeRestoredMedia(incoming, { ...current, caption: "取得中の編集" }, current);
    expect(saved).not.toHaveProperty("blob");
    expect(saved.caption).toBe("取得中の編集");
    expect(await (await decodeStoredMedia(saved)).blob.arrayBuffer()).toEqual(current.blobBytes);
  });

  it("refuses to overwrite a newly changed local image or resurrect a deleted one", async () => {
    const previous = image();
    const incoming = await encodeStoredMedia(previous);
    const { remoteId: _remoteId, ...local } = previous;
    const changed = { ...local, sha256: "c".repeat(64) };
    expect(() => mergeRestoredMedia(incoming, changed, previous)).toThrow(
      "DRAFT_MEDIA_LOCAL_CONFLICT",
    );
    expect(() => mergeRestoredMedia(incoming, undefined, previous)).toThrow(
      "DRAFT_MEDIA_LOCAL_CONFLICT",
    );
    expect(() => mergeRestoredMedia(incoming, changed, undefined)).toThrow(
      "DRAFT_MEDIA_LOCAL_CONFLICT",
    );
  });
});
