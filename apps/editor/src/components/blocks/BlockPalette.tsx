import { useEffect, useMemo, useRef, useState } from "react";
import { blockTemplates, moduleChildKinds } from "@xpotato/editor-core/blocks";
export type BlockKind = keyof typeof blockTemplates;
interface Choice {
  kind: BlockKind;
  label: string;
  description: string;
  group: string;
  icon: string;
}
export const blockChoices: Choice[] = [
  { kind: "paragraph", label: "段落", description: "本文・太字・リンク", group: "文章", icon: "¶" },
  {
    kind: "heading",
    label: "見出し",
    description: "文章に区切りを作る",
    group: "文章",
    icon: "H₂",
  },
  { kind: "list", label: "箇条書き", description: "順番のない項目", group: "文章", icon: "• ≡" },
  {
    kind: "orderedList",
    label: "番号付きリスト",
    description: "順番のある項目",
    group: "文章",
    icon: "1. ≡",
  },
  { kind: "quote", label: "引用", description: "引用文と出典", group: "文章", icon: "❝" },
  { kind: "divider", label: "区切り", description: "話題の切り替わり", group: "文章", icon: "―" },
  {
    kind: "Figure",
    label: "画像・図",
    description: "画像、説明、出典",
    group: "図表・コード",
    icon: "▧",
  },
  {
    kind: "Gallery",
    label: "ギャラリー",
    description: "画像をグリッドに配置",
    group: "図表・コード",
    icon: "▦",
  },
  { kind: "table", label: "表", description: "行と列で比較", group: "図表・コード", icon: "▤" },
  {
    kind: "BarChart",
    label: "棒グラフ",
    description: "項目と値を入力",
    group: "図表・コード",
    icon: "▥",
  },
  {
    kind: "code",
    label: "コード",
    description: "言語とソースを指定",
    group: "図表・コード",
    icon: "</>",
  },
  { kind: "math", label: "数式", description: "TeXを数式に表示", group: "図表・コード", icon: "∑" },
  {
    kind: "Callout",
    label: "補足・注意",
    description: "要点を目立たせる",
    group: "構成",
    icon: "ⓘ",
  },
  { kind: "Steps", label: "手順", description: "複数の手順をまとめる", group: "構成", icon: "① ②" },
  { kind: "Step", label: "手順を追加", description: "操作と結果", group: "構成", icon: "①" },
  { kind: "Comparison", label: "比較", description: "2つの条件を比較", group: "構成", icon: "▯ ▯" },
  {
    kind: "Details",
    label: "折りたたみ",
    description: "必要な時に開く説明",
    group: "構成",
    icon: "▸ ≡",
  },
  {
    kind: "LinkCard",
    label: "リンクカード",
    description: "リンク先を独立して紹介",
    group: "構成",
    icon: "↗",
  },
  {
    kind: "DiagnosticList",
    label: "症状と対処",
    description: "確認事項と対処を整理",
    group: "構成",
    icon: "☑",
  },
  {
    kind: "DiagnosticItem",
    label: "症状を追加",
    description: "症状・確認・対処",
    group: "構成",
    icon: "☑",
  },
  {
    kind: "ArticleEndnote",
    label: "エンドノート",
    description: "検証条件や補記",
    group: "構成",
    icon: "※",
  },
  {
    kind: "Demo",
    label: "ブラウザツール",
    description: "登録済みツールを配置",
    group: "構成",
    icon: "▷",
  },
];
export function allowedBlockKinds(parent?: string): BlockKind[] {
  if (parent && Object.hasOwn(moduleChildKinds, parent)) {
    return moduleChildKinds[parent]!.filter((kind): kind is BlockKind => kind in blockTemplates);
  }
  return blockChoices
    .filter(
      (item) =>
        !["Step", "DiagnosticItem"].includes(item.kind) &&
        (!parent || item.kind !== "ArticleEndnote"),
    )
    .map((item) => item.kind);
}
export function BlockPalette({
  allowed,
  onInsert,
  onClose,
  modal = false,
}: {
  allowed: BlockKind[];
  onInsert: (kind: BlockKind) => void;
  onClose: () => void;
  modal?: boolean;
}) {
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const palette = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Desktop keeps its inline palette in view. Mobile uses a viewport-anchored dialog.
    if (!modal) palette.current?.scrollIntoView({ block: "nearest" });
    search.current?.focus({ preventScroll: true });
  }, [modal]);
  const choices = useMemo(
    () =>
      blockChoices.filter(
        (item) =>
          allowed.includes(item.kind) &&
          (item.label + item.description + item.kind)
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()),
      ),
    [query, allowed],
  );
  return (
    <div
      className="cms-insert-palette"
      ref={palette}
      role="dialog"
      aria-modal={modal || undefined}
      aria-label="ブロックを挿入"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="cms-palette-header">
        <input
          type="search"
          ref={search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ブロックを検索"
          aria-label="ブロックを検索"
        />
        <button type="button" aria-label="挿入メニューを閉じる" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="cms-palette-scroll">
        {["文章", "図表・コード", "構成"].map((group) => {
          const items = choices.filter((item) => item.group === group);
          return items.length ? (
            <section key={group}>
              <h3>{group}</h3>
              <div className="cms-palette-grid">
                {items.map((item) => (
                  <button
                    type="button"
                    className="cms-palette-choice"
                    key={item.kind}
                    onClick={() => onInsert(item.kind)}
                  >
                    <span
                      className={"cms-palette-visual cms-palette-" + item.kind}
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null;
        })}
        {!choices.length && <p className="cms-empty-hint">該当するブロックがありません。</p>}
      </div>
    </div>
  );
}
