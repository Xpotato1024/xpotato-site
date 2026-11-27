import { describe, expect, it } from "vitest";
import {
  anchorSelection,
  articleReviewAnchor,
  type ReviewComment,
} from "@xpotato/editor-core/annotations";
import { GitRepository } from "@xpotato/editor-core/git";
import { seal } from "./auth.js";
import { createDraftRecord } from "./media.js";
import { DraftStore, stateKey } from "./state.js";
import { MemoryBucket } from "./test-bucket.js";
import { createHandler } from "./worker.js";
import type { Environment, Session } from "./types.js";

const draftId = "11111111-1111-4111-8111-111111111111";
const contentId = "22222222-2222-4222-8222-222222222222";
const commentId = "33333333-3333-4333-8333-333333333333";
const anotherContent = "44444444-4444-4444-8444-444444444444";
const origin = "https://xpotato.example";
const identity: Session = {
  userId: "190472511",
  login: "owner",
  token: "private-test-token",
  csrf: "proof",
  issued: Date.now(),
  expires: Date.now() + 3600000,
};
const comment = (fields: Partial<ReviewComment> = {}): ReviewComment => ({
  id: commentId,
  contentId,
  anchor: anchorSelection("前の文。直したい箇所。後の文。", { quote: "直したい箇所" }),
  instruction: "専門用語の意味を補ってください。",
  createdAt: "2026-11-18T00:00:00.000Z",
  status: "open",
  ...fields,
});

async function fixture() {
  const bucket = new MemoryBucket();
  const env: Environment = {
    DRAFT_MEDIA: bucket,
    GITHUB_APP_ID: "123",
    GITHUB_CLIENT_ID: "fixture",
    GITHUB_CLIENT_SECRET: "fixture-secret",
    EDITOR_REPOSITORY: "Xpotato1024/xpotato-site",
    SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
    OWNER_GITHUB_ID: identity.userId,
    EDITOR_ORIGIN: origin,
    GC_ENABLED: "false",
  };
  const store = new DraftStore(bucket, () => Date.parse("2026-11-18T12:00:00Z"));
  await createDraftRecord(store, {
    id: draftId,
    contentId,
    branch: "content/article",
    commit: "a".repeat(40),
    sourcePath: "content/notes/example.mdx",
  });
  const cookie = "__Host-xpotato-editor=" + (await seal(identity, env.SESSION_SECRET));
  const gitCalls: string[] = [];
  const handle = createHandler({
    now: store.now,
    git: () =>
      new GitRepository(async (request) => {
        gitCalls.push(request.path);
        throw Error("Git should not be called by private review routes");
      }),
  });
  const post = (value: unknown, headers: Record<string, string> = {}) =>
    handle(
      new Request(origin + "/editor-api/draft-review", {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: origin,
          "X-CSRF-Token": identity.csrf,
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(value),
      }),
      env,
    );
  return { bucket, env, store, cookie, gitCalls, handle, post };
}

describe("private review storage", () => {
  it("stores annotations privately and retrieves them without a Git or MDX write", async () => {
    const f = await fixture();
    const comments = [comment()];
    const response = await f.post({ id: draftId, expectedRevision: 0, comments });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ review: { revision: 1, comments }, revision: 2 });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const loaded = await f.handle(
      new Request(origin + "/editor-api/draft?id=" + draftId, { headers: { Cookie: f.cookie } }),
      f.env,
    );
    const value = (await loaded.json()) as { draft: { review: unknown; sourcePath: string } };
    expect(value.draft.review).toEqual({ revision: 1, comments });
    expect(value.draft.sourcePath).toBe("content/notes/example.mdx");
    expect(loaded.headers.get("Cache-Control")).toBe("no-store");
    expect([...f.bucket.objects.keys()]).toEqual([stateKey]);
    expect(f.gitCalls).toEqual([]);
    const state = (await f.store.read()).state;
    expect(state.audit.at(-1)).toMatchObject({ action: "review.save", id: draftId });
    expect(JSON.stringify(state.audit)).not.toContain(comments[0]!.instruction);
  });
  it("stores an article-wide review without a Git write and retains it after resolution", async () => {
    const f = await fixture();
    const c = comment({ anchor: articleReviewAnchor(), instruction: "全体の構成を見直す" });
    const first = await f.post({ id: draftId, expectedRevision: 0, comments: [c] });
    expect(first.status).toBe(200);
    const closed = { ...c, status: "resolved" };
    const second = await f.post({ id: draftId, expectedRevision: 1, comments: [closed] });
    expect(second.status).toBe(200);
    expect((await f.store.read()).state.drafts[draftId]!.review?.comments).toEqual([closed]);
    expect(f.gitCalls).toEqual([]);
  });
  it("rejects an outdated review revision without overwriting a newer comment", async () => {
    const f = await fixture();
    await f.post({ id: draftId, expectedRevision: 0, comments: [comment()] });
    const before = await f.store.read(),
      writes = f.bucket.writes.length;
    const stale = await f.post({ id: draftId, expectedRevision: 0, comments: [] });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ error: "REVIEW_CONFLICT" });
    expect(await f.store.read()).toEqual(before);
    expect(f.bucket.writes).toHaveLength(writes);
  });
  it("uses conditional storage updates so two tabs cannot both save revision zero", async () => {
    const f = await fixture();
    const responses = await Promise.all([
      f.post({
        id: draftId,
        expectedRevision: 0,
        comments: [comment({ instruction: "一つ目の変更" })],
      }),
      f.post({
        id: draftId,
        expectedRevision: 0,
        comments: [comment({ instruction: "二つ目の変更" })],
      }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect((await f.store.read()).state.drafts[draftId]!.review?.revision).toBe(1);
    expect((await f.store.read()).state.drafts[draftId]!.revision).toBe(2);
  });
  it("rejects foreign content IDs, duplicate comment IDs, invalid revisions, malformed IDs, and missing drafts", async () => {
    const cases = [
      [
        { id: draftId, expectedRevision: 0, comments: [comment({ contentId: anotherContent })] },
        400,
        "REVIEW_DATA_INVALID",
      ],
      [
        { id: draftId, expectedRevision: 0, comments: [comment(), comment()] },
        400,
        "REVIEW_DATA_INVALID",
      ],
      [{ id: draftId, expectedRevision: -1, comments: [] }, 400, "REVIEW_REVISION_INVALID"],
      [{ id: draftId, expectedRevision: 0.5, comments: [] }, 400, "REVIEW_REVISION_INVALID"],
      [{ id: "../published", expectedRevision: 0, comments: [] }, 400, "ID_INVALID"],
      [{ id: anotherContent, expectedRevision: 0, comments: [] }, 404, "DRAFT_NOT_FOUND"],
    ] as const;
    for (const [input, status, error] of cases) {
      const f = await fixture(),
        writes = f.bucket.writes.length;
      const response = await f.post(input);
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error });
      expect(f.bucket.writes).toHaveLength(writes);
      expect(f.gitCalls).toEqual([]);
    }
  });
  it("enforces both the per-review byte budget and the streamed request limit before storage", async () => {
    const f = await fixture(),
      writes = f.bucket.writes.length;
    const oversized = [0, 1, 2].map((index) =>
      comment({
        id: `33333333-3333-4333-8333-33333333333${index}`,
        anchor: { quote: "x".repeat(190000), prefix: "", suffix: "" },
      }),
    );
    const response = await f.post({ id: draftId, expectedRevision: 0, comments: oversized });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "REVIEW_SIZE_LIMIT" });
    const huge = await f.post({ id: draftId, expectedRevision: 0, comments: "x".repeat(800000) });
    expect(huge.status).toBe(413);
    expect(f.bucket.writes).toHaveLength(writes);
  });
});

describe("private review authentication and preflight", () => {
  it("rejects missing owner session, cross-origin writes, and incorrect CSRF before touching private state", async () => {
    const f = await fixture(),
      writes = f.bucket.writes.length;
    for (const [headers, status, error] of [
      [{ Cookie: "" }, 401, "AUTH_REQUIRED"],
      [{ Origin: "https://other.example" }, 403, "ORIGIN_REJECTED"],
      [{ "X-CSRF-Token": "wrong" }, 403, "CSRF_REJECTED"],
    ] as const) {
      const response = await f.post(
        { id: draftId, expectedRevision: 0, comments: [comment()] },
        headers,
      );
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error });
    }
    const unauthenticatedRead = await f.handle(
      new Request(origin + "/editor-api/draft?id=" + draftId),
      f.env,
    );
    expect(unauthenticatedRead.status).toBe(401);
    expect(f.bucket.writes).toHaveLength(writes);
    expect(f.gitCalls).toEqual([]);
  });
  it("preflight allows only the editor origin and discloses no draft or comment payload", async () => {
    const f = await fixture(),
      writes = f.bucket.writes.length;
    for (const [requestOrigin, status] of [
      [origin, 204],
      ["https://other.example", 403],
    ] as const) {
      const response = await f.handle(
        new Request(origin + "/editor-api/draft-review", {
          method: "OPTIONS",
          headers: {
            Origin: requestOrigin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type,X-CSRF-Token",
          },
        }),
        f.env,
      );
      expect(response.status).toBe(status);
      if (status === 204) {
        expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
        expect(await response.text()).toBe("");
      }
    }
    expect(f.bucket.writes).toHaveLength(writes);
    expect(f.gitCalls).toEqual([]);
  });
});
