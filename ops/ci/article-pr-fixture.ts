import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createDraftForCollection,
  draftPath,
  parseDraft,
  updateDraft,
  validateDraft,
} from "@xpotato/editor-core/draft";
import { parseEditorContentIndex, updateEditorContentIndex } from "@xpotato/editor-core/registry";
import {
  selectFeedEligibleCatalog,
  selectPublishedCatalog,
  selectSearchEligibleCatalog,
} from "@xpotato/portable-content/catalog";
import { readSiteContent } from "../../packages/site-validators/src/site-content.js";
import { withCommonToolWorktree } from "../qa/common-tool-worktree.js";
import { inspectArticlePrAdmission } from "./article-pr-admission.js";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const indexPath = "content/registry/editor-content-index.json";
export const articlePrFixture = Object.freeze({
  contentId: "938997f8-1d71-4b4d-afb0-723a9f767617",
  initialTitle: "CI分離検証の合成下書き 938997f8",
  revisedTitle: "CI分離検証で添削した合成下書き 938997f8",
  bodyMarker: "CI_ARTICLE_DRAFT_FIXTURE_938997F81D71",
});

/** Use the CMS's source and index operations, without touching an existing article. */
export async function writeCmsArticleFixture(root: string, revision: "create" | "revise") {
  const path = draftPath(articlePrFixture.contentId);
  const index = parseEditorContentIndex(JSON.parse(await readFile(join(root, indexPath), "utf8")));
  const previous = index.documents.find((row) => row.contentId === articlePrFixture.contentId);
  let source: string;
  if (revision === "create") {
    assert.equal(previous, undefined, "Fixture identity must be new");
    source = updateDraft(
      createDraftForCollection({
        collection: "blog",
        id: articlePrFixture.contentId,
        title: articlePrFixture.initialTitle,
      }),
      {},
      `\n${articlePrFixture.bodyMarker}\n\n公開前に編集する合成原稿です。\n`,
    );
    await writeFile(join(root, path), source, { flag: "wx" });
  } else {
    assert.equal(previous?.path, path, "Only the allocated draft may be revised");
    const current = await readFile(join(root, path), "utf8");
    assert.equal(parseDraft(current).data.draft, true, "Fixture must remain a draft");
    source = updateDraft(
      current,
      { title: articlePrFixture.revisedTitle },
      `\n${articlePrFixture.bodyMarker}\n\n## 添削した本文\n\n<Callout kind="note">\n\n通常のCMSで保存できる部品と本文です。\n\n</Callout>\n`,
    );
    await writeFile(join(root, path), source);
  }
  assert.deepEqual(
    validateDraft(source, "blog"),
    [],
    "Fixture must use the ordinary draft contract",
  );
  const { data } = parseDraft(source);
  const updated = updateEditorContentIndex(index, {
    contentId: data.id,
    path,
    title: data.title,
    collection: "blog",
    draft: data.draft === true,
    education: Boolean(data.education),
  });
  await writeFile(join(root, indexPath), JSON.stringify(updated, null, 2) + "\n");
  return path;
}

export async function assertFixtureIsUnpublished(root: string) {
  const { catalog } = await readSiteContent(root);
  const entry = catalog.find((row) => row.routeRecord.contentId === articlePrFixture.contentId);
  assert.ok(entry, "The normal catalog must read the synthetic draft");
  assert.equal(entry.disposition, "held_candidate");
  assert.equal(entry.source.data.draft, true);
  for (const select of [
    selectPublishedCatalog,
    selectSearchEligibleCatalog,
    selectFeedEligibleCatalog,
  ]) {
    assert.ok(
      !select(catalog).some((row) => row.routeRecord.contentId === articlePrFixture.contentId),
      "The draft must stay outside publication, search and feed candidates",
    );
  }
}

export async function assertDraftAbsentFromPublicOutput(dist: string) {
  const markers = Object.values(articlePrFixture).map((marker) => Buffer.from(marker));
  let files = 0;
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else {
        assert.ok(entry.isFile(), "Public fixture output must contain regular files");
        const bytes = await readFile(path);
        for (const marker of markers) {
          assert.ok(!bytes.includes(marker), "Synthetic draft leaked into public output: " + path);
        }
        files += 1;
      }
    }
  };
  await visit(dist);
  assert.ok(files > 0, "A real public build is required");
  return files;
}

export async function runArticlePrFixture(root = repositoryRoot) {
  const npm = process.env.npm_execpath;
  assert.ok(npm && isAbsolute(npm), "Run the fixture through its pinned npm script");
  const git = (cwd: string, args: string[]) =>
    execFileSync("git", ["-c", "core.autocrlf=false", ...args], {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
    }).trim();
  const sourceSha = git(root, ["rev-parse", "HEAD"]);
  assert.equal(
    git(root, ["status", "--porcelain", "--untracked-files=normal"]),
    "",
    "Committed fixture implementation required",
  );
  const reportPath =
    process.env.XPOTATO_ARTICLE_FIXTURE_REPORT ?? join(root, ".local/article-pr-fixture.json");
  assert.ok(isAbsolute(reportPath), "Fixture report requires an absolute output path");
  await mkdir(dirname(reportPath), { recursive: true });
  await rm(reportPath, { force: true });
  const started = performance.now();
  const report = await withCommonToolWorktree(root, async ({ temporary, workspace }) => {
    const run = (args: string[], label: string) => {
      const before = performance.now();
      console.log(`[article-pr-fixture] ${label} START`);
      let output: string;
      try {
        output = execFileSync(process.execPath, args, {
          cwd: workspace,
          encoding: "utf8",
          stdio: "pipe",
          maxBuffer: 16 * 1024 * 1024,
          env: {
            ...process.env,
            ASTRO_TELEMETRY_DISABLED: "1",
            WRANGLER_SEND_METRICS: "false",
            XPOTATO_SITE_TEMP_ROOT: join(temporary, "serving"),
          },
        });
      } catch (error) {
        const failure = error as { stdout?: string; stderr?: string };
        if (failure.stdout) process.stdout.write(failure.stdout);
        if (failure.stderr) process.stderr.write(failure.stderr);
        throw error;
      }
      process.stdout.write(output);
      const elapsedMs = Math.round(performance.now() - before);
      console.log(`[article-pr-fixture] ${label} END elapsedMs=${elapsedMs}`);
      return { output, elapsedMs };
    };
    const setup = run(
      [npm, "ci", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"],
      "install isolated dependencies",
    );
    const commit = (message: string) => {
      git(workspace, ["add", "--", draftPath(articlePrFixture.contentId), indexPath]);
      git(workspace, [
        "-c",
        "user.name=CI Fixture",
        "-c",
        "user.email=ci@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "-qm",
        message,
      ]);
      return git(workspace, ["rev-parse", "HEAD"]);
    };
    const admit = (base: string, head: string) => {
      const result = inspectArticlePrAdmission({
        cwd: workspace,
        env: {
          GITHUB_EVENT_NAME: "pull_request",
          GITHUB_REPOSITORY: "Xpotato1024/xpotato-site",
          GITHUB_REF: "refs/pull/1/merge",
          PR_HEAD_REPOSITORY: "Xpotato1024/xpotato-site",
          PR_BASE_REPOSITORY: "Xpotato1024/xpotato-site",
          PR_BASE_REF: "main",
          EXPECTED_HEAD: head,
          DIFF_BASE: base,
        },
      });
      assert.equal(
        result.eligible,
        true,
        "Real CMS draft/index fixture must be admitted: " + result.reason,
      );
    };
    await writeCmsArticleFixture(workspace, "create");
    const additionHead = commit("test: 未公開記事CIの合成原稿を作成");
    admit(sourceSha, additionHead);
    await writeCmsArticleFixture(workspace, "revise");
    const revisionHead = commit("test: 合成原稿の本文と題名をCMS形式で添削");
    admit(additionHead, revisionHead);
    await assertFixtureIsUnpublished(workspace);
    const validation = run([npm, "run", "ci:article:fast"], "validate the real article command");
    const buildCount = (validation.output.replaceAll("\r\n", "\n").match(/^> build$/gmu) ?? [])
      .length;
    assert.equal(buildCount, 1, "The actual article command must invoke one complete public build");
    const publicFilesChecked = await assertDraftAbsentFromPublicOutput(
      join(workspace, "apps/site/dist"),
    );
    assert.equal(
      git(workspace, ["status", "--porcelain", "--untracked-files=normal"]),
      "",
      "Validation must not mutate committed draft input",
    );
    return {
      mode: "synthetic-cms-draft-and-real-site-validation",
      sourceSha,
      additionBase: sourceSha,
      additionHead,
      revisionBase: additionHead,
      revisionHead,
      contentId: articlePrFixture.contentId,
      setupElapsedMs: setup.elapsedMs,
      validationElapsedMs: validation.elapsedMs,
      buildCount,
      publicFilesChecked,
      productionEligible: false,
    };
  });
  assert.equal(
    git(root, ["rev-parse", "HEAD"]),
    sourceSha,
    "Outer source revision must be preserved",
  );
  assert.equal(
    git(root, ["status", "--porcelain", "--untracked-files=normal"]),
    "",
    "Outer source must be unchanged",
  );
  const completed = { ...report, totalElapsedMs: Math.round(performance.now() - started) };
  await writeFile(reportPath, JSON.stringify(completed, null, 2) + "\n");
  console.log("Synthetic article PR validation PASS: " + JSON.stringify(completed));
  return completed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runArticlePrFixture();
}
