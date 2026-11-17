import { APIError, type ObjectBucket } from "./types.js";
import { mediaPolicy, type MediaKind } from "@xpotato/editor-core/policy";
export interface DraftRecord {
  id: string;
  contentId: string;
  branch: string;
  commit: string;
  sourcePath?: string;
  revision: number;
  lastEditedAt: string;
  state: "active" | "archived" | "delete_candidate" | "deleted" | "promoted";
  assets: Record<string, string>;
  reviewUntil?: string;
  holdUntil?: string;
  deleteAfter?: string;
  publishedVerified?: boolean;
}
export interface AssetRecord {
  id: string;
  key: string;
  draftId: string;
  assetId: string;
  sha256: string;
  sourceSha256: string;
  bytes: number;
  mime: string;
  kind: MediaKind;
  createdAt: string;
  status: "staged" | "rejected" | "deleting" | "promoted";
  rejectedAt?: string;
  holdUntil?: string;
  transform: string;
  sourceBytes: number;
  sourceRetained: boolean;
  width: number;
  height: number;
  frames: number;
  durationMs: number;
}
export interface Reservation {
  id: string;
  draftId: string;
  assetId: string;
  sha256: string;
  bytes: number;
  kind: MediaKind;
  mime: string;
  expires: number;
  expectedDraftRevision: number;
  sourceSha256: string;
  sourceBytes: number;
  transform: string;
  sourceRetained: boolean;
  status: "pending" | "uploading";
}
export interface DraftState {
  version: 1;
  revision: number;
  usedBytes: number;
  reservations: Record<string, Reservation>;
  assets: Record<string, AssetRecord>;
  drafts: Record<string, DraftRecord>;
  audit: { at: string; action: string; id: string }[];
}
export const stateKey = "control/draft-state-v1.json";
export const newState = (): DraftState => ({
  version: 1,
  revision: 0,
  usedBytes: 0,
  reservations: {},
  assets: {},
  drafts: {},
  audit: [],
});
function validateState(value: DraftState): DraftState {
  if (
    value.version !== 1 ||
    !Number.isSafeInteger(value.revision) ||
    !Number.isSafeInteger(value.usedBytes) ||
    value.usedBytes < 0 ||
    !value.assets ||
    !value.drafts ||
    !value.reservations ||
    !Array.isArray(value.audit)
  )
    throw new APIError("STATE_INVALID", 503);
  return value;
}
export class DraftStore {
  constructor(
    readonly bucket: ObjectBucket,
    readonly now: () => number = Date.now,
  ) {}
  async read(): Promise<{ state: DraftState; etag: string | null }> {
    const object = await this.bucket.get(stateKey);
    if (!object) return { state: newState(), etag: null };
    if (object.size > 8 * 1024 * 1024) throw new APIError("STATE_LIMIT", 503);
    return {
      state: validateState(JSON.parse(await object.text()) as DraftState),
      etag: object.etag,
    };
  }
  async transact<T>(mutate: (state: DraftState) => T): Promise<T> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const { state, etag } = await this.read();
      const result = mutate(state);
      state.revision++;
      state.audit = state.audit.slice(-200);
      const text = JSON.stringify(state);
      if (new TextEncoder().encode(text).length > 8 * 1024 * 1024)
        throw new APIError("STATE_LIMIT", 503);
      const saved = await this.bucket.put(stateKey, text, {
        onlyIf: etag ? { etagMatches: etag } : { etagDoesNotMatch: "*" },
        httpMetadata: { contentType: "application/json", cacheControl: "no-store" },
      });
      if (saved) return result;
    }
    throw new APIError("STATE_CONFLICT", 409);
  }
  log(state: DraftState, action: string, id: string) {
    state.audit.push({ at: new Date(this.now()).toISOString(), action, id });
  }
  reserved(state: DraftState) {
    return Object.values(state.reservations).reduce((sum, r) => sum + r.bytes, 0);
  }
  assertCapacity(state: DraftState, bytes: number) {
    if (state.usedBytes + this.reserved(state) + bytes > mediaPolicy.quotaBytes)
      throw new APIError("DRAFT_QUOTA_EXCEEDED", 413);
  }
}
export function requireDraft(state: DraftState, id: string, revision?: number) {
  const draft = state.drafts[id];
  if (!draft || draft.state === "deleted") throw new APIError("DRAFT_NOT_FOUND", 404);
  if (revision !== undefined && draft.revision !== revision)
    throw new APIError("DRAFT_CONFLICT", 409);
  return draft;
}
export function safeUUID(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value)
  )
    throw new APIError("ID_INVALID");
}
export function safeAssetId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value) || value.length > 100)
    throw new APIError("ASSET_ID_INVALID");
}
export function safeHash(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value))
    throw new APIError("HASH_INVALID");
}
export const assetKey = (id: string, sha: string) => "objects/" + id + "/" + sha;
