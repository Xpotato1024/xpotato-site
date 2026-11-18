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
try {
  const executable = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    chromium.executablePath(),
  ].find((value) => value && existsSync(value));
  browser = await chromium.launch({
    headless: true,
    ...(executable ? { executablePath: executable } : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1365, height: 1000 },
    locale: "ja-JP",
  });
  const page = await context.newPage(),
    errors = [],
    violations = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) =>
      console.error("CSP_VIOLATION:" + event.violatedDirective + ":" + event.blockedURI),
    );
  });
  page.on("console", (message) => {
    if (message.text().startsWith("CSP_VIOLATION:")) violations.push(message.text());
  });
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
  const childSource =
    '  <Figure asset="first" alt="子の説明" caption="子の注釈" />\n  <Figure asset="second" alt="2枚目" />';
  const fixture =
    '<Gallery label="親のラベル">\n' +
    childSource +
    '\n</Gallery>\n\n<Details summary="詳細">\n\n説明。\n\n</Details>\n\n```math label="式の説明"\n\\sigma = \\sqrt{\\frac{1}{N}}\n```\n\n```typescript\nconst value: number = 1;\n```\n';
  await writeBody(page, fixture);
  await showBlocks(page);
  const gallery = page.locator(".cms-module-gallery").first();
  await gallery
    .locator(":scope > .cms-module-caption")
    .getByRole("button", { name: "設定", exact: true })
    .click();
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
  await showBlocks(page);
  const details = page.locator(".cms-module-details").first();
  await details
    .locator(":scope > .cms-module-caption")
    .getByRole("button", { name: "設定", exact: true })
    .click();
  const detailFields = details.locator(":scope > .cms-module-fields");
  await detailFields.locator("summary").click();
  await detailFields.getByLabel("初めから開く", { exact: true }).check();
  await detailFields.getByRole("button", { name: "設定を適用", exact: true }).click();
  assert.match(await readBody(page), /<Details summary="詳細" open>/u);
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
  await showBlocks(page);
  await blocks.getByRole("button", { name: "＋ 挿入", exact: true }).click();
  const palette = page.getByRole("dialog", { name: "ブロックを挿入", exact: true });
  await palette.getByRole("searchbox", { name: "ブロックを検索", exact: true }).fill("引用");
  await palette.getByRole("button", { name: /引用/u }).click();
  assert.match(await readBody(page), /> 引用文/u, "Searchable palette inserts a structural quote");
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
  await page.reload();
  await title.waitFor();
  assert.equal(await title.inputValue(), "CMS 動作確認（合成データ）");
  assert.equal(
    (await savedDraft(page)).source,
    persisted,
    "IndexedDB reopening preserves full source",
  );
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
  console.log(
    "Editor browser smoke PASS: rich/block/source editing, nested modules, drag, mobile, offline.",
  );
} finally {
  await browser?.close();
  await server.close();
}
