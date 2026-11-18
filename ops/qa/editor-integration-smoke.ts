import { execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import axe from "axe-core";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { editorStaticServer } from "./editor-static-server.mjs";
import { writeBody, readBody, showBlocks, panel, closePanel } from "./editor-browser-helpers.mjs";
import { EditorGitHubFixture } from "./fixtures/editor-github.js";
import { MemoryBucket } from "../../apps/editor-api/src/test-bucket.js";
import { DraftStore } from "../../apps/editor-api/src/state.js";
import { createHandler } from "../../apps/editor-api/src/worker.js";
import { APIError, type Environment } from "../../apps/editor-api/src/types.js";
const root = resolve("."),
  output = resolve(".local/cms-validation/editor-integration");
await mkdir(output, { recursive: true });
const git = new EditorGitHubFixture(
    JSON.parse(await readFile(resolve(root, "content/registry/editor.json"), "utf8")),
  ),
  bucket = new MemoryBucket();
const csrf = "synthetic-csrf-only",
  session = {
    userId: "synthetic-owner",
    login: "synthetic-owner",
    token: "synthetic-no-network-token",
    csrf,
    issued: Date.now(),
    expires: Date.now() + 3600000,
  };
const env: Environment = {
  DRAFT_MEDIA: bucket,
  GITHUB_CLIENT_ID: "synthetic",
  GITHUB_CLIENT_SECRET: "synthetic",
  SESSION_SECRET: "synthetic-session-key-not-real-32-characters",
  OWNER_GITHUB_ID: session.userId,
  EDITOR_ORIGIN: "https://fixture.invalid",
  EDITOR_REPOSITORY: "fixture/editor",
  GC_ENABLED: "false",
};
const handler = createHandler({
  authenticate: async (request, _env, write) => {
    if (write && request.headers.get("X-CSRF-Token") !== csrf)
      throw new APIError("CSRF_REJECTED", 403);
    return session;
  },
  git: () => git.repository,
});
const server = await editorStaticServer(root, async (req: any, res: any) => {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    const request = new Request("https://fixture.invalid" + req.url, {
      method: req.method,
      headers: req.headers,
      ...(bytes.length ? { body: new Uint8Array(bytes) } : {}),
    });
    const response = await handler(request, env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "FIXTURE_BRIDGE_FAILED" }));
  }
});
let browser;
const failures: string[] = [],
  audits: { name: string; violations: { id: string; impact: string | null; nodes: number }[] }[] =
    [];
function capturePageError(error: Error) {
  failures.push(error.message);
  console.error("Editor pageerror:", error.stack ?? error.message);
}
async function audit(page: import("playwright").Page, name: string) {
  await page.evaluate(axe.source);
  const result = await page.evaluate(
    async () =>
      await (window as unknown as { axe: { run: typeof axe.run } }).axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      }),
  );
  const violations = result.violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? null,
    nodes: v.nodes.length,
  }));
  const blocking = result.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  if (blocking.length)
    console.error(
      JSON.stringify({
        audit: name,
        violations: blocking.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((node) => ({
            target: node.target,
            html: node.html,
            failureSummary: node.failureSummary,
            checks: [...node.any, ...node.all, ...node.none].map((check) => ({
              id: check.id,
              data: check.data,
            })),
          })),
        })),
      }),
    );
  assert.deepEqual(
    violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
    [],
    name + " accessibility",
  );
  audits.push({ name, violations });
}
try {
  const executable = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    chromium.executablePath(),
  ].find((value) => value && existsSync(value));
  browser = await chromium.launch({
    headless: true,
    ...(executable ? { executablePath: executable } : {}),
  });
  if (process.env.XPOTATO_RELEASE_BROWSER_RUN && process.send)
    process.send({
      type: "xpotato:chrome-ready",
      suite: "editor",
      runId: process.env.XPOTATO_RELEASE_BROWSER_RUN,
    });
  const context = await browser.newContext({
      viewport: { width: 1365, height: 1000 },
      locale: "ja-JP",
    }),
    page = await context.newPage();
  page.on("pageerror", capturePageError);
  await page.goto(server.origin + "/editor/");
  const title = page.getByRole("textbox", { name: "タイトル", exact: true });
  await title.waitFor();
  await title.fill("Git引継ぎと私有画像の統合テスト");
  await writeBody(page, "人間が執筆した最初の文章。\n");
  await showBlocks(page);
  await panel(
    page,
    "保存と確認を開く",
    page.getByRole("button", { name: "Gitへ保存", exact: true }),
  );
  await page.getByRole("button", { name: "Gitへ保存", exact: true }).click();
  await page.locator(".message").filter({ hasText: "Gitへ保存しました" }).waitFor();
  const branch = [...git.refs.keys()].find((name) => name.startsWith("content/"))!;
  assert(branch);
  assert.equal(git.refs.size, 2);
  const first = await git.repository.snapshot(branch),
    documents = await git.repository.documents(first);
  assert.equal(documents.length, 1);
  const file = documents[0]!.path;
  await page.getByRole("button", { name: "Draft PRを開く", exact: true }).click();
  await page.locator(".pr-link").waitFor();
  await audit(page, "desktop editor saved Draft PR");
  assert.equal(git.pulls.length, 1);
  assert.equal(git.pulls[0]!.draft, true);
  assert.equal(git.pulls[0]!.base.ref, "main");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWOoCJj2HwAFAAJeoZPDtAAAAABJRU5ErkJggg==",
    "base64",
  );
  await panel(page, "画像を開く", page.getByRole("region", { name: "画像とGIF", exact: true }));
  await page
    .locator("input[type=file][multiple]")
    .setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: png });
  await page.locator(".media-card").waitFor();
  const beforeInsertion = await readBody(page);
  await showBlocks(page);
  const alt = page.getByRole("textbox", { name: "代替テキスト", exact: true });
  await page.getByRole("button", { name: "本文に挿入", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "代替テキストを入力してから" }).waitFor();
  assert(await alt.evaluate((input) => input === document.activeElement));
  assert.deepEqual(failures, []);
  assert.equal(await readBody(page), beforeInsertion);
  await showBlocks(page);
  const altText = "統合検証用の合成画像";
  await alt.fill(altText);
  // The click itself blurs the input: insertion must not wait for IndexedDB reload.
  await page.getByRole("button", { name: "本文に挿入", exact: true }).click();
  assert.match(await readBody(page), /<Figure\b[^>]*alt="統合検証用の合成画像"/u);
  await showBlocks(page);
  await page.getByRole("button", { name: "画像を同期", exact: true }).click();
  await page.locator(".media-card").filter({ hasText: "非公開R2に同期済み" }).waitFor();
  await closePanel(page);
  await panel(page, "画像を開く", page.getByRole("region", { name: "画像とGIF", exact: true }));
  assert.equal(await alt.inputValue(), altText, "Media sync must preserve the entered alt text");
  const state = (await new DraftStore(bucket).read()).state;
  assert.equal(Object.keys(state.assets).length, 1);
  const media = Object.values(state.assets)[0]!;
  assert.equal(state.usedBytes, media.bytes);
  assert.equal(bucket.deletions.length, 0);
  await panel(
    page,
    "保存と確認を開く",
    page.getByRole("button", { name: "Gitへ保存", exact: true }),
  );
  const savedResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/editor-api/save" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Gitへ保存", exact: true }).click();
  const response = await savedResponse;
  assert(response.ok(), "The new Git save must succeed");
  const savedCommit = (await response.json()).commit as string;
  await page
    .locator(".message")
    .filter({ hasText: "Gitへ保存しました。 " + savedCommit.slice(0, 8) })
    .waitFor();
  const humanHead = await git.repository.snapshot(branch),
    human = await git.repository.read(humanHead, file);
  assert.equal(humanHead.commit, savedCommit);
  assert.notEqual(humanHead.commit, first.commit);
  assert.match(human.source, /人間が執筆/u);
  assert.match(human.source, /<Figure\b[^>]*alt="統合検証用の合成画像"/u);
  const aiSource = human.source + "\nAIが同じPRに追記した検証メモ。\n";
  const ai = await git.repository.save({
    branch,
    expectedHead: humanHead.commit,
    path: file,
    source: aiSource,
    producer: "ai",
  });
  await closePanel(page);
  await title.fill("手元に残す未同期の変更");
  await panel(
    page,
    "保存と確認を開く",
    page.getByRole("button", { name: "Gitへ保存", exact: true }),
  );
  await page.getByRole("button", { name: "Gitへ保存", exact: true }).click();
  await page.locator(".conflict-panel").waitFor();
  assert.equal(await title.inputValue(), "手元に残す未同期の変更");
  assert.match(await page.locator(".conflict-panel").innerText(), /AIが同じPR/u);
  assert.equal(git.refs.get(branch), ai.commit);
  const second = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: "ja-JP",
    }),
    mobile = await second.newPage();
  mobile.on("pageerror", capturePageError);
  await mobile.goto(server.origin + "/editor/");
  await mobile.getByRole("textbox", { name: "タイトル", exact: true }).waitFor();
  await mobile.getByRole("button", { name: "下書き一覧を開く", exact: true }).click();
  await mobile.locator(".repository-panel").getByLabel("読み込み元").selectOption(branch);
  await mobile.getByRole("button", { name: "一覧を取得", exact: true }).click();
  await mobile
    .locator(".repository-documents")
    .getByRole("button", { name: "Git引継ぎと私有画像の統合テスト", exact: true })
    .click();
  await mobile.waitForFunction(
    () =>
      (document.querySelector(".title-label textarea") as HTMLTextAreaElement | null)?.value ===
      "Git引継ぎと私有画像の統合テスト",
  );
  await mobile.getByRole("region", { name: "原稿一覧", exact: true }).waitFor({ state: "hidden" });
  await panel(mobile, "画像を開く", mobile.getByRole("region", { name: "画像とGIF", exact: true }));
  await mobile.locator(".media-card").filter({ hasText: "非公開R2に同期済み" }).waitFor();
  await mobile.locator(".media-card img").first().scrollIntoViewIfNeeded();
  await mobile.waitForFunction(() => {
    const image = document.querySelector(".media-card img") as HTMLImageElement | null;
    return Boolean(image?.complete && image.naturalWidth > 0);
  });
  await closePanel(mobile);
  assert.match(await readBody(mobile), /AIが同じPRに追記/u);
  assert(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await audit(mobile, "mobile editor restored private media");
  await mobile.screenshot({ path: resolve(output, "mobile-synthetic-draft.png"), fullPage: true });
  const browserUserAgent = await mobile.evaluate(() => navigator.userAgent);
  const cached = await mobile.evaluate(async () => {
    const keys = await caches.keys();
    return (
      await Promise.all(
        keys
          .filter((k) => k.startsWith("xpotato-editor-"))
          .map(async (k) => (await (await caches.open(k)).keys()).map((r) => r.url)),
      )
    ).flat();
  });
  assert(
    cached.every((url) => !url.includes("editor-api")),
    "Authenticated API responses must not enter shell cache",
  );
  assert(
    git.calls
      .filter((call) => call.method === "PATCH")
      .every((call) => (call.body as { force: boolean }).force === false),
  );
  assert(git.calls.every((call) => !/(?:merge|dispatch|deploy)$/u.test(call.path)));
  assert(
    bucket.writes.every(
      (key) => key.startsWith("objects/") || key === "control/draft-state-v1.json",
    ),
  );
  assert.deepEqual(failures, []);
  await second.close();
  await context.close();
  await promisify(execFile)(process.execPath, [resolve(root, "ops/qa/editor-browser-smoke.mjs")], {
    cwd: root,
    env: process.env,
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
  const reviewOutput = resolve(".local/editor-review", "ci-" + Date.now() + "-" + process.pid);
  const reviewBuild = await promisify(execFile)(
    process.execPath,
    [
      "--import",
      "tsx",
      resolve(root, "ops/authoring/editor-astro-review.ts"),
      "--source",
      "content/articles/77arj41r5z8amrn46pdx71mknr.mdx",
      "--output",
      reviewOutput,
    ],
    { cwd: root, env: process.env, timeout: 180000, maxBuffer: 2 * 1024 * 1024 },
  );
  const built = JSON.parse(reviewBuild.stdout.trim().split("\n").at(-1)!);
  assert.equal(built.codeClean, true, "The review must use the current clean commit");
  assert.equal(built.privateMediaDownloaded, false);
  await promisify(execFile)(
    process.execPath,
    [
      resolve(root, "ops/qa/editor-review-browser.mjs"),
      "--review",
      resolve(reviewOutput, "review.json"),
    ],
    { cwd: root, env: process.env, timeout: 45000, maxBuffer: 2 * 1024 * 1024 },
  );
  const report = {
    astroReviewVerified: true,
    offlineShellVerified: true,
    mode: "real-chromium-with-synthetic-GitHub-and-R2",
    result: "pass",
    tests: [
      "human draft saved to one non-protected branch",
      "Draft PR without merge",
      "private media bytes and quota verified",
      "AI revision on the same branch",
      "stale human save preserves local data and rejects overwrite",
      "second mobile context restores MDX and private image",
      "no runtime errors or horizontal overflow",
      "no public storage writes",
    ],
    commits: git.commits.size,
    prs: git.pulls.length,
    mediaObjects: Object.keys(state.assets).length,
    providerNetworkCalls: 0,
    liveAuthorizationVerified: false,
  };
  await writeFile(resolve(output, "result.json"), JSON.stringify(report, null, 2) + "\n");
  if (process.env.XPOTATO_RELEASE_BROWSER_RUN && process.env.XPOTATO_RELEASE_TEMP) {
    await mkdir(process.env.XPOTATO_RELEASE_TEMP, { recursive: true });
    await writeFile(
      resolve(process.env.XPOTATO_RELEASE_TEMP, "axe-editor-final-dist.json"),
      JSON.stringify(
        {
          suite: "editor",
          runId: process.env.XPOTATO_RELEASE_BROWSER_RUN,
          schemaVersion: 1,
          buildCount: 0,
          browser: browserUserAgent,
          reports: audits,
          editorReport: report,
        },
        null,
        2,
      ) + "\n",
    );
  }
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  await server.close();
}
