import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { editorStaticServer } from "./editor-static-server.mjs";

const root = resolve(".");
const swPath = ["apps/site/dist/editor/sw.js", "apps/editor/dist/sw.js"].map(path => resolve(root, path)).find(existsSync);
if (!swPath) throw Error("Build the editor before checking its PWA lifecycle");
const realWorker = await readFile(swPath, "utf8");
let failPrecache = false, nextVersion = false, failedShellRequests = 0, observedFailure;
const precacheRequests = [];
const server = await editorStaticServer(root, undefined, async (request, response) => {
  const path = new URL(request.url, "http://127.0.0.1").pathname;
  if (request.headers["sec-fetch-dest"] === "empty" && path.startsWith("/editor/")) precacheRequests.push(path);
  if (failPrecache && path === "/editor/" && request.headers["sec-fetch-dest"] === "empty") {
    failedShellRequests++;
    response.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
    response.end("Synthetic expired session response");
    observedFailure?.();
    return true;
  }
  if (nextVersion && path === "/editor/sw.js") {
    response.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "no-cache", "Service-Worker-Allowed": "/editor/" });
    response.end(realWorker.replace("xpotato-editor-", "xpotato-editor-qa-next-"));
    return true;
  }
  return false;
});
let browser;
try {
  const executable = [
    process.env.CHROME_PATH,
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome",
    chromium.executablePath(),
  ].find((file) => file && existsSync(file));
  browser = await chromium.launch({
    headless: true,
    ...(executable ? { executablePath: executable } : {}),
  });
  const context = await browser.newContext({ locale: "ja-JP" });
  context.setDefaultTimeout(12000);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Keep the real editor and DOM, but inject reproducible browser SW states.
  // Real registration, installation failure, retry and cache replacement follow below.
  await page.addInitScript(() => {
    const registration = new EventTarget();
    Object.assign(registration, {
      active: { state: "activated" },
      waiting: null,
      installing: null,
      update: async () => {},
    });
    const container = new EventTarget();
    Object.assign(container, {
      controller: { state: "activated" },
      register: async () => registration,
      getRegistration: async () => registration,
    });
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: container });
    Object.defineProperty(window, "__editorSwHarness", {
      configurable: true,
      value: { registration, container },
    });
  });
  await page.goto(server.origin + "/editor/");
  const updateButton = page.getByRole("button", { name: "CMSアプリの更新を確認" });
  await updateButton.waitFor();
  await updateButton.click();
  await page.getByRole("status").filter({ hasText: "編集アプリは最新です。" }).waitFor();
  await page.evaluate(() => {
    window.__editorSwHarness.registration.update = async () => {
      throw new DOMException(
        "Cannot update a null/nonexistent service worker registration",
        "InvalidStateError",
      );
    };
  });
  await updateButton.click();
  await page.getByRole("status").filter({ hasText: "登録状態を確認し直しました" }).waitFor();
  assert.equal(await page.getByRole("alert").count(), 0);

  await page.evaluate(() => {
    window.__editorSwHarness.registration.update = async () => {};
    // An update may have become active without using the manual update button.
    window.dispatchEvent(new Event("editor-update-ready"));
  });
  const readyButton = page.getByRole("button", { name: "CMSアプリの更新を適用" });
  await readyButton.waitFor();
  await page.evaluate(() =>
    window.__editorSwHarness.container.dispatchEvent(new Event("controllerchange")),
  );
  await updateButton.waitFor();

  await page.evaluate(() => window.dispatchEvent(new Event("editor-update-ready")));
  await readyButton.waitFor();
  await readyButton.click();
  await page.getByRole("status").filter({ hasText: "更新はすでに適用されています" }).waitFor();
  assert.equal(await page.getByRole("alert").count(), 0);
  assert.deepEqual(errors, []);
  await context.close();

  const liveContext = await browser.newContext({ locale: "ja-JP" });
  liveContext.setDefaultTimeout(25000);
  const livePage = await liveContext.newPage();
  const liveErrors = [];
  livePage.on("pageerror", error => liveErrors.push(error.message));
  failPrecache = true;
  await livePage.goto(server.origin + "/editor/");
  const liveUpdate = livePage.getByRole("button", { name: "CMSアプリの更新を確認" });
  await liveUpdate.waitFor();
  if (!failedShellRequests) await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("The real worker did not request its shell")), 12000);
    observedFailure = () => { clearTimeout(timer); resolve(); };
  });
  await livePage.waitForFunction(async () => !(await navigator.serviceWorker.getRegistration("/editor/"))?.installing);
  await liveUpdate.click();
  await livePage.getByRole("alert").filter({ hasText: /アプリの準備(?:に失敗|が完了しません)/u }).waitFor();
  assert.equal(await livePage.getByRole("status").filter({ hasText: "編集アプリは最新です" }).count(), 0);
  failPrecache = false;
  await liveUpdate.click();
  await livePage.getByRole("status").filter({ hasText: /登録状態を確認し直しました|編集アプリは最新です/u }).waitFor();
  await livePage.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await liveUpdate.click();
  await livePage.getByRole("status").filter({ hasText: "編集アプリは最新です" }).waitFor();
  assert(precacheRequests.includes("/editor/"));
  assert(!precacheRequests.includes("/editor/index.html"));
  const canonicalRedirect = await liveContext.request.get(server.origin + "/editor/index.html", { maxRedirects: 0 });
  assert.equal(canonicalRedirect.status(), 307);
  const before = await livePage.evaluate(async () => (await caches.keys()).filter(key => key.startsWith("xpotato-editor-")));
  assert.equal(before.length, 1);

  nextVersion = true;
  await liveUpdate.click();
  const liveApply = livePage.getByRole("button", { name: "CMSアプリの更新を適用" });
  await liveApply.waitFor();
  await liveApply.click();
  await liveUpdate.waitFor();
  await livePage.waitForFunction(async () => {
    const keys = (await caches.keys()).filter(key => key.startsWith("xpotato-editor-"));
    return keys.length === 1 && keys[0].startsWith("xpotato-editor-qa-next-");
  });
  const cached = await livePage.evaluate(async () => {
    const keys = (await caches.keys()).filter(key => key.startsWith("xpotato-editor-"));
    return { keys, paths: (await (await caches.open(keys[0])).keys()).map(request => new URL(request.url).pathname) };
  });
  assert(!cached.keys.some(key => before.includes(key)));
  assert(cached.paths.includes("/editor/index.html"));
  assert(cached.paths.length > 5);
  assert(cached.paths.every(path => path.startsWith("/editor/") && !path.includes("editor-api")));
  await liveContext.setOffline(true);
  await livePage.reload();
  await liveUpdate.waitFor();
  assert.deepEqual(liveErrors, []);
  await liveContext.close();
  console.log("PASS: PWA update UI, real registration failure/retry, canonical shell, verified cache replacement and offline reopening.");
} finally {
  await browser?.close();
  await server.close();
}
