import { WorkspaceIcon } from "./WorkspaceIcon.js";

export function EditorUpdateButton({
  ready,
  checking,
  disabled,
  onClick,
}: {
  ready: boolean;
  checking: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const label = checking
    ? "CMSアプリの更新を確認中"
    : ready
      ? "CMSアプリの最新版を取得"
      : "CMSアプリの更新を確認";
  return (
    <button
      type="button"
      className="editor-update-button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <WorkspaceIcon name="appDownload" />
      <span>{label}</span>
    </button>
  );
}
