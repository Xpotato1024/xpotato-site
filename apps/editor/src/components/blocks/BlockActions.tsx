import { useEffect, useId, useRef, useState } from "react";
import { BlockIcon } from "./BlockIcon.js";

interface Props {
  first: boolean;
  last: boolean;
  disabled: boolean;
  raw: boolean;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onSource: () => void;
  onDelete: () => void;
  onGroup?: (() => void) | undefined;
  onGroupHeading?: (() => void) | undefined;
  onUngroup?: (() => void) | undefined;
}

export function BlockActions(props: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    menu.current?.scrollIntoView({ block: "nearest" });
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);
  const run = (operation: () => void) => {
    setOpen(false);
    operation();
    trigger.current?.focus({ preventScroll: true });
  };
  return (
    <div
      className="cms-region-actions"
      ref={root}
      onBlurCapture={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus({ preventScroll: true });
        }
      }}
    >
      <button
        type="button"
        ref={trigger}
        aria-label="ブロックの操作"
        title="ブロックの操作"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={props.disabled}
        onClick={(event) => {
          event.currentTarget.focus({ preventScroll: true });
          setOpen((value) => !value);
        }}
      >
        <BlockIcon name="more" />
      </button>
      {open && (
        <div
          id={id}
          className="cms-region-menu"
          ref={menu}
          role="group"
          aria-label="ブロックの操作"
        >
          <div className="cms-region-menu-move">
            <button
              type="button"
              disabled={props.first}
              aria-label="上へ移動"
              onClick={() => run(() => props.onMove(-1))}
            >
              <BlockIcon name="up" />
              上へ
            </button>
            <button
              type="button"
              disabled={props.last}
              aria-label="下へ移動"
              onClick={() => run(() => props.onMove(1))}
            >
              <BlockIcon name="down" />
              下へ
            </button>
          </div>
          {props.onGroupHeading && (
            <button type="button" onClick={() => run(props.onGroupHeading!)}>
              <BlockIcon name="Group" />
              見出しと本文をまとめる
            </button>
          )}
          {props.onGroup && (
            <button type="button" onClick={() => run(props.onGroup!)}>
              <BlockIcon name="Group" />
              ブロックを選んでまとめる
            </button>
          )}
          {props.onUngroup && (
            <button type="button" onClick={() => run(props.onUngroup!)}>
              <BlockIcon name="Group" />
              グループを解除
            </button>
          )}
          <button type="button" aria-label="ブロックを複製" onClick={() => run(props.onDuplicate)}>
            <BlockIcon name="copy" />
            複製
          </button>
          <button
            type="button"
            aria-label="MDXで編集"
            aria-pressed={props.raw}
            onClick={() => run(props.onSource)}
          >
            <BlockIcon name="code" />
            {props.raw ? "ブロック表示に戻す" : "MDXで編集"}
          </button>
          <button
            type="button"
            className="cms-delete-region"
            aria-label="ブロックを削除"
            onClick={() => run(props.onDelete)}
          >
            <BlockIcon name="remove" />
            削除
          </button>
        </div>
      )}
    </div>
  );
}
