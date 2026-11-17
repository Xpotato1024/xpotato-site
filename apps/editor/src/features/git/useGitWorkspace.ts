import { useEffect, useMemo, useState } from "react";
import {
  collectionFromPath,
  parseDraft,
  updateDraft,
  validateDraft,
  type TaxonomySnapshot,
} from "@xpotato/editor-core/draft";
import type { GitSnapshot } from "@xpotato/editor-core/git";
import { EditorApiError, loginState, query, request, type LoginState } from "../../data/api.js";
import { findMediaSnapshot, restoreMediaSnapshot } from "../../data/media-sync.js";
import { saveLocalDraft, type LocalDraft } from "../../data/storage.js";
import { errorLabel } from "../../shared/messages.js";
import { mergeGitSaveResult } from "../drafts/model.js";
import type { DraftWorkspace } from "../drafts/useDraftWorkspace.js";
import schema from "../../../../../content/registry/editor.json";

interface RepositoryDocument {
  path: string;
  sha: string;
  bytes: number;
}
interface PullRequest {
  number: number;
  url: string;
}

export function useGitWorkspace(
  workspace: DraftWorkspace,
  onError: (message: string) => void,
  onNotice: (message: string) => void,
) {
  const [auth, setAuth] = useState<LoginState>({
    authenticated: false,
    configured: false,
    repository: "Xpotato1024/xpotato-site",
  });
  const [branches, setBranches] = useState<string[]>(["main"]);
  const [sourceBranch, setSourceBranch] = useState("main");
  const [snapshot, setSnapshot] = useState<GitSnapshot | null>(null);
  const [documents, setDocuments] = useState<RepositoryDocument[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomySnapshot>(schema as TaxonomySnapshot);
  const [pr, setPr] = useState<PullRequest | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const { draft, hydrated } = workspace;
  const issues = useMemo(() => {
    try {
      return validateDraft(draft.source, collectionFromPath(draft.path), taxonomy);
    } catch {
      return ["記事パスが不正です"];
    }
  }, [draft.source, draft.path, taxonomy]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    let active = true;
    void loginState().then((state) => {
      if (active) {
        setAuth(state);
      }
    });
    return () => {
      active = false;
    };
  }, [hydrated]);

  useEffect(() => {
    setSourceBranch(draft.sourceBranch);
    // 別原稿のPRや競合を、今開いている原稿の状態として表示しない。
    setPr(null);
    setConflict(null);
  }, [draft.id, draft.sourceBranch]);

  useEffect(() => {
    if (!auth.authenticated) {
      return;
    }
    let active = true;
    void request<string[]>("/branches")
      .then((values) => {
        if (active) {
          setBranches(values);
        }
      })
      .catch((error) => {
        if (active) {
          onError(errorLabel(error.message));
        }
      });
    return () => {
      active = false;
    };
  }, [auth.authenticated, onError]);

  async function logout() {
    await request("/auth/logout", { method: "POST" });
    setAuth(await loginState());
  }

  async function readBranch() {
    await workspace.persist();
    const selected = await request<GitSnapshot>("/snapshot" + query({ branch: sourceBranch }));
    const [manifest, files] = await Promise.all([
      request<TaxonomySnapshot>("/manifest" + query({ ...selected })),
      request<RepositoryDocument[]>("/documents" + query({ ...selected })),
    ]);
    // ブランチ名だけでなく部品契約も一致させる。別版CMSで静かに丸め込まない。
    if ((manifest as { contractHash?: string }).contractHash !== schema.contractHash) {
      throw new Error("EDITOR_CONTRACT_VERSION_UNSUPPORTED");
    }
    setSnapshot(selected);
    setTaxonomy(manifest);
    setDocuments(files);
    onNotice(
      "ブランチ " +
        selected.branch +
        " の " +
        selected.commit.slice(0, 8) +
        " を読み込みました。現在の原稿は上書きしていません。",
    );
  }

  async function openDocument(file: string) {
    if (!snapshot) {
      return;
    }
    await workspace.persist();
    const document = await request<{ source: string; path: string; blobSha: string }>(
      "/document" + query({ ...snapshot, path: file }),
    );
    let opened: LocalDraft = {
      id: crypto.randomUUID(),
      source: updateDraft(document.source, { draft: true }),
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
        const restored = await restoreMediaSnapshot(opened, remote);
        opened = restored.draft;
        if (restored.missing.length) {
          onError("本文は読み込みましたが、未取得の画像があります: " + restored.missing.join("、"));
        }
      }
    } catch (error) {
      onError(
        "本文は読み込みました。画像は未同期です: " +
          errorLabel(error instanceof Error ? error.message : "MEDIA_UNAVAILABLE"),
      );
    }
    // 取得を待つ間に入力された内容も保存してから画面を切り替える。
    await workspace.openLocal(opened);
    onNotice("元の記事は変更していません。編集は作業ブランチに保存します。");
  }

  async function saveGit() {
    if (issues.length) {
      throw new Error("入力の確認が必要です: " + issues.join(" / "));
    }
    let submitted = { ...draft };
    if (!submitted.baseCommit) {
      const selected = await request<GitSnapshot>("/snapshot" + query({ branch: sourceBranch }));
      submitted.baseCommit = selected.commit;
      submitted.sourceBranch = selected.branch;
    }
    if (!submitted.workingBranch) {
      const created = await request<GitSnapshot>("/branch", {
        method: "POST",
        body: {
          source: { branch: submitted.sourceBranch, commit: submitted.baseCommit },
          target: "content/" + parseDraft(submitted.source).data.id,
        },
      });
      submitted.workingBranch = created.branch;
      submitted.baseCommit = created.commit;
      workspace.setDraft((current) =>
        current.id === submitted.id
          ? {
              ...current,
              workingBranch: submitted.workingBranch,
              baseCommit: submitted.baseCommit,
              sourceBranch: submitted.sourceBranch,
            }
          : current,
      );
    }
    try {
      const result = await request<{ commit: string; blobSha: string }>("/save", {
        method: "POST",
        body: {
          branch: submitted.workingBranch,
          expectedHead: submitted.baseCommit,
          path: submitted.path,
          source: submitted.source,
          producer: submitted.producer,
        },
      });
      const updated = mergeGitSaveResult(workspace.current.current, submitted, result.commit);
      workspace.setDraft((current) => (current.id === submitted.id ? updated : current));
      await saveLocalDraft({ ...updated, savedAt: new Date().toISOString() });
      onNotice("Gitへ保存しました。 " + result.commit.slice(0, 8));
      setConflict(null);
    } catch (error) {
      if (error instanceof EditorApiError && error.code === "GIT_CONFLICT") {
        const latest = await request<GitSnapshot>(
          "/snapshot" + query({ branch: submitted.workingBranch }),
        );
        const remote = await request<{ source: string }>(
          "/document" + query({ ...latest, path: submitted.path }),
        );
        // 競合は上書きで解決しない。手元のMDXは維持し、比較対象だけを表示する。
        if (workspace.current.current.id === submitted.id) {
          setConflict(remote.source);
        }
      }
      throw error;
    }
  }

  async function createPR() {
    if (!draft.workingBranch || !draft.syncedCommit || draft.syncedSource !== draft.source) {
      throw new Error("最新の変更を先にGitへ保存してください。");
    }
    const metadata = parseDraft(draft.source).data;
    const result = await request<PullRequest>("/pull-request", {
      method: "POST",
      body: {
        branch: draft.workingBranch,
        base: draft.sourceBranch.startsWith("content/") ? "main" : draft.sourceBranch,
        title: "記事: " + (metadata.title ?? "下書き"),
        contentId: metadata.id,
      },
    });
    setPr(result);
    onNotice("Draft PR #" + result.number + " を用意しました。AIは同じブランチから続けられます。");
  }

  return {
    auth,
    branches,
    sourceBranch,
    setSourceBranch,
    snapshot,
    documents,
    taxonomy,
    issues,
    pr,
    conflict,
    logout,
    readBranch,
    openDocument,
    saveGit,
    createPR,
  };
}
export type GitWorkspace = ReturnType<typeof useGitWorkspace>;
