import { assertEditablePath, draftPath } from "@xpotato/editor-core/draft";
import { assertWorkingBranch } from "@xpotato/editor-core/git";
import { assertMediaBudget, mediaPolicy, type MediaKind } from "@xpotato/editor-core/policy";
import { inspectImage } from "@xpotato/editor-core/image-inspection";
import { retentionDecision, canCollectAsset } from "@xpotato/editor-core/retention";
import {
  DraftStore,
  requireDraft,
  safeUUID,
  safeAssetId,
  safeHash,
  assetKey,
  type DraftRecord,
  type AssetRecord,
  type Reservation,
} from "./state.js";
import { APIError } from "./types.js";
const iso = (value: number) => new Date(value).toISOString();
export async function createDraftRecord(
  store: DraftStore,
  input: { id: string; contentId: string; branch: string; commit: string; sourcePath?: string },
): Promise<DraftRecord> {
  safeUUID(input.id);
  safeUUID(input.contentId);
  assertWorkingBranch(input.branch);
  const sourcePath = input.sourcePath ?? draftPath(input.contentId);
  assertEditablePath(sourcePath);
  if (!/^content\//u.test(input.branch) || !/^[a-f0-9]{40}$/u.test(input.commit))
    throw new APIError("DRAFT_SOURCE_INVALID");
  return store.transact((state) => {
    const exists = state.drafts[input.id];
    if (exists) {
      if (
        exists.contentId !== input.contentId ||
        exists.branch !== input.branch ||
        (exists.sourcePath ?? draftPath(exists.contentId)) !== sourcePath
      )
        throw new APIError("CONTENT_ID_IMMUTABLE");
      if (exists.state === "deleted") {
        throw new APIError("DRAFT_NOT_FOUND", 404);
      }
    }
    const candidates = Object.values(state.drafts).filter(
      (draft) =>
        draft.contentId === input.contentId &&
        draft.branch === input.branch &&
        draft.state !== "deleted",
    );
    if (candidates.length > 1) {
      throw new APIError("DRAFT_MEDIA_AMBIGUOUS", 409);
    }
    const candidate = candidates[0];
    if (candidate) {
      if ((candidate.sourcePath ?? draftPath(candidate.contentId)) !== sourcePath) {
        throw new APIError("DRAFT_MEDIA_IDENTITY_MISMATCH", 409);
      }
      // Device-local UUIDs differ. Reuse the same branch's private state without rewinding
      // the commit or revision advanced by another editor or the Git activity webhook.
      return candidate;
    }
    const record: DraftRecord = {
      ...input,
      sourcePath,
      revision: 1,
      lastEditedAt: iso(store.now()),
      state: "active",
      assets: {},
    };
    state.drafts[input.id] = record;
    store.log(state, "draft.create", input.id);
    return record;
  });
}
export async function reserveMedia(
  store: DraftStore,
  input: Omit<Reservation, "id" | "expires" | "status">,
): Promise<Reservation> {
  safeUUID(input.draftId);
  safeAssetId(input.assetId);
  safeHash(input.sha256);
  safeHash(input.sourceSha256);
  if (!["photo", "technical", "animation"].includes(input.kind))
    throw new APIError("MEDIA_KIND_INVALID");
  assertMediaBudget(input.kind, input.bytes);
  if (
    !Number.isSafeInteger(input.sourceBytes) ||
    input.sourceBytes <= 0 ||
    input.sourceBytes > mediaPolicy.inputBytes ||
    !Number.isSafeInteger(input.expectedDraftRevision) ||
    typeof input.sourceRetained !== "boolean" ||
    typeof input.transform !== "string" ||
    input.transform.length > 120
  )
    throw new APIError("MEDIA_SOURCE_INVALID");
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(input.mime))
    throw new APIError("HEIC_CONVERSION_REQUIRED");
  const reservation: Reservation = {
    ...input,
    id: crypto.randomUUID(),
    expires: store.now() + mediaPolicy.leaseMs,
    status: "pending",
  };
  return store.transact((state) => {
    requireDraft(state, input.draftId, input.expectedDraftRevision);
    store.assertCapacity(state, input.bytes);
    if (Object.keys(state.reservations).length >= 32)
      throw new APIError("UPLOAD_CONCURRENCY_LIMIT", 429);
    state.reservations[reservation.id] = reservation;
    store.log(state, "media.reserve", reservation.id);
    return reservation;
  });
}
async function boundedBody(request: Request, maximum: number): Promise<Uint8Array> {
  if (!request.body) throw new APIError("MEDIA_EMPTY");
  const reader = request.body.getReader(),
    parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new APIError("MEDIA_BYTES_LIMIT", 413);
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const value of parts) {
    result.set(value, offset);
    offset += value.length;
  }
  return result;
}
export async function uploadMedia(
  store: DraftStore,
  id: string,
  request: Request,
): Promise<AssetRecord> {
  safeUUID(id);
  const reservation = await store.transact((state) => {
    const value = state.reservations[id];
    if (!value || value.expires < store.now()) throw new APIError("UPLOAD_EXPIRED", 410);
    if (value.status === "uploading") throw new APIError("UPLOAD_BUSY", 409);
    requireDraft(state, value.draftId, value.expectedDraftRevision);
    value.status = "uploading";
    return { ...value };
  });
  let written = false;
  try {
    const bytes = await boundedBody(request, reservation.bytes);
    if (bytes.length !== reservation.bytes) throw new APIError("UPLOAD_SIZE_MISMATCH");
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer)),
    )
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    if (hash !== reservation.sha256) throw new APIError("UPLOAD_HASH_MISMATCH");
    const inspected = inspectImage(bytes, reservation.kind);
    if (inspected.mime !== reservation.mime) throw new APIError("MEDIA_TYPE_MISMATCH");
    if (store.now() > reservation.expires) throw new APIError("UPLOAD_EXPIRED", 410);
    const key = assetKey(id, hash),
      stored = await store.bucket.put(key, bytes, {
        onlyIf: { etagDoesNotMatch: "*" },
        httpMetadata: { contentType: inspected.mime, cacheControl: "private, no-store" },
        customMetadata: {
          sha256: hash,
          draftId: reservation.draftId,
          assetId: reservation.assetId,
        },
        sha256: hash,
      });
    if (!stored) throw new APIError("OBJECT_ALREADY_EXISTS", 409);
    written = true;
    const head = await store.bucket.head(key);
    if (!head || head.size !== bytes.length) throw new APIError("MEDIA_READBACK_FAILED", 503);
    return await store.transact((state) => {
      const active = state.reservations[id];
      if (!active || active.expires < store.now()) throw new APIError("UPLOAD_EXPIRED", 410);
      const draft = requireDraft(state, active.draftId, active.expectedDraftRevision);
      const previous = state.assets[draft.assets[active.assetId] ?? ""];
      if (previous && previous.status === "staged") {
        previous.status = "rejected";
        previous.rejectedAt = iso(store.now());
      }
      const asset: AssetRecord = {
        id,
        key,
        draftId: active.draftId,
        assetId: active.assetId,
        sha256: hash,
        sourceSha256: active.sourceSha256,
        bytes: bytes.length,
        mime: inspected.mime,
        kind: active.kind,
        createdAt: iso(store.now()),
        status: "staged",
        transform: active.transform,
        sourceBytes: active.sourceBytes,
        sourceRetained: active.sourceRetained,
        width: inspected.width,
        height: inspected.height,
        frames: inspected.frames,
        durationMs: inspected.durationMs,
      };
      state.assets[id] = asset;
      state.usedBytes += bytes.length;
      delete state.reservations[id];
      draft.assets[active.assetId] = id;
      draft.revision++;
      draft.lastEditedAt = iso(store.now());
      draft.state = "active";
      delete draft.deleteAfter;
      delete draft.reviewUntil;
      store.log(state, "media.upload", id);
      return asset;
    });
  } catch (error) {
    // Unknown PUT outcomes keep the reservation charged until a reconciler checks its exact key.
    if (!written) {
      const exists = await store.bucket.head(assetKey(id, reservation.sha256));
      if (!exists)
        await store.transact((state) => {
          const current = state.reservations[id];
          if (current) current.status = "pending";
        });
    }
    throw error;
  }
}
export async function readMedia(store: DraftStore, id: string): Promise<Response> {
  safeUUID(id);
  const { state } = await store.read(),
    asset = state.assets[id];
  if (!asset || asset.status === "deleting") throw new APIError("MEDIA_NOT_FOUND", 404);
  const object = await store.bucket.get(asset.key);
  if (!object || object.size !== asset.bytes) throw new APIError("MEDIA_READBACK_FAILED", 503);
  return new Response(object.body, {
    headers: {
      "Content-Type": asset.mime,
      "Content-Length": String(asset.bytes),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
    },
  });
}
export async function editDraftState(
  store: DraftStore,
  input: {
    id: string;
    revision: number;
    action: "touch" | "archive" | "review" | "hold" | "unhold" | "reject" | "restore-media";
    assetId?: string;
    mediaId?: string;
    days?: number;
    commit?: string;
  },
) {
  safeUUID(input.id);
  if (!Number.isSafeInteger(input.revision)) throw new APIError("REVISION_REQUIRED");
  return store.transact((state) => {
    const draft = requireDraft(state, input.id, input.revision),
      now = store.now();
    if (input.action === "touch") {
      draft.state = "active";
      draft.lastEditedAt = iso(now);
      delete draft.deleteAfter;
      if (input.commit) {
        if (!/^[a-f0-9]{40}$/u.test(input.commit)) throw new APIError("COMMIT_INVALID");
        draft.commit = input.commit;
      }
      delete draft.reviewUntil;
    } else if (input.action === "archive") {
      draft.state = "archived";
    } else if (input.action === "review") {
      draft.reviewUntil = iso(now + 7 * 86400000);
    } else if (input.action === "hold") {
      if (!Number.isInteger(input.days) || input.days! < 1 || input.days! > 90)
        throw new APIError("HOLD_LIMIT");
      draft.holdUntil = iso(now + input.days! * 86400000);
    } else if (input.action === "unhold") delete draft.holdUntil;
    else if (input.action === "reject") {
      safeAssetId(input.assetId);
      const id = draft.assets[input.assetId];
      if (!id || !state.assets[id]) throw new APIError("MEDIA_NOT_FOUND", 404);
      const asset = state.assets[id]!;
      asset.status = "rejected";
      asset.rejectedAt = iso(now);
      delete draft.assets[input.assetId];
      delete draft.reviewUntil;
    } else if (input.action === "restore-media") {
      safeUUID(input.mediaId);
      const asset = state.assets[input.mediaId];
      if (!asset || asset.draftId !== draft.id || asset.status !== "rejected")
        throw new APIError("MEDIA_NOT_RESTORABLE", 409);
      if (draft.assets[asset.assetId]) throw new APIError("MEDIA_REFERENCE_CONFLICT", 409);
      asset.status = "staged";
      delete asset.rejectedAt;
      draft.assets[asset.assetId] = asset.id;
      draft.state = "active";
      draft.lastEditedAt = iso(now);
      delete draft.deleteAfter;
      delete draft.reviewUntil;
    } else throw new APIError("ACTION_INVALID");
    draft.revision++;
    store.log(state, "draft." + input.action, input.id);
    return draft;
  });
}
export async function collectDraftMedia(store: DraftStore, dryRun = true) {
  const { state } = await store.read(),
    now = store.now();
  const draftActions = Object.values(state.drafts).map((d) => ({
    id: d.id,
    action: retentionDecision(d, now),
  }));
  const eligible = Object.values(state.assets)
    .filter((asset) =>
      canCollectAsset(
        {
          ...asset,
          status: asset.status === "deleting" ? "rejected" : asset.status,
          references: Object.values(state.drafts)
            .filter((d) => d.state !== "deleted" && Object.values(d.assets).includes(asset.id))
            .map((d) => d.id),
        },
        now,
      ),
    )
    .map((a) => a.id);
  if (dryRun)
    return {
      dryRun: true,
      draftActions,
      assetIds: eligible,
      bytes: eligible.reduce((sum, id) => sum + state.assets[id]!.bytes, 0),
    };
  await store.transact((current) => {
    for (const draft of Object.values(current.drafts)) {
      const action = retentionDecision(draft, now);
      if (action === "archive" && draft.state !== "archived") {
        draft.state = "archived";
        draft.revision++;
      }
      if (action === "candidate" && draft.state !== "delete_candidate") {
        draft.state = "delete_candidate";
        draft.deleteAfter = iso(now + 30 * 86400000);
        draft.revision++;
      }
      if (action === "delete") {
        draft.state = "deleted";
        for (const id of Object.values(draft.assets)) {
          const asset = current.assets[id];
          if (asset && asset.status === "staged") {
            asset.status = "rejected";
            asset.rejectedAt = iso(now);
          }
        }
        draft.assets = {};
        draft.revision++;
        store.log(current, "draft.expire", draft.id);
      }
    }
  });
  let deleted = 0;
  for (const id of eligible) {
    const asset = await store.transact((current) => {
      const candidate = current.assets[id];
      if (!candidate) return null;
      const references = Object.values(current.drafts)
        .filter((d) => d.state !== "deleted" && Object.values(d.assets).includes(id))
        .map((d) => d.id);
      if (
        !canCollectAsset(
          {
            ...candidate,
            status: candidate.status === "deleting" ? "rejected" : candidate.status,
            references,
          },
          now,
        )
      )
        return null;
      candidate.status = "deleting";
      return { ...candidate };
    });
    if (!asset) continue;
    // This binding is dedicated to staging: no published object key or A/B/C credential exists here.
    if (asset.key !== assetKey(id, asset.sha256)) throw new APIError("GC_KEY_INVALID", 503);
    await store.bucket.delete(asset.key);
    if (await store.bucket.head(asset.key)) throw new APIError("GC_READBACK_FAILED", 503);
    await store.transact((current) => {
      const record = current.assets[id];
      if (record?.status !== "deleting") throw new APIError("GC_STATE_CHANGED", 409);
      current.usedBytes -= record.bytes;
      delete current.assets[id];
      store.log(current, "media.collect", id);
    });
    deleted++;
  }
  return { dryRun: false, deleted, draftActions };
}
export async function reconcileReservations(store: DraftStore) {
  const snapshot = (await store.read()).state;
  let cleared = 0;
  for (const reservation of Object.values(snapshot.reservations)) {
    if (reservation.expires > store.now()) continue;
    const key = assetKey(reservation.id, reservation.sha256),
      object = await store.bucket.head(key);
    // Expired uploads cannot be promoted. A fresh unique upload ID is required to retry.
    if (object) await store.bucket.delete(key);
    await store.transact((state) => {
      const current = state.reservations[reservation.id];
      if (current && current.expires <= store.now()) {
        delete state.reservations[reservation.id];
        store.log(state, "upload.expire", reservation.id);
      }
    });
    cleared++;
  }
  return { cleared };
}
