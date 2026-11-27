import { EditorBrand } from "./EditorBrand.js";
import { WorkspaceIcon } from "./WorkspaceIcon.js";
import { EditorUpdateButton } from "./EditorUpdateButton.js";
interface Props {
  online: boolean;
  localStatus: string;
  menuOpen: boolean;
  onToggleNavigation: () => void;
  onWorkflow: () => void;
  onMenu: () => void;
  updateReady: boolean;
  updateChecking: boolean;
  updateDisabled: boolean;
  onUpdate: () => void;
}
export function EditorHeader({
  online,
  localStatus,
  menuOpen,
  onToggleNavigation,
  onWorkflow,
  onMenu,
  updateReady,
  updateChecking,
  updateDisabled,
  onUpdate,
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
        <EditorBrand />
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
            {localStatus === "端末保存済み・未同期"
              ? "未同期"
              : localStatus === "端末保存済み・同期済み"
                ? "同期済み"
                : localStatus}
          </span>
        </span>
      </button>
      <EditorUpdateButton
        ready={updateReady}
        checking={updateChecking}
        disabled={updateDisabled}
        onClick={onUpdate}
      />
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
