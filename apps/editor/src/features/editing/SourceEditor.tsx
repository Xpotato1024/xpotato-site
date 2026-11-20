import { useEffect, useLayoutEffect, useRef } from "react";
import { Annotation, EditorState, Transaction } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  drawSelection,
  highlightSpecialChars,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { javascript } from "@codemirror/lang-javascript";
import { HighlightStyle, syntaxHighlighting, bracketMatching } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import type { SourceSelection } from "@xpotato/editor-core/annotations";
import { editorCaretEvent, registerEditorCaret } from "../../shared/editorFocus.js";

interface Props {
  value: string;
  onChange: (source: string) => void;
  onSelection?: (selection: SourceSelection) => void;
  onError?: (message: string) => void;
  label?: string;
  reveal?: { start: number; end: number; token: number };
}
const colors = HighlightStyle.define([
  { tag: tags.heading, color: "#705099", fontWeight: "600" },
  { tag: [tags.keyword, tags.tagName], color: "#79519d" },
  { tag: [tags.string, tags.attributeValue, tags.link], color: "#286c5a" },
  { tag: tags.attributeName, color: "#92621b" },
  { tag: [tags.comment, tags.meta], color: "#625e6e" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: [tags.number, tags.bool], color: "#a24c35" },
  { tag: tags.monospace, color: "#965341" },
]);
const externalSourceUpdate = Annotation.define<boolean>();
export function SourceEditor(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  useLayoutEffect(() => {
    if (!host.current) return;
    const shadow = host.current.shadowRoot ?? host.current.attachShadow({ mode: "open" });
    const mount = document.createElement("div");
    shadow.append(mount);
    const editor = new EditorView({
      parent: mount,
      root: shadow,
      state: EditorState.create({
        doc: callbacks.current.value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          drawSelection(),
          highlightSpecialChars(),
          history(),
          bracketMatching(),
          markdown({
            codeLanguages: (info) =>
              /^(js|jsx|javascript|ts|tsx|typescript)$/iu.test(info)
                ? javascript({ jsx: true, typescript: /^t/iu.test(info) }).language
                : null,
          }),
          syntaxHighlighting(colors),
          EditorView.lineWrapping,
          keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
          EditorView.contentAttributes.of({
            "aria-label": callbacks.current.label ?? "MDX本文",
            spellcheck: "false",
            autocapitalize: "off",
            autocorrect: "off",
          }),
          EditorView.domEventHandlers({
            paste(event) {
              const text = event.clipboardData?.getData("text/plain") ?? "";
              if (/^---\r?\n(?:id|title|draft|description):/u.test(text)) {
                callbacks.current.onError?.(
                  "記事情報を含むMDXは、一覧の「取り込む」から開いてください。",
                );
                return true;
              }
              return false;
            },
          }),
          EditorView.updateListener.of((update) => {
            if (update.selectionSet || update.docChanged || update.focusChanged) {
              update.view.contentDOM.dispatchEvent(
                new Event(editorCaretEvent, { bubbles: true, composed: true }),
              );
            }
            const localTransactions = update.transactions.filter(
              (transaction) => !transaction.annotation(externalSourceUpdate),
            );
            if (localTransactions.some((transaction) => transaction.docChanged)) {
              callbacks.current.onChange(update.state.doc.toString());
            }
            if (
              localTransactions.some(
                (transaction) => transaction.selection || transaction.docChanged,
              )
            ) {
              const range = update.state.selection.main;
              if (!range.empty)
                callbacks.current.onSelection?.({
                  start: range.from,
                  end: range.to,
                  quote: update.state.sliceDoc(range.from, range.to),
                });
            }
          }),
          EditorView.theme({
            "&": {
              minHeight: "55vh",
              fontSize: "16px",
              maxWidth: "100%",
              minWidth: "0",
              background: "transparent",
            },
            ".cm-content": {
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "var(--font-mono)",
              padding: "1.25rem 0",
              lineHeight: "1.85",
              overflowWrap: "anywhere",
            },
            ".cm-line": { padding: "0 1rem" },
            ".cm-scroller": { overflowX: "hidden", fontFamily: "var(--font-mono)" },
            ".cm-gutters": {
              background: "transparent",
              color: "#8f8799",
              border: "none",
              fontSize: "12px",
            },
            ".cm-activeLineGutter": { background: "#eee8f3" },
            "&.cm-focused": { outline: "none" },
            ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
              background: "#e4d8f0",
            },
            ".cm-cursor": { borderLeftColor: "#745399" },
            "@media (max-width: 800px)": {
              ".cm-gutters": { display: "none" },
              ".cm-line": { padding: "0" },
            },
          }),
        ],
      }),
    });
    view.current = editor;
    const unregisterCaret = registerEditorCaret(editor.contentDOM, () =>
      editor.coordsAtPos(editor.state.selection.main.head),
    );
    return () => {
      unregisterCaret();
      view.current = null;
      editor.destroy();
      mount.remove();
    };
  }, []);
  useLayoutEffect(() => {
    const editor = view.current;
    if (!editor || editor.state.doc.toString() === props.value) return;
    const previous = editor.state.doc.toString();
    let from = 0,
      end = previous.length,
      nextEnd = props.value.length;
    while (from < Math.min(end, nextEnd) && previous[from] === props.value[from]) from++;
    while (end > from && nextEnd > from && previous[end - 1] === props.value[nextEnd - 1]) {
      end--;
      nextEnd--;
    }
    // 親からの反映を入力として戻すと、遅れた同期で新しい本文を上書きし得る。
    editor.dispatch({
      changes: { from, to: end, insert: props.value.slice(from, nextEnd) },
      annotations: [externalSourceUpdate.of(true), Transaction.addToHistory.of(false)],
    });
  }, [props.value]);
  useEffect(() => {
    const editor = view.current;
    if (editor && props.reveal) {
      const from = Math.min(editor.state.doc.length, props.reveal.start),
        to = Math.min(editor.state.doc.length, props.reveal.end);
      editor.dispatch({
        selection: { anchor: from, head: to },
        effects: EditorView.scrollIntoView(from, { y: "center" }),
      });
    }
  }, [props.reveal]);
  return <div className="source-editor" ref={host} />;
}
