import { existsSync } from "node:fs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { editorStaticServer } from "./editor-static-server.mjs";
import {
  sourceEditor,
  readBody,
  writeBody,
  showBlocks,
  savedDraft,
  closePanel,
} from "./editor-browser-helpers.mjs";
const root = resolve("."),
  out = resolve(".local/cms-validation/browser");
await mkdir(out, { recursive: true });
const server = await editorStaticServer(root);
let browser;
let activePhase = "";
let phaseStarted = performance.now();
function finishPhase() {
  if (activePhase)
    console.log(
      `Editor browser phase END: ${activePhase}; elapsedMs=${Math.round(performance.now() - phaseStarted)}`,
    );
  activePhase = "";
}
function beginPhase(name) {
  finishPhase();
  activePhase = name;
  phaseStarted = performance.now();
  console.log(`Editor browser phase START: ${name}`);
}
try {
  beginPhase("launch Chromium");
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
    viewport: { width: 1365, height: 1000 },
    locale: "ja-JP",
  });
  context.setDefaultTimeout(15000);
  context.setDefaultNavigationTimeout(15000);
  const page = await context.newPage(),
    errors = [],
    violations = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.error(`Editor browser pageerror (${activePhase}):`, error.stack ?? error.message);
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      console.error(
        "CSP_VIOLATION:" +
          JSON.stringify({
            directive: event.violatedDirective,
            effectiveDirective: event.effectiveDirective,
            blockedURI: event.blockedURI,
            sourceFile: event.sourceFile,
            lineNumber: event.lineNumber,
            columnNumber: event.columnNumber,
            sample: event.sample,
            disposition: event.disposition,
            target: target?.outerHTML.slice(0, 2000) ?? null,
          }),
      );
    });
  });
  page.on("console", (message) => {
    const text = message.text();
    if (text.startsWith("CSP_VIOLATION:")) {
      violations.push(text);
      console.error(`Editor browser CSP (${activePhase}): ${text}`);
    } else if (/Content Security Policy/iu.test(text)) {
      console.error(`Editor browser CSP console (${activePhase}):`, message.location(), text);
    }
  });
  beginPhase("body-only highlighted MDX");
  await page.goto(server.origin + "/editor/");
  const title = page.getByRole("textbox", { name: "タイトル", exact: true });
  await title.waitFor();
  await title.fill("CMS 動作確認（合成データ）");
  const initial =
    "## 見出しの位置\n\n本文の __強調__ と [参照](https://example.com)。\n\n別の段落。\n";
  await writeBody(page, initial);
  const before = (await savedDraft(page)).source;
  assert.equal(await readBody(page), initial);
  assert.doesNotMatch(
    await readBody(page),
    /^---\n(?:id|title|draft):/u,
    "MDX mode contains only body",
  );
  assert(
    (await page.getByRole("textbox", { name: "MDX本文", exact: true }).locator("span").count()) > 0,
    "MDX syntax has token highlighting",
  );
  beginPhase("source-preserving rich focus");
  await showBlocks(page);
  const blocks = page.getByRole("region", { name: "本文のブロック編集", exact: true });
  await blocks.getByRole("button", { name: "段落を編集", exact: true }).first().click();
  const rich = blocks.locator('.cms-rich-editor .cms-prose[contenteditable="true"]').first();
  await rich.waitFor();
  await title.click();
  assert.equal(
    (await savedDraft(page)).source,
    before,
    "Focusing a rich region must not normalize untouched MDX",
  );
  beginPhase("caret and inline formatting");
  await rich.click();
  await rich.press("Control+Home");
  await rich.press("ArrowRight");
  await rich.press("ArrowRight");
  await page.keyboard.insertText("追記");
  assert(
    (await rich.innerText()).startsWith("本文追記の"),
    "Typing stays at the requested caret position",
  );
  assert(
    await rich.evaluate((element) => element === document.activeElement),
    "Source updates do not replace the focused editor",
  );
  await rich.press("Control+a");
  await blocks.getByLabel("太字", { exact: true }).click();
  assert.match(await readBody(page), /\*\*本文追記の/u, "Inline toolbar edits the selection");
  beginPhase("keyboard article reorder");
  await showBlocks(page);
  const firstGrip = blocks
    .locator(":scope > .cms-block-list > .cms-editor-region")
    .first()
    .getByRole("button", { name: "見出しを移動", exact: true });
  await firstGrip.focus();
  await firstGrip.press("Space");
  await firstGrip.press("ArrowDown");
  await firstGrip.press("Enter");
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "見出しを移動",
  );
  const reordered = await readBody(page);
  assert(
    reordered.indexOf("本文追記") < reordered.indexOf("## 見出しの位置"),
    "Keyboard drop moves the source region",
  );
  beginPhase("pointer article reorder");
  await showBlocks(page);
  const regions = blocks.locator(":scope > .cms-block-list > .cms-editor-region");
  const dragHandle = regions.nth(1).getByRole("button", { name: "見出しを移動", exact: true });
  const handleRect = await dragHandle.boundingBox(),
    destination = await regions.first().boundingBox();
  assert(handleRect && destination);
  await page.mouse.move(handleRect.x + handleRect.width / 2, handleRect.y + handleRect.height / 2);
  await page.mouse.down();
  await page.mouse.move(destination.x + 60, destination.y + 20, { steps: 12 });
  await page.mouse.up();
  assert(
    (await readBody(page)).startsWith("## 見出しの位置"),
    "Pointer drop reorders the article itself",
  );
  beginPhase("Gallery parent and child settings");
  const childSource =
    '  <Figure asset="first" alt="子の説明" caption="子の注釈" />\n  <Figure asset="second" alt="2枚目" />';
  const fixture =
    '<Gallery label="親のラベル">\n' +
    childSource +
    '\n</Gallery>\n\n<Details summary="詳細">\n\n説明。\n\n</Details>\n\n```math label="式の説明"\n\\sigma = \\sqrt{\\frac{1}{N}}\n```\n\n```typescript\nconst value: number = 1;\n```\n';
  const fixtureEditor = await writeBody(page, fixture);
  try {
    await page.waitForFunction(
      ({ element, expected }) =>
        Array.from(element.querySelectorAll(".cm-line"), (line) => line.textContent ?? "").join(
          "\n",
        ) === expected,
      { element: await fixtureEditor.elementHandle(), expected: fixture },
      { timeout: 15000 },
    );
  } catch (error) {
    console.error(
      "Editor source replacement DOM:",
      await fixtureEditor.evaluate((element) => {
        const focus = [];
        for (let active = document.activeElement; active; active = active.shadowRoot?.activeElement)
          focus.push({ tag: active.tagName, label: active.getAttribute("aria-label") });
        return {
          connected: element.isConnected,
          visible: element.getClientRects().length > 0,
          text: element.textContent,
          lines: Array.from(element.querySelectorAll(".cm-line"), (line) => line.textContent),
          focus,
        };
      }),
    );
    throw error;
  }
  assert.equal(
    await readBody(page),
    fixture,
    "Replacing highlighted source preserves the complete multiline MDX fixture",
  );
  await showBlocks(page);
  const gallery = page.locator(".cms-module-gallery").first();
  const gallerySettings = gallery
    .locator(":scope > .cms-module-caption")
    .getByRole("button", { name: "設定", exact: true });
  await gallerySettings.click();
  assert.equal(await gallerySettings.getAttribute("aria-expanded"), "true");
  const fields = gallery.locator(":scope > .cms-module-fields");
  assert.equal(
    await fields.getByLabel(/代替テキスト/u).count(),
    0,
    "Parent form does not borrow child props",
  );
  await fields.locator("summary").click();
  await fields.getByLabel("ラベル", { exact: true }).fill("新しい親ラベル");
  await fields.getByLabel("PCの列数").selectOption("3");
  await fields.getByRole("button", { name: "設定を適用", exact: true }).click();
  const afterParent = await readBody(page);
  assert(afterParent.includes(childSource), "Parent settings preserve child source exactly");
  assert.match(afterParent, /columns="3"/u);
  assert(!afterParent.includes("columns={"), "Gallery uses portable literal attributes");
  beginPhase("Details optional boolean setting");
  await showBlocks(page);
  assert.equal(
    await gallerySettings.getAttribute("aria-expanded"),
    "true",
    "Gallery settings remain open when focus moves to the following module",
  );
  const details = page.locator(".cms-module-details").first();
  const detailsSettings = details
    .locator(":scope > .cms-module-caption")
    .getByRole("button", { name: "設定", exact: true });
  assert.equal(await detailsSettings.getAttribute("aria-expanded"), "false");
  await detailsSettings.click();
  assert.equal(
    await detailsSettings.getAttribute("aria-expanded"),
    "true",
    "One pointer click opens Details settings without a focus-induced layout shift",
  );
  const detailFields = details.locator(":scope > .cms-module-fields");
  await detailFields.locator("summary").click();
  await detailFields.getByLabel("初めから開く", { exact: true }).check();
  await detailFields.getByRole("button", { name: "設定を適用", exact: true }).click();
  assert.match(await readBody(page), /<Details summary="詳細" open>/u);
  beginPhase("TeX and code language");
  await showBlocks(page);
  await page.locator(".cms-math-preview math").waitFor();
  assert.equal(
    await page.locator(".cms-math-error").count(),
    0,
    "TeX commands render through KaTeX",
  );
  const codeBlock = page
    .locator(".cms-code-block")
    .filter({ has: page.getByRole("textbox", { name: "コード", exact: true }) });
  await codeBlock.getByLabel("言語", { exact: true }).fill("python");
  assert.match(await readBody(page), /```python\nconst value/u);
  beginPhase("searchable quote insertion");
  await showBlocks(page);
  await blocks.getByRole("button", { name: "＋ 挿入", exact: true }).click();
  const palette = page.getByRole("dialog", { name: "ブロックを挿入", exact: true });
  await palette.getByRole("searchbox", { name: "ブロックを検索", exact: true }).fill("引用");
  await palette.getByRole("button", { name: /引用/u }).click();
  assert.match(await readBody(page), /> 引用文/u, "Searchable palette inserts a structural quote");
  beginPhase("table cells and row insertion");
  await showBlocks(page);
  await blocks.getByRole("button", { name: "＋ 挿入", exact: true }).click();
  const tablePalette = page.getByRole("dialog", { name: "ブロックを挿入", exact: true });
  await tablePalette.getByRole("button", { name: "表 行と列で比較", exact: true }).click();
  const cell = blocks.getByRole("textbox", { name: "表の2行1列", exact: true });
  await cell.waitFor();
  await cell.fill("UIから編集した値");
  await cell.press("Tab");
  await blocks.getByRole("button", { name: "行を追加", exact: true }).click();
  await blocks.getByRole("textbox", { name: "表の3行1列", exact: true }).waitFor();
  assert.match(await readBody(page), /UIから編集した値/u, "Table cell changes persist as Markdown");
  await showBlocks(page);
  await savedDraft(page);
  await page.screenshot({ path: resolve(out, "editor-desktop.png"), fullPage: true });
  beginPhase("mobile source wrapping");
  await page.setViewportSize({ width: 390, height: 844 });
  await closePanel(page);
  const longBody =
    "モバイルでも画面端で折り返す長い本文。".repeat(30) +
    '\n\n<Figure asset="first" alt="' +
    "長い説明".repeat(40) +
    '" />\n';
  await writeBody(page, longBody);
  const mobileSource = await sourceEditor(page);
  const geometry = await mobileSource.evaluate((element) => ({
    width: element.clientWidth,
    scroll: element.scrollWidth,
    whitespace: getComputedStyle(element).whiteSpace,
    page: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  assert(
    geometry.page <= geometry.viewport + 1 && geometry.scroll <= geometry.width + 1,
    "Mobile source wraps within the viewport",
  );
  assert.equal(geometry.whitespace, "pre-wrap");
  const persisted = (await savedDraft(page)).source;
  await page.screenshot({ path: resolve(out, "editor-mobile.png"), fullPage: true });
  beginPhase("mobile insertion with software keyboard viewport");
  await showBlocks(page);
  await page.locator(".editing-main").evaluate((element) => {
    element.scrollTop = 0;
  });
  const beforePaletteScroll = await page
    .locator(".editing-main")
    .evaluate((element) => element.scrollTop);
  await blocks.getByRole("button", { name: "＋ 挿入", exact: true }).click();
  const mobilePalette = page.getByRole("dialog", { name: "ブロックを挿入", exact: true });
  const search = mobilePalette.getByRole("searchbox", { name: "ブロックを検索" });
  await search.waitFor();
  assert.equal(await mobilePalette.getAttribute("aria-modal"), "true");
  assert.equal(await page.locator(".cms-insert-overlay").count(), 1);
  assert.equal(await search.evaluate((element) => element === document.activeElement), true);
  assert.equal(
    await page.locator(".editing-main").evaluate((element) => element.scrollTop),
    beforePaletteScroll,
    "Focusing insertion search must not scroll the underlying document",
  );
  const keyboardGeometry = await page.evaluate(async () => {
    const viewport = window.visualViewport;
    if (!viewport) throw Error("VisualViewport required for keyboard regression test");
    Object.defineProperty(viewport, "height", { value: 375, configurable: true });
    Object.defineProperty(viewport, "offsetTop", { value: 24, configurable: true });
    viewport.dispatchEvent(new Event("resize"));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const overlay = document.querySelector(".cms-insert-overlay");
    const list = overlay?.querySelector(".cms-palette-scroll");
    const app = document.querySelector(".editor-app");
    const result = {
      overlayTop: overlay?.getBoundingClientRect().top,
      overlayHeight: overlay?.getBoundingClientRect().height,
      appTop: app?.getBoundingClientRect().top,
      appHeight: app?.getBoundingClientRect().height,
      listHeight: list?.getBoundingClientRect().height,
    };
    delete viewport.height;
    delete viewport.offsetTop;
    viewport.dispatchEvent(new Event("resize"));
    return result;
  });
  assert(Math.abs(keyboardGeometry.overlayTop - 24) <= 1);
  assert(Math.abs(keyboardGeometry.overlayHeight - 375) <= 1);
  assert(Math.abs(keyboardGeometry.appTop - 24) <= 1);
  assert(Math.abs(keyboardGeometry.appHeight - 375) <= 1);
  assert(keyboardGeometry.listHeight > 100, "Suggestions remain usable above the keyboard");
  await search.fill("引用");
  await mobilePalette.getByRole("button", { name: /引用/u }).waitFor();
  await mobilePalette.getByRole("button", { name: "挿入メニューを閉じる" }).click();
  assert.equal(await page.locator(".cms-insert-overlay").count(), 0);
  assert.equal((await savedDraft(page)).source, persisted);
  beginPhase("IndexedDB reopening");
  await page.reload();
  await title.waitFor();
  assert.equal(await title.inputValue(), "CMS 動作確認（合成データ）");
  assert.equal(
    (await savedDraft(page)).source,
    persisted,
    "IndexedDB reopening preserves full source",
  );
  beginPhase("offline shell and private-cache exclusion");
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload();
  await title.waitFor();
  assert.equal(await title.inputValue(), "CMS 動作確認（合成データ）");
  const cached = await page.evaluate(async () =>
    (
      await Promise.all(
        (await caches.keys())
          .filter((key) => key.startsWith("xpotato-editor-"))
          .map(async (key) =>
            (await (await caches.open(key)).keys()).map((request) => request.url),
          ),
      )
    ).flat(),
  );
  assert(cached.length > 5);
  assert(cached.every((url) => new URL(url).pathname.startsWith("/editor/")));
  assert(cached.every((url) => !url.includes("editor-api")));
  assert.deepEqual(errors, []);
  assert.deepEqual(violations, []);
  beginPhase("write browser report");
  await context.close();
  await writeFile(
    resolve(out, "result.json"),
    JSON.stringify(
      {
        mode: "local-real-chromium",
        tests: [
          "source-preserving rich focus",
          "caret and inline selection",
          "pointer and keyboard article reorder",
          "parent/child module props",
          "optional boolean props",
          "TeX and code language",
          "accessible table cells and row insertion",
          "searchable visual insertion",
          "body-only highlighted MDX",
          "390px wrapping",
          "IndexedDB reopen",
          "offline shell",
          "no private API cached",
          "strict CSP",
        ],
        result: "pass",
        errors,
        violations,
      },
      null,
      2,
    ),
  );
  finishPhase();
  console.log(
    "Editor browser smoke PASS: rich/block/source editing, nested modules, drag, mobile, offline.",
  );
} catch (error) {
  console.error(
    `Editor browser phase FAIL: ${activePhase}; elapsedMs=${Math.round(performance.now() - phaseStarted)}`,
  );
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
