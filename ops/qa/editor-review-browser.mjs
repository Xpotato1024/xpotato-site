import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { editorStaticServer } from "./editor-static-server.mjs";
import { readBody, writeBody, panel, closePanel } from "./editor-browser-helpers.mjs";
const root = resolve("."),
  require = createRequire(join(root, "apps/editor/package.json")),
  { zipSync, strToU8 } = require("fflate");
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
const reviewFile = arg("--review");
if (!reviewFile) throw Error("REVIEW_FILE_REQUIRED");
const bundle = JSON.parse(await readFile(resolve(reviewFile), "utf8"));
assert.equal(bundle.codeClean, true, "A real clean-commit Astro review is required");
const source = (await import("node:child_process")).execFileSync(
  "git",
  ["show", bundle.context.commit + ":" + bundle.context.sourcePath],
  { cwd: root, encoding: "utf8" },
);
assert.equal(createHash("sha256").update(source).digest("hex"), bundle.context.sourceSha256);
const zipped = zipSync({ "review.json": strToU8(JSON.stringify(bundle)) }, { level: 1 }),
  requests = [];
const server = await editorStaticServer(root, async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  requests.push(url.pathname);
  res.setHeader("Cache-Control", "no-store");
  if (url.pathname === "/editor-api/review/archive") {
    res.writeHead(200, { "Content-Type": "application/zip" });
    res.end(zipped);
    return;
  }
  let value;
  if (url.pathname === "/editor-api/session")
    value = {
      authenticated: true,
      configured: true,
      user: "review-fixture-owner",
      csrf: "fixture-csrf",
      expires: Date.now() + 60000,
      repository: "Xpotato1024/xpotato-site",
    };
  else if (url.pathname === "/editor-api/branches") value = ["main"];
  else if (url.pathname === "/editor-api/review") {
    assert.equal(url.searchParams.get("commit"), bundle.context.commit);
    assert.equal(url.searchParams.get("contentId"), bundle.context.contentId);
    value = { ready: true, status: "ready" };
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "FIXTURE_ROUTE_DENIED" }));
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
});
let browser;
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
  const context = await browser.newContext({
      viewport: { width: 1365, height: 1000 },
      locale: "ja-JP",
    }),
    page = await context.newPage(),
    errors = [],
    violations = [],
    outside = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (
      !r.url().startsWith(server.origin) &&
      !r.url().startsWith("blob:") &&
      !r.url().startsWith("data:")
    )
      outside.push(r.url());
  });
  await page.addInitScript(() => {
    window.addEventListener("securitypolicyviolation", (e) => {
      if (window.top === window)
        console.error("CSP_VIOLATION:" + e.violatedDirective + ":" + e.blockedURI);
    });
  });
  page.on("console", (message) => {
    if (message.text().startsWith("CSP_VIOLATION:")) violations.push(message.text());
  });
  await page.goto(server.origin + "/editor/");
  await page.getByRole("textbox", { name: "タイトル", exact: true }).waitFor();
  await page.locator(".save-state").filter({ hasText: "保存済み" }).waitFor();
  const input = {
    id: "33333333-3333-4333-8333-333333333333",
    source,
    path: bundle.context.sourcePath,
    sourceBranch: "main",
    workingBranch: "content/review-fixture",
    baseCommit: bundle.context.commit,
    syncedCommit: bundle.context.commit,
    syncedSource: source,
    savedAt: "2099-01-01T00:00:00Z",
    producer: "human",
  };
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWOoCJj2HwAFAAJeoZPDtAAAAABJRU5ErkJggg==",
    "base64",
  );
  const assetId = bundle.assetIds[0];
  assert.ok(assetId, "The real article must contain an image");
  const hash = createHash("sha256").update(png).digest("hex");
  await page.evaluate(
    async ({ draft, assetId, hash, bytes }) => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("xpotato-editor-v1");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction(["drafts", "media"], "readwrite");
        tx.objectStore("drafts").put(draft);
        tx.objectStore("media").put({
          id: "44444444-4444-4444-8444-444444444444",
          draftId: draft.id,
          assetId,
          blob: new Blob([new Uint8Array(bytes)], { type: "image/png" }),
          originalBytes: bytes.length,
          sourceSha256: hash,
          sha256: hash,
          kind: "technical",
          transform: "identity-v1",
          createdAt: new Date().toISOString(),
          originalName: "synthetic-fixture.png",
          sourceRetained: true,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { draft: input, assetId, hash, bytes: [...png] },
  );
  await page.reload();
  await panel(
    page,
    "保存と確認を開く",
    page.getByRole("button", { name: "Astroレビューを取得", exact: true }),
  );
  await page.getByRole("button", { name: "Astroレビューを取得", exact: true }).click();
  const iframe = page.locator('iframe[title="Astro正規レイアウト（表示専用）"]');
  await iframe.waitFor();
  assert.equal(await iframe.getAttribute("sandbox"), "allow-same-origin");
  const frame = await (await iframe.elementHandle()).contentFrame();
  assert.ok(frame);
  await frame.waitForSelector("main.content-page");
  let imageReady = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    imageReady = await frame.evaluate(() =>
      Array.from(document.querySelectorAll("img[data-editor-image-sha]")).some(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    );
    if (imageReady) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(imageReady, "Verified private media must decode inside the sandbox");
  const result = await frame.evaluate(() => ({
    title: document.querySelector("h1")?.textContent,
    article: Boolean(document.querySelector(".article-body")),
    tables: document.querySelectorAll("table").length,
    figures: document.querySelectorAll("figure").length,
    scripts: document.querySelectorAll("script").length,
    liveLinks: document.querySelectorAll("a[href]").length,
    images: [...document.querySelectorAll("img[data-editor-image-sha]")].map((i) => ({
      src: i.getAttribute("src"),
      sha: i.getAttribute("data-editor-image-sha"),
      width: i.naturalWidth,
    })),
    cssLinks: [...document.querySelectorAll("link[rel=stylesheet]")].map((l) =>
      l.getAttribute("href"),
    ),
    h1Font: getComputedStyle(document.querySelector("h1")).fontFamily,
  }));
  assert.ok(result.article && result.figures > 0);
  assert.equal(result.scripts, 0);
  assert.equal(result.liveLinks, 0);
  assert.ok(result.cssLinks.length > 0 && result.cssLinks.every((url) => url.startsWith("blob:")));
  assert.ok(
    result.images.every((i) => i.src.startsWith("blob:") && i.sha === hash && i.width === 1),
  );
  const out = resolve(".local/cms-validation/review-browser");
  await mkdir(out, { recursive: true });
  await page.screenshot({
    path: join(out, "desktop.png"),
    fullPage: true,
    caret: "initial",
    animations: "allow",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: join(out, "mobile.png"), fullPage: true });
  await closePanel(page);
  await writeBody(
    page,
    (await readBody(page)) + "\n下書きを更新したため旧レビューは失効します。\n",
  );
  await panel(
    page,
    "保存と確認を開く",
    page.getByRole("button", { name: "Astroレビューを取得", exact: true }),
  );
  await iframe.waitFor({ state: "detached" });
  assert.equal(
    await page.getByRole("button", { name: "Astroレビューを取得", exact: true }).isDisabled(),
    true,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(violations, []);
  assert.deepEqual(outside, []);
  await writeFile(
    join(out, "result.json"),
    JSON.stringify(
      {
        result: "pass",
        mode: "real-local-Chromium-real-Astro-artifact-synthetic-API",
        sourceCommit: bundle.context.commit,
        sourceSha256: bundle.context.sourceSha256,
        artifactSha256: bundle.htmlSha256,
        checks: [
          "actual Astro layout and figure rendering",
          "private image hash-bound browser-only blob",
          "no article scripts or navigation",
          "strict parent CSP",
          "390px no overflow",
          "edited source invalidates old review",
        ],
        liveGitHub: false,
        liveR2: false,
        productionMutation: false,
        resultDetails: result,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Editor Astro review browser PASS: fixed commit, real components, private blob images, sandbox, CSP, stale invalidation.",
  );
  await context.close();
} finally {
  await browser?.close();
  await server.close();
}
