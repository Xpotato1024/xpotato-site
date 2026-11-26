import { parseDraft, updateDraft } from "@xpotato/editor-core/draft";
import type { LocalDraft } from "./storage.js";

export interface LocalDraftIdentity {
  contentId: string;
  path: string;
  workingBranch: string;
  sourceBranch: string;
}

export function localDraftIdentity(draft: LocalDraft): LocalDraftIdentity | null {
  // 構文を編集中でも、元の原稿が分かる下書きを別コピーにしない。
  for (const source of [draft.source, draft.baseSource, draft.syncedSource]) {
    if (source === undefined) continue;
    try {
      return {
        contentId: parseDraft(source).data.id,
        path: draft.path,
        workingBranch: draft.workingBranch,
        sourceBranch: draft.sourceBranch,
      };
    } catch {
      continue;
    }
  }
  return null;
}

export function matchingLocalDrafts(
  drafts: readonly LocalDraft[],
  identity: LocalDraftIdentity,
): LocalDraft[] {
  return drafts.filter((draft) => {
    if (draft.archived) return false;
    const candidate = localDraftIdentity(draft);
    return (
      candidate?.contentId === identity.contentId &&
      candidate.path === identity.path &&
      candidate.workingBranch === identity.workingBranch &&
      (identity.workingBranch !== "" || candidate.sourceBranch === identity.sourceBranch)
    );
  });
}

export function hasPendingRegistryChanges(draft: LocalDraft): boolean {
  return Object.entries(draft.pendingRegistryChanges ?? {}).some(
    ([key, value]) =>
      key !== "seriesBase" && (Array.isArray(value) ? value.length > 0 : value != null),
  );
}

export function hasLocalSourceChanges(draft: LocalDraft): boolean {
  const saved = draft.syncedSource ?? draft.baseSource;
  if (saved === undefined) return true;
  if (draft.source === saved) return false;
  try {
    return draft.source !== updateDraft(saved, { draft: true });
  } catch {
    return true;
  }
}

/** Refresh an unchanged Git copy while retaining local text, review and registry edits. */
export function mergeGitReopen(current: LocalDraft, incoming: LocalDraft): LocalDraft {
  if (hasLocalSourceChanges(current) || hasPendingRegistryChanges(current)) return current;
  const {
    syncedCommit: _syncedCommit,
    syncedSource: _syncedSource,
    baseSource: _baseSource,
    registrySnapshot: _registrySnapshot,
    ...local
  } = current;
  return {
    ...local,
    source: incoming.source,
    baseCommit: incoming.baseCommit,
    ...(incoming.baseSource !== undefined ? { baseSource: incoming.baseSource } : {}),
    ...(incoming.registrySnapshot ? { registrySnapshot: incoming.registrySnapshot } : {}),
    ...(incoming.syncedCommit ? { syncedCommit: incoming.syncedCommit } : {}),
    ...(incoming.syncedSource !== undefined ? { syncedSource: incoming.syncedSource } : {}),
  };
}
