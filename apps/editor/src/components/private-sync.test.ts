import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { parseDraft } from "@xpotato/editor-core/draft";
import type { LocalDraft, LocalMedia } from "../data/storage.js";
import type { RemoteMediaSnapshot } from "../data/media-sync.js";
import { createLocalDraft } from "../features/drafts/model.js";
import { ReviewPanel } from "../features/review/ReviewPanel.js";
import { MediaPanel } from "./MediaPanel.js";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  find: vi.fn(),
  restore: vi.fn(),
  media: vi.fn(),
  saveMedia: vi.fn(),
  deleteMedia: vi.fn(),
}));
const hooks = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  effects: [] as (() => void | (() => void))[],
}));

// Invoke handlers even when their buttons are disabled; a UI-only guard is insufficient.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState<T>(initial: T | (() => T)) {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) {
      hooks.values[index] = typeof initial === "function" ? (initial as () => T)() : initial;
    }
    return [
      hooks.values[index],
      (value: T | ((current: T) => T)) => {
        hooks.values[index] =
          typeof value === "function"
            ? (value as (current: T) => T)(hooks.values[index] as T)
            : value;
      },
    ];
  },
  useRef<T>(initial: T) {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = { current: initial };
    return hooks.values[index];
  },
  useEffect(effect: () => void | (() => void)) {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) {
      hooks.values[index] = true;
      hooks.effects.push(effect);
    }
  },
}));
vi.mock("../data/api.js", () => ({ request: mocks.request, query: vi.fn() }));
vi.mock("../data/media-sync.js", () => ({
  findMediaSnapshot: mocks.find,
  restoreMediaSnapshot: mocks.restore,
}));
vi.mock("../data/storage.js", () => ({
  localMedia: mocks.media,
  saveLocalMedia: mocks.saveMedia,
  deleteLocalMedia: mocks.deleteMedia,
}));
vi.mock("../media/optimize.js", () => ({ optimizeImage: vi.fn() }));
vi.mock("../media/prepared.js", () => ({ importPreparedMedia: vi.fn() }));
vi.mock("./MediaHandoffPanel.js", () => ({ MediaHandoffPanel: () => null }));

const branchMessage = "同期するには、下書きの開始画面で作業ブランチを選んでください。";
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

async function mount<P>(component: (props: P) => ReactElement, props: P) {
  hooks.values.length = 0;
  hooks.effects.length = 0;
  const render = (changes: Partial<P> = {}) => {
    Object.assign(props as object, changes);
    hooks.cursor = 0;
    return component(props);
  };
  render();
  for (const effect of hooks.effects.splice(0)) effect();
  await flush();
  return { tree: render(), render };
}

type ButtonProps = { children?: ReactNode; disabled?: boolean; onClick?: () => void };
function elements(node: ReactNode): ReactElement<ButtonProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ButtonProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (isValidElement<ButtonProps>(node)) return text(node.props.children);
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}
function button(tree: ReactNode, label: string) {
  const found = elements(tree).find((node) => node.type === "button" && text(node) === label);
  if (!found) throw Error("Button not found: " + label);
  return found.props;
}
async function click(tree: ReactNode, label: string) {
  button(tree, label).onClick?.();
  await flush();
}
function draftFixture(): LocalDraft {
  return {
    ...createLocalDraft(),
    sourceBranch: "content/source",
    baseCommit: "a".repeat(40),
    remoteDraftId: "old-private-draft",
    remoteRevision: 7,
    reviewRevision: 3,
  };
}
function mediaFixture(draft: LocalDraft): LocalMedia {
  return {
    id: "local-image",
    draftId: draft.id,
    assetId: "figure",
    blob: new Blob(["image"], { type: "image/png" }),
    originalBytes: 5,
    sourceSha256: "b".repeat(64),
    sha256: "b".repeat(64),
    kind: "technical",
    transform: "identity-v1",
    createdAt: draft.savedAt,
    originalName: "figure.png",
    sourceRetained: true,
    remoteId: "old-private-image",
  };
}
function mediaProps(draft: LocalDraft, authenticated = true) {
  return { draft, authenticated, onInsert: vi.fn(), onDraft: vi.fn(), onError: vi.fn() };
}
function reviewProps(draft: LocalDraft, authenticated = true) {
  return {
    draft,
    authenticated,
    selection: null,
    composerDraft: { instruction: "", followUps: {} },
    onComposerChange: vi.fn(),
    onChange: vi.fn(),
    onDraft: vi.fn(),
    onLocate: vi.fn(),
    onError: vi.fn(),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  mocks.media.mockResolvedValue([]);
  mocks.find.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllGlobals());

describe("private synchronization requires a bound working branch", () => {
  it.each([
    { workingBranch: "", baseCommit: "a".repeat(40), authenticated: true },
    { workingBranch: "content/work", baseCommit: "", authenticated: true },
    { workingBranch: "content/work", baseCommit: "a".repeat(40), authenticated: false },
  ])("blocks media reads and writes for %j even if a disabled handler runs", async (binding) => {
    const draft = { ...draftFixture(), ...binding };
    const media = mediaFixture(draft);
    delete media.remoteId;
    mocks.media.mockResolvedValue([media]);
    const props = mediaProps(draft, binding.authenticated);
    const { tree } = await mount(MediaPanel, props);
    for (const label of ["別の端末で同期した画像を取得", "画像を同期"]) {
      expect(button(tree, label).disabled).toBe(true);
      await click(tree, label);
    }
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.restore).not.toHaveBeenCalled();
    expect(props.onDraft).not.toHaveBeenCalled();
    expect(props.onError).toHaveBeenCalledWith(
      binding.authenticated ? branchMessage : "同期するには、GitHubに接続してください。",
    );
    if (binding.authenticated) expect(text(tree)).toContain(branchMessage);
  });

  it.each([true, false])(
    "keeps local image deletion available without a branch (auth %j)",
    async (authenticated) => {
      const draft = draftFixture();
      const media = mediaFixture(draft);
      mocks.media.mockResolvedValue([media]);
      const { tree } = await mount(MediaPanel, mediaProps(draft, authenticated));
      expect(button(tree, "棄却").disabled).not.toBe(true);
      await click(tree, "棄却");
      expect(mocks.deleteMedia).toHaveBeenCalledExactlyOnceWith(media.id);
      expect(mocks.request).not.toHaveBeenCalled();
      expect(mocks.find).not.toHaveBeenCalled();
    },
  );

  it("still synchronizes rejection before deleting an image from a bound draft", async () => {
    const draft = { ...draftFixture(), workingBranch: "content/work" };
    const media = mediaFixture(draft);
    mocks.media.mockResolvedValue([media]);
    mocks.find.mockResolvedValue({
      draft: { id: draft.remoteDraftId, revision: 7, assets: { [media.assetId]: media.remoteId } },
    });
    const { tree } = await mount(MediaPanel, mediaProps(draft));
    await click(tree, "棄却");
    expect(mocks.request).toHaveBeenCalledWith("/draft-state", {
      method: "POST",
      body: { id: draft.remoteDraftId, revision: 7, action: "reject", assetId: media.assetId },
    });
    expect(mocks.deleteMedia).toHaveBeenCalledExactlyOnceWith(media.id);
    expect(mocks.find).toHaveBeenCalledWith(draft);
  });

  it("does not reject a newer image through a stale card", async () => {
    const draft = { ...draftFixture(), workingBranch: "content/work" };
    const media = mediaFixture(draft);
    mocks.media.mockResolvedValue([media]);
    mocks.find.mockResolvedValue({
      draft: {
        id: draft.remoteDraftId,
        revision: 8,
        assets: { [media.assetId]: "new-private-image" },
      },
    });
    const props = mediaProps(draft);
    const { tree } = await mount(MediaPanel, props);
    await click(tree, "棄却");
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.deleteMedia).not.toHaveBeenCalled();
    expect(props.onError).toHaveBeenCalledWith(
      "画像が別の端末で変更されています。画像を取得して確認してください。",
    );
  });

  it("cannot restore a previously displayed remote rejection after the branch is detached", async () => {
    const draft = { ...draftFixture(), workingBranch: "content/work" };
    const media = mediaFixture(draft);
    const remote: RemoteMediaSnapshot = {
      draft: {
        id: draft.remoteDraftId!,
        contentId: parseDraft(draft.source).data.id,
        branch: draft.workingBranch,
        commit: draft.baseCommit,
        revision: 7,
        lastEditedAt: draft.savedAt,
        state: "active",
        assets: {},
      },
      assets: [
        {
          id: "rejected-image",
          draftId: draft.remoteDraftId!,
          assetId: media.assetId,
          sha256: media.sha256,
          sourceSha256: media.sourceSha256,
          bytes: 5,
          sourceBytes: 5,
          mime: "image/png",
          kind: "technical",
          createdAt: draft.savedAt,
          status: "rejected",
          transform: "identity-v1",
          sourceRetained: true,
          width: 1,
          height: 1,
          frames: 1,
          durationMs: 0,
        },
      ],
    };
    mocks.find.mockResolvedValue(remote);
    mocks.restore.mockResolvedValue({ draft, missing: [] });
    const props = mediaProps(draft);
    const panel = await mount(MediaPanel, props);
    expect(button(panel.tree, "別の端末で同期した画像を取得").disabled).toBe(false);
    await click(panel.tree, "別の端末で同期した画像を取得");
    const detached = panel.render({ draft: { ...draft, workingBranch: "" } });
    mocks.find.mockClear();
    mocks.request.mockClear();
    mocks.restore.mockClear();
    expect(button(detached, "復元").disabled).toBe(true);
    await click(detached, "復元");
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.restore).not.toHaveBeenCalled();
    expect(props.onError).toHaveBeenLastCalledWith(branchMessage);
  });

  it.each([
    { workingBranch: "", baseCommit: "a".repeat(40), authenticated: true },
    { workingBranch: "content/work", baseCommit: "", authenticated: true },
    { workingBranch: "content/work", baseCommit: "a".repeat(40), authenticated: false },
  ])("blocks review reads and writes for %j even if a disabled handler runs", async (binding) => {
    const draft = { ...draftFixture(), ...binding };
    const props = reviewProps(draft, binding.authenticated);
    const { tree } = await mount(ReviewPanel, props);
    for (const label of ["添削を同期", "取得"]) {
      expect(button(tree, label).disabled).toBe(true);
      await click(tree, label);
    }
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.find).not.toHaveBeenCalled();
    expect(props.onDraft).not.toHaveBeenCalled();
    expect(props.onError).toHaveBeenCalledWith(
      binding.authenticated ? branchMessage : "同期するには、GitHubに接続してください。",
    );
    if (binding.authenticated) expect(text(tree)).toContain(branchMessage);
  });

  it("keeps review retrieval enabled for an authenticated bound draft", async () => {
    const draft = { ...draftFixture(), workingBranch: "content/work" };
    const { tree } = await mount(ReviewPanel, reviewProps(draft));
    expect(button(tree, "取得").disabled).toBe(false);
    await click(tree, "取得");
    expect(mocks.find).toHaveBeenCalledExactlyOnceWith(draft);
  });
});
