import { useEffect, useRef, useState } from "react";
import type { EditorReviewBundle } from "@xpotato/editor-core/review";
import { localMedia, type LocalDraft } from "../data/storage.js";
import { loadAstroReview, renderAstroReview } from "../data/astro-review.js";
export function AstroReview({
  draft,
  authenticated,
}: {
  draft: LocalDraft;
  authenticated: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [frame, setFrame] = useState(""),
    [missing, setMissing] = useState<string[]>([]),
    [bundle, setBundle] = useState<EditorReviewBundle | null>(null);
  const dispose = useRef<() => void>(() => {}),
    generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      dispose.current();
    },
    [],
  );
  useEffect(() => {
    const invalidate = (event: Event) => {
      if ((event as CustomEvent<{ draftId: string }>).detail?.draftId !== draft.id) return;
      generation.current++;
      dispose.current();
      dispose.current = () => {};
      setFrame("");
      setBundle(null);
      setMissing([]);
      setBusy(false);
    };
    window.addEventListener("editor-media-changed", invalidate);
    return () => window.removeEventListener("editor-media-changed", invalidate);
  }, [draft.id]);
  useEffect(() => {
    generation.current++;
    dispose.current();
    dispose.current = () => {};
    setFrame("");
    setBundle(null);
    setMissing([]);
    setBusy(false);
  }, [draft.id, draft.source, draft.syncedCommit, draft.remoteRevision]);
  async function load() {
    const current = ++generation.current;
    setBusy(true);
    setMessage("");
    try {
      const result = await loadAstroReview(draft);
      const rendered = await renderAstroReview(result, await localMedia(draft.id));
      if (generation.current !== current) {
        rendered.dispose();
        return;
      }
      dispose.current();
      dispose.current = rendered.dispose;
      setFrame(rendered.url);
      setMissing(rendered.missing);
      setBundle(result);
    } catch (error) {
      if (generation.current !== current) return;
      const text = error instanceof Error ? error.message : "REVIEW_FAILED";
      setMessage(
        text.startsWith("EDITOR_REVIEW_NOT_READY")
          ? "このcommitのAstroレビューはまだ準備されていません。Draft PRの「Editor Astro layout preview」を確認してください。"
          : text === "EDITOR_REVIEW_REQUIRES_SAVED_SOURCE"
            ? "先に最新の原稿をGitへ保存してください。"
            : text === "EDITOR_REVIEW_STALE"
              ? "原稿が更新されています。現在のcommitに対応するレビューを取得してください。"
              : text,
      );
    } finally {
      if (generation.current === current) setBusy(false);
    }
  }
  return (
    <section className="astro-review">
      <div className="section-title">
        <h2>正規レイアウトで確認</h2>
        <button
          type="button"
          disabled={
            busy || !authenticated || !draft.syncedCommit || draft.syncedSource !== draft.source
          }
          onClick={() => void load()}
        >
          {busy ? "取得中…" : "Astroレビューを取得"}
        </button>
      </div>
      <p className="muted small">
        Draft
        PRの公開CIが、固定commitのAstro部品・CSS・数式から生成します。非公開画像はこの端末で結び付け、CIへ渡しません。表示専用で、ツール実行・公開承認の代わりにはなりません。
      </p>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {bundle && (
        <p className="small">
          原稿 {bundle.context.commit.slice(0, 12)} ·{" "}
          {missing.length ? "未解決の画像: " + missing.join("、") : "参照画像を解決済み"}
        </p>
      )}
      {frame && (
        <iframe
          title="Astro正規レイアウト（表示専用）"
          sandbox="allow-same-origin"
          src={frame}
          referrerPolicy="no-referrer"
          className="astro-review-frame"
        />
      )}
    </section>
  );
}
