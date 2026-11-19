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
        <p className="eyebrow">XPOTATO / WORKSPACE</p>
        <h1>どこから始めますか</h1>
        <p>原稿と作業場所を選んで、執筆・添削へ。</p>
      </header>
      <div className="entry-cards">
        {(
          [
            { id: "new", title: "新規作成", detail: "記事・メモ・教育記事などを作る", icon: "new" },
            {
              id: "revise",
              title: "既存記事を改稿",
              detail: "公開済みの記事を読み込んで直す",
              icon: "revise",
            },
            {
              id: "drafts",
              title: "下書きの続き",
              detail: "原稿の再開・AI下書きの添削",
              icon: "library",
            },
          ] as const
        ).map((item) => (
          <button type="button" key={item.id} onClick={() => navigate(item.id)}>
            <WorkspaceIcon name={item.icon} />
            <strong>{item.title}</strong>
            <span>{item.detail}</span>
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
      <section className="workspace-manage" aria-label="原稿を開かずに管理">
        <h2>原稿を開かずに管理</h2>
        <div>
          <button type="button" onClick={() => navigate("taxonomy")}>
            <WorkspaceIcon name="tags" />
            <span>
              <strong>分類・タグ</strong>
              <small>検索・追加・目的タグ</small>
            </span>
          </button>
          <button type="button" onClick={() => navigate("series")}>
            <WorkspaceIcon name="series" />
            <span>
              <strong>連載・コース</strong>
              <small>新しい連載と読む順序</small>
            </span>
          </button>
        </div>
      </section>
      <section className="sample-entry">
        <div>
          <h2>操作サンプル</h2>
          <p>グループ移動、本文の指摘、色付きの修正案を試せます。</p>
        </div>
        <button type="button" onClick={onSample} disabled={busy}>
          操作サンプルを開く
        </button>
      </section>
    </div>
  );
}
