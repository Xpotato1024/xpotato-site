import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, isAbsolute } from "node:path";
import { inspectArticlePrAdmission } from "./article-pr-admission.js";
import { buildEditorAstroReview } from "../authoring/editor-astro-review.js";
import { readSiteContent } from "../../packages/site-validators/src/site-content.js";
import {
  collectionFromPath,
  parseDraft,
  validateDraft,
  type TaxonomySnapshot,
} from "@xpotato/editor-core/draft";
import { readFile } from "node:fs/promises";

const root = resolve(".");
const env = process.env;
const admission = inspectArticlePrAdmission({ cwd: root, env });
assert.equal(admission.eligible, true, admission.reason);
const npm = env.npm_execpath;
assert.ok(npm && isAbsolute(npm), "Run through the pinned npm script");
const run = (cwd: string, args: string[], extra: NodeJS.ProcessEnv = {}) =>
  execFileSync(process.execPath, [npm, ...args], {
    cwd,
    stdio: "inherit",
    env: { ...env, ...extra },
    timeout: 480000,
  });
const git = (args: string[]) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
if (!admission.publishedBaseline) {
  run(root, ["run", "ci:article:fast"]);
} else {
  const base = env.DIFF_BASE!,
    head = env.EXPECTED_HEAD!;
  const paths = admission.paths!;
  assert.ok(paths.length > 0 && paths.length <= 20, "Bound the review work");
  assert.equal(git(["rev-parse", "HEAD"]), head);
  const temporary = mkdtempSync(join(tmpdir(), "xpotato-draft-baseline-"));
  mkdirSync(join(root, ".local"), { recursive: true });
  const privateOutput = mkdtempSync(join(root, ".local", "published-draft-ci-"));
  const baseline = join(temporary, "baseline");
  let added = false;
  try {
    // Validate the actual draft checkout before inspecting the separate published baseline.
    // Canonical editorial provenance binds the published source, not a mutable candidate.
    // The full repository validator runs against the exact public base below.
    for (const task of ["editor:manifest:check", "astro:check"]) run(root, ["run", task]);
    const taxonomy = JSON.parse(
      await readFile(join(root, "content/registry/editor.json"), "utf8"),
    ) as TaxonomySnapshot;
    const { catalog } = await readSiteContent(root);
    for (const [index, path] of paths.entries()) {
      const source = await readFile(join(root, path), "utf8");
      assert.deepEqual(
        validateDraft(source, collectionFromPath(path), taxonomy),
        [],
        "Draft metadata/portable source invalid: " + path,
      );
      const parsed = parseDraft(source);
      const entry = catalog.find((row) => row.routeRecord.contentId === parsed.data.id);
      assert.equal(
        entry?.disposition,
        "held_candidate",
        "Draft must not be a public candidate: " + path,
      );
      const review = await buildEditorAstroReview({
        repositoryRoot: root,
        sourcePath: path,
        output: join(privateOutput, "review-" + index),
        expectedCommit: head,
      });
      assert.equal(review.codeClean, true);
      assert.equal(review.privateMediaDownloaded, false);
      assert.equal(review.context.commit, head);
      console.log("Exact draft rendering PASS: " + path);
    }
    assert.equal(
      git(["status", "--porcelain", "--untracked-files=normal"]),
      "",
      "Draft source unchanged",
    );
    // The base is a different immutable checkout, never a candidate release artifact.
    git(["worktree", "add", "--detach", baseline, base]);
    added = true;
    const baseHead = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: baseline,
      encoding: "utf8",
    }).trim();
    assert.equal(baseHead, base);
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
  } finally {
    if (added) git(["worktree", "remove", "--force", baseline]);
    rmSync(temporary, { recursive: true, force: true });
    rmSync(privateOutput, { recursive: true, force: true });
  }
  assert.equal(git(["rev-parse", "HEAD"]), head);
  assert.equal(git(["status", "--porcelain", "--untracked-files=normal"]), "");
}
