import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  articlePrDecision,
  inspectArticlePrDecision,
  indexChangeIsScoped,
} from "./article-pr-policy.mjs";

const head = "a".repeat(40);
const base = "b".repeat(40);
const article = "content/articles/example.mdx";
const env = {
  GITHUB_EVENT_NAME: "pull_request",
  GITHUB_REPOSITORY: "Xpotato1024/xpotato-site",
  GITHUB_REF: "refs/pull/234/merge",
  EXPECTED_HEAD: head,
  DIFF_BASE: base,
};
const impact = {
  head,
  base,
  comparisonAvailable: true,
  candidate: "article-impact-candidate",
  reasons: [],
  affectedArticleSources: [article],
  changes: [{ status: "M", paths: [article] }],
};
const decision = (patch = {}) =>
  articlePrDecision({
    impact: patch.impact ?? impact,
    env: patch.env ?? env,
    actualHead: patch.actualHead ?? head,
    sourceMode: patch.sourceMode ?? (() => "100644"),
  });

test("only a verified same-repository article-only PR receives fast scope", () => {
  assert.equal(decision().article, true);
  for (const patch of [
    { env: { ...env, GITHUB_EVENT_NAME: "push" } },
    { env: { ...env, GITHUB_REPOSITORY: "attacker/other" } },
    { env: { ...env, GITHUB_REF: "refs/heads/main" } },
    { env: { ...env, EXPECTED_HEAD: "f".repeat(40) } },
    { env: { ...env, DIFF_BASE: "f".repeat(40) } },
    { actualHead: "f".repeat(40) },
    { impact: { ...impact, comparisonAvailable: false } },
    { impact: { ...impact, changes: [{ status: "M", paths: ["package.json"] }] } },
    { impact: { ...impact, changes: [] } },
    { impact: { ...impact, changes: [{ status: "D", paths: [article] }] } },
    { sourceMode: () => "120000" },
    { sourceMode: () => "100755" },
    { sourceMode: () => null },
  ])
    assert.equal(decision(patch).article, false);
});

test("real Git addition/edition is admitted but deletions, renames and unrelated inputs fall back", () => {
  const cwd = mkdtempSync(join(tmpdir(), "article-fast-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" }).trim();
  const commit = () => {
    git("add", "-A");
    git(
      "-c",
      "user.name=CI Fixture",
      "-c",
      "user.email=ci@example.invalid",
      "commit",
      "-qm",
      "test",
    );
    return git("rev-parse", "HEAD");
  };
  try {
    git("init", "-q");
    git("config", "core.autocrlf", "false");
    mkdirSync(join(cwd, "content", "articles"), { recursive: true });
    writeFileSync(join(cwd, article), "# original\n");
    const first = commit();
    writeFileSync(join(cwd, article), "# revised\n");
    const second = commit();
    const expected = { ...env, DIFF_BASE: first, EXPECTED_HEAD: second };
    assert.equal(inspectArticlePrDecision({ cwd, env: expected }).article, true);
    assert.equal(
      inspectArticlePrDecision({ cwd, env: { ...expected, GITHUB_EVENT_NAME: "push" } }).article,
      false,
    );
    assert.equal(
      inspectArticlePrDecision({ cwd, env: { ...expected, EXPECTED_HEAD: first } }).article,
      false,
    );
    writeFileSync(join(cwd, "package.json"), "{}\n");
    const shared = commit();
    assert.equal(
      inspectArticlePrDecision({ cwd, env: { ...expected, EXPECTED_HEAD: shared } }).article,
      false,
    );
    git("rm", "content/articles/example.mdx");
    const deleted = commit();
    assert.equal(
      inspectArticlePrDecision({ cwd, env: { ...expected, EXPECTED_HEAD: deleted } }).article,
      false,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("CMS index may change only the same draft article and may not alter unrelated entries", () => {
  const record = (path, contentId, title, collection) => ({
    contentId,
    path,
    title,
    collection,
    draft: true,
    education: false,
  });
  const baseIndex = {
    schemaVersion: 1,
    documents: [
      record(article, "article-id", "original", "blog"),
      record("content/projects/other.mdx", "other-id", "other", "projects"),
    ],
  };
  const valid = structuredClone(baseIndex);
  valid.documents[0].title = "revised";
  assert.equal(indexChangeIsScoped(baseIndex, valid, new Set([article])), true);
  const unrelated = structuredClone(valid);
  unrelated.documents[1].title = "tampered";
  assert.equal(indexChangeIsScoped(baseIndex, unrelated, new Set([article])), false);
  const removed = structuredClone(valid);
  removed.documents.splice(1, 1);
  assert.equal(indexChangeIsScoped(baseIndex, removed, new Set([article])), false);
  const inserted = structuredClone(valid);
  inserted.documents.push(record("content/projects/new.mdx", "new-id", "new", "projects"));
  assert.equal(indexChangeIsScoped(baseIndex, inserted, new Set([article])), false);
  const idSwap = structuredClone(valid);
  idSwap.documents[0].contentId = "different-id";
  assert.equal(indexChangeIsScoped(baseIndex, idSwap, new Set([article])), false);
  const duplicate = structuredClone(valid);
  duplicate.documents.push({ ...duplicate.documents[0] });
  assert.equal(indexChangeIsScoped(baseIndex, duplicate, new Set([article])), false);
  assert.equal(indexChangeIsScoped(null, valid, new Set([article])), false);
  assert.equal(indexChangeIsScoped(baseIndex, null, new Set([article])), false);
  const extraField = structuredClone(valid);
  extraField.documents[0].isAdmin = true;
  assert.equal(indexChangeIsScoped(baseIndex, extraField, new Set([article])), false);
});

test("real CMS article and its matching content index use the fast PR lane", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cms-article-fast-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" }).trim();
  const commit = () => {
    git("add", "-A");
    git(
      "-c",
      "user.name=CI Fixture",
      "-c",
      "user.email=ci@example.invalid",
      "commit",
      "-qm",
      "test",
    );
    return git("rev-parse", "HEAD");
  };
  const indexPath = "content/registry/editor-content-index.json";
  const index = (title, other = "unchanged") =>
    JSON.stringify(
      {
        schemaVersion: 1,
        documents: [
          { contentId: "article-id", path: article, title, collection: "blog", draft: true },
          {
            contentId: "other-id",
            path: "content/projects/other.mdx",
            title: other,
            collection: "projects",
          },
        ],
      },
      null,
      2,
    ) + "\n";
  try {
    git("init", "-q");
    git("config", "core.autocrlf", "false");
    mkdirSync(join(cwd, "content", "articles"), { recursive: true });
    mkdirSync(join(cwd, "content", "registry"), { recursive: true });
    writeFileSync(join(cwd, article), "# original\n");
    writeFileSync(join(cwd, indexPath), index("original"));
    const first = commit();
    writeFileSync(join(cwd, article), "# revised\n");
    writeFileSync(join(cwd, indexPath), index("revised"));
    const second = commit();
    const expected = { ...env, DIFF_BASE: first, EXPECTED_HEAD: second };
    assert.equal(inspectArticlePrDecision({ cwd, env: expected }).article, true);
    writeFileSync(join(cwd, indexPath), index("revised", "changed-other"));
    const third = commit();
    assert.equal(
      inspectArticlePrDecision({
        cwd,
        env: { ...expected, EXPECTED_HEAD: third },
      }).article,
      false,
    );
    writeFileSync(join(cwd, "content", "registry", "taxonomy.json"), "{}\n");
    const fourth = commit();
    assert.equal(
      inspectArticlePrDecision({
        cwd,
        env: { ...expected, EXPECTED_HEAD: fourth },
      }).article,
      false,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
