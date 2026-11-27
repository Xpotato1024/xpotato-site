import { WorkspaceIcon } from "./WorkspaceIcon.js";

interface Props {
  authenticated: boolean;
  busy: boolean;
  hasIssues: boolean;
  synced: boolean;
  pr: { number: number; url: string } | null;
  onExport: () => void;
  onExportBundle: () => void;
  onSave: () => void;
  onCreatePR: () => void;
}

export function EditorActions({
  authenticated,
  busy,
  hasIssues,
  synced,
  pr,
  onExport,
  onExportBundle,
  onSave,
  onCreatePR,
}: Props) {
  return (
    <>
      <footer className="editor-actions">
        <button type="button" onClick={onExport}>
          MDX書き出し
        </button>
        <button type="button" onClick={onExportBundle}>
          画像付きバックアップ
        </button>
        <span className="action-spacer" />
        <button type="button" disabled={!authenticated || busy || hasIssues} onClick={onSave}>
          原稿と添削を保存
        </button>
        <button
          type="button"
          className="primary"
          disabled={!authenticated || busy || !synced}
          onClick={onCreatePR}
        >
          Draft PRを開く
        </button>
      </footer>
      {pr && (
        <p className="pr-link">
          <a href={pr.url} target="_blank" rel="noreferrer">
            PR #{pr.number} をGitHubで確認
            <WorkspaceIcon name="external" />
          </a>
        </p>
      )}
      <p className="publication-note">
        公開Gitへの保存内容とPR履歴は第三者にも閲覧可能です。ここでの保存・PR作成は、本番公開や媒体の公開承認ではありません。
      </p>
    </>
  );
}
