import { useState } from "react";
import { moduleSource } from "@xpotato/editor-core/blocks";
import { AstroReview } from "./components/AstroReview.js";
import { MediaPanel } from "./components/MediaPanel.js";
import { EditorHeader } from "./components/EditorHeader.js";
import { DraftSidebar } from "./components/DraftSidebar.js";
import { EditorActions } from "./components/EditorActions.js";
import { useDraftWorkspace } from "./features/drafts/useDraftWorkspace.js";
import { exportDraftBundle, importDraftFile } from "./features/drafts/transfer.js";
import { DocumentEditor } from "./features/editing/DocumentEditor.js";
import { useGitWorkspace } from "./features/git/useGitWorkspace.js";
import { download } from "./shared/download.js";
import { errorLabel } from "./shared/messages.js";
import { useEditorEnvironment } from "./shared/useEditorEnvironment.js";

export default function App() {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const workspace = useDraftWorkspace(setError);
  const git = useGitWorkspace(workspace, setError, setNotice);
  const environment = useEditorEnvironment();
  const { draft, parsed } = workspace;

  async function act(operation: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (failure) {
      setError(errorLabel(failure instanceof Error ? failure.message : "操作に失敗しました"));
    } finally {
      setBusy(false);
    }
  }

  async function newDocument() {
    await workspace.createNew(git.snapshot);
    setNotice("新しい下書きです。公開日は公開時に確定します。");
    setNavigationOpen(false);
  }

  async function exportBundle() {
    download("xpotato-draft-" + draft.id + ".json", await exportDraftBundle(draft));
    setNotice("本文と画像を書き出しました。ファイルは第三者へ公開しないでください。");
  }

  async function importFile(file: File | undefined) {
    if (!file) {
      return;
    }
    await workspace.persist();
    workspace.setDraft(await importDraftFile(file));
    setNotice("下書きを新しいローカルコピーとして取り込みました。");
  }

  if (!workspace.hydrated) {
    return (
      <main className="editor-loading" role="status">
        保存した下書きを読み込んでいます。
      </main>
    );
  }

  return (
    <div className="editor-app">
      <EditorHeader
        online={environment.online}
        localStatus={workspace.localStatus}
        auth={git.auth}
        onToggleNavigation={() => setNavigationOpen(!navigationOpen)}
        onLogout={() => void act(git.logout)}
        onUnavailable={() => setNotice(errorLabel("AUTH_NOT_CONFIGURED"))}
      />
      <div className="editor-workspace" aria-busy={busy}>
        <DraftSidebar
          open={navigationOpen}
          busy={busy}
          saved={workspace.saved}
          draftId={draft.id}
          git={git}
          onNew={() => void act(newDocument)}
          onSelect={(item) =>
            void act(async () => {
              await workspace.openLocal(item);
              setNavigationOpen(false);
            })
          }
          onReadBranch={() => void act(git.readBranch)}
          onOpenDocument={(file) =>
            void act(async () => {
              await git.openDocument(file);
              setNavigationOpen(false);
            })
          }
          onImport={(file) => void act(() => importFile(file))}
        />
        <main className="editing-main">
          <div className="document-top">
            <div>
              <span className="eyebrow">ARTICLE WORKSPACE</span>
              <p className="document-branch">
                {draft.workingBranch || "端末内の下書き"}
                {draft.baseCommit && <code>{draft.baseCommit.slice(0, 8)}</code>}
              </p>
            </div>
            <span className="draft-badge">サイト未公開</span>
          </div>
          {error && (
            <div className="message error" role="alert">
              {errorLabel(error)}
            </div>
          )}
          {notice && (
            <div className="message" role="status">
              {notice}
              <button type="button" aria-label="通知を閉じる" onClick={() => setNotice("")}>
                ×
              </button>
            </div>
          )}
          {environment.updateReady && (
            <div className="message">
              新しい編集アプリを利用できます。
              <button
                type="button"
                onClick={() => void act(() => environment.activateUpdate(workspace.persist))}
              >
                保存して更新
              </button>
            </div>
          )}
          <DocumentEditor
            draft={draft}
            parsed={parsed}
            taxonomy={git.taxonomy}
            onSource={workspace.setSource}
            onBody={(body) => workspace.edit({}, body)}
            onMetadata={(fields) => workspace.edit(fields)}
            onError={setError}
          />
          {git.conflict && (
            <details className="conflict-panel" open>
              <summary>Gitの最新版（手元の原稿は保持）</summary>
              <textarea readOnly value={git.conflict} rows={12} />
              <button
                type="button"
                onClick={() =>
                  download(
                    "remote-version.mdx",
                    new Blob([git.conflict!], { type: "text/markdown" }),
                  )
                }
              >
                最新版を書き出す
              </button>
            </details>
          )}
          <AstroReview draft={draft} authenticated={git.auth.authenticated} />
          <MediaPanel
            draft={draft}
            authenticated={git.auth.authenticated}
            onDraft={workspace.acceptMediaSync}
            onError={setError}
            onInsert={(asset, alt) => {
              if (parsed) {
                workspace.edit(
                  {},
                  parsed.body.trimEnd() + "\n\n" + moduleSource("Figure", { asset, alt }) + "\n",
                );
              }
            }}
          />
          <details className="validation-panel" open={git.issues.length > 0}>
            <summary>
              {git.issues.length
                ? git.issues.length + "件の確認項目"
                : "下書きの構文・契約チェックは正常"}
            </summary>
            {git.issues.map((issue, index) => (
              <p key={index}>{issue}</p>
            ))}
          </details>
          <EditorActions
            authenticated={git.auth.authenticated}
            busy={busy}
            hasIssues={git.issues.length > 0}
            synced={Boolean(draft.syncedCommit)}
            pr={git.pr}
            onExport={() =>
              download(
                (parsed?.data.id ?? "draft") + ".mdx",
                new Blob([draft.source], { type: "text/markdown;charset=utf-8" }),
              )
            }
            onExportBundle={() => void act(exportBundle)}
            onSave={() => void act(git.saveGit)}
            onCreatePR={() => void act(git.createPR)}
          />
        </main>
      </div>
    </div>
  );
}
