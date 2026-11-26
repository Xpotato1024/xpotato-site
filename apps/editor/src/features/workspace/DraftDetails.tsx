import { useEffect, useState } from "react";
import { hasLocalSourceChanges, hasPendingRegistryChanges } from "../../data/draft-identity.js";
import { localMedia, type LocalDraft, type LocalMedia } from "../../data/storage.js";
import { hashBlob } from "../../media/optimize.js";

export function draftSavedTime(value: string) {
  return new Date(value).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function DraftSummary({ draft }: { draft: LocalDraft }) {
  return (
    <>
      <span>
        {draft.producer === "ai" ? "AI下書き · " : ""}
        {draft.workingBranch || "この端末のみ"}
      </span>
      <span>
        端末保存 <time dateTime={draft.savedAt}>{draftSavedTime(draft.savedAt)}</time>
      </span>
      <span>
        {hasLocalSourceChanges(draft) ? "本文にGit未保存の変更" : "本文はGit取得時と同じ"}
        {" · "}添削 {draft.annotations?.length ?? 0}件
        {hasPendingRegistryChanges(draft) ? " · 分類・連載に未保存の変更" : ""}
      </span>
    </>
  );
}

/** A bounded-time excerpt keeps every differing line, including separate edits far apart. */
export function changedSourceRange(left: string, right: string) {
  if (left === right) return null;
  const a = left.split("\n"),
    b = right.split("\n");
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length,
    endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const excerpt = (lines: string[]) =>
    lines.length > 0 && lines.every((line) => line === "")
      ? `（空行 ${lines.length}行）`
      : lines.join("\n");
  return {
    line: start + 1,
    left: excerpt(a.slice(start, endA)),
    right: excerpt(b.slice(start, endB)),
  };
}

function TextDifference({ label, left, right }: { label: string; left: string; right: string }) {
  const difference = changedSourceRange(left, right);
  if (!difference) return <p className="small">{label}は同じです。</p>;
  return (
    <section className="draft-difference-text">
      <h3>{label}の違い</h3>
      <p className="small muted">{difference.line}行目から違いのある範囲を表示しています。</p>
      <div>
        <section>
          <h4>この下書き</h4>
          <pre>{difference.left || "（この範囲はありません）"}</pre>
        </section>
        <section>
          <h4>比較する下書き</h4>
          <pre>{difference.right || "（この範囲はありません）"}</pre>
        </section>
      </div>
    </section>
  );
}

async function mediaSignature(media: LocalMedia[]) {
  const records = await Promise.all(
    media.map(async (item) => ({
      assetId: item.assetId,
      sha256: await hashBlob(item.blob),
      alt: item.alt ?? "",
      caption: item.caption ?? "",
      credit: item.credit ?? "",
      creditUrl: item.creditUrl ?? "",
    })),
  );
  return records.sort(
    (a, b) => a.assetId.localeCompare(b.assetId) || a.sha256.localeCompare(b.sha256),
  );
}

export function DraftComparison({
  draft,
  alternatives,
}: {
  draft: LocalDraft;
  alternatives: LocalDraft[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [otherId, setOtherId] = useState(alternatives[0]?.id ?? "");
  const other = alternatives.find((item) => item.id === otherId) ?? alternatives[0];
  const [media, setMedia] = useState<{ key: string; left: string; right: string } | null>(null);
  const [failure, setFailure] = useState("");
  const key = draft.id + ":" + (other?.id ?? "");
  useEffect(() => {
    if (!expanded || !other) return;
    let active = true;
    setFailure("");
    setMedia(null);
    void Promise.all([
      localMedia(draft.id).then(mediaSignature),
      localMedia(other.id).then(mediaSignature),
    ])
      .then(([left, right]) => {
        if (active)
          setMedia({
            key,
            left: JSON.stringify(left, null, 2),
            right: JSON.stringify(right, null, 2),
          });
      })
      .catch(() => {
        if (active) setFailure("画像の違いを取得できませんでした。下書きは保持しています。");
      });
    return () => {
      active = false;
    };
  }, [expanded, draft.id, draft.savedAt, other?.id, other?.savedAt, key]);
  if (!other) return null;
  return (
    <details
      className="draft-comparison"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>同じ原稿の下書きとの違い（{alternatives.length + 1}件）</summary>
      {expanded && (
        <>
          <label>
            比較する下書き
            <select value={other.id} onChange={(event) => setOtherId(event.target.value)}>
              {alternatives.map((item, index) => (
                <option key={item.id} value={item.id}>
                  {index + 1}. {draftSavedTime(item.savedAt)} ·{" "}
                  {hasLocalSourceChanges(item) ? "本文に未保存の変更" : "本文はGit取得時と同じ"}
                </option>
              ))}
            </select>
          </label>
          <p className="small">
            この下書き: {draftSavedTime(draft.savedAt)}
            <br />
            比較する下書き: {draftSavedTime(other.savedAt)}
          </p>
          <TextDifference label="本文・記事情報" left={draft.source} right={other.source} />
          <TextDifference
            label="添削"
            left={JSON.stringify(draft.annotations ?? [], null, 2)}
            right={JSON.stringify(other.annotations ?? [], null, 2)}
          />
          <TextDifference
            label="分類・連載の変更"
            left={JSON.stringify(draft.pendingRegistryChanges ?? {}, null, 2)}
            right={JSON.stringify(other.pendingRegistryChanges ?? {}, null, 2)}
          />
          {media?.key === key ? (
            <TextDifference label="画像・説明" left={media.left} right={media.right} />
          ) : (
            <p className="small">{failure || "画像の違いを確認中…"}</p>
          )}
          <p className="small muted">比較しても原稿や画像は変更されません。</p>
        </>
      )}
    </details>
  );
}
