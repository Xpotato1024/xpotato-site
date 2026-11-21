import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { editorStaticServer } from "./editor-static-server.mjs";
import { ensureEditing, writeBody, showBlocks, readBody } from "./editor-browser-helpers.mjs";

const root = resolve(".");
const server = await editorStaticServer(root);
const executable = [
  process.env.CHROME_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  chromium.executablePath(),
].find((file) => file && existsSync(file));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(executable ? { executablePath: executable } : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "ja-JP",
  });
  context.setDefaultTimeout(6000);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(server.origin + "/editor/");
  await ensureEditing(page);
  await writeBody(page, "先頭の文章。\n\n末尾の文章。");
  await showBlocks(page);
  const firstRegion = page.locator(".cms-editor-region").first();
  await firstRegion.locator(".cms-preview-target").first().tap();
  assert.equal(await firstRegion.getAttribute("data-active"), "true");
  await page.getByRole("tab", { name: /ブロック/u }).focus();
  const inserter = firstRegion.locator(".cms-insert-after");
  await inserter.waitFor({ state: "visible" });
  assert.equal(await inserter.isEnabled(), true);
  const hitTargetIsButton = await inserter.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit === button || (hit !== null && button.contains(hit));
  });
  assert.equal(hitTargetIsButton, true, "Next block must not cover the insertion button");
  await inserter.tap();
  const palette = page.getByRole("dialog", { name: "ブロックを挿入" });
  await palette.waitFor({ state: "visible" });
  await palette.locator(".cms-palette-choice").filter({ hasText: "Mermaid構成図" }).click();
  await page.getByRole("textbox", { name: "Mermaid構成図のソース" }).waitFor();
  await page.locator(".cms-mermaid-preview svg").first().waitFor({ timeout: 30000 });
  const body = await readBody(page);
  const start = body.indexOf("先頭の文章。");
  const diagram = body.indexOf("flowchart TB");
  const end = body.indexOf("末尾の文章。");
  assert(start >= 0 && diagram > start && end > diagram, "inserted Mermaid must be between blocks");
  assert(body.includes("accTitle: 工程の例"));
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log("PASS: touch insertion between blocks, Mermaid authoring/preview, MDX order.");
  await context.close();
} finally {
  await browser?.close();
  await server.close();
}
