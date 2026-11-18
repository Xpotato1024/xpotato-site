import { useEffect, useState } from "react";
import { localRevisions, type DraftRevision, type LocalDraft } from "../data/storage.js";
import { parseLocalDraft } from "../features/drafts/model.js";
export function HistoryPanel({
  draft,
  onRestore,
  onArchive,
  onError,
}: {
  draft: LocalDraft;
  onRestore: (revision: DraftRevision) => Promise<void>;
  onArchive: () => void;
  onError: (message: string) => void;
}) {
  const [revisions, setRevisions] = useState<DraftRevision[]>([]);
  const [selected, setSelected] = useState<DraftRevision | null>(null);
  useEffect(() => {
    let active = true;
    void localRevisions(draft.id)
      .then((items) => {
        if (active) setRevisions(items.sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
      })
      .catch(() => onError("履歴を読み込めませんでした。"));
    return () => {
      active = false;
    };
  }, [draft.id, draft.savedAt, onError]);
  return (
    <section className="history-panel">
      <h2>履歴</h2>
      <p className="small muted">この端末の直近40件を保存します。復元前の原稿も残します。</p>
      <div className="history-list">
        {revisions.map((revision) => (
          <button
            type="button"
            key={revision.id}
            aria-pressed={selected?.id === revision.id}
            onClick={() => setSelected(revision)}
          >
            <strong>{new Date(revision.savedAt).toLocaleString("ja-JP")}</strong>
            <span>
              {revision.label} · {parseLocalDraft(revision.source)?.data.title ?? "編集中"}
            </span>
          </button>
        ))}
      </div>
      {selected && (
        <div className="history-detail">
          <pre>{parseLocalDraft(selected.source)?.body ?? selected.source}</pre>
          <button
            type="button"
            className="primary"
            onClick={() =>
              void onRestore(selected).catch((error) =>
                onError(error instanceof Error ? error.message : "復元できませんでした。"),
              )
            }
          >
            この履歴を復元
          </button>
        </div>
      )}
      <button type="button" onClick={onArchive}>
        {draft.archived ? "下書きに戻す" : "この下書きをアーカイブ"}
      </button>
    </section>
  );
}
