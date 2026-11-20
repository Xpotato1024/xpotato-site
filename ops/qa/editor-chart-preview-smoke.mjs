import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { editorStaticServer } from "./editor-static-server.mjs";
import {
  ensureEditing,
  readBody,
  showBlocks,
  writeBody,
  savedDraft,
  closePanel,
} from "./editor-browser-helpers.mjs";

const out = resolve(".local/cms-validation/chart-preview");
await mkdir(out, { recursive: true });
const server = await editorStaticServer(resolve("."));
let browser, page;
const checks = [],
  errors = [];
const visibleFrame = () => page.locator(".cms-preview-frame").contentFrame();
try {
  const executablePath = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    chromium.executablePath(),
  ].find((value) => value && existsSync(value));
  browser = await chromium.launch({
    headless: true,
    timeout: 15000,
    ...(executablePath ? { executablePath } : {}),
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
  await writeBody(page, "");
  await showBlocks(page);
  const blocks = page.getByRole("region", { name: "本文のブロック編集", exact: true });
  await blocks.getByRole("button", { name: "ブロックを追加", exact: true }).click();
  await page
    .getByRole("dialog", { name: "ブロックを挿入", exact: true })
    .getByRole("button", { name: /折れ線・散布図/u })
    .click();
  const chart = page.locator(".cms-module-linechart");
  await chart.locator(".article-line-chart__plot").waitFor();
  assert.equal(
    await chart.locator(".article-line-chart__plot .article-line-chart__line").count(),
    2,
  );
  assert.equal(
    await chart.locator(".article-line-chart__plot .article-line-chart__point").count(),
    6,
  );
  const original = await savedDraft(page);
  await chart.getByRole("button", { name: "設定", exact: true }).click();
  const fields = chart.locator(".cms-module-fields");
  const firstY = fields.getByRole("textbox", { name: "系列1の点1 Y", exact: true });
  await firstY.fill("");
  await fields.getByRole("button", { name: "設定を適用", exact: true }).click();
  await fields.locator(".cms-field-error").waitFor();
  assert.equal(await firstY.inputValue(), "", "Empty numeric input stays empty");
  assert.equal(
    (await savedDraft(page)).source,
    original.source,
    "Invalid values never replace stored graph data",
  );
  await firstY.fill("-1.2500");
  assert.equal(
    await firstY.inputValue(),
    "-1.2500",
    "Typing preserves decimal digits before applying",
  );
  await fields.getByRole("combobox", { name: "グラフの表示", exact: true }).selectOption("scatter");
  await fields.getByRole("textbox", { name: "系列1の点2 X", exact: true }).fill("0");
  await fields.getByRole("button", { name: "設定を適用", exact: true }).click();
  await chart.locator('.article-line-chart[data-kind="scatter"]').waitFor();
  assert.equal(
    await chart.locator(".article-line-chart__plot .article-line-chart__line").count(),
    0,
  );
  const body = await readBody(page);
  assert.match(body, /kind="scatter"/u);
  assert.match(body, /-1\.25/u);
  assert.match(body, /&quot;x&quot;:0,&quot;y&quot;:-1\.25.*&quot;x&quot;:0/u);
  const draft = await savedDraft(page);
  await page.reload();
  await ensureEditing(page);
  assert.equal(await readBody(page), body);
  await showBlocks(page);
  assert.equal(await page.locator('.article-line-chart[data-kind="scatter"]').count(), 1);
  await page.screenshot({ path: resolve(out, "scatter-editor-390.png"), fullPage: true });
  checks.push(
    "palette insertion, two series, empty/negative/decimal data, repeated scatter X, persistence and reload",
  );

  await page.getByRole("tab", { name: "プレビュー", exact: true }).click();
  await visibleFrame().locator('.article-line-chart[data-kind="scatter"]').waitFor();
  await visibleFrame().getByText("データ表を見る", { exact: true }).click();
  assert.equal(await visibleFrame().locator("tbody tr").count(), 6);
  assert.equal(
    await visibleFrame().locator("tbody tr").first().locator("td").last().textContent(),
    "-1.25",
  );
  assert.equal(await page.locator(".cms-preview-caption").count(), 0);
  assert.equal(await page.getByRole("combobox", { name: "表示倍率", exact: true }).count(), 1);
  for (const device of ["PC", "タブレット", "スマートフォン"]) {
    await page
      .locator(".cms-preview-devices")
      .getByRole("button", { name: new RegExp("^" + device, "u") })
      .click();
    await visibleFrame().locator(".article-line-chart").waitFor();
    const zoom = page.getByRole("combobox", { name: "表示倍率", exact: true });
    await zoom.selectOption("fit");
    assert.match(await zoom.locator("option:checked").textContent(), /幅に合わせる（\d+%）/u);
    await zoom.selectOption("actual");
    assert.equal(await page.locator(".cms-preview-viewport").getAttribute("data-zoom"), "actual");
    assert.equal(
      await page
        .locator(".cms-preview-frame")
        .evaluate((frame) => getComputedStyle(frame).transform),
      "matrix(1, 0, 0, 1, 0, 0)",
    );
    await zoom.selectOption("fit");
  }
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      "Preview chrome stays inside " + width + "px",
    );
    const card = await visibleFrame()
      .locator(".article-line-chart__viewport")
      .evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          width: bounds.width,
          scroll: element.scrollWidth,
          overflow: getComputedStyle(element).overflowX,
        };
      });
    assert.equal(card.overflow, "auto");
    await page.screenshot({ path: resolve(out, `preview-${width}.png`), fullPage: true });
  }
  assert.equal(
    (await savedDraft(page)).source,
    draft.source,
    "Preview controls never alter the document",
  );
  checks.push(
    "same SVG/data table in preview, one zoom selector, all viewport widths, contained local graph scrolling",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await writeBody(page, "差分を確認する文です。");
  await showBlocks(page);
  const region = page.locator(".cms-editor-region").first();
  await region.getByRole("button", { name: "段落を編集", exact: true }).click();
  await region.getByRole("button", { name: "指摘を追加", exact: true }).click();
  const review = page.getByRole("region", { name: "本文の添削", exact: true });
  const composer = review.locator(".review-composer").first();
  assert.equal(await composer.getByText("修正案ファイルを読み込む", { exact: true }).count(), 0);
  await composer
    .getByRole("textbox", { name: "指摘", exact: true })
    .fill("説明を具体的にしてください。");
  await composer.getByRole("button", { name: "指摘を追加", exact: true }).click();
  const annotated = await savedDraft(page, { annotationCount: 1 });
  const comment = annotated.annotations[0];
  assert.equal(await review.locator(".review-file-actions").getAttribute("open"), null);
  await review.getByText("添削ファイル", { exact: true }).click();
  const payload = {
    version: 1,
    contentId: comment.contentId,
    proposals: [
      {
        commentId: comment.id,
        expected: comment.anchor.quote,
        replacement: "具体的な説明に直した文です。",
        reason: "確認用の修正案",
      },
    ],
  };
  await review.locator('.review-file-actions input[type="file"]').setInputFiles({
    name: "proposals.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(payload)),
  });
  await review
    .getByText("修正案を読み込みました。差分を確認して反映できます。", { exact: true })
    .waitFor();
  await review.locator(".proposal-diff").waitFor();
  const proposed = await savedDraft(page, { annotationCount: 1 });
  assert.equal(proposed.source, annotated.source, "Importing a proposal does not apply it");
  await review.getByRole("button", { name: "修正案を反映", exact: true }).click();
  await closePanel(page);
  assert.match(await readBody(page), /具体的な説明に直した文/u);
  assert.equal((await savedDraft(page, { annotationCount: 1 })).annotations[0].status, "applied");
  checks.push(
    "secondary file tools, create comment, import existing-comment proposal, unchanged body until explicit apply",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(out, "report.json"),
    JSON.stringify({ status: "PASS", checks }, null, 2) + "\n",
  );
  console.log("Editor chart/preview/review smoke PASS: " + checks.join("; "));
} catch (error) {
  if (page)
    await page.screenshot({ path: resolve(out, "failure.png"), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
