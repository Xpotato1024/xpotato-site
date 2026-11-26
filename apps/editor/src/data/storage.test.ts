import { describe, expect, it } from "vitest";
import { anchorSelection } from "@xpotato/editor-core/annotations";
import { parseDraft, updateDraft } from "@xpotato/editor-core/draft";
import { createLocalDraft } from "../features/drafts/model.js";
import { decodeStoredMedia, encodeStoredMedia, type StoredMedia } from "./media-storage.js";
import {
  createLocalDraftBranchCopy,
  type LocalDraft,
  type LocalDraftBranchBinding,
  type LocalMedia,
} from "./storage.js";

function fixture() {
  const initial = createLocalDraft();
  const contentId = parseDraft(initial.source).data.id;
  const body = "保存元の本文。\n\nまだGitへ送っていない追記。\n";
  const draft: LocalDraft = {
    ...initial,
    source: updateDraft(initial.source, { title: "改稿中" }, body),
    workingBranch: "content/original",
    baseCommit: "a".repeat(40),
    baseSource: initial.source,
    syncedCommit: "a".repeat(40),
    syncedSource: initial.source,
    remoteDraftId: crypto.randomUUID(),
    remoteRevision: 8,
    reviewRevision: 4,
    producer: "mixed",
    annotations: [
      {
        id: crypto.randomUUID(),
        contentId,
        anchor: anchorSelection(body, { quote: "まだGitへ送っていない追記。" }),
        instruction: "この説明を確認してください。",
        createdAt: initial.savedAt,
        status: "open",
      },
    ],
  };
  const media: LocalMedia = {
    id: crypto.randomUUID(),
    draftId: draft.id,
    assetId: "diagram",
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
    originalBytes: 3,
    sourceSha256: "b".repeat(64),
    sha256: "b".repeat(64),
    kind: "technical",
    transform: "identity-v1",
    createdAt: initial.savedAt,
    remoteId: crypto.randomUUID(),
    originalName: "diagram.png",
    sourceRetained: true,
    alt: "元の説明",
    caption: "元の注記",
  };
  const binding: LocalDraftBranchBinding = {
    workingBranch: "content/copy",
    sourceBranch: "main",
    baseCommit: "c".repeat(40),
    baseSource: initial.source,
    registrySnapshot: {
      contractVersion: 1,
      categories: { blog: ["software"] },
      tags: [],
      modules: [],
    },
    pendingRegistryChanges: {
      taxonomy: [{ namespace: "tags", kind: "topic", id: "new-term", label: "新しいタグ" }],
    },
  };
  return { draft, media, binding };
}

describe("copying a local draft to another Git branch", () => {
  it("preserves unsaved article and review bytes while removing every previous synchronization identity", async () => {
    const { draft, media, binding } = fixture();
    const copied = createLocalDraftBranchCopy(draft, binding, [media]);
    expect(copied.draft.id).not.toBe(draft.id);
    expect(copied.draft.source).toBe(draft.source);
    expect(parseDraft(copied.draft.source).data.id).toBe(parseDraft(draft.source).data.id);
    expect(copied.draft.annotations).toEqual(draft.annotations);
    expect(copied.draft.producer).toBe(draft.producer);
    expect(copied.draft.workingBranch).toBe("content/copy");
    expect(copied.draft.baseCommit).toBe(binding.baseCommit);
    expect(copied.draft.baseSource).toBe(binding.baseSource);
    expect(copied.draft.pendingRegistryChanges).toEqual(binding.pendingRegistryChanges);
    for (const field of [
      "remoteDraftId",
      "remoteRevision",
      "reviewRevision",
      "syncedCommit",
      "syncedSource",
    ]) {
      expect(copied.draft).not.toHaveProperty(field);
    }
    const image = copied.media[0]!;
    expect(image.id).not.toBe(media.id);
    expect(image.draftId).toBe(copied.draft.id);
    expect(image.assetId).toBe(media.assetId);
    expect(image).not.toHaveProperty("remoteId");
    expect(image.sha256).toBe(media.sha256);
    expect(image.sourceSha256).toBe(media.sourceSha256);
    expect(image.alt).toBe(media.alt);
    expect(image.caption).toBe(media.caption);
    expect(await image.blob.arrayBuffer()).toEqual(await media.blob.arrayBuffer());
  });

  it("keeps the source draft, media and binding independent from changes to either new copy", () => {
    const { draft, media, binding } = fixture();
    const original = structuredClone({ draft, media, binding });
    const first = createLocalDraftBranchCopy(draft, binding, [media]);
    const second = createLocalDraftBranchCopy(draft, binding, [media]);
    first.draft.annotations![0]!.instruction = "コピーだけの指摘";
    first.draft.pendingRegistryChanges!.taxonomy![0]!.label = "コピーだけのタグ";
    first.media[0]!.alt = "コピーだけの説明";
    expect({ draft, media, binding }).toEqual(original);
    expect(second.draft.annotations).toEqual(draft.annotations);
    expect(second.draft.pendingRegistryChanges).toEqual(binding.pendingRegistryChanges);
    expect(second.media[0]!.alt).toBe(media.alt);
    expect(second.draft.id).not.toBe(first.draft.id);
    expect(second.media[0]!.id).not.toBe(first.media[0]!.id);
  });

  it("cannot accidentally copy another draft's media or invent an incomplete Git binding", () => {
    const { draft, media, binding } = fixture();
    expect(() =>
      createLocalDraftBranchCopy(draft, binding, [{ ...media, draftId: crypto.randomUUID() }]),
    ).toThrow("DRAFT_MEDIA_IDENTITY_MISMATCH");
    expect(() => createLocalDraftBranchCopy(draft, {}, [media])).toThrow(
      "BRANCH_COPY_TARGET_REQUIRED",
    );
  });

  it("copies durable image bytes independently while clearing the source branch's remote ID", async () => {
    const { draft, media, binding } = fixture();
    const stored = await encodeStoredMedia(media);
    const copy = createLocalDraftBranchCopy(draft, binding, [stored]);
    const image = copy.media[0]! as StoredMedia;
    expect(image.blobBytes).toEqual(stored.blobBytes);
    expect(image.blobBytes).not.toBe(stored.blobBytes);
    expect(image.blobType).toBe(stored.blobType);
    expect(image).not.toHaveProperty("remoteId");
    expect(image.draftId).toBe(copy.draft.id);
    expect((await decodeStoredMedia(image)).blob.type).toBe(media.blob.type);
    new Uint8Array(image.blobBytes)[0] = 9;
    expect(new Uint8Array(stored.blobBytes)[0]).toBe(1);
  });
});
