import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { chromium, webkit } from "playwright";
import { editorStaticServer } from "./editor-static-server.mjs";
import {
  ensureEditing,
  goHome,
  readBody,
  savedDraft,
  showBlocks,
  writeBody,
} from "./editor-browser-helpers.mjs";

const root = resolve(".");
const browserArgs = process.argv.slice(2);
if (
  browserArgs.length &&
  (browserArgs.length !== 2 ||
    browserArgs[0] !== "--browser" ||
    !["chromium", "webkit"].includes(browserArgs[1]))
) {
  throw Error("Expected --browser chromium or --browser webkit");
}
const browserName = browserArgs[1] ?? "chromium";
const [manifest, index, series] = await Promise.all([
  readFile(resolve(root, "content/registry/editor.json"), "utf8").then(JSON.parse),
  readFile(resolve(root, "content/registry/editor-content-index.json"), "utf8").then(JSON.parse),
  readFile(resolve(root, "content/registry/series/series.json"), "utf8").then(JSON.parse),
]);
const draftDocuments = index.documents.filter((document) => document.draft === true);
assert(draftDocuments.length >= 2, "The Git workflow fixture needs two distinct draft records");
const [mediaDocument, concurrentDocument] = draftDocuments;
const draftBranch = "content/ai-product-review-20261126";
const otherBranch = "content/unrelated-article";
const documentRequests = [];
const mediaRequests = [];
let mediaDownloadGate;
const imageBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWOoCJj2HwAFAAJeoZPDtAAAAABJRU5ErkJggg==",
  "base64",
);
const imageHash = createHash("sha256").update(imageBytes).digest("hex");
const imageId = "44444444-4444-4444-8444-444444444444";
const mediaDraft = {
  id: "33333333-3333-4333-8333-333333333333",
  contentId: mediaDocument.contentId,
  branch: draftBranch,
  commit: "a".repeat(40),
  sourcePath: mediaDocument.path,
  revision: 2,
  lastEditedAt: "2026-11-26T00:00:00.000Z",
  state: "active",
  assets: { "restored-diagram": imageId },
};
const mediaAsset = {
  id: imageId,
  draftId: mediaDraft.id,
  assetId: "restored-diagram",
  sha256: imageHash,
  sourceSha256: imageHash,
  bytes: imageBytes.length,
  sourceBytes: imageBytes.length,
  mime: "image/png",
  kind: "technical",
  createdAt: mediaDraft.lastEditedAt,
  status: "staged",
  transform: "identity-v1",
  sourceRetained: true,
  width: 1,
  height: 1,
  frames: 1,
  durationMs: 0,
};
const sample = index.documents.map((item) => ({
  path: item.path,
  sha: "b".repeat(40),
  bytes: 300,
}));
const api = async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const { pathname } = url;
  const branch = url.searchParams.get("branch") ?? "main";
  if (pathname === "/editor-api/media/" + imageId) {
    mediaRequests.push(pathname);
    if (mediaDownloadGate) {
      const gate = mediaDownloadGate;
      mediaDownloadGate = undefined;
      gate.started();
      await gate.released;
    }
    res.writeHead(200, {
      "Content-Type": mediaAsset.mime,
      "Content-Length": String(imageBytes.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
    });
    res.end(imageBytes);
    return;
  }
  if (pathname === "/editor-api/draft-main") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    assert.equal(input.branch, draftBranch);
    assert.equal(input.expectedHead, "a".repeat(40));
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(
      JSON.stringify({
        branch: input.branch,
        head: input.expectedHead,
        main: input.expectedHead,
        ancestor: input.expectedHead,
        behind: 0,
        status: "current",
        conflicts: [],
      }),
    );
    return;
  }
  if (pathname === "/editor-api/document") {
    const path = url.searchParams.get("path");
    const entry = index.documents.find((item) => item.path === path);
    assert(entry);
    documentRequests.push({ branch, path, commit: url.searchParams.get("commit") });
    const source = [
      "---",
      "id: " + JSON.stringify(entry.contentId),
      "title: " + JSON.stringify(entry.title),
      'description: "同じ作業ブランチの引継ぎを確認する合成原稿"',
      'category: "software"',
      "tags: []",
      "draft: true",
      "---",
      branch === draftBranch
        ? "AIが同じブランチへ書いた確認用の本文。"
        : "別ブランチの無関係な本文。",
      "",
      ...(path === mediaDraft.sourcePath
        ? ['<Figure asset="restored-diagram" alt="同期確認の画像" title="同期した図" />', ""]
        : []),
    ].join("\n");
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ source, path, blobSha: "c".repeat(40) }));
    return;
  }
  const payload =
    pathname === "/editor-api/session"
      ? {
          authenticated: true,
          configured: true,
          repository: "Xpotato1024/xpotato-site",
          csrf: "fixture",
        }
      : pathname === "/editor-api/branches"
        ? ["main", draftBranch, otherBranch]
        : pathname === "/editor-api/snapshot"
          ? { branch, commit: "a".repeat(40) }
          : pathname === "/editor-api/manifest"
            ? { ...manifest, contentIndex: index.documents, seriesRegistry: series }
            : pathname === "/editor-api/documents"
              ? sample
              : pathname === "/editor-api/drafts"
                ? [mediaDraft]
                : pathname === "/editor-api/draft" && url.searchParams.get("id") === mediaDraft.id
                  ? { draft: mediaDraft, assets: [mediaAsset] }
                  : null;
  res.writeHead(payload ? 200 : 404, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload ?? { error: "NOT_FOUND" }));
};
const server = await editorStaticServer(root, api);
async function articleDrafts(page, path = mediaDraft.sourcePath) {
  return page.evaluate(
    async ({ path, branch }) => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("xpotato-editor-v1");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        const drafts = await new Promise((resolve, reject) => {
          const request = db.transaction("drafts", "readonly").objectStore("drafts").getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        return drafts.filter((draft) => draft.path === path && draft.workingBranch === branch);
      } finally {
        db.close();
      }
    },
    { path, branch: draftBranch },
  );
}

async function selectGitArticle(page, document = mediaDocument) {
  await page
    .locator(
      ".editor-header:not(.workspace-header):visible, .workspace-home:visible, .start-workspace:visible, .registry-workspace:visible",
    )
    .first()
    .waitFor({ state: "visible" });
  await goHome(page);
  await page.getByRole("button", { name: "下書きの続き", exact: true }).click();
  await page.locator(".repository-panel").getByLabel("読み込み元").selectOption(draftBranch);
  await page.getByRole("button", { name: "一覧を取得", exact: true }).click();
  await page.locator(".repository-documents .draft-choice").first().waitFor();
  await page.getByPlaceholder("原稿を検索").fill(document.path);
  const row = page.locator(".repository-documents .draft-choice");
  assert.equal(await row.count(), 1, "The selected Git path identifies one visible draft");
  assert.equal(await row.locator(":scope > button > strong").innerText(), document.title);
  await row.locator(":scope > button").click();
  const selection = row.locator(".start-selection-inline");
  await selection.waitFor();
  return selection;
}

async function reopenGitArticle(page) {
  const selection = await selectGitArticle(page);
  await selection.getByRole("button", { name: "編集を始める", exact: true }).click();
  await page.locator(".start-workspace").waitFor({ state: "hidden" });
}

async function assertImageDecoded(image, message) {
  await image.waitFor({ state: "attached" });
  const decoded = await image.evaluate(async (element) => {
    await element.decode();
    return {
      complete: element.complete,
      width: element.naturalWidth,
      height: element.naturalHeight,
      local: element.currentSrc.startsWith("blob:"),
    };
  });
  assert.deepEqual(decoded, { complete: true, width: 1, height: 1, local: true }, message);
}

async function assertArticleImages(page, phase) {
  await showBlocks(page);
  await assertImageDecoded(
    page.locator('.cms-module-figure img[alt="同期確認の画像"]'),
    phase + ": block image decodes from its restored bytes",
  );
  await page.getByRole("tab", { name: "プレビュー", exact: true }).click();
  await assertImageDecoded(
    page.frameLocator(".cms-preview-frame").locator('img[alt="同期確認の画像"]'),
    phase + ": scriptless preview image decodes under the production CSP",
  );
}

async function blobStorageSupport(page) {
  const result = await page.evaluate(async (bytes) => {
    const name = "xpotato-editor-blob-storage-probe";
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("probe");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? Error("BLOB_PROBE_DATABASE_OPEN_FAILED"));
    });
    try {
      return await new Promise((resolve) => {
        const tx = db.transaction("probe", "readwrite");
        let failure;
        tx.oncomplete = () => resolve({ supported: true });
        tx.onabort = () => {
          const error = failure ?? tx.error;
          resolve({
            supported: false,
            name: error?.name ?? "UnknownError",
            message: error?.message ?? "The Blob transaction aborted without error details",
          });
        };
        try {
          const request = tx
            .objectStore("probe")
            .put(new Blob([Uint8Array.from(bytes)], { type: "image/png" }), "image");
          request.onerror = () => {
            failure = request.error;
          };
        } catch (error) {
          failure = error;
          tx.abort();
        }
      });
    } finally {
      db.close();
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error ?? Error("BLOB_PROBE_CLEANUP_FAILED"));
        request.onblocked = () => reject(Error("BLOB_PROBE_CLEANUP_BLOCKED"));
      });
    }
  }, Array.from(imageBytes));
  if (!result.supported) {
    assert(
      result.name === "DataCloneError" ||
        (result.name === "UnknownError" && /blob|file/iu.test(result.message)),
      "Unexpected IndexedDB probe failure: " + JSON.stringify(result),
    );
    console.log(
      "IndexedDB Blob storage unavailable: " +
        result.name +
        ": " +
        result.message +
        "; the application must persist and decode portable bytes",
    );
  }
  return result.supported;
}

async function assertStoredImageFormat(page, draftId, supportsBlob) {
  const stored = await page.evaluate(async (draftId) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("xpotato-editor-v1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? Error("MEDIA_FORMAT_DATABASE_OPEN_FAILED"));
    });
    try {
      const images = await new Promise((resolve, reject) => {
        const request = db
          .transaction("media", "readonly")
          .objectStore("media")
          .index("draftId")
          .getAll(draftId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? Error("MEDIA_FORMAT_READ_FAILED"));
      });
      return Promise.all(
        images.map(async (image) => ({
          hasBytes: image.blobBytes instanceof ArrayBuffer,
          bytes: image.blobBytes?.byteLength,
          mime: image.blobType,
          hash:
            image.blobBytes instanceof ArrayBuffer
              ? Array.from(
                  new Uint8Array(await crypto.subtle.digest("SHA-256", image.blobBytes)),
                  (byte) => byte.toString(16).padStart(2, "0"),
                ).join("")
              : "",
          metadataHash: image.blobSha256,
          hasBlob: image.blob instanceof Blob,
        })),
      );
    } finally {
      db.close();
    }
  }, draftId);
  assert.deepEqual(
    stored,
    [
      {
        hasBytes: true,
        bytes: imageBytes.length,
        mime: mediaAsset.mime,
        hash: imageHash,
        metadataHash: imageHash,
        hasBlob: supportsBlob,
      },
    ],
    "The app commits intact bytes and keeps compatibility Blobs only where storage supports them",
  );
}

let browser;
try {
  const executablePath = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    chromium.executablePath(),
  ].find((candidate) => candidate && existsSync(candidate));
  browser =
    browserName === "webkit"
      ? await webkit.launch({ headless: true })
      : await chromium.launch({
          headless: true,
          ...(executablePath ? { executablePath } : {}),
        });
  const context = await browser.newContext({
    viewport: { width: 390, height: 1600 },
    locale: "ja-JP",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(server.origin + "/editor/");
  const supportsBlob = await blobStorageSupport(page);
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

  for (const width of [1203, 320]) {
    await page.setViewportSize({ width, height: 800 });
    const layout = await page.locator(".workspace-navigation").evaluate((nav) => {
      const tabs = [...nav.querySelectorAll("button")].map((button) => {
        const icon = button.querySelector("svg").getBoundingClientRect();
        const label = button.querySelector("span").getBoundingClientRect();
        return {
          labelTop: label.top,
          labelHeight: label.height,
          iconWidth: icon.width,
          gap: label.left - icon.right,
        };
      });
      const left = nav.getBoundingClientRect().left + parseFloat(getComputedStyle(nav).paddingLeft);
      const contentLeft = document.querySelector(".workspace-home").getBoundingClientRect().left;
      return { tabs, left, contentLeft, fits: nav.scrollWidth <= nav.clientWidth };
    });
    assert.equal(layout.tabs.length, 3);
    assert.ok(layout.fits, `Workspace navigation fits at ${width} px`);
    assert.ok(Math.abs(layout.left - layout.contentLeft) <= 1, "Navigation and page gutters align");
    for (const tab of layout.tabs) assert.deepEqual(tab, layout.tabs[0]);
    const updateControl = page.locator(".workspace-header .editor-update-button");
    assert.equal(await updateControl.getAttribute("aria-label"), "CMSアプリの更新を確認");
    const updateRect = await updateControl.evaluate((button) => {
      const box = button.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width, height: box.height };
    });
    assert.ok(
      updateRect.left >= 0 && updateRect.right <= width,
      "PWA update button fits at " + width,
    );
    assert.ok(
      updateRect.width >= 40 && updateRect.height >= 40,
      "PWA update button remains touchable",
    );
  }

  await page.locator(".workspace-header .editor-update-button").click();
  const updateMessage = page.locator('.workspace-messages [role="status"]');
  await updateMessage.waitFor({ timeout: 15000 });
  assert.match(
    await updateMessage.innerText(),
    /編集アプリは最新|新しい編集アプリ/,
    "Manual PWA check must report the version state without reloading",
  );
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.getByRole("button", { name: "下書きの続き" }).click();
  await page.getByRole("heading", { name: "下書きの続き", exact: true }).waitFor();
  await page.locator('.workspace-screen[data-scrollable="false"]').waitFor();
  await page.locator(".repository-panel").getByLabel("読み込み元").selectOption(draftBranch);
  await page.getByRole("button", { name: "一覧を取得" }).click();
  await page.locator(".repository-documents .draft-choice").first().waitFor();
  await page.locator('.workspace-screen[data-scrollable="true"]').waitFor();
  const loadedList = await page.locator(".workspace-screen").evaluate((element) => ({
    overflows: element.scrollHeight > element.clientHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  assert.deepEqual(
    loadedList,
    { overflows: true, overflowY: "auto" },
    "A lazily opened workspace becomes scrollable when its list grows without a viewport change",
  );
  await page
    .getByRole("navigation", { name: "CMSの管理", exact: true })
    .getByRole("button", { name: "ホーム", exact: true })
    .click();
  const firstId = await page.evaluate(
    async ({ bytes, sha256, mime }) => {
      const opened = indexedDB.open("xpotato-editor-v1");
      const db = await new Promise((resolve, reject) => {
        opened.onsuccess = () => resolve(opened.result);
        opened.onerror = () =>
          reject(opened.error ?? Error("CATALOG_FIXTURE_DATABASE_OPEN_FAILED"));
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
          blobBytes: Uint8Array.from(bytes).buffer,
          blobType: mime,
          blobSha256: sha256,
          sha256,
          sourceSha256: sha256,
          originalBytes: bytes.length,
          kind: "technical",
          transform: "identity-v1",
          originalName: "fixture.png",
          sourceRetained: true,
          createdAt: savedAt,
        });
        tx.objectStore("revisions").put({
          id: "rev-" + i,
          draftId: id,
          source,
          savedAt,
          label: "保存",
        });
      }
      try {
        await new Promise((resolve, reject) => {
          let failure;
          tx.oncomplete = resolve;
          tx.onerror = (event) => {
            failure = event.target.error ?? tx.error;
          };
          tx.onabort = () =>
            reject(
              failure ?? tx.error ?? Error("CATALOG_FIXTURE_TRANSACTION_ABORTED_WITHOUT_ERROR"),
            );
        });
      } finally {
        db.close();
      }
      return activeId;
    },
    { bytes: Array.from(imageBytes), sha256: imageHash, mime: mediaAsset.mime },
  );
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

  const sourceBranch = page.locator(".repository-panel").getByLabel("読み込み元");
  await sourceBranch.selectOption(draftBranch);
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
    assert.equal(await selection.locator(".branch-value").innerText(), draftBranch);
    assert.equal(await selection.getByRole("radio").count(), 0);
    assert.equal(await selection.getByRole("combobox").count(), 0);
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

  const archiveToggle = page.getByRole("button", { name: /アーカイブ済みを表示/u });
  assert.equal(await archiveToggle.count(), 0);
  const firstDraft = localRows.filter({ hasText: "端末テスト13" });
  await firstDraft.getByRole("button", { name: /をアーカイブ/u }).click();
  await firstDraft.waitFor({ state: "hidden" });
  await page.reload();
  await archiveToggle.click();
  await firstDraft.getByRole("button", { name: /を下書きに戻す/u }).click();
  await firstDraft.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "作業中の下書きを表示" }).click();
  await firstDraft.waitFor();
  assert.equal(await archiveToggle.count(), 0);

  await sourceBranch.selectOption(draftBranch);
  await page.getByRole("button", { name: "一覧を取得" }).click();
  await choices.first().waitFor();
  await search.fill(mediaDocument.path);
  const selectedRemote = choices;
  assert.equal(await selectedRemote.count(), 1);
  assert.equal(
    await selectedRemote.locator(":scope > button > strong").innerText(),
    mediaDocument.title,
  );
  await selectedRemote.locator(":scope > button").click();
  const prepared = selectedRemote.locator(".start-selection-inline");
  assert.equal(await prepared.locator(".branch-value").innerText(), draftBranch);
  assert.equal(await prepared.getByRole("combobox").count(), 0);
  await page.setViewportSize({ width: 320, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await prepared.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: resolve(".local/cms-validation/selection-inline/bound-draft-320.png"),
  });
  await prepared.getByLabel("添削から開く").check();
  await prepared.getByRole("button", { name: "編集を始める" }).click();
  await page.locator(".start-workspace").waitFor({ state: "hidden" });
  const openedBody = await readBody(page);
  assert.match(openedBody, /AIが同じブランチへ書いた確認用の本文。/u);
  assert.doesNotMatch(openedBody, /別ブランチの無関係な本文/u);
  assert.equal(documentRequests.length, 1);
  assert.equal(documentRequests[0].branch, draftBranch);
  assert.equal(documentRequests[0].commit, "a".repeat(40));
  assert.equal(documentRequests[0].path, mediaDraft.sourcePath);
  await assertArticleImages(page, "First Git open");
  const initialDrafts = await articleDrafts(page);
  assert.equal(initialDrafts.length, 1);
  const initialDraft = initialDrafts[0];
  assert.equal(mediaRequests.length, 1, "Opening Git fetches the private image bytes");
  await assertStoredImageFormat(page, initialDraft.id, supportsBlob);

  await page.reload();
  await ensureEditing(page);
  await assertArticleImages(page, "Reload from IndexedDB");
  assert.equal((await articleDrafts(page))[0].id, initialDraft.id);
  await reopenGitArticle(page);
  await assertArticleImages(page, "Repeated Git open");
  assert.deepEqual(
    (await articleDrafts(page)).map((draft) => draft.id),
    [initialDraft.id],
    "Repeated Git open resumes the same local draft without creating another copy",
  );
  assert.equal(mediaRequests.length, 1, "Verified cached images are reused");

  const editedBody = openedBody + "\n\n端末だけに保存した編集を保持します。";
  const headerEnd = initialDraft.source.indexOf("\n---\n") + 5;
  assert(headerEnd >= 5, "The synthetic source has a frontmatter closing delimiter");
  const editedSource = initialDraft.source.slice(0, headerEnd) + editedBody;
  await writeBody(page, editedBody);
  await savedDraft(page, { source: editedSource });
  await reopenGitArticle(page);
  assert.match(await readBody(page), /端末だけに保存した編集を保持します。/u);
  assert.deepEqual(
    (await articleDrafts(page)).map((draft) => ({ id: draft.id, source: draft.source })),
    [{ id: initialDraft.id, source: editedSource }],
    "Git reopening preserves the exact unsynced local source and identity",
  );

  await page.evaluate(
    async ({ draftId, length }) => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("xpotato-editor-v1");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction("media", "readwrite");
        let failure;
        const store = tx.objectStore("media");
        const request = store.index("draftId").getAll(draftId);
        request.onsuccess = () => {
          if (request.result.length !== 1) {
            failure = Error("CORRUPTION_FIXTURE_EXPECTED_ONE_IMAGE_FOUND_" + request.result.length);
            tx.abort();
            return;
          }
          const { blob: _compatibilityBlob, ...image } = request.result[0];
          const corrupt = new Uint8Array(length);
          store.put({
            ...image,
            blobBytes: corrupt.buffer,
            alt: "復元しても保持する説明",
            caption: "復元しても保持する注記",
          });
        };
        tx.oncomplete = resolve;
        tx.onerror = (event) => {
          failure = event.target.error ?? tx.error;
        };
        tx.onabort = () => reject(failure ?? tx.error ?? Error("CORRUPTION_FIXTURE_FAILED"));
      });
      db.close();
    },
    { draftId: initialDraft.id, length: imageBytes.length },
  );
  await page.reload();
  await showBlocks(page);
  await page.locator(".cms-module-figure .cms-image-error").waitFor();
  assert.match(
    await page.locator(".cms-module-figure .cms-image-error").innerText(),
    /画像を表示できません/u,
    "Unreadable image bytes produce a visible recovery message",
  );
  await reopenGitArticle(page);
  await assertArticleImages(page, "Corrupt cache recovery");
  await assertStoredImageFormat(page, initialDraft.id, supportsBlob);
  assert.equal(mediaRequests.length, 2, "Matching metadata cannot conceal corrupt cached bytes");
  const repaired = await page.evaluate(async (draftId) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("xpotato-editor-v1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const images = await new Promise((resolve, reject) => {
      const request = db
        .transaction("media", "readonly")
        .objectStore("media")
        .index("draftId")
        .getAll(draftId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return images.map((image) => ({
      alt: image.alt,
      caption: image.caption,
      sha256: image.sha256,
    }));
  }, initialDraft.id);
  assert.deepEqual(
    repaired,
    [
      {
        alt: "復元しても保持する説明",
        caption: "復元しても保持する注記",
        sha256: imageHash,
      },
    ],
    "Repair keeps one media record and preserves local presentation edits",
  );
  assert.deepEqual(
    (await articleDrafts(page)).map((draft) => ({ id: draft.id, source: draft.source })),
    [{ id: initialDraft.id, source: editedSource }],
    "Image repair does not alter unsynced text or create another draft",
  );

  await page.evaluate(async (id) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("xpotato-editor-v1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("drafts", "readwrite");
      let failure;
      const store = tx.objectStore("drafts");
      const request = store.get(id);
      request.onsuccess = () =>
        store.add({
          ...request.result,
          id: crypto.randomUUID(),
          source: request.result.source + "\n\n別コピーだけに存在する内容。",
          savedAt: new Date(Date.now() + 1000).toISOString(),
        });
      tx.oncomplete = resolve;
      tx.onerror = (event) => {
        failure = event.target.error ?? tx.error;
      };
      tx.onabort = () =>
        reject(failure ?? tx.error ?? Error("DUPLICATE_FIXTURE_TRANSACTION_ABORTED_WITHOUT_ERROR"));
    });
    db.close();
  }, initialDraft.id);
  await page.reload();
  const duplicateSelection = await selectGitArticle(page);
  assert.equal(await duplicateSelection.getAttribute("aria-label"), "続ける下書きを選択");
  assert.match(await duplicateSelection.innerText(), /同じ原稿の下書きが2件あります/u);
  assert.equal(
    await duplicateSelection.getByRole("button", { name: "編集を始める", exact: true }).count(),
    0,
    "Ambiguous existing drafts require choosing a specific saved copy",
  );
  const candidates = duplicateSelection.locator(".existing-draft-choice");
  assert.equal(await candidates.count(), 2);
  const candidate = candidates.first();
  assert.match(await candidate.innerText(), /端末保存.*\d{2}:\d{2}:\d{2}/u);
  assert.match(await candidate.innerText(), /本文にGit未保存の変更/u);
  await candidate.locator(".draft-comparison > summary").click();
  const sourceDifference = candidate.locator(".draft-difference-text").filter({
    has: page.getByRole("heading", { name: "本文・記事情報の違い", exact: true }),
  });
  await sourceDifference.waitFor();
  assert.match(
    await sourceDifference.innerText(),
    /別コピーだけに存在する内容。/u,
    "The visible comparison identifies the actual source difference between copies",
  );
  const preservedDrafts = await articleDrafts(page);
  const chosenDifference = await sourceDifference.locator("pre").first().innerText();
  const selectedDraft = preservedDrafts.find(
    (draft) =>
      draft.source.includes("別コピーだけに存在する内容。") ===
      chosenDifference.includes("別コピーだけに存在する内容。"),
  );
  assert(selectedDraft, "The visible source difference identifies the selected fixture draft");
  await candidate.getByRole("button", { name: "下書き 1を続ける", exact: true }).click();
  await page.locator(".start-workspace").waitFor({ state: "hidden" });
  const selectedBody = await readBody(page);
  assert.equal(
    selectedBody.includes("別コピーだけに存在する内容。"),
    selectedDraft.source.includes("別コピーだけに存在する内容。"),
  );
  const contentIdentity = (draft) => ({ id: draft.id, source: draft.source });
  const byId = (left, right) => left.id.localeCompare(right.id);
  assert.deepEqual(
    (await articleDrafts(page)).map(contentIdentity).sort(byId),
    preservedDrafts.map(contentIdentity).sort(byId),
    "Choosing one old duplicate preserves both copies and creates no third draft",
  );
  await goHome(page);
  await page.getByRole("button", { name: "下書きの続き", exact: true }).click();
  await page.getByPlaceholder("原稿を検索").fill(mediaDocument.title);
  assert.equal(await page.locator(".draft-choice-local").count(), 2);
  await page.screenshot({
    path: resolve(".local/cms-validation/selection-inline/distinct-local-drafts-320.png"),
  });

  const otherTab = await page.context().newPage();
  try {
    otherTab.on("pageerror", (error) => errors.push(error.message));
    await otherTab.goto(server.origin + "/editor/");
    const [firstSelection, secondSelection] = await Promise.all([
      selectGitArticle(page, concurrentDocument),
      selectGitArticle(otherTab, concurrentDocument),
    ]);
    await Promise.all(
      [firstSelection, secondSelection].map((selection) =>
        selection.getByRole("button", { name: "編集を始める", exact: true }).click(),
      ),
    );
    await Promise.all(
      [page, otherTab].map((tab) => tab.locator(".start-workspace").waitFor({ state: "hidden" })),
    );
    assert.equal(
      (await articleDrafts(page, concurrentDocument.path)).length,
      1,
      "Concurrent Git opens in separate tabs claim one local draft atomically",
    );
    assert.match(await readBody(page), /AIが同じブランチへ書いた確認用の本文。/u);
    assert.match(await readBody(otherTab), /AIが同じブランチへ書いた確認用の本文。/u);
  } finally {
    await otherTab.close();
  }

  const pendingContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pendingOpen = await pendingContext.newPage();
  const deletingTab = await pendingContext.newPage();
  let releaseDownload;
  let downloadTimeout;
  const downloadStarted = new Promise((started) => {
    mediaDownloadGate = {
      started,
      released: new Promise((resolve) => {
        releaseDownload = resolve;
      }),
    };
  });
  try {
    for (const tab of [pendingOpen, deletingTab]) {
      tab.on("pageerror", (error) => errors.push(error.message));
    }
    await pendingOpen.goto(server.origin + "/editor/");
    const pendingSelection = await selectGitArticle(pendingOpen);
    await pendingSelection.getByRole("button", { name: "編集を始める", exact: true }).click();
    try {
      await Promise.race([
        downloadStarted,
        new Promise((_, reject) => {
          downloadTimeout = setTimeout(() => reject(Error("MEDIA_DOWNLOAD_NOT_STARTED")), 15000);
        }),
      ]);
    } finally {
      clearTimeout(downloadTimeout);
    }
    assert.equal(
      (await articleDrafts(pendingOpen)).length,
      1,
      "The in-flight open owns a claimed draft",
    );
    await deletingTab.goto(server.origin + "/editor/");
    await deletingTab.getByRole("button", { name: "下書きの続き", exact: true }).click();
    const claimedRow = deletingTab.locator(".draft-choice-local");
    await claimedRow.waitFor();
    assert.equal(await claimedRow.count(), 1);
    deletingTab.once("dialog", (dialog) => dialog.accept());
    await claimedRow.getByRole("button", { name: /削除/u }).click();
    await deletingTab.getByRole("heading", { name: /この端末（0件）/u }).waitFor();
    releaseDownload();
    await pendingOpen
      .locator(".workspace-messages .message.error")
      .filter({ hasText: /削除/u })
      .waitFor();
    assert.deepEqual(
      await articleDrafts(pendingOpen),
      [],
      "A completed download cannot recreate a deleted draft",
    );
    const orphanMediaCount = await pendingOpen.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("xpotato-editor-v1");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const count = await new Promise((resolve, reject) => {
        const request = db.transaction("media", "readonly").objectStore("media").count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return count;
    });
    assert.equal(
      orphanMediaCount,
      0,
      "Deleting the claimed draft also prevents orphaned image writes",
    );
  } finally {
    releaseDownload();
    mediaDownloadGate = undefined;
    await pendingOpen.context().close();
  }

  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log(
    "Editor paged catalogs, same-branch draft handoff, decoded media persistence and repair, idempotent draft reopening, visible duplicate comparison, local archiving/deletion and scroll policy PASS",
  );
} finally {
  await browser?.close();
  await server.close();
}
