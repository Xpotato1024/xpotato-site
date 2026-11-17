import type { LoginState } from "../data/api.js";

interface Props {
  online: boolean;
  localStatus: string;
  auth: LoginState;
  onToggleNavigation: () => void;
  onLogout: () => void;
  onUnavailable: () => void;
}

export function EditorHeader({
  online,
  localStatus,
  auth,
  onToggleNavigation,
  onLogout,
  onUnavailable,
}: Props) {
  return (
    <header className="editor-header">
      <button
        type="button"
        className="mobile-nav"
        aria-label="下書き一覧を開く"
        onClick={onToggleNavigation}
      >
        ☰
      </button>
      <a className="editor-brand" href="/editor/">
        <span className="brand-mark">X</span>
        <span>
          Xpotato <strong>Editor</strong>
        </span>
      </a>
      <div className="save-state">
        <span className={"status-dot " + (online ? "online" : "offline")} />
        {online ? localStatus : "オフライン · " + localStatus}
      </div>
      <div className="auth-control">
        {auth.authenticated ? (
          <>
            <span>{auth.user}</span>
            <button type="button" onClick={onLogout}>
              切断
            </button>
          </>
        ) : (
          <a
            className="button"
            href="/editor-api/auth/start"
            aria-disabled={!auth.configured}
            onClick={(event) => {
              if (!auth.configured) {
                event.preventDefault();
                onUnavailable();
              }
            }}
          >
            GitHubと接続
          </a>
        )}
      </div>
    </header>
  );
}
