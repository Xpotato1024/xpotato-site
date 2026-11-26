import { readFootnoteDefinition, updateFootnoteContent } from "@xpotato/editor-core/footnotes";
import { BlockPreview } from "./BlockPreview.js";

export function FootnoteBlock({ source, onChange, onSelection }: {
  source: string;
  onChange: (source: string) => void;
  onSelection: (quote: string) => void;
}) {
  const note = readFootnoteDefinition(source);
  if (!note) return null;
  const marker = note.marker.trim().slice(0, -1);
  return (
    <div className="cms-footnote-block">
      <div className="cms-footnote-reference">
        <label>
          本文の参照記号
          <input value={marker} readOnly spellCheck={false} />
        </label>
      </div>
      <label>
        脚注の内容
        <textarea
          className="cms-source-input"
          value={note.content}
          rows={Math.min(16, Math.max(3, note.content.split("\n").length + 1))}
          onChange={(event) => onChange(updateFootnoteContent(source, event.target.value))}
          onSelect={(event) => {
            const input = event.currentTarget;
            onSelection(input.value.slice(input.selectionStart, input.selectionEnd));
          }}
        />
      </label>
      <BlockPreview source={note.content} />
    </div>
  );
}
