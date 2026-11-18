import { useMemo, useState } from "react";
import type { EducationMetadata } from "@xpotato/content-contracts/content";
import {
  collectionFromPath,
  type DraftMetadata,
  type ParsedDraft,
  type TaxonomySnapshot,
} from "@xpotato/editor-core/draft";
import {
  applyTaxonomyAdditions,
  parseTaxonomyAddition,
  type EditorRegistryChanges,
  type TagKind,
  type TaxonomyAddition,
  type TaxonomyNamespace,
} from "@xpotato/editor-core/registry";
import type { LocalDraft } from "../data/storage.js";

export interface MetadataPanelProps {
  draft: LocalDraft;
  parsed: ParsedDraft | null;
  taxonomy: TaxonomySnapshot;
  onMetadata: (fields: Partial<DraftMetadata>) => void;
  onDraft?: (fields: Partial<LocalDraft>) => void;
  onRegistryChange?: (changes: EditorRegistryChanges) => void;
  onError: (message: string) => void;
}
const collectionLabels = {
  blog: "記事",
  notes: "メモ",
  projects: "プロダクト紹介",
  tools: "ツール",
  pages: "固定ページ",
};
const kindLabels: Record<TagKind, string> = { purpose: "目的", technology: "技術", topic: "話題" };
type Term = {
  id: string;
  label: string;
  description?: string | undefined;
  aliases?: string[] | undefined;
  kind?: TagKind | undefined;
};
const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("ja").trim();
const matches = (term: Term, query: string) =>
  !query ||
  [term.id, term.label, term.description ?? "", ...(term.aliases ?? [])].some((text) =>
    normalize(text).includes(normalize(query)),
  );

function Terms({
  label,
  terms,
  selected,
  multiple,
  onChange,
  onCreate,
}: {
  label: string;
  terms: Term[];
  selected: string[];
  multiple?: boolean;
  onChange: (ids: string[]) => void;
  onCreate?: () => void;
}) {
  const [query, setQuery] = useState("");
  const results = terms.filter((term) => matches(term, query));
  const shown = results.slice(0, query ? 50 : 12);
  return (
    <fieldset className="metadata-terms">
      <legend>{label}</legend>
      <div className="selected-terms">
        {selected.map((id) => (
          <button
            type="button"
            className="term-chip selected"
            key={id}
            aria-label={
              multiple ? `${terms.find((term) => term.id === id)?.label ?? id}を外す` : undefined
            }
            disabled={!multiple}
            onClick={() => onChange(selected.filter((value) => value !== id))}
          >
            {terms.find((term) => term.id === id)?.label ?? id}
            {multiple && <span aria-hidden="true"> ×</span>}
          </button>
        ))}
      </div>
      <input
        type="search"
        aria-label={label + "を検索"}
        placeholder={label + "を検索"}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="term-options" aria-label={label + "の候補"}>
        {shown.map((term) => (
          <button
            type="button"
            key={term.id}
            className="term-chip"
            title={term.description}
            aria-pressed={selected.includes(term.id)}
            onClick={() =>
              onChange(
                multiple
                  ? selected.includes(term.id)
                    ? selected.filter((id) => id !== term.id)
                    : [...selected, term.id]
                  : [term.id],
              )
            }
          >
            {term.label}
          </button>
        ))}
        {!results.length && <span className="small muted">一致する候補はありません</span>}
      </div>
      {results.length > shown.length && (
        <p className="small muted">ほか{results.length - shown.length}件。検索で絞り込めます。</p>
      )}
      {onCreate && (
        <button type="button" className="text-button" onClick={onCreate}>
          ＋ {label}を追加
        </button>
      )}
    </fieldset>
  );
}

function NewTerm({
  namespace,
  kind,
  onAdd,
  onClose,
}: {
  namespace: TaxonomyNamespace;
  kind?: TagKind;
  onAdd: (addition: TaxonomyAddition) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [id, setId] = useState(
    () => (namespace === "tags" ? "tag-" : "category-") + crypto.randomUUID().slice(0, 8),
  );
  const [description, setDescription] = useState("");
  const [aliases, setAliases] = useState("");
  const [selectedKind, setSelectedKind] = useState<TagKind>(kind ?? "topic");
  const [idEdited, setIdEdited] = useState(false);
  return (
    <form
      className="metadata-create"
      onSubmit={(event) => {
        event.preventDefault();
        onAdd({
          namespace,
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
          ...(namespace === "tags" ? { kind: selectedKind } : {}),
        });
      }}
    >
      <h3>{namespace === "tags" ? "タグ" : "分類"}を追加</h3>
      <label>
        名前
        <input
          autoFocus
          required
          maxLength={120}
          value={label}
          onChange={(event) => {
            setLabel(event.target.value);
            const proposed = event.target.value
              .normalize("NFKC")
              .toLowerCase()
              .replace(/[^a-z0-9]+/gu, "-")
              .replace(/^-|-$/gu, "");
            if (!idEdited && proposed) setId(proposed);
          }}
        />
      </label>
      {namespace === "tags" && (
        <label>
          種類
          <select
            value={selectedKind}
            onChange={(event) => setSelectedKind(event.target.value as TagKind)}
          >
            {Object.entries(kindLabels).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        説明
        <textarea
          rows={2}
          maxLength={1000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <details>
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
      <div className="button-row">
        <button type="submit">追加して選択</button>
        <button type="button" onClick={onClose}>
          キャンセル
        </button>
      </div>
    </form>
  );
}

export function MetadataPanel({
  draft,
  parsed,
  taxonomy,
  onMetadata,
  onDraft,
  onRegistryChange,
  onError,
}: MetadataPanelProps) {
  const [creating, setCreating] = useState<{ namespace: TaxonomyNamespace; kind?: TagKind } | null>(
    null,
  );
  const collection = collectionFromPath(draft.path);
  const data = parsed?.data;
  const tags = useMemo<Term[]>(
    () =>
      taxonomy.terms
        ? taxonomy.terms.tags.filter((term) => term.status === "active")
        : taxonomy.tags.map((id) => ({ id, label: taxonomy.labels?.[id] ?? id, kind: "topic" })),
    [taxonomy],
  );
  const namespace =
    collection === "blog"
      ? "blogCategories"
      : collection === "notes"
        ? "noteSubjects"
        : collection === "tools"
          ? "toolCategories"
          : null;
  const categories: Term[] =
    namespace && taxonomy.terms
      ? taxonomy.terms[namespace].filter((term) => term.status === "active")
      : (taxonomy.categories[collection] ?? []).map((id) => ({
          id,
          label: taxonomy.labels?.[id] ?? id,
        }));
  const education = data?.education as EducationMetadata | undefined;
  const setEducation = (fields: Partial<EducationMetadata>) =>
    onMetadata({ education: { subject: education?.subject ?? "", ...education, ...fields } });
  const setTags = (kind: TagKind, ids: string[]) =>
    onMetadata({
      tags: [
        ...(data?.tags ?? []).filter((id) => tags.find((term) => term.id === id)?.kind !== kind),
        ...ids,
      ],
    });
  const optional = (value: string) => value.trim() || undefined;
  if (!data) return <p>記事情報を読み取れません。MDXの先頭を確認してください。</p>;
  return (
    <section className="metadata-panel" aria-label="記事情報">
      <p className="metadata-type">{collectionLabels[collection]}</p>
      <label>
        概要
        <textarea
          rows={3}
          value={data.description ?? ""}
          onChange={(event) => onMetadata({ description: event.target.value })}
        />
      </label>
      {namespace && (
        <Terms
          label={collection === "notes" ? "主題" : "主分類"}
          terms={categories}
          selected={
            (collection === "notes" ? data.subject : data.category)
              ? [String(collection === "notes" ? data.subject : data.category)]
              : []
          }
          onChange={(ids) =>
            onMetadata(collection === "notes" ? { subject: ids[0] } : { category: ids[0] })
          }
          {...(onRegistryChange && taxonomy.terms
            ? { onCreate: () => setCreating({ namespace }) }
            : {})}
        />
      )}
      {collection !== "pages" &&
        (["purpose", "technology", "topic"] as const).map((kind) => (
          <Terms
            key={kind}
            label={kindLabels[kind] + "タグ"}
            terms={tags.filter((term) => term.kind === kind)}
            selected={(data.tags ?? []).filter(
              (id) => tags.find((term) => term.id === id)?.kind === kind,
            )}
            multiple
            onChange={(ids) => setTags(kind, ids)}
            {...(onRegistryChange && taxonomy.terms
              ? { onCreate: () => setCreating({ namespace: "tags", kind }) }
              : {})}
          />
        ))}
      {creating && (
        <NewTerm
          key={creating.namespace + creating.kind}
          {...creating}
          onClose={() => setCreating(null)}
          onAdd={(raw) => {
            try {
              const addition = parseTaxonomyAddition(raw);
              if (!taxonomy.terms || !onRegistryChange) return;
              applyTaxonomyAdditions(taxonomy.terms, [addition]);
              onRegistryChange({ taxonomy: [addition] });
              if (addition.namespace === "tags")
                onMetadata({ tags: [...new Set([...(data.tags ?? []), addition.id])] });
              else
                onMetadata(
                  addition.namespace === "noteSubjects"
                    ? { subject: addition.id }
                    : { category: addition.id },
                );
              setCreating(null);
            } catch (error) {
              onError(error instanceof Error ? error.message : "追加できませんでした");
            }
          }}
        />
      )}
      {(collection === "blog" || collection === "notes") && (
        <fieldset className="metadata-section">
          <legend>教育記事</legend>
          <label className="check-label">
            <input
              type="checkbox"
              checked={Boolean(education)}
              onChange={(event) =>
                onMetadata({ education: event.target.checked ? { subject: "" } : undefined })
              }
            />
            教材としてまとめる
          </label>
          {education && (
            <>
              <label>
                学ぶ主題
                <input
                  value={education.subject}
                  onChange={(event) => setEducation({ subject: event.target.value })}
                />
              </label>
              <label>
                対象読者
                <input
                  value={education.audience ?? ""}
                  onChange={(event) => setEducation({ audience: optional(event.target.value) })}
                />
              </label>
              <label>
                前提知識
                <textarea
                  rows={2}
                  value={education.prerequisites ?? ""}
                  onChange={(event) =>
                    setEducation({ prerequisites: optional(event.target.value) })
                  }
                />
              </label>
              <label>
                学習目標
                <textarea
                  rows={3}
                  placeholder="1行に1つ"
                  value={(education.goals ?? []).join("\n")}
                  onChange={(event) => setEducation({ goals: event.target.value.split("\n") })}
                  onBlur={(event) =>
                    setEducation({
                      goals: event.target.value
                        .split("\n")
                        .map((goal) => goal.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
            </>
          )}
        </fieldset>
      )}
      {collection === "projects" && (
        <fieldset className="metadata-section">
          <legend>プロダクト</legend>
          <label>
            状態
            <select
              value={String(data.status ?? "planned")}
              onChange={(event) => onMetadata({ status: event.target.value })}
            >
              {Object.entries({
                planned: "計画中",
                active: "開発中",
                paused: "休止中",
                completed: "完成",
                archived: "終了",
              }).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Terms
            label="使用技術"
            terms={tags.filter((term) => term.kind === "technology")}
            selected={Array.isArray(data.stack) ? (data.stack as string[]) : []}
            multiple
            onChange={(stack) => onMetadata({ stack })}
          />
          <label>
            ソースの公開範囲
            <select
              value={String(data.sourceAvailability ?? "")}
              onChange={(event) => onMetadata({ sourceAvailability: optional(event.target.value) })}
            >
              <option value="">未設定</option>
              <option value="public">公開</option>
              <option value="private">非公開</option>
              <option value="mixed">一部公開</option>
              <option value="not_applicable">該当なし</option>
            </select>
          </label>
          {(["repository", "demo", "documentation"] as const).map((field) => (
            <label key={field}>
              {{ repository: "リポジトリ", demo: "デモ", documentation: "ドキュメント" }[field]}
              <input
                type="url"
                placeholder="https://"
                value={String((data.links as Record<string, string> | undefined)?.[field] ?? "")}
                onChange={(event) => {
                  const links = { ...(data.links as Record<string, string> | undefined) };
                  if (event.target.value) links[field] = event.target.value;
                  else delete links[field];
                  onMetadata({ links: Object.keys(links).length ? links : undefined });
                }}
              />
            </label>
          ))}
          {(["startedDate", "completedDate"] as const).map((field) => (
            <label key={field}>
              {field === "startedDate" ? "開始日" : "完成日"}
              <input
                type="date"
                value={String(data[field] ?? "")}
                onChange={(event) => onMetadata({ [field]: optional(event.target.value) })}
              />
            </label>
          ))}
        </fieldset>
      )}
      {(["blog", "projects", "tools"] as const).some((value) => value === collection) && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={data.featured === true}
            onChange={(event) =>
              onMetadata({
                featured: event.target.checked,
                ...(!event.target.checked ? { featuredOrder: undefined } : {}),
              })
            }
          />
          注目コンテンツにする
        </label>
      )}
      {collection === "projects" && data.featured === true && (
        <label>
          表示順
          <input
            type="number"
            min={0}
            step={1}
            value={typeof data.featuredOrder === "number" ? data.featuredOrder : ""}
            onChange={(event) =>
              onMetadata({
                featuredOrder: event.target.value === "" ? undefined : Number(event.target.value),
              })
            }
          />
        </label>
      )}
      <details className="metadata-section">
        <summary>日付・検索表示</summary>
        {collection !== "pages" && (
          <label>
            公開日
            <input
              type="date"
              value={data.pubDate ?? ""}
              onChange={(event) => onMetadata({ pubDate: optional(event.target.value) })}
            />
          </label>
        )}
        <label>
          更新日
          <input
            type="date"
            value={data.updatedDate ?? ""}
            onChange={(event) => onMetadata({ updatedDate: optional(event.target.value) })}
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={(data.seo as { noindex?: boolean } | undefined)?.noindex === true}
            onChange={(event) =>
              onMetadata({
                seo: { ...(data.seo as object | undefined), noindex: event.target.checked },
              })
            }
          />
          検索対象から除く
        </label>
      </details>
      {onDraft && (
        <label>
          執筆者
          <select
            value={draft.producer}
            onChange={(event) =>
              onDraft({ producer: event.target.value as LocalDraft["producer"] })
            }
          >
            <option value="human">本人</option>
            <option value="ai">AI</option>
            <option value="mixed">本人とAI</option>
          </select>
        </label>
      )}
    </section>
  );
}
