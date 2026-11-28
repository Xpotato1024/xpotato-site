import type { DraftBranchIdentity, DraftBranchSyncResult } from "@xpotato/editor-core/draft-branch";
import { reconcileRegistryChanges } from "@xpotato/editor-core/registry";
import { parseDraft } from "@xpotato/editor-core/draft";
import { request } from "./api.js";
import type { LocalDraft } from "./storage.js";

export function mainSyncIdentity(draft: LocalDraft): DraftBranchIdentity {
  if (!draft.workingBranch || !draft.baseCommit) throw Error("Gitの下書きを開いてください。");
  return {
    branch: draft.workingBranch,
    expectedHead: draft.baseCommit,
    path: draft.path,
    contentId: parseDraft(draft.baseSource || draft.syncedSource || draft.source).data.id,
  };
}
export const requestMainSync = (input: DraftBranchIdentity, apply: boolean) =>
  request<DraftBranchSyncResult>("/draft-main", { method: "POST", body: { ...input, apply } });
/** A main merge does not save unsaved local source or change the draft/annotation/asset IDs. */
export function acceptMainSync(
  draft: LocalDraft,
  input: DraftBranchIdentity,
  result: DraftBranchSyncResult,
): LocalDraft {
  if (result.status !== "synced") return draft;
  if (
    draft.workingBranch === input.branch &&
    draft.path === input.path &&
    draft.baseCommit === result.head
  )
    return draft;
  if (
    draft.workingBranch !== input.branch ||
    draft.path !== input.path ||
    draft.baseCommit !== input.expectedHead ||
    result.branch !== input.branch ||
    result.previousHead !== input.expectedHead ||
    !result.manifest
  )
    throw Error("下書きが更新されました。原稿を開き直してください。");
  let pending = draft.pendingRegistryChanges;
  try {
    pending = reconcileRegistryChanges(result.manifest, pending);
  } catch {
    /* Keep the original pending operation and base; saving will detect its conflict. */
  }
  return {
    ...draft,
    baseCommit: result.head,
    registrySnapshot: result.manifest,
    ...(draft.syncedCommit === input.expectedHead ? { syncedCommit: result.head } : {}),
    ...(pending ? { pendingRegistryChanges: pending } : { pendingRegistryChanges: undefined }),
  };
}
export function mainSyncLabel(state: DraftBranchSyncResult | null, draft: LocalDraft): string {
  if (!draft.workingBranch) return "Gitに未接続";
  if (!state || state.branch !== draft.workingBranch || state.head !== draft.baseCommit)
    return "mainとの同期状態は未確認";
  if (state.status === "conflict") return "mainとの競合：原稿と添削は保持されています";
  if (state.status === "ready") return "mainから " + state.behind + " コミット遅れ";
  return "main追従済み（確認時点）";
}
export function conflictHandoff(draft: LocalDraft, state: DraftBranchSyncResult) {
  const input = mainSyncIdentity(draft);
  if (
    state.status !== "conflict" ||
    state.head !== input.expectedHead ||
    state.branch !== input.branch
  )
    throw Error("競合情報を再取得してください。");
  return {
    protocol: "xpotato-draft-main-conflict-v1",
    ...input,
    main: state.main,
    ancestor: state.ancestor,
    conflicts: state.conflicts,
    source: draft.source,
    baseSource: draft.baseSource,
    annotations: draft.annotations ?? [],
    pendingRegistryChanges: draft.pendingRegistryChanges,
    instructions:
      "固定SHAの三方向差分を取得し、原稿・未同期変更・指摘・画像IDを保持する。同一contentブランチのみ非force push。mainを変更しない。",
  };
}
