import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { editorStaticServer } from "./editor-static-server.mjs";
import { ensureEditing, writeBody } from "./editor-browser-helpers.mjs";

const out = resolve(".local/cms-validation/preview-toolbar");
await mkdir(out, { recursive: true });
const server = await editorStaticServer(resolve("."));
let browser;
const errors = [];
const positions = [];
try {
  const executablePath = [
    process.env.CHROME_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    chromium.executablePath(),
  ].find((candidate) => candidate && existsSync(candidate));
  browser = await chromium.launch({
    headless: true,
    timeout: 15000,
    ...(executablePath ? { executablePath } : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 1365, height: 900 },
    locale: "ja-JP",
  });
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(server.origin + "/editor/");
  await ensureEditing(page);
  const longBody = Array.from(
    { length: 100 },
    (_, i) => `段落${i + 1}。端末切替バーの固定位置を確認するための本文です。`,
  ).join("\n\n");
  await writeBody(page, longBody);
  await page.getByRole("tab", { name: "プレビュー", exact: true }).click();
  const toolbar = page.locator(".cms-site-preview-toolbar");
  await toolbar.waitFor();
  const buttons = page.locator(".cms-preview-devices button");
  assert.equal(await buttons.count(), 3, "Three device choices are exposed");
  const choices = ["PC（1440px）", "タブレット（834px）", "スマートフォン（390px）"];
  for (let i = 0; i < choices.length; i++) {
    const button = buttons.nth(i);
    assert.equal(await button.getAttribute("aria-label"), choices[i]);
    assert.equal(await button.locator("svg[aria-hidden='true']").count(), 1);
    assert.equal((await button.innerText()).includes(choices[i].split("（")[0]), false);
  }
  async function verifySticky(viewWidth, deviceIndex, zoom, split = false) {
    await page.setViewportSize({ width: viewWidth, height: 900 });
    if (split) {
      await page.getByRole("button", { name: "編集とプレビューを並べる" }).click();
    }
    await buttons.nth(deviceIndex).click();
    assert.equal(await buttons.nth(deviceIndex).getAttribute("aria-pressed"), "true");
    await page.getByRole("combobox", { name: "表示倍率" }).selectOption(zoom);
    await page.waitForFunction(() => {
      const stage = document.querySelector(".cms-preview-stage");
      const preview = document.querySelector(".cms-site-preview");
      return (
        stage?.getBoundingClientRect().height > 1300 &&
        Number.parseFloat(
          getComputedStyle(preview).getPropertyValue("--cms-preview-toolbar-offset"),
        ) > 0
      );
    });
    const main = page.locator(".editing-main");
    await main.evaluate((node) => {
      node.scrollTop = Math.min(950, node.scrollHeight - node.clientHeight - 12);
    });
    await page.waitForFunction(() => {
      const root = document.querySelector(".editing-main");
      const top = document.querySelector(".workbench-toolbar")?.getBoundingClientRect();
      const controls = document.querySelector(".cms-site-preview-toolbar")?.getBoundingClientRect();
      return root?.scrollTop > 250 && top && controls && Math.abs(controls.top - top.bottom) <= 2;
    });
    const geometry = await page.evaluate(() => {
      const root = document.querySelector(".editing-main");
      const top = document.querySelector(".workbench-toolbar").getBoundingClientRect();
      const controls = document.querySelector(".cms-site-preview-toolbar").getBoundingClientRect();
      return {
        scrollTop: root.scrollTop,
        topBottom: top.bottom,
        controlsTop: controls.top,
        controlsBottom: controls.bottom,
        viewportWidth: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
      };
    });
    assert(geometry.scrollTop > 250);
    assert(Math.abs(geometry.topBottom - geometry.controlsTop) <= 2, JSON.stringify(geometry));
    assert(geometry.documentWidth <= geometry.viewportWidth + 1, JSON.stringify(geometry));
    await page.screenshot({
      path: resolve(out, `preview-${viewWidth}-${deviceIndex}-${zoom}-${split}.png`),
    });
    positions.push({ viewWidth, deviceIndex, zoom, split, ...geometry });
  }
  await verifySticky(1365, 0, "fit");
  await verifySticky(1365, 1, "actual");
  await verifySticky(1365, 0, "fit", true);
  await verifySticky(834, 1, "fit");
  await verifySticky(390, 2, "fit");
  await verifySticky(320, 2, "actual");
  assert.deepEqual(errors, [], "No browser errors");
  console.log("Preview SVG and sticky controls PASS " + JSON.stringify(positions));
} finally {
  await browser?.close();
  await server.close();
}
