import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { buildEditorAstroReview } from "../authoring/editor-astro-review.js";
import { readSiteContent } from "../../packages/site-validators/src/site-content.js";
import {
  collectionFromPath,
  parseDraft,
  validateDraft,
  type TaxonomySnapshot,
} from "@xpotato/editor-core/draft";

export async function checkArticleCandidate(root: string, head: string, paths: string[]) {
  const git = (args: string[]) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }).trim();
  assert.equal(git(["rev-parse", "HEAD"]), head);
  assert.equal(git(["status", "--porcelain", "--untracked-files=normal"]), "");
  assert.ok(paths.length > 0 && paths.length <= 20);
  const npm = process.env.npm_execpath;
  assert.ok(npm && isAbsolute(npm), "Run through pinned npm");
  for (const task of ["editor:manifest:check", "astro:check"])
    execFileSync(process.execPath, [npm, "run", task], {
      cwd: root,
      stdio: "inherit",
      timeout: 480000,
    });
  const taxonomy = JSON.parse(
    await readFile(join(root, "content/registry/editor.json"), "utf8"),
  ) as TaxonomySnapshot;
  const { catalog } = await readSiteContent(root);
  mkdirSync(join(root, ".local"), { recursive: true });
  const output = mkdtempSync(join(root, ".local", "article-candidate-ci-"));
  try {
    for (const [index, path] of paths.entries()) {
      const collection = collectionFromPath(path);
      const source = await readFile(join(root, path), "utf8");
      assert.deepEqual(
        validateDraft(source, collection, taxonomy),
        [],
        "Draft contract invalid: " + path,
      );
      const parsed = parseDraft(source);
      assert.equal(
        catalog.find((row) => row.routeRecord.contentId === parsed.data.id)?.disposition,
        "held_candidate",
        "Draft must remain held",
      );
      const review = await buildEditorAstroReview({
        repositoryRoot: root,
        sourcePath: path,
        output: join(output, "review-" + index),
        expectedCommit: head,
      });
      assert.equal(review.codeClean, true);
      assert.equal(review.privateMediaDownloaded, false);
      assert.equal(review.context.commit, head);
      console.log("Exact candidate rendering PASS: " + path);
    }
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
  assert.equal(git(["status", "--porcelain", "--untracked-files=normal"]), "");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await checkArticleCandidate(resolve("."), process.argv[2] ?? "", process.argv.slice(3));
