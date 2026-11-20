import { WorkspaceIcon } from "./WorkspaceIcon.js";
interface Props {
  online: boolean;
  localStatus: string;
  menuOpen: boolean;
  onToggleNavigation: () => void;
  onWorkflow: () => void;
  onMenu: () => void;
}
export function EditorHeader({
  online,
  localStatus,
  menuOpen,
  onToggleNavigation,
  onWorkflow,
  onMenu,
}: Props) {
  const status = online ? localStatus : "オフライン · " + localStatus;
  return (
    <header className="editor-header">
      <button
        type="button"
        className="brand-button"
        onClick={onToggleNavigation}
        aria-label="ホームに戻る"
      >
        <WorkspaceIcon name="back" />
        <span className="editor-brand">
          <span className="brand-mark">X</span>potato
        </span>
        <span className="mobile-library-label">ホーム</span>
      </button>
      <button
        type="button"
        className="save-state-button"
        onClick={onWorkflow}
        aria-label="保存と確認を開く"
        title={status}
      >
        <span className="save-state" role="status">
          <span className={"status-dot " + (online ? "online" : "offline")} />
          <span className="save-state-full">{status}</span>
          <span className="save-state-compact" aria-hidden="true">
            {localStatus.includes("保存済み") ? "保存済み" : localStatus}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="workspace-menu-button"
        aria-label="記事メニューを開く"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? "workspace-panel" : undefined}
        onClick={onMenu}
      >
        <WorkspaceIcon name="more" />
      </button>
    </header>
  );
}
