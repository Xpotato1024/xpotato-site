import {
  useEffect,
  useRef,
  useState,
  type RefObject,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
interface DragState {
  from: number;
  to: number;
  x: number;
  y: number;
  active: boolean;
  keyboard: boolean;
}
function scrollDuringDrag(element: HTMLElement, y: number) {
  let scroll: HTMLElement | null = element.parentElement;
  while (
    scroll &&
    !(
      scroll.scrollHeight > scroll.clientHeight &&
      /auto|scroll/u.test(getComputedStyle(scroll).overflowY)
    )
  ) {
    scroll = scroll.parentElement;
  }
  const top = scroll?.getBoundingClientRect().top ?? 0;
  const bottom = scroll?.getBoundingClientRect().bottom ?? window.innerHeight;
  const delta = y < top + 64 ? -12 : y > bottom - 64 ? 12 : 0;
  if (delta) {
    if (scroll) scroll.scrollBy({ top: delta });
    else window.scrollBy({ top: delta });
  }
}
function nearestRegion(
  list: HTMLDivElement | null,
  x: number,
  y: number,
  fallback: number,
): number {
  const elements = Array.from(list?.children ?? []).filter((element) =>
    element.hasAttribute("data-region-id"),
  );
  let closest = fallback,
    distance = Infinity;
  elements.forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
    const next = Math.hypot(dx, y - (rect.top + rect.height / 2));
    if (next < distance) {
      distance = next;
      closest = index;
    }
  });
  return closest;
}
export function useBlockReorder({
  count,
  disabled,
  list,
  onMove,
  onAnnounce,
}: {
  count: number;
  disabled: boolean;
  list: RefObject<HTMLDivElement | null>;
  onMove: (from: number, to: number) => void;
  onAnnounce: (message: string) => void;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragging = useRef<DragState | null>(null);
  const handle = useRef<HTMLButtonElement | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (!drag?.active || drag.keyboard) return;
    let frame = 0;
    const scroll = () => {
      const state = dragging.current;
      if (!state?.active || state.keyboard || !handle.current) return;
      scrollDuringDrag(handle.current, pointer.current.y);
      const to = nearestRegion(list.current, pointer.current.x, pointer.current.y, state.to);
      if (to !== state.to) {
        const next = { ...state, to };
        dragging.current = next;
        setDrag(next);
      }
      frame = requestAnimationFrame(scroll);
    };
    frame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(frame);
  }, [drag?.active, drag?.keyboard, list]);
  const finishDrag = (cancel = false) => {
    const state = dragging.current;
    if (!cancel && state?.active) onMove(state.from, state.to);
    if (cancel && state) onAnnounce("移動をキャンセルしました。");
    dragging.current = null;
    setDrag(null);
    if (state?.keyboard)
      requestAnimationFrame(() => {
        if (handle.current?.isConnected) handle.current.focus({ preventScroll: true });
      });
  };
  const pointerDown = (event: PointerEvent<HTMLButtonElement>, index: number) => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    handle.current = event.currentTarget;
    pointer.current = { x: event.clientX, y: event.clientY };
    const next = {
      from: index,
      to: index,
      x: event.clientX,
      y: event.clientY,
      active: false,
      keyboard: false,
    };
    dragging.current = next;
    setDrag(next);
  };
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const state = dragging.current;
    if (!state || state.keyboard) return;
    pointer.current = { x: event.clientX, y: event.clientY };
    if (!state.active && Math.hypot(event.clientX - state.x, event.clientY - state.y) < 6) return;
    const next = {
      ...state,
      active: true,
      to: nearestRegion(list.current, event.clientX, event.clientY, state.to),
    };
    dragging.current = next;
    setDrag(next);
  };
  const dragKeys = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (disabled) return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (dragging.current) finishDrag();
      else {
        handle.current = event.currentTarget;
        const next = { from: index, to: index, x: 0, y: 0, active: true, keyboard: true };
        dragging.current = next;
        setDrag(next);
        onAnnounce(
          "移動を開始しました。上下キーで位置を選び、Enterで確定、Escapeでキャンセルします。",
        );
      }
    } else if (
      dragging.current?.keyboard &&
      ["ArrowUp", "ArrowDown", "Escape"].includes(event.key)
    ) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") finishDrag(true);
      else {
        const next = {
          ...dragging.current,
          to: Math.max(
            0,
            Math.min(count - 1, dragging.current.to + (event.key === "ArrowUp" ? -1 : 1)),
          ),
        };
        dragging.current = next;
        setDrag(next);
        onAnnounce(next.to + 1 + "番目へ移動。Enterで確定します。");
      }
    }
  };
  return { drag, dragging, finishDrag, pointerDown, pointerMove, dragKeys };
}
