import { useState } from "react";
import {
  seriesRegistrySchema,
  type SeriesRecord,
  type SeriesRegistry,
} from "@xpotato/content-contracts/series";
import type { EditorContentRecord } from "@xpotato/editor-core/registry";

export interface SeriesPanelProps {
  contentId?: string;
  registry: SeriesRegistry;
  documents: readonly Pick<EditorContentRecord, "contentId" | "title" | "collection">[];
  onChange: (registry: SeriesRegistry) => void;
  onError?: (message: string) => void;
}
const emptySeries = (): SeriesRecord => {
  const id = "series-" + crypto.randomUUID().slice(0, 8);
  return {
    id,
    slug: id,
    title: "",
    description: "",
    kind: "series",
    status: "ongoing",
    entries: [],
  };
};
const statusLabels = { ongoing: "連載中", completed: "完結", paused: "休載中" };

function SeriesForm({
  initial,
  creating,
  addCurrentArticle,
  onSave,
  onCancel,
}: {
  initial: SeriesRecord;
  creating: boolean;
  addCurrentArticle: boolean;
  onSave: (series: SeriesRecord) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <form
      className="series-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(value);
      }}
    >
      <h3>{creating ? "連載を作成" : "連載情報"}</h3>
      <label>
        連載名
        <input
          autoFocus
          required
          maxLength={200}
          value={value.title}
          onChange={(event) => setValue({ ...value, title: event.target.value })}
        />
      </label>
      <label>
        説明
        <textarea
          rows={3}
          maxLength={2000}
          value={value.description}
          onChange={(event) => setValue({ ...value, description: event.target.value })}
        />
      </label>
      <label>
        種類
        <select
          value={value.kind}
          onChange={(event) =>
            setValue({ ...value, kind: event.target.value as SeriesRecord["kind"] })
          }
        >
          <option value="series">連載</option>
          <option value="course">学習コース</option>
        </select>
      </label>
      <label>
        状態
        <select
          value={value.status}
          onChange={(event) =>
            setValue({ ...value, status: event.target.value as SeriesRecord["status"] })
          }
        >
          {Object.entries(statusLabels).map(([status, label]) => (
            <option key={status} value={status}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {creating && (
        <label>
          URL用の名前
          <input
            required
            maxLength={120}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={value.slug}
            onChange={(event) => setValue({ ...value, slug: event.target.value })}
          />
        </label>
      )}
      <div className="button-row">
        <button type="submit">
          {creating ? (addCurrentArticle ? "作成してこの記事を追加" : "連載を作成") : "更新"}
        </button>
        <button type="button" onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </form>
  );
}

/** The same ordered registry drives the CMS and the site's automatic previous/next links. */
export function SeriesPanel({
  contentId,
  registry,
  documents,
  onChange,
  onError,
}: SeriesPanelProps) {
  const [query, setQuery] = useState("");
  const [articleQuery, setArticleQuery] = useState("");
  const [selectedId, setSelectedId] = useState(
    () =>
      registry.series.find((series) =>
        series.entries.some((entry) => entry.contentId === contentId),
      )?.id ??
      registry.series[0]?.id ??
      "",
  );
  const [form, setForm] = useState<{ value: SeriesRecord; creating: boolean } | null>(null);
  const [error, setError] = useState("");
  const selected = registry.series.find((series) => series.id === selectedId);
  const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("ja");
  const candidates = registry.series.filter((series) =>
    normalize(series.title + " " + series.description).includes(normalize(query)),
  );
  const title = (id: string) =>
    documents.find((item) => item.contentId === id)?.title ??
    (id === contentId ? "この記事" : "未取得の記事");
  const submit = (next: SeriesRegistry) => {
    const checked = seriesRegistrySchema.safeParse(next);
    if (!checked.success) {
      const message = "連載名・URL・記事の重複を確認してください。";
      setError(message);
      onError?.(message);
      return false;
    }
    setError("");
    onChange(checked.data);
    return true;
  };
  const replace = (series: SeriesRecord) =>
    submit({
      ...registry,
      series: registry.series.map((item) => (item.id === series.id ? series : item)),
    });
  const move = (from: number, to: number) => {
    if (!selected || to < 0 || to >= selected.entries.length) return;
    const entries = [...selected.entries],
      [entry] = entries.splice(from, 1);
    entries.splice(to, 0, entry!);
    replace({ ...selected, entries });
  };
  const available = selected
    ? documents.filter(
        (item) =>
          !selected.entries.some((entry) => entry.contentId === item.contentId) &&
          normalize(item.title).includes(normalize(articleQuery)),
      )
    : [];
  return (
    <section className="series-panel" aria-label="連載">
      <p className="small muted">
        並び順から目次と前後の記事へのリンクを自動で作成します。1つの記事を複数の連載に含められます。
      </p>
      <label>
        連載を検索
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="series-choices">
        {candidates.map((series) => (
          <button
            type="button"
            className="series-choice"
            key={series.id}
            aria-pressed={series.id === selectedId}
            onClick={() => {
              setSelectedId(series.id);
              setForm(null);
            }}
          >
            <span>{series.title}</span>
            <span className="small muted">
              {series.kind === "course" ? "学習コース" : "連載"} · {series.entries.length}記事
              {series.entries.some((entry) => entry.contentId === contentId) ? " · 参加中" : ""}
            </span>
          </button>
        ))}
        {!candidates.length && (
          <p className="small muted">
            {query ? "一致する連載はありません。" : "まだ連載はありません。"}
          </p>
        )}
      </div>
      <button type="button" onClick={() => setForm({ value: emptySeries(), creating: true })}>
        ＋ 連載を作成
      </button>
      {form && (
        <SeriesForm
          key={form.value.id}
          initial={form.value}
          creating={form.creating}
          addCurrentArticle={Boolean(contentId)}
          onCancel={() => setForm(null)}
          onSave={(value) => {
            const next = form.creating
              ? { ...value, entries: contentId ? [{ contentId }] : [] }
              : {
                  ...value,
                  entries:
                    registry.series.find((item) => item.id === value.id)?.entries ?? value.entries,
                };
            if (
              submit({
                ...registry,
                series: form.creating
                  ? [...registry.series, next]
                  : registry.series.map((item) => (item.id === value.id ? next : item)),
              })
            ) {
              setSelectedId(value.id);
              setForm(null);
            }
          }}
        />
      )}
      {selected && (
        <div className="series-detail">
          <div className="panel-heading">
            <h3>{selected.title}</h3>
            <button type="button" onClick={() => setForm({ value: selected, creating: false })}>
              連載情報
            </button>
          </div>
          <p className="small muted">{statusLabels[selected.status]}</p>
          {contentId && !selected.entries.some((entry) => entry.contentId === contentId) && (
            <button
              type="button"
              onClick={() =>
                replace({ ...selected, entries: [...selected.entries, { contentId }] })
              }
            >
              この記事を末尾に追加
            </button>
          )}
          <ol className="series-entries">
            {selected.entries.map((entry, index) => (
              <li key={entry.contentId} className={entry.contentId === contentId ? "current" : ""}>
                <div className="series-entry-title">
                  <span className="series-number">{index + 1}</span>
                  <span>
                    {title(entry.contentId)}
                    {entry.contentId === contentId && <small>編集中</small>}
                  </span>
                </div>
                <label className="series-entry-label">
                  <span className="sr-only">{index + 1}番目の表示名</span>
                  <input
                    key={selected.id + ":" + entry.contentId}
                    placeholder="表示名（任意）"
                    defaultValue={entry.label ?? ""}
                    maxLength={120}
                    onBlur={(event) => {
                      const entries = selected.entries.map((item) =>
                        item.contentId === entry.contentId
                          ? {
                              contentId: item.contentId,
                              ...(event.target.value.trim() ? { label: event.target.value } : {}),
                            }
                          : item,
                      );
                      replace({ ...selected, entries });
                    }}
                  />
                </label>
                <div className="series-entry-actions">
                  <button
                    type="button"
                    aria-label={`${title(entry.contentId)}を上へ`}
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`${title(entry.contentId)}を下へ`}
                    disabled={index === selected.entries.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`${title(entry.contentId)}を連載から外す`}
                    onClick={() =>
                      replace({
                        ...selected,
                        entries: selected.entries.filter(
                          (item) => item.contentId !== entry.contentId,
                        ),
                      })
                    }
                  >
                    外す
                  </button>
                </div>
              </li>
            ))}
          </ol>
          {!selected.entries.length && <p className="small muted">記事はあとから追加できます。</p>}
          <details className="series-add-article">
            <summary>{contentId ? "ほかの記事を追加" : "記事を追加"}</summary>
            <label>
              記事名で検索
              <input
                type="search"
                value={articleQuery}
                onChange={(event) => setArticleQuery(event.target.value)}
              />
            </label>
            <div className="series-article-results">
              {available.slice(0, 20).map((item) => (
                <button
                  type="button"
                  key={item.contentId}
                  onClick={() =>
                    replace({
                      ...selected,
                      entries: [...selected.entries, { contentId: item.contentId }],
                    })
                  }
                >
                  ＋ {item.title}
                </button>
              ))}
            </div>
            {!available.length && (
              <p className="small muted">
                候補はありません。Gitから記事一覧を読み込むと、ほかの記事も選べます。
              </p>
            )}
          </details>
          <p className="small muted">未公開の記事はサイトの目次と前後リンクに表示されません。</p>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
