import { useState } from "react";
import type { ContentCollection } from "@xpotato/content-contracts/common";
import { collectionFromPath } from "@xpotato/editor-core/draft";
import type { LocalDraft } from "../data/storage.js";
import type { GitWorkspace } from "../features/git/useGitWorkspace.js";
import { parseLocalDraft, type DraftKind } from "../features/drafts/model.js";
const kinds: { id: DraftKind; label: string; description: string; icon: string }[] = [
  { id: "blog", label: "記事", description: "解説・記録・比較", icon: "▤" },
  { id: "notes", label: "メモ", description: "考えや短い記録", icon: "▱" },
  { id: "education", label: "教育記事", description: "教材・学習コース", icon: "▧" },
  { id: "pages", label: "固定ページ", description: "案内・プロフィール", icon: "□" },
  { id: "tools", label: "ツール", description: "操作画面と使い方", icon: "⌘" },
  { id: "projects", label: "プロダクト", description: "制作物・製品の紹介", icon: "◇" },
];
interface Props {
  busy: boolean;
  saved: LocalDraft[];
  draftId: string;
  git: Pick<
    GitWorkspace,
    "auth" | "branches" | "sourceBranch" | "setSourceBranch" | "snapshot" | "documents" | "taxonomy"
  >;
  onNew: (kind: DraftKind) => void;
  onSelect: (draft: LocalDraft) => void;
  onReadBranch: () => void;
  onOpenDocument: (path: string) => void;
  onImport: (file: File | undefined, collection?: ContentCollection) => void;
}
export function DraftSidebar({
  busy,
  saved,
  draftId,
  git,
  onNew,
  onSelect,
  onReadBranch,
  onOpenDocument,
  onImport,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<DraftKind | "">("");
  const [archive, setArchive] = useState(false);
  const [importKind, setImportKind] = useState<ContentCollection | "">("");
  const [importFile, setImportFile] = useState<File>();
  const match = (value: string) =>
    value
      .normalize("NFKC")
      .toLocaleLowerCase("ja")
      .includes(query.normalize("NFKC").toLocaleLowerCase("ja"));
  const local = saved.filter((item) => {
    const parsed = parseLocalDraft(item.source);
    return (
      Boolean(item.archived) === archive &&
      match((parsed?.data.title ?? "") + " " + (parsed?.data.description ?? "")) &&
      (!kind ||
        (kind === "education"
          ? Boolean(parsed?.data.education)
          : collectionFromPath(item.path) === kind))
    );
  });
  const documents = git.documents
    .map((file) => ({
      ...file,
      metadata: git.taxonomy.contentIndex?.find((item) => item.path === file.path),
    }))
    .filter(
      (file) =>
        match(file.metadata?.title ?? file.path) &&
        (!kind || kind === "education" || file.metadata?.collection === kind),
    );
  return (
    <section className="draft-sidebar" aria-label="原稿一覧">
      <button
        type="button"
        className="primary new-draft"
        onClick={() => setCreating(!creating)}
        aria-expanded={creating}
      >
        ＋ 新規作成
      </button>
      {creating && (
        <div className="new-document-kinds">
          {kinds.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => {
                onNew(item.id);
                setCreating(false);
              }}
            >
              <span className="kind-icon" aria-hidden="true">
                {item.icon}
              </span>
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </div>
      )}
      <label className="sr-only" htmlFor="draft-search">
        原稿を検索
      </label>
      <input
        id="draft-search"
        type="search"
        value={query}
        placeholder="原稿を検索"
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="library-filters">
        <select
          aria-label="種別で絞り込む"
          value={kind}
          onChange={(event) => setKind(event.target.value as DraftKind | "")}
        >
          <option value="">すべての種別</option>
          {kinds.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <button type="button" aria-pressed={archive} onClick={() => setArchive(!archive)}>
          アーカイブ
        </button>
      </div>
      <h2>この端末</h2>
      <div className="draft-list">
        {local.map((item) => (
          <button
            type="button"
            key={item.id}
            className={item.id === draftId ? "selected" : ""}
            onClick={() => onSelect(item)}
          >
            <strong>{parseLocalDraft(item.source)?.data.title ?? "構文を編集中"}</strong>
            <span>
              {item.syncedSource === item.source && !item.pendingRegistryChanges
                ? "Git保存済み"
                : "端末に保存"}{" "}
              · {new Date(item.savedAt).toLocaleDateString("ja-JP")}
            </span>
          </button>
        ))}
        {!local.length && <p className="small muted">該当する原稿はありません。</p>}
      </div>
      <section className="repository-panel">
        <h2>Gitの原稿</h2>
        <label>
          読み込み元
          <select
            value={git.sourceBranch}
            onChange={(event) => git.setSourceBranch(event.target.value)}
          >
            {[...new Set([git.sourceBranch, ...git.branches])].map((branch) => (
              <option value={branch} key={branch}>
                {branch}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={!git.auth.authenticated || busy} onClick={onReadBranch}>
          一覧を取得
        </button>
        <div className="repository-documents">
          {documents.map((file) => (
            <button type="button" key={file.path} onClick={() => onOpenDocument(file.path)}>
              {file.metadata?.title ?? file.path.replace(/^content\//u, "")}
            </button>
          ))}
        </div>
      </section>
      <details className="import-section">
        <summary>取り込む</summary>
        <label>
          取り込み先
          <select
            value={importKind}
            onChange={(event) => setImportKind(event.target.value as ContentCollection | "")}
          >
            <option value="">ファイルから判断</option>
            {kinds
              .filter((item) => item.id !== "education")
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
          </select>
        </label>
        <label>
          MDX・バックアップ
          <input
            type="file"
            accept=".md,.mdx,.json"
            onChange={(event) => setImportFile(event.target.files?.[0])}
          />
        </label>
        <button
          type="button"
          disabled={!importFile || busy}
          onClick={() => onImport(importFile, importKind || undefined)}
        >
          選択したファイルを取り込む
        </button>
      </details>
    </section>
  );
}
