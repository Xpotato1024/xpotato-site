import { parseDraft } from "@xpotato/editor-core/draft";
import { validateReviewComments, type ReviewComment } from "@xpotato/editor-core/annotations";
import { request } from "./api.js";
import { findMediaSnapshot, assertRemoteMediaIdentity, type RemoteDraft } from "./media-sync.js";
import type { LocalDraft } from "./storage.js";

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export type ReviewReceipt = Pick<
  LocalDraft,
  "remoteDraftId" | "remoteRevision" | "reviewRevision" | "syncedAnnotations"
>;

/** A review is private; no part of the payload is sent to the Git save API. */
export async function syncDraftReview(draft: LocalDraft): Promise<ReviewReceipt | null> {
  if (
    draft.annotations === undefined ||
    (!draft.annotations.length && draft.reviewRevision === undefined)
  )
    return null;
  if (!draft.workingBranch || !draft.baseCommit)
    throw Error("先に原稿の作業ブランチを確定してください。");
  const contentId = parseDraft(draft.source).data.id;
  const comments = validateReviewComments(draft.annotations, contentId);
  const found = await findMediaSnapshot(draft);
  const remote =
    found?.draft ??
    (await request<RemoteDraft>("/drafts", {
      method: "POST",
      body: {
        id: draft.remoteDraftId ?? draft.id,
        contentId,
        branch: draft.workingBranch,
        commit: draft.baseCommit,
        sourcePath: draft.path,
      },
    }));
  assertRemoteMediaIdentity(draft, { draft: remote, assets: [] });
  const incoming = validateReviewComments(remote.review?.comments ?? [], contentId);
  const revision = remote.review?.revision ?? 0;
  const receipt = (reviewRevision: number, remoteRevision: number): ReviewReceipt => ({
    remoteDraftId: remote.id,
    remoteRevision,
    reviewRevision,
    syncedAnnotations: structuredClone(comments),
  });
  if (equal(incoming, comments)) return receipt(revision, remote.revision);
  if (
    revision !== (draft.reviewRevision ?? 0) ||
    incoming.some((c) => !comments.some((local) => local.id === c.id))
  ) {
    throw Error("別の端末の添削があります。添削の「取得」で差分を確認してください。");
  }
  const result = await request<{
    review: { revision: number; comments: ReviewComment[] };
    revision: number;
  }>("/draft-review", {
    method: "POST",
    body: { id: remote.id, expectedRevision: revision, comments },
  });
  if (!equal(validateReviewComments(result.review.comments, contentId), comments))
    throw Error("添削の保存結果が一致しません。");
  return receipt(result.review.revision, result.revision);
}

/** Keep local additions and changes while bringing in non-conflicting remote updates. */
export function mergeRemoteReview(current: LocalDraft, remote: RemoteDraft): LocalDraft {
  const incoming = validateReviewComments(
    remote.review?.comments ?? [],
    parseDraft(current.source).data.id,
  );
  const base = new Map((current.syncedAnnotations ?? []).map((c) => [c.id, c]));
  const local = new Map((current.annotations ?? []).map((c) => [c.id, c]));
  for (const c of incoming) {
    const before = base.get(c.id);
    const existing = local.get(c.id);
    if (existing && !equal(existing, c)) {
      if (before && equal(existing, before)) local.set(c.id, c);
      else if (!(before && equal(c, before)))
        throw Error(
          "同じ指摘が別の端末で変更されています。手元の添削を書き出して差分を確認してください。",
        );
    } else local.set(c.id, c);
  }
  return {
    ...current,
    annotations: [...local.values()],
    remoteDraftId: remote.id,
    remoteRevision: remote.revision,
    reviewRevision: remote.review?.revision ?? 0,
    syncedAnnotations: structuredClone(incoming),
  };
}
