import { useState } from "react";
import type { ContentCollection } from "@xpotato/content-contracts/common";
import { collectionFromPath } from "@xpotato/editor-core/draft";
import type { LocalDraft } from "../../data/storage.js";
import { WorkspaceIcon } from "../../components/WorkspaceIcon.js";
import { parseLocalDraft, type DraftKind } from "../drafts/model.js";
import type { BranchPlan, GitWorkspace } from "../git/useGitWorkspace.js";

export const draftKinds: { id: DraftKind; label: string; description: string }[] = [
  { id: "blog", label: "記事", description: "解説・記録・比較" },
  { id: "notes", label: "メモ", description: "考えや短い記録" },
  { id: "education", label: "教育記事", description: "教材・学習コース" },
  { id: "pages", label: "固定ページ", description: "案内・プロフィール" },
  { id: "tools", label: "ツール", description: "操作画面と使い方" },
  { id: "projects", label: "プロダクト紹介", description: "制作物・製品" },
];

export function initialBranchPlan(authenticated: boolean, draft?: LocalDraft): BranchPlan {
  return {
    mode: authenticated ? (draft?.workingBranch ? "existing" : "new") : "local",
    sourceBranch: draft?.workingBranch || draft?.sourceBranch || "main",
    targetBranch:
      draft?.workingBranch ||
      "content/draft-" +
        new Date().toISOString().slice(0, 10) +
        "-" +
        crypto.randomUUID().slice(0, 6),
  };
}

export function BranchSetup({
  plan,
  onChange,
  branches,
  authenticated,
  disabled,
  pinned,
}: {
  plan: BranchPlan;
  onChange: (plan: BranchPlan) => void;
  branches: string[];
  authenticated: boolean;
  disabled?: boolean;
  pinned?: string | undefined;
}) {
  return (
    <fieldset className="branch-setup" disabled={disabled}>
      <legend>
        <WorkspaceIcon name="branch" />
        作業場所
      </legend>
      <div className="branch-options">
        {(
          [
            ["new", "新しいブランチ"],
            ["existing", "既存のブランチ"],
            ["local", "この端末"],
          ] as const
        ).map(([value, label]) => (
          <label key={value}>
            <input
              type="radio"
              name="branch-mode"
              value={value}
              checked={plan.mode === value}
              disabled={value !== "local" && !authenticated}
              onChange={() =>
                onChange({
                  ...plan,
                  mode: value,
                  ...(value === "existing" && !branches.includes(plan.targetBranch)
                    ? {
                        targetBranch:
                          branches.find((branch) => branch.startsWith("content/")) ?? "",
                      }
                    : {}),
                })
              }
            />
            {label}
          </label>
        ))}
      </div>
      {plan.mode === "new" && (
        <div className="branch-fields">
          <label>
            作成元
            <select
              value={plan.sourceBranch}
              disabled={Boolean(pinned)}
              onChange={(event) => onChange({ ...plan, sourceBranch: event.target.value })}
            >
              {[...new Set([plan.sourceBranch, ...branches])].map((branch) => (
                <option key={branch}>{branch}</option>
              ))}
            </select>
          </label>
          <label>
            作業ブランチ名
            <input
              value={plan.targetBranch}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              onChange={(event) => onChange({ ...plan, targetBranch: event.target.value })}
            />
          </label>
          {pinned && <p className="small muted">{pinned}</p>}
        </div>
      )}
      {plan.mode === "existing" && (
        <label>
          作業ブランチ
          <select
            value={plan.targetBranch}
            onChange={(event) => onChange({ ...plan, targetBranch: event.target.value })}
          >
            <option value="">ブランチを選択</option>
            {[...new Set([plan.targetBranch, ...branches])]
              .filter((branch) => branch.startsWith("content/"))
              .map((branch) => (
                <option key={branch}>{branch}</option>
              ))}
          </select>
        </label>
      )}
      {plan.mode === "local" && (
        <p className="small muted">端末に保存して作業します。Gitへの保存は接続後に選べます。</p>
      )}
      {!authenticated && <a href="#/connection">GitHubへの接続を確認</a>}
    </fieldset>
  );
}

interface Props {
  intent: "new" | "revise" | "drafts";
  git: GitWorkspace;
  saved: LocalDraft[];
  busy: boolean;
  onNew: (kind: DraftKind, plan: BranchPlan) => Promise<void>;
  onLocal: (draft: LocalDraft, plan: BranchPlan, review: boolean) => Promise<void>;
  onRemote: (
    path: string,
    plan: BranchPlan,
    intent: "revise" | "drafts",
    review: boolean,
  ) => Promise<void>;
  onImport: (file: File, collection?: ContentCollection) => Promise<LocalDraft>;
  run: (operation: () => Promise<void>) => void;
}

export function StartWorkspace({
  intent,
  git,
  saved,
  busy,
  onNew,
  onLocal,
  onRemote,
  onImport,
  run,
}: Props) {
  const [kind, setKind] = useState<DraftKind>("blog");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DraftKind | "">("");
  const [archive, setArchive] = useState(false);
  const [selected, setSelected] = useState<
    { local: LocalDraft } | { path: string; title: string } | null
  >(null);
  const [plan, setPlan] = useState(() => initialBranchPlan(git.auth.authenticated));
  const [importKind, setImportKind] = useState<ContentCollection | "">("");
  const [file, setFile] = useState<File>();
  const [review, setReview] = useState(false);
  const normalized = query.normalize("NFKC").toLocaleLowerCase("ja");
  const matches = (value: string) =>
    value.normalize("NFKC").toLocaleLowerCase("ja").includes(normalized);
  const local = saved.filter((item) => {
    const parsed = parseLocalDraft(item.source);
    return (
      Boolean(item.archived) === archive &&
      matches((parsed?.data.title ?? "") + " " + (parsed?.data.description ?? "")) &&
      (!filter ||
        (filter === "education"
          ? Boolean(parsed?.data.education)
          : !parsed?.data.education && collectionFromPath(item.path) === filter))
    );
  });
  const remote = git.documents
    .map((item) => ({
      ...item,
      metadata: git.repositoryManifest.contentIndex?.find((record) => record.path === item.path),
    }))
    .filter((item) => {
      const metadata = item.metadata;
      return (
        (metadata?.draft === undefined || metadata.draft === (intent === "drafts")) &&
        matches(metadata?.title ?? item.path) &&
        (!filter ||
          (filter === "education"
            ? metadata?.education === true
            : metadata?.education !== true && metadata?.collection === filter))
      );
    });
  function selectLocal(item: LocalDraft) {
    setSelected({ local: item });
    setPlan(initialBranchPlan(git.auth.authenticated, item));
    setReview(item.producer === "ai");
  }
  return (
    <div className="start-workspace">
      <header className="workspace-page-heading">
        <h1>
          {intent === "new" ? "新規作成" : intent === "revise" ? "既存記事を改稿" : "下書きの続き"}
        </h1>
      </header>
      <fieldset className="start-controls" disabled={busy}>
        {intent === "new" ? (
          <div className="document-kind-grid" role="group" aria-label="投稿先種別">
            {draftKinds.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={kind === item.id}
                onClick={() => setKind(item.id)}
              >
                <WorkspaceIcon
                  name={
                    item.id === "education" ? "series" : item.id === "tools" ? "code" : "library"
                  }
                />
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="catalog-filter">
              <label>
                <span className="sr-only">原稿を検索</span>
                <input
                  type="search"
                  placeholder="原稿を検索"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <select
                aria-label="種別で絞り込む"
                value={filter}
                onChange={(event) => setFilter(event.target.value as DraftKind | "")}
              >
                <option value="">すべての種別</option>
                {draftKinds.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            {intent === "drafts" && (
              <section aria-label="この端末の下書き">
                <div className="catalog-section-heading">
                  <h2>この端末</h2>
                  <button type="button" aria-pressed={archive} onClick={() => setArchive(!archive)}>
                    アーカイブ
                  </button>
                </div>
                <div className="draft-list">
                  {local.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      aria-pressed={Boolean(
                        selected && "local" in selected && selected.local.id === item.id,
                      )}
                      onClick={() => selectLocal(item)}
                    >
                      <strong>{parseLocalDraft(item.source)?.data.title ?? "構文を編集中"}</strong>
                      <span>
                        {item.producer === "ai" ? "AI下書き · " : ""}
                        {item.workingBranch || "この端末"} ·{" "}
                        {new Date(item.savedAt).toLocaleDateString("ja-JP")}
                      </span>
                    </button>
                  ))}
                  {!local.length && <p className="muted small">該当する下書きはありません。</p>}
                </div>
              </section>
            )}
            <section className="repository-panel" aria-label="Gitの原稿">
              <h2>Gitの原稿</h2>
              <div className="repository-source">
                <label>
                  読み込み元
                  <select
                    value={git.sourceBranch}
                    onChange={(event) => {
                      git.setSourceBranch(event.target.value);
                      setSelected(null);
                    }}
                  >
                    {[...new Set([git.sourceBranch, ...git.branches])].map((branch) => (
                      <option key={branch}>{branch}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!git.auth.authenticated}
                  onClick={() =>
                    run(async () => {
                      await git.readBranch();
                      setSelected(null);
                    })
                  }
                >
                  一覧を取得
                </button>
              </div>
              {!git.auth.authenticated && (
                <p className="small muted">
                  GitHub未接続 · <a href="#/connection">接続を確認</a>
                </p>
              )}
              {git.snapshot?.branch === git.sourceBranch && (
                <div className="draft-list repository-documents">
                  {remote.map((item) => (
                    <button
                      type="button"
                      key={item.path}
                      aria-pressed={Boolean(
                        selected && "path" in selected && selected.path === item.path,
                      )}
                      onClick={() => {
                        setSelected({ path: item.path, title: item.metadata?.title ?? item.path });
                        setPlan({
                          ...initialBranchPlan(git.auth.authenticated),
                          sourceBranch: git.sourceBranch,
                        });
                        setReview(false);
                      }}
                    >
                      <strong>
                        {item.metadata?.title ?? item.path.replace(/^content\//u, "")}
                      </strong>
                      <span>
                        {item.metadata?.draft === undefined
                          ? "公開状態は開く前に確認"
                          : item.metadata.draft
                            ? "下書き"
                            : "公開済み"}
                      </span>
                    </button>
                  ))}
                  {!remote.length && <p className="small muted">該当する原稿はありません。</p>}
                </div>
              )}
            </section>
            {intent === "drafts" && (
              <details className="import-section">
                <summary>MDX・バックアップを取り込む</summary>
                <label>
                  取り込み先
                  <select
                    value={importKind}
                    onChange={(event) =>
                      setImportKind(event.target.value as ContentCollection | "")
                    }
                  >
                    <option value="">ファイルから判断</option>
                    {draftKinds
                      .filter((item) => item.id !== "education")
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  ファイル
                  <input
                    type="file"
                    accept=".md,.mdx,.json"
                    onChange={(event) => setFile(event.target.files?.[0])}
                  />
                </label>
                <button
                  type="button"
                  disabled={!file}
                  onClick={() =>
                    run(async () => {
                      if (file) selectLocal(await onImport(file, importKind || undefined));
                    })
                  }
                >
                  取り込む
                </button>
              </details>
            )}
          </>
        )}
        {(intent === "new" || selected) && (
          <section className="start-selection" aria-label="編集の準備">
            {selected && (
              <h2>
                {"local" in selected
                  ? (parseLocalDraft(selected.local.source)?.data.title ?? "選択した下書き")
                  : selected.title}
              </h2>
            )}
            <BranchSetup
              plan={plan}
              onChange={setPlan}
              branches={git.branches}
              authenticated={git.auth.authenticated}
              pinned={
                selected && "local" in selected && selected.local.baseCommit
                  ? "この下書きの保存元から分岐し、未保存の編集を引き継ぎます。"
                  : selected && "path" in selected
                    ? "選択した一覧の版から分岐します。"
                    : undefined
              }
            />
            {intent === "drafts" && (
              <label className="review-entry">
                <input
                  type="checkbox"
                  checked={review}
                  onChange={(event) => setReview(event.target.checked)}
                />
                添削から開く
              </label>
            )}
            <button
              className="primary start-editing"
              type="button"
              disabled={plan.mode !== "local" && !plan.targetBranch}
              onClick={() =>
                run(async () => {
                  if (intent === "new") await onNew(kind, plan);
                  else if (selected && "local" in selected)
                    await onLocal(selected.local, plan, review);
                  else if (selected && "path" in selected)
                    await onRemote(selected.path, plan, intent, review);
                })
              }
            >
              {intent === "new" ? "作成して編集" : "編集を始める"}
              <WorkspaceIcon name="next" />
            </button>
          </section>
        )}
      </fieldset>
    </div>
  );
}
