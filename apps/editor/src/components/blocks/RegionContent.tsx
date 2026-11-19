import { lazy, Suspense, useMemo, useState, type PointerEvent, type ReactNode } from "react";
import { blockTree, readModuleSource } from "@xpotato/editor-core/blocks";
import { BlockPreview, canEditRich } from "./BlockPreview.js";
import { blockChoices } from "./BlockPalette.js";
import { CodeBlock } from "./CodeBlock.js";
import { ModuleBlock, type EditorMedia, type EditorTool } from "./ModuleBlock.js";
const RichTextBlock = lazy(() => import("./RichTextBlock.js"));
const blockLabels: Record<string, string> = {
  paragraph: "段落",
  heading: "見出し",
  list: "リスト",
  table: "表",
  code: "コード",
  blockquote: "引用",
  thematicBreak: "区切り",
};
export function describeRegion(source: string) {
  try {
    const nodes = blockTree(source).children ?? [];
    const node = nodes[0];
    const module = readModuleSource(source);
    return {
      label: module
        ? (blockChoices.find((item) => item.kind === module.name)?.label ?? module.name)
        : nodes.length > 1
          ? "本文"
          : node?.type === "code" && node.lang === "math"
            ? "数式"
            : (blockLabels[node?.type ?? ""] ?? "MDX"),
      node,
      module,
      rich: canEditRich(source),
    };
  } catch {
    return { label: "MDX", node: undefined, module: null, rich: false };
  }
}
function pointerTextOffset(event: PointerEvent<HTMLElement>): number | undefined {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const point = doc.caretPositionFromPoint?.(event.clientX, event.clientY);
  const caret = doc.caretRangeFromPoint?.(event.clientX, event.clientY);
  const node = point?.offsetNode ?? caret?.startContainer;
  const offset = point?.offset ?? caret?.startOffset;
  if (!node || offset === undefined || !event.currentTarget.contains(node)) return undefined;
  const range = document.createRange();
  range.selectNodeContents(event.currentTarget);
  range.setEnd(node, offset);
  return range.toString().length;
}
export function RegionContent({
  source,
  editing,
  initialCaret,
  raw,
  onChange,
  onError,
  onSelection,
  onActivate,
  childrenEditor,
  media,
  tools,
  inlineOnly,
}: {
  source: string;
  editing: boolean;
  initialCaret: number | undefined;
  raw: boolean;
  onChange: (source: string) => void;
  onError: (message: string) => void;
  onSelection: (quote: string, start?: number, end?: number) => void;
  onActivate: (offset?: number) => void;
  childrenEditor: (
    body: string,
    offset: number,
    parent: string,
    onChange: (body: string) => void,
  ) => ReactNode;
  media: EditorMedia[];
  tools: EditorTool[];
  inlineOnly: boolean;
}) {
  const info = useMemo(() => describeRegion(source), [source]);
  const [richError, setRichError] = useState("");
  const textInput = () => (
    <textarea
      className="cms-source-input"
      aria-label="ブロックのMDX"
      value={source}
      wrap="soft"
      spellCheck={false}
      rows={Math.min(20, Math.max(4, source.split("\n").length + 1))}
      onChange={(event) => onChange(event.target.value)}
      onSelect={(event) => {
        const input = event.currentTarget;
        if (input.selectionEnd > input.selectionStart)
          onSelection(
            input.value.slice(input.selectionStart, input.selectionEnd),
            input.selectionStart,
            input.selectionEnd,
          );
      }}
    />
  );
  if (
    raw ||
    richError ||
    (!info.rich && !info.module) ||
    (inlineOnly && blockTree(source).children?.some((node) => node.type !== "paragraph"))
  )
    return (
      <>
        {richError && (
          <p className="cms-field-error" role="status">
            この構文はMDXで編集できます。原文は保持されています。
          </p>
        )}
        {textInput()}
      </>
    );
  if (info.module) {
    const container = [
      "Group",
      "Gallery",
      "Callout",
      "Steps",
      "Step",
      "Comparison",
      "Details",
      "DiagnosticList",
      "ArticleEndnote",
    ].includes(info.module.name);
    if (!container && info.module.children?.trim()) return textInput();
    return (
      <ModuleBlock
        source={source}
        onChange={onChange}
        renderChildren={childrenEditor}
        media={media}
        tools={tools}
      />
    );
  }
  if (info.node?.type === "code" && blockTree(source).children?.length === 1)
    return <CodeBlock source={source} onChange={onChange} />;
  if (editing)
    return (
      <Suspense fallback={<div className="cms-loading-editor">エディタを読み込み中…</div>}>
        <RichTextBlock
          source={source}
          inlineOnly={inlineOnly}
          onChange={onChange}
          onError={(message) => {
            setRichError(message);
            onError("このブロックはMDXで編集できます。原文を保持しています。");
          }}
          initialCaret={initialCaret}
          onSelection={(quote) => onSelection(quote)}
        />
      </Suspense>
    );
  return (
    <div
      className="cms-preview-target"
      role="button"
      tabIndex={0}
      aria-label={info.label + "を編集"}
      onPointerUp={(event) => {
        const selection = window.getSelection();
        if (
          selection?.anchorNode &&
          event.currentTarget.contains(selection.anchorNode) &&
          selection.toString()
        ) {
          onSelection(selection.toString());
          return;
        }
        onActivate(pointerTextOffset(event));
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActivate();
        }
      }}
    >
      <BlockPreview source={source} />
    </div>
  );
}
