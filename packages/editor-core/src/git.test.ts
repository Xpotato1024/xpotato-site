import { describe, it, expect } from "vitest";
import {
  GitRepository,
  GitError,
  createGitHubTransport,
  assertWorkingBranch,
  type GitRequest,
  type GitTransport,
} from "./git.js";
import { createDraft, draftPath } from "./draft.js";
const id = "11111111-1111-4111-8111-111111111111",
  a = "a".repeat(40),
  b = "b".repeat(40),
  c = "c".repeat(40);
const encode = (value: string) => Buffer.from(value).toString("base64");
function fixture() {
  const calls: GitRequest[] = [],
    state = { head: a, race: false, prDraft: null as boolean | null };
  const source = createDraft("記事", "software", id);
  const api: GitTransport = async <T>(req: GitRequest) => {
    calls.push(req);
    let value: unknown;
    if (req.path.startsWith("/git/ref/heads/")) value = { object: { sha: state.head } };
    else if (req.path.startsWith("/contents/content/registry/editor.json"))
      value = {
        type: "file",
        encoding: "base64",
        size: 100,
        content: encode(
          JSON.stringify({
            contractVersion: 1,
            categories: { blog: ["software"] },
            tags: [],
            modules: [],
          }),
        ),
        sha: a,
      };
    else if (req.path.startsWith("/contents/")) throw new GitError("GIT_NOT_FOUND", 404);
    else if (req.path.startsWith("/git/commits/") && req.method === "GET")
      value = { sha: a, tree: { sha: b }, parents: [] };
    else if (req.path === "/git/blobs") value = { sha: b };
    else if (req.path === "/git/trees") value = { sha: b };
    else if (req.path === "/git/commits") value = { sha: c };
    else if (req.path.startsWith("/git/refs/heads/")) {
      if (state.race) throw new GitError("GIT_CONFLICT", 422);
      state.head = c;
      value = { object: { sha: c } };
    } else if (req.path.startsWith("/pulls?"))
      value =
        state.prDraft === null
          ? []
          : [{ number: 9, html_url: "https://github.com/test/repo/pull/9", draft: state.prDraft }];
    else if (req.path === "/pulls")
      value = { number: 9, html_url: "https://github.com/test/repo/pull/9", draft: true };
    else throw Error("UNEXPECTED " + req.path);
    return value as T;
  };
  return { repository: new GitRepository(api, "test/repo"), state, calls, source };
}
describe("GitHub API transport preserves credentials at redirect boundaries", () => {
  it("never follows an unexpected redirect while carrying the user token", async () => {
    const calls: { destination: string; redirect: RequestRedirect | undefined }[] = [];
    const fetcher = (async (url: string | URL | Request, options?: RequestInit) => {
      calls.push({ destination: String(url), redirect: options?.redirect });
      return new Response(null, {
        status: 302,
        headers: { Location: "https://attacker.example/token" },
      });
    }) as typeof fetch;
    const api = createGitHubTransport("private-token", "owner/site", fetcher);
    await expect(api({ method: "GET", path: "/branches" })).rejects.toMatchObject({
      code: "GIT_UPSTREAM_REDIRECT",
      status: 502,
    });
    expect(calls).toEqual([
      { destination: "https://api.github.com/repos/owner/site/branches", redirect: "manual" },
    ]);
  });
});

describe("Git updates are snapshot-bound and do not publish", () => {
  it("refuses direct main/dev writes and ref escapes", () => {
    for (const branch of [
      "main",
      "dev",
      "content/../main",
      "content/a.lock",
      "content/a b",
      "content/",
    ])
      expect(() => assertWorkingBranch(branch)).toThrow();
    expect(() => assertWorkingBranch("content/article")).not.toThrow();
  });
  it("creates a commit with one expected parent and never force-updates", async () => {
    const f = fixture();
    const result = await f.repository.save({
      branch: "content/article",
      expectedHead: a,
      path: draftPath(id),
      source: f.source,
      producer: "human",
    });
    expect(result.commit).toBe(c);
    expect(f.calls.find((r) => r.path === "/git/commits")!.body).toEqual(
      expect.objectContaining({ parents: [a] }),
    );
    expect(f.calls.at(-1)!.body).toEqual({ sha: c, force: false });
  });
  it("does not write when the selected branch has advanced", async () => {
    const f = fixture();
    f.state.head = b;
    await expect(
      f.repository.save({
        branch: "content/article",
        expectedHead: a,
        path: draftPath(id),
        source: f.source,
        producer: "human",
      }),
    ).rejects.toThrow("GIT_CONFLICT");
    expect(f.calls.some((c) => c.method !== "GET")).toBe(false);
  });
  it("lets the non-force ref operation reject a race after object creation", async () => {
    const f = fixture();
    f.state.race = true;
    await expect(
      f.repository.save({
        branch: "content/article",
        expectedHead: a,
        path: draftPath(id),
        source: f.source,
        producer: "human",
      }),
    ).rejects.toThrow("GIT_CONFLICT");
    expect(f.state.head).toBe(a);
  });
  it("does not save draft=false or arbitrary repository files", async () => {
    const f = fixture();
    await expect(
      f.repository.save({
        branch: "content/article",
        expectedHead: a,
        path: draftPath(id),
        source: f.source.replace("draft: true", "draft: false"),
        producer: "human",
      }),
    ).rejects.toThrow("DRAFT_ONLY");
    await expect(
      f.repository.save({
        branch: "content/article",
        expectedHead: a,
        path: ".github/workflows/attack.yml",
        source: f.source,
        producer: "ai",
      }),
    ).rejects.toThrow("CONTENT_PATH_NOT_ALLOWED");
  });
  it("opens a draft PR, not a merge or deployment", async () => {
    const f = fixture();
    await f.repository.pullRequest({
      branch: "content/article",
      base: "main",
      title: "記事",
      contentId: id,
    });
    expect(f.calls.find((c) => c.path === "/pulls")!.body).toEqual(
      expect.objectContaining({ draft: true }),
    );
    expect(f.calls.some((c) => /merge|deploy|dispatch/u.test(c.path))).toBe(false);
  });
  it("opens a management Draft PR without an invented article identity", async () => {
    const f = fixture();
    const result = await f.repository.registryPullRequest({
      branch: "content/organization",
      base: "main",
    });
    expect(result).toMatchObject({ number: 9, draft: true });
    const input = f.calls.find((call) => call.path === "/pulls")!.body as {
      draft: boolean;
      title: string;
      body: string;
    };
    expect(input.draft).toBe(true);
    expect(input.title).toBe("分類・タグ・連載を更新");
    expect(input.body).not.toMatch(/ContentId|Content-Id/);
    expect(f.calls.some((call) => /merge|deploy|dispatch/u.test(call.path))).toBe(false);
  });
  it("reuses an existing Draft PR without changing an existing ready-for-review PR", async () => {
    const f = fixture();
    f.state.prDraft = true;
    expect(
      await f.repository.registryPullRequest({ branch: "content/organization", base: "main" }),
    ).toMatchObject({ number: 9, draft: true });
    expect(f.calls.every((call) => call.method === "GET")).toBe(true);
    f.state.prDraft = false;
    await expect(
      f.repository.registryPullRequest({ branch: "content/organization", base: "main" }),
    ).rejects.toMatchObject({ code: "PR_NOT_DRAFT", status: 409 });
    expect(f.calls.every((call) => call.method === "GET")).toBe(true);
  });
  it("refuses protected management heads and identical PR base/head", async () => {
    const f = fixture();
    await expect(f.repository.registryPullRequest({ branch: "main", base: "dev" })).rejects.toThrow(
      "PROTECTED_BRANCH",
    );
    await expect(
      f.repository.registryPullRequest({ branch: "content/a", base: "content/a" }),
    ).rejects.toThrow("PR_BASE_INVALID");
    expect(f.calls).toEqual([]);
  });
});
