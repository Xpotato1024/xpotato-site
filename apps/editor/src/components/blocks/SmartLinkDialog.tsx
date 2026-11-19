import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  linkDialogState$,
  activeEditor$,
  switchFromPreviewToLinkEdit$,
  type EditLinkDialog,
  type PreviewLinkDialog,
} from "@mdxeditor/editor";
import { useCellValues, usePublisher } from "@mdxeditor/gurx";
import {
  $getSelection,
  $getNodeByKey,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  $createTextNode,
  type LexicalEditor,
  type RangeSelection,
} from "lexical";
import { $createLinkNode, $isAutoLinkNode, $isLinkNode, $toggleLink } from "@lexical/link";
import "./SmartLinkDialog.css";

const isUrlText = (value: string) => /^(?:https?:\/\/|mailto:|\/#?|\.\.?\/)[^\s]+$/iu.test(value);
const isAllowedUrl = (url: string) => {
  if (/[\u0000-\u0020\u007f\\]/u.test(url)) return false;
  if (/^(?:\/(?!\/)|#|\.\.?\/)/u.test(url)) return true;
  try {
    const parsed = new URL(url);
    return (
      /^(?:https?:|mailto:)$/u.test(parsed.protocol) && Boolean(parsed.hostname || parsed.pathname)
    );
  } catch {
    return false;
  }
};

interface LinkSnapshot {
  selection: RangeSelection | null;
  linkKey: string;
  text: string;
  url: string;
  title: string;
}

function captureLink(editor: LexicalEditor, state: EditLinkDialog): LinkSnapshot {
  return editor.getEditorState().read(() => {
    const selection = $getSelection();
    const range = $isRangeSelection(selection) ? selection : null;
    const node = $getNodeByKey(state.linkNodeKey);
    const link = $isLinkNode(node) ? node : null;
    return {
      selection: range?.clone() ?? null,
      linkKey: link?.getKey() ?? "",
      text: link?.getTextContent() ?? range?.getTextContent() ?? "",
      url: link?.getURL() ?? "",
      title: link?.getTitle() ?? state.title ?? "",
    };
  });
}

function selectionStillExists(snapshot: LinkSnapshot): boolean {
  if (snapshot.linkKey) {
    const link = $getNodeByKey(snapshot.linkKey);
    return (
      $isLinkNode(link) && link.getTextContent() === snapshot.text && link.getURL() === snapshot.url
    );
  }
  const selection = snapshot.selection;
  return Boolean(
    selection &&
    $getNodeByKey(selection.anchor.key)?.isAttached() &&
    $getNodeByKey(selection.focus.key)?.isAttached() &&
    selection.getTextContent() === snapshot.text,
  );
}

function LinkForm({
  state,
  editor,
  close,
}: {
  state: EditLinkDialog;
  editor: LexicalEditor;
  close: () => void;
}) {
  // 入力欄へフォーカスした後の選択範囲を、本文の修正対象として読み直さない。
  const [snapshot] = useState(() => captureLink(editor, state));
  const selectedUrl = isUrlText(snapshot.text.trim());
  const [url, setUrl] = useState(snapshot.url || (selectedUrl ? snapshot.text.trim() : ""));
  const [display, setDisplay] = useState(snapshot.text);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const urlField = useRef<HTMLInputElement>(null);
  const textField = useRef<HTMLInputElement>(null);
  const canEditText = !snapshot.linkKey || Boolean(snapshot.text);
  const valid = isAllowedUrl(url.trim()) && (!canEditText || Boolean(display.trim()));

  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const input = selectedUrl ? textField.current : urlField.current;
    input?.focus({ preventScroll: true });
    if (selectedUrl) input?.select();
    return () => element?.close();
  }, []);

  const finish = () => {
    dialog.current?.close();
    close();
    editor.getRootElement()?.focus({ preventScroll: true });
  };
  const cancel = () => {
    finish();
    editor.update(
      () => {
        if (snapshot.selection && selectionStillExists(snapshot)) {
          $setSelection(snapshot.selection.clone());
        }
      },
      { discrete: true },
    );
    close();
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!valid) return;
    if (!editor.getEditorState().read(() => selectionStillExists(snapshot))) {
      setError("本文が変更されました。閉じて対象を選び直してください。");
      return;
    }
    finish();
    editor.update(
      () => {
        const existing = $getNodeByKey(snapshot.linkKey);
        const label = display;
        if ($isLinkNode(existing)) {
          const link = $isAutoLinkNode(existing)
            ? $createLinkNode(url.trim(), { title: snapshot.title })
            : existing;
          if (link !== existing) {
            existing.replace(link, true);
          }
          link.setURL(url.trim());
          if (canEditText && label !== snapshot.text) {
            const first = link.getFirstChild();
            const replacement = $createTextNode(label);
            if ($isTextNode(first)) {
              replacement.setFormat(first.getFormat());
              replacement.setStyle(first.getStyle());
            }
            // 空の LinkNode は即座に取り除かれるため、子を一度空にせず置換する。
            link.splice(0, link.getChildrenSize(), [replacement]);
          }
          link.selectEnd();
          return;
        }
        const selection = snapshot.selection?.clone();
        if (!selection) return;
        $setSelection(selection);
        if (selection.isCollapsed() || label !== snapshot.text) {
          const text = $createTextNode(label).setFormat(selection.format).setStyle(selection.style);
          const link = $createLinkNode(url.trim(), { title: snapshot.title }).append(text);
          selection.insertNodes([link]);
          link.selectEnd();
        } else {
          // 標準の updateLink(text) は選択範囲を含む TextNode 全体を置換するため使わない。
          $toggleLink(url.trim(), { title: snapshot.title });
        }
      },
      { discrete: true },
    );
    close();
  };

  return (
    <dialog
      ref={dialog}
      className="cms-link-overlay"
      aria-label="リンクの設定"
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) cancel();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab" || event.nativeEvent.isComposing) return;
        const fields = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "button, input, textarea, select, a[href], [tabindex]",
          ),
        ).filter(
          (element) =>
            element.tabIndex >= 0 &&
            !element.matches(":disabled") &&
            !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
            element.getClientRects().length > 0 &&
            getComputedStyle(element).visibility !== "hidden",
        );
        const first = fields[0];
        const last = fields.at(-1);
        const active = document.activeElement;
        if (!first || !last) return;
        // Native dialog は末尾からブラウザーUIへ移れるため、フォーム内で循環させる。
        if (event.shiftKey ? active === first : active === last) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }}
    >
      <form className="cms-link-dialog" onSubmit={save}>
        <h3>リンク</h3>
        {canEditText && (
          <label>
            表示する文字
            <input
              ref={textField}
              value={display}
              onChange={(event) => setDisplay(event.target.value)}
              autoComplete="off"
            />
          </label>
        )}
        <label>
          リンク先URL
          <input
            ref={urlField}
            inputMode="url"
            type="text"
            value={url}
            placeholder="https://…"
            onChange={(event) => setUrl(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={Boolean(url) && !isAllowedUrl(url.trim())}
          />
        </label>
        {error && (
          <p role="alert" className="cms-field-error">
            {error}
          </p>
        )}
        <div className="cms-link-actions">
          <button type="button" onClick={cancel}>
            キャンセル
          </button>
          <button type="submit" className="primary" disabled={!valid}>
            適用
          </button>
        </div>
      </form>
    </dialog>
  );
}

function LinkPreview({
  state,
  editor,
  close,
  edit,
}: {
  state: PreviewLinkDialog;
  editor: LexicalEditor;
  close: () => void;
  edit: () => void;
}) {
  const popup = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = popup.current;
    const update = () => {
      const anchor = editor.getElementByKey(state.linkNodeKey)?.getBoundingClientRect();
      if (!element || !anchor) return;
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const left = viewport?.offsetLeft ?? 0;
      const width = viewport?.width ?? innerWidth;
      const height = viewport?.height ?? innerHeight;
      const bounds = element.getBoundingClientRect();
      const below = anchor.bottom + 6;
      const desired =
        below + bounds.height < top + height - 8 ? below : anchor.top - bounds.height - 6;
      element.style.left = `${Math.max(left + 8, Math.min(anchor.left, left + width - bounds.width - 8))}px`;
      element.style.top = `${Math.max(top + 8, Math.min(desired, top + height - bounds.height - 8))}px`;
    };
    update();
    const resize = new ResizeObserver(update);
    if (element) resize.observe(element);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      resize.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [editor, state.linkNodeKey]);
  const remove = () => {
    editor.update(
      () => {
        const link = $getNodeByKey(state.linkNodeKey);
        if (!$isLinkNode(link)) return;
        link.select();
        $toggleLink(null);
      },
      { discrete: true },
    );
    close();
    editor.getRootElement()?.focus({ preventScroll: true });
  };
  return (
    <div
      ref={popup}
      className="cms-link-preview-popup"
      role="dialog"
      aria-label="リンクを確認"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          close();
          editor.getRootElement()?.focus({ preventScroll: true });
        }
      }}
    >
      <span>{state.url}</span>
      <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={edit}>
        編集
      </button>
      <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={remove}>
        解除
      </button>
    </div>
  );
}

export function SmartLinkDialog() {
  const [state, editor] = useCellValues(linkDialogState$, activeEditor$);
  const setState = usePublisher(linkDialogState$);
  const edit = usePublisher(switchFromPreviewToLinkEdit$);
  if (state.type === "inactive" || !editor) return <></>;
  const close = () => setState({ type: "inactive" });
  return createPortal(
    state.type === "edit" ? (
      <LinkForm key={state.linkNodeKey} state={state} editor={editor} close={close} />
    ) : (
      <LinkPreview state={state} editor={editor} close={close} edit={() => edit()} />
    ),
    document.body,
  );
}
