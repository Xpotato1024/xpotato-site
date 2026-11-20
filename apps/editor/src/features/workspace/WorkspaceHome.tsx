import { WorkspaceIcon } from "../../components/WorkspaceIcon.js";
import type { WorkspacePage } from "./navigation.js";

export function WorkspaceNavigation({
  page,
  navigate,
}: {
  page: WorkspacePage;
  navigate: (page: WorkspacePage) => void;
}) {
  return (
    <nav className="workspace-navigation" aria-label="CMSの管理">
      {(
        [
          { id: "home", label: "ホーム", icon: "home" },
          { id: "taxonomy", label: "分類・タグ", icon: "tags" },
          { id: "series", label: "連載", icon: "series" },
        ] as const
      ).map((item) => (
        <button
          type="button"
          key={item.id}
          aria-current={page === item.id ? "page" : undefined}
          onClick={() => navigate(item.id)}
        >
          <WorkspaceIcon name={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function WorkspaceHome({
  navigate,
  resumeTitle,
  onResume,
  onSample,
  busy,
}: {
  navigate: (page: WorkspacePage) => void;
  resumeTitle?: string | undefined;
  onResume: () => void;
  onSample: () => void;
  busy: boolean;
}) {
  return (
    <div className="workspace-home">
      <header className="workspace-page-heading">
        <h1>原稿</h1>
      </header>
      <div className="entry-cards">
        {(
          [
            { id: "new", title: "新規作成", icon: "new" },
            {
              id: "revise",
              title: "既存記事を改稿",
              icon: "revise",
            },
            {
              id: "drafts",
              title: "下書きの続き",
              icon: "library",
            },
          ] as const
        ).map((item) => (
          <button type="button" key={item.id} onClick={() => navigate(item.id)}>
            <WorkspaceIcon name={item.icon} />
            <strong>{item.title}</strong>
            <WorkspaceIcon name="next" />
          </button>
        ))}
      </div>
      {resumeTitle && (
        <button type="button" className="resume-draft" onClick={onResume}>
          <WorkspaceIcon name="blocks" />
          <span>
            <small>編集中の記事に戻る</small>
            <strong>{resumeTitle}</strong>
          </span>
          <WorkspaceIcon name="next" />
        </button>
      )}
      <section className="sample-entry">
        <button type="button" onClick={onSample} disabled={busy}>
          操作サンプルを開く
        </button>
        <span>編集・添削の練習用</span>
      </section>
    </div>
  );
}
