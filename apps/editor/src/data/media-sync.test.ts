import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDraftForCollection, draftPath, updateDraft } from "@xpotato/editor-core/draft";
import {
  assertRemoteMediaIdentity,
  findMediaSnapshot,
  missingDraftMedia,
  restoreMediaSnapshot,
  type RemoteMediaSnapshot,
} from "./media-sync.js";
import type { LocalDraft, LocalMedia } from "./storage.js";
import { hashBlob } from "../media/optimize.js";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  fetchMedia: vi.fn(),
  media: vi.fn(),
  saveMedia: vi.fn(),
}));
vi.mock("./api.js", () => ({
  request: mocks.request,
  query: (values: Record<string, string>) => "?" + new URLSearchParams(values).toString(),
  fetchPrivateMedia: mocks.fetchMedia,
}));
vi.mock("./storage.js", () => ({
  localMedia: mocks.media,
  saveRestoredMedia: mocks.saveMedia,
}));

const contentId = "11111111-1111-4111-8111-111111111111";
const source = createDraftForCollection({ collection: "projects", id: contentId });
function localDraft(): LocalDraft {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    source,
    path: "content/projects/example.mdx",
    sourceBranch: "content/ai-draft",
    workingBranch: "content/ai-draft",
    baseCommit: "a".repeat(40),
    savedAt: "2026-11-26T00:00:00Z",
    producer: "mixed",
  };
}
function snapshot(local = localDraft()): RemoteMediaSnapshot {
  return {
    draft: {
      id: "33333333-3333-4333-8333-333333333333",
      contentId,
      branch: local.workingBranch,
      commit: "b".repeat(40),
      sourcePath: local.path,
      revision: 4,
      lastEditedAt: "2026-11-26T00:00:00Z",
      state: "active",
      assets: {},
    },
    assets: [],
  };
}
let media: LocalMedia[];
beforeEach(() => {
  vi.resetAllMocks();
  media = [];
  mocks.media.mockImplementation(async (id: string) => media.filter((item) => item.draftId === id));
  mocks.saveMedia.mockImplementation(async (item: LocalMedia) => {
    media = [...media.filter((old) => old.id !== item.id), item];
  });
});

describe("private media draft identity", () => {
  it("does not confuse a later Git activity commit with a different media identity", () => {
    expect(() => assertRemoteMediaIdentity(localDraft(), snapshot())).not.toThrow();
  });

  it.each([
    { contentId: "44444444-4444-4444-8444-444444444444" },
    { branch: "content/other" },
    { sourcePath: "content/projects/other.mdx" },
    { state: "deleted" },
  ])("rejects a direct remote ID for another identity: %j", async (change) => {
    const local = { ...localDraft(), remoteDraftId: snapshot().draft.id };
    const remote = snapshot();
    Object.assign(remote.draft, change);
    mocks.request.mockResolvedValue(remote);
    await expect(findMediaSnapshot(local)).rejects.toThrow("DRAFT_MEDIA_IDENTITY_MISMATCH");
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(mocks.media).not.toHaveBeenCalled();
  });

  it("validates the full record returned after a list lookup", async () => {
    const remote = snapshot();
    mocks.request.mockResolvedValueOnce([remote.draft]);
    mocks.request.mockResolvedValueOnce({
      ...remote,
      draft: { ...remote.draft, sourcePath: "content/projects/different.mdx" },
    });
    await expect(findMediaSnapshot(localDraft())).rejects.toThrow("DRAFT_MEDIA_IDENTITY_MISMATCH");
  });

  it("rejects duplicate article branch records before selecting images", async () => {
    const remote = snapshot();
    mocks.request.mockResolvedValue([
      remote.draft,
      { ...remote.draft, id: "55555555-5555-4555-8555-555555555555" },
    ]);
    await expect(findMediaSnapshot(localDraft())).rejects.toThrow("DRAFT_MEDIA_AMBIGUOUS");
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });

  it("uses the legacy default source path only when the local path matches it", () => {
    const remote = snapshot();
    delete remote.draft.sourcePath;
    expect(() => assertRemoteMediaIdentity(localDraft(), remote)).toThrow(
      "DRAFT_MEDIA_IDENTITY_MISMATCH",
    );
    expect(() =>
      assertRemoteMediaIdentity({ ...localDraft(), path: draftPath(contentId) }, remote),
    ).not.toThrow();
  });

  it("refuses restoration before reading or writing local media for another path", async () => {
    const remote = snapshot();
    remote.draft.sourcePath = "content/projects/other.mdx";
    await expect(restoreMediaSnapshot(localDraft(), remote)).rejects.toThrow(
      "DRAFT_MEDIA_IDENTITY_MISMATCH",
    );
    expect(mocks.media).not.toHaveBeenCalled();
    expect(mocks.fetchMedia).not.toHaveBeenCalled();
    expect(mocks.saveMedia).not.toHaveBeenCalled();
  });
});

describe("referenced draft media", () => {
  it("reports missing Markdown, Figure and hero assets without counting another local draft", async () => {
    const local = localDraft();
    local.source = updateDraft(
      local.source,
      { hero: "cover" },
      '\n![説明](media:diagram)\n\n<Figure asset="chart" alt="グラフ" />\n\n![再掲](media:diagram)\n',
    );
    media = [{ draftId: "other-local-draft", assetId: "diagram" } as LocalMedia];
    expect(await missingDraftMedia(local)).toEqual(["diagram", "chart", "cover"]);
    media.push({ draftId: local.id, assetId: "diagram" } as LocalMedia);
    expect(await missingDraftMedia(local)).toEqual(["chart", "cover"]);
  });

  it("reports references that have never been registered in a remote snapshot", async () => {
    const local = localDraft();
    local.source = updateDraft(local.source, {}, '\n<Figure asset="new-diagram" alt="図" />\n');
    const result = await restoreMediaSnapshot(local, snapshot(local));
    expect(result.missing).toEqual(["new-diagram"]);
    expect(mocks.fetchMedia).not.toHaveBeenCalled();
  });

  it("restores exact bytes under the MDX asset ID and does not report them as missing", async () => {
    const local = localDraft();
    local.source = updateDraft(local.source, {}, '\n<Figure asset="diagram" alt="図" />\n');
    const remote = snapshot(local);
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    const sha = await hashBlob(blob);
    remote.draft.assets.diagram = "media-id";
    remote.assets.push({
      id: "media-id",
      draftId: remote.draft.id,
      assetId: "diagram",
      sha256: sha,
      sourceSha256: sha,
      bytes: blob.size,
      sourceBytes: blob.size,
      mime: blob.type,
      kind: "technical",
      createdAt: remote.draft.lastEditedAt,
      status: "staged",
      transform: "identity-v1",
      sourceRetained: true,
      width: 1,
      height: 1,
      frames: 1,
      durationMs: 0,
    });
    mocks.fetchMedia.mockResolvedValue(blob);
    const result = await restoreMediaSnapshot(local, remote);
    expect(result.missing).toEqual([]);
    expect(result.draft.remoteDraftId).toBe(remote.draft.id);
    expect(media[0]).toMatchObject({
      draftId: local.id,
      assetId: "diagram",
      sha256: sha,
      remoteId: "media-id",
    });
    expect(new Uint8Array(await media[0]!.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    mocks.fetchMedia.mockClear();
    mocks.saveMedia.mockClear();
    expect((await restoreMediaSnapshot(local, remote)).missing).toEqual([]);
    expect(mocks.fetchMedia).not.toHaveBeenCalled();
    expect(mocks.saveMedia).not.toHaveBeenCalled();

    const cached = media[0]!;
    const corrupted = { ...cached, blob: new Blob(["bad"], { type: "image/png" }) };
    media[0] = corrupted;
    expect((await restoreMediaSnapshot(local, remote)).missing).toEqual([]);
    expect(mocks.fetchMedia).toHaveBeenCalledWith("media-id");
    expect(mocks.saveMedia.mock.calls[0]![1]).toBe(corrupted);
    expect(new Uint8Array(await media[0]!.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("repairs an unreadable legacy cache even when its hash metadata and remote ID still match", async () => {
    const local = localDraft();
    local.source = updateDraft(local.source, {}, '\n<Figure asset="diagram" alt="図" />\n');
    const remote = snapshot(local);
    const blob = new Blob(["verified remote bytes"], { type: "image/webp" });
    const sha = await hashBlob(blob);
    remote.draft.assets.diagram = "media-id";
    remote.assets = [{
      id: "media-id",
      draftId: remote.draft.id,
      assetId: "diagram",
      sha256: sha,
      sourceSha256: sha,
      bytes: blob.size,
      sourceBytes: blob.size,
      mime: blob.type,
      kind: "technical",
      createdAt: remote.draft.lastEditedAt,
      status: "staged",
      transform: "identity-v1",
      sourceRetained: true,
      width: 1,
      height: 1,
      frames: 1,
      durationMs: 0,
    }];
    const broken = new Blob(["verified remote bytes"], { type: "image/webp" });
    Object.defineProperty(broken, "arrayBuffer", {
      value: async () => { throw new DOMException("Unavailable", "NotReadableError"); },
    });
    const cached: LocalMedia = {
      id: "cached-image",
      draftId: local.id,
      assetId: "diagram",
      blob: broken,
      originalBytes: blob.size,
      sourceSha256: sha,
      sha256: sha,
      kind: "technical",
      transform: "identity-v1",
      createdAt: remote.draft.lastEditedAt,
      remoteId: "media-id",
      originalName: "diagram.webp",
      sourceRetained: true,
      alt: "端末内の説明",
      caption: "端末内の注記",
    };
    media.push(cached);
    mocks.fetchMedia.mockResolvedValue(blob);
    expect((await restoreMediaSnapshot(local, remote)).missing).toEqual([]);
    expect(mocks.fetchMedia).toHaveBeenCalledWith("media-id");
    expect(mocks.saveMedia.mock.calls[0]![1]).toBe(cached);
    expect(await media[0]!.blob.text()).toBe("verified remote bytes");
    expect(media[0]!.id).toBe(cached.id);
    mocks.fetchMedia.mockClear();
    media[0] = { ...cached, blob: new Blob(["unsubmitted edit"]), sha256: "d".repeat(64) };
    delete media[0]!.remoteId;
    expect((await restoreMediaSnapshot(local, remote)).missing).toContain(
      "diagram（端末内の変更と競合）",
    );
    expect(mocks.fetchMedia).not.toHaveBeenCalled();
  });

  it("does not fetch an asset belonging to a different remote draft", async () => {
    const local = localDraft();
    local.source = updateDraft(local.source, {}, '\n<Figure asset="diagram" alt="図" />\n');
    const remote = snapshot(local);
    remote.draft.assets.diagram = "media-id";
    remote.assets = [
      {
        id: "media-id",
        draftId: "another-remote-draft",
        assetId: "diagram",
        status: "staged",
      } as RemoteMediaSnapshot["assets"][number],
    ];
    expect((await restoreMediaSnapshot(local, remote)).missing).toEqual(["diagram"]);
    expect(mocks.fetchMedia).not.toHaveBeenCalled();
  });
});
