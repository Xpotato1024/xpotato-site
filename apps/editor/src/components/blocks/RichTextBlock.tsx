import { useEffect, useMemo, useRef } from "react";
import {
  MDXEditor,
  defaultSvgIcons,
  realmPlugin,
  addTableCellEditorChild$,
  type MDXEditorMethods,
  type CodeBlockEditorProps,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  linkPlugin,
  linkDialogPlugin,
  tablePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  codeBlockPlugin,
  toolbarPlugin,
  BoldItalicUnderlineToggles,
  StrikeThroughSupSubToggles,
  CodeToggle,
  CreateLink,
  BlockTypeSelect,
  ListsToggle,
  InsertTable,
  activeEditor$,
  currentListType$,
  useCodeBlockEditorContext,
} from "@mdxeditor/editor";
import { useCellValue } from "@mdxeditor/gurx";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { INDENT_CONTENT_COMMAND, OUTDENT_CONTENT_COMMAND } from "lexical";
import "@mdxeditor/editor/style.css";
import { CodeFields } from "./CodeBlock.js";

function EmbeddedCodeEditor({ code, language, meta, focusEmitter }: CodeBlockEditorProps) {
  const input = useRef<HTMLTextAreaElement>(null);
  const context = useCodeBlockEditorContext();
  useEffect(() => {
    focusEmitter.subscribe(() => input.current?.focus());
  }, [focusEmitter]);
  return (
    <CodeFields
      code={code}
      language={language}
      meta={meta}
      onCode={context.setCode}
      onLanguage={context.setLanguage}
      onMeta={context.setMeta}
      inputRef={input}
    />
  );
}
function TableCellLabel() {
  const [editor] = useLexicalComposerContext();
  useEffect(
    () =>
      editor.registerRootListener((element) => {
        if (!element) return;
        const cell = element.closest("td,th") as HTMLTableCellElement | null;
        const row = cell?.parentElement as HTMLTableRowElement | null;
        element.setAttribute(
          "aria-label",
          cell && row ? `表の${row.sectionRowIndex + 1}行${cell.cellIndex}列` : "表のセル",
        );
      }),
    [editor],
  );
  return null;
}
const accessibleTablesPlugin = realmPlugin({
  init(realm) {
    realm.pub(addTableCellEditorChild$, TableCellLabel);
  },
});
function IndentButtons() {
  const editor = useCellValue(activeEditor$);
  const list = useCellValue(currentListType$);
  return (
    <>
      <button
        type="button"
        title="リストを一段浅く"
        aria-label="リストを一段浅く"
        disabled={!list}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => editor?.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined)}
      >
        ⇤
      </button>
      <button
        type="button"
        title="リストを一段深く"
        aria-label="リストを一段深く"
        disabled={!list}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => editor?.dispatchCommand(INDENT_CONTENT_COMMAND, undefined)}
      >
        ⇥
      </button>
    </>
  );
}
const translations: Record<string, string> = {
  "contentArea.editableMarkdown": "本文",
  "toolbar.inlineCode": "インラインコード",
  "toolbar.removeInlineCode": "インラインコードを解除",
  "toolbar.toggleGroup": "文字と段落の設定",
  "createLink.url": "リンク先URL",
  "createLink.urlPlaceholder": "https://…",
  "createLink.textTooltip": "リンクとして表示する文字",
  "createLink.text": "リンクの文字",
  "createLink.titleTooltip": "リンクにカーソルを重ねた時の説明",
  "createLink.title": "リンクの説明",
  "createLink.saveTooltip": "リンクを適用",
  "createLink.cancelTooltip": "キャンセル",
  "dialogControls.save": "適用",
  "dialogControls.cancel": "キャンセル",
  "linkPreview.edit": "リンク先を編集",
  "linkPreview.copyToClipboard": "URLをコピー",
  "linkPreview.copied": "コピーしました",
  "linkPreview.remove": "リンクを解除",
  "table.columnMenu": "列の操作",
  "table.rowMenu": "行の操作",
  "table.textAlignment": "文字の配置",
  "toolbar.bold": "太字",
  "toolbar.removeBold": "太字を解除",
  "toolbar.removeItalic": "斜体を解除",
  "toolbar.removeStrikethrough": "取り消し線を解除",
  "toolbar.italic": "斜体",
  "toolbar.strikethrough": "取り消し線",
  "toolbar.code": "インラインコード",
  "toolbar.link": "リンク",
  "toolbar.undo": "元に戻す",
  "toolbar.redo": "やり直す",
  "toolbar.bulletedList": "箇条書き",
  "toolbar.numberedList": "番号付きリスト",
  "toolbar.checkList": "チェックリスト",
  "toolbar.table": "表を追加",
  "toolbar.insertTable": "表を追加",
  "toolbar.blockTypes.paragraph": "段落",
  "toolbar.blockTypes.quote": "引用",
  "toolbar.blockTypes.heading": "見出し {{level}}",
  "toolbar.blockTypeSelect.selectBlockTypeTooltip": "段落の種類",
  "toolbar.blockTypeSelect.placeholder": "段落の種類",
  "linkDialog.url": "リンク先URL",
  "linkDialog.urlPlaceholder": "https://…",
  "linkDialog.title": "タイトル",
  "linkDialog.titlePlaceholder": "リンクの説明",
  "linkDialog.save": "適用",
  "linkDialog.cancel": "キャンセル",
  "linkDialog.editLink": "リンクを編集",
  "linkDialog.removeLink": "リンクを解除",
  "linkDialog.copyToClipboard": "URLをコピー",
  "table.insertRowAbove": "上に行を追加",
  "table.insertRowBelow": "下に行を追加",
  "table.deleteRow": "行を削除",
  "table.insertColumnLeft": "左に列を追加",
  "table.insertColumnRight": "右に列を追加",
  "table.deleteColumn": "列を削除",
  "table.deleteTable": "表を削除",
  "table.alignLeft": "左揃え",
  "table.alignCenter": "中央揃え",
  "table.alignRight": "右揃え",
};
const defaults: Record<string, string> = {
  "Inline code format": "インラインコード",
  "editable markdown": "本文",
  "Create link": "リンク",
  Strikethrough: "取り消し線",
  "Inline code": "インラインコード",
  "Insert table": "表を追加",
  Save: "適用",
  Cancel: "キャンセル",
  URL: "URL",
  Title: "タイトル",
  "Link URL": "リンク先URL",
  "Link title": "リンクの説明",
  "Edit link": "リンクを編集",
  "Remove link": "リンクを解除",
  "Copy link to clipboard": "URLをコピー",
  "Copied!": "コピーしました",
  "Delete table": "表を削除",
};
function translate(key: string, fallback: string, values?: Record<string, unknown>): string {
  let text = translations[key] ?? defaults[fallback] ?? fallback;
  for (const [name, value] of Object.entries(values ?? {}))
    text = text.replaceAll("{{" + name + "}}", String(value));
  return text;
}
function restoreCaret(container: HTMLElement, offset: number) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    remaining -= length;
  }
}
export default function RichTextBlock({
  source,
  onChange,
  onError,
  initialCaret,
  onSelection,
  inlineOnly,
}: {
  source: string;
  onChange: (source: string) => void;
  onError: (error: string) => void;
  initialCaret?: number | undefined;
  onSelection: (quote: string) => void;
  inlineOnly: boolean;
}) {
  const editor = useRef<MDXEditorMethods>(null);
  const root = useRef<HTMLDivElement>(null);
  const lastSource = useRef(source);
  const composing = useRef(false);
  const plugins = useMemo(
    () => [
      ...(inlineOnly ? [] : [headingsPlugin(), listsPlugin(), quotePlugin()]),
      linkPlugin({ validateUrl: (url) => /^(?:https?:|mailto:|\/|#|\.\.?\/)/iu.test(url) }),
      linkDialogPlugin(),
      ...(inlineOnly ? [] : [tablePlugin(), accessibleTablesPlugin(), thematicBreakPlugin()]),
      codeBlockPlugin({
        defaultCodeBlockLanguage: "text",
        codeBlockEditorDescriptors: [
          { priority: 1, match: () => true, Editor: EmbeddedCodeEditor },
        ],
      }),
      ...(inlineOnly ? [] : [markdownShortcutPlugin()]),
      toolbarPlugin({
        toolbarContents: () => (
          <>
            {!inlineOnly && <BlockTypeSelect />}
            <BoldItalicUnderlineToggles options={["Bold", "Italic"]} />
            <StrikeThroughSupSubToggles options={["Strikethrough"]} />
            <CodeToggle />
            <CreateLink />
            {!inlineOnly && (
              <>
                <ListsToggle />
                <IndentButtons />
                <InsertTable />
              </>
            )}
          </>
        ),
      }),
    ],
    [inlineOnly],
  );
  useEffect(() => {
    if (source !== lastSource.current && !composing.current) {
      lastSource.current = source;
      editor.current?.setMarkdown(source);
    }
  }, [source]);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      editor.current?.focus(
        () => {
          const content = root.current?.querySelector<HTMLElement>("[contenteditable=true]");
          if (content && initialCaret !== undefined) restoreCaret(content, initialCaret);
        },
        { defaultSelection: "rootEnd", preventScroll: true },
      ),
    );
    return () => cancelAnimationFrame(frame);
  }, []);
  const selection = () => {
    const value = window.getSelection();
    if (value?.anchorNode && root.current?.contains(value.anchorNode) && value.toString().trim())
      onSelection(value.toString());
  };
  return (
    <div
      ref={root}
      className="cms-rich-editor"
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={() => {
        composing.current = false;
      }}
      onPointerUp={() => requestAnimationFrame(selection)}
      onKeyUp={() => requestAnimationFrame(selection)}
    >
      <MDXEditor
        ref={editor}
        markdown={source}
        trim={false}
        plugins={plugins}
        translation={translate}
        iconComponentFor={(name) => (
          <>
            {defaultSvgIcons[name]}
            {(name === "add_row" || name === "add_column") && (
              <span className="cms-sr-only">{name === "add_row" ? "行を追加" : "列を追加"}</span>
            )}
          </>
        )}
        spellCheck={false}
        contentEditableClassName="cms-prose"
        placeholder="本文を入力…"
        suppressHtmlProcessing
        toMarkdownOptions={{
          bullet: "-",
          emphasis: "*",
          strong: "*",
          fences: true,
          listItemIndent: "one",
        }}
        onChange={(markdown, initialNormalize) => {
          if (initialNormalize || markdown === lastSource.current) return;
          lastSource.current = markdown;
          onChange(markdown);
        }}
        onError={({ error }) => onError(error)}
      />
    </div>
  );
}
