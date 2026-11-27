import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { inspectBoundDraftPlan, localRevision } from "./draft-branch-pr.js";
import { planDraftBranch } from "@xpotato/editor-core/draft-branch";
import { createDraft, draftPath, parseDraft, updateDraft } from "@xpotato/editor-core/draft";
import { taxonomyRegistrySchema } from "@xpotato/content-contracts/content";
import {
  applyTaxonomyAdditions,
  editorContentIndexPath,
  taxonomyRegistryPath,
  seriesRegistryPath,
  taxonomySnapshotFields,
  type TaxonomyAddition,
} from "@xpotato/editor-core/registry";
import { EditorGitHubFixture } from "../qa/fixtures/editor-github.js";
import { GitRepository, type GitTransport } from "@xpotato/editor-core/git";
const id = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  branch = "content/revision",
  path = draftPath(id),
  otherPath = draftPath(other);
const baseTerms = taxonomyRegistrySchema.parse({
  schemaVersion: 1,
  blogCategories: [
    {
      id: "software",
      label: "Software",
      description: "Software",
      slug: "software",
      aliases: [],
      indexable: true,
      status: "active",
    },
  ],
  noteSubjects: [],
  toolCategories: [],
  tags: [],
});
const manifest = {
  contractVersion: 1,
  ...taxonomySnapshotFields(baseTerms),
  modules: [],
  contractHash: "fixture",
};
const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";
const row = (p: string, s: string) => {
  const { data } = parseDraft(s);
  return {
    contentId: data.id,
    path: p,
    title: data.title,
    collection: "blog",
    draft: data.draft === true,
    education: Boolean(data.education),
  };
};
const index = (...documents: ReturnType<typeof row>[]) =>
  json({
    schemaVersion: 1,
    documents: documents.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
  });
const source = createDraft("Original", "software", id) + "\nOriginal text.\n";
const draft = updateDraft(source, { title: "Candidate", draft: true }, "Candidate text.\n");
const published = updateDraft(source, {
  draft: false,
  description: "Original public text",
  pubDate: "2026-11-27",
});
const otherDraft = createDraft("Other", "software", other) + "\nOther text.\n";
const otherPublished = updateDraft(otherDraft, {
  draft: false,
  description: "Other public text",
  pubDate: "2026-11-27",
});
const term = (id: string, label: string): TaxonomyAddition => ({
  namespace: "tags",
  id,
  label,
  kind: "topic",
});
const withTerms = (additions: TaxonomyAddition[]) => {
  const terms = applyTaxonomyAdditions(baseTerms, additions);
  return {
    [taxonomyRegistryPath]: json(terms),
    "content/registry/editor.json": json({ ...manifest, ...taxonomySnapshotFields(terms) }),
  };
};
async function fixture({ newArticle = false }: { newArticle?: boolean } = {}) {
  const f = new EditorGitHubFixture(manifest);
  if (!newArticle)
    f.advance("main", { [path]: published, [editorContentIndexPath]: index(row(path, published)) });
  const base = await f.repository.snapshot("main");
  await f.repository.createBranch(base, branch);
  const saved = await f.repository.save({
    branch,
    expectedHead: base.commit,
    path,
    source: draft,
    producer: "human",
  });
  f.calls.length = 0;
  return { f, base, input: { branch, expectedHead: saved.commit, path, contentId: id } };
}
describe("shared CMS/AI draft follow transport", () => {
  it("merges the latest code, other article and exact index; retains draft bytes and two parents", async () => {
    const { f, input } = await fixture();
    const main = f.advance("main", {
      "apps/site/src/example.ts": "export const n=2;\n",
      [otherPath]: otherPublished,
      [editorContentIndexPath]: index(row(path, published), row(otherPath, otherPublished)),
    });
    const inspected = await f.repository.followDraftMain(input);
    expect(inspected).toMatchObject({ status: "ready", behind: 1, main });
    expect(f.calls.every((c) => c.method === "GET")).toBe(true);
    const result = await f.repository.followDraftMain(input, true);
    expect(result).toMatchObject({
      status: "synced",
      behind: 0,
      main,
      previousHead: input.expectedHead,
    });
    expect(f.refs.get("main")).toBe(main);
    expect(f.commits.get(result.head)!.parents.map((p) => p.sha)).toEqual([
      input.expectedHead,
      main,
    ]);
    const snapshot = await f.repository.snapshot(branch);
    expect((await f.repository.read(snapshot, path)).source).toBe(draft);
    expect((await f.repository.read(snapshot, otherPath)).source).toBe(otherPublished);
    expect((await f.repository.manifest(snapshot)).contentIndex).toEqual(
      JSON.parse(index(row(path, draft), row(otherPath, otherPublished))).documents,
    );
    expect(f.calls.filter((c) => c.method === "PATCH")).toEqual([
      {
        method: "PATCH",
        path: "/git/refs/heads/content/revision",
        body: { sha: result.head, force: false },
      },
    ]);
    const next = await f.repository.followDraftMain({ ...input, expectedHead: result.head }, true);
    expect(next.status).toBe("current");
    expect(f.calls.filter((c) => c.method === "PATCH")).toHaveLength(1);
  });
  it("preserves the branch when the same published article changes", async () => {
    const { f, input } = await fixture();
    const changed = updateDraft(published, {}, "New main text.\n");
    f.advance("main", { [path]: changed, [editorContentIndexPath]: index(row(path, changed)) });
    const result = await f.repository.followDraftMain(input, true);
    expect(result).toMatchObject({
      status: "conflict",
      conflicts: [{ path, reason: "SAME_ARTICLE_CHANGED" }],
    });
    expect(f.refs.get(branch)).toBe(input.expectedHead);
    expect(f.calls.every((c) => c.method === "GET")).toBe(true);
  });
  it("preserves independent taxonomy additions, but rejects unrelated terms or duplicate names", async () => {
    const { f, input } = await fixture();
    const ours = term("ours", "Our tag"),
      theirs = term("theirs", "Main tag");
    const tagged = updateDraft(draft, { tags: ["ours"] });
    const h = f.advance(branch, {
      [path]: tagged,
      [editorContentIndexPath]: index(row(path, tagged)),
      ...withTerms([ours]),
    });
    f.advance("main", withTerms([theirs]));
    const result = await f.repository.followDraftMain({ ...input, expectedHead: h }, true);
    expect(result.status).toBe("synced");
    expect(result.manifest?.tags).toEqual(["theirs", "ours"]);
    const bad = await fixture();
    const badHead = bad.f.advance(branch, withTerms([ours]));
    bad.f.advance("main", withTerms([theirs]));
    expect(
      await bad.f.repository.followDraftMain({ ...bad.input, expectedHead: badHead }, true),
    ).toMatchObject({ status: "conflict", conflicts: [{ reason: "UNRELATED_TAXONOMY_CHANGE" }] });
    const collision = await fixture();
    const collisionHead = collision.f.advance(branch, {
      [path]: tagged,
      [editorContentIndexPath]: index(row(path, tagged)),
      ...withTerms([ours]),
    });
    collision.f.advance("main", withTerms([term("theirs", "Our tag")]));
    expect(
      await collision.f.repository.followDraftMain(
        { ...collision.input, expectedHead: collisionHead },
        true,
      ),
    ).toMatchObject({ status: "conflict", conflicts: [{ reason: "TAXONOMY_NAME_CONFLICT" }] });
  });
  it("handles a new article and rejects unrelated index or code edits", async () => {
    const { f, input } = await fixture({ newArticle: true });
    f.advance("main", {
      [otherPath]: otherPublished,
      [editorContentIndexPath]: index(row(otherPath, otherPublished)),
    });
    expect((await f.repository.followDraftMain(input, true)).status).toBe("synced");
    const bad = await fixture();
    const h = bad.f.advance(branch, { "apps/site/src/other.ts": "wrong" });
    bad.f.advance("main", { "README.md": "new main" });
    expect(
      await bad.f.repository.followDraftMain({ ...bad.input, expectedHead: h }, true),
    ).toMatchObject({ status: "conflict", conflicts: [{ reason: "OUTSIDE_ARTICLE_SCOPE" }] });
    expect(bad.f.refs.get(branch)).toBe(h);
  });
  it("rejects a changed ref before the final non-force write", async () => {
    const { f, input } = await fixture();
    f.advance("main", { "README.md": "main advance" });
    const request: GitTransport = async <T>(call: Parameters<GitTransport>[0]) => {
      const result = await f.request<T>(call);
      if (call.method === "POST" && call.path === "/git/commits")
        f.advance(branch, { "docs/content/race.md": "remote edit" });
      return result;
    };
    const repo = new GitRepository(request, "fixture/editor");
    await expect(repo.followDraftMain(input, true)).rejects.toThrow("GIT_CONFLICT");
    expect(f.calls.some((c) => c.method === "PATCH")).toBe(false);
  });
});
describe("real local Git admission", () => {
  it("admits an independently diverged content draft, then rejects code and same-article conflicts", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "draft-scope-test-"));
    const git = (...args: string[]) =>
      execFileSync("git", args, {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    const write = (p: string, s: string) => {
      const target = join(cwd, p);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, s);
    };
    const commit = (message: string) => {
      git("add", "-A");
      git("commit", "-m", message);
      return git("rev-parse", "HEAD");
    };
    try {
      git("init", "-b", "main");
      git("config", "user.name", "Fixture");
      git("config", "user.email", "fixture@example.invalid");
      for (const [p, s] of Object.entries({
        [path]: published,
        [editorContentIndexPath]: index(row(path, published)),
        [taxonomyRegistryPath]: json(baseTerms),
        [seriesRegistryPath]: json({ schemaVersion: 1, series: [] }),
        "content/registry/editor.json": json(manifest),
      }))
        write(p, s);
      const ancestor = commit("base");
      git("switch", "-c", branch);
      write(path, draft);
      write(editorContentIndexPath, index(row(path, draft)));
      const h = commit("draft");
      git("switch", "main");
      write(otherPath, otherPublished);
      write(editorContentIndexPath, index(row(path, published), row(otherPath, otherPublished)));
      write("apps/site/code.ts", "new");
      const m = commit("main");
      git("switch", branch);
      const env = {
        GITHUB_EVENT_NAME: "pull_request",
        GITHUB_REPOSITORY: "Xpotato1024/xpotato-site",
        PR_HEAD_REPOSITORY: "Xpotato1024/xpotato-site",
        PR_BASE_REPOSITORY: "Xpotato1024/xpotato-site",
        PR_BASE_REF: "main",
        PR_IS_DRAFT: "true",
        PR_HEAD_REF: branch,
        GITHUB_REF: "refs/pull/246/merge",
        EXPECTED_HEAD: h,
        DIFF_BASE: m,
      };
      const result = await inspectBoundDraftPlan({ cwd, env });
      expect(result).toMatchObject({
        ancestor,
        head: h,
        base: m,
        path,
        requiresProjection: true,
        publishedBaseline: true,
      });
      expect(result?.plan.writes.find((w) => w.path === editorContentIndexPath)?.source).toBe(
        index(row(path, draft), row(otherPath, otherPublished)),
      );
      write("apps/site/forbidden.ts", "wrong");
      const bad = commit("outside scope");
      await expect(
        inspectBoundDraftPlan({ cwd, env: { ...env, EXPECTED_HEAD: bad } }),
      ).rejects.toThrow("OUTSIDE_ARTICLE_SCOPE");
      git("switch", "main");
      write(path, updateDraft(published, {}, "Other main edit.\n"));
      const changed = commit("same article");
      git("switch", "--detach", h);
      await expect(
        inspectBoundDraftPlan({ cwd, env: { ...env, DIFF_BASE: changed } }),
      ).rejects.toThrow("SAME_ARTICLE_CHANGED");
      expect(
        (
          await planDraftBranch(
            { branch, expectedHead: h, path, contentId: id },
            localRevision(cwd, ancestor),
            localRevision(cwd, h),
            localRevision(cwd, m),
          )
        ).copies,
      ).toHaveLength(1);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
