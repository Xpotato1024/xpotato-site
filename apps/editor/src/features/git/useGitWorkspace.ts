import { previewRegistryChanges, reconcileRegistryChanges } from "@xpotato/editor-core/registry";
import { validateReviewComments } from "@xpotato/editor-core/annotations";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collectionFromPath,
  parseDraft,
  updateDraft,
  validateDraft,
  type TaxonomySnapshot,
} from "@xpotato/editor-core/draft";
import { assertWorkingBranch, type GitSnapshot } from "@xpotato/editor-core/git";
import { EditorApiError, loginState, query, request, type LoginState } from "../../data/api.js";
import {
  findMediaSnapshot,
  missingDraftMedia,
  restoreMediaSnapshot,
} from "../../data/media-sync.js";
import {
  claimGitDraft,
  localMedia,
  saveLocalMedia,
  updateLocalDraft,
  type LocalDraft,
} from "../../data/storage.js";
import {
  hasLocalSourceChanges,
  hasPendingRegistryChanges,
  localDraftIdentity,
  matchingLocalDrafts,
  mergeGitReopen,
} from "../../data/draft-identity.js";
import { errorLabel } from "../../shared/messages.js";
import type { DraftBranchSyncResult } from "@xpotato/editor-core/draft-branch";
import { mainSyncIdentity, requestMainSync, acceptMainSync } from "../../data/draft-main.js";
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
export interface BranchPlan {
  mode: "local" | "existing" | "new";
  sourceBranch: string;
  targetBranch: string;
}
export interface PreparedWorkspace {
  snapshot: GitSnapshot | null;
  manifest: TaxonomySnapshot;
  sourceBranch: string;
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
  const [sourceBranch, setSourceBranchState] = useState("main");
  const selectedBranch = useRef("main");
  const branchReadVersion = useRef(0);
  const loadedSnapshot = useRef<GitSnapshot | null>(null);
  const documentOpening = useRef(false);
  const [snapshot, setSnapshot] = useState<GitSnapshot | null>(null);
  const [documents, setDocuments] = useState<RepositoryDocument[]>([]);
  const [repositoryManifest, setRepositoryManifest] = useState<TaxonomySnapshot>(
    schema as TaxonomySnapshot,
  );
  const [pr, setPr] = useState<PullRequest | null>(null);
  const [mainSync, setMainSync] = useState<DraftBranchSyncResult | null>(null);
  const mainSyncRunning = useRef(false);
  const [conflict, setConflict] = useState<{
    base: string;
    remote: string;
    head: GitSnapshot;
    manifest: TaxonomySnapshot;
    draftId: string;
  } | null>(null);
  const { draft, hydrated } = workspace;
  const baseTaxonomy = draft.registrySnapshot ?? (schema as TaxonomySnapshot);
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
    if (!hydrated) return;
    let active = true;
    let checking = false;
    let lastCheck = 0;
    const refresh = () => {
      if (!active || checking || Date.now() - lastCheck < 30000) return;
      checking = true;
      lastCheck = Date.now();
      void loginState()
        .then((state) => {
          if (!active) return;
          setAuth((current) => (state.unavailable ? { ...current, unavailable: true } : state));
        })
        .finally(() => {
          checking = false;
        });
    };
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    window.addEventListener("pageshow", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [hydrated]);

  useEffect(() => {
    setSourceBranch(draft.workingBranch || draft.sourceBranch);
    // 別原稿のPRや競合を、今開いている原稿の状態として表示しない。
    setPr(null);
    setConflict(null);
  }, [draft.id, draft.sourceBranch, draft.workingBranch]);

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

  function setSourceBranch(branch: string) {
    if (branch === selectedBranch.current) {
      return;
    }
    selectedBranch.current = branch;
    branchReadVersion.current += 1;
    loadedSnapshot.current = null;
    setSourceBranchState(branch);
    setSnapshot(null);
    setDocuments([]);
    setRepositoryManifest(schema as TaxonomySnapshot);
  }

  function assertCurrentSelection(selected: GitSnapshot) {
    if (
      selected.branch !== selectedBranch.current ||
      selected.branch !== loadedSnapshot.current?.branch ||
      selected.commit !== loadedSnapshot.current.commit
    ) {
      throw new Error("読み込み元または一覧の版が変わりました。原稿一覧を取得し直してください。");
    }
  }

  async function readBranch(branch = selectedBranch.current) {
    const version = ++branchReadVersion.current;
    loadedSnapshot.current = null;
    setSnapshot(null);
    setDocuments([]);
    await workspace.persist();
    await workspace.refreshSaved();
    const selected = await request<GitSnapshot>("/snapshot" + query({ branch }));
    const [manifest, files] = await Promise.all([
      request<TaxonomySnapshot>("/manifest" + query({ ...selected })),
      request<RepositoryDocument[]>("/documents" + query({ ...selected })),
    ]);
    // ブランチ名だけでなく部品契約も一致させる。別版CMSで静かに丸め込まない。
    // Listing an older branch is safe; validate its contract after main synchronization.
    if (
      !branch.startsWith("content/") &&
      (manifest as { contractHash?: string }).contractHash !== schema.contractHash
    ) {
      throw new Error("EDITOR_CONTRACT_VERSION_UNSUPPORTED");
    }
    if (version !== branchReadVersion.current || branch !== selectedBranch.current) {
      throw new Error("読み込み元が変わりました。選択中のブランチで原稿一覧を取得してください。");
    }
    loadedSnapshot.current = selected;
    setSnapshot(selected);
    setRepositoryManifest(manifest);
    setDocuments(files);
    return { snapshot: selected, manifest, documents: files };
  }

  async function prepareWorkspace(
    plan: BranchPlan,
    pinnedSource?: GitSnapshot,
  ): Promise<PreparedWorkspace> {
    if (plan.mode === "local") {
      return { snapshot: null, manifest: schema as TaxonomySnapshot, sourceBranch: "main" };
    }
    if (!auth.authenticated) throw new Error("AUTH_REQUIRED");
    assertWorkingBranch(plan.targetBranch);
    let selected: GitSnapshot;
    if (plan.mode === "new") {
      const source =
        pinnedSource ??
        (await request<GitSnapshot>("/snapshot" + query({ branch: plan.sourceBranch })));
      selected = await request<GitSnapshot>("/branch", {
        method: "POST",
        body: { source, target: plan.targetBranch },
      });
      setBranches((current) => [...new Set([...current, selected.branch])]);
    } else {
      selected = await request<GitSnapshot>("/snapshot" + query({ branch: plan.targetBranch }));
    }
    const manifest = await request<TaxonomySnapshot>("/manifest" + query({ ...selected }));
    if ((manifest as { contractHash?: string }).contractHash !== schema.contractHash) {
      throw new Error("EDITOR_CONTRACT_VERSION_UNSUPPORTED");
    }
    return {
      snapshot: selected,
      manifest,
      sourceBranch: plan.mode === "new" ? plan.sourceBranch : "main",
    };
  }

  async function prepareLocalWorkspace(
    local: LocalDraft,
    plan: BranchPlan,
  ): Promise<Partial<LocalDraft>> {
    if (
      local.workingBranch &&
      (plan.mode !== "existing" || plan.targetBranch !== local.workingBranch)
    ) {
      throw new Error("下書きは元の作業ブランチで続けてください。");
    }
    if (
      plan.mode === "local" ||
      (plan.mode === "existing" && plan.targetBranch === local.workingBranch)
    )
      return {};
    const prepared = await prepareWorkspace(
      plan,
      plan.mode === "new" && local.baseCommit
        ? {
            branch: local.workingBranch || local.sourceBranch,
            commit: local.baseCommit,
          }
        : undefined,
    );
    if (!prepared.snapshot) return {};
    // Joining another branch must not hide a conflicting remote article behind a fresh head.
    const remote = await request<{ source: string }>(
      "/document" + query({ ...prepared.snapshot, path: local.path }),
    ).catch((failure: unknown) => {
      if (failure instanceof EditorApiError && failure.code === "GIT_NOT_FOUND")
        return { source: "" };
      throw failure;
    });
    const previous = local.baseSource ?? local.syncedSource ?? "";
    if (remote.source !== previous)
      throw new Error(
        "このブランチの原稿は下書きの保存元と異なります。元の作業ブランチを続けるか、下書きの保存元から新しいブランチを作成してください。",
      );
    const pending = reconcileRegistryChanges(prepared.manifest, local.pendingRegistryChanges);
    return {
      workingBranch: prepared.snapshot.branch,
      sourceBranch: local.baseCommit ? local.sourceBranch : prepared.sourceBranch,
      baseCommit: prepared.snapshot.commit,
      baseSource: remote.source,
      registrySnapshot: prepared.manifest,
      pendingRegistryChanges: pending,
    };
  }

  async function performOpenDocument(
    file: string,
    selected = snapshot,
    source = selected?.branch,
    intent?: "revise" | "drafts",
    localOnly = false,
    original?: GitSnapshot,
    selectedLocalId?: string,
  ) {
    if (!selected) {
      return;
    }
    if (intent === "drafts") {
      assertWorkingBranch(selected.branch);
      if (source !== selected.branch || localOnly) {
        throw new Error("下書きは読み込み元と同じ作業ブランチで続けてください。");
      }
    }
    const previousDraftId = workspace.current.current.id;
    const openingBranchVersion = branchReadVersion.current;
    await workspace.persist();
    let [document, manifest, originalDocument] = await Promise.all([
      request<{ source: string; path: string; blobSha: string }>(
        "/document" + query({ ...selected, path: file }),
      ),
      request<TaxonomySnapshot>("/manifest" + query({ ...selected })),
      original
        ? request<{ source: string }>("/document" + query({ ...original, path: file }))
        : undefined,
    ]);
    if (originalDocument && originalDocument.source !== document.source) {
      throw new Error(
        "選んだ原稿と作業ブランチの原稿が異なります。新しいブランチで改稿するか、作業ブランチの「下書きの続き」から開いてください。",
      );
    }
    const metadata = parseDraft(document.source).data;
    if (intent === "drafts" && !metadata.draft)
      throw new Error("公開済みの原稿です。「既存記事を改稿」から開いてください。");
    if (intent === "revise" && metadata.draft)
      throw new Error("下書きの原稿です。「下書きの続き」から開いてください。");
    let followed: DraftBranchSyncResult | null = null;
    const selectedBeforeFollow = selected.commit;
    if (intent === "drafts" && selected.branch.startsWith("content/")) {
      assertOpeningCurrent();
      followed = await requestMainSync(
        {
          branch: selected.branch,
          expectedHead: selected.commit,
          path: file,
          contentId: metadata.id,
        },
        true,
      );
      if (followed.status === "synced") {
        if (!followed.manifest || followed.previousHead !== selected.commit)
          throw Error("DRAFT_MAIN_RESPONSE_INVALID");
        selected = { branch: selected.branch, commit: followed.head };
        manifest = followed.manifest;
      }
    }
    if ((manifest as { contractHash?: string }).contractHash !== schema.contractHash) {
      throw new Error("EDITOR_CONTRACT_VERSION_UNSUPPORTED");
    }
    const openedSource = updateDraft(document.source, { draft: true });
    let opened: LocalDraft = {
      id: crypto.randomUUID(),
      source: openedSource,
      path: file,
      sourceBranch: source ?? selected.branch,
      workingBranch: !localOnly && selected.branch.startsWith("content/") ? selected.branch : "",
      baseCommit: selected.commit,
      baseSource: document.source,
      ...(intent === "drafts" && openedSource === document.source
        ? { syncedCommit: selected.commit, syncedSource: document.source }
        : {}),
      registrySnapshot: manifest,
      savedAt: new Date().toISOString(),
      producer: "mixed",
    };
    function assertOpeningCurrent() {
      if (workspace.current.current.id !== previousDraftId) {
        throw new Error("準備中に原稿が切り替わりました。開く原稿を選び直してください。");
      }
      if (openingBranchVersion !== branchReadVersion.current) {
        throw new Error("読み込み元または一覧の版が変わりました。開く原稿を選び直してください。");
      }
    }
    assertOpeningCurrent();
    const incoming = opened;
    const claimed = await claimGitDraft(incoming, selectedLocalId);
    workspace.requireExistingDraft(claimed.draft.id);
    const mergeIncoming = (local: LocalDraft) => {
      if (
        followed?.status === "synced" &&
        local.baseCommit === selectedBeforeFollow &&
        local.baseSource === incoming.baseSource
      ) {
        return acceptMainSync(
          local,
          {
            branch: incoming.workingBranch,
            expectedHead: selectedBeforeFollow,
            path: file,
            contentId: metadata.id,
          },
          followed,
        );
      }
      return mergeGitReopen(local, incoming);
    };
    opened = mergeIncoming(claimed.draft);
    let detachPrivateState = localOnly;
    let mediaWarning: string | undefined;
    try {
      let restoredFrom = opened;
      let remote = await findMediaSnapshot(restoredFrom);
      if (!remote && source?.startsWith("content/") && source !== selected.branch) {
        // A new Git branch has no private draft yet. Copy the source branch's local cache,
        // then detach its IDs so later sync/rejection cannot mutate the original draft.
        restoredFrom = { ...opened, sourceBranch: source, workingBranch: source };
        remote = await findMediaSnapshot(restoredFrom);
        detachPrivateState = true;
      }
      if (remote) {
        const restored = await restoreMediaSnapshot(restoredFrom, remote, opened);
        opened = {
          ...restored.draft,
          sourceBranch: opened.sourceBranch,
          workingBranch: opened.workingBranch,
        };
        if (
          opened.annotations === undefined &&
          opened.reviewRevision === undefined &&
          remote.draft.review
        )
          opened = {
            ...opened,
            annotations: validateReviewComments(
              remote.draft.review.comments,
              parseDraft(opened.source).data.id,
            ),
            reviewRevision: remote.draft.review.revision,
            syncedAnnotations: validateReviewComments(
              remote.draft.review.comments,
              parseDraft(opened.source).data.id,
            ),
          };
        if (restored.missing.length) {
          mediaWarning =
            "本文は読み込みましたが、未取得の画像があります: " + restored.missing.join("、");
        }
      } else {
        const missing = await missingDraftMedia(opened);
        if (missing.length) {
          mediaWarning =
            "本文は読み込みました。下書きに未登録の画像があります: " + missing.join("、");
        }
      }
    } catch (error) {
      mediaWarning =
        "本文は読み込みました。画像は未同期です: " +
        errorLabel(error instanceof Error ? error.message : "MEDIA_UNAVAILABLE");
    }
    if (detachPrivateState) {
      const {
        remoteDraftId: _remoteDraftId,
        remoteRevision: _remoteRevision,
        reviewRevision: _reviewRevision,
        syncedAnnotations: _syncedAnnotations,
        syncedCommit: _syncedCommit,
        syncedSource: _syncedSource,
        ...local
      } = opened;
      opened = { ...local, ...(localOnly ? { workingBranch: "" } : {}) };
      // restoreMediaSnapshot wrote new media records under opened.id, never under the source ID.
      for (const item of await localMedia(opened.id)) {
        const { remoteId: _remoteId, ...image } = item;
        await saveLocalMedia(image);
      }
    }
    // 取得を待つ間に入力された内容も保存してから画面を切り替える。
    assertOpeningCurrent();
    await workspace.persist();
    assertOpeningCurrent();
    const restored = opened;
    const merge = (latest: LocalDraft): LocalDraft => {
      if (!matchingLocalDrafts([latest], localDraftIdentity(incoming)!).length) {
        throw Error("準備中に下書きの保存先が変わりました。一覧から開き直してください。");
      }
      let next = mergeIncoming(latest);
      if (restored.remoteDraftId && !detachPrivateState) {
        next = {
          ...next,
          remoteDraftId: restored.remoteDraftId,
          remoteRevision: Math.max(
            restored.remoteRevision ?? 0,
            next.remoteDraftId === restored.remoteDraftId ? (next.remoteRevision ?? 0) : 0,
          ),
        };
      }
      if (
        latest.annotations === undefined &&
        latest.reviewRevision === undefined &&
        restored.annotations
      ) {
        next = {
          ...next,
          annotations: restored.annotations,
          ...(restored.syncedAnnotations ? { syncedAnnotations: restored.syncedAnnotations } : {}),
          ...(restored.reviewRevision !== undefined
            ? { reviewRevision: restored.reviewRevision }
            : {}),
        };
      }
      return next;
    };
    opened = await updateLocalDraft(opened.id, opened, merge, { requireExistingActive: true });
    assertOpeningCurrent();
    if (workspace.current.current.id === opened.id) {
      workspace.setDraft(merge);
    } else {
      await workspace.openLocal(opened, { requireExistingActive: true });
    }
    if (workspace.current.current.id !== opened.id) {
      throw new Error("準備中に原稿が切り替わりました。開く原稿を選び直してください。");
    }
    setRepositoryManifest(manifest);
    if (!claimed.created) {
      onNotice(
        hasLocalSourceChanges(workspace.current.current) ||
          hasPendingRegistryChanges(workspace.current.current)
          ? "この端末の下書きを再開しました。Git未保存の編集を保持しています。"
          : "この端末の下書きを最新のGit原稿で再開しました。",
      );
    }
    setMainSync(followed);
    if (followed?.status === "conflict")
      onNotice(
        "mainとの競合があります。下書きはそのまま開きました。「保存と確認」でAIへの引継ぎ情報を取得できます。",
      );
    if (mediaWarning) {
      onError(mediaWarning);
    }
  }

  async function openDocument(...args: Parameters<typeof performOpenDocument>) {
    if (documentOpening.current) throw Error("原稿を読み込み中です。完了までお待ちください。");
    documentOpening.current = true;
    try {
      await performOpenDocument(...args);
    } catch (error) {
      await workspace.refreshSaved().catch(() => {});
      throw error;
    } finally {
      documentOpening.current = false;
    }
  }

  async function openSelectedDocument(
    file: string,
    plan: BranchPlan,
    intent: "revise" | "drafts",
    selected: GitSnapshot,
    selectedLocalId?: string,
  ) {
    assertCurrentSelection(selected);
    if (plan.sourceBranch !== selected.branch) {
      throw new Error("読み込み元が変わりました。開く原稿を選び直してください。");
    }
    if (intent === "drafts") {
      assertWorkingBranch(selected.branch);
      if (plan.mode !== "existing" || plan.targetBranch !== selected.branch) {
        throw new Error("下書きは読み込み元と同じ作業ブランチで続けてください。");
      }
      // 一覧で選んだ版を開く。別ブランチの同じ path や最新 head に差し替えない。
      await openDocument(
        file,
        selected,
        selected.branch,
        intent,
        false,
        undefined,
        selectedLocalId,
      );
      return;
    }
    const prepared =
      plan.mode === "local"
        ? { snapshot: selected, sourceBranch: selected.branch }
        : await prepareWorkspace(plan, plan.mode === "new" ? selected : undefined);
    assertCurrentSelection(selected);
    if (!prepared.snapshot) return;
    await openDocument(
      file,
      prepared.snapshot,
      prepared.sourceBranch,
      intent,
      plan.mode === "local",
      plan.mode === "existing" &&
        (prepared.snapshot.branch !== selected.branch ||
          prepared.snapshot.commit !== selected.commit)
        ? selected
        : undefined,
      selectedLocalId,
    );
  }

  async function followCurrentDraft(apply = true): Promise<DraftBranchSyncResult | null> {
    const initial = workspace.current.current;
    if (!initial.workingBranch || !initial.baseCommit) return null;
    if (mainSyncRunning.current) throw Error("mainとの同期処理中です。");
    mainSyncRunning.current = true;
    try {
      const input = mainSyncIdentity(initial);
      await workspace.persist("main追従前");
      const result = await requestMainSync(input, apply);
      if (workspace.current.current.id !== initial.id)
        throw Error("下書きが切り替わりました。元の下書きを開き直してください。");
      if (result.status === "synced") {
        // If the local registry has an unresolved conflict, keep the original local
        // bytes and report it rather than dropping pending operations.
        const updated = await updateLocalDraft(
          initial.id,
          initial,
          (stored) =>
            acceptMainSync(
              workspace.current.current.id === initial.id ? workspace.current.current : stored,
              input,
              result,
            ),
          { requireExistingActive: true },
        );
        if (workspace.current.current.id === initial.id)
          workspace.setDraft((current) => acceptMainSync(current, input, result));
        if (updated.id === workspace.current.current.id) await workspace.persist("main追従結果");
        onNotice(
          (result.manifest as { contractHash?: string } | undefined)?.contractHash !==
            schema.contractHash
            ? "mainの新しい部品契約を取り込みました。CMSを更新してください。"
            : "mainの変更を取り込みました。",
        );
      }
      setMainSync(result);
      return result;
    } finally {
      mainSyncRunning.current = false;
    }
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
      if (submitted.workingBranch && submitted.baseCommit) {
        const currentBefore = workspace.current.current;
        if (currentBefore.id !== submitted.id) throw Error("下書きが切り替わりました。");
        const followed = await followCurrentDraft();
        if (followed?.status === "conflict")
          throw Error(
            "mainとの競合があります。下書きは保全しました。「保存と確認」の競合情報を使って解消してください。",
          );
        if (followed?.status === "synced")
          submitted = acceptMainSync(submitted, mainSyncIdentity(submitted), followed);
        const latest = workspace.current.current;
        if (latest.id !== submitted.id || latest.baseCommit !== submitted.baseCommit)
          throw Error("下書きが更新されました。");
      }
      if (
        submitted.registrySnapshot &&
        (submitted.registrySnapshot as { contractHash?: string }).contractHash !==
          schema.contractHash
      )
        throw Error("EDITOR_CONTRACT_VERSION_UNSUPPORTED");
      if (submitted.pendingRegistryChanges) {
        const manifest = await request<TaxonomySnapshot>(
          "/manifest" + query({ branch: submitted.workingBranch, commit: submitted.baseCommit }),
        );
        submitted = {
          ...submitted,
          pendingRegistryChanges: reconcileRegistryChanges(
            manifest,
            submitted.pendingRegistryChanges,
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
        workspace.setDraft((current) => (current.id === submitted.id ? merge(current) : current));
      }
      // A response for a closed document must preserve edits made after submission.
      await updateLocalDraft(submitted.id, submitted, (stored) =>
        merge(workspace.current.current.id === submitted.id ? workspace.current.current : stored),
      );
      if (workspace.current.current.id === submitted.id) {
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
        setMainSync((current) =>
          current?.branch === submitted.workingBranch &&
          current.head === submitted.baseCommit &&
          current.status !== "conflict"
            ? { ...current, head: result.commit }
            : current,
        );
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
        pendingRegistryChanges:
          registry === "remote" ? undefined : reconcileRegistryChanges(conflict.manifest, pending),
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
    repositoryManifest,
    issues,
    pr,
    conflict,
    resolveConflict,
    logout,
    readBranch,
    prepareWorkspace,
    prepareLocalWorkspace,
    openDocument,
    openSelectedDocument,
    saveGit,
    mainSync,
    followCurrentDraft,
    createPR,
  };
}
export type GitWorkspace = ReturnType<typeof useGitWorkspace>;
