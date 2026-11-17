import { describe, expect, it } from "vitest";
import { GitRepository } from "@xpotato/editor-core/git";
import { createHandler } from "./worker.js";
import { MemoryBucket } from "./test-bucket.js";
import { APIError, type Environment, type Session } from "./types.js";

const identity: Session = {
  userId: "190472511",
  login: "owner",
  token: "fixture-token",
  csrf: "proof",
  issued: 0,
  expires: 9e15,
};
function environment(bucket = new MemoryBucket()): Environment {
  return {
    DRAFT_MEDIA: bucket,
    GITHUB_CLIENT_ID: "fixture",
    GITHUB_CLIENT_SECRET: "fixture-secret",
    SESSION_SECRET: "fixture-only-session-secret-32-characters",
    OWNER_GITHUB_ID: identity.userId,
    EDITOR_ORIGIN: "https://xpotato.example",
    GC_ENABLED: "false",
  };
}
const url = (route: string) => "https://xpotato.example/editor-api" + route;

describe("API routing preserves the authorization and failure boundary", () => {
  it.each([
    ["GET", "/branches"],
    ["POST", "/branch"],
    ["POST", "/save"],
    ["POST", "/pull-request"],
    ["GET", "/drafts"],
    ["POST", "/draft-state"],
    ["POST", "/media/reserve"],
    ["PUT", "/media/upload/11111111-1111-4111-8111-111111111111"],
    ["GET", "/gc/plan"],
  ])("%s %s cannot reach Git or storage before authorization", async (method, route) => {
    const bucket = new MemoryBucket();
    let accessedGit = false;
    let mutation: boolean | undefined;
    const handle = createHandler({
      authenticate: async (_request, _env, write) => {
        mutation = write;
        throw new APIError("AUTH_REQUIRED", 401);
      },
      git: () => {
        accessedGit = true;
        throw new Error("must not run");
      },
    });
    const response = await handle(new Request(url(route), { method }), environment(bucket));
    expect(response.status).toBe(401);
    expect(mutation).toBe(method !== "GET");
    expect(accessedGit).toBe(false);
    expect(bucket.writes).toEqual([]);
  });
  it("sanitizes asynchronously rejected Git operations instead of leaking provider details", async () => {
    const handle = createHandler({
      authenticate: async () => identity,
      git: () =>
        new GitRepository(async () => {
          throw new Error("token=PRIVATE_FIXTURE_VALUE");
        }),
    });
    const response = await handle(new Request(url("/branches")), environment());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "REQUEST_FAILED" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("turns an asynchronously missing private image into an authenticated 404", async () => {
    const handle = createHandler({ authenticate: async () => identity });
    const response = await handle(
      new Request(url("/media/11111111-1111-4111-8111-111111111111")),
      environment(),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "MEDIA_NOT_FOUND" });
  });
  it("does not disclose auth configuration through an unhandled callback rejection", async () => {
    const response = await createHandler()(
      new Request(url("/auth/callback?code=invalid&state=invalid")),
      environment(),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "OAUTH_STATE_INVALID" });
  });
});
