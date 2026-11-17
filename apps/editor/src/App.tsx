import { findMediaSnapshot, restoreMediaSnapshot } from "./data/media-sync.js";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createDraft,
  parseDraft,
  updateDraft,
  draftPath,
  validateDraft,
  collectionFromPath,
  type DraftMetadata,
  type TaxonomySnapshot,
} from "@xpotato/editor-core/draft";
import { moduleSource } from "@xpotato/editor-core/blocks";
import { sourceBlocks } from "@xpotato/editor-core/blocks";
import { AstroReview } from "./components/AstroReview.js";
import { BlockEditor } from "./components/BlockEditor.js";
import { MediaPanel } from "./components/MediaPanel.js";
import {
  localDrafts,
  saveLocalDraft,
  localMedia,
  saveLocalMedia,
  type LocalDraft,
  type LocalMedia,
} from "./data/storage.js";
import { loginState, request, query, type LoginState, EditorApiError } from "./data/api.js";
import { previewDocument } from "./preview.js";
import { registerEditorWorker } from "./pwa.js";
import schema from "../../../content/registry/editor.json";
const fallbackTaxonomy = schema as TaxonomySnapshot;
const initial = (): LocalDraft => {
  const source = createDraft("", "software");
  return {
    id: crypto.randomUUID(),
    source,
    path: draftPath(parseDraft(source).data.id),
    sourceBranch: "main",
    workingBranch: "",
    baseCommit: "",
    savedAt: new Date().toISOString(),
    producer: "human",
  };
};
const errorLabel = (message: string) =>
  (
    ({
      GIT_CONFLICT:
        "他の端末またはAIがブランチを更新しました。手元の下書きは保持しています。最新版を別の下書きとして読み込み、差分を確認してください。",
      AUTH_REQUIRED: "GitHubへの接続が必要です。",
      AUTH_EXPIRED: "接続の有効期限が切れました。ローカルの下書きを保持したまま再接続できます。",
      AUTH_NOT_CONFIGURED:
        "GitHub Appの接続設定はまだ有効になっていません。ローカル編集・MDX書き出しを利用できます。",
      API_NOT_AVAILABLE: "同期APIに接続できません。編集内容はこの端末に保存できます。",
      HEIC_CONVERSION_REQUIRED:
        "この端末ではHEICを変換できません。原本は削除していません。対応する端末または専用の媒体変換コマンドで変換してください。",
      MEDIA_BYTES_LIMIT:
        "最適化後の保存上限を超えています。文字や動きを無断で削らず、縮小・構成変更または例外の確認が必要です。",
      INPUT_BYTES_LIMIT: "取り込み元は24 MiB以下にしてください。",
      DRAFT_QUOTA_EXCEEDED: "下書き画像の容量上限に達しました。既存の画像は保持されています。",
      EDITOR_CONTRACT_VERSION_UNSUPPORTED:
        "このブランチの編集契約に対応していません。対応版のCMSで開いてください。",
    }) as Record<string, string>
  )[message] ?? message;
function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function App() {
  const [hydrated, setHydrated] = useState(false),
    [draft, setDraft] = useState<LocalDraft>(initial),
    [saved, setSaved] = useState<LocalDraft[]>([]),
    [tab, setTab] = useState<"blocks" | "source" | "preview">("blocks"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [localStatus, setLocalStatus] = useState("保存準備中"),
    [online, setOnline] = useState(navigator.onLine),
    [auth, setAuth] = useState<LoginState>({
      authenticated: false,
      configured: false,
      repository: "Xpotato1024/xpotato-site",
    }),
    [branches, setBranches] = useState<string[]>(["main"]),
    [sourceBranch, setSourceBranch] = useState("main"),
    [snapshot, setSnapshot] = useState<{ branch: string; commit: string } | null>(null),
    [documents, setDocuments] = useState<{ path: string; sha: string; bytes: number }[]>([]),
    [taxonomy, setTaxonomy] = useState<TaxonomySnapshot>(fallbackTaxonomy),
    [preview, setPreview] = useState<{ html: string; warnings: string[] } | null>(null),
    [pr, setPr] = useState<{ number: number; url: string } | null>(null),
    [navigationOpen, setNavigationOpen] = useState(false),
    [updateReady, setUpdateReady] = useState(false),
    [conflict, setConflict] = useState<string | null>(null);
  const current = useRef(draft);
  current.current = draft;
  const ready = useRef(false);
  const parsed = useMemo(() => {
    try {
      return parseDraft(draft.source);
    } catch {
      return null;
    }
  }, [draft.source]);
  const issues = useMemo(() => {
    try {
      return validateDraft(draft.source, collectionFromPath(draft.path), taxonomy);
    } catch {
      return ["記事パスが不正です"];
    }
  }, [draft.source, draft.path, taxonomy]);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const entries = (await localDrafts()).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
        if (!active) return;
        setSaved(entries);
        if (entries[0]) {
          setDraft(entries[0]);
          setSourceBranch(entries[0].sourceBranch);
        }
        ready.current = true;
        setHydrated(true);
      } catch {
        if (!active) return;
        ready.current = true;
        setHydrated(true);
        setError("ローカル保存領域を開けませんでした。書き出して保全してください。");
      }
      const state = await loginState();
      if (active) setAuth(state);
    })();
    void registerEditorWorker().catch(() => {});
    const network = () => setOnline(navigator.onLine),
      update = () => setUpdateReady(true);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    window.addEventListener("editor-update-ready", update);
    return () => {
      active = false;
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
      window.removeEventListener("editor-update-ready", update);
    };
  }, []);
  useEffect(() => {
    if (!ready.current) return;
    setLocalStatus("保存中…");
    const timer = setTimeout(() => {
      void saveLocalDraft({ ...draft, savedAt: new Date().toISOString() })
        .then(async () => {
          setLocalStatus("この端末に保存済み");
          setSaved((await localDrafts()).sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
        })
        .catch(() => {
          setLocalStatus("保存失敗");
          setError("端末内への保存に失敗しました。容量を確認し、MDXを書き出してください。");
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [draft, hydrated]);
  useEffect(() => {
    if (!auth.authenticated) return;
    void request<string[]>("/branches")
      .then(setBranches)
      .catch((e) => setError(errorLabel(e.message)));
  }, [auth.authenticated]);
  useEffect(() => {
    if (tab !== "preview") return;
    let live = true;
    void previewDocument(draft.source)
      .then((result) => {
        if (live) setPreview(result);
      })
      .catch((e) => {
        if (live) {
          setPreview(null);
          setError(errorLabel(e.message));
        }
      });
    return () => {
      live = false;
    };
  }, [tab, draft.source]);
  async function act(operation: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (e) {
      setError(errorLabel(e instanceof Error ? e.message : "操作に失敗しました"));
    } finally {
      setBusy(false);
    }
  }
  function body(value: string) {
    try {
      setDraft({ ...draft, source: updateDraft(draft.source, {}, value) });
    } catch (e) {
      setError(errorLabel((e as Error).message));
    }
  }
  function metadata(fields: Partial<DraftMetadata>) {
    try {
      setDraft({ ...draft, source: updateDraft(draft.source, fields) });
    } catch (e) {
      setError(errorLabel((e as Error).message));
    }
  }
  async function readBranch() {
    await saveLocalDraft({ ...draft, savedAt: new Date().toISOString() });
    const selected = await request<{ branch: string; commit: string }>(
      "/snapshot" + query({ branch: sourceBranch }),
    );
    const [manifest, files] = await Promise.all([
      request<TaxonomySnapshot>("/manifest" + query(selected)),
      request<{ path: string; sha: string; bytes: number }[]>("/documents" + query(selected)),
    ]);
    if (
      (manifest as { contractHash?: string }).contractHash !==
      (schema as { contractHash: string }).contractHash
    )
      throw Error("EDITOR_CONTRACT_VERSION_UNSUPPORTED");
    setSnapshot(selected);
    setTaxonomy(manifest);
    setDocuments(files);
    setNotice(
      "ブランチ " +
        selected.branch +
        " の " +
        selected.commit.slice(0, 8) +
        " を読み込みました。現在の原稿は上書きしていません。",
    );
  }
  async function openDocument(file: string) {
    if (!snapshot) return;
    await saveLocalDraft({ ...draft, savedAt: new Date().toISOString() });
    const document = await request<{ source: string; path: string; blobSha: string }>(
      "/document" + query({ ...snapshot, path: file }),
    );
    const source = updateDraft(document.source, { draft: true });
    let opened: LocalDraft = {
      id: crypto.randomUUID(),
      source,
      path: file,
      sourceBranch: snapshot.branch,
      workingBranch: snapshot.branch.startsWith("content/") ? snapshot.branch : "",
      baseCommit: snapshot.commit,
      savedAt: new Date().toISOString(),
      producer: "mixed",
    };
    try {
      const remote = await findMediaSnapshot(opened);
      if (remote) {
        const result = await restoreMediaSnapshot(opened, remote);
        opened = result.draft;
        if (result.missing.length)
          setError("本文は読み込みましたが、未取得の画像があります: " + result.missing.join("、"));
      }
    } catch (error) {
      setError(
        "本文は読み込みました。画像は未同期です: " +
          errorLabel(error instanceof Error ? error.message : "MEDIA_UNAVAILABLE"),
      );
    }
    setDraft(opened);
    setPr(null);
    setNavigationOpen(false);
    setNotice("元の記事は変更していません。編集は作業ブランチに保存します。");
  }
  async function newDocument() {
    await saveLocalDraft({ ...draft, savedAt: new Date().toISOString() });
    const next = initial();
    if (snapshot) {
      next.sourceBranch = snapshot.branch;
      next.baseCommit = snapshot.commit;
    }
    setDraft(next);
    setPr(null);
    setNotice("新しい下書きです。公開日は公開時に確定します。");
    setNavigationOpen(false);
  }
  async function saveGit() {
    if (issues.length) throw Error("入力の確認が必要です: " + issues.join(" / "));
    let next = { ...draft };
    if (!next.baseCommit) {
      const selected = await request<{ branch: string; commit: string }>(
        "/snapshot" + query({ branch: sourceBranch }),
      );
      next.baseCommit = selected.commit;
      next.sourceBranch = selected.branch;
    }
    if (!next.workingBranch) {
      const target = "content/" + parseDraft(next.source).data.id;
      const created = await request<{ branch: string; commit: string }>("/branch", {
        method: "POST",
        body: { source: { branch: next.sourceBranch, commit: next.baseCommit }, target },
      });
      next.workingBranch = created.branch;
      next.baseCommit = created.commit;
      setDraft((value) =>
        value.id === next.id
          ? {
              ...value,
              workingBranch: next.workingBranch,
              baseCommit: next.baseCommit,
              sourceBranch: next.sourceBranch,
            }
          : value,
      );
    }
    try {
      const result = await request<{ commit: string; blobSha: string }>("/save", {
        method: "POST",
        body: {
          branch: next.workingBranch,
          expectedHead: next.baseCommit,
          path: next.path,
          source: next.source,
          producer: next.producer,
        },
      });
      next = {
        ...next,
        baseCommit: result.commit,
        syncedCommit: result.commit,
        syncedSource: next.source,
      };
      const latest =
        current.current.id === next.id
          ? {
              ...current.current,
              workingBranch: next.workingBranch,
              baseCommit: next.baseCommit,
              syncedCommit: result.commit,
              syncedSource: next.source,
            }
          : next;
      setDraft((value) => (value.id === next.id ? latest : value));
      await saveLocalDraft({ ...latest, savedAt: new Date().toISOString() });
      setNotice("Gitへ保存しました。 " + result.commit.slice(0, 8));
      setConflict(null);
    } catch (e) {
      if (e instanceof EditorApiError && e.code === "GIT_CONFLICT") {
        const latest = await request<{ branch: string; commit: string }>(
          "/snapshot" + query({ branch: next.workingBranch }),
        );
        const remote = await request<{ source: string }>(
          "/document" + query({ ...latest, path: next.path }),
        );
        setConflict(remote.source);
      }
      throw e;
    }
  }
  async function createPR() {
    if (!draft.workingBranch || !draft.syncedCommit || draft.syncedSource !== draft.source)
      throw Error("最新の変更を先にGitへ保存してください。");
    const result = await request<{ number: number; url: string }>("/pull-request", {
      method: "POST",
      body: {
        branch: draft.workingBranch,
        base: draft.sourceBranch.startsWith("content/") ? "main" : draft.sourceBranch,
        title: "記事: " + (parsed?.data.title ?? "下書き"),
        contentId: parsed?.data.id,
      },
    });
    setPr(result);
    setNotice("Draft PR #" + result.number + " を用意しました。AIは同じブランチから続けられます。");
  }
  async function exportBundle() {
    const media = await localMedia(draft.id);
    if (media.reduce((sum, item) => sum + item.blob.size, 0) > 32 * 1024 * 1024)
      throw Error(
        "まとめて書き出せる画像は32 MiBまでです。画像を同期するか、記事を分けて保全してください。",
      );
    const encoded = await Promise.all(
      media.map(async ({ blob, ...item }) => {
        let value = "";
        for (const byte of new Uint8Array(await blob.arrayBuffer()))
          value += String.fromCharCode(byte);
        return { ...item, mime: blob.type, base64: btoa(value) };
      }),
    );
    download(
      "xpotato-draft-" + draft.id + ".json",
      new Blob([JSON.stringify({ version: 1, draft, media: encoded })], {
        type: "application/json",
      }),
    );
    setNotice("本文と画像を書き出しました。ファイルは第三者へ公開しないでください。");
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 48 * 1024 * 1024) throw Error("インポートファイルが大きすぎます。");
    const text = await file.text();
    if (/\.mdx?$/iu.test(file.name)) {
      const content = parseDraft(text);
      const next = {
        ...initial(),
        source: updateDraft(text, { draft: true }),
        path: draftPath(content.data.id),
      };
      await saveLocalDraft(next);
      setDraft(next);
      return;
    }
    const value = JSON.parse(text) as {
      version: number;
      draft: LocalDraft;
      media: ({ base64: string; mime: string } & Omit<LocalMedia, "blob">)[];
    };
    if (value.version !== 1 || !value.draft || !Array.isArray(value.media))
      throw Error("IMPORT_FORMAT_INVALID");
    parseDraft(value.draft.source);
    const id = crypto.randomUUID(),
      next = { ...value.draft, id, savedAt: new Date().toISOString() };
    for (const item of value.media) {
      const { base64, mime, ...metadata } = item;
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const { inspectImage } = await import("@xpotato/editor-core/image-inspection");
      inspectImage(bytes, item.kind);
      await saveLocalMedia({
        ...metadata,
        id: crypto.randomUUID(),
        draftId: id,
        blob: new Blob([bytes], { type: mime }),
      });
    }
    await saveLocalDraft(next);
    setDraft(next);
    setNotice("下書きを新しいローカルコピーとして取り込みました。");
  }
  async function updateApp() {
    await saveLocalDraft({ ...draft, savedAt: new Date().toISOString() });
    const registration = await navigator.serviceWorker.getRegistration("/editor/");
    registration?.waiting?.postMessage({ type: "ACTIVATE" });
    navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), {
      once: true,
    });
  }
  if (!hydrated)
    return (
      <main className="editor-loading" role="status">
        保存した下書きを読み込んでいます。
      </main>
    );
  return (
    <div className="editor-app">
      <header className="editor-header">
        <button
          type="button"
          className="mobile-nav"
          aria-label="下書き一覧を開く"
          onClick={() => setNavigationOpen(!navigationOpen)}
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
              <button
                type="button"
                onClick={() =>
                  void act(async () => {
                    await request("/auth/logout", { method: "POST" });
                    setAuth(await loginState());
                  })
                }
              >
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
                  setNotice(errorLabel("AUTH_NOT_CONFIGURED"));
                }
              }}
            >
              GitHubと接続
            </a>
          )}
        </div>
      </header>
      <div className="editor-workspace" aria-busy={busy}>
        <aside
          className={"draft-sidebar " + (navigationOpen ? "is-open" : "")}
          aria-label="下書きとブランチ"
        >
          <button type="button" className="primary new-draft" onClick={() => void act(newDocument)}>
            ＋ 新しい記事
          </button>
          <h2>この端末の下書き</h2>
          <div className="draft-list">
            {saved.map((item) => {
              let title = "構文を編集中";
              try {
                title = parseDraft(item.source).data.title;
              } catch {}
              return (
                <button
                  type="button"
                  key={item.id}
                  className={item.id === draft.id ? "selected" : ""}
                  onClick={() =>
                    void act(async () => {
                      await saveLocalDraft({ ...draft, savedAt: new Date().toISOString() });
                      setDraft(item);
                      setSourceBranch(item.sourceBranch);
                      setNavigationOpen(false);
                    })
                  }
                >
                  <strong>{title}</strong>
                  <span>
                    {item.workingBranch || "未同期"} ·{" "}
                    {new Date(item.savedAt).toLocaleDateString("ja-JP")}
                  </span>
                </button>
              );
            })}
          </div>
          <section className="repository-panel">
            <h2>GitHubのソース</h2>
            <p className="small muted">{auth.repository}</p>
            <label>
              読み込み元ブランチ
              <select
                value={sourceBranch}
                onChange={(event) => setSourceBranch(event.target.value)}
              >
                {[...new Set([sourceBranch, ...branches])].map((branch) => (
                  <option value={branch} key={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!auth.authenticated || busy}
              onClick={() => void act(readBranch)}
            >
              ブランチを読み込む
            </button>
            {snapshot && <p className="revision">{snapshot.commit.slice(0, 12)}</p>}
            <div className="repository-documents">
              {documents.map((file) => (
                <button
                  type="button"
                  key={file.path}
                  onClick={() => void act(() => openDocument(file.path))}
                >
                  {file.path.replace(/^content\//u, "")}
                </button>
              ))}
            </div>
          </section>
          <label className="import-label">
            MDX・下書きを取り込む
            <input
              type="file"
              accept=".md,.mdx,.json"
              onChange={(event) => void act(() => importFile(event.target.files?.[0]))}
            />
          </label>
        </aside>
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
          {updateReady && (
            <div className="message">
              新しい編集アプリを利用できます。
              <button type="button" onClick={() => void act(updateApp)}>
                保存して更新
              </button>
            </div>
          )}
          <label className="title-label">
            <span className="sr-only">記事タイトル</span>
            <input
              placeholder="記事のタイトル"
              value={parsed?.data.title ?? ""}
              disabled={!parsed}
              onChange={(event) => metadata({ title: event.target.value })}
            />
          </label>
          <details className="metadata" open>
            <summary>記事情報</summary>
            <div className="metadata-grid">
              <label>
                概要
                <textarea
                  rows={2}
                  value={parsed?.data.description ?? ""}
                  disabled={!parsed}
                  placeholder="読者に何が伝わる記事ですか"
                  onChange={(event) => metadata({ description: event.target.value })}
                />
              </label>
              <label>
                主分類
                <select
                  value={parsed?.data.category ?? parsed?.data.subject ?? "software"}
                  disabled={!parsed}
                  onChange={(event) =>
                    metadata(
                      collectionFromPath(draft.path) === "notes"
                        ? { subject: event.target.value }
                        : { category: event.target.value },
                    )
                  }
                >
                  {(taxonomy.categories[collectionFromPath(draft.path)] ?? []).map((id) => (
                    <option key={id} value={id}>
                      {taxonomy.labels?.[id] ?? id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                タグ
                <select
                  multiple
                  value={parsed?.data.tags ?? []}
                  disabled={!parsed}
                  onChange={(event) =>
                    metadata({ tags: Array.from(event.target.selectedOptions).map((o) => o.value) })
                  }
                >
                  {taxonomy.tags.map((id) => (
                    <option key={id} value={id}>
                      {taxonomy.labels?.[id] ?? id}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="small muted">
              公開日・URL・SEOの定型情報は正式な公開処理で確定します。画像や分類はIDで参照します。
            </p>
          </details>
          <div className="editor-tabs" role="tablist" aria-label="編集モード">
            {(["blocks", "source", "preview"] as const).map((mode) => (
              <button
                type="button"
                role="tab"
                aria-selected={mode === tab}
                key={mode}
                onClick={() => setTab(mode)}
              >
                {mode === "blocks"
                  ? "ブロック編集"
                  : mode === "source"
                    ? "MDXソース"
                    : "プレビュー"}
              </button>
            ))}
          </div>
          <div className="document-editor">
            {tab === "blocks" && parsed ? (
              <BlockEditor body={parsed.body} onChange={body} onError={setError} />
            ) : tab === "source" || !parsed ? (
              <textarea
                className="source-editor"
                aria-label="MDXソース"
                spellCheck={false}
                value={draft.source}
                onChange={(event) => setDraft({ ...draft, source: event.target.value })}
              />
            ) : (
              <section className="preview-pane" aria-label="下書きプレビュー">
                <p className="preview-note">
                  編集用プレビュー。共通部品の最終レイアウトと実画像は、固定commitからのAstroレビュー画面で確認します。
                </p>
                {preview && (
                  <div
                    className="preview-prose"
                    dangerouslySetInnerHTML={{ __html: preview.html }}
                  />
                )}
              </section>
            )}
          </div>
          {conflict && (
            <details className="conflict-panel" open>
              <summary>Gitの最新版（手元の原稿は保持）</summary>
              <textarea readOnly value={conflict} rows={12} />
              <button
                type="button"
                onClick={() => {
                  download("remote-version.mdx", new Blob([conflict], { type: "text/markdown" }));
                }}
              >
                最新版を書き出す
              </button>
            </details>
          )}
          <AstroReview draft={draft} authenticated={auth.authenticated} />
          <MediaPanel
            draft={draft}
            authenticated={auth.authenticated}
            onDraft={(value) =>
              setDraft((current) =>
                current.id === value.id
                  ? {
                      ...current,
                      ...(value.remoteDraftId ? { remoteDraftId: value.remoteDraftId } : {}),
                      ...(value.remoteRevision !== undefined
                        ? { remoteRevision: value.remoteRevision }
                        : {}),
                    }
                  : current,
              )
            }
            onError={setError}
            onInsert={(asset, alt) => {
              if (parsed)
                body(
                  parsed.body.trimEnd() + "\n\n" + moduleSource("Figure", { asset, alt }) + "\n",
                );
            }}
          />
          <details className="validation-panel" open={issues.length > 0}>
            <summary>
              {issues.length ? issues.length + "件の確認項目" : "下書きの構文・契約チェックは正常"}
            </summary>
            {issues.map((issue, i) => (
              <p key={i}>{issue}</p>
            ))}
          </details>
          <footer className="editor-actions">
            <button
              type="button"
              onClick={() =>
                download(
                  (parsed?.data.id ?? "draft") + ".mdx",
                  new Blob([draft.source], { type: "text/markdown;charset=utf-8" }),
                )
              }
            >
              MDX書き出し
            </button>
            <button type="button" onClick={() => void act(exportBundle)}>
              画像を含めて保全
            </button>
            <span className="action-spacer" />
            <button
              type="button"
              disabled={!auth.authenticated || busy || issues.length > 0}
              onClick={() => void act(saveGit)}
            >
              Gitへ保存
            </button>
            <button
              type="button"
              className="primary"
              disabled={!auth.authenticated || busy || !draft.syncedCommit}
              onClick={() => void act(createPR)}
            >
              Draft PRを開く
            </button>
          </footer>
          {pr && (
            <p className="pr-link">
              <a href={pr.url} target="_blank" rel="noreferrer">
                PR #{pr.number} をGitHubで確認する ↗
              </a>
            </p>
          )}
          <p className="publication-note">
            公開Gitへの保存内容とPR履歴は第三者にも閲覧可能です。ここでの保存・PR作成は、本番公開や媒体の公開承認ではありません。
          </p>
        </main>
      </div>
    </div>
  );
}
