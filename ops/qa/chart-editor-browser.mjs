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

const out = resolve(".local/cms-validation/charts");
await mkdir(out, { recursive: true });
const server = await editorStaticServer(resolve("."));
const checks = [];
const errors = [];
const violations = [];
let browser;
let page;
let phase = "launch";

function begin(name) {
  phase = name;
  console.log("Chart editor browser: " + name);
}

function savedSeries(source) {
  const module = /<LineChart\b[\s\S]*?\/>/u.exec(source)?.[0];
  assert(module, "The draft includes its portable LineChart source");
  const attribute = /\bseries=(["'])([\s\S]*?)\1/u.exec(module)?.[2];
  assert(attribute, "LineChart preserves its series attribute");
  const entities = { quot: '"', apos: "'", amp: "&", lt: "<", gt: ">", "#39": "'" };
  return JSON.parse(attribute.replace(/&(quot|apos|amp|lt|gt|#39);/gu, (_, key) => entities[key]));
}

function csvFile(name, text) {
  return { name, mimeType: "text/csv", buffer: Buffer.from(text, "utf8") };
}

try {
  const executablePath = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    chromium.executablePath(),
  ].find((candidate) => candidate && existsSync(candidate));
  browser = await chromium.launch({
    headless: true,
    timeout: 15000,
    ...(executablePath ? { executablePath } : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1365, height: 1000 },
    locale: "ja-JP",
  });
  context.setDefaultTimeout(15000);
  page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.text().startsWith("CHART_CSP:")) {
      violations.push(message.text());
    }
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      console.error(
        "CHART_CSP:" +
          JSON.stringify({
            directive: event.violatedDirective,
            blockedURI: event.blockedURI,
            disposition: event.disposition,
          }),
      );
    });
  });
  const response = await page.goto(server.origin + "/editor/");
  const csp = response?.headers()["content-security-policy"] ?? null;
  await ensureEditing(page);
  await page
    .getByRole("textbox", { name: "タイトル", exact: true })
    .fill("近似曲線・CSVの操作確認");
  await writeBody(page, "");
  await showBlocks(page);

  begin("insert chart and append two CSV series without changing existing data");
  await page
    .getByRole("region", { name: "本文のブロック編集", exact: true })
    .getByRole("button", { name: "ブロックを追加", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "ブロックを挿入", exact: true })
    .getByRole("button", { name: /折れ線・散布図/u })
    .click();
  const chart = page.locator(".cms-module-linechart");
  await chart.locator(".article-line-chart__plot").waitFor();
  const original = await savedDraft(page);
  const originalSeries = savedSeries(original.source);
  const fields = chart.locator(".cms-module-fields");
  const settings = chart.getByRole("button", { name: "設定", exact: true });
  const openSettings = async () => {
    await showBlocks(page);
    if ((await settings.getAttribute("aria-expanded")) !== "true") {
      await settings.click();
    }
    await fields.waitFor();
  };
  const openImport = async () => {
    await openSettings();
    await fields.getByRole("button", { name: "CSVを取り込む", exact: true }).click();
    const importer = fields.locator(".cms-chart-csv");
    await importer.waitFor();
    return importer;
  };
  const apply = async (expectChange = true) => {
    const previous = await savedDraft(page);
    await fields.getByRole("button", { name: "設定を適用", exact: true }).click();
    await chart.locator(".article-line-chart__plot").waitFor();
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const draft = await savedDraft(page);
      if (!expectChange || draft.source !== previous.source) {
        return draft;
      }
      await new Promise((accept) => setTimeout(accept, 50));
    }
    throw new Error("Applied chart settings did not reach the persisted draft");
  };
  const csv =
    '\uFEFF時間 (s),"条件A,実測",条件B,メモ\r\n' +
    '0,1.23456789012345,2,"カンマ,を含む"\r\n' +
    '1,3.23456789012345,5,"二重引用符""と\r\n改行"\r\n' +
    "2,5.23456789012345,8,三点目\r\n" +
    "3,7.23456789012345,11,四点目\r\n" +
    "4,9.23456789012345,14,五点目\r\n" +
    "5,11.23456789012345,17,六点目\r\n";
  let importer = await openImport();
  await importer
    .getByLabel("ファイル", { exact: true })
    .setInputFiles(csvFile("measurements.csv", csv));
  const csvPreview = importer.getByRole("region", { name: "CSVの先頭5行", exact: true });
  await csvPreview.waitFor();
  assert.equal(await csvPreview.locator("tbody tr").count(), 5);
  assert.match(await csvPreview.locator("caption").innerText(), /6行/u);
  assert.match(await csvPreview.locator("tbody").innerText(), /二重引用符"と\s*改行/u);
  await importer.getByRole("checkbox", { name: "条件B", exact: true }).check();
  await importer
    .getByRole("textbox", { name: "条件A,実測列の系列名", exact: true })
    .fill("追加測定A");
  assert.equal(
    (await savedDraft(page)).source,
    original.source,
    "Reading CSV does not alter the draft",
  );
  await importer.getByRole("button", { name: "系列を追加して取り込む", exact: true }).click();
  assert.equal(await fields.locator(".cms-chart-series").count(), originalSeries.length + 2);
  assert.equal(
    (await savedDraft(page)).source,
    original.source,
    "Imported data waits for applying chart settings",
  );
  const appended = await apply();
  const appendedSeries = savedSeries(appended.source);
  assert.deepEqual(appendedSeries.slice(0, originalSeries.length), originalSeries);
  assert.equal(appendedSeries.at(-2).label, "追加測定A");
  assert.equal(appendedSeries.at(-2).points[0].y, 1.23456789012345);
  assert.equal(appendedSeries.at(-1).points.length, 6);
  await chart.locator('.article-line-chart[data-kind="analysis"]').waitFor();
  checks.push(
    "CSV BOM/quoted multiline/first-five-row preview/multiple Y/explicit append/original data preservation",
  );

  begin("explicitly replace one series and retain all other series");
  importer = await openImport();
  await importer
    .getByLabel("ファイル", { exact: true })
    .setInputFiles(
      csvFile(
        "replacement.csv",
        "時間 (s),差し替え測定\n0,0.123456789012345\n1,3.123456789012345\n2,6.123456789012345\n3,9.123456789012345\n4,12.123456789012345\n5,15.123456789012345",
      ),
    );
  await importer.getByRole("region", { name: "CSVの先頭5行", exact: true }).waitFor();
  await importer.getByRole("combobox", { name: "取り込み先", exact: true }).selectOption("2");
  await importer.getByRole("button", { name: "系列を置き換えて取り込む", exact: true }).click();
  const replaced = await apply();
  const replacedSeries = savedSeries(replaced.source);
  assert.equal(replacedSeries.length, appendedSeries.length);
  assert.equal(replacedSeries[2].label, "差し替え測定");
  for (const index of [0, 1, 3]) {
    assert.deepEqual(replacedSeries[index], appendedSeries[index]);
  }
  checks.push("Explicit single-series replacement preserves adjacent series");

  begin("reject missing values, formulas and invalid encoding without losing chart data");
  importer = await openImport();
  for (const [filename, bad] of [
    ["missing.csv", "時間,測定値\n0,1\n1,\n2,5"],
    ["formula.csv", "時間,測定値\n0,1\n1,=2+3\n2,5"],
  ]) {
    await importer.getByLabel("ファイル", { exact: true }).setInputFiles(csvFile(filename, bad));
    await importer.getByRole("alert").filter({ hasText: "3行目" }).waitFor();
    assert.equal(
      await importer
        .getByRole("button", { name: "系列を追加して取り込む", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal((await savedDraft(page)).source, replaced.source);
  }
  await importer.getByLabel("ファイル", { exact: true }).setInputFiles({
    name: "invalid-utf8.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([0x78, 0x2c, 0x79, 0x0a, 0x31, 0x2c, 0xe3, 0x81]),
  });
  await importer.getByRole("alert").filter({ hasText: "文字コード" }).waitFor();
  assert.equal(
    await importer
      .getByRole("button", { name: "系列を追加して取り込む", exact: true })
      .isDisabled(),
    true,
  );
  await importer.getByRole("button", { name: "取り込みをキャンセル", exact: true }).click();
  assert.equal((await savedDraft(page)).source, replaced.source);
  importer = await openImport();
  await importer
    .getByLabel("ファイル", { exact: true })
    .setInputFiles(csvFile("cancel.csv", "x,y\n0,9\n1,8"));
  await importer.getByRole("region", { name: "CSVの先頭5行", exact: true }).waitFor();
  await importer.getByRole("button", { name: "取り込みをキャンセル", exact: true }).click();
  assert.deepEqual(savedSeries((await apply(false)).source), replacedSeries);
  checks.push(
    "Missing/formula/encoding errors identify the problem and cancellation preserves stored series",
  );

  begin("fit a measured series, retain raw values and reopen the persisted model");
  const fitChoice = fields.getByRole("combobox", { name: "系列3の近似方法", exact: true });
  await fitChoice.selectOption("log");
  await fields.getByRole("button", { name: "設定を適用", exact: true }).click();
  await fields.getByRole("alert").filter({ hasText: "対数近似はX" }).waitFor();
  assert.equal(
    await fitChoice.inputValue(),
    "log",
    "A rejected model remains selected for correction",
  );
  assert.equal(
    (await savedDraft(page)).source,
    replaced.source,
    "An invalid fit does not replace saved chart data",
  );
  await fitChoice.selectOption("linear");
  const firstMeasuredY = fields.getByRole("textbox", { name: "系列3の点1 Y", exact: true });
  await firstMeasuredY.fill("1e-999");
  await fields.getByRole("button", { name: "設定を適用", exact: true }).click();
  await fields.getByRole("alert").filter({ hasText: "名前と数値" }).waitFor();
  assert.equal(
    await firstMeasuredY.inputValue(),
    "1e-999",
    "Underflowing numeric text remains available to fix",
  );
  assert.equal(
    (await savedDraft(page)).source,
    replaced.source,
    "Manual input cannot silently underflow to a stored zero",
  );
  await firstMeasuredY.fill(String(replacedSeries[2].points[0].y));
  const fitted = await apply();
  assert.equal(savedSeries(fitted.source)[2].fit.method, "linear");
  assert.deepEqual(savedSeries(fitted.source)[2].points, replacedSeries[2].points);
  await chart.locator(".article-line-chart__plot .article-line-chart__fit").waitFor();
  await chart.getByText("近似式・計算条件を見る", { exact: true }).click();
  const result = chart.locator(".article-line-chart__fit-result");
  await result.waitFor();
  assert.match(await result.innerText(), /R²（元のYで算出）/u);
  assert.match(await result.innerText(), /係数/u);
  assert((await result.locator("code").count()) >= 1, "Computed coefficients are inspectable");
  const fittedBody = await readBody(page);
  await page.reload();
  await ensureEditing(page);
  assert.equal(await readBody(page), fittedBody);
  await showBlocks(page);
  await chart.locator(".article-line-chart__plot .article-line-chart__fit").waitFor();
  assert.equal(savedSeries((await savedDraft(page)).source)[2].points[0].y, 0.123456789012345);
  checks.push(
    "Invalid logarithmic fit/manual underflow preserve input and stored data; linear fit, coefficients/R², exact raw values, portable MDX and IndexedDB reload",
  );

  begin("append a supplied theoretical curve without observed markers or invented fit statistics");
  importer = await openImport();
  await importer
    .getByLabel("ファイル", { exact: true })
    .setInputFiles(csvFile("theory.csv", "時間,理論曲線\n0,0\n1,1\n2,4\n3,9\n4,16\n5,25"));
  await importer.getByRole("region", { name: "CSVの先頭5行", exact: true }).waitFor();
  await importer.getByRole("combobox", { name: "データの種類", exact: true }).selectOption("curve");
  await importer.getByRole("button", { name: "系列を追加して取り込む", exact: true }).click();
  const finalDraft = await apply();
  const finalSeries = savedSeries(finalDraft.source);
  assert.equal(finalSeries.at(-1).role, "curve");
  assert.equal(finalSeries.at(-1).fit, undefined);
  const curve = chart.locator('.article-line-chart__plot g[data-role="curve"]');
  assert.equal(await curve.count(), 1);
  assert.equal(await curve.locator(".article-line-chart__point").count(), 0);
  assert.equal(await curve.locator(".article-line-chart__external-curve").count(), 1);
  assert.equal(await chart.locator(".article-line-chart__fit-result").count(), 1);
  checks.push(
    "Supplied curve retains its separate role and renders a line without measured markers or automatic fit metrics",
  );

  begin("check chart settings and CSV import controls at 320, 390 and desktop widths");
  const geometry = [];
  for (const width of [320, 390, 1365]) {
    await page.setViewportSize({ width, height: 900 });
    await openSettings();
    const trigger = fields.getByRole("button", { name: "CSVを取り込む", exact: true });
    await trigger.focus();
    await trigger.press("Enter");
    importer = fields.locator(".cms-chart-csv");
    await importer
      .getByLabel("ファイル", { exact: true })
      .setInputFiles(csvFile("layout.csv", "x,y\n0,1\n1,2"));
    await importer.getByRole("region", { name: "CSVの先頭5行", exact: true }).waitFor();
    await importer.getByRole("combobox", { name: "取り込み先", exact: true }).selectOption("2");
    await importer.getByRole("combobox", { name: "Xに使う列", exact: true }).focus();
    assert.equal(
      await importer
        .getByRole("combobox", { name: "Xに使う列", exact: true })
        .evaluate((node) => node === document.activeElement),
      true,
    );
    const measurements = await fields.evaluate((element) => ({
      page: document.documentElement.scrollWidth,
      viewport: innerWidth,
      escapedControls: Array.from(element.querySelectorAll("input,select,button"))
        .filter((control) => control.getClientRects().length > 0)
        .map((control) => ({
          tag: control.tagName,
          label: control.getAttribute("aria-label") ?? control.textContent,
          rect: control.getBoundingClientRect(),
        }))
        .filter(({ rect }) => rect.left < -1 || rect.right > innerWidth + 1)
        .map(({ tag, label }) => ({ tag, label })),
    }));
    assert(measurements.page <= measurements.viewport + 1, JSON.stringify(measurements));
    assert.deepEqual(measurements.escapedControls, [], JSON.stringify(measurements));
    geometry.push({ width, ...measurements });
    await page.screenshot({ path: resolve(out, `csv-settings-${width}.png`), fullPage: true });
    await importer.getByRole("button", { name: "取り込みをキャンセル", exact: true }).click();
  }
  assert.equal((await savedDraft(page)).source, finalDraft.source);
  checks.push("Keyboard-accessible CSV controls and settings contained at 320/390/1365px");

  begin("verify shared preview and source data table");
  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByRole("tab", { name: "プレビュー", exact: true }).click();
  const frame = page.locator(".cms-preview-frame").contentFrame();
  await frame.locator('.article-line-chart[data-kind="analysis"]').waitFor();
  assert.equal(
    await frame.locator(".article-line-chart__plot .article-line-chart__fit").count(),
    1,
  );
  assert.equal(
    await frame.locator(".article-line-chart__plot .article-line-chart__external-curve").count(),
    1,
  );
  await frame.getByText("データ表を見る", { exact: true }).click();
  assert.equal(
    await frame.locator(".article-line-chart__data tbody tr").count(),
    finalSeries.reduce((count, series) => count + series.points.length, 0),
  );
  assert.match(
    await frame.locator(".article-line-chart__data:has(table)").innerText(),
    /0\.123456789012345/u,
  );
  await page.screenshot({ path: resolve(out, "analysis-preview-390.png"), fullPage: true });
  assert.equal((await savedDraft(page)).source, finalDraft.source);
  checks.push(
    "Shared static analysis preview/data table; mode and viewport changes leave the source untouched",
  );

  assert.deepEqual(errors, [], "No browser page errors");
  assert.deepEqual(violations, [], "No CSP violations");
  await writeFile(
    resolve(out, "report.json"),
    JSON.stringify({ status: "PASS", checks, geometry, csp, errors, violations }, null, 2) + "\n",
  );
  console.log("Chart editor browser PASS: " + checks.join("; "));
} catch (error) {
  console.error("Chart editor browser FAIL in " + phase);
  if (page) {
    await page.screenshot({ path: resolve(out, "failure.png"), fullPage: true }).catch(() => {});
  }
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
