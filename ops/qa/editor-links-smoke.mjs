import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { editorStaticServer } from "./editor-static-server.mjs";
import { ensureEditing, readBody, showBlocks, writeBody } from "./editor-browser-helpers.mjs";

const output = resolve(".local/cms-validation/links");
await mkdir(output, { recursive: true });
const server = await editorStaticServer(resolve("."));
const checks = [];
let browser;
let page;

async function editParagraph(body) {
  await writeBody(page, body);
  await showBlocks(page);
  const region = page.locator(".cms-editor-region").first();
  const activate = region.getByRole("button", { name: "段落を編集", exact: true });
  if (await activate.isVisible()) await activate.click();
  const rich = region.locator('.cms-rich-editor .cms-prose[contenteditable="true"]').first();
  await rich.waitFor();
  return rich;
}

async function selectWords(rich, text) {
  await rich.focus();
  await rich.evaluate((element, text) => {
    const start = element.textContent.indexOf(text);
    if (start < 0) throw Error(`Missing selection: ${text}`);
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let offset = 0;
    let foundStart = false;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const end = offset + node.textContent.length;
      if (!foundStart && start <= end) {
        range.setStart(node, start - offset);
        foundStart = true;
      }
      if (foundStart && start + text.length <= end) {
        range.setEnd(node, start + text.length - offset);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        document.dispatchEvent(new Event("selectionchange"));
        return;
      }
      offset = end;
    }
    throw Error("Selection did not reach its end");
  }, text);
  await page.waitForFunction((expected) => window.getSelection()?.toString() === expected, text);
  await page.evaluate(() => new Promise(requestAnimationFrame));
}

async function openLink(rich, text) {
  await selectWords(rich, text);
  await rich
    .locator("xpath=ancestor::div[contains(@class,'cms-rich-editor')]")
    .getByRole("button", { name: "リンク", exact: true })
    .click();
  const form = page.getByRole("dialog", { name: "リンクの設定", exact: true });
  await form.waitFor();
  return form;
}

async function shrinkKeyboard(height) {
  await page.evaluate(async (height) => {
    const viewport = window.visualViewport;
    if (!viewport) throw Error("VisualViewport is required");
    if (height === null) delete viewport.height;
    else Object.defineProperty(viewport, "height", { value: height, configurable: true });
    viewport.dispatchEvent(new Event("resize"));
    for (let frame = 0; frame < 5; frame++) await new Promise(requestAnimationFrame);
  }, height);
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
    isMobile: true,
    hasTouch: true,
    locale: "ja-JP",
  });
  context.setDefaultTimeout(15000);
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(server.origin + "/editor/");
  await ensureEditing(page);

  let rich = await editParagraph("前の文章と **太字** と *斜体* の後。\n");
  let form = await openLink(rich, "太字 と 斜体");
  assert.equal(await form.getByLabel("表示する文字", { exact: true }).inputValue(), "太字 と 斜体");
  assert(
    await form
      .getByLabel("リンク先URL", { exact: true })
      .evaluate((element) => element === document.activeElement),
  );
  await form.getByLabel("リンク先URL", { exact: true }).fill("https://example.com/reference");
  await form.getByRole("button", { name: "適用", exact: true }).click();
  await form.waitFor({ state: "hidden" });
  assert.match(
    await readBody(page),
    /^前の文章と \[\*\*太字\*\* と \*斜体\*\]\(https:\/\/example.com\/reference\) の後。/u,
  );
  checks.push("Selected words become a link without changing adjacent text or bold/italic marks");

  rich = await editParagraph("前 https://example.com/path 後。\n");
  form = await openLink(rich, "https://example.com/path");
  const display = form.getByLabel("表示する文字", { exact: true });
  assert.equal(
    await form.getByLabel("リンク先URL", { exact: true }).inputValue(),
    "https://example.com/path",
  );
  assert(await display.evaluate((element) => element === document.activeElement));
  await display.fill("参照資料");
  assert.equal(await display.inputValue(), "参照資料");
  await form.getByRole("button", { name: "適用", exact: true }).click();
  await form.waitFor({ state: "hidden" });
  assert.equal(
    await rich.innerText(),
    "前 参照資料 後。",
    "The visible editor must contain the entered link label before switching modes",
  );
  assert.match(await readBody(page), /^前 \[参照資料\]\(https:\/\/example.com\/path\) 後。/u);
  checks.push("A selected URL prompts for its displayed words and replaces only that URL");

  rich = await editParagraph("前 [**太字** と *斜体*](https://example.com/old) 後。\n");
  form = await openLink(rich, "太字 と 斜体");
  await form.getByLabel("リンク先URL", { exact: true }).fill("https://example.com/new");
  await form.getByRole("button", { name: "適用", exact: true }).click();
  await form.waitFor({ state: "hidden" });
  assert.match(
    await readBody(page),
    /^前 \[\*\*太字\*\* と \*斜体\*\]\(https:\/\/example.com\/new\) 後。/u,
  );
  checks.push("Changing an existing link URL keeps its mixed inline formatting");

  rich = await editParagraph("前 [古い表示](https://example.com/old) 後。\n");
  await rich.getByRole("link", { name: "古い表示", exact: true }).click();
  await page
    .getByRole("dialog", { name: "リンクを確認", exact: true })
    .getByRole("button", { name: "編集", exact: true })
    .click();
  form = page.getByRole("dialog", { name: "リンクの設定", exact: true });
  await form.waitFor();
  await form.getByLabel("表示する文字", { exact: true }).fill("新しい表示");
  await form.getByLabel("リンク先URL", { exact: true }).fill("/new/");
  await form.getByRole("button", { name: "適用", exact: true }).click();
  await form.waitFor({ state: "hidden" });
  assert.match(await readBody(page), /^前 \[新しい表示\]\(\/new\/\) 後。/u);
  checks.push("Existing links can change both URL and displayed words");

  rich = await editParagraph("前 [**解除する**](https://example.com/remove) 後。\n");
  await rich.getByRole("link", { name: "解除する", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "リンクを確認", exact: true });
  await preview.waitFor();
  await preview.getByRole("button", { name: "解除", exact: true }).click();
  assert.match(await readBody(page), /^前 \*\*解除する\*\* 後。/u);
  checks.push("Remove link keeps its displayed text and formatting");

  const unchanged = "前の __変えない文章__ と後ろ。\n";
  rich = await editParagraph(unchanged);
  form = await openLink(rich, "変えない文章");
  await form.getByLabel("リンク先URL", { exact: true }).fill("javascript:alert(1)");
  assert(await form.getByRole("button", { name: "適用", exact: true }).isDisabled());
  await form.getByLabel("リンク先URL", { exact: true }).fill("https://example.com/cancel");
  await form.press("Escape");
  await form.waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => window.getSelection()?.toString()), "変えない文章");
  assert(await rich.evaluate((element) => element === document.activeElement));
  assert.equal(await readBody(page), unchanged);
  checks.push(
    "Cancel restores the original selection and leaves exact source unchanged; unsafe URLs are rejected",
  );

  await page.setViewportSize({ width: 320, height: 844 });
  rich = await editParagraph("キーボードで隠れない入力。\n");
  form = await openLink(rich, "入力");
  await shrinkKeyboard(320);
  for (const label of ["リンク先URL", "表示する文字"]) {
    const field = form.getByLabel(label, { exact: true });
    await field.focus();
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const bounds = await field.boundingBox();
    assert(
      bounds && bounds.y >= 0 && bounds.y + bounds.height <= 320,
      `${label} stays above the simulated keyboard`,
    );
  }
  for (const key of ["Tab", "Shift+Tab"]) {
    for (let index = 0; index < 7; index++) {
      await page.keyboard.press(key);
      const focus = await form.evaluate((element) => ({
        inside: element.contains(document.activeElement),
        active: document.activeElement?.outerHTML.slice(0, 300),
      }));
      assert(focus.inside, `${key} remains inside the modal; active=${focus.active}`);
    }
  }
  const bounds = await form.boundingBox();
  assert(bounds && bounds.x >= 0 && bounds.width <= 320);
  await page.screenshot({ path: resolve(output, "link-keyboard-320.png") });
  await form.getByRole("button", { name: "キャンセル", exact: true }).click();
  await shrinkKeyboard(null);
  checks.push(
    "320px mobile dialog keeps fields visible in a reduced viewport and traps keyboard focus",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(output, "results.json"),
    JSON.stringify({ checks, errors, actualIphone: false }, null, 2),
  );
  console.log(`Editor links smoke passed: ${checks.length} checks`);
} catch (error) {
  if (page) await page.screenshot({ path: resolve(output, "failure.png") }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
