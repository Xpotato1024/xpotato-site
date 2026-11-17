import { createDraft, draftPath, parseDraft } from "@xpotato/editor-core/draft";
import type { LocalDraft } from "../../data/storage.js";

export function createLocalDraft(): LocalDraft {
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
