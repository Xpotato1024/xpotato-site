import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { editorStaticServer } from "./editor-static-server.mjs";

const root = resolve(".");
const [manifest, index, series] = await Promise.all([
  readFile(resolve(root, "content/registry/editor.json"), "utf8").then(JSON.parse),
  readFile(resolve(root, "content/registry/editor-content-index.json"), "utf8").then(JSON.parse),
  readFile(resolve(root, "content/registry/series/series.json"), "utf8").then(JSON.parse),
]);
const snapshot = { branch: "main", commit: "a".repeat(40) };
const sample = index.documents.map((item) => ({
  path: item.path,
  sha: "b".repeat(40),
  bytes: 300,
}));
const api = (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const payload =
    pathname === "/editor-api/session"
      ? {
          authenticated: true,
          configured: true,
          repository: "Xpotato1024/xpotato-site",
          csrf: "fixture",
        }
      : pathname === "/editor-api/branches"
        ? ["main"]
        : pathname === "/editor-api/snapshot"
          ? snapshot
          : pathname === "/editor-api/manifest"
            ? { ...manifest, contentIndex: index.documents, seriesRegistry: series }
            : pathname === "/editor-api/documents"
              ? sample
              : null;
  res.writeHead(payload ? 200 : 404, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload ?? { error: "NOT_FOUND" }));
};
const server = await editorStaticServer(root, api);
let browser;
try {
  const executablePath = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    chromium.executablePath(),
  ].find((candidate) => candidate && existsSync(candidate));
  browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "ja-JP" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(server.origin + "/editor/");
  await page.getByRole("button", { name: "下書きの続き" }).click();
  await page.getByRole("button", { name: "一覧を取得" }).click();
  const choices = page.locator(".repository-documents .draft-choice");
  await choices.first().waitFor();
  const count = await choices.count();
  assert.ok(count >= 10, "The fixture needs a long Git list");
  for (const selectedIndex of [0, 8]) {
    const choice = choices.nth(selectedIndex);
    await choice.locator(":scope > button").click();
    const selection = choice.locator(":scope > .start-selection-inline");
    await selection.waitFor();
    assert.equal(await page.locator(".start-selection-inline").count(), 1);
    const action = selection.getByRole("button", { name: "編集を始める" });
    assert.equal(await action.count(), 1);
    const background = await action.evaluate((button) => getComputedStyle(button).backgroundColor);
    assert.notEqual(
      background,
      "rgba(0, 0, 0, 0)",
      "Inline action must retain primary button styling",
    );
    assert.equal(await selection.getByRole("group", { name: "作業場所" }).count(), 1);
    const location = await page.evaluate((position) => {
      const rows = Array.from(document.querySelectorAll(".repository-documents .draft-choice"));
      const button = rows[position]?.querySelector(":scope > button");
      const editor = rows[position]?.querySelector(":scope > .start-selection-inline");
      return {
        adjacent: Boolean(button && editor && button.nextElementSibling === editor),
        beforeNext:
          position === rows.length - 1 ||
          Boolean(
            editor &&
            editor.getBoundingClientRect().bottom <= rows[position + 1].getBoundingClientRect().top,
          ),
        bodyOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      };
    }, selectedIndex);
    assert.equal(location.adjacent, true, "Controls must follow the chosen article");
    assert.equal(location.beforeNext, true, "Controls must not follow all fetched articles");
    assert.equal(location.bodyOverflow, false, "Mobile layout must not overflow horizontally");
  }
  await mkdir(resolve(".local/cms-validation/selection-inline"), { recursive: true });
  await page.screenshot({ path: resolve(".local/cms-validation/selection-inline/mobile-390.png") });
  assert.deepEqual(errors, []);
  console.log(
    "Editor selected article actions inline PASS: rows=" +
      count +
      "; selected first and ninth; no overflow",
  );
} finally {
  await browser?.close();
  await server.close();
}
