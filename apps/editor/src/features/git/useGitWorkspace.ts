import { previewRegistryChanges, rebaseSeriesChanges } from "@xpotato/editor-core/registry";
import { validateReviewComments } from "@xpotato/editor-core/annotations";
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
import { updateLocalDraft, type LocalDraft } from "../../data/storage.js";
import { errorLabel } from "../../shared/messages.js";
import { acceptGitSaveResult } from "../drafts/model.js";
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
  const [baseTaxonomy, setTaxonomy] = useState<TaxonomySnapshot>(schema as TaxonomySnapshot);
  const [pr, setPr] = useState<PullRequest | null>(null);
  const [conflict, setConflict] = useState<{
    base: string;
    remote: string;
    head: GitSnapshot;
    manifest: TaxonomySnapshot;
    draftId: string;
  } | null>(null);
  const { draft, hydrated } = workspace;
  const taxonomy = useMemo(() => {
    try {
      return previewRegistryChanges(baseTaxonomy, draft.pendingRegistryChanges);
    } catch {
      return baseTaxonomy;
    }
  }, [baseTaxonomy, draft.pendingRegistryChanges]);
  const issues = useMemo(() => {
    try {
      previewRegistryChanges(baseTaxonomy, draft.pendingRegistryChanges);
      return validateDraft(draft.source, collectionFromPath(draft.path), taxonomy);
    } catch (error) {
      return [error instanceof Error ? error.message : "記事情報を確認してください"];
    }
  }, [draft.source, draft.path, draft.pendingRegistryChanges, baseTaxonomy, taxonomy]);

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
    setTaxonomy(draft.registrySnapshot ?? (schema as TaxonomySnapshot));
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
    workspace.setDraft((current) => ({ ...current, registrySnapshot: manifest }));
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
    const [document, manifest] = await Promise.all([
      request<{ source: string; path: string; blobSha: string }>(
        "/document" + query({ ...snapshot, path: file }),
      ),
      request<TaxonomySnapshot>("/manifest" + query({ ...snapshot })),
    ]);
    let opened: LocalDraft = {
      id: crypto.randomUUID(),
      source: updateDraft(document.source, { draft: true }),
      path: file,
      sourceBranch: snapshot.branch,
      workingBranch: snapshot.branch.startsWith("content/") ? snapshot.branch : "",
      baseCommit: snapshot.commit,
      baseSource: document.source,
      registrySnapshot: manifest,
      savedAt: new Date().toISOString(),
      producer: "mixed",
    };
    try {
      const remote = await findMediaSnapshot(opened);
      if (remote) {
        const restored = await restoreMediaSnapshot(opened, remote);
        opened = restored.draft;
        if (remote.draft.review)
          opened = {
            ...opened,
            annotations: validateReviewComments(
              remote.draft.review.comments,
              parseDraft(opened.source).data.id,
            ),
            reviewRevision: remote.draft.review.revision,
          };
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
    setTaxonomy(manifest);
    onNotice("元の記事は変更していません。編集は作業ブランチに保存します。");
  }

  async function saveGit() {
    if (issues.length) {
      throw new Error("入力の確認が必要です: " + issues.join(" / "));
    }
    let submitted = { ...workspace.current.current };
    await workspace.persist("Git保存前");
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
      if (submitted.pendingRegistryChanges?.series) {
        const manifest = await request<TaxonomySnapshot>(
          "/manifest" + query({ branch: submitted.workingBranch, commit: submitted.baseCommit }),
        );
        submitted = {
          ...submitted,
          pendingRegistryChanges: rebaseSeriesChanges(
            submitted.pendingRegistryChanges,
            manifest.seriesRegistry ?? { schemaVersion: 1, series: [] },
          ),
        };
      }
      const result = await request<{ commit: string; blobSha: string; manifest: TaxonomySnapshot }>(
        "/save",
        {
          method: "POST",
          body: {
            branch: submitted.workingBranch,
            expectedHead: submitted.baseCommit,
            path: submitted.path,
            source: submitted.source,
            producer: submitted.producer,
            ...(submitted.pendingRegistryChanges
              ? { registryChanges: submitted.pendingRegistryChanges }
              : {}),
          },
        },
      );
      let registryConflict = false;
      const merge = (latest: LocalDraft): LocalDraft => {
        const accepted = acceptGitSaveResult(latest, submitted, result.commit, result.manifest);
        registryConflict ||= accepted.registryConflict;
        return { ...accepted.draft, savedAt: new Date().toISOString() };
      };
      // Later autosaves and navigation saves must capture the successful commit too.
      if (workspace.current.current.id === submitted.id) {
        setTaxonomy(result.manifest);
        workspace.setDraft((current) => (current.id === submitted.id ? merge(current) : current));
      }
      // A response for a closed document must preserve edits made after submission.
      await updateLocalDraft(submitted.id, submitted, (stored) =>
        merge(workspace.current.current.id === submitted.id ? workspace.current.current : stored),
      );
      if (workspace.current.current.id === submitted.id) {
        setTaxonomy(result.manifest);
        workspace.setDraft((current) => (current.id === submitted.id ? merge(current) : current));
      }
      if (registryConflict && workspace.current.current.id === submitted.id) {
        setConflict({
          base: submitted.source,
          remote: submitted.source,
          head: { branch: submitted.workingBranch, commit: result.commit },
          manifest: result.manifest,
          draftId: submitted.id,
        });
        onNotice("Gitへの保存は完了しました。保存中に変更した連載設定を比較してください。");
      } else {
        onNotice("Gitへ保存しました。 " + result.commit.slice(0, 8));
        setConflict(null);
      }
    } catch (error) {
      if (error instanceof Error && ["GIT_CONFLICT", "SERIES_CONFLICT"].includes(error.message)) {
        const latest = await request<GitSnapshot>(
          "/snapshot" + query({ branch: submitted.workingBranch }),
        );
        const remote = await request<{ source: string }>(
          "/document" + query({ ...latest, path: submitted.path }),
        ).catch((failure: unknown) => {
          if (failure instanceof EditorApiError && failure.code === "GIT_NOT_FOUND")
            return { source: "" };
          throw failure;
        });
        // 競合は上書きで解決しない。手元のMDXは維持し、比較対象だけを表示する。
        if (workspace.current.current.id === submitted.id) {
          const manifest = await request<TaxonomySnapshot>("/manifest" + query({ ...latest }));
          setConflict({
            base: submitted.baseSource ?? submitted.syncedSource ?? "",
            remote: remote.source,
            head: latest,
            manifest,
            draftId: submitted.id,
          });
        }
      }
      throw error;
    }
  }

  async function createPR() {
    if (
      !draft.workingBranch ||
      !draft.syncedCommit ||
      draft.syncedSource !== draft.source ||
      draft.pendingRegistryChanges
    ) {
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
    if (workspace.current.current.id === draft.id) setPr(result);
    onNotice("Draft PR #" + result.number + " を用意しました。AIは同じブランチから続けられます。");
  }

  async function resolveConflict(source: string, registry: "local" | "remote") {
    if (!conflict || workspace.current.current.id !== conflict.draftId) return;
    parseDraft(source);
    await workspace.persist("競合の解決前");
    if (workspace.current.current.id !== conflict.draftId) return;
    setTaxonomy(conflict.manifest);
    workspace.setDraft((current) => {
      let pending = registry === "remote" ? undefined : current.pendingRegistryChanges;
      if (pending?.series && pending.seriesBase) {
        const remote = conflict.manifest.seriesRegistry ?? {
          schemaVersion: 1 as const,
          series: [],
        };
        const merged = new Map(remote.series.map((entry) => [entry.id, entry]));
        const before = new Map(pending.seriesBase.series.map((entry) => [entry.id, entry]));
        const after = new Map(pending.series.series.map((entry) => [entry.id, entry]));
        // Explicit local preference applies only the edited series; unseen remote series survive.
        for (const id of new Set([...before.keys(), ...after.keys()])) {
          if (JSON.stringify(before.get(id)) === JSON.stringify(after.get(id))) continue;
          const entry = after.get(id);
          if (entry) merged.set(id, entry);
          else merged.delete(id);
        }
        pending = {
          ...pending,
          series: { schemaVersion: 1, series: [...merged.values()] },
          seriesBase: remote,
        };
      }
      return {
        ...current,
        source,
        baseCommit: conflict.head.commit,
        baseSource: conflict.remote,
        registrySnapshot: conflict.manifest,
        pendingRegistryChanges: pending,
      };
    });
    setConflict(null);
    onNotice("比較結果を原稿へ反映しました。確認してGitへ保存してください。");
  }

  return {
    auth,
    branches,
    sourceBranch,
    setSourceBranch,
    snapshot,
    documents,
    taxonomy,
    baseTaxonomy,
    issues,
    pr,
    conflict,
    resolveConflict,
    logout,
    readBranch,
    openDocument,
    saveGit,
    createPR,
  };
}
export type GitWorkspace = ReturnType<typeof useGitWorkspace>;
