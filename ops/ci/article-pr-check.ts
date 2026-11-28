import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, isAbsolute } from "node:path";
import { inspectWorkflowAdmission } from "./article-pr-admission.js";
import { checkArticleCandidate } from "./article-candidate-check.js";

const root = resolve(".");
const env = process.env;
const admission = await inspectWorkflowAdmission({ cwd: root, env });
assert.equal(admission.eligible, true, admission.reason);
const npm = env.npm_execpath;
assert.ok(npm && isAbsolute(npm), "Run through pinned npm");
const run = (cwd: string, args: string[], extra: NodeJS.ProcessEnv = {}) =>
  execFileSync(process.execPath, [npm, ...args], {
    cwd,
    stdio: "inherit",
    env: { ...env, ...extra },
    timeout: 480000,
  });
const git = (cwd: string, args: string[]) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 32 * 1024 * 1024,
  }).trim();
const head = env.EXPECTED_HEAD!,
  base = env.DIFF_BASE!;
assert.equal(git(root, ["rev-parse", "HEAD"]), head);
assert.equal(git(root, ["status", "--porcelain", "--untracked-files=normal"]), "");
const temporary = mkdtempSync(join(tmpdir(), "xpotato-draft-ci-"));
const worktrees: string[] = [];
const checkout = (name: string, commit: string) => {
  const target = join(temporary, name);
  git(root, ["worktree", "add", "--detach", target, commit]);
  worktrees.push(target);
  assert.equal(git(target, ["rev-parse", "HEAD"]), commit);
  return target;
};
try {
  let candidate = root,
    candidateHead = head;
  const bound = admission.boundDraft;
  if (bound?.requiresProjection) {
    // CI evaluates a private virtual merge. It has no write permission on GitHub,
    // never moves an existing ref and never produces a release artifact.
    candidate = checkout("candidate", base);
    for (const file of bound.plan.copies) {
      const target = join(candidate, file.path);
      mkdirSync(dirname(target), { recursive: true });
      const bytes = execFileSync("git", ["cat-file", "blob", file.sha], {
        cwd: root,
        maxBuffer: 2 * 1024 * 1024,
      });
      writeFileSync(target, bytes);
    }
    for (const file of bound.plan.writes) {
      const target = join(candidate, file.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, file.source, "utf8");
    }
    git(candidate, [
      "add",
      "--",
      ...bound.plan.copies.map((f) => f.path),
      ...bound.plan.writes.map((f) => f.path),
    ]);
    git(candidate, [
      "-c",
      "user.name=CI Draft Projection",
      "-c",
      "user.email=ci@example.invalid",
      "commit",
      "--allow-empty",
      "-m",
      "test: isolated draft projection",
    ]);
    candidateHead = git(candidate, ["rev-parse", "HEAD"]);
    run(candidate, ["ci", "--prefer-offline", "--no-audit", "--no-fund"]);
    console.log(
      JSON.stringify({
        mode: "virtual-draft-projection",
        head,
        base,
        ancestor: bound.ancestor,
        candidateHead,
        productionEligible: false,
      }),
    );
  }
  if (!admission.publishedBaseline) {
    run(candidate, ["run", "ci:article:fast"], {
      XPOTATO_SITE_TEMP_ROOT: join(temporary, "candidate-validation"),
    });
  } else {
    const paths = admission.paths!;
    if (candidate === root) await checkArticleCandidate(root, head, paths);
    else
      run(candidate, [
        "exec",
        "--offline",
        "--",
        "tsx",
        "ops/ci/article-candidate-check.ts",
        candidateHead,
        ...paths,
      ]);
    const baseline = checkout("baseline", base);
    run(baseline, ["ci", "--prefer-offline", "--no-audit", "--no-fund"]);
    run(baseline, ["run", "ci:article:fast"], {
      XPOTATO_SITE_TEMP_ROOT: join(temporary, "public-validation"),
    });
    console.log(
      JSON.stringify({
        mode: "published-draft-review-and-public-baseline",
        head,
        base,
        paths,
        productionEligible: false,
      }),
    );
  }
} finally {
  for (const tree of worktrees.reverse()) git(root, ["worktree", "remove", "--force", tree]);
  rmSync(temporary, { recursive: true, force: true });
}
assert.equal(git(root, ["rev-parse", "HEAD"]), head);
assert.equal(git(root, ["status", "--porcelain", "--untracked-files=normal"]), "");
