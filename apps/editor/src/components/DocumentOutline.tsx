import { useMemo, type ReactNode } from "react";
import { BlockIcon } from "./blocks/BlockIcon.js";
import { buildDocumentOutline, type OutlineEntry } from "./document-outline.js";
import "./document-outline.css";

export function DocumentOutline({
  body,
  onLocate,
}: {
  body: string;
  onLocate: (start: number, end: number) => void;
}) {
  const children = useMemo(() => {
    const byParent = new Map<number | null, OutlineEntry[]>();
    for (const entry of buildDocumentOutline(body)) {
      const siblings = byParent.get(entry.parentStart) ?? [];
      siblings.push(entry);
      byParent.set(entry.parentStart, siblings);
    }
    return byParent;
  }, [body]);
  const renderEntries = (parentStart: number | null, depth = 0): ReactNode => (
    <ol className={depth ? "outline-children" : undefined} data-depth={Math.min(4, depth)}>
      {children.get(parentStart)?.map((entry) => (
        <li key={entry.start} data-depth={entry.depth} data-kind={entry.kind}>
          <button
            type="button"
            className="outline-row"
            onClick={() => onLocate(entry.start, entry.end)}
          >
            <BlockIcon name={entry.kind} />
            <span className="outline-text">
              {entry.detail && <span className="outline-kind">{entry.detail}</span>}
              <span className="outline-title">{entry.title}</span>
            </span>
          </button>
          {children.has(entry.start) && renderEntries(entry.start, depth + 1)}
        </li>
      ))}
    </ol>
  );
  return (
    <section className="document-outline" aria-label="記事構成">
      {children.size ? (
        renderEntries(null)
      ) : (
        <p className="muted">
          {body.trim() ? "構文を読み取れません。MDXを確認してください。" : "本文はまだありません。"}
        </p>
      )}
    </section>
  );
}
