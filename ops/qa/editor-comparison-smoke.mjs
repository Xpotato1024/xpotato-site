import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { editorStaticServer } from "./editor-static-server.mjs";
import {
  ensureEditing,
  readBody,
  savedDraft,
  showBlocks,
  writeBody,
} from "./editor-browser-helpers.mjs";

const out = resolve(".local/cms-validation/comparison-browser");
await mkdir(out, { recursive: true });
const server = await editorStaticServer(resolve("."));
let browser;
let page;
let phase = "launch";
const checks = [];
const errors = [];
const start = (name) => {
  phase = name;
  console.log("Editor comparison phase START: " + name);
};
const waitCount = async (locator, count) => {
  await locator.nth(count - 1).waitFor();
  assert.equal(await locator.count(), count);
};
async function noOverflow(width) {
  await page.setViewportSize({ width, height: 844 });
  const sizes = await page.evaluate(() => ({
    width: innerWidth,
    page: document.documentElement.scrollWidth,
  }));
  assert(sizes.page <= sizes.width + 1, "Editor fits viewport: " + JSON.stringify(sizes));
}
async function savedBody(body) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const draft = await savedDraft(page);
    if (draft.source.endsWith(body)) return draft;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw Error("Edited body was not persisted");
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
    timeout: 15000,
    ...(executable ? { executablePath: executable } : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "ja-JP",
    isMobile: true,
    hasTouch: true,
  });
  context.setDefaultTimeout(15000);
  page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(server.origin + "/editor/");
  await ensureEditing(page);

  start("create comparison through the palette");
  await writeBody(page, "");
  await showBlocks(page);
  await page.locator(".cms-empty-blocks button").click();
  await page.locator(".cms-palette-choice").filter({ hasText: "複数の条件を比較" }).click();
  const comparison = page.locator(".cms-module-comparison");
  const cases = comparison.locator(".cms-module-comparisoncase");
  const regions = comparison.locator(
    ":scope > .cms-comparison-grid > .cms-block-editor > .cms-block-list > [data-region-id]",
  );
  await waitCount(cases, 3);
  assert.equal(await comparison.locator(":scope > .cms-module-caption button").count(), 0);
  await comparison.getByRole("button", { name: "条件を追加", exact: true }).click();
  await page.locator(".cms-palette-choice").filter({ hasText: "比較条件を追加" }).click();
  await waitCount(cases, 4);
  checks.push("palette creates three conditions; a fourth can be added");

  start("edit a condition label and paragraph");
  const first = cases.first();
  await first.locator(":scope > .cms-module-caption button").click();
  const fields = first.locator(":scope > .cms-module-fields");
  await fields.getByRole("textbox", { name: /^ラベル/u }).fill("編集した条件A");
  await fields.getByRole("button", { name: "設定を適用", exact: true }).click();
  await first.locator(":scope > .cms-module-caption button").click();
  await first.getByRole("button", { name: "段落を編集", exact: true }).click();
  await first.locator('.cms-prose[contenteditable="true"]').fill("条件Aの本文を編集しました。");
  const edited = await readBody(page);
  assert.match(edited, /label="編集した条件A"/u);
  assert.match(edited, /条件Aの本文を編集しました。/u);
  await showBlocks(page);
  checks.push("labels and content remain independently editable");

  start("move and remove whole conditions");
  await regions
    .first()
    .locator(":scope > .cms-region-toolbar .cms-region-actions > button")
    .click();
  await regions.first().getByRole("button", { name: "下へ移動", exact: true }).click();
  await cases
    .nth(1)
    .locator(":scope > .cms-module-caption strong")
    .filter({ hasText: "編集した条件A" })
    .waitFor();
  await regions.nth(2).locator(":scope > .cms-region-toolbar .cms-region-actions > button").click();
  await regions.nth(2).getByRole("button", { name: "ブロックを削除", exact: true }).click();
  await waitCount(cases, 3);
  const result = await readBody(page);
  assert(result.indexOf('label="条件B"') < result.indexOf('label="編集した条件A"'));
  assert(!result.includes('label="条件C"'));
  assert(result.includes("条件Aの本文を編集しました。"));
  await savedBody(result);
  await page.reload();
  await ensureEditing(page);
  assert.equal(await readBody(page), result);
  checks.push("condition order, edits and deletion survive local save and reload");

  start("preview condition columns at desktop and phone widths");
  await page.getByRole("tab", { name: "プレビュー", exact: true }).click();
  const devices = page.getByRole("group", { name: "プレビューの画面サイズ", exact: true });
  for (const [label, width] of [
    ["PC", 1440],
    ["スマートフォン", 390],
  ]) {
    await devices.getByRole("button", { name: new RegExp("^" + label) }).click();
    const frame = page.frameLocator('.cms-preview-frame[width="' + width + '"]');
    await frame.locator(".article-comparison__case").nth(2).waitFor();
    const boxes = await frame.locator(".article-comparison__case").evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, width: rect.width };
      }),
    );
    assert.equal(boxes.length, 3);
    if (width === 1440)
      assert(boxes[1].left > boxes[0].left, "Desktop presents comparison columns");
    else assert(boxes[1].top > boxes[0].top, "Phone stacks whole labeled conditions");
    assert(boxes.every((box) => box.width > 0 && box.right <= width + 1));
    await page.screenshot({ path: resolve(out, "preview-" + width + ".png"), fullPage: true });
  }
  checks.push("actual preview CSS creates responsive condition columns");

  start("incomplete comparison warning and recovery");
  await showBlocks(page);
  for (const index of [2, 1]) {
    await regions
      .nth(index)
      .locator(":scope > .cms-region-toolbar .cms-region-actions > button")
      .click();
    await regions.nth(index).getByRole("button", { name: "ブロックを削除", exact: true }).click();
    await cases.nth(index).waitFor({ state: "detached" });
  }
  const notice = "比較には条件を2つ以上追加してください。";
  await comparison.locator(":scope > .cms-field-error").filter({ hasText: notice }).waitFor();
  const incomplete = await readBody(page);
  assert(incomplete.includes('label="条件B"'));
  assert(incomplete.includes("条件Bの説明。"));
  await page.getByRole("tab", { name: "プレビュー", exact: true }).click();
  await page.frameLocator(".cms-preview-frame").getByText(notice, { exact: true }).waitFor();
  await showBlocks(page);
  await comparison.getByRole("button", { name: "条件を追加", exact: true }).click();
  await page.locator(".cms-palette-choice").filter({ hasText: "比較条件を追加" }).click();
  await waitCount(cases, 2);
  await comparison.locator(":scope > .cms-field-error").waitFor({ state: "hidden" });
  const restored = await readBody(page);
  assert(restored.includes('label="条件B"'));
  assert(restored.includes("条件Bの説明。"));
  await showBlocks(page);
  await noOverflow(320);
  await noOverflow(390);
  checks.push(
    "one-condition drafts retain their content, warn locally and recover by adding a condition",
  );

  start("legacy comparison and diagnostic supplement");
  const legacy =
    '<Comparison leftLabel="前" rightLabel="後">\n\n以前からある文章。\n\n比較の説明。\n\n</Comparison>';
  await writeBody(page, legacy);
  await showBlocks(page);
  assert.equal(await comparison.locator(".cms-comparison-grid").count(), 0);
  await comparison.locator(":scope > .cms-module-caption button").click();
  const legacyFields = comparison.locator(":scope > .cms-module-fields");
  await legacyFields.getByRole("textbox", { name: /^左側のラベル/u }).fill("以前");
  await legacyFields.getByRole("button", { name: "設定を適用", exact: true }).click();
  assert.equal(await readBody(page), legacy.replace('leftLabel="前"', 'leftLabel="以前"'));
  const diagnostic =
    '<DiagnosticList>\n\n<DiagnosticItem symptom="症状" check="確認" />\n\n</DiagnosticList>';
  await writeBody(page, diagnostic);
  await showBlocks(page);
  const diagnosticItem = page.locator(".cms-module-diagnosticitem");
  await diagnosticItem.getByRole("button", { name: "ブロックを追加", exact: true }).click();
  await page.locator(".cms-palette-choice").filter({ hasText: "本文・太字・リンク" }).click();
  await diagnosticItem.getByRole("button", { name: "段落を編集", exact: true }).click();
  await diagnosticItem.locator('.cms-prose[contenteditable="true"]').fill("症状に添える補足です。");
  assert.match(await readBody(page), /症状に添える補足です。/u);
  await showBlocks(page);
  for (const width of [320, 390]) {
    await noOverflow(width);
    await page.screenshot({ path: resolve(out, "diagnostic-" + width + ".png"), fullPage: true });
  }
  checks.push("legacy bodies are preserved; diagnostic supplemental content is editable");
  assert.deepEqual(errors, []);
  await writeFile(resolve(out, "report.json"), JSON.stringify({ checks, errors }, null, 2) + "\n");
  console.log("Editor comparison smoke PASS: " + checks.join("; "));
  await context.close();
} catch (error) {
  console.error("Editor comparison phase FAIL: " + phase);
  if (page && !page.isClosed()) {
    await Promise.allSettled([
      page.screenshot({ path: resolve(out, "failure.png"), fullPage: true, timeout: 5000 }),
      page.content().then((html) => writeFile(resolve(out, "failure.html"), html)),
      writeFile(
        resolve(out, "failure.json"),
        JSON.stringify({ phase, message: String(error), errors }, null, 2),
      ),
    ]);
  }
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
