import { describe, it, expect } from "vitest";
import { MemoryBucket } from "./test-bucket.js";
import { DraftStore, newState, stateKey, assetKey, type Reservation } from "./state.js";
import {
  createDraftRecord,
  reserveMedia,
  uploadMedia,
  readMedia,
  editDraftState,
  collectDraftMedia,
  reconcileReservations,
} from "./media.js";
import { createHandler } from "./worker.js";
import { seal, unseal, session, login, callback } from "./auth.js";
import { APIError, type Environment, type Session } from "./types.js";
import { mediaPolicy } from "@xpotato/editor-core/policy";
const owner = "190472511",
  draftId = "11111111-1111-4111-8111-111111111111",
  contentId = "22222222-2222-4222-8222-222222222222";
const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWOoCJj2HwAFAAJeoZPDtAAAAABJRU5ErkJggg==",
    "base64",
  ),
);
const hash = async (bytes: Uint8Array) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer)))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
const env = (bucket = new MemoryBucket()): Environment => ({
  DRAFT_MEDIA: bucket,
  GITHUB_CLIENT_ID: "fixture-app",
  GITHUB_CLIENT_SECRET: "fixture-secret",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
  OWNER_GITHUB_ID: owner,
  EDITOR_ORIGIN: "https://xpotato.example",
  GC_ENABLED: "false",
});
async function fixture() {
  let now = Date.parse("2026-11-17T00:00:00Z");
  const bucket = new MemoryBucket(),
    store = new DraftStore(bucket, () => now);
  await createDraftRecord(store, {
    id: draftId,
    contentId,
    branch: "content/example",
    commit: "a".repeat(40),
  });
  const sha = await hash(png);
  const input = {
    draftId,
    assetId: "figure-one",
    sha256: sha,
    sourceSha256: sha,
    bytes: png.length,
    sourceBytes: png.length,
    kind: "technical" as const,
    mime: "image/png",
    expectedDraftRevision: 1,
    transform: "identity-v1",
    sourceRetained: true,
  };
  return {
    store,
    bucket,
    input,
    advance: (days: number) => {
      now += days * 86400000;
    },
    now: () => now,
  };
}
describe("private staging and its quota boundary", () => {
  it("stores immutable verified bytes and makes no public-area writes", async () => {
    const f = await fixture(),
      r = await reserveMedia(f.store, f.input),
      asset = await uploadMedia(
        f.store,
        r.id,
        new Request("https://xpotato.example/editor-api/media/upload/" + r.id, {
          method: "PUT",
          body: png,
        }),
      );
    expect(asset.sha256).toBe(f.input.sha256);
    expect((await f.store.read()).state.usedBytes).toBe(png.length);
    expect(f.bucket.writes.every((key) => key === stateKey || key.startsWith("objects/"))).toBe(
      true,
    );
    const response = await readMedia(f.store, asset.id);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
  });
  it("charges concurrent reservations atomically rather than exceeding quota", async () => {
    const f = await fixture();
    await f.store.transact((state) => {
      state.usedBytes = mediaPolicy.quotaBytes - f.input.bytes;
    });
    const results = await Promise.allSettled([
      reserveMedia(f.store, f.input),
      reserveMedia(f.store, { ...f.input, assetId: "second" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const state = (await f.store.read()).state;
    expect(state.usedBytes + f.store.reserved(state)).toBe(mediaPolicy.quotaBytes);
  });
  it("rejects changed payload bytes without declaring a completed upload", async () => {
    const f = await fixture(),
      r = await reserveMedia(f.store, f.input);
    const altered = png.slice();
    altered[20] = altered[20]! ^ 1;
    await expect(
      uploadMedia(
        f.store,
        r.id,
        new Request("https://xpotato.example/", { method: "PUT", body: altered }),
      ),
    ).rejects.toThrow("UPLOAD_HASH_MISMATCH");
    expect(Object.values((await f.store.read()).state.assets)).toHaveLength(0);
  });
  it("rejects traversal, excessive budgets and stale draft revisions", async () => {
    const f = await fixture();
    await expect(reserveMedia(f.store, { ...f.input, assetId: "../published" })).rejects.toThrow(
      "ASSET_ID_INVALID",
    );
    await expect(reserveMedia(f.store, { ...f.input, bytes: 8 * 1024 * 1024 + 1 })).rejects.toThrow(
      "MEDIA_BYTES_LIMIT",
    );
    await expect(reserveMedia(f.store, { ...f.input, expectedDraftRevision: 2 })).rejects.toThrow(
      "DRAFT_CONFLICT",
    );
  });
  it("keeps active images even when their object is old; only collects unreferenced rejected media after grace", async () => {
    const f = await fixture(),
      r = await reserveMedia(f.store, f.input),
      a = await uploadMedia(
        f.store,
        r.id,
        new Request("https://xpotato.example/", { method: "PUT", body: png }),
      );
    f.advance(31);
    expect((await collectDraftMedia(f.store, true)).assetIds).toEqual([]);
    const d = (await f.store.read()).state.drafts[draftId]!;
    await editDraftState(f.store, {
      id: draftId,
      revision: d.revision,
      action: "reject",
      assetId: "figure-one",
    });
    expect((await collectDraftMedia(f.store, true)).assetIds).toEqual([]);
    f.advance(31);
    expect((await collectDraftMedia(f.store, true)).assetIds).toEqual([a.id]);
    await collectDraftMedia(f.store, false);
    expect(f.bucket.deletions).toEqual([assetKey(a.id, a.sha256)]);
    expect((await f.store.read()).state.usedBytes).toBe(0);
  });
  it("does not let an expired reservation leak quota or become a saved asset", async () => {
    const f = await fixture(),
      r = await reserveMedia(f.store, f.input);
    f.advance(1);
    await expect(
      uploadMedia(
        f.store,
        r.id,
        new Request("https://xpotato.example/", { method: "PUT", body: png }),
      ),
    ).rejects.toThrow("UPLOAD_EXPIRED");
    await reconcileReservations(f.store);
    expect(Object.keys((await f.store.read()).state.reservations)).toEqual([]);
  });
  it("keeps an explicitly time-bounded hold and does not enable destructive GC by default", async () => {
    const f = await fixture();
    await editDraftState(f.store, { id: draftId, revision: 1, action: "hold", days: 90 });
    f.advance(61);
    expect((await collectDraftMedia(f.store, true)).draftActions[0]!.action).toBe("keep");
    await expect(
      editDraftState(f.store, { id: draftId, revision: 2, action: "hold", days: 3650 }),
    ).rejects.toThrow("HOLD_LIMIT");
  });
});
describe("authentication and application privilege boundaries", () => {
  it("encrypts credentials and rejects modified ciphertext", async () => {
    const secret = env().SESSION_SECRET;
    const sealed = await seal({ token: "never-public" }, secret);
    expect(sealed).not.toContain("never-public");
    expect(await unseal(sealed, secret)).toEqual({ token: "never-public" });
    await expect(unseal(sealed.slice(0, -8) + "AAAAAAAA", secret)).rejects.toThrow("AUTH_EXPIRED");
  });
  it("requires the owner, expiry, same-origin and CSRF on mutations", async () => {
    const e = env(),
      value: Session = {
        userId: owner,
        login: "owner",
        token: "fixture-token",
        csrf: "csrf-proof",
        issued: Date.now(),
        expires: Date.now() + 10000,
      };
    const cookie = "__Host-xpotato-editor=" + (await seal(value, e.SESSION_SECRET));
    const request = (origin: string, csrf: string) =>
      new Request(e.EDITOR_ORIGIN + "/editor-api/save", {
        method: "POST",
        headers: { Cookie: cookie, Origin: origin, "X-CSRF-Token": csrf },
      });
    await expect(
      session(request("https://attacker.example", "csrf-proof"), e, true),
    ).rejects.toThrow("ORIGIN_REJECTED");
    await expect(session(request(e.EDITOR_ORIGIN, "wrong"), e, true)).rejects.toThrow(
      "CSRF_REJECTED",
    );
    expect((await session(request(e.EDITOR_ORIGIN, "csrf-proof"), e, true)).token).toBe(
      "fixture-token",
    );
  });
  it("never exposes the GitHub token in the browser session response", async () => {
    const e = env(),
      handle = createHandler({
        authenticate: async () => ({
          userId: owner,
          login: "owner",
          token: "never-send-token",
          csrf: "proof",
          issued: 0,
          expires: Date.now() + 60000,
        }),
      });
    const result = await handle(new Request(e.EDITOR_ORIGIN + "/editor-api/session"), e);
    const text = await result.text();
    expect(text).not.toContain("never-send-token");
    expect(JSON.parse(text).csrf).toBe("proof");
  });
  it("requires auth before touching storage and rejects arbitrary routes", async () => {
    const bucket = new MemoryBucket(),
      e = env(bucket),
      handle = createHandler();
    const result = await handle(new Request(e.EDITOR_ORIGIN + "/editor-api/media/" + draftId), e);
    expect(result.status).toBe(401);
    expect(bucket.writes).toEqual([]);
  });
  it("sets OAuth PKCE and secure, HttpOnly state cookies", async () => {
    const e = env(),
      result = await login(new Request(e.EDITOR_ORIGIN + "/editor-api/auth/start"), e);
    const location = new URL(result.headers.get("Location")!);
    expect(location.hostname).toBe("github.com");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(result.headers.get("Set-Cookie")).toMatch(/Secure; HttpOnly; SameSite=Lax/u);
  });
  it("rejects invalid OAuth callbacks without exchanging or disclosing tokens", async () => {
    await expect(
      callback(
        new Request("https://xpotato.example/editor-api/auth/callback?state=x&code=y"),
        env(),
        async () => {
          throw Error("MUST_NOT_CALL");
        },
      ),
    ).rejects.toThrow("OAUTH_STATE_INVALID");
  });
});
