import type { LocalDraft } from "../data/storage.js";
import type { GitWorkspace } from "../features/git/useGitWorkspace.js";
import { parseLocalDraft } from "../features/drafts/model.js";

interface Props {
  open: boolean;
  busy: boolean;
  saved: LocalDraft[];
  draftId: string;
  git: Pick<
    GitWorkspace,
    "auth" | "branches" | "sourceBranch" | "setSourceBranch" | "snapshot" | "documents"
  >;
  onNew: () => void;
  onSelect: (draft: LocalDraft) => void;
  onReadBranch: () => void;
  onOpenDocument: (path: string) => void;
  onImport: (file: File | undefined) => void;
}

export function DraftSidebar({
  open,
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
  return (
    <aside className={"draft-sidebar " + (open ? "is-open" : "")} aria-label="下書きとブランチ">
      <button type="button" className="primary new-draft" onClick={onNew}>
        ＋ 新しい記事
      </button>
      <h2>この端末の下書き</h2>
      <div className="draft-list">
        {saved.map((item) => (
          <button
            type="button"
            key={item.id}
            className={item.id === draftId ? "selected" : ""}
            onClick={() => onSelect(item)}
          >
            <strong>{parseLocalDraft(item.source)?.data.title ?? "構文を編集中"}</strong>
            <span>
              {item.workingBranch || "未同期"} ·{" "}
              {new Date(item.savedAt).toLocaleDateString("ja-JP")}
            </span>
          </button>
        ))}
      </div>
      <section className="repository-panel">
        <h2>GitHubのソース</h2>
        <p className="small muted">{git.auth.repository}</p>
        <label>
          読み込み元ブランチ
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
          ブランチを読み込む
        </button>
        {git.snapshot && <p className="revision">{git.snapshot.commit.slice(0, 12)}</p>}
        <div className="repository-documents">
          {git.documents.map((file) => (
            <button type="button" key={file.path} onClick={() => onOpenDocument(file.path)}>
              {file.path.replace(/^content\//u, "")}
            </button>
          ))}
        </div>
      </section>
      <label className="import-label">
        MDX・下書きを取り込む
        <input
          type="file"
          accept=".md,.mdx,.json"
          onChange={(event) => onImport(event.target.files?.[0])}
        />
      </label>
    </aside>
  );
}
