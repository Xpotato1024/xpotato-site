import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { anchorSelection } from "@xpotato/editor-core/annotations";
import { parseDraft, updateDraft } from "@xpotato/editor-core/draft";
import type { LocalDraft, LocalMedia } from "../../data/storage.js";
import type { RemoteMediaSnapshot } from "../../data/media-sync.js";
import type { DraftWorkspace } from "../drafts/useDraftWorkspace.js";
import { createLocalDraft } from "../drafts/model.js";
import { useGitWorkspace } from "./useGitWorkspace.js";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  find: vi.fn(),
  restore: vi.fn(),
  media: vi.fn(),
  saveMedia: vi.fn(),
}));
vi.mock("../../data/api.js", () => ({
  EditorApiError: class extends Error {},
  loginState: vi.fn(),
  query: (values: Record<string, string>) => "?" + new URLSearchParams(values).toString(),
  request: mocks.request,
}));
vi.mock("../../data/media-sync.js", () => ({
  findMediaSnapshot: mocks.find,
  restoreMediaSnapshot: mocks.restore,
}));
vi.mock("../../data/storage.js", () => ({
  localMedia: mocks.media,
  saveLocalMedia: mocks.saveMedia,
  updateLocalDraft: vi.fn(),
}));

beforeEach(() => vi.resetAllMocks());

function fixture() {
  const initial = createLocalDraft();
  const body = "AI下書きの確認箇所。\n";
  const source = updateDraft(initial.source, { title: "確認する下書き" }, body);
  const contentId = parseDraft(source).data.id;
  const remote: RemoteMediaSnapshot = {
    draft: {
      id: crypto.randomUUID(),
      contentId,
      branch: "content/source",
      commit: "a".repeat(40),
      revision: 7,
      lastEditedAt: initial.savedAt,
      state: "active",
      assets: { illustration: "remote-asset" },
      review: {
        revision: 3,
        comments: [
          {
            id: crypto.randomUUID(),
            contentId,
            anchor: anchorSelection(body, { quote: "AI下書きの確認箇所。" }),
            instruction: "この説明を確認してください。",
            createdAt: initial.savedAt,
            status: "open",
          },
        ],
      },
    },
    assets: [],
  };
  const opened: LocalDraft[] = [];
  const restoredMedia: LocalMedia[] = [];
  const workspace = {
    draft: initial,
    hydrated: false,
    persist: vi.fn(async () => {}),
    openLocal: vi.fn(async (draft: LocalDraft) => {
      opened.push(draft);
    }),
  } as unknown as DraftWorkspace;
  let git: ReturnType<typeof useGitWorkspace> | undefined;
  function Probe() {
    git = useGitWorkspace(workspace, vi.fn(), vi.fn());
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  mocks.request.mockImplementation(async (route: string) => {
    if (route.startsWith("/document?")) return { source, path: initial.path };
    if (route.startsWith("/manifest?"))
      return { contractVersion: 1, categories: {}, tags: [], modules: [] };
    throw Error("Unexpected API route: " + route);
  });
  mocks.restore.mockImplementation(async (local: LocalDraft, snapshot: RemoteMediaSnapshot) => {
    if (snapshot.draft.branch !== local.workingBranch) throw Error("DRAFT_MEDIA_IDENTITY_MISMATCH");
    restoredMedia.push({
      id: crypto.randomUUID(),
      draftId: local.id,
      assetId: "illustration",
      blob: new Blob(["image bytes"], { type: "image/png" }),
      originalBytes: 11,
      sourceSha256: "b".repeat(64),
      sha256: "b".repeat(64),
      kind: "technical",
      transform: "identity-v1",
      createdAt: initial.savedAt,
      remoteId: "remote-asset",
      originalName: "figure.png",
      sourceRetained: true,
    });
    return {
      draft: {
        ...local,
        remoteDraftId: snapshot.draft.id,
        remoteRevision: snapshot.draft.revision,
      },
      missing: [],
    };
  });
  mocks.media.mockImplementation(async (id: string) =>
    restoredMedia.filter((item) => item.draftId === id),
  );
  mocks.saveMedia.mockResolvedValue(undefined);
  return { git: git!, initial, source, remote, opened, restoredMedia };
}

describe("opening Git drafts into an explicit workspace", () => {
  it("copies source-branch images and review into a fresh branch without carrying private synchronization IDs", async () => {
    const state = fixture();
    mocks.find.mockImplementation(async (draft: LocalDraft) =>
      draft.workingBranch === "content/source" ? state.remote : null,
    );
    await state.git.openDocument(
      state.initial.path,
      { branch: "content/new", commit: "a".repeat(40) },
      "content/source",
      "drafts",
    );
    expect(mocks.find.mock.calls.map(([draft]) => (draft as LocalDraft).workingBranch)).toEqual([
      "content/new",
      "content/source",
    ]);
    const opened = state.opened[0]!;
    expect(opened.workingBranch).toBe("content/new");
    expect(opened.sourceBranch).toBe("content/source");
    expect(opened.baseCommit).toBe("a".repeat(40));
    expect(opened.source).toBe(state.source);
    expect(opened.annotations).toEqual(state.remote.draft.review!.comments);
    expect(opened).not.toHaveProperty("remoteDraftId");
    expect(opened).not.toHaveProperty("remoteRevision");
    expect(opened).not.toHaveProperty("reviewRevision");
    expect(mocks.saveMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        id: state.restoredMedia[0]!.id,
        draftId: opened.id,
        assetId: "illustration",
      }),
    );
    expect(mocks.saveMedia.mock.calls[0]![0]).not.toHaveProperty("remoteId");
    expect(state.remote.draft.branch).toBe("content/source");
    expect(state.restoredMedia[0]!.remoteId).toBe("remote-asset");
  });

  it("opens a Git draft for this device with copied images and review but no original-branch mutation identity", async () => {
    const state = fixture();
    mocks.find.mockResolvedValue(state.remote);
    await state.git.openDocument(
      state.initial.path,
      { branch: "content/source", commit: "a".repeat(40) },
      "content/source",
      "drafts",
      true,
    );
    const opened = state.opened[0]!;
    expect(opened.workingBranch).toBe("");
    expect(opened.sourceBranch).toBe("content/source");
    expect(opened.baseCommit).toBe("a".repeat(40));
    expect(opened.annotations).toEqual(state.remote.draft.review!.comments);
    for (const key of [
      "remoteDraftId",
      "remoteRevision",
      "reviewRevision",
      "syncedCommit",
      "syncedSource",
    ])
      expect(opened).not.toHaveProperty(key);
    expect(mocks.find).toHaveBeenCalledTimes(1);
    expect(mocks.media).toHaveBeenCalledWith(opened.id);
    expect(mocks.saveMedia.mock.calls[0]![0]).not.toHaveProperty("remoteId");
    expect(state.restoredMedia[0]!.draftId).toBe(opened.id);
    expect(opened.id).not.toBe(state.remote.draft.id);
  });

  it("keeps an existing target branch's own private state without falling back to another branch", async () => {
    const state = fixture();
    state.remote.draft.branch = "content/target";
    mocks.find.mockResolvedValue(state.remote);
    await state.git.openDocument(
      state.initial.path,
      { branch: "content/target", commit: "a".repeat(40) },
      "content/source",
      "drafts",
    );
    const opened = state.opened[0]!;
    expect(opened.workingBranch).toBe("content/target");
    expect(opened.remoteDraftId).toBe(state.remote.draft.id);
    expect(opened.reviewRevision).toBe(3);
    expect(opened.annotations).toEqual(state.remote.draft.review!.comments);
    expect(mocks.find).toHaveBeenCalledTimes(1);
    expect(mocks.saveMedia).not.toHaveBeenCalled();
  });
});
