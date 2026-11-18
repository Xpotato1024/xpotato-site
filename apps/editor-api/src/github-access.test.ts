import { describe, it, expect, vi } from "vitest";
import { editorGitHubPermissions, verifyGitHubInstallation } from "./github-access.js";
import { callback, seal } from "./auth.js";
import { connectionStatus } from "./connection.js";
import { MemoryBucket } from "./test-bucket.js";
import { GitRepository } from "@xpotato/editor-core/git";
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
  GC_ENABLED: "false",
});
function fixture() {
  const installation = {
    id: 45,
    app_id: 123,
    account: { id: 9 },
    repository_selection: "selected",
    suspended_at: null as string | null,
    permissions: { ...editorGitHubPermissions } as Record<string, string>,
  };
  const repos = { total_count: 1, repositories: [{ full_name: "owner/site" }] };
  const paths: string[] = [];
  const transport = (async (url: string | URL | Request) => {
    const path = new URL(String(url)).pathname;
    paths.push(path);
    if (path === "/login/oauth/access_token")
      return Response.json({ access_token: "private-token", expires_in: 28800 });
    if (path === "/user") return Response.json({ id: 9, login: "owner" });
    if (path === "/user/installations")
      return Response.json({ total_count: 1, installations: [installation] });
    if (path === "/user/installations/45/repositories") return Response.json(repos);
    throw new Error("Unexpected request");
  }) as typeof fetch;
  return { installation, repos, paths, transport };
}
describe("GitHub App connection", () => {
  it("accepts only the configured owner's App and the selected site repository", async () => {
    const f = fixture();
    expect(await verifyGitHubInstallation("private-token", environment(), f.transport)).toBe(45);
    expect(f.paths).toEqual(["/user/installations", "/user/installations/45/repositories"]);
  });
  it.each([
    "all",
    "another-repo",
    "additional-repo",
    "suspended",
    "wrong-app",
    "extra-permission",
    "missing-checks",
  ])("refuses %s without creating a user session", async (fault) => {
    const f = fixture();
    if (fault === "all") f.installation.repository_selection = "all";
    if (fault === "another-repo") f.repos.repositories[0]!.full_name = "owner/other";
    if (fault === "additional-repo") f.repos.total_count = 2;
    if (fault === "suspended") f.installation.suspended_at = "2026-11-18T00:00:00Z";
    if (fault === "wrong-app") f.installation.app_id = 124;
    if (fault === "extra-permission") f.installation.permissions.administration = "write";
    if (fault === "missing-checks") delete f.installation.permissions.checks;
    await expect(
      verifyGitHubInstallation("private-token", environment(), f.transport),
    ).rejects.toThrow(/GITHUB_INSTALLATION/);
  });
  it("completes PKCE callback and issues only an encrypted HttpOnly cookie after installation verification", async () => {
    const env = environment(),
      f = fixture();
    const state = await seal(
      { state: "random-state", verifier: "proof-verifier", expires: Date.now() + 60000 },
      env.SESSION_SECRET,
    );
    const response = await callback(
      new Request(
        env.EDITOR_ORIGIN + "/editor-api/auth/callback?state=random-state&code=temporary",
        {
          headers: { Cookie: "__Host-xpotato-editor-oauth=" + state },
        },
      ),
      env,
      f.transport,
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(env.EDITOR_ORIGIN + "/editor/");
    expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(response.headers.get("Set-Cookie")).not.toContain("private-token");
    expect(f.paths.at(-1)).toBe("/user/installations/45/repositories");
  });

  it.each(["/login/oauth/access_token", "/user"])(
    "ends login when %s stops responding",
    async (stalledPath) => {
      const env = environment();
      const f = fixture();
      const state = await seal(
        { state: "random-state", verifier: "proof-verifier", expires: Date.now() + 60000 },
        env.SESSION_SECRET,
      );
      const nativeTimeout = AbortSignal.timeout.bind(AbortSignal);
      const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
        expect(milliseconds).toBe(15000);
        return nativeTimeout(1);
      });
      const fetcher = (async (url: string | URL | Request, options?: RequestInit) => {
        if (new URL(String(url)).pathname !== stalledPath) {
          return f.transport(url, options);
        }
        const signal = options?.signal;
        if (!signal) {
          throw new Error("Upstream request has no deadline");
        }
        return new Promise<Response>((_resolve, reject) => {
          if (signal.aborted) {
            reject(signal.reason);
            return;
          }
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      }) as typeof fetch;
      try {
        await expect(
          callback(
            new Request(
              env.EDITOR_ORIGIN + "/editor-api/auth/callback?state=random-state&code=temporary",
              { headers: { Cookie: "__Host-xpotato-editor-oauth=" + state } },
            ),
            env,
            fetcher,
          ),
        ).rejects.toMatchObject({ name: "TimeoutError" });
      } finally {
        timeout.mockRestore();
      }
    },
  );
});
describe("connection diagnosis has no writes", () => {
  it("reports Git and R2 independently without creating a state object", async () => {
    const env = environment(),
      bucket = env.DRAFT_MEDIA as MemoryBucket;
    const repository = {
      repository: "owner/site",
      snapshot: async () => ({ branch: "main", commit: "a".repeat(40) }),
      manifest: async () => ({}),
    } as unknown as GitRepository;
    const result = await connectionStatus(env, repository);
    expect(result.github.state).toBe("ready");
    expect(result.media.state).toBe("ready");
    expect(result.garbageCollectionEnabled).toBe(false);
    expect(bucket.writes).toEqual([]);
  });
  it("does not return upstream error bodies and preserves an independent successful R2 result", async () => {
    const repository = {
      snapshot: async () => {
        throw new Error("provider secret must not leave server");
      },
    } as unknown as GitRepository;
    const result = await connectionStatus(environment(), repository);
    expect(result.github.state).toBe("unavailable");
    expect(result.media.state).toBe("ready");
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
