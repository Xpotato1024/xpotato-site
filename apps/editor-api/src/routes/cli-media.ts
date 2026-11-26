import { draftPath } from "@xpotato/editor-core/draft";
import { GitError, type GitRepository } from "@xpotato/editor-core/git";
import {
  assertMediaHandoffSource,
  parseMediaHandoffManifest,
  type MediaHandoffManifest,
} from "@xpotato/editor-core/media-handoff";
import { json, readJsonBody, type RoutedRequest } from "../http.js";
import { createDraftRecord, readMedia, reserveMedia, uploadMedia } from "../media.js";
import {
  requireDraft,
  safeAssetId,
  safeUUID,
  type AssetRecord,
  type DraftRecord,
  type DraftState,
  type DraftStore,
} from "../state.js";
import { APIError } from "../types.js";

interface CLIRequest extends RoutedRequest {
  store: DraftStore;
  repository: GitRepository;
}

export function isCLIMediaRoute(route: string, method: string): boolean {
  return (
    (method === "POST" && ["/cli/media-handoff", "/cli/media/reserve"].includes(route)) ||
    (method === "PUT" && /^\/cli\/media\/upload\/[a-f0-9-]+$/u.test(route)) ||
    (method === "GET" && /^\/cli\/media\/[a-f0-9-]+$/u.test(route))
  );
}

async function requestBody(request: Request, keys: string[]): Promise<Record<string, unknown>> {
  const value: unknown = await readJsonBody(request);
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  ) {
    throw new APIError("CLI_MEDIA_REQUEST_INVALID");
  }
  return value as Record<string, unknown>;
}

async function assertCurrentSource(
  repository: GitRepository,
  manifest: MediaHandoffManifest,
): Promise<void> {
  if (manifest.repository !== repository.repository) {
    throw new APIError("MEDIA_HANDOFF_REPOSITORY_MISMATCH", 403);
  }
  const read = async <T>(operation: () => Promise<T>): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof GitError) {
        throw error;
      }
      throw new APIError("CLI_GIT_UNAVAILABLE", 503);
    }
  };
  const snapshot = await read(() => repository.snapshot(manifest.source.branch));
  if (snapshot.commit !== manifest.source.commit) {
    throw new APIError("MEDIA_HANDOFF_HEAD_CHANGED", 409);
  }
  const document = await read(() => repository.read(snapshot, manifest.source.path));
  await assertMediaHandoffSource(manifest, {
    repository: repository.repository,
    branch: snapshot.branch,
    commit: snapshot.commit,
    path: document.path,
    source: document.source,
  });
}

function findDraft(state: DraftState, manifest: MediaHandoffManifest): DraftRecord | null {
  const matching = Object.values(state.drafts).filter(
    (draft) =>
      draft.contentId === manifest.source.contentId && draft.branch === manifest.source.branch,
  );
  const active = matching.filter((draft) => draft.state !== "deleted");
  if (active.length > 1) {
    throw new APIError("DRAFT_MEDIA_AMBIGUOUS", 409);
  }
  if (active.length === 0 && matching.length > 0) {
    throw new APIError("DRAFT_NOT_FOUND", 404);
  }
  const draft = active[0] ?? null;
  if (draft && (draft.sourcePath ?? draftPath(draft.contentId)) !== manifest.source.path) {
    throw new APIError("DRAFT_MEDIA_IDENTITY_MISMATCH", 409);
  }
  return draft;
}

function assertRemoteAssets(
  state: DraftState,
  draft: DraftRecord | null,
  manifest: MediaHandoffManifest,
): void {
  for (const item of manifest.assets) {
    const id = draft?.assets[item.assetId];
    const asset = id ? state.assets[id] : undefined;
    if (
      id &&
      (!asset ||
        asset.draftId !== draft?.id ||
        asset.assetId !== item.assetId ||
        asset.status !== "staged")
    ) {
      throw new APIError("MEDIA_HANDOFF_REMOTE_INVALID", 409);
    }
    if (
      asset?.sha256 !== item.metadata.sha256 &&
      (asset?.sha256 ?? null) !== (item.expectedRemoteSha256 ?? null)
    ) {
      throw new APIError("MEDIA_HANDOFF_REMOTE_CONFLICT", 409);
    }
  }
}

function publicAsset({ key: _key, ...asset }: AssetRecord): Omit<AssetRecord, "key"> {
  return asset;
}

function handoffSnapshot(state: DraftState, manifest: MediaHandoffManifest) {
  const draft = findDraft(state, manifest);
  assertRemoteAssets(state, draft, manifest);
  return {
    repository: manifest.repository,
    source: manifest.source,
    draft,
    assets: draft
      ? Object.values(state.assets)
          .filter((asset) => asset.draftId === draft.id)
          .map(publicAsset)
      : [],
  };
}

export async function handleCLIMediaRoute({
  request,
  route,
  store,
  repository,
}: CLIRequest): Promise<Response> {
  if (route === "/cli/media-handoff" && request.method === "POST") {
    const input = await requestBody(request, ["manifest", "mode"]);
    if (input.mode !== "inspect" && input.mode !== "create") {
      throw new APIError("CLI_MEDIA_MODE_INVALID");
    }
    const manifest = parseMediaHandoffManifest(input.manifest);
    await assertCurrentSource(repository, manifest);
    const snapshot = handoffSnapshot((await store.read()).state, manifest);
    if (input.mode === "inspect" || snapshot.draft) {
      return json(snapshot);
    }
    await createDraftRecord(
      store,
      {
        id: crypto.randomUUID(),
        contentId: manifest.source.contentId,
        branch: manifest.source.branch,
        commit: manifest.source.commit,
        sourcePath: manifest.source.path,
      },
      { rejectDeletedIdentity: true },
    );
    // A second client may have created the identity while Git was being read.
    return json(handoffSnapshot((await store.read()).state, manifest), 201);
  }
  if (route === "/cli/media/reserve" && request.method === "POST") {
    const input = await requestBody(request, [
      "manifest",
      "draftId",
      "expectedDraftRevision",
      "assetId",
    ]);
    safeUUID(input.draftId);
    safeAssetId(input.assetId);
    if (
      typeof input.expectedDraftRevision !== "number" ||
      !Number.isSafeInteger(input.expectedDraftRevision) ||
      input.expectedDraftRevision < 1
    ) {
      throw new APIError("REVISION_REQUIRED");
    }
    const manifest = parseMediaHandoffManifest(input.manifest);
    const item = manifest.assets.find((asset) => asset.assetId === input.assetId);
    if (!item) {
      throw new APIError("MEDIA_HANDOFF_REFERENCES_MISMATCH");
    }
    await assertCurrentSource(repository, manifest);
    const { state } = await store.read();
    const draft = findDraft(state, manifest);
    if (!draft || draft.id !== input.draftId) {
      throw new APIError("DRAFT_MEDIA_IDENTITY_MISMATCH", 409);
    }
    requireDraft(state, draft.id, input.expectedDraftRevision);
    assertRemoteAssets(state, draft, manifest);
    const active = state.assets[draft.assets[item.assetId] ?? ""];
    if (active?.sha256 === item.metadata.sha256) {
      throw new APIError("MEDIA_HANDOFF_ALREADY_REGISTERED", 409);
    }
    const metadata = item.metadata;
    const { handoff: _handoff, ...reservation } = await reserveMedia(
      store,
      {
        draftId: draft.id,
        assetId: item.assetId,
        expectedDraftRevision: input.expectedDraftRevision,
        sha256: metadata.sha256,
        bytes: metadata.bytes,
        kind: metadata.kind,
        mime: metadata.mime,
        sourceSha256: metadata.sourceSha256,
        sourceBytes: metadata.sourceBytes,
        transform: metadata.transform,
        sourceRetained: metadata.sourceRetained,
      },
      { manifest, expectedActiveHash: item.expectedRemoteSha256 ?? null },
    );
    return json(reservation, 201);
  }
  const upload = /^\/cli\/media\/upload\/([a-f0-9-]+)$/u.exec(route);
  if (upload && request.method === "PUT") {
    safeUUID(upload[1]);
    const { state } = await store.read();
    const reservation = state.reservations[upload[1]];
    if (!reservation || reservation.expires < store.now()) {
      throw new APIError("UPLOAD_EXPIRED", 410);
    }
    if (!reservation.handoff) {
      throw new APIError("CLI_UPLOAD_REQUIRED", 409);
    }
    const manifest = parseMediaHandoffManifest(reservation.handoff.manifest);
    await assertCurrentSource(repository, manifest);
    const asset = await uploadMedia(store, reservation.id, request, {
      validateHandoff: (saved) => assertCurrentSource(repository, saved),
    });
    // Git and R2 have no shared transaction. Drift is a partial result, never completion.
    await assertCurrentSource(repository, manifest);
    return json(publicAsset(asset), 201);
  }
  const image = /^\/cli\/media\/([a-f0-9-]+)$/u.exec(route);
  if (image && request.method === "GET") {
    return readMedia(store, image[1]!);
  }
  return json({ error: "NOT_FOUND" }, 404);
}
