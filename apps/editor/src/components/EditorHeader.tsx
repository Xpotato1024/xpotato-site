import type { LoginState } from "../data/api.js";
interface Props {
  online: boolean;
  localStatus: string;
  auth: LoginState;
  onToggleNavigation: () => void;
  onWorkflow: () => void;
}
export function EditorHeader({ online, localStatus, auth, onToggleNavigation, onWorkflow }: Props) {
  return (
    <header className="editor-header">
      <button
        type="button"
        className="brand-button"
        onClick={onToggleNavigation}
        aria-label="原稿一覧"
      >
        <span className="editor-brand">
          <span className="brand-mark">X</span>potato
        </span>
        <span className="editor-wordmark">Editor</span>
      </button>
      <div className="save-state" role="status">
        <span className={"status-dot " + (online ? "online" : "offline")} />
        {online ? localStatus : "オフライン · " + localStatus}
      </div>
      <button type="button" className="workflow-button" onClick={onWorkflow}>
        {auth.authenticated ? "保存と確認" : "接続・書き出し"}
      </button>
    </header>
  );
}
