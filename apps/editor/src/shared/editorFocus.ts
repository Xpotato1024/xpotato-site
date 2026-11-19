export interface FocusRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

type CaretReader = () => FocusRect | null;
const caretReaders = new WeakMap<HTMLElement, CaretReader>();
export const editorCaretEvent = "editor-caret-change";

export function registerEditorCaret(element: HTMLElement, reader: CaretReader) {
  caretReaders.set(element, reader);
  return () => caretReaders.delete(element);
}

export function activeInput(): HTMLElement | null {
  let element = document.activeElement;
  while (element?.shadowRoot?.activeElement) {
    element = element.shadowRoot.activeElement;
  }
  if (!(element instanceof HTMLElement)) return null;
  if (element instanceof HTMLTextAreaElement)
    return element.disabled || element.readOnly ? null : element;
  if (element instanceof HTMLInputElement) {
    return !element.disabled &&
      !element.readOnly &&
      /^(text|search|url|tel|email|password|number)$/u.test(element.type)
      ? element
      : null;
  }
  return element.isContentEditable ? element : null;
}

export function focusScrollDelta(rect: FocusRect, bounds: FocusRect, margin = 12) {
  const verticalMargin = Math.min(margin, Math.max(0, (bounds.bottom - bounds.top - 24) / 2));
  const horizontalMargin = Math.min(margin, Math.max(0, (bounds.right - bounds.left - 24) / 2));
  const top = bounds.top + verticalMargin;
  const bottom = bounds.bottom - verticalMargin;
  const left = bounds.left + horizontalMargin;
  const right = bounds.right - horizontalMargin;
  return {
    y: rect.bottom > bottom ? rect.bottom - bottom : rect.top < top ? rect.top - top : 0,
    x: rect.right > right ? rect.right - right : rect.left < left ? rect.left - left : 0,
  };
}

export function softwareKeyboardOpen(
  inputFocused: boolean,
  viewportHeight: number,
  layoutHeight: number,
  baselineHeight: number,
  scale: number,
) {
  const fullHeight = Math.max(layoutHeight, baselineHeight);
  return (
    inputFocused &&
    Math.abs(scale - 1) < 0.05 &&
    fullHeight - viewportHeight >= Math.max(120, fullHeight * 0.25)
  );
}

function composedParent(element: HTMLElement): HTMLElement | null {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return root instanceof ShadowRoot && root.host instanceof HTMLElement ? root.host : null;
}

function nativeCaret(element: HTMLInputElement | HTMLTextAreaElement): FocusRect {
  const rect = element.getBoundingClientRect();
  const end =
    element.selectionDirection === "backward" ? element.selectionStart : element.selectionEnd;
  if (end === null) return rect;
  const computed = getComputedStyle(element);
  const mirror = document.createElement("div");
  mirror.setAttribute("aria-hidden", "true");
  mirror.inert = true;
  for (const property of [
    "box-sizing",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "line-height",
    "letter-spacing",
    "word-spacing",
    "text-indent",
    "text-transform",
    "direction",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-top-width",
    "border-right-width",
    "border-bottom-width",
    "border-left-width",
    "tab-size",
  ]) {
    mirror.style.setProperty(property, computed.getPropertyValue(property));
  }
  Object.assign(mirror.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    visibility: "hidden",
    width: computed.width,
    height: "auto",
    borderStyle: "solid",
    overflow: "hidden",
    whiteSpace: element instanceof HTMLTextAreaElement ? "pre-wrap" : "pre",
    overflowWrap: "break-word",
  });
  // Password text must not be exposed in a temporary measuring node.
  const value =
    element instanceof HTMLInputElement && element.type === "password"
      ? "•".repeat(element.value.length)
      : element.value;
  mirror.append(document.createTextNode(value.slice(0, end)));
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.append(marker, document.createTextNode(value.slice(end)));
  document.body.append(mirror);
  try {
    const measured = marker.getBoundingClientRect();
    const origin = mirror.getBoundingClientRect();
    const top = rect.top + measured.top - origin.top - element.scrollTop;
    const left = rect.left + measured.left - origin.left - element.scrollLeft;
    return { top, bottom: top + measured.height, left, right: left + 1 };
  } finally {
    mirror.remove();
  }
}

function selectionCaret(element: HTMLElement): FocusRect | null {
  const selection = window.getSelection();
  if (!selection?.focusNode || !element.contains(selection.focusNode)) return null;
  const range = document.createRange();
  range.setStart(selection.focusNode, selection.focusOffset);
  range.collapse(true);
  const caret = range.getClientRects()[0];
  if (caret?.height) return caret;
  const node = selection.focusNode;
  if (node.nodeType === Node.TEXT_NODE && node.textContent?.length) {
    const offset = selection.focusOffset;
    range.setStart(node, Math.max(0, offset - 1));
    range.setEnd(node, offset || 1);
    const adjacent = range.getBoundingClientRect();
    const rtl = getComputedStyle(element).direction === "rtl";
    const left = offset > 0 !== rtl ? adjacent.right : adjacent.left;
    return { top: adjacent.top, bottom: adjacent.bottom, left, right: left + 1 };
  }
  const line = node instanceof Element ? node : node.parentElement;
  const rect = line?.getBoundingClientRect();
  if (!rect) return null;
  const height = Math.min(
    rect.height || 24,
    parseFloat(getComputedStyle(element).lineHeight) || 24,
  );
  return { top: rect.top, bottom: rect.top + height, left: rect.left, right: rect.left + 1 };
}

export function inputFocusRect(element: HTMLElement): FocusRect | null {
  const reader = caretReaders.get(element);
  if (reader) return reader();
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return nativeCaret(element);
  }
  return selectionCaret(element);
}

function scrollBounds(element: HTMLElement, viewport: FocusRect): FocusRect {
  const rect = element.getBoundingClientRect();
  const bounds = {
    top: Math.max(viewport.top, rect.top + element.clientTop),
    bottom: Math.min(viewport.bottom, rect.top + element.clientTop + element.clientHeight),
    left: Math.max(viewport.left, rect.left + element.clientLeft),
    right: Math.min(viewport.right, rect.left + element.clientLeft + element.clientWidth),
  };
  return bounds;
}

function excludeToolbars(bounds: FocusRect, input: HTMLElement, scroll: HTMLElement) {
  const toolbars = [
    scroll.querySelector<HTMLElement>(".workbench-toolbar"),
    input.closest(".cms-rich-editor")?.querySelector<HTMLElement>(".mdxeditor-toolbar"),
  ];
  for (const toolbar of toolbars) {
    if (!toolbar || !scroll.contains(toolbar)) continue;
    const rect = toolbar.getBoundingClientRect();
    if (rect.height && rect.top <= bounds.top + 2 && rect.bottom > bounds.top) {
      bounds.top = Math.min(bounds.bottom - 24, rect.bottom);
    }
  }
}

export function revealFocusedInput(viewport: FocusRect) {
  const input = activeInput();
  if (!input || !input.getClientRects().length) return;
  const containers: { element: HTMLElement; vertical: boolean; horizontal: boolean }[] = [];
  for (let scroll: HTMLElement | null = input; scroll; scroll = composedParent(scroll)) {
    const style = getComputedStyle(scroll);
    const scrollY =
      /auto|scroll/u.test(style.overflowY) && scroll.scrollHeight > scroll.clientHeight;
    const scrollX = /auto|scroll/u.test(style.overflowX) && scroll.scrollWidth > scroll.clientWidth;
    if (scrollY || scrollX) {
      containers.push({ element: scroll, vertical: scrollY, horizontal: scrollX });
    }
  }
  for (const [index, { element: scroll, vertical, horizontal }] of containers.entries()) {
    // Reveal the caret inside a textarea before moving that field into the outer viewport.
    const bounds = scrollBounds(
      scroll,
      index === containers.length - 1 ? viewport : scroll.getBoundingClientRect(),
    );
    if (bounds.bottom <= bounds.top || bounds.right <= bounds.left) continue;
    excludeToolbars(bounds, input, scroll);
    const caret = inputFocusRect(input);
    if (!caret) continue;
    const delta = focusScrollDelta(caret, bounds);
    // Native scrollTop changes preserve selection and do not interrupt IME composition.
    if (vertical && Math.abs(delta.y) > 1) scroll.scrollTop += delta.y;
    if (horizontal && Math.abs(delta.x) > 1) scroll.scrollLeft += delta.x;
  }
}
