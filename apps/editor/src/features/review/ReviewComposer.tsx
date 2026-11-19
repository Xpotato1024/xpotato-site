import { useId } from "react";
import type { SourceSelection } from "@xpotato/editor-core/annotations";

export function ReviewComposer({
  selection,
  instruction,
  contextual = false,
  onInstruction,
  onSubmit,
}: {
  selection: SourceSelection | null;
  instruction: string;
  contextual?: boolean;
  onInstruction: (instruction: string) => void;
  onSubmit: () => void;
}) {
  const inputId = useId();
  return (
    <form
      className={contextual ? "review-composer review-context-composer" : "review-composer"}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {selection?.quote ? (
        <blockquote className="selected-quote" aria-label="添削の対象">
          {selection.quote.length > 180 ? selection.quote.slice(0, 180) + "…" : selection.quote}
        </blockquote>
      ) : (
        <p className="muted small">本文の範囲、またはブロックを選択して指摘を付けます。</p>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId}>{contextual ? "追加の指摘" : "指摘"}</label>
        <textarea
          id={inputId}
          rows={3}
          value={instruction}
          maxLength={20000}
          onChange={(event) => onInstruction(event.target.value)}
          placeholder="説明を具体的に、根拠を追加、など"
        />
      </div>
      <button type="submit" className="primary" disabled={!selection?.quote || !instruction.trim()}>
        指摘を追加
      </button>
    </form>
  );
}
