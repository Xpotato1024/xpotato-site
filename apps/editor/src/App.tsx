import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ContentCollection } from "@xpotato/content-contracts/common";
import { collectionFromPath, updateDraft } from "@xpotato/editor-core/draft";
import { moduleSource, moduleInsertionOffset } from "@xpotato/editor-core/blocks";
import type { EditorRegistryChanges } from "@xpotato/editor-core/registry";
import type {
  SourceSelection,
  LocatedAnchor,
  ReviewComment,
} from "@xpotato/editor-core/annotations";
import { ConnectionStatus } from "./components/ConnectionStatus.js";
import { AstroReview } from "./components/AstroReview.js";
import { MediaPanel } from "./components/MediaPanel.js";
import { EditorHeader } from "./components/EditorHeader.js";
import { WorkspaceIcon } from "./components/WorkspaceIcon.js";
import { DocumentOutline } from "./components/DocumentOutline.js";
import { DraftSidebar } from "./components/DraftSidebar.js";
import { EditorActions } from "./components/EditorActions.js";
import { MetadataPanel } from "./components/MetadataPanel.js";
import { SeriesPanel } from "./components/SeriesPanel.js";
import { HistoryPanel } from "./components/HistoryPanel.js";
import { ConflictPanel } from "./components/ConflictPanel.js";
import { useDraftWorkspace } from "./features/drafts/useDraftWorkspace.js";
import type { DraftKind } from "./features/drafts/model.js";
import { exportDraftBundle, importDraftFile } from "./features/drafts/transfer.js";
import { DocumentEditor } from "./features/editing/DocumentEditor.js";
import { usePreviewMedia } from "./features/editing/usePreviewMedia.js";
import { ReviewPanel } from "./features/review/ReviewPanel.js";
import { useGitWorkspace } from "./features/git/useGitWorkspace.js";
import { download } from "./shared/download.js";
import { errorLabel } from "./shared/messages.js";
import { useEditorEnvironment } from "./shared/useEditorEnvironment.js";
import type { EditorSeriesPreview } from "./preview.js";

type Panel =
  | "library"
  | "metadata"
  | "media"
  | "series"
  | "review"
  | "history"
  | "workflow"
  | "outline"
  | "menu";
const panels: { id: Panel; label: string; title: string; path: string }[] = [
  {
    id: "outline",
    label: "構成",
    title: "記事構成を開く",
    path: "M8 5h13 M8 12h13 M8 19h13 M3 5h.01 M3 12h.01 M3 19h.01",
  },
  {
    id: "menu",
    label: "記事メニュー",
    title: "記事メニューを開く",
    path: "M5 12h.01 M12 12h.01 M19 12h.01",
  },
  {
    id: "library",
    label: "原稿",
    title: "下書き一覧を開く",
    path: "M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5",
  },
  {
    id: "metadata",
    label: "情報",
    title: "記事情報を開く",
    path: "M4 6h16 M4 12h16 M4 18h16 M9 3v6 M15 9v6 M8 15v6",
  },
  {
    id: "media",
    label: "画像",
    title: "画像を開く",
    path: "M3 4h18v16H3z M3 16l5-5 4 4 3-3 6 6 M15 8h.01",
  },
  {
    id: "series",
    label: "連載",
    title: "連載を開く",
    path: "M9 5h12 M9 12h12 M9 19h12 M3 3v4 M2 7h3 M2 11h3l-3 3h3 M2 17h3v4H2",
  },
  { id: "review", label: "添削", title: "添削を開く", path: "M4 3h16v14H9l-5 4z M8 7h8 M8 11h5" },
  {
    id: "history",
    label: "履歴",
    title: "履歴を開く",
    path: "M3 12a9 9 0 1 0 3-7 M3 3v5h5 M12 7v5l3 2",
  },
  {
    id: "workflow",
    label: "保存",
    title: "保存と確認を開く",
    path: "M4 3h13l3 3v15H4z M8 3v6h8V3 M8 21v-8h8v8",
  },
];
const writingTools: Panel[] = ["outline", "media", "review"];
const pagePanels: Panel[] = ["library", "series", "metadata", "history", "workflow"];
const articleMenu: Panel[] = ["metadata", "history", "workflow"];
export default function App() {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [selection, setSelection] = useState<SourceSelection | null>(null);
  const [reveal, setReveal] = useState<(LocatedAnchor & { token: number }) | null>(null);
  const activeBlock = useRef<{ start: number; end: number; source: string; index: number } | null>(
    null,
  );
  const panelTrigger = useRef<HTMLButtonElement | null>(null);
  const workspace = useDraftWorkspace(setError);
  const git = useGitWorkspace(workspace, setError, setNotice);
  const environment = useEditorEnvironment();
  // Keep the editor anchored to the visible iOS viewport while the software keyboard resizes it.
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        root.style.setProperty(
          "--editor-viewport-height",
          `${Math.max(1, viewport?.height ?? window.innerHeight)}px`,
        );
        root.style.setProperty("--editor-viewport-offset-top", `${viewport?.offsetTop ?? 0}px`);
      });
    };
    update();
    window.addEventListener("resize", update);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      root.style.removeProperty("--editor-viewport-height");
      root.style.removeProperty("--editor-viewport-offset-top");
    };
  }, []);
  const { draft, parsed } = workspace;
  const media = usePreviewMedia(draft.id);
  const editorSeries = useMemo<EditorSeriesPreview>(() => {
    const current = parsed
      ? {
          contentId: parsed.data.id,
          title: parsed.data.title,
          collection: collectionFromPath(draft.path),
          path: draft.path,
        }
      : null;
    return {
      registry: git.taxonomy.seriesRegistry ?? { schemaVersion: 1, series: [] },
      documents: [
        ...(git.taxonomy.contentIndex ?? []).filter(
          (entry) => entry.contentId !== current?.contentId,
        ),
        ...(current ? [current] : []),
      ],
    };
  }, [parsed, draft.path, git.taxonomy.seriesRegistry, git.taxonomy.contentIndex]);
  useEffect(() => {
    setSelection(null);
    setReveal(null);
    activeBlock.current = null;
  }, [draft.id]);
  const selectBlock = useCallback(
    (block: { start: number; end: number; source: string; index: number }) => {
      activeBlock.current = block;
      setSelection({
        quote: block.source,
        start: block.start,
        end: block.end,
        blockStart: block.start,
        blockEnd: block.end,
        blockSource: block.source,
      });
    },
    [],
  );
  function closePanel() {
    setPanel(null);
    const trigger = panelTrigger.current;
    window.requestAnimationFrame(() => {
      if (trigger?.isConnected && trigger.getClientRects().length)
        trigger.focus({ preventScroll: true });
      else
        document
          .querySelector<HTMLButtonElement>(".workspace-menu-button")
          ?.focus({ preventScroll: true });
    });
  }
  async function act(operation: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "操作に失敗しました";
      setError(
        message === "IMPORT_COLLECTION_REQUIRED"
          ? "記事かツールかをファイルだけでは判別できません。取り込み先を選択してください。"
          : errorLabel(message),
      );
    } finally {
      setBusy(false);
    }
  }
  async function newDocument(kind: DraftKind) {
    await workspace.createNew(git.snapshot, kind === "education" ? "blog" : kind, {
      education: kind === "education",
    });
    workspace.setDraft((current) => ({ ...current, registrySnapshot: git.baseTaxonomy }));
    setNotice("");
    setPanel(null);
  }
  async function exportBundle() {
    download("xpotato-draft-" + draft.id + ".json", await exportDraftBundle(draft));
    setNotice("原稿・画像・添削・連載設定を書き出しました。");
  }
  async function importFile(file: File | undefined, collection?: ContentCollection) {
    if (!file) return;
    await workspace.persist();
    const imported = await importDraftFile(file, collection ? { collection } : {});
    await workspace.openLocal(imported);
    setNotice("新しいローカルコピーとして取り込みました。");
    setPanel(null);
  }
  function changeRegistry(changes: EditorRegistryChanges) {
    workspace.setDraft((current) => {
      const pending = current.pendingRegistryChanges ?? {};
      const additions = new Map(
        (pending.taxonomy ?? []).map((item) => [item.namespace + ":" + item.id, item]),
      );
      for (const item of changes.taxonomy ?? [])
        additions.set(item.namespace + ":" + item.id, item);
      return {
        ...current,
        pendingRegistryChanges: {
          ...pending,
          ...changes,
          ...(changes.series
            ? {
                seriesBase: pending.seriesBase ??
                  git.baseTaxonomy.seriesRegistry ?? { schemaVersion: 1, series: [] },
              }
            : {}),
          ...(additions.size ? { taxonomy: [...additions.values()] } : {}),
        },
      };
    });
  }
  function reviewChanged(comments: ReviewComment[], body?: string) {
    workspace.setDraft((current) =>
      current.id !== draft.id
        ? current
        : {
            ...current,
            annotations: comments,
            source: body === undefined ? current.source : updateDraft(current.source, {}, body),
          },
    );
  }
  function insertMedia(asset: string, alt: string, caption?: string) {
    try {
      if (!parsed) throw Error("MDX_INVALID");
      const block = activeBlock.current;
      const preferred =
        block && parsed.body.slice(block.start, block.end) === block.source
          ? block.end
          : parsed.body.length;
      const at = moduleInsertionOffset(parsed.body, preferred, "Figure");
      const source = moduleSource("Figure", { asset, alt, ...(caption ? { caption } : {}) });
      workspace.edit(
        {},
        parsed.body.slice(0, at).trimEnd() +
          "\n\n" +
          source +
          "\n\n" +
          parsed.body.slice(at).trimStart(),
      );
      if (window.matchMedia("(max-width: 800px)").matches) setPanel(null);
    } catch {
      setError("画像を挿入できませんでした。画像の情報と本文のMDXを確認してください。");
    }
  }
  function insertGallery(items: { asset: string; alt: string; caption?: string }[]) {
    try {
      if (!parsed) throw Error("MDX_INVALID");
      workspace.edit(
        {},
        parsed.body.trimEnd() +
          '\n\n<Gallery columns="2" mobileColumns="1">\n' +
          items.map((item) => "  " + moduleSource("Figure", item)).join("\n") +
          "\n</Gallery>\n",
      );
      if (window.matchMedia("(max-width: 800px)").matches) setPanel(null);
    } catch {
      setError("ギャラリーを挿入できませんでした。画像の情報と本文のMDXを確認してください。");
    }
  }
  if (!workspace.hydrated)
    return (
      <main className="editor-loading" role="status">
        保存した下書きを読み込んでいます。
      </main>
    );
  const isSynced = Boolean(
    draft.syncedCommit && draft.syncedSource === draft.source && !draft.pendingRegistryChanges,
  );
  const isPage = panel !== null && pagePanels.includes(panel);
  const PanelElement = isPage ? "main" : "aside";
  return (
    <div className="editor-app">
      <EditorHeader
        online={environment.online}
        localStatus={workspace.localStatus}
        menuOpen={panel === "menu"}
        onToggleNavigation={() => setPanel("library")}
        onWorkflow={() => setPanel("workflow")}
        onMenu={() => setPanel(panel === "menu" ? null : "menu")}
      />
      {(error || notice || environment.updateReady) && (
        <div className="workspace-messages">
          {error && (
            <div className="message error" role="alert">
              {errorLabel(error)}
              <button type="button" aria-label="エラーを閉じる" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="message" role="status">
              {notice}
              <button type="button" aria-label="通知を閉じる" onClick={() => setNotice("")}>
                ×
              </button>
            </div>
          )}
          {environment.updateReady && (
            <div className="message">
              新しい編集アプリがあります。
              <button
                type="button"
                onClick={() => void act(() => environment.activateUpdate(workspace.persist))}
              >
                保存して更新
              </button>
            </div>
          )}
        </div>
      )}
      <div
        className={"editor-workspace" + (panel ? " has-panel" : "") + (isPage ? " has-page" : "")}
        aria-busy={busy}
      >
        <nav className="workspace-rail" aria-label="編集ツール" hidden={isPage}>
          {panels
            .filter((item) => writingTools.includes(item.id))
            .map((item) => (
              <button
                type="button"
                key={item.id}
                aria-label={item.title}
                title={item.title}
                aria-pressed={panel === item.id}
                aria-controls={panel ? "workspace-panel" : undefined}
                onClick={(event) => {
                  panelTrigger.current = event.currentTarget;
                  setPanel(panel === item.id ? null : item.id);
                }}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={item.path} />
                </svg>
                <span>{item.label}</span>
              </button>
            ))}
        </nav>
        <main className="editing-main" hidden={isPage}>
          <DocumentEditor
            key={draft.id}
            draft={draft}
            parsed={parsed}
            media={media}
            editorSeries={editorSeries}
            canUndo={workspace.canUndo}
            canRedo={workspace.canRedo}
            onUndo={workspace.undo}
            onRedo={workspace.redo}
            onSource={workspace.setSource}
            onBody={(body) => workspace.edit({}, body)}
            onMetadata={(fields) => workspace.edit(fields)}
            onSelection={setSelection}
            onActiveBlock={selectBlock}
            reviewActive={panel === "review"}
            reveal={reveal}
            onError={setError}
          />
        </main>
        {panel && (
          <PanelElement
            className={"workspace-inspector panel-" + panel + (isPage ? " workspace-page" : "")}
            id="workspace-panel"
            aria-label={panels.find((item) => item.id === panel)?.label}
            onKeyDown={(event) => {
              if (
                event.key === "Escape" &&
                !(
                  event.target instanceof HTMLInputElement ||
                  event.target instanceof HTMLTextAreaElement
                )
              )
                closePanel();
            }}
          >
            <div className="inspector-header">
              <h2>
                {
                  {
                    library: "原稿一覧",
                    metadata: "記事情報",
                    media: "画像",
                    series: "連載",
                    review: "添削",
                    history: "履歴",
                    workflow: "保存と確認",
                    outline: "記事構成",
                    menu: "記事メニュー",
                  }[panel]
                }
              </h2>
              <button type="button" aria-label="パネルを閉じる" onClick={closePanel}>
                {isPage && <span>執筆に戻る</span>}
                <WorkspaceIcon name={isPage ? "back" : "close"} />
              </button>
            </div>
            <div className="inspector-body">
              {(panel === "library" || panel === "series") && (
                <nav className="management-navigation" aria-label="原稿の管理">
                  <button
                    type="button"
                    aria-current={panel === "library" ? "page" : undefined}
                    onClick={() => setPanel("library")}
                  >
                    原稿一覧
                  </button>
                  <button
                    type="button"
                    aria-current={panel === "series" ? "page" : undefined}
                    aria-label="連載を開く"
                    onClick={() => setPanel("series")}
                  >
                    連載・コース
                  </button>
                </nav>
              )}
              {panel === "menu" && (
                <nav className="article-menu" aria-label="記事の操作">
                  {panels
                    .filter((item) => articleMenu.includes(item.id))
                    .map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        aria-label={item.title}
                        onClick={() => setPanel(item.id)}
                      >
                        <WorkspaceIcon name={item.id as "metadata" | "history" | "workflow"} />
                        {item.id === "workflow"
                          ? "保存と確認"
                          : item.id === "metadata"
                            ? "記事情報"
                            : item.label}
                      </button>
                    ))}
                  <button type="button" onClick={() => setPanel("library")}>
                    <WorkspaceIcon name="library" />
                    原稿一覧
                  </button>
                </nav>
              )}
              {panel === "outline" && parsed && (
                <DocumentOutline
                  body={parsed.body}
                  onLocate={(start, end) => {
                    setReveal({ start, end, token: Date.now() });
                    closePanel();
                  }}
                />
              )}
              {panel === "library" && (
                <DraftSidebar
                  busy={busy}
                  saved={workspace.saved}
                  draftId={draft.id}
                  git={git}
                  onNew={(kind) => void act(() => newDocument(kind))}
                  onSelect={(item) =>
                    void act(async () => {
                      await workspace.openLocal(item);
                      setPanel((current) => (current === "library" ? null : current));
                    })
                  }
                  onReadBranch={() => void act(git.readBranch)}
                  onOpenDocument={(path) =>
                    void act(async () => {
                      await git.openDocument(path);
                      setPanel((current) => (current === "library" ? null : current));
                    })
                  }
                  onImport={(file, collection) => void act(() => importFile(file, collection))}
                />
              )}
              {panel === "metadata" && (
                <>
                  <button
                    type="button"
                    className="series-membership-link"
                    aria-label="連載を開く"
                    onClick={() => setPanel("series")}
                  >
                    <WorkspaceIcon name="series" />
                    連載への所属と読む順序
                  </button>
                  <MetadataPanel
                    key={draft.id}
                    draft={draft}
                    parsed={parsed}
                    taxonomy={git.taxonomy}
                    onMetadata={(fields) => workspace.edit(fields)}
                    onDraft={(fields) =>
                      workspace.setDraft((current) => ({ ...current, ...fields }))
                    }
                    onRegistryChange={changeRegistry}
                    onError={setError}
                  />
                </>
              )}
              {panel === "series" && parsed && (
                <SeriesPanel
                  key={draft.id}
                  contentId={parsed.data.id}
                  registry={git.taxonomy.seriesRegistry ?? { schemaVersion: 1, series: [] }}
                  documents={editorSeries.documents}
                  onChange={(series) => changeRegistry({ series })}
                  onError={setError}
                />
              )}
              {panel === "review" && parsed && (
                <ReviewPanel
                  key={draft.id}
                  draft={draft}
                  selection={selection}
                  authenticated={git.auth.authenticated}
                  onChange={reviewChanged}
                  onDraft={workspace.setDraft}
                  onLocate={(location) => {
                    setReveal({ ...location, token: Date.now() });
                    if (window.matchMedia("(max-width: 800px)").matches) closePanel();
                  }}
                  onError={setError}
                />
              )}
              {panel === "media" && (
                <MediaPanel
                  key={draft.id}
                  draft={draft}
                  authenticated={git.auth.authenticated}
                  onDraft={workspace.acceptMediaSync}
                  onError={setError}
                  onInsert={insertMedia}
                  onHero={(asset) => workspace.edit({ hero: asset })}
                  onGallery={insertGallery}
                />
              )}
              {panel === "history" && (
                <HistoryPanel
                  key={draft.id}
                  draft={draft}
                  onRestore={workspace.restore}
                  onArchive={() => {
                    workspace.setDraft((current) => ({ ...current, archived: !current.archived }));
                    setNotice(
                      draft.archived
                        ? "下書きへ戻しました。"
                        : "アーカイブしました。原稿一覧から戻せます。",
                    );
                  }}
                  onError={setError}
                />
              )}
              {panel === "workflow" && (
                <>
                  <ol className="publication-stages">
                    <li data-complete="true">端末に保存</li>
                    <li data-complete={isSynced}>
                      {isSynced ? "Gitに保存済み" : "Gitに未保存の変更"}
                    </li>
                    <li data-complete={Boolean(git.pr)}>
                      {git.pr ? "レビューを作成済み" : "レビュー待ち"}
                    </li>
                    <li>公開は別途確認</li>
                  </ol>
                  {!git.auth.authenticated && (
                    <a
                      className="button"
                      href="/editor-api/auth/start"
                      aria-disabled={!git.auth.configured}
                      onClick={(event) => {
                        if (!git.auth.configured) {
                          event.preventDefault();
                          setNotice(errorLabel("AUTH_NOT_CONFIGURED"));
                        }
                      }}
                    >
                      GitHubと接続
                    </a>
                  )}
                  <ConnectionStatus auth={git.auth} />
                  {git.conflict && (
                    <ConflictPanel
                      key={git.conflict.head.commit}
                      conflict={git.conflict}
                      draft={draft}
                      onResolve={(source, registry) =>
                        void act(() => git.resolveConflict(source, registry))
                      }
                    />
                  )}
                  <details className="validation-panel" open={git.issues.length > 0}>
                    <summary>
                      {git.issues.length
                        ? git.issues.length + "件の確認項目"
                        : "原稿チェックは正常"}
                    </summary>
                    {git.issues.map((issue, index) => (
                      <p key={index}>{issue}</p>
                    ))}
                  </details>
                  <EditorActions
                    authenticated={git.auth.authenticated}
                    busy={busy}
                    hasIssues={git.issues.length > 0}
                    synced={isSynced}
                    pr={git.pr}
                    onExport={() =>
                      download(
                        (parsed?.data.id ?? "draft") + ".mdx",
                        new Blob([draft.source], { type: "text/markdown;charset=utf-8" }),
                      )
                    }
                    onExportBundle={() => void act(exportBundle)}
                    onSave={() => void act(git.saveGit)}
                    onCreatePR={() => void act(git.createPR)}
                  />
                  <AstroReview draft={draft} authenticated={git.auth.authenticated} />
                  <details className="technical-details">
                    <summary>接続情報</summary>
                    <p className="document-branch">
                      {draft.workingBranch || draft.sourceBranch}
                      <br />
                      {draft.baseCommit}
                    </p>
                    {git.auth.authenticated && (
                      <button type="button" onClick={() => void act(git.logout)}>
                        GitHubとの接続を解除
                      </button>
                    )}
                  </details>
                </>
              )}
            </div>
          </PanelElement>
        )}
      </div>
      <footer className="workspace-status">
        <span>
          {parsed
            ? parsed.body.replace(/\s/gu, "").length.toLocaleString("ja-JP") + "文字"
            : "構文を編集中"}
        </span>
        <button type="button" onClick={() => setPanel("workflow")}>
          {git.issues.length ? git.issues.length + "件を確認" : "チェック正常"}
        </button>
        <span className="status-spacer" />
        <span>{busy ? "処理中…" : isSynced ? "Git保存済み" : "端末に保存"}</span>
      </footer>
    </div>
  );
}
