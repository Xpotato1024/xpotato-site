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
  const label = checking ? "更新を確認中" : ready ? "更新を適用" : "更新を確認";
  return (
    <button
      type="button"
      className="editor-update-button"
      aria-label={"PWAの" + label}
      title={"PWAの" + label}
      disabled={disabled}
      onClick={onClick}
    >
      <WorkspaceIcon name="refresh" />
      <span>{label}</span>
    </button>
  );
}
