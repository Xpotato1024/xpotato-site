import { validateReviewComments } from "@xpotato/editor-core/annotations";
import { quotaState } from "@xpotato/editor-core/policy";
import { APIError } from "../types.js";
import { type DraftStore, safeUUID, requireDraft } from "../state.js";
import {
  createDraftRecord,
  reserveMedia,
  uploadMedia,
  readMedia,
  editDraftState,
  collectDraftMedia,
} from "../media.js";
import { json, readJsonBody as body, type RoutedRequest } from "../http.js";

interface DraftRequest extends RoutedRequest {
  store: DraftStore;
}

export async function handleDraftRoute({
  request,
  url,
  route,
  store,
}: DraftRequest): Promise<Response | null> {
  if (route === "/quota" && request.method === "GET") {
    const { state } = await store.read();
    return json({
      ...quotaState(state.usedBytes, store.reserved(state)),
      assetCount: Object.keys(state.assets).length,
    });
  }
  if (route === "/drafts" && request.method === "GET") {
    const { state } = await store.read();
    return json(Object.values(state.drafts).filter((d) => d.state !== "deleted"));
  }
  if (route === "/drafts" && request.method === "POST") {
    return json(
      await createDraftRecord(store, await body<Parameters<typeof createDraftRecord>[1]>(request)),
      201,
    );
  }
  if (route === "/draft-review" && request.method === "POST") {
    const input = await body<{ id: string; expectedRevision: number; comments: unknown }>(request);
    safeUUID(input.id);
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0)
      throw new APIError("REVIEW_REVISION_INVALID");
    if (new TextEncoder().encode(JSON.stringify(input.comments)).length > 512 * 1024)
      throw new APIError("REVIEW_SIZE_LIMIT", 413);
    return json(
      await store.transact((state) => {
        const draft = requireDraft(state, input.id);
        if ((draft.review?.revision ?? 0) !== input.expectedRevision)
          throw new APIError("REVIEW_CONFLICT", 409);
        const comments = validateReviewComments(input.comments, draft.contentId);
        draft.review = { revision: input.expectedRevision + 1, comments };
        draft.revision++;
        draft.lastEditedAt = new Date(store.now()).toISOString();
        store.log(state, "review.save", input.id);
        return { review: draft.review, revision: draft.revision };
      }),
    );
  }
  if (route === "/draft-state" && request.method === "POST") {
    return json(
      await editDraftState(store, await body<Parameters<typeof editDraftState>[1]>(request)),
    );
  }
  if (route === "/draft" && request.method === "GET") {
    const id = url.searchParams.get("id");
    safeUUID(id);
    const { state } = await store.read(),
      draft = state.drafts[id];
    if (!draft || draft.state === "deleted") {
      throw new APIError("DRAFT_NOT_FOUND", 404);
    }
    return json({
      draft,
      assets: Object.values(state.assets)
        .filter((a) => a.draftId === id)
        .map(({ key, ...asset }) => asset),
    });
  }
  if (route === "/media/reserve" && request.method === "POST") {
    return json(
      await reserveMedia(store, await body<Parameters<typeof reserveMedia>[1]>(request)),
      201,
    );
  }
  const upload = /^\/media\/upload\/([a-f0-9-]+)$/u.exec(route);
  if (upload && request.method === "PUT") {
    return json(await uploadMedia(store, upload[1]!, request), 201);
  }
  const image = /^\/media\/([a-f0-9-]+)$/u.exec(route);
  if (image && request.method === "GET") {
    return readMedia(store, image[1]!);
  }
  if (route === "/gc/plan" && request.method === "GET") {
    return json(await collectDraftMedia(store, true));
  }

  return null;
}
