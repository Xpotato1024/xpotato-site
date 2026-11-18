import {
  createDraftForCollection,
  draftPath,
  parseDraft,
  type TaxonomySnapshot,
} from "@xpotato/editor-core/draft";
import { remainingRegistryChanges } from "@xpotato/editor-core/registry";
import type { ContentCollection } from "@xpotato/content-contracts/common";
import type { LocalDraft } from "../../data/storage.js";

export type DraftKind = ContentCollection | "education";
export function createLocalDraft(
  kind: DraftKind = "blog",
  options: { education?: boolean } = {},
): LocalDraft {
  const collection = kind === "education" ? "blog" : kind;
  const source = createDraftForCollection({
    collection,
    education: options.education ?? kind === "education",
  });
  return {
    id: crypto.randomUUID(),
    source,
    path: draftPath(parseDraft(source).data.id, collection),
    sourceBranch: "main",
    workingBranch: "",
    baseCommit: "",
    savedAt: new Date().toISOString(),
    producer: "human",
  };
}

export function parseLocalDraft(source: string) {
  try {
    return parseDraft(source);
  } catch {
    // 入力途中のMDXを破棄せず、ソース編集から修復できる状態を保つ。
    return null;
  }
}

/** The returned record belongs to the submitted draft, not necessarily the open one. */
export function mergeGitSaveResult(
  current: LocalDraft,
  submitted: LocalDraft,
  commit: string,
): LocalDraft {
  // 保存中の入力を失わない。別の記事へ移動した場合は送信した記事だけを同期する。
  const latest = current.id === submitted.id ? current : submitted;
  return {
    ...latest,
    workingBranch: submitted.workingBranch,
    sourceBranch: submitted.sourceBranch,
    baseCommit: commit,
    syncedCommit: commit,
    syncedSource: submitted.source,
  };
}

/** A successful commit remains recorded even when edits made during the save need review. */
export function acceptGitSaveResult(
  current: LocalDraft,
  submitted: LocalDraft,
  commit: string,
  manifest: TaxonomySnapshot,
): { draft: LocalDraft; registryConflict: boolean } {
  if (
    current.id === submitted.id &&
    current.syncedCommit === commit &&
    current.syncedSource === submitted.source
  )
    return { draft: current, registryConflict: false };
  const merged = mergeGitSaveResult(current, submitted, commit);
  let pending = merged.pendingRegistryChanges;
  let registryConflict = false;
  try {
    pending = remainingRegistryChanges(pending, submitted.pendingRegistryChanges);
  } catch {
    registryConflict = true;
  }
  return {
    draft: {
      ...merged,
      registrySnapshot: manifest,
      baseSource: submitted.source,
      pendingRegistryChanges: pending,
    },
    registryConflict,
  };
}

export function mergeMediaSyncResult(current: LocalDraft, synced: LocalDraft): LocalDraft {
  if (current.id !== synced.id) {
    return current;
  }
  // 媒体同期は本文の保存ではない。古い原稿を含む応答から本文を復元しない。
  return {
    ...current,
    ...(synced.remoteDraftId ? { remoteDraftId: synced.remoteDraftId } : {}),
    ...(synced.remoteRevision !== undefined ? { remoteRevision: synced.remoteRevision } : {}),
  };
}
