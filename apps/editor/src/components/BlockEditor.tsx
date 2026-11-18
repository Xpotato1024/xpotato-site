import { useEffect, useMemo, useRef, useState } from "react";
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
import { RegionContent, describeRegion } from "./blocks/RegionContent.js";
import { useBlockReorder } from "./blocks/useBlockReorder.js";
import "./blocks/block-editor.css";
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
  /** Nested semantic modules share absolute offsets with the outer document. */
  baseOffset?: number;
  parentModule?: string;
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
  baseOffset = 0,
  parentModule,
}: BlockEditorProps) {
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
  const [announcement, setAnnouncement] = useState("");
  const [composing, setComposing] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onChange, onActiveBlock });
  callbacks.current = { onChange, onActiveBlock };
  const allowed = useMemo(() => allowedBlockKinds(parentModule), [parentModule]);
  useEffect(() => {
    if (body !== lastBody.current) {
      lastBody.current = body;
      setModel((previous) => createBlockDocument(body, previous));
    }
  }, [body]);
  useEffect(() => {
    const index = model.regions.findIndex((region) => region.id === active);
    const region = model.regions[index];
    if (
      region &&
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
  const move = (from: number, to: number) => {
    if (composing) return;
    const next = reorderRegion(current.current, from, to);
    if (next !== current.current) {
      commit(next);
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
    onSelection?.(
      start !== undefined && end !== undefined
        ? {
            quote,
            blockStart: offset,
            blockEnd: offset + region.source.length,
            blockSource: region.source,
            start: offset + start,
            end: offset + end,
          }
        : sourceSelection(region.source, quote, offset),
    );
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
      {!parentModule && (
        <div className="cms-block-topbar">
          <span>{model.regions.length} ブロック</span>
          <button
            type="button"
            disabled={composing}
            onClick={() =>
              setPaletteAfter(
                active
                  ? model.regions.findIndex((region) => region.id === active)
                  : model.regions.length - 1,
              )
            }
            aria-expanded={paletteAfter !== null}
          >
            ＋ 挿入
          </button>
        </div>
      )}
      {paletteAfter !== null && (
        <BlockPalette allowed={allowed} onInsert={insert} onClose={() => setPaletteAfter(null)} />
      )}
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
          return (
            <article
              key={region.id}
              data-region-id={region.id}
              data-active={selected || undefined}
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
                  callbacks.current.onActiveBlock?.({
                    start: offset,
                    end: baseOffset + range.end,
                    source: region.source,
                    index,
                  });
                }
                if (active !== region.id) {
                  setActive(region.id);
                  setInitialCaret(undefined);
                }
              }}
            >
              <div className="cms-region-toolbar">
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
                  ⠿
                </button>
                <span>{info.label}</span>
                <div className="cms-region-actions">
                  <button
                    type="button"
                    aria-label="上へ移動"
                    title="上へ移動"
                    disabled={index === 0 || composing}
                    onClick={() => move(index, index - 1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="下へ移動"
                    title="下へ移動"
                    disabled={index === model.regions.length - 1 || composing}
                    onClick={() => move(index, index + 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label="ブロックを複製"
                    title="複製"
                    disabled={composing}
                    onClick={() => {
                      commit(insertRegion(current.current, region.source, index));
                      setAnnouncement("複製しました。");
                    }}
                  >
                    ⧉
                  </button>
                  <button
                    type="button"
                    aria-label="MDXで編集"
                    title="MDXで編集"
                    aria-pressed={raw}
                    disabled={composing}
                    onClick={() => {
                      const next = new Set(sourceRegions);
                      if (raw) next.delete(region.id);
                      else next.add(region.id);
                      setSourceRegions(next);
                    }}
                  >
                    {"{}"}
                  </button>
                  <button
                    type="button"
                    aria-label="ブロックを削除"
                    title="削除"
                    disabled={composing}
                    onClick={() => {
                      commit(deleteRegion(current.current, index));
                      if (selected) setActive(null);
                      setAnnouncement("ブロックを削除しました。元に戻す操作で復元できます。");
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
              <RegionContent
                source={region.source}
                active={selected}
                editing={selected && editing === region.id}
                initialCaret={initialCaret}
                inlineOnly={parentModule === "ArticleEndnote"}
                raw={raw || model.parseError}
                onChange={(source) => commit(updateRegion(current.current, region.id, source))}
                onError={onError}
                onSelection={(quote, start, end) => selectionFor(index, quote, start, end)}
                onActivate={(caret) => {
                  setInitialCaret(caret);
                  setActive(region.id);
                  setEditing(region.id);
                }}
                media={media}
                tools={tools}
                childrenEditor={(children, childOffset, parent, onChildChange) => (
                  <BlockEditor
                    body={children}
                    onChange={onChildChange}
                    onError={onError}
                    onSelection={onSelection}
                    onActiveBlock={onActiveBlock}
                    revealSelection={revealSelection}
                    baseOffset={offset + childOffset}
                    parentModule={parent}
                    media={media}
                    tools={tools}
                  />
                )}
              />
              <button
                type="button"
                className="cms-insert-after"
                aria-label={info.label + "の後に挿入"}
                disabled={composing}
                onClick={() => setPaletteAfter(index)}
              >
                ＋
              </button>
            </article>
          );
        })}
      </div>
      {!model.regions.length && (
        <div className="cms-empty-blocks">
          <p>{parentModule ? "ブロックを追加" : "ここから書き始めましょう。"}</p>
          <button type="button" onClick={() => setPaletteAfter(-1)}>
            ＋{" "}
            {parentModule === "Gallery"
              ? "画像"
              : parentModule === "Steps"
                ? "手順"
                : parentModule === "DiagnosticList"
                  ? "症状"
                  : "ブロック"}
            を追加
          </button>
        </div>
      )}
      {model.regions.length > 0 && (
        <button
          type="button"
          className="cms-append-block"
          disabled={composing}
          onClick={() => setPaletteAfter(model.regions.length - 1)}
        >
          ＋ {parentModule === "Gallery" ? "画像" : parentModule === "Steps" ? "手順" : "ブロック"}
        </button>
      )}
    </section>
  );
}
