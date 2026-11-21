import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { editorStaticServer } from "./editor-static-server.mjs";

const server = await editorStaticServer(resolve("."));
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
  // The lifecycle and shell-cache integrity are covered by separate PWA tests.
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
  console.log("PASS: PWA update check, invalid registration recovery and stale activation UI.");
} finally {
  await browser?.close();
  await server.close();
}
