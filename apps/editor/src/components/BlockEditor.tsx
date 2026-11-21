import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  blockTemplates,
  createBlockDocument,
  writeBlockDocument,
  regionRange,
  updateRegion,
  reorderRegion,
  insertRegion,
  deleteRegion,
  sourceSelection,
  groupRegions,
  ungroupRegion,
  headingRegionRange,
  type BlockDocument,
  type BlockSelection,
} from "@xpotato/editor-core/blocks";
import {
  BlockPalette,
  allowedBlockKinds,
  blockChoices,
  type BlockKind,
} from "./blocks/BlockPalette.js";
import type { EditorMedia, EditorTool } from "./blocks/ModuleBlock.js";
import type { ReviewComment } from "@xpotato/editor-core/annotations";
import { RegionContent, describeRegion, hasNestedEditor } from "./blocks/RegionContent.js";
import { useBlockReorder } from "./blocks/useBlockReorder.js";
import { BlockIcon } from "./blocks/BlockIcon.js";
import { BlockActions } from "./blocks/BlockActions.js";
import { ReviewIndicator, ReviewStatusIcon } from "../features/review/ReviewIndicator.js";
import { blockReviewSelection } from "../features/review/review-actions.js";
import {
  locateReviewMarks,
  reviewMarkersForRegion,
  type LocatedReviewMark,
} from "../features/review/review-marks.js";
import "./blocks/block-editor.css";
import "../features/review/review-marks.css";
export interface BlockEditorProps {
  body: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
  onSelection?: ((selection: BlockSelection) => void) | undefined;
  onActiveBlock?:
    ((block: { start: number; end: number; source: string; index: number }) => void) | undefined;
  revealSelection?: { start: number; end: number; token: number } | undefined;
  media?: EditorMedia[] | undefined;
  tools?: EditorTool[] | undefined;
  annotations?: readonly ReviewComment[] | undefined;
  activeCommentId?: string | null | undefined;
  onReviewSelect?: ((id: string, trigger: HTMLButtonElement) => void) | undefined;
  onReviewCreate?: ((selection: BlockSelection, trigger: HTMLButtonElement) => void) | undefined;
  /** Children reuse root document locations instead of re-anchoring against a partial body. */
  reviewMarks?: readonly LocatedReviewMark[] | undefined;
  /** Nested semantic modules share absolute offsets with the outer document. */
  baseOffset?: number;
  parentModule?: string;
  allowedKinds?: readonly string[] | undefined;
}
export function BlockEditor({
  body,
  onChange,
  onError,
  onSelection,
  onActiveBlock,
  revealSelection,
  media = [],
  tools = [],
  annotations,
  activeCommentId,
  onReviewSelect,
  onReviewCreate,
  reviewMarks,
  baseOffset = 0,
  parentModule,
  allowedKinds,
}: BlockEditorProps) {
  const marks = useMemo(
    () => reviewMarks ?? locateReviewMarks(body, annotations ?? []),
    [body, annotations, reviewMarks],
  );
  const [model, setModel] = useState(() => createBlockDocument(body));
  const descriptionCache = useRef(
    new Map<string, { source: string; info: ReturnType<typeof describeRegion> }>(),
  );
  const descriptions = useMemo(() => {
    const next = new Map<string, { source: string; info: ReturnType<typeof describeRegion> }>();
    for (const region of model.regions) {
      const existing = descriptionCache.current.get(region.id);
      next.set(
        region.id,
        existing?.source === region.source
          ? existing
          : { source: region.source, info: describeRegion(region.source) },
      );
    }
    descriptionCache.current = next;
    return next;
  }, [model.regions]);
  const current = useRef(model);
  current.current = model;
  const lastBody = useRef(body);
  const [active, setActive] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [initialCaret, setInitialCaret] = useState<number | undefined>();
  const [sourceRegions, setSourceRegions] = useState<Set<string>>(() => new Set());
  const [paletteAfter, setPaletteAfter] = useState<number | null>(null);
  const [paletteKeyboard, setPaletteKeyboard] = useState(false);
  const [groupSelection, setGroupSelection] = useState<{ from: string; to: string } | null>(null);
  const [paletteMobile, setPaletteMobile] = useState(
    () => window.matchMedia("(max-width: 800px)").matches,
  );
  const paletteTrigger = useRef<HTMLButtonElement | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [composing, setComposing] = useState(false);
  const selectedText = useRef<BlockSelection | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onChange, onActiveBlock });
  callbacks.current = { onChange, onActiveBlock };
  const allowed = useMemo(
    () =>
      allowedKinds
        ? allowedKinds.filter((kind): kind is BlockKind => kind in blockTemplates)
        : allowedBlockKinds(parentModule),
    [allowedKinds, parentModule],
  );
  const insertionLabel =
    parentModule === "Gallery"
      ? "画像"
      : parentModule === "Steps"
        ? "手順"
        : parentModule === "DiagnosticList"
          ? "症状"
          : parentModule === "Comparison" && allowed.includes("ComparisonCase")
            ? "条件"
            : "ブロック";
  useEffect(() => {
    if (paletteAfter === null) return;
    const mediaQuery = window.matchMedia("(max-width: 800px)");
    const update = () => setPaletteMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, [paletteAfter]);
  const closePalette = () => {
    setPaletteAfter(null);
    requestAnimationFrame(() => paletteTrigger.current?.focus({ preventScroll: true }));
  };
  const openPalette = (index: number, trigger: HTMLButtonElement, keyboard: boolean) => {
    setPaletteKeyboard(keyboard);
    paletteTrigger.current = trigger;
    // Determine layout before the search is mounted; an initial inline frame scrolls iOS.
    setPaletteMobile(window.matchMedia("(max-width: 800px)").matches);
    setPaletteAfter(index);
  };
  useLayoutEffect(() => {
    if (body !== lastBody.current) {
      lastBody.current = body;
      setEditing(null);
      setInitialCaret(undefined);
      setModel((previous) => createBlockDocument(body, previous));
    }
  }, [body]);
  useEffect(() => {
    const index = model.regions.findIndex((region) => region.id === active);
    const region = model.regions[index];
    if (
      region &&
      !document.activeElement?.closest(".cms-review-indicator, .cms-review-create") &&
      document.activeElement?.closest("[data-region-id]")?.getAttribute("data-region-id") ===
        region.id
    ) {
      const range = regionRange(model, index);
      callbacks.current.onActiveBlock?.({
        start: baseOffset + range.start,
        end: baseOffset + range.end,
        source: region.source,
        index,
      });
    }
  }, [active, model, baseOffset]);
  useEffect(() => {
    if (!revealSelection) return;
    const index = current.current.regions.findIndex((_, i) => {
      const range = regionRange(current.current, i);
      return (
        revealSelection.start >= baseOffset + range.start &&
        revealSelection.start <= baseOffset + range.end
      );
    });
    const region = current.current.regions[index];
    if (!region) return;
    setActive(region.id);
    requestAnimationFrame(() => {
      const element = list.current?.querySelector<HTMLElement>(
        ':scope > [data-region-id="' + region.id + '"]',
      );
      element?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [revealSelection?.token]);
  const commit = (next: BlockDocument) => {
    const source = writeBlockDocument(next);
    current.current = next;
    lastBody.current = source;
    setModel(next);
    callbacks.current.onChange(source);
  };
  const selectResult = (next: BlockDocument, index: number, message: string) => {
    commit(next);
    setGroupSelection(null);
    const id = next.regions[index]?.id;
    setActive(id ?? null);
    setEditing(null);
    setAnnouncement(message);
    requestAnimationFrame(() =>
      list.current
        ?.querySelector<HTMLButtonElement>(
          ':scope > [data-region-id="' + id + '"] > .cms-region-toolbar .cms-drag-handle',
        )
        ?.focus({ preventScroll: true }),
    );
  };
  const group = (from: number, to: number) => {
    try {
      selectResult(
        groupRegions(current.current, from, to),
        from,
        to - from + 1 + "ブロックをまとめました。",
      );
    } catch {
      onError("まとめる範囲をもう一度選択してください。本文は変更していません。");
    }
  };
  const ungroup = (index: number) => {
    try {
      selectResult(ungroupRegion(current.current, index), index, "グループを解除しました。");
    } catch {
      onError("このグループを解除できません。MDXを確認してください。");
    }
  };
  const groupStart = groupSelection
    ? model.regions.findIndex((region) => region.id === groupSelection.from)
    : -1;
  const groupEnd = groupSelection
    ? model.regions.findIndex((region) => region.id === groupSelection.to)
    : -1;
  const selectionFrom = Math.min(groupStart, groupEnd);
  const selectionTo = Math.max(groupStart, groupEnd);
  const move = (from: number, to: number) => {
    if (composing) return;
    const next = reorderRegion(current.current, from, to);
    if (next !== current.current) {
      commit(next);
      setGroupSelection(null);
      setAnnouncement(to + 1 + "番目に移動しました。");
    }
  };
  const { drag, dragging, finishDrag, pointerDown, pointerMove, dragKeys } = useBlockReorder({
    count: model.regions.length,
    disabled: composing,
    list,
    onMove: move,
    onAnnounce: setAnnouncement,
  });
  const insert = (kind: BlockKind) => {
    const next = insertRegion(
      current.current,
      blockTemplates[kind],
      paletteAfter ?? current.current.regions.length - 1,
    );
    const position = Math.max(
      0,
      Math.min(next.regions.length - 1, (paletteAfter ?? current.current.regions.length - 1) + 1),
    );
    commit(next);
    setPaletteAfter(null);
    setActive(next.regions[position]!.id);
    setEditing(next.regions[position]!.id);
    setInitialCaret(undefined);
    setAnnouncement(
      (blockChoices.find((choice) => choice.kind === kind)?.label ?? kind) + "を追加しました。",
    );
  };
  const selectionFor = (index: number, quote: string, start?: number, end?: number) => {
    const region = current.current.regions[index];
    if (!region) return;
    const offset = baseOffset + regionRange(current.current, index).start;
    const selection =
      start !== undefined && end !== undefined
        ? {
            quote,
            blockStart: offset,
            blockEnd: offset + region.source.length,
            blockSource: region.source,
            start: offset + start,
            end: offset + end,
          }
        : sourceSelection(region.source, quote, offset);
    selectedText.current = selection;
    if (quote.trim()) setActive(region.id);
    onSelection?.(blockReviewSelection(region.source, offset, selection));
  };
  const preserveReviewSelection = (index: number, trigger: HTMLButtonElement) => {
    const selected = window.getSelection();
    const region = trigger.closest("[data-region-id]");
    const anchor = selected?.anchorNode?.parentElement;
    if (
      selected?.anchorNode &&
      selected.focusNode &&
      selected.toString().trim() &&
      anchor?.closest(".cms-preview-target, .cms-rich-editor") &&
      region?.contains(selected.anchorNode) &&
      region.contains(selected.focusNode) &&
      anchor.closest("[data-region-id]") === region &&
      selected.focusNode.parentElement?.closest("[data-region-id]") === region
    ) {
      selectionFor(index, selected.toString());
    }
  };
  return (
    <section
      className={"cms-block-editor" + (parentModule ? " cms-nested-editor" : "")}
      aria-label={parentModule ? "部品の内容" : "本文のブロック編集"}
      onCompositionStart={() => setComposing(true)}
      onCompositionEnd={() => setComposing(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && dragging.current) finishDrag(true);
      }}
    >
      <div className="cms-sr-only" aria-live="polite" role="status">
        {announcement}
      </div>
      {groupSelection && (
        <div className="cms-group-selection-bar" role="group" aria-label="まとめる範囲">
          <span>末尾のブロックを選択</span>
          <button
            type="button"
            disabled={selectionFrom < 0 || composing}
            onClick={() => group(selectionFrom, selectionTo)}
          >
            {selectionTo - selectionFrom + 1}件をまとめる
          </button>
          <button
            type="button"
            aria-label="グループ化をキャンセル"
            onClick={() => setGroupSelection(null)}
          >
            <BlockIcon name="close" />
          </button>
        </div>
      )}
      {paletteAfter !== null &&
        (paletteMobile ? (
          createPortal(
            <div className="cms-insert-overlay">
              <BlockPalette
                allowed={allowed}
                onInsert={insert}
                onClose={closePalette}
                modal
                focusSearch={paletteKeyboard}
              />
            </div>,
            document.body,
          )
        ) : (
          <BlockPalette allowed={allowed} onInsert={insert} onClose={closePalette} />
        ))}
      {model.parseError && (
        <p className="cms-field-error">
          構文が未完成です。MDXを編集できます。原文は保持されています。
        </p>
      )}
      <div ref={list} className="cms-block-list">
        {model.regions.map((region, index) => {
          const selected = active === region.id;
          const info = descriptions.get(region.id)!.info;
          const range = regionRange(model, index);
          const offset = baseOffset + range.start;
          const raw = sourceRegions.has(region.id);
          const nested =
            !raw &&
            !model.parseError &&
            parentModule !== "ArticleEndnote" &&
            info.module &&
            hasNestedEditor(info.module.name);
          const regionMarks = marks.filter(
            (mark) => mark.start < offset + region.source.length && mark.end > offset,
          );
          // A comment gets one badge at its smallest rendered region, never both group and child.
          const childRanges = nested
            ? (info.node?.children ?? []).flatMap((child) => {
                const start = child.position?.start.offset;
                const end = child.position?.end.offset;
                return start !== undefined && end !== undefined
                  ? [{ start: offset + start, end: offset + end }]
                  : [];
              })
            : [];
          const ownedMarks = reviewMarkersForRegion(
            regionMarks,
            { start: offset, end: offset + region.source.length },
            childRanges,
          );
          const groupSelected = Boolean(
            groupSelection && index >= selectionFrom && index <= selectionTo,
          );
          const canGroup =
            !model.parseError &&
            allowed.includes("Group") &&
            info.module?.name !== "ArticleEndnote";
          const headingRange =
            selected && canGroup && info.node?.type === "heading"
              ? headingRegionRange(model, index)
              : null;
          return (
            <article
              key={region.id}
              data-region-id={region.id}
              data-active={selected || undefined}
              data-group={info.module?.name === "Group" || undefined}
              data-group-selected={groupSelected || undefined}
              data-dragging={(drag?.active && drag.from === index) || undefined}
              data-drop-target={
                (drag?.active && drag.to === index && drag.to !== drag.from) || undefined
              }
              className="cms-editor-region"
              onFocusCapture={(event) => {
                if (
                  event.target instanceof Element &&
                  event.target.closest("[data-region-id]") === event.currentTarget
                ) {
                  const reviewAction = event.target.closest(
                    ".cms-review-indicator, .cms-review-create",
                  );
                  if (
                    !reviewAction &&
                    event.target.closest(".cms-region-toolbar")?.parentElement ===
                      event.currentTarget
                  ) {
                    // A reused region ID must not remount a rich editor that steals menu focus.
                    setEditing(null);
                    setInitialCaret(undefined);
                  }
                  if (!reviewAction) {
                    callbacks.current.onActiveBlock?.({
                      start: offset,
                      end: baseOffset + range.end,
                      source: region.source,
                      index,
                    });
                  }
                }
                if (active !== region.id) {
                  setActive(region.id);
                  setInitialCaret(undefined);
                }
              }}
            >
              <div className="cms-region-toolbar">
                {groupSelection && (
                  <button
                    type="button"
                    className="cms-group-select"
                    aria-label={index + 1 + "番目まで選択: " + info.label}
                    aria-pressed={groupSelected}
                    disabled={!canGroup}
                    onClick={() =>
                      setGroupSelection((current) => current && { ...current, to: region.id })
                    }
                  >
                    {groupSelected && <BlockIcon name="check" />}
                  </button>
                )}
                <button
                  type="button"
                  className="cms-drag-handle"
                  title="ドラッグで移動。キーボードではSpaceで開始"
                  aria-label={info.label + "を移動"}
                  aria-pressed={Boolean(drag?.active && drag.from === index)}
                  disabled={composing}
                  onPointerDown={(event) => pointerDown(event, index)}
                  onPointerMove={pointerMove}
                  onPointerUp={() => finishDrag()}
                  onPointerCancel={() => finishDrag(true)}
                  onKeyDown={(event) => dragKeys(event, index)}
                >
                  <BlockIcon name="grip" />
                </button>
                <span>{info.label}</span>
                <ReviewIndicator
                  marks={ownedMarks}
                  activeCommentId={activeCommentId}
                  onSelect={onReviewSelect}
                />
                {onReviewCreate && (
                  <button
                    type="button"
                    className="cms-review-create"
                    aria-label="指摘を追加"
                    title="指摘を追加"
                    aria-controls="workspace-panel"
                    disabled={composing}
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      preserveReviewSelection(index, event.currentTarget);
                      // Moving focus first would collapse a touch or rich-text selection.
                      event.preventDefault();
                    }}
                    onClick={(event) => {
                      preserveReviewSelection(index, event.currentTarget);
                      onReviewCreate(
                        blockReviewSelection(region.source, offset, selectedText.current),
                        event.currentTarget,
                      );
                    }}
                  >
                    <ReviewStatusIcon />
                  </button>
                )}
                <BlockActions
                  first={index === 0}
                  last={index === model.regions.length - 1}
                  disabled={composing}
                  raw={raw}
                  onMove={(direction) => move(index, index + direction)}
                  onDuplicate={() => {
                    commit(insertRegion(current.current, region.source, index));
                    setAnnouncement("複製しました。");
                  }}
                  onSource={() => {
                    const next = new Set(sourceRegions);
                    if (raw) next.delete(region.id);
                    else next.add(region.id);
                    setSourceRegions(next);
                  }}
                  onDelete={() => {
                    commit(deleteRegion(current.current, index));
                    if (selected) setActive(null);
                    setGroupSelection(null);
                    setAnnouncement("ブロックを削除しました。元に戻す操作で復元できます。");
                  }}
                  onGroup={
                    canGroup
                      ? () => setGroupSelection({ from: region.id, to: region.id })
                      : undefined
                  }
                  onGroupHeading={
                    headingRange ? () => group(headingRange.from, headingRange.to) : undefined
                  }
                  onUngroup={info.module?.name === "Group" ? () => ungroup(index) : undefined}
                />
              </div>
              <RegionContent
                source={region.source}
                editing={selected && editing === region.id}
                initialCaret={initialCaret}
                inlineOnly={parentModule === "ArticleEndnote"}
                raw={raw || model.parseError}
                onChange={(source) => commit(updateRegion(current.current, region.id, source))}
                onError={onError}
                onSelection={(quote, start, end) => selectionFor(index, quote, start, end)}
                onActivate={(caret) => {
                  selectedText.current = null;
                  setInitialCaret(caret);
                  setActive(region.id);
                  setEditing(region.id);
                }}
                media={media}
                tools={tools}
                reviewMarks={regionMarks.map((mark) => ({
                  ...mark,
                  start: mark.start - offset,
                  end: mark.end - offset,
                }))}
                activeCommentId={activeCommentId}
                childrenEditor={(children, childOffset, parent, onChildChange, childKinds) => (
                  <BlockEditor
                    body={children}
                    onChange={onChildChange}
                    onError={onError}
                    onSelection={onSelection}
                    onActiveBlock={onActiveBlock}
                    revealSelection={revealSelection}
                    baseOffset={offset + childOffset}
                    parentModule={parent}
                    allowedKinds={childKinds}
                    media={media}
                    tools={tools}
                    reviewMarks={marks}
                    activeCommentId={activeCommentId}
                    onReviewSelect={onReviewSelect}
                    onReviewCreate={onReviewCreate}
                  />
                )}
              />
              {index < model.regions.length - 1 && (
                <button
                  type="button"
                  className="cms-insert-after"
                  aria-label={info.label + "の後に挿入"}
                  disabled={composing}
                  onPointerUp={(event) => {
                    // iOS can focus the overlapping insertion control without dispatching
                    // the synthetic click after the region re-stacks. Handle touch release
                    // directly; the click handler remains for mouse and keyboard input.
                    if (event.pointerType === "touch" || event.pointerType === "pen") {
                      openPalette(index, event.currentTarget, false);
                    }
                  }}
                  onClick={(event) => openPalette(index, event.currentTarget, event.detail === 0)}
                >
                  <BlockIcon name="plus" />
                </button>
              )}
            </article>
          );
        })}
      </div>
      {!model.regions.length && (
        <div className="cms-empty-blocks">
          <button
            type="button"
            onClick={(event) => openPalette(-1, event.currentTarget, event.detail === 0)}
          >
            <BlockIcon name="plus" />
            {insertionLabel}
            を追加
          </button>
        </div>
      )}
      {model.regions.length > 0 && (
        <button
          type="button"
          className="cms-append-block"
          disabled={composing}
          onClick={(event) =>
            openPalette(model.regions.length - 1, event.currentTarget, event.detail === 0)
          }
        >
          <BlockIcon name="plus" />
          {insertionLabel}
          を追加
        </button>
      )}
    </section>
  );
}
