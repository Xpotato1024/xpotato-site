import { useEffect, useState } from "react";
import {
  collectionFromPath,
  type DraftMetadata,
  type ParsedDraft,
  type TaxonomySnapshot,
} from "@xpotato/editor-core/draft";
import type { LocalDraft } from "../../data/storage.js";
import { previewDocument } from "../../preview.js";
import { BlockEditor } from "../../components/BlockEditor.js";

interface Props {
  draft: LocalDraft;
  parsed: ParsedDraft | null;
  taxonomy: TaxonomySnapshot;
  onSource: (source: string) => void;
  onBody: (body: string) => void;
  onMetadata: (fields: Partial<DraftMetadata>) => void;
  onError: (message: string) => void;
}

export function DocumentEditor({
  draft,
  parsed,
  taxonomy,
  onSource,
  onBody: body,
  onMetadata: metadata,
  onError,
}: Props) {
  const [tab, setTab] = useState<"blocks" | "source" | "preview">("blocks");
  const [preview, setPreview] = useState<{ html: string; warnings: string[] } | null>(null);
  useEffect(() => {
    if (tab !== "preview") {
      return;
    }
    let active = true;
    void previewDocument(draft.source)
      .then((result) => {
        if (active) {
          setPreview(result);
        }
      })
      .catch((error) => {
        if (active) {
          setPreview(null);
          onError(error instanceof Error ? error.message : "PREVIEW_FAILED");
        }
      });
    // 遅れて完了した旧本文のプレビューを、新しい本文の結果へ上書きしない。
    return () => {
      active = false;
    };
  }, [tab, draft.source, onError]);
  const setError = onError;
  return (
    <>
      <label className="title-label">
        <span className="sr-only">記事タイトル</span>
        <input
          placeholder="記事のタイトル"
          value={parsed?.data.title ?? ""}
          disabled={!parsed}
          onChange={(event) => metadata({ title: event.target.value })}
        />
      </label>
      <details className="metadata" open>
        <summary>記事情報</summary>
        <div className="metadata-grid">
          <label>
            概要
            <textarea
              rows={2}
              value={parsed?.data.description ?? ""}
              disabled={!parsed}
              placeholder="読者に何が伝わる記事ですか"
              onChange={(event) => metadata({ description: event.target.value })}
            />
          </label>
          <label>
            主分類
            <select
              value={parsed?.data.category ?? parsed?.data.subject ?? "software"}
              disabled={!parsed}
              onChange={(event) =>
                metadata(
                  collectionFromPath(draft.path) === "notes"
                    ? { subject: event.target.value }
                    : { category: event.target.value },
                )
              }
            >
              {(taxonomy.categories[collectionFromPath(draft.path)] ?? []).map((id) => (
                <option key={id} value={id}>
                  {taxonomy.labels?.[id] ?? id}
                </option>
              ))}
            </select>
          </label>
          <label>
            タグ
            <select
              multiple
              value={parsed?.data.tags ?? []}
              disabled={!parsed}
              onChange={(event) =>
                metadata({ tags: Array.from(event.target.selectedOptions).map((o) => o.value) })
              }
            >
              {taxonomy.tags.map((id) => (
                <option key={id} value={id}>
                  {taxonomy.labels?.[id] ?? id}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="small muted">
          公開日・URL・SEOの定型情報は正式な公開処理で確定します。画像や分類はIDで参照します。
        </p>
      </details>
      <div className="editor-tabs" role="tablist" aria-label="編集モード">
        {(["blocks", "source", "preview"] as const).map((mode) => (
          <button
            type="button"
            role="tab"
            aria-selected={mode === tab}
            key={mode}
            onClick={() => setTab(mode)}
          >
            {mode === "blocks" ? "ブロック編集" : mode === "source" ? "MDXソース" : "プレビュー"}
          </button>
        ))}
      </div>
      <div className="document-editor">
        {tab === "blocks" && parsed ? (
          <BlockEditor body={parsed.body} onChange={body} onError={setError} />
        ) : tab === "source" || !parsed ? (
          <textarea
            className="source-editor"
            aria-label="MDXソース"
            spellCheck={false}
            value={draft.source}
            onChange={(event) => onSource(event.target.value)}
          />
        ) : (
          <section className="preview-pane" aria-label="下書きプレビュー">
            <p className="preview-note">
              編集用プレビュー。共通部品の最終レイアウトと実画像は、固定commitからのAstroレビュー画面で確認します。
            </p>
            {preview && (
              <div className="preview-prose" dangerouslySetInnerHTML={{ __html: preview.html }} />
            )}
          </section>
        )}
      </div>
    </>
  );
}
