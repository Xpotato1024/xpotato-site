import {
  assertMediaHandoffSource,
  mediaHandoffPolicy,
  parseMediaHandoff,
  type MediaHandoff,
} from "@xpotato/editor-core/media-handoff";
import { type GitSnapshot, type GitDocument } from "@xpotato/editor-core/git";
import { importPreparedMedia } from "../media/prepared.js";
import { hashBlob } from "../media/optimize.js";
import { loginState, request, query, fetchPrivateMedia } from "./api.js";
import {
  assertRemoteMediaIdentity,
  findMediaSnapshot,
  type RemoteAsset,
  type RemoteDraft,
  type RemoteMediaSnapshot,
} from "./media-sync.js";
import { localMedia, saveLocalMedia, type LocalDraft, type LocalMedia } from "./storage.js";

export interface PreparedMediaHandoff {
  bundle: MediaHandoff;
  media: LocalMedia[];
  draftId: string;
}

const binding = (draft: LocalDraft, repository: string) => ({
  repository,
  branch: draft.workingBranch,
  commit: draft.baseCommit,
  path: draft.path,
  source: draft.source,
});

/** Decode and validate every image before any local or remote write. */
export async function prepareMediaHandoff(
  file: File,
  draft: LocalDraft,
): Promise<PreparedMediaHandoff> {
  if (file.size <= 0 || file.size > mediaHandoffPolicy.bundleBytes) {
    throw Error("MEDIA_HANDOFF_BYTES_LIMIT");
  }
  const bundle = parseMediaHandoff(JSON.parse(await file.text()));
  await assertMediaHandoffSource(bundle, binding(draft, bundle.repository));
  const media: LocalMedia[] = [];
  for (const asset of bundle.assets) {
    const prepared = await importPreparedMedia(
      new File([JSON.stringify(asset.prepared)], asset.assetId + ".json", {
        type: "application/json",
      }),
      draft.id,
    );
    media.push({ ...prepared, assetId: asset.assetId });
  }
  return { bundle, media, draftId: draft.id };
}

export interface MediaHandoffPorts {
  session: typeof loginState;
  request: typeof request;
  find: typeof findMediaSnapshot;
  fetchMedia: typeof fetchPrivateMedia;
  localMedia: typeof localMedia;
  saveMedia: (media: LocalMedia) => Promise<unknown>;
}

const defaultPorts: MediaHandoffPorts = {
  session: loginState,
  request,
  find: findMediaSnapshot,
  fetchMedia: fetchPrivateMedia,
  localMedia,
  saveMedia: saveLocalMedia,
};

function activeAsset(remote: RemoteMediaSnapshot, assetId: string): RemoteAsset | undefined {
  const id = remote.draft.assets[assetId];
  if (!id) return undefined;
  const asset = remote.assets.find(
    (item) =>
      item.id === id &&
      item.assetId === assetId &&
      item.draftId === remote.draft.id &&
      item.status === "staged",
  );
  if (!asset) throw Error("DRAFT_MEDIA_REFERENCE_INVALID");
  return asset;
}

function assertRemoteAssets(
  bundle: MediaHandoff,
  media: LocalMedia[],
  remote: RemoteMediaSnapshot,
) {
  for (const entry of bundle.assets) {
    const next = media.find((item) => item.assetId === entry.assetId)!;
    const previous = activeAsset(remote, entry.assetId);
    if (previous?.sha256 === next.sha256) continue;
    if (previous?.sha256 !== entry.expectedRemoteSha256) {
      throw Error("DRAFT_MEDIA_REMOTE_CONFLICT");
    }
  }
}

/** Use the existing owner session; this operation never receives or exports credentials. */
export async function registerMediaHandoff(
  draft: LocalDraft,
  prepared: PreparedMediaHandoff,
  options: {
    ports?: MediaHandoffPorts;
    assertCurrent?: () => void;
    onProgress?: (completed: number, total: number) => void;
  } = {},
): Promise<{ draft: LocalDraft; registered: number; reused: number }> {
  const ports = options.ports ?? defaultPorts;
  const assertCurrent = options.assertCurrent ?? (() => {});
  assertCurrent();
  if (prepared.draftId !== draft.id) throw Error("MEDIA_HANDOFF_DRAFT_CHANGED");
  const bundle = parseMediaHandoff(prepared.bundle);
  const state = await ports.session();
  if (!state.authenticated) throw Error("MEDIA_HANDOFF_LOGIN_REQUIRED");
  await assertMediaHandoffSource(bundle, binding(draft, state.repository));
  if (
    prepared.media.length !== bundle.assets.length ||
    new Set(prepared.media.map((item) => item.assetId)).size !== bundle.assets.length
  ) {
    throw Error("MEDIA_HANDOFF_ASSETS_INVALID");
  }
  for (const entry of bundle.assets) {
    const media = prepared.media.find((item) => item.assetId === entry.assetId);
    if (
      !media ||
      media.draftId !== draft.id ||
      media.sha256 !== entry.prepared.metadata.sha256 ||
      media.blob.size !== entry.prepared.metadata.bytes ||
      (await hashBlob(media.blob)) !== media.sha256
    ) {
      throw Error("MEDIA_HANDOFF_IMAGE_CHANGED");
    }
  }

  const assertHead = async () => {
    assertCurrent();
    const snapshot = await ports.request<GitSnapshot>(
      "/snapshot" + query({ branch: bundle.source.branch }),
    );
    if (snapshot.branch !== bundle.source.branch || snapshot.commit !== bundle.source.commit) {
      throw Error("MEDIA_HANDOFF_GIT_CHANGED");
    }
  };
  await assertHead();
  const document = await ports.request<GitDocument>(
    "/document" +
      query({
        branch: bundle.source.branch,
        commit: bundle.source.commit,
        path: bundle.source.path,
      }),
  );
  await assertMediaHandoffSource(bundle, {
    repository: state.repository,
    ...document.snapshot,
    path: document.path,
    source: document.source,
  });
  const cached = await ports.localMedia(draft.id);
  for (const media of prepared.media) {
    const matches = cached.filter((item) => item.assetId === media.assetId);
    if (matches.length > 1) throw Error("DRAFT_MEDIA_LOCAL_CONFLICT");
    const existing = matches[0];
    const entry = bundle.assets.find((item) => item.assetId === media.assetId)!;
    if (
      existing &&
      existing.sha256 !== media.sha256 &&
      (!existing.remoteId || existing.sha256 !== entry.expectedRemoteSha256)
    ) {
      throw Error("DRAFT_MEDIA_LOCAL_CONFLICT");
    }
  }
  let remote = await ports.find(draft);
  if (remote) {
    assertRemoteMediaIdentity(draft, remote);
    assertRemoteAssets(bundle, prepared.media, remote);
  } else {
    if (bundle.assets.some((asset) => asset.expectedRemoteSha256)) {
      throw Error("DRAFT_MEDIA_REMOTE_CONFLICT");
    }
    await assertHead();
    assertCurrent();
    const created = await ports.request<RemoteDraft>("/drafts", {
      method: "POST",
      body: {
        id: draft.remoteDraftId ?? draft.id,
        contentId: bundle.source.contentId,
        branch: bundle.source.branch,
        commit: bundle.source.commit,
        sourcePath: bundle.source.path,
      },
    });
    remote = await ports.request<RemoteMediaSnapshot>("/draft" + query({ id: created.id }));
    assertRemoteMediaIdentity(draft, remote);
    // Another device may have created this identity while the lookup was in flight.
    assertRemoteAssets(bundle, prepared.media, remote);
  }

  let registered = 0;
  let reused = 0;
  const verified = new Map<string, string>();
  for (const media of prepared.media) {
    await assertHead();
    let asset = activeAsset(remote, media.assetId);
    if (asset?.sha256 === media.sha256) {
      reused++;
    } else {
      assertCurrent();
      const reservation = await ports.request<{ id: string }>("/media/reserve", {
        method: "POST",
        body: {
          draftId: remote.draft.id,
          assetId: media.assetId,
          sha256: media.sha256,
          sourceSha256: media.sourceSha256,
          bytes: media.blob.size,
          sourceBytes: media.originalBytes,
          kind: media.kind,
          mime: media.blob.type,
          expectedDraftRevision: remote.draft.revision,
          transform: media.transform,
          sourceRetained: media.sourceRetained,
        },
      });
      assertCurrent();
      asset = await ports.request<RemoteAsset>("/media/upload/" + reservation.id, {
        method: "PUT",
        blob: media.blob,
      });
      if (asset.assetId !== media.assetId || asset.draftId !== remote.draft.id) {
        throw Error("DRAFT_MEDIA_IDENTITY_MISMATCH");
      }
      registered++;
    }
    if (asset.sha256 !== media.sha256 || asset.bytes !== media.blob.size) {
      throw Error("MEDIA_HANDOFF_READBACK_FAILED");
    }
    const readback = await ports.fetchMedia(asset.id);
    if (readback.size !== media.blob.size || (await hashBlob(readback)) !== media.sha256) {
      throw Error("MEDIA_HANDOFF_READBACK_FAILED");
    }
    assertCurrent();
    const latest = (await ports.localMedia(draft.id)).filter(
      (item) => item.assetId === media.assetId,
    );
    const original = cached.find((item) => item.assetId === media.assetId);
    if (
      latest.length > 1 ||
      (latest[0] && latest[0].sha256 !== original?.sha256 && latest[0].sha256 !== media.sha256)
    ) {
      throw Error("DRAFT_MEDIA_LOCAL_CONFLICT");
    }
    await ports.saveMedia({
      ...media,
      ...latest[0],
      id: latest[0]?.id ?? media.id,
      draftId: draft.id,
      assetId: media.assetId,
      blob: readback,
      sha256: media.sha256,
      sourceSha256: media.sourceSha256,
      originalBytes: media.originalBytes,
      kind: media.kind,
      transform: media.transform,
      sourceRetained: media.sourceRetained,
      remoteId: asset.id,
    });
    verified.set(media.assetId, asset.id);
    remote = await ports.request<RemoteMediaSnapshot>("/draft" + query({ id: remote.draft.id }));
    assertRemoteMediaIdentity(draft, remote);
    assertRemoteAssets(bundle, prepared.media, remote);
    options.onProgress?.(registered + reused, prepared.media.length);
  }
  await assertHead();
  for (const media of prepared.media) {
    const asset = activeAsset(remote, media.assetId);
    if (asset?.id !== verified.get(media.assetId) || asset?.sha256 !== media.sha256) {
      throw Error("DRAFT_MEDIA_REMOTE_CONFLICT");
    }
  }
  assertCurrent();
  return {
    draft: { ...draft, remoteDraftId: remote.draft.id, remoteRevision: remote.draft.revision },
    registered,
    reused,
  };
}
