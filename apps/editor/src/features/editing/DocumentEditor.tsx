import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { DraftMetadata, ParsedDraft } from "@xpotato/editor-core/draft";
import type { SourceSelection, LocatedAnchor } from "@xpotato/editor-core/annotations";
import type { LocalDraft } from "../../data/storage.js";
import { BlockEditor } from "../../components/BlockEditor.js";
import { SitePreview, type PreviewMedia } from "../../components/SitePreview.js";
import type { EditorSeriesPreview } from "../../preview.js";
import { WorkspaceIcon } from "../../components/WorkspaceIcon.js";
const SourceEditor = lazy(() =>
  import("./SourceEditor.js").then((module) => ({ default: module.SourceEditor })),
);
interface Props {
  draft: LocalDraft;
  parsed: ParsedDraft | null;
  media: PreviewMedia[];
  editorSeries: EditorSeriesPreview;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSource: (source: string) => void;
  onBody: (body: string) => void;
  onMetadata: (fields: Partial<DraftMetadata>) => void;
  onSelection: (selection: SourceSelection) => void;
  onActiveBlock: (block: { start: number; end: number; source: string; index: number }) => void;
  reviewActive: boolean;
  activeCommentId: string | null;
  onReviewSelect: (id: string, trigger: HTMLButtonElement) => void;
  onReviewCreate: (selection: SourceSelection, trigger: HTMLButtonElement) => void;
  reveal: (LocatedAnchor & { token: number }) | null;
  onError: (message: string) => void;
}
export function DocumentEditor({
  draft,
  parsed,
  media,
  editorSeries,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSource,
  onBody,
  onMetadata,
  onSelection,
  onActiveBlock,
  reviewActive,
  activeCommentId,
  onReviewSelect,
  onReviewCreate,
  reveal,
  onError,
}: Props) {
  const [mode, setMode] = useState<"blocks" | "preview" | "mdx">("blocks");
  const [editingMode, setEditingMode] = useState<"blocks" | "mdx">("blocks");
  const source = (mode === "preview" ? editingMode : mode) === "mdx";
  const [sourceOpened, setSourceOpened] = useState(false);
  const [split, setSplit] = useState(false);
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 801px)").matches);
  const titleInput = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 801px)");
    const update = () => setDesktop(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const effectiveSplit = split && desktop;
  useLayoutEffect(() => {
    const input = titleInput.current;
    if (!input) return;
    const resize = () => {
      if (!input.getClientRects().length) return;
      input.style.height = "auto";
      input.style.height = input.scrollHeight + "px";
    };
    resize();
    let width = input.clientWidth;
    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      if (width !== input.clientWidth) {
        width = input.clientWidth;
        // Changing the observed height during delivery causes a ResizeObserver loop error.
        if (!resizeFrame)
          resizeFrame = window.requestAnimationFrame(() => {
            resizeFrame = 0;
            resize();
          });
      }
    });
    observer.observe(input);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(resizeFrame);
    };
  }, [parsed?.data.title, mode]);
  useEffect(() => {
    if (reviewActive) {
      setMode("blocks");
      setEditingMode("blocks");
    } else if (reveal && mode === "preview") {
      setMode(editingMode);
    }
  }, [reveal, reviewActive]);
  return (
    <div className={"document-workbench" + (effectiveSplit ? " is-split" : "")}>
      <div className="workbench-toolbar">
        <div className="history-buttons">
          <button
            type="button"
            title="元に戻す"
            aria-label="元に戻す"
            disabled={!canUndo}
            onClick={onUndo}
          >
            <WorkspaceIcon name="undo" />
          </button>
          <button
            type="button"
            title="やり直す"
            aria-label="やり直す"
            disabled={!canRedo}
            onClick={onRedo}
          >
            <WorkspaceIcon name="redo" />
          </button>
        </div>
        <div
          className="editor-tabs"
          role="tablist"
          aria-label="編集モード"
          onKeyDown={(event) => {
            const tabs = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
            );
            const at = tabs.indexOf(document.activeElement as HTMLButtonElement);
            const next =
              event.key === "ArrowRight"
                ? (at + 1) % tabs.length
                : event.key === "ArrowLeft"
                  ? (at + tabs.length - 1) % tabs.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? tabs.length - 1
                      : -1;
            if (next >= 0) {
              event.preventDefault();
              tabs[next]?.focus();
              tabs[next]?.click();
            }
          }}
        >
          {(
            [
              { id: "blocks", label: "ブロック", name: "ブロックエディタ", icon: "blocks" },
              { id: "preview", label: "プレビュー", name: "プレビュー", icon: "preview" },
              { id: "mdx", label: "MDX", name: "MDX", icon: "code" },
            ] as const
          ).map((tab) => (
            <button
              type="button"
              role="tab"
              aria-label={tab.name}
              aria-selected={tab.id === mode}
              tabIndex={tab.id === mode ? 0 : -1}
              aria-controls={tab.id === "preview" ? "preview-pane" : "writing-pane"}
              key={tab.id}
              onClick={() => {
                setMode(tab.id);
                if (tab.id !== "preview") setEditingMode(tab.id);
                if (tab.id === "mdx") setSourceOpened(true);
              }}
            >
              <WorkspaceIcon name={tab.icon} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        <div className="view-buttons">
          <button
            type="button"
            className="split-button"
            aria-pressed={split}
            title="編集とプレビューを並べる"
            aria-label="編集とプレビューを並べる"
            onClick={() => setSplit(!split)}
          >
            <WorkspaceIcon name="split" />
          </button>
        </div>
      </div>
      <div
        className={
          "document-panes" + (mode === "preview" && !effectiveSplit ? " preview-only" : "")
        }
      >
        <div
          id="writing-pane"
          role="tabpanel"
          aria-label={source ? "MDX" : "ブロックエディタ"}
          className="writing-pane"
          hidden={mode === "preview" && !effectiveSplit}
        >
          <div className="document-heading">
            <span className="document-kind">
              {parsed?.data.education
                ? "教育記事"
                : ((
                    {
                      blog: "記事",
                      notes: "メモ",
                      projects: "プロダクト",
                      tools: "ツール",
                      pages: "固定ページ",
                    } as Record<string, string>
                  )[draft.path.split("/")[1] === "articles" ? "blog" : draft.path.split("/")[1]!] ??
                  "下書き")}
            </span>
            <label className="title-label">
              <span className="sr-only">タイトル</span>
              <textarea
                rows={1}
                ref={titleInput}
                placeholder="タイトル"
                value={parsed?.data.title ?? ""}
                disabled={!parsed}
                onChange={(event) => onMetadata({ title: event.target.value.replace(/\n/gu, " ") })}
              />
            </label>
          </div>
          <div className="document-editor" data-review-mode={reviewActive}>
            {parsed ? (
              <>
                <div hidden={source}>
                  <BlockEditor
                    body={parsed.body}
                    onChange={onBody}
                    onError={onError}
                    onSelection={onSelection}
                    onActiveBlock={onActiveBlock}
                    annotations={draft.annotations ?? []}
                    activeCommentId={activeCommentId}
                    onReviewSelect={onReviewSelect}
                    onReviewCreate={onReviewCreate}
                    media={media.map((item) => ({
                      id: item.assetId,
                      label: item.alt || item.assetId,
                      src: item.src,
                    }))}
                    {...(reveal ? { revealSelection: reveal } : {})}
                  />
                </div>
                {sourceOpened && (
                  <div hidden={!source}>
                    <Suspense fallback={<p className="small muted">MDXを開いています…</p>}>
                      <SourceEditor
                        value={parsed.body}
                        onChange={onBody}
                        onSelection={onSelection}
                        onError={onError}
                        {...(reveal ? { reveal } : {})}
                      />
                    </Suspense>
                  </div>
                )}
              </>
            ) : (
              <div className="source-recovery">
                <p className="message error">
                  記事情報の構文を確認してください。修復用にファイル全体を表示しています。
                </p>
                <Suspense fallback={<p>MDXを開いています…</p>}>
                  <SourceEditor
                    value={draft.source}
                    onChange={onSource}
                    label="MDXの修復"
                    onError={onError}
                  />
                </Suspense>
              </div>
            )}
          </div>
        </div>
        {(mode === "preview" || effectiveSplit) && (
          <div id="preview-pane" role="tabpanel" aria-label="プレビュー" className="preview-column">
            <SitePreview draft={draft} media={media} editorSeries={editorSeries} />
          </div>
        )}
      </div>
    </div>
  );
}
