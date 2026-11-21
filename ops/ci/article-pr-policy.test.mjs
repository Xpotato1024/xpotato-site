import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  articleIndexPath,
  articlePrDecision,
  articleSourceCollection,
  inspectArticlePrDecision,
} from "./article-pr-policy.mjs";

const head = "a".repeat(40);
const base = "b".repeat(40);
const article = "content/articles/example.mdx";
const env = {
  GITHUB_EVENT_NAME: "pull_request",
  GITHUB_REPOSITORY: "Xpotato1024/xpotato-site",
  PR_HEAD_REPOSITORY: "Xpotato1024/xpotato-site",
  PR_BASE_REPOSITORY: "Xpotato1024/xpotato-site",
  PR_BASE_REF: "main",
  GITHUB_REF: "refs/pull/234/merge",
  EXPECTED_HEAD: head,
  DIFF_BASE: base,
};
const impact = {
  head,
  base,
  comparisonAvailable: true,
  changes: [{ status: "M", paths: [article] }],
};
const decision = (patch = {}) =>
  articlePrDecision({
    impact,
    env,
    actualHead: head,
    sourceMode: () => "100644",
    ...patch,
  });
const source = `---
id: 11111111-1111-4111-8111-111111111111
title: Example
description: ""
category: software
tags: []
draft: true
---

Draft text.
`;

function withRepository(run) {
  const cwd = mkdtempSync(join(tmpdir(), "article-pr-scope-"));
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
      "fixture",
    );
    return git("rev-parse", "HEAD");
  };
  try {
    git("init", "-q");
    git("config", "core.autocrlf", "false");
    mkdirSync(join(cwd, "content/articles"), { recursive: true });
    mkdirSync(join(cwd, "content/registry"), { recursive: true });
    writeFileSync(join(cwd, article), source);
    writeFileSync(
      join(cwd, articleIndexPath),
      JSON.stringify({ schemaVersion: 1, documents: [] }) + "\n",
    );
    const first = commit();
    writeFileSync(join(cwd, article), source + "\nRevised draft.\n");
    const second = commit();
    const currentEnv = { ...env, DIFF_BASE: first, EXPECTED_HEAD: second };
    run({ cwd, git, commit, first, second, currentEnv });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test("candidate selection requires an exact PR identity and offers no semantic approval", () => {
  assert.equal(decision().article, true);
  assert.match(decision().reason, /semantic admission required/u);
  for (const patch of [
    { env: { ...env, CI_FORCE_FULL: "true" } },
    { env: { ...env, GITHUB_EVENT_NAME: "push" } },
    { env: { ...env, GITHUB_EVENT_NAME: "workflow_dispatch" } },
    { env: { ...env, GITHUB_REPOSITORY: "attacker/other" } },
    { env: { ...env, PR_HEAD_REPOSITORY: "attacker/fork" } },
    { env: { ...env, PR_HEAD_REPOSITORY: undefined } },
    { env: { ...env, PR_BASE_REPOSITORY: "attacker/other" } },
    { env: { ...env, PR_BASE_REF: "feature" } },
    { env: { ...env, GITHUB_REF: "refs/heads/main" } },
    { env: { ...env, EXPECTED_HEAD: "f".repeat(40) } },
    { env: { ...env, DIFF_BASE: "f".repeat(40) } },
    { actualHead: "f".repeat(40) },
    { impact: { ...impact, comparisonAvailable: false } },
    { impact: { ...impact, changes: [] } },
    { sourceMode: () => "120000" },
    { sourceMode: () => "100755" },
    { sourceMode: (_path, revision) => (revision === base ? "120000" : "100644") },
    { sourceMode: (path) => (path === articleIndexPath ? null : "100644") },
  ]) {
    assert.equal(decision(patch).article, false, JSON.stringify(patch));
  }
});

test("all CMS collections can be candidates while unknown paths and change types run full CI", () => {
  for (const directory of ["articles", "notes", "projects", "tools", "pages"]) {
    const path = "content/" + directory + "/example.mdx";
    assert.equal(articleSourceCollection(path), directory === "articles" ? "blog" : directory);
    assert.equal(
      decision({ impact: { ...impact, changes: [{ status: "A", paths: [path] }] } }).article,
      true,
    );
  }
  for (const path of [
    "content/articles/nested/example.mdx",
    "content/articles/UPPER.mdx",
    "content/articles/-leading.mdx",
    "content/articles/../example.mdx",
    "content/articles/line\nbreak.mdx",
    "content/articles/back\\slash.mdx",
    "content/registry/provenance/index.ts",
    "content/registry/taxonomy/terms.json",
    "package.json",
  ]) {
    assert.equal(
      decision({
        impact: { ...impact, changes: [...impact.changes, { status: "M", paths: [path] }] },
      }).article,
      false,
      path,
    );
  }
  for (const status of ["D", "R100", "C100", "T", "U"]) {
    assert.equal(
      decision({ impact: { ...impact, changes: [{ status, paths: [article] }] } }).article,
      false,
      status,
    );
  }
  assert.equal(
    decision({
      impact: {
        ...impact,
        changes: [
          ...impact.changes,
          { status: "M", paths: [articleIndexPath] },
          { status: "M", paths: ["docs/article.md"] },
        ],
      },
    }).article,
    true,
  );
});

test("actual Git context rejects dirty source, stale head, unavailable base and divergent base", () => {
  withRepository(({ cwd, git, commit, first, second, currentEnv }) => {
    assert.equal(inspectArticlePrDecision({ cwd, env: currentEnv }).article, true);
    assert.equal(
      inspectArticlePrDecision({ cwd, env: { ...currentEnv, EXPECTED_HEAD: first } }).article,
      false,
    );
    assert.equal(
      inspectArticlePrDecision({ cwd, env: { ...currentEnv, DIFF_BASE: "f".repeat(40) } }).article,
      false,
    );
    writeFileSync(join(cwd, article), source + "\nUncommitted edit.\n");
    assert.equal(inspectArticlePrDecision({ cwd, env: currentEnv }).article, false);
    git("checkout", "--", article);
    writeFileSync(join(cwd, "untracked.mjs"), "// Untracked input\n");
    assert.equal(inspectArticlePrDecision({ cwd, env: currentEnv }).article, false);
    rmSync(join(cwd, "untracked.mjs"));
    git("checkout", "--detach", first);
    writeFileSync(join(cwd, article), source + "\nDivergent edit.\n");
    const diverged = commit();
    git("checkout", "--detach", second);
    assert.equal(
      inspectArticlePrDecision({ cwd, env: { ...currentEnv, DIFF_BASE: diverged } }).article,
      false,
    );
  });
});

test("actual rename, deletion and mixed code changes fall back to full CI", () => {
  for (const mutation of [
    ({ git }) => git("mv", article, "content/articles/renamed.mdx"),
    ({ git }) => git("rm", article),
    ({ cwd }) => writeFileSync(join(cwd, "package.json"), "{}\n"),
  ]) {
    withRepository((context) => {
      mutation(context);
      const next = context.commit();
      assert.equal(
        inspectArticlePrDecision({
          cwd: context.cwd,
          env: { ...context.currentEnv, EXPECTED_HEAD: next },
        }).article,
        false,
      );
    });
  }
});

test("an actual source symlink is never an article candidate", (t) => {
  withRepository(({ cwd, commit, currentEnv }) => {
    const linkPath = "content/articles/link.mdx";
    try {
      symlinkSync("example.mdx", join(cwd, linkPath));
    } catch (error) {
      if (process.platform === "win32" && ["EPERM", "EACCES"].includes(error.code)) {
        t.skip("Windows file symlink creation is unavailable");
        return;
      }
      throw error;
    }
    const next = commit();
    assert.equal(
      inspectArticlePrDecision({ cwd, env: { ...currentEnv, EXPECTED_HEAD: next } }).article,
      false,
    );
  });
});
