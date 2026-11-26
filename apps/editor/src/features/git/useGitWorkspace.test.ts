import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { anchorSelection } from "@xpotato/editor-core/annotations";
import { parseDraft, updateDraft } from "@xpotato/editor-core/draft";
import type { LocalDraft, LocalMedia } from "../../data/storage.js";
import type { RemoteMediaSnapshot } from "../../data/media-sync.js";
import type { DraftWorkspace } from "../drafts/useDraftWorkspace.js";
import { createLocalDraft } from "../drafts/model.js";
import { AstroReview } from "../../components/AstroReview.js";
import { useGitWorkspace } from "./useGitWorkspace.js";
import schema from "../../../../../content/registry/editor.json";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  find: vi.fn(),
  restore: vi.fn(),
  missing: vi.fn(),
  media: vi.fn(),
  saveMedia: vi.fn(),
  claim: vi.fn(),
  updateDraft: vi.fn(),
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
  missingDraftMedia: mocks.missing,
}));
vi.mock("../../data/storage.js", () => ({
  claimGitDraft: mocks.claim,
  localMedia: mocks.media,
  saveLocalMedia: mocks.saveMedia,
  updateLocalDraft: mocks.updateDraft,
}));

beforeEach(() => vi.resetAllMocks());

function astroReviewButton(draft: LocalDraft) {
  const html = renderToStaticMarkup(createElement(AstroReview, { draft, authenticated: true }));
  expect(html).toContain("Astroレビューを取得");
  return html.match(/<button\b[^>]*>/u)?.[0];
}

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
  const savedDrafts = new Map<string, LocalDraft>();
  const workspace = {
    draft: initial,
    current: { current: initial },
    hydrated: false,
    persist: vi.fn(async () => {
      const current = workspace.current.current;
      if (savedDrafts.has(current.id)) savedDrafts.set(current.id, current);
    }),
    setDraft: vi.fn((update: LocalDraft | ((current: LocalDraft) => LocalDraft)) => {
      workspace.current.current = typeof update === "function" ? update(workspace.current.current) : update;
    }),
    openLocal: vi.fn(async (draft: LocalDraft) => {
      opened.push(draft);
      workspace.current.current = draft;
    }),
  } as unknown as DraftWorkspace;
  mocks.claim.mockImplementation(async (candidate: LocalDraft) => {
    const existing = [...savedDrafts.values()].find((draft) => draft.path === candidate.path && draft.workingBranch === candidate.workingBranch);
    if (!existing) savedDrafts.set(candidate.id, candidate);
    return { draft: existing ?? candidate, created: !existing };
  });
  mocks.updateDraft.mockImplementation(async (id: string, fallback: LocalDraft, update: (current: LocalDraft) => LocalDraft) => {
    const next = update(savedDrafts.get(id) ?? fallback);
    savedDrafts.set(id, next);
    return next;
  });
  let git: ReturnType<typeof useGitWorkspace> | undefined;
  const onError = vi.fn();
  function Probe() {
    git = useGitWorkspace(workspace, onError, vi.fn());
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  mocks.request.mockImplementation(async (route: string) => {
    if (route.startsWith("/document?")) return { source, path: initial.path };
    if (route.startsWith("/manifest?"))
      return {
        contractVersion: 1,
        categories: {},
        tags: [],
        modules: [],
        contractHash: schema.contractHash,
      };
    if (route.startsWith("/snapshot?")) {
      return {
        branch: new URLSearchParams(route.split("?")[1]).get("branch"),
        commit: "a".repeat(40),
      };
    }
    if (route.startsWith("/documents?"))
      return [{ path: initial.path, sha: "b".repeat(40), bytes: 100 }];
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
  mocks.missing.mockResolvedValue([]);
  return { git: git!, initial, source, remote, opened, restoredMedia, workspace, onError, savedDrafts };
}

describe("opening Git drafts into an explicit workspace", () => {
  it("reopens the same local ID and restores media again without adding another draft", async () => {
    const state = fixture();
    mocks.find.mockResolvedValue(state.remote);
    const snapshot = { branch: "content/source", commit: "a".repeat(40) };
    await state.git.openDocument(state.initial.path, snapshot, snapshot.branch, "drafts");
    const id = state.workspace.current.current.id;
    await state.git.openDocument(state.initial.path, snapshot, snapshot.branch, "drafts");
    expect(state.workspace.current.current.id).toBe(id);
    expect(state.savedDrafts.size).toBe(1);
    expect(mocks.restore).toHaveBeenCalledTimes(2);
    expect(mocks.restore.mock.calls.map(([draft]) => draft.id)).toEqual([id, id]);
  });

  it("keeps local text, review and registry changes when reopening newer Git content", async () => {
    const state = fixture();
    const local: LocalDraft = {
      ...state.initial,
      source: updateDraft(state.source, { title: "端末だけの追記" }),
      sourceBranch: "content/source",
      workingBranch: "content/source",
      baseCommit: "b".repeat(40),
      baseSource: state.source,
      annotations: [],
      pendingRegistryChanges: { taxonomy: [{ namespace: "tags", id: "new-tag", label: "未保存" }] },
    };
    state.savedDrafts.set(local.id, local);
    state.workspace.current.current = local;
    mocks.find.mockResolvedValue(state.remote);
    await state.git.openDocument(state.initial.path, { branch: "content/source", commit: "a".repeat(40) }, "content/source", "drafts");
    expect(state.workspace.current.current).toMatchObject({
      id: local.id, source: local.source, baseCommit: local.baseCommit,
      annotations: [], pendingRegistryChanges: local.pendingRegistryChanges,
      remoteDraftId: state.remote.draft.id,
    });
    expect(state.savedDrafts.size).toBe(1);
  });

  it("recovers review that was never retrieved without replacing an existing local review", async () => {
    const state = fixture();
    const snapshot = { branch: "content/source", commit: "a".repeat(40) };
    mocks.find.mockResolvedValueOnce(null).mockResolvedValue(state.remote);
    await state.git.openDocument(state.initial.path, snapshot, snapshot.branch, "drafts");
    const id = state.workspace.current.current.id;
    expect(state.workspace.current.current.annotations).toBeUndefined();
    await state.git.openDocument(state.initial.path, snapshot, snapshot.branch, "drafts");
    expect(state.workspace.current.current.id).toBe(id);
    expect(state.workspace.current.current.annotations).toEqual(state.remote.draft.review!.comments);
    state.workspace.current.current = { ...state.workspace.current.current, annotations: [] };
    await state.git.openDocument(state.initial.path, snapshot, snapshot.branch, "drafts");
    expect(state.workspace.current.current.annotations).toEqual([]);
  });

  it("updates an unchanged local source from Git while keeping its ID", async () => {
    const state = fixture();
    const local = { ...state.initial, source: state.source, sourceBranch: "content/source", workingBranch: "content/source", baseSource: state.source, baseCommit: "b".repeat(40) };
    state.savedDrafts.set(local.id, local);
    state.workspace.current.current = local;
    await state.git.openDocument(state.initial.path, { branch: "content/source", commit: "a".repeat(40) }, "content/source", "drafts");
    expect(state.workspace.current.current).toMatchObject({ id: local.id, baseCommit: "a".repeat(40), source: state.source });
    expect(state.savedDrafts.size).toBe(1);
  });

  it("does not start a second import while the first Git read is pending", async () => {
    const state = fixture();
    const request = mocks.request.getMockImplementation()!;
    let release!: (document: { source: string; path: string }) => void;
    const delayed = new Promise<{ source: string; path: string }>((resolve) => { release = resolve; });
    mocks.request.mockImplementation((route: string) => route.startsWith("/document?") ? delayed : request(route));
    const snapshot = { branch: "content/source", commit: "a".repeat(40) };
    const first = state.git.openDocument(state.initial.path, snapshot, snapshot.branch, "drafts");
    await expect(state.git.openDocument(state.initial.path, snapshot, snapshot.branch, "drafts")).rejects.toThrow("読み込み中");
    release({ source: state.source, path: state.initial.path });
    await first;
    expect(state.savedDrafts.size).toBe(1);
    expect(mocks.claim).toHaveBeenCalledTimes(1);
  });

  it("does not silently pick among old copies and forwards an explicitly selected identity", async () => {
    const state = fixture();
    mocks.claim.mockRejectedValueOnce(Error("同じ原稿の下書きが複数あります"));
    const snapshot = { branch: "content/source", commit: "a".repeat(40) };
    await expect(state.git.openDocument(state.initial.path, snapshot, snapshot.branch, "drafts")).rejects.toThrow("複数");
    expect(state.opened).toHaveLength(0);
    expect(mocks.restore).not.toHaveBeenCalled();
    const chosen = crypto.randomUUID();
    await state.git.openDocument(state.initial.path, snapshot, snapshot.branch, "drafts", false, undefined, chosen);
    expect(mocks.claim).toHaveBeenLastCalledWith(expect.objectContaining({ path: state.initial.path, workingBranch: snapshot.branch }), chosen);
  });

  it("keeps source-branch text, images and review bound to the same working branch", async () => {
    const state = fixture();
    mocks.find.mockImplementation(async (draft: LocalDraft) =>
      draft.workingBranch === "content/source" ? state.remote : null,
    );
    await state.git.openDocument(
      state.initial.path,
      { branch: "content/source", commit: "a".repeat(40) },
      "content/source",
      "drafts",
    );
    expect(mocks.find.mock.calls.map(([draft]) => (draft as LocalDraft).workingBranch)).toEqual([
      "content/source",
    ]);
    const opened = state.opened[0]!;
    expect(opened.workingBranch).toBe("content/source");
    expect(opened.sourceBranch).toBe("content/source");
    expect(opened.baseCommit).toBe("a".repeat(40));
    expect(opened.source).toBe(state.source);
    expect(opened.syncedCommit).toBe("a".repeat(40));
    expect(opened.syncedSource).toBe(state.source);
    expect(astroReviewButton(opened)).not.toContain("disabled");
    expect(opened.annotations).toEqual(state.remote.draft.review!.comments);
    expect(opened.remoteDraftId).toBe(state.remote.draft.id);
    expect(opened.remoteRevision).toBe(7);
    expect(opened.reviewRevision).toBe(3);
    expect(mocks.saveMedia).not.toHaveBeenCalled();
    expect(state.remote.draft.branch).toBe("content/source");
    expect(state.restoredMedia[0]!.remoteId).toBe("remote-asset");
  });

  it.each([
    { label: "a local copy", branch: "content/source", source: "content/source", local: true },
    { label: "a new branch", branch: "content/copy", source: "content/source", local: false },
    { label: "a non-content branch", branch: "main", source: "main", local: false },
  ])(
    "does not mark an unchanged draft opened as $label as saved for Astro review",
    async (plan) => {
      const state = fixture();
      await state.git.openDocument(
        state.initial.path,
        { branch: plan.branch, commit: "a".repeat(40) },
        plan.source,
        undefined,
        plan.local,
      );
      const opened = state.opened[0]!;
      expect(opened.source).toBe(state.source);
      expect(opened.syncedCommit).toBeUndefined();
      expect(opened.syncedSource).toBeUndefined();
      expect(astroReviewButton(opened)).toContain("disabled");
    },
  );

  it("refuses to detach a Git draft from its branch while resuming it", async () => {
    const state = fixture();
    mocks.find.mockResolvedValue(state.remote);
    await expect(
      state.git.openDocument(
        state.initial.path,
        { branch: "content/source", commit: "a".repeat(40) },
        "content/source",
        "drafts",
        true,
      ),
    ).rejects.toThrow("同じ作業ブランチ");
    expect(state.opened).toHaveLength(0);
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it("refuses another branch even if it contains an article at the same path", async () => {
    const state = fixture();
    state.remote.draft.branch = "content/target";
    mocks.find.mockResolvedValue(state.remote);
    await expect(
      state.git.openDocument(
        state.initial.path,
        { branch: "content/target", commit: "a".repeat(40) },
        "content/source",
        "drafts",
      ),
    ).rejects.toThrow("同じ作業ブランチ");
    expect(state.opened).toHaveLength(0);
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.saveMedia).not.toHaveBeenCalled();
  });

  it("opens the exact listed commit without fetching a new head or another branch", async () => {
    const state = fixture();
    state.git.setSourceBranch("content/source");
    const listed = await state.git.readBranch();
    mocks.request.mockClear();
    await state.git.openSelectedDocument(
      state.initial.path,
      { mode: "existing", sourceBranch: "content/source", targetBranch: "content/source" },
      "drafts",
      listed.snapshot,
    );
    const routes = mocks.request.mock.calls.map(([route]) => route as string);
    expect(routes).toHaveLength(2);
    expect(routes.every((route) => /branch=content%2Fsource&commit=a{40}/u.test(route))).toBe(true);
    expect(
      routes.some((route) => route.startsWith("/snapshot") || route.startsWith("/branch?")),
    ).toBe(false);
    expect(state.opened[0]!.workingBranch).toBe("content/source");
    expect(state.opened[0]!.baseCommit).toBe(listed.snapshot.commit);
    expect(state.opened[0]!.source).toBe(state.source);
    expect(state.opened[0]!.syncedCommit).toBe(listed.snapshot.commit);
    expect(state.opened[0]!.syncedSource).toBe(state.source);
    expect(astroReviewButton(state.opened[0]!)).not.toContain("disabled");
  });

  it("reports referenced images missing from Draft storage while keeping the text editable", async () => {
    const state = fixture();
    mocks.missing.mockResolvedValue(["architecture-editor"]);
    await state.git.openDocument(
      state.initial.path,
      { branch: "content/source", commit: "a".repeat(40) },
      "content/source",
      "drafts",
    );
    expect(state.opened[0]!.source).toBe(state.source);
    expect(state.onError).toHaveBeenCalledWith(
      expect.stringContaining("未登録の画像があります: architecture-editor"),
    );
  });

  it.each(["existing", "new", "local"] as const)(
    "rejects a %s plan that would move a selected draft away from its source branch",
    async (mode) => {
      const state = fixture();
      state.git.setSourceBranch("content/source");
      const listed = await state.git.readBranch();
      mocks.request.mockClear();
      await expect(
        state.git.openSelectedDocument(
          state.initial.path,
          { mode, sourceBranch: "content/source", targetBranch: "content/unrelated" },
          "drafts",
          listed.snapshot,
        ),
      ).rejects.toThrow("同じ作業ブランチ");
      expect(mocks.request).not.toHaveBeenCalled();
      expect(state.opened).toHaveLength(0);
    },
  );

  it("rejects a previous selection after the source branch changes", async () => {
    const state = fixture();
    state.git.setSourceBranch("content/source");
    const listed = await state.git.readBranch();
    state.git.setSourceBranch("content/other");
    mocks.request.mockClear();
    await expect(
      state.git.openSelectedDocument(
        state.initial.path,
        { mode: "existing", sourceBranch: "content/source", targetBranch: "content/source" },
        "drafts",
        listed.snapshot,
      ),
    ).rejects.toThrow("一覧の版が変わりました");
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("discards an older branch response arriving after the new list", async () => {
    const state = fixture();
    const request = mocks.request.getMockImplementation()!;
    let release!: (value: { branch: string; commit: string }) => void;
    const delayed = new Promise<{ branch: string; commit: string }>((resolve) => {
      release = resolve;
    });
    mocks.request.mockImplementation((route: string) =>
      route === "/snapshot?branch=content%2Fsource" ? delayed : request(route),
    );
    state.git.setSourceBranch("content/source");
    const first = state.git.readBranch();
    const rejected = expect(first).rejects.toThrow("読み込み元が変わりました");
    state.git.setSourceBranch("content/other");
    const latest = await state.git.readBranch();
    release({ branch: "content/source", commit: "a".repeat(40) });
    await rejected;
    await state.git.openSelectedDocument(
      state.initial.path,
      { mode: "existing", sourceBranch: "content/other", targetBranch: "content/other" },
      "drafts",
      latest.snapshot,
    );
    expect(state.opened[0]!.workingBranch).toBe("content/other");
  });

  it("keeps a saved local draft bound to its original branch even while disconnected", async () => {
    const state = fixture();
    const local = { ...state.initial, workingBranch: "content/source" };
    await expect(
      state.git.prepareLocalWorkspace(local, {
        mode: "existing",
        sourceBranch: "content/source",
        targetBranch: "content/source",
      }),
    ).resolves.toEqual({});
    expect(mocks.request).not.toHaveBeenCalled();
    for (const mode of ["existing", "new", "local"] as const) {
      await expect(
        state.git.prepareLocalWorkspace(local, {
          mode,
          sourceBranch: "content/source",
          targetBranch: "content/other",
        }),
      ).rejects.toThrow("元の作業ブランチ");
    }
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("does not replace a different document selected while the Git read is pending", async () => {
    const state = fixture();
    const request = mocks.request.getMockImplementation()!;
    let release!: (value: { source: string; path: string }) => void;
    const delayed = new Promise<{ source: string; path: string }>((resolve) => {
      release = resolve;
    });
    mocks.request.mockImplementation((route: string) =>
      route.startsWith("/document?") ? delayed : request(route),
    );
    const opening = state.git.openDocument(
      state.initial.path,
      { branch: "content/source", commit: "a".repeat(40) },
      "content/source",
      "drafts",
    );
    state.workspace.current.current = createLocalDraft();
    release({ source: state.source, path: state.initial.path });
    await expect(opening).rejects.toThrow("原稿が切り替わりました");
    expect(state.opened).toHaveLength(0);
  });

  it("still opens a published article as a local revision with the same ContentId", async () => {
    const state = fixture();
    const published = updateDraft(state.source, { draft: false });
    const request = mocks.request.getMockImplementation()!;
    mocks.request.mockImplementation((route: string) =>
      route.startsWith("/document?")
        ? { source: published, path: state.initial.path }
        : request(route),
    );
    await state.git.openDocument(
      state.initial.path,
      { branch: "main", commit: "a".repeat(40) },
      "main",
      "revise",
      true,
    );
    const opened = state.opened[0]!;
    expect(opened.workingBranch).toBe("");
    expect(opened.sourceBranch).toBe("main");
    expect(parseDraft(opened.source).data.id).toBe(parseDraft(published).data.id);
    expect(parseDraft(opened.source).data.draft).toBe(true);
    expect(opened.syncedCommit).toBeUndefined();
    expect(opened.syncedSource).toBeUndefined();
    expect(astroReviewButton(opened)).toContain("disabled");
  });

  it("refuses to replace the selected published article with a different revision at the same target path", async () => {
    const state = fixture();
    const published = updateDraft(state.source, { draft: false });
    const request = mocks.request.getMockImplementation()!;
    mocks.request.mockImplementation((route: string) => {
      if (route.startsWith("/document?")) {
        return {
          source:
            new URLSearchParams(route.split("?")[1]).get("branch") === "main"
              ? published
              : updateDraft(state.source, { title: "別ブランチで先に改稿した原稿" }),
          path: state.initial.path,
        };
      }
      return request(route);
    });
    await expect(
      state.git.openDocument(
        state.initial.path,
        { branch: "content/other", commit: "b".repeat(40) },
        "main",
        "revise",
        false,
        { branch: "main", commit: "a".repeat(40) },
      ),
    ).rejects.toThrow("選んだ原稿と作業ブランチの原稿が異なります");
    expect(state.opened).toHaveLength(0);
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it("keeps revision into an existing branch when it contains the exact selected published source", async () => {
    const state = fixture();
    const published = updateDraft(state.source, { draft: false });
    const request = mocks.request.getMockImplementation()!;
    mocks.request.mockImplementation((route: string) =>
      route.startsWith("/document?")
        ? { source: published, path: state.initial.path }
        : request(route),
    );
    await state.git.openDocument(
      state.initial.path,
      { branch: "content/revision", commit: "b".repeat(40) },
      "main",
      "revise",
      false,
      { branch: "main", commit: "a".repeat(40) },
    );
    expect(state.opened[0]!.workingBranch).toBe("content/revision");
    expect(state.opened[0]!.baseSource).toBe(published);
    expect(state.opened[0]!.baseCommit).toBe("b".repeat(40));
    expect(parseDraft(state.opened[0]!.source).data.id).toBe(parseDraft(published).data.id);
    expect(state.opened[0]!.syncedCommit).toBeUndefined();
    expect(state.opened[0]!.syncedSource).toBeUndefined();
    expect(astroReviewButton(state.opened[0]!)).toContain("disabled");
  });
});
