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
  const page = await browser.newPage({ viewport: { width: 390, height: 1600 }, locale: "ja-JP" });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(server.origin + "/editor/");
  const homeScreen = page.locator(".workspace-screen");
  await homeScreen.waitFor();
  await page.waitForTimeout(300);
  const initialGeometry = await homeScreen.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    dataset: element.dataset.scrollable,
    content: element.firstElementChild?.getBoundingClientRect().height,
    viewport: innerHeight,
    css: getComputedStyle(element).overflowY,
  }));
  console.log("SHORT_HOME_GEOMETRY " + JSON.stringify(initialGeometry));
  await page.locator('.workspace-screen[data-scrollable="false"]').waitFor();
  const noScroll = await page.locator(".workspace-screen").evaluate((element) => {
    element.scrollTop = 400;
    return { scrollTop: element.scrollTop, overflowY: getComputedStyle(element).overflowY };
  });
  assert.equal(noScroll.scrollTop, 0, "Short home must not scroll");
  assert.equal(noScroll.overflowY, "hidden", "Short home must not rubber-band inside the app");

  const firstId = await page.evaluate(async () => {
    const opened = indexedDB.open("xpotato-editor-v1", 3);
    const db = await new Promise((resolve, reject) => {
      opened.onsuccess = () => resolve(opened.result);
      opened.onerror = () => reject(opened.error);
    });
    const tx = db.transaction(["drafts", "media", "revisions"], "readwrite");
    let activeId = "";
    const now = Date.now();
    for (let i = 0; i < 15; i++) {
      const id = crypto.randomUUID();
      if (i === 14) activeId = id;
      const title = "端末テスト" + i;
      const source = [
        "---",
        'id: "' + id + '"',
        "title: " + JSON.stringify(title),
        'description: "保存した下書き"',
        'category: "software"',
        "tags: []",
        "draft: true",
        "---",
        "本文",
      ].join("\n");
      const savedAt = new Date(now - (14 - i) * 60_000).toISOString();
      tx.objectStore("drafts").put({
        id,
        source,
        path: "content/articles/device-" + i + ".mdx",
        sourceBranch: "main",
        workingBranch: "",
        baseCommit: "",
        savedAt,
        producer: "human",
      });
      tx.objectStore("media").put({
        id: "media-" + i,
        draftId: id,
        assetId: "figure-" + i,
        blob: new Blob(["image"], { type: "image/png" }),
      });
      tx.objectStore("revisions").put({
        id: "rev-" + i,
        draftId: id,
        source,
        savedAt,
        label: "保存",
      });
    }
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
    db.close();
    return activeId;
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole("button", { name: "下書きの続き" }).click();
  const localRows = page.locator(".draft-choice-local");
  const localPager = page.getByRole("navigation", { name: "この端末のページ送り" });
  await localRows.first().waitFor();
  assert.equal(await localRows.count(), 6);
  assert.match(await localPager.innerText(), /15件/u);
  assert.match(await localRows.first().innerText(), /端末テスト14/u);
  await localPager.getByRole("button", { name: "次へ" }).click();
  assert.equal(await localRows.count(), 6);
  assert.match(await localRows.first().innerText(), /端末テスト8/u);

  await page.getByRole("button", { name: "一覧を取得" }).click();
  const choices = page.locator(".repository-documents .draft-choice");
  const remotePager = page.getByRole("navigation", { name: "Gitの原稿のページ送り" });
  await choices.first().waitFor();
  assert.equal(await choices.count(), 6);
  assert.match(await remotePager.innerText(), /件/u);
  assert.match(
    await localPager.innerText(),
    /2\/3ページ/u,
    "Local page must survive remote loading",
  );
  const firstRemote = await choices.first().innerText();
  await remotePager.getByRole("button", { name: "次へ" }).click();
  assert.equal(await choices.count(), 6);
  assert.notEqual(await choices.first().innerText(), firstRemote);
  assert.match(
    await localPager.innerText(),
    /2\/3ページ/u,
    "Local page must survive remote paging",
  );

  for (const selectedIndex of [0, 2]) {
    const choice = choices.nth(selectedIndex);
    await choice.locator(":scope > button").click();
    const selection = choice.locator(":scope > .start-selection-inline");
    await selection.waitFor();
    assert.equal(await page.locator(".start-selection-inline").count(), 1);
    const action = selection.getByRole("button", { name: "編集を始める" });
    assert.equal(await action.count(), 1);
    assert.notEqual(
      await action.evaluate((button) => getComputedStyle(button).backgroundColor),
      "rgba(0, 0, 0, 0)",
      "Inline action must retain primary styling",
    );
    assert.equal(await selection.getByRole("group", { name: "作業場所" }).count(), 1);
    assert.equal(
      await choice.evaluate(
        (row) =>
          row.querySelector(":scope > button")?.nextElementSibling ===
          row.querySelector(":scope > .start-selection-inline"),
      ),
      true,
    );
  }

  const search = page.getByPlaceholder("原稿を検索");
  await search.fill("端末テスト14");
  assert.equal(await localRows.count(), 1, "Search must include items on other pages");
  assert.equal(await choices.count(), 0);
  assert.equal(await localPager.count(), 0);
  await search.fill("");
  assert.equal(await localRows.count(), 6);
  assert.match(await localRows.first().innerText(), /端末テスト14/u);
  assert.match(await remotePager.innerText(), /1\//u, "Filtering resets remote pagination");

  const first = localRows.first();
  await first.locator(":scope > button").first().click();
  await first.locator(":scope > .start-selection-inline").waitFor();
  page.once("dialog", (dialog) => dialog.accept());
  await first.getByRole("button", { name: /削除/u }).click();
  await page.getByRole("heading", { name: /この端末（14件）/u }).waitFor();
  assert.equal(await localRows.count(), 6);
  const localResult = await page.evaluate(async (id) => {
    const req = indexedDB.open("xpotato-editor-v1");
    const db = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction(["drafts", "media", "revisions"], "readonly");
    const lookup = (name) =>
      new Promise((resolve, reject) => {
        const r = tx
          .objectStore(name)
          .get(name === "drafts" ? id : name === "media" ? "media-14" : "rev-14");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    const [draft, media, revision] = await Promise.all(
      ["drafts", "media", "revisions"].map(lookup),
    );
    const preserved = await new Promise((resolve, reject) => {
      const r = tx.objectStore("drafts").count();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    db.close();
    return {
      missingDraft: draft === undefined,
      missingMedia: media === undefined,
      missingRevision: revision === undefined,
      preserved,
    };
  }, firstId);
  assert.deepEqual(localResult, {
    missingDraft: true,
    missingMedia: true,
    missingRevision: true,
    preserved: 14,
  });
  await page.reload();
  await page.locator(".draft-choice-local").first().waitFor();
  assert.equal(await page.locator(".draft-choice-local").count(), 6);
  assert.doesNotMatch(
    await page.locator(".draft-choice-local").first().innerText(),
    /端末テスト14/u,
    "Deleted active draft must not resurrect on reload",
  );

  const geometry = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    root: document.querySelector(".workspace-screen")?.dataset.scrollable,
  }));
  assert.ok(geometry.scrollWidth <= geometry.width + 1, "No horizontal overflow");
  assert.equal(geometry.root, "true", "Long document lists must remain scrollable");
  await mkdir(resolve(".local/cms-validation/selection-inline"), { recursive: true });
  await page.screenshot({
    path: resolve(".local/cms-validation/selection-inline/paged-mobile-390.png"),
  });
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log(
    "Editor paged catalogs, inline actions, local deletion with media/revisions and scroll policy PASS",
  );
} finally {
  await browser?.close();
  await server.close();
}
