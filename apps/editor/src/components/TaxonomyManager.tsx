import { useMemo, useState } from "react";
import type { TaxonomyRegistry } from "@xpotato/content-contracts/content";
import type { TaxonomySnapshot } from "@xpotato/editor-core/draft";
import {
  applyTaxonomyAdditions,
  parseTaxonomyAddition,
  type EditorRegistryChanges,
  type TagKind,
  type TaxonomyAddition,
  type TaxonomyNamespace,
} from "@xpotato/editor-core/registry";
import "./registry-management.css";

export interface TaxonomyManagerProps {
  taxonomy: TaxonomySnapshot;
  pendingAdditions?: readonly TaxonomyAddition[];
  onChange: (changes: EditorRegistryChanges) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

const groups = [
  { id: "purpose", label: "目的タグ", namespace: "tags", kind: "purpose" },
  { id: "technology", label: "技術タグ", namespace: "tags", kind: "technology" },
  { id: "topic", label: "話題タグ", namespace: "tags", kind: "topic" },
  { id: "blogCategories", label: "記事の分類", namespace: "blogCategories" },
  { id: "noteSubjects", label: "メモの主題", namespace: "noteSubjects" },
  { id: "toolCategories", label: "ツールの分類", namespace: "toolCategories" },
] as const;
type GroupId = (typeof groups)[number]["id"];
type RegistryTerm = {
  namespace: TaxonomyNamespace;
  id: string;
  label: string;
  description?: string | undefined;
  aliases: string[];
  kind?: TagKind | undefined;
  status: "active" | "retired";
};
const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("ja").trim();
const keyOf = (term: Pick<RegistryTerm, "namespace" | "id">) => term.namespace + ":" + term.id;
const groupOf = (term: RegistryTerm) => (term.namespace === "tags" ? term.kind : term.namespace);
const groupLabel = (term: RegistryTerm) =>
  groups.find((group) => group.id === groupOf(term))?.label ?? "タグ";

function additionError(failure: unknown): string {
  const message = failure instanceof Error ? failure.message : "";
  if (message.startsWith("TAXONOMY_ID_EXISTS")) {
    return "URL用の名前が既に使われています。別の名前にしてください。";
  }
  if (message.startsWith("TAXONOMY_TERM_EXISTS")) {
    return "同じ名前か別名の項目が既にあります。既存の項目を検索してください。";
  }
  if (message === "TAXONOMY_ALIAS_DUPLICATE") {
    return "名前と別名が重複しています。別名を確認してください。";
  }
  return "名前・別名・URL用の名前を確認してください。";
}

function NewTaxonomyForm({
  initialGroup,
  registry,
  onAdd,
  onCancel,
  onError,
  disabled,
}: {
  initialGroup: GroupId;
  registry: TaxonomyRegistry;
  onAdd: (addition: TaxonomyAddition, group: GroupId) => void;
  onCancel: () => void;
  onError?: (message: string) => void;
  disabled: boolean;
}) {
  const [groupId, setGroupId] = useState(initialGroup);
  const [label, setLabel] = useState("");
  const [id, setId] = useState(() => "term-" + crypto.randomUUID().slice(0, 8));
  const [idEdited, setIdEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [aliases, setAliases] = useState("");
  const [error, setError] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const group = groups.find((item) => item.id === groupId)!;
  return (
    <form
      className="taxonomy-create"
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled) return;
        try {
          const addition = parseTaxonomyAddition({
            namespace: group.namespace,
            id,
            label,
            ...(description.trim() ? { description } : {}),
            ...(aliases.trim()
              ? {
                  aliases: aliases
                    .split(/[、,\n]/u)
                    .map((value) => value.trim())
                    .filter(Boolean),
                }
              : {}),
            ...("kind" in group ? { kind: group.kind } : {}),
          });
          applyTaxonomyAdditions(registry, [addition]);
          onAdd(addition, groupId);
        } catch (failure) {
          const message = additionError(failure);
          setError(message);
          setAdvanced(true);
          onError?.(message);
        }
      }}
    >
      <h3>新しい項目</h3>
      <fieldset disabled={disabled}>
        <label>
          種類
          <select value={groupId} onChange={(event) => setGroupId(event.target.value as GroupId)}>
            {groups.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          名前
          <input
            autoFocus
            required
            maxLength={120}
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
              const proposed = normalize(event.target.value)
                .replace(/[^a-z0-9]+/gu, "-")
                .replace(/^-|-$/gu, "");
              if (!idEdited && proposed) setId(proposed);
            }}
          />
        </label>
        <label>
          説明（任意）
          <textarea
            rows={2}
            maxLength={1000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <details open={advanced} onToggle={(event) => setAdvanced(event.currentTarget.open)}>
          <summary>別名・URL用の名前</summary>
          <label>
            検索用の別名
            <input
              value={aliases}
              placeholder="カンマ区切り"
              onChange={(event) => setAliases(event.target.value)}
            />
          </label>
          <label>
            URL用の名前
            <input
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              maxLength={120}
              value={id}
              onChange={(event) => {
                setIdEdited(true);
                setId(event.target.value);
              }}
            />
          </label>
        </details>
        {error && <p role="alert">{error}</p>}
        <div className="button-row">
          <button type="submit" className="primary">
            追加
          </button>
          <button type="button" onClick={onCancel}>
            キャンセル
          </button>
        </div>
      </fieldset>
    </form>
  );
}

export function TaxonomyManager({
  taxonomy,
  pendingAdditions = [],
  onChange,
  onError,
  disabled = false,
}: TaxonomyManagerProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<GroupId | "all">("all");
  const [includeRetired, setIncludeRetired] = useState(false);
  const [creating, setCreating] = useState<GroupId | null>(null);
  const [limit, setLimit] = useState(40);
  const pending = useMemo(() => new Set(pendingAdditions.map(keyOf)), [pendingAdditions]);
  const terms = useMemo<RegistryTerm[]>(() => {
    if (taxonomy.terms) {
      return (["blogCategories", "noteSubjects", "toolCategories", "tags"] as const).flatMap(
        (namespace) => taxonomy.terms![namespace].map((term) => ({ ...term, namespace })),
      );
    }
    return [
      ...(
        [
          ["blog", "blogCategories"],
          ["notes", "noteSubjects"],
          ["tools", "toolCategories"],
        ] as const
      ).flatMap(([collection, namespace]) =>
        (taxonomy.categories[collection] ?? []).map((id) => ({
          namespace,
          id,
          label: taxonomy.labels?.[id] ?? id,
          aliases: [],
          status: "active" as const,
        })),
      ),
      ...taxonomy.tags.map((id) => ({
        namespace: "tags" as const,
        id,
        label: taxonomy.labels?.[id] ?? id,
        aliases: [],
        status: "active" as const,
      })),
    ];
  }, [taxonomy]);
  const results = terms
    .filter(
      (term) =>
        (includeRetired || term.status === "active") &&
        (filter === "all" || groupOf(term) === filter) &&
        [term.id, term.label, term.description ?? "", ...term.aliases].some((value) =>
          normalize(value).includes(normalize(query)),
        ),
    )
    .sort(
      (a, b) =>
        Number(pending.has(keyOf(b))) - Number(pending.has(keyOf(a))) ||
        a.label.localeCompare(b.label, "ja"),
    );
  return (
    <section className="taxonomy-manager" aria-label="タグ・分類">
      <div className="taxonomy-manager-tools">
        <label>
          タグ・分類を検索
          <input
            type="search"
            placeholder="名前・別名で検索"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(40);
            }}
          />
        </label>
        <label>
          種類で絞り込む
          <select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value as GroupId | "all");
              setLimit(40);
            }}
          >
            <option value="all">すべて</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="taxonomy-manager-actions">
        <button
          type="button"
          disabled={disabled || !taxonomy.terms}
          onClick={() => setCreating(filter === "all" ? "topic" : filter)}
        >
          ＋ 新規追加
        </button>
        <label className="check-label">
          <input
            type="checkbox"
            checked={includeRetired}
            onChange={(event) => setIncludeRetired(event.target.checked)}
          />
          廃止済みも表示
        </label>
      </div>
      {!taxonomy.terms && (
        <p className="small muted">分類の詳細を取得すると、新しい項目を追加できます。</p>
      )}
      {creating && taxonomy.terms && (
        <NewTaxonomyForm
          initialGroup={creating}
          registry={taxonomy.terms}
          disabled={disabled}
          {...(onError ? { onError } : {})}
          onCancel={() => setCreating(null)}
          onAdd={(addition, group) => {
            onChange({ taxonomy: [addition] });
            setFilter(group);
            setQuery("");
            setCreating(null);
            setLimit(40);
          }}
        />
      )}
      <p className="small muted" aria-live="polite">
        {results.length}件
      </p>
      <ul className="taxonomy-records">
        {results.slice(0, limit).map((term) => (
          <li key={keyOf(term)} className="taxonomy-record">
            <div className="taxonomy-record-heading">
              <strong>{term.label}</strong>
              <span>
                {pending.has(keyOf(term))
                  ? "未保存"
                  : term.status === "retired"
                    ? "廃止済み"
                    : groupLabel(term)}
              </span>
            </div>
            {term.description && term.description !== term.label && <p>{term.description}</p>}
            {!!term.aliases.length && (
              <p className="small muted">別名：{term.aliases.join("、")}</p>
            )}
            <small className="muted">{term.id}</small>
          </li>
        ))}
      </ul>
      {!results.length && <p className="muted">一致する項目はありません。</p>}
      {results.length > limit && (
        <button type="button" onClick={() => setLimit((value) => value + 40)}>
          さらに表示
        </button>
      )}
    </section>
  );
}
