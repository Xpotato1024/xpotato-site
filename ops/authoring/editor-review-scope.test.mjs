import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectEditorReviewScope, selectEditorReviewEntries } from "./editor-review-scope.mjs";

const commit = "a".repeat(40);
const article = "content/articles/article.mdx";

test("scope selects editable paths without parsing a draft or inventing its ContentId", () => {
  const entries = selectEditorReviewEntries(
    [article, "content/pages/about.md", "content/registry/editor-content-index.json"].join("\0") +
      "\0",
    commit,
  );
  assert.deepEqual(entries, [
    { path: article, commit },
    { path: "content/pages/about.md", commit },
  ]);
  assert.deepEqual(selectEditorReviewEntries("", commit), []);
  assert.deepEqual(selectEditorReviewEntries(".github/workflows/editor-preview.yml\0", commit), []);
});

test("scope rejects malformed paths, incomplete diffs, duplicate entries and unknown revisions", () => {
  for (const path of [
    "content/articles/Uppercase.mdx",
    "content/articles/with space.md",
    "content/articles/-leading.mdx",
    "content/articles/日本語.mdx",
    "content/articles/line\nbreak.mdx",
    "content/articles/back\\slash.mdx",
  ]) {
    assert.throws(() => selectEditorReviewEntries(path + "\0", commit), /INVALID|NOT_ALLOWED/);
  }
  for (const diff of [article, article + "\0\0", article + "\0" + article + "\0", null]) {
    assert.throws(() => selectEditorReviewEntries(diff, commit), /REVIEW_DIFF_INVALID/);
  }
  for (const revision of [
    undefined,
    "",
    "HEAD",
    "0".repeat(40),
    "a".repeat(39),
    "A".repeat(40),
    [commit],
  ]) {
    assert.throws(() => selectEditorReviewEntries("", revision), /REVIEW_PR_REVISION_REQUIRED/);
  }
});

test("eight selected articles are allowed and a ninth blocks the complete review batch", () => {
  const paths = Array.from({ length: 9 }, (_, index) => `content/notes/note-${index}.mdx\0`);
  assert.equal(selectEditorReviewEntries(paths.slice(0, 8).join(""), commit).length, 8);
  assert.throws(() => selectEditorReviewEntries(paths.join(""), commit), /REVIEW_BATCH_LIMIT/);
});

function repositoryFixture() {
  const cwd = mkdtempSync(join(tmpdir(), "editor-review-scope-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const commitFiles = () => {
    git("add", "-A");
    git(
      "-c",
      "user.name=CI fixture",
      "-c",
      "user.email=ci@example.invalid",
      "commit",
      "-qm",
      "fixture",
    );
    return git("rev-parse", "HEAD");
  };
  git("init", "-q");
  git("config", "core.autocrlf", "false");
  git("remote", "add", "origin", cwd);
  mkdirSync(join(cwd, "content/articles"), { recursive: true });
  writeFileSync(join(cwd, article), "before\n");
  writeFileSync(join(cwd, "content/articles/deleted.mdx"), "old\n");
  const base = commitFiles();
  writeFileSync(join(cwd, article), "Content validation belongs to the renderer.\n");
  writeFileSync(join(cwd, "content/articles/added.md"), "new\n");
  rmSync(join(cwd, "content/articles/deleted.mdx"));
  writeFileSync(join(cwd, "README.md"), "unrelated description\n");
  const head = commitFiles();
  return { cwd, base, head };
}

test("real Git selects additions/modifications at exact PR head and excludes deleted articles", async () => {
  const { cwd, base, head } = repositoryFixture();
  try {
    const report = await inspectEditorReviewScope({
      cwd,
      event: { pull_request: { base: { sha: base }, head: { sha: head } } },
    });
    assert.deepEqual(report, {
      head,
      entries: [
        { path: "content/articles/added.md", commit: head },
        { path: article, commit: head },
      ],
    });
    await assert.rejects(
      inspectEditorReviewScope({
        cwd,
        event: { pull_request: { base: { sha: base }, head: { sha: base } } },
      }),
      /REVIEW_CHECKOUT_MISMATCH/,
    );
    for (const event of [undefined, {}, { pull_request: { base: { sha: "HEAD" } } }]) {
      await assert.rejects(inspectEditorReviewScope({ cwd, event }), /REVIEW_PR_REVISION_REQUIRED/);
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("the dependency-free CLI writes an empty matrix or fails without producing outputs", () => {
  const { cwd, head } = repositoryFixture();
  const eventFile = join(cwd, "event.json");
  const output = join(cwd, "github-output");
  const cli = fileURLToPath(new URL("./editor-review-scope.mjs", import.meta.url));
  try {
    writeFileSync(
      eventFile,
      JSON.stringify({ pull_request: { base: { sha: head }, head: { sha: head } } }),
    );
    const env = { ...process.env, GITHUB_EVENT_PATH: eventFile, GITHUB_OUTPUT: output };
    const result = execFileSync(process.execPath, [cli], { cwd, env, encoding: "utf8" });
    assert.equal(JSON.parse(result).articles, 0);
    assert.equal(readFileSync(output, "utf8"), 'matrix={"include":[]}\ncount=0\n');
    rmSync(output);
    writeFileSync(eventFile, JSON.stringify({ pull_request: { head: { sha: "0".repeat(40) } } }));
    assert.throws(() =>
      execFileSync(process.execPath, [cli], { cwd, env, stdio: ["ignore", "pipe", "pipe"] }),
    );
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
