import type { ReviewComment } from "@xpotato/editor-core/annotations";
import { request, query, fetchPrivateMedia } from "./api.js";
import { localMedia, saveRestoredMedia, type LocalDraft } from "./storage.js";
import { hashBlob } from "../media/optimize.js";
import { draftPath, parseDraft } from "@xpotato/editor-core/draft";
import { assertMediaBudget, type MediaKind } from "@xpotato/editor-core/policy";
import { articleMediaReferences } from "@xpotato/portable-content/media";
export interface RemoteDraft {
  id: string;
  contentId: string;
  branch: string;
  commit: string;
  sourcePath?: string;
  revision: number;
  lastEditedAt: string;
  state: string;
  assets: Record<string, string>;
  holdUntil?: string;
  reviewUntil?: string;
  review?: { revision: number; comments: ReviewComment[] };
}
export interface RemoteAsset {
  id: string;
  draftId: string;
  assetId: string;
  sha256: string;
  sourceSha256: string;
  bytes: number;
  sourceBytes: number;
  mime: string;
  kind: MediaKind;
  createdAt: string;
  status: "staged" | "rejected" | "deleting" | "promoted";
  transform: string;
  sourceRetained: boolean;
  width: number;
  height: number;
  frames: number;
  durationMs: number;
}
export interface RemoteMediaSnapshot {
  draft: RemoteDraft;
  assets: RemoteAsset[];
}
export function assertRemoteMediaIdentity(local: LocalDraft, remote: RemoteMediaSnapshot): void {
  if (
    remote.draft.state === "deleted" ||
    remote.draft.contentId !== parseDraft(local.source).data.id ||
    remote.draft.branch !== (local.workingBranch || local.sourceBranch) ||
    (remote.draft.sourcePath ?? draftPath(remote.draft.contentId)) !== local.path
  ) {
    throw Error("DRAFT_MEDIA_IDENTITY_MISMATCH");
  }
}

export async function missingDraftMedia(draft: LocalDraft): Promise<string[]> {
  const parsed = parseDraft(draft.source);
  const referenced = new Set(articleMediaReferences(parsed.body));
  if (typeof parsed.data.hero === "string" && parsed.data.hero) {
    referenced.add(parsed.data.hero);
  }
  const available = new Set((await localMedia(draft.id)).map((item) => item.assetId));
  return [...referenced].filter((assetId) => !available.has(assetId));
}

export async function findMediaSnapshot(draft: LocalDraft): Promise<RemoteMediaSnapshot | null> {
  if (draft.remoteDraftId) {
    const remote = await request<RemoteMediaSnapshot>(
      "/draft" + query({ id: draft.remoteDraftId }),
    );
    assertRemoteMediaIdentity(draft, remote);
    return remote;
  }
  const id = parseDraft(draft.source).data.id,
    branch = draft.workingBranch || draft.sourceBranch;
  const candidates = (await request<RemoteDraft[]>("/drafts")).filter(
    (item) => item.contentId === id && item.branch === branch && item.state !== "deleted",
  );
  if (candidates.length > 1) throw Error("DRAFT_MEDIA_AMBIGUOUS");
  if (!candidates[0]) {
    return null;
  }
  const remote = await request<RemoteMediaSnapshot>("/draft" + query({ id: candidates[0].id }));
  assertRemoteMediaIdentity(draft, remote);
  return remote;
}
export async function restoreMediaSnapshot(
  local: LocalDraft,
  remote: RemoteMediaSnapshot,
  storageDraft: LocalDraft = local,
): Promise<{ draft: LocalDraft; missing: string[] }> {
  assertRemoteMediaIdentity(local, remote);
  if (
    storageDraft.id !== local.id ||
    storageDraft.path !== local.path ||
    parseDraft(storageDraft.source).data.id !== parseDraft(local.source).data.id
  ) {
    throw Error("DRAFT_MEDIA_IDENTITY_MISMATCH");
  }
  const cached = await localMedia(local.id),
    missing: string[] = [];
  for (const [assetId, id] of Object.entries(remote.draft.assets)) {
    const asset = remote.assets.find(
      (item) =>
        item.id === id &&
        item.draftId === remote.draft.id &&
        item.assetId === assetId &&
        item.status === "staged",
    );
    if (!asset) {
      missing.push(assetId);
      continue;
    }
    const matches = cached.filter((item) => item.assetId === assetId);
    if (matches.length > 1) {
      missing.push(assetId + "（端末内の画像が重複）");
      continue;
    }
    const existing = matches[0];
    if (existing && !existing.remoteId && existing.sha256 !== asset.sha256) {
      missing.push(assetId + "（端末内の変更と競合）");
      continue;
    }
    if (existing?.sha256 === asset.sha256 && existing.remoteId === asset.id) {
      try {
        if (
          existing.blob.size === asset.bytes &&
          existing.blob.type === asset.mime &&
          (await hashBlob(existing.blob)) === asset.sha256
        ) {
          continue;
        }
      } catch {
        // Matching metadata does not prove that a legacy IndexedDB Blob is still readable.
      }
    }
    try {
      assertMediaBudget(asset.kind, asset.bytes);
      const fetched = await fetchPrivateMedia(asset.id);
      const blob = new Blob([await fetched.arrayBuffer()], { type: asset.mime });
      if (blob.size !== asset.bytes || (await hashBlob(blob)) !== asset.sha256)
        throw Error("MEDIA_HASH_MISMATCH");
      await saveRestoredMedia(
        {
          id: existing?.id ?? crypto.randomUUID(),
          draftId: local.id,
          assetId,
          blob,
          originalBytes: asset.sourceBytes,
          sourceSha256: asset.sourceSha256,
          sha256: asset.sha256,
          kind: asset.kind,
          transform: asset.transform,
          createdAt: asset.createdAt,
          remoteId: asset.id,
          originalName: assetId,
          sourceRetained: asset.sourceRetained,
        },
        existing,
        storageDraft,
      );
    } catch (error) {
      missing.push(
        error instanceof Error && error.message === "DRAFT_MEDIA_LOCAL_CONFLICT"
          ? assetId + "（端末内の変更と競合）"
          : assetId,
      );
    }
  }
  return {
    draft: { ...local, remoteDraftId: remote.draft.id, remoteRevision: remote.draft.revision },
    missing: [...new Set([...missing, ...(await missingDraftMedia(local))])],
  };
}
