import { useMemo } from "react";
import { buildDocumentOutline } from "./document-outline.js";

export function DocumentOutline({
  body,
  onLocate,
}: {
  body: string;
  onLocate: (start: number, end: number) => void;
}) {
  const entries = useMemo(() => buildDocumentOutline(body), [body]);
  return (
    <section className="document-outline" aria-label="記事構成">
      {entries.length ? (
        <ol>
          {entries.map((entry) => (
            <li key={entry.start} data-depth={Math.min(3, entry.depth)}>
              <button type="button" onClick={() => onLocate(entry.start, entry.end)}>
                <span className="outline-kind">{entry.detail}</span>
                <span>{entry.title}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">見出しやグループを追加すると、ここから移動できます。</p>
      )}
    </section>
  );
}
