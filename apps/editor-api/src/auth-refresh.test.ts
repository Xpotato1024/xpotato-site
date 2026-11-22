import { describe, expect, it } from "vitest";
import { callback, logout, seal, session, unseal } from "./auth.js";
import { editorGitHubPermissions } from "./github-access.js";
import { MemoryBucket } from "./test-bucket.js";
import type { Environment } from "./types.js";

const environment = (): Environment => ({
  DRAFT_MEDIA: new MemoryBucket(),
  GITHUB_APP_ID: "123",
  GITHUB_CLIENT_ID: "fixture-app",
  GITHUB_CLIENT_SECRET: "fixture-client-secret",
  OWNER_GITHUB_ID: "9",
  SESSION_SECRET: "fixture-session-encryption-key-at-least-32-characters",
  EDITOR_ORIGIN: "https://editor.example",
  EDITOR_REPOSITORY: "owner/site",
});
function provider(expiresIn = 28800, rejectRefresh = false) {
  let refreshes = 0;
  const fetcher = (async (address: string | URL | Request, init?: RequestInit) => {
    expect(init?.redirect).toBe("manual");
    const url = new URL(String(address));
    if (url.pathname === "/login/oauth/access_token") {
      const body = JSON.parse(String(init?.body));
      if (body.grant_type === "refresh_token") {
        refreshes++;
        expect(body.refresh_token).toBe("first-refresh");
        if (rejectRefresh)
          return new Response(null, { status: 302, headers: { Location: "https://evil.example" } });
        await new Promise((resolve) => setTimeout(resolve, 50));
        return Response.json({
          access_token: "new-token",
          expires_in: 28800,
          refresh_token: "second-refresh",
          refresh_token_expires_in: 15897600,
        });
      }
      return Response.json({
        access_token: "old-token",
        expires_in: expiresIn,
        refresh_token: "first-refresh",
        refresh_token_expires_in: 15897600,
      });
    }
    if (url.pathname === "/user") return Response.json({ id: 9, login: "owner" });
    if (url.pathname === "/user/installations")
      return Response.json({
        total_count: 1,
        installations: [
          {
            id: 45,
            app_id: 123,
            account: { id: 9 },
            repository_selection: "selected",
            suspended_at: null,
            permissions: editorGitHubPermissions,
          },
        ],
      });
    if (url.pathname === "/user/installations/45/repositories")
      return Response.json({
        total_count: 1,
        repositories: [{ full_name: "owner/site" }],
      });
    throw Error("Unexpected provider request");
  }) as typeof fetch;
  return {
    fetcher,
    get refreshes() {
      return refreshes;
    },
  };
}
async function connect(env: Environment, fetcher: typeof fetch): Promise<string> {
  const state = await seal(
    { state: "expected", verifier: "pkce-verifier", expires: Date.now() + 60000 },
    env.SESSION_SECRET,
  );
  const response = await callback(
    new Request(env.EDITOR_ORIGIN + "/editor-api/auth/callback?state=expected&code=temporary", {
      headers: { Cookie: "__Host-xpotato-editor-oauth=" + state },
    }),
    env,
    fetcher,
  );
  expect(response.status).toBe(303);
  const cookie = response.headers
    .getSetCookie()
    .find((c) => c.startsWith("__Host-xpotato-editor="));
  expect(cookie).toContain("Max-Age=1209600");
  return cookie!.split(";")[0]!;
}
function request(env: Environment, cookie: string, csrf?: string): Request {
  return new Request(env.EDITOR_ORIGIN + "/editor-api/session", {
    headers: {
      Cookie: cookie,
      ...(csrf ? { Origin: env.EDITOR_ORIGIN, "X-CSRF-Token": csrf } : {}),
    },
  });
}
describe("renewable owner-only GitHub session", () => {
  it("stores refresh credentials only as encrypted R2 content, not in a browser cookie", async () => {
    const env = environment();
    const network = provider();
    const cookie = await connect(env, network.fetcher);
    expect(cookie).not.toContain("old-token");
    expect(cookie).not.toContain("first-refresh");
    const bucket = env.DRAFT_MEDIA as MemoryBucket;
    expect(bucket.objects.size).toBe(1);
    const record = [...bucket.objects.values()][0]!;
    const bytes = new TextDecoder().decode(record.bytes);
    expect(bytes).not.toContain("first-refresh");
    const sessionValue = await session(request(env, cookie), env, false, network.fetcher);
    expect(sessionValue.token).toBe("old-token");
    expect(sessionValue.expires - sessionValue.issued).toBe(1209600000);
  });

  it("refreshes once for concurrent API calls despite single-use refresh tokens", async () => {
    const env = environment();
    const network = provider(3);
    const cookie = await connect(env, network.fetcher);
    const [a, b, c] = await Promise.all([
      session(request(env, cookie), env, false, network.fetcher),
      session(request(env, cookie), env, false, network.fetcher),
      session(request(env, cookie), env, false, network.fetcher),
    ]);
    expect([a.token, b.token, c.token]).toEqual(["new-token", "new-token", "new-token"]);
    expect(network.refreshes).toBe(1);
    expect((await session(request(env, cookie), env, false, network.fetcher)).token).toBe(
      "new-token",
    );
  });

  it("refuses refresh redirects without forwarding provider credentials", async () => {
    const env = environment();
    const network = provider(3, true);
    const cookie = await connect(env, network.fetcher);
    await expect(session(request(env, cookie), env, false, network.fetcher)).rejects.toMatchObject({
      code: "AUTH_REFRESH_FAILED",
      status: 401,
    });
    const bucket = env.DRAFT_MEDIA as MemoryBucket;
    const value = [...bucket.objects.values()][0]!;
    expect(new TextDecoder().decode(value.bytes)).not.toContain("first-refresh");
  });

  it("does not refresh credentials before checking CSRF and request origin", async () => {
    const env = environment();
    const network = provider(3);
    const cookie = await connect(env, network.fetcher);
    await expect(
      session(request(env, cookie, "wrong"), env, true, network.fetcher),
    ).rejects.toMatchObject({
      code: "CSRF_REJECTED",
      status: 403,
    });
    expect(network.refreshes).toBe(0);
  });

  it("deletes server-side credentials at logout and rejects the previous ticket", async () => {
    const env = environment();
    const network = provider();
    const cookie = await connect(env, network.fetcher);
    const response = await logout(request(env, cookie), env);
    expect(response.status).toBe(204);
    expect((env.DRAFT_MEDIA as MemoryBucket).objects.size).toBe(0);
    await expect(session(request(env, cookie), env, false, network.fetcher)).rejects.toMatchObject({
      code: "AUTH_EXPIRED",
      status: 401,
    });
  });

  it("rejects an expired ticket even when the R2 credentials remain valid", async () => {
    const env = environment();
    const network = provider();
    const cookie = await connect(env, network.fetcher);
    const raw = cookie.split("=")[1]!;
    const ticket = await unseal<{ expires: number }>(raw, env.SESSION_SECRET);
    ticket.expires = Date.now() - 1;
    const expired = "__Host-xpotato-editor=" + (await seal(ticket, env.SESSION_SECRET));
    await expect(session(request(env, expired), env, false, network.fetcher)).rejects.toMatchObject(
      {
        code: "AUTH_EXPIRED",
        status: 401,
      },
    );
  });
});
