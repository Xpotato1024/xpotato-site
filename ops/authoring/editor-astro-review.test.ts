import { it, expect, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  inlineReviewAssets,
  separateReviewStyles,
  writeEditorReviewOutput,
} from "./editor-astro-review.js";
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
it("renders display-only HTML with same CSS and embedded public fonts, never private images", async () => {
  const root = await mkdtemp(join(tmpdir(), "editor-review-"));
  roots.push(root);
  await mkdir(join(root, "assets"));
  await writeFile(
    join(root, "assets/site.css"),
    '@font-face{font-family:fixture;src:url("/assets/font.woff2")}h1{color:purple}',
  );
  await writeFile(join(root, "assets/font.woff2"), Buffer.from([1, 2, 3]));
  const html =
    '<html><head><link rel="stylesheet" href="/assets/site.css"><script>throw 1</script></head><body><h1 onclick="alert(1)">本文</h1><img data-editor-review-asset="draft-photo" src="/secret.jpg"><a href="https://outside.example/">リンク</a></body></html>';
  const result = await inlineReviewAssets(html, root);
  expect(result).toContain("h1{color:purple}");
  expect(result).toContain("data:font/woff2;base64,AQID");
  expect(result).toContain('data-editor-review-asset="draft-photo"');
  expect(result).not.toContain("/secret.jpg");
  expect(result).not.toContain("<script");
  expect(result).not.toContain("onclick");
  expect(result).not.toContain("https://outside.example");
});
it("rejects unresolved imports and externally hosted visual bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "editor-review-"));
  roots.push(root);
  await expect(
    inlineReviewAssets('<style>@import "https://evil.example/a.css";</style>', root),
  ).rejects.toThrow("REVIEW_UNRESOLVED_CSS_IMPORT");
  await expect(
    inlineReviewAssets('<img src="https://evil.example/photo.jpg">', root),
  ).rejects.toThrow("REVIEW_EXTERNAL_ASSET_REJECTED");
});
it("the PR workflow grants only read access and renders exact-head public MDX without media secrets", async () => {
  const source = await readFile(".github/workflows/editor-preview.yml", "utf8");
  expect(source).toContain("contents: read");
  expect(source).toContain("persist-credentials: false");
  expect(source).toContain("github.event.pull_request.head.sha");
  expect(source).toContain("max-parallel: 4");
  expect(source).not.toMatch(/secrets\.|pull_request_target|actions: write|wrangler deploy/u);
  expect(source).toContain("path: .local/editor-review-output/review.json");
  expect(source).toContain("retention-days: 1");
  const scope = source.slice(source.indexOf("  scope:"), source.indexOf("  review:"));
  expect(scope).toContain("node ops/authoring/editor-review-scope.mjs");
  expect(scope).not.toMatch(/npm ci|cache: npm|--import tsx/u);
  expect(source).toContain('"ops/authoring/editor-review-scope.*"');
  expect(source).toContain("name: ${{ steps.review.outputs.artifact-name }}");
  expect(source).not.toContain("matrix.contentId");
  expect(source).toContain('--github-output "$GITHUB_OUTPUT"');
});

it("publishes only the artifact name bound to a clean validated source context", async () => {
  const root = await mkdtemp(join(tmpdir(), "editor-review-output-"));
  roots.push(root);
  const output = join(root, "github-output");
  const commit = "a".repeat(40);
  const contentId = "11111111-1111-4111-8111-111111111111";
  const result = {
    artifactName: `editor-layout-${commit}-${contentId}`,
    bundlePath: join(root, "review.json"),
    context: {
      schemaVersion: 1 as const,
      contentId,
      commit,
      sourcePath: "content/articles/example.mdx",
      sourceSha256: "b".repeat(64),
      scope: "public-git-draft" as const,
      productionEligible: false as const,
    },
    bytes: 100,
    privateMediaDownloaded: false as const,
    codeClean: true,
  };
  for (const invalid of [
    { ...result, artifactName: result.artifactName + "\nother=untrusted" },
    { ...result, codeClean: false },
    { ...result, context: { ...result.context, contentId: "wrong-id" } },
    { ...result, context: { ...result.context, commit: "wrong-commit" } },
    { ...result, context: { ...result.context, sourcePath: ".github/workflows/ci.yml" } },
  ]) {
    await expect(writeEditorReviewOutput(invalid, output)).rejects.toThrow();
    await expect(readFile(output)).rejects.toMatchObject({ code: "ENOENT" });
  }
  await writeEditorReviewOutput(result, output);
  expect(await readFile(output, "utf8")).toBe(`artifact-name=${result.artifactName}\n`);
});

it("the review CLI rejects invalid selected MDX before emitting an upload name", async () => {
  const root = await mkdtemp(join(tmpdir(), "editor-review-invalid-source-"));
  roots.push(root);
  const sourcePath = "content/pages/example.mdx";
  const githubOutput = join(root, "github-output");
  const output = join(root, ".local/review-output");
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "-q");
  await mkdir(join(root, "content/pages"), { recursive: true });
  for (const [source, expectedError] of [
    ["Missing frontmatter\n", "FRONTMATTER_REQUIRED"],
    ["---\nid: invalid\n---\nBody\n", "ZodError"],
    [
      '---\nid: 11111111-1111-4111-8111-111111111111\ntitle: Example\ndescription: Example\ndraft: true\n---\nimport unsafe from "./runtime.js";\n',
      "EDITOR_REVIEW_SOURCE_INVALID",
    ],
  ]) {
    await writeFile(join(root, sourcePath), source!);
    git("add", sourcePath);
    git(
      "-c",
      "user.name=CI fixture",
      "-c",
      "user.email=ci@example.invalid",
      "commit",
      "-qm",
      "fixture",
    );
    const commit = git("rev-parse", "HEAD");
    let failure: unknown;
    try {
      execFileSync(
        process.execPath,
        [
          "--import",
          pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href,
          fileURLToPath(new URL("./editor-astro-review.ts", import.meta.url)),
          "--source",
          sourcePath,
          "--commit",
          commit,
          "--output",
          output,
          "--github-output",
          githubOutput,
        ],
        { cwd: root, stdio: ["ignore", "pipe", "pipe"], timeout: 10000 },
      );
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as { stderr: Buffer }).stderr.toString()).toContain(expectedError!);
    await expect(readFile(githubOutput)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(output, "review.json"))).rejects.toMatchObject({ code: "ENOENT" });
  }
}, 15000);

it("separates CSS before browser HTML parsing and preserves declaration semantics", () => {
  const output = separateReviewStyles(
    '<html><head><style>h1{color:purple}</style></head><body><h1 class="title" style="margin:0;color:red">題名</h1></body></html>',
  );
  expect(output.html).not.toMatch(/<style| style=/u);
  expect(output.html).toContain("title editor-review-inline-1");
  expect(output.styles.map((s) => s.css)).toEqual([
    "h1{color:purple}",
    ".editor-review-inline-1{margin:0;color:red}",
  ]);
  expect(output.styles.every((s) => /^[a-f0-9]{64}$/u.test(s.sha256))).toBe(true);
});
