import { describe, expect, it, vi } from "vitest";
import { authenticateCLI } from "./cli-auth.js";
import { MemoryBucket } from "./test-bucket.js";
import type { Environment } from "./types.js";

const token = "gho_private-fixture-credential";
const repository = "Xpotato1024/xpotato-site";
const environment = (): Environment => ({
  DRAFT_MEDIA: new MemoryBucket(),
  GITHUB_CLIENT_ID: "",
  GITHUB_CLIENT_SECRET: "",
  SESSION_SECRET: "",
  OWNER_GITHUB_ID: "190472511",
  EDITOR_ORIGIN: "https://xpotato.example",
  EDITOR_REPOSITORY: repository,
});
const request = (headers: HeadersInit = { Authorization: "Bearer " + token }) =>
  new Request("https://xpotato.example/editor-api/cli/media-handoff", {
    method: "POST",
    headers,
  });
const success = (url: RequestInfo | URL) =>
  Response.json(
    String(url).endsWith("/user")
      ? { id: 190472511, login: "Xpotato1024" }
      : { full_name: repository, permissions: { push: true } },
  );

describe("CLI owner authentication has an independent, request-only credential boundary", () => {
  it("verifies owner and repository using only fixed GitHub URLs without a browser session", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) => success(url));
    const env = environment();
    const principal = await authenticateCLI(request(), env, fetcher);
    expect(principal).toEqual({
      userId: env.OWNER_GITHUB_ID,
      login: "Xpotato1024",
      token,
      repository,
    });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "https://api.github.com/user",
      "https://api.github.com/repos/" + repository,
    ]);
    for (const [, options] of fetcher.mock.calls) {
      expect(options?.redirect).toBe("manual");
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer " + token);
    }
    expect((env.DRAFT_MEDIA as MemoryBucket).writes).toEqual([]);
  });

  it.each([
    {},
    { Authorization: "Basic value" },
    { Authorization: "Bearer " },
    { Authorization: "Bearer two tokens" },
    { Authorization: "Bearer one,Bearer two" },
    { Authorization: "Bearer " + "a".repeat(4097) },
  ])("rejects invalid bearer syntax before contacting GitHub", async (headers) => {
    const fetcher = vi.fn(async (url: RequestInfo | URL) => success(url));
    await expect(authenticateCLI(request(headers), environment(), fetcher)).rejects.toMatchObject({
      code: "CLI_AUTH_REQUIRED",
      status: 401,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["Cookie", "Origin"])("rejects %s, including an empty header", async (header) => {
    const fetcher = vi.fn(async (url: RequestInfo | URL) => success(url));
    for (const value of ["", "https://xpotato.example"]) {
      await expect(
        authenticateCLI(
          request({ Authorization: "Bearer " + token, [header]: value }),
          environment(),
          fetcher,
        ),
      ).rejects.toMatchObject({ code: "CLI_AUTH_CHANNEL_INVALID", status: 403 });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    { id: 123, login: "Xpotato1024" },
    { id: "190472511", login: "Xpotato1024" },
    { id: 190472511, login: "invalid/name" },
  ])("requires the numeric owner identity", async (user) => {
    const fetcher = vi.fn(async () => Response.json(user));
    await expect(authenticateCLI(request(), environment(), fetcher)).rejects.toMatchObject({
      code: "CLI_OWNER_ONLY",
      status: 403,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    { full_name: "someone/else", permissions: { push: true } },
    { full_name: repository, permissions: { push: false } },
    { full_name: repository, permissions: { push: "true" } },
    { full_name: repository },
  ])("requires the configured repository and push permission", async (repo) => {
    const fetcher = vi.fn(async (url: RequestInfo | URL) =>
      String(url).endsWith("/user") ? success(url) : Response.json(repo),
    );
    await expect(authenticateCLI(request(), environment(), fetcher)).rejects.toMatchObject({
      code: "CLI_REPOSITORY_FORBIDDEN",
      status: 403,
    });
  });

  it.each([
    [302, "CLI_AUTH_REDIRECT", 502],
    [401, "CLI_AUTH_REJECTED", 401],
    [403, "CLI_AUTH_REJECTED", 401],
    [500, "CLI_AUTH_UNAVAILABLE", 503],
  ])("does not follow or disclose an upstream %s response", async (status, code, resultStatus) => {
    const fetcher = vi.fn(async () =>
      new Response(token, {
        status: Number(status),
        headers: { Location: "https://other.example/" + token },
      }),
    );
    await expect(authenticateCLI(request(), environment(), fetcher)).rejects.toMatchObject({
      code,
      status: resultStatus,
      message: code,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("redacts provider parsing and transport failures without persisting credentials", async () => {
    const env = environment();
    for (const fetcher of [
      async () => new Response(token),
      async () => {
        throw Error(token);
      },
      async () => Response.json(null),
    ]) {
      await expect(authenticateCLI(request(), env, fetcher)).rejects.toMatchObject({
        message: "CLI_AUTH_UNAVAILABLE",
        status: 503,
      });
    }
    expect((env.DRAFT_MEDIA as MemoryBucket).objects.size).toBe(0);
  });

  it("fails closed if the configured owner or repository is absent", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL) => success(url));
    for (const overrides of [
      { OWNER_GITHUB_ID: "" },
      { OWNER_GITHUB_ID: "1e3" },
      { EDITOR_REPOSITORY: "" },
      { EDITOR_REPOSITORY: "../wrong/path" },
    ]) {
      await expect(
        authenticateCLI(request(), { ...environment(), ...overrides }, fetcher),
      ).rejects.toMatchObject({ code: "CLI_AUTH_NOT_CONFIGURED", status: 503 });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});
