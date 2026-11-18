import { lazy, Suspense, useEffect, useState } from "react";
import type { DraftMetadata, ParsedDraft } from "@xpotato/editor-core/draft";
import type { SourceSelection, LocatedAnchor } from "@xpotato/editor-core/annotations";
import type { LocalDraft } from "../../data/storage.js";
import { BlockEditor } from "../../components/BlockEditor.js";
import { SitePreview, type PreviewMedia } from "../../components/SitePreview.js";
import type { EditorSeriesPreview } from "../../preview.js";
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
  onReview: () => void;
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
  onReview,
  reveal,
  onError,
}: Props) {
  const [mode, setMode] = useState<"write" | "review" | "preview">("write");
  const [source, setSource] = useState(false);
  const [sourceOpened, setSourceOpened] = useState(false);
  const [split, setSplit] = useState(false);
  useEffect(() => {
    if (reveal) setMode("review");
  }, [reveal]);
  return (
    <div className={"document-workbench" + (split ? " is-split" : "")}>
      <div className="workbench-toolbar">
        <div className="history-buttons">
          <button
            type="button"
            title="元に戻す"
            aria-label="元に戻す"
            disabled={!canUndo}
            onClick={onUndo}
          >
            ↶
          </button>
          <button
            type="button"
            title="やり直す"
            aria-label="やり直す"
            disabled={!canRedo}
            onClick={onRedo}
          >
            ↷
          </button>
        </div>
        <div className="editor-tabs" role="tablist" aria-label="作業モード">
          {(["write", "review", "preview"] as const).map((tab) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === mode}
              key={tab}
              onClick={() => {
                setMode(tab);
                if (tab === "review") onReview();
              }}
            >
              {tab === "write" ? "執筆" : tab === "review" ? "添削" : "プレビュー"}
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
            ◫
          </button>
          <button
            type="button"
            aria-pressed={source}
            aria-label="MDX本文を表示"
            title="MDX本文"
            onClick={() => {
              setSourceOpened(true);
              setSource(!source);
              if (mode === "preview") setMode("write");
            }}
          >
            {"{ }"}
          </button>
        </div>
      </div>
      <div className={"document-panes" + (mode === "preview" && !split ? " preview-only" : "")}>
        <div className="writing-pane" hidden={mode === "preview" && !split}>
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
                rows={2}
                placeholder="タイトル"
                value={parsed?.data.title ?? ""}
                disabled={!parsed}
                onChange={(event) => onMetadata({ title: event.target.value.replace(/\n/gu, " ") })}
              />
            </label>
          </div>
          <div className="document-editor" data-review-mode={mode === "review"}>
            {parsed ? (
              <>
                <div hidden={source}>
                  <BlockEditor
                    body={parsed.body}
                    onChange={onBody}
                    onError={onError}
                    onSelection={onSelection}
                    onActiveBlock={onActiveBlock}
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
        {(mode === "preview" || split) && (
          <div className="preview-column">
            <SitePreview draft={draft} media={media} editorSeries={editorSeries} />
          </div>
        )}
      </div>
    </div>
  );
}
