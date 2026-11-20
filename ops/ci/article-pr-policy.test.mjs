import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { articlePrDecision, inspectArticlePrDecision } from "./article-pr-policy.mjs";

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
    { impact: { ...impact, candidate: "full" } },
    { impact: { ...impact, affectedArticleSources: [] } },
    { impact: { ...impact, reasons: ["unknown-change"] } },
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
