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
  panel,
  ensureEditing,
  goHome,
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
  beginPhase("CMS brand assets and responsive headers");
  await page.goto(server.origin + "/editor/");
  const manifestResponse = await page.request.get(server.origin + "/editor/manifest.webmanifest");
  assert.equal(manifestResponse.status(), 200);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.name, "Xpotato CMS");
  assert.equal(manifest.scope, "/editor/");
  assert.equal(manifest.start_url, "/editor/");
  assert.deepEqual(
    manifest.icons.map(({ src, sizes, purpose }) => ({ src, sizes, purpose })),
    [
      { src: "/editor/xpotato-cms-192.png", sizes: "192x192", purpose: "any" },
      { src: "/editor/xpotato-cms-512.png", sizes: "512x512", purpose: "any" },
      { src: "/editor/xpotato-cms-maskable-512.png", sizes: "512x512", purpose: "maskable" },
    ],
  );
  for (const path of [
    "/editor/xpotato-cms.svg",
    "/editor/xpotato-cms-small.svg",
    "/editor/xpotato-cms-maskable.svg",
    "/editor/xpotato-cms-180.png",
    "/editor/xpotato-cms-16.png",
    "/editor/xpotato-cms-32.png",
    "/editor/xpotato-cms-48.png",
    ...manifest.icons.map((icon) => icon.src),
  ]) {
    assert.equal((await page.request.get(server.origin + path)).status(), 200, path);
  }
  assert.equal(
    await page.locator('link[rel="apple-touch-icon"]').getAttribute("href"),
    "/editor/xpotato-cms-180.png",
  );
  const checkBrand = async (width, phase) => {
    await page.setViewportSize({ width, height: 900 });
    const logo = page.locator(".editor-brand img");
    await logo.waitFor({ state: "visible" });
    await logo.evaluate((image) => image.decode());
    assert.equal(await logo.getAttribute("src"), "/editor/xpotato-cms.svg");
    assert.equal(await logo.evaluate((image) => image.naturalWidth), 512);
    const header = page.locator(".editor-header");
    assert(
      await header.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      `${phase} header overflows at ${width}px`,
    );
    if (width === 1365) {
      assert(await page.locator(".editor-brand-name").isVisible());
      assert.equal(await page.locator(".editor-brand-name").innerText(), "Xpotato CMS");
    }
    await header.screenshot({ path: resolve(out, `brand-${phase}-${width}.png`) });
  };
  for (const width of [320, 390, 1365]) await checkBrand(width, "home");
  await ensureEditing(page);
  for (const width of [320, 390, 1365]) await checkBrand(width, "editor");
  await page.setViewportSize({ width: 1365, height: 1000 });
  beginPhase("body-only highlighted MDX");
  const title = page.getByRole("textbox", { name: "タイトル", exact: true });
  await title.waitFor();
  await title.fill("CMS 動作確認（合成データ）");
  const initial =
    "## 見出しの位置\n\n本文の __強調__ と [参照](https://example.com)。\n\n別の段落。\n";
  await writeBody(page, initial);
  await showBlocks(page);
  assert.equal(
    await readBody(page),
    initial,
    "Switching immediately after source replacement preserves every entered line",
  );
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
  beginPhase("heading group preserves body and image while moving");
  const groupedSection =
    '## 章A\n\n本文の __表記を保持__。\n\n<Figure asset="group-image" alt="章Aの写真" />\n\n### 小見出し\n\n章Aの続き。';
  const groupFixture = "導入。\n\n" + groupedSection + "\n\n## 章B\n\n章Bの本文。\n";
  await writeBody(page, groupFixture);
  await showBlocks(page);
  const headingRegion = regions.nth(1);
  await headingRegion
    .locator(":scope > .cms-region-toolbar")
    .getByRole("button", { name: "ブロックの操作", exact: true })
    .click();
  await headingRegion.getByRole("button", { name: "見出しと本文をまとめる", exact: true }).click();
  const grouped = await readBody(page);
  assert(grouped.includes(groupedSection), "Grouping preserves all child source and separators");
  assert.match(grouped, /<Group>\n/u);
  assert(
    grouped.indexOf("</Group>") < grouped.indexOf("## 章B"),
    "The next peer heading is outside the group",
  );
  await showBlocks(page);
  const group = blocks.locator(":scope > .cms-block-list > .cms-editor-region[data-group]");
  assert.equal(await group.count(), 1);
  assert.equal(await group.locator(".cms-module-figure").count(), 1);
  assert.equal(await regions.count(), 4, "Five section blocks form one moving unit");
  const groupGrip = group
    .locator(":scope > .cms-region-toolbar")
    .getByRole("button", { name: "グループを移動", exact: true });
  await groupGrip.focus();
  await groupGrip.press("Space");
  await groupGrip.press("ArrowDown");
  await groupGrip.press("ArrowDown");
  await groupGrip.press("Enter");
  const keyboardMovedGroup = await readBody(page);
  assert(keyboardMovedGroup.indexOf("章Bの本文。") < keyboardMovedGroup.indexOf("<Group>"));
  assert(
    keyboardMovedGroup.includes(groupedSection),
    "Moving a group retains its heading, text, image and subsection together",
  );
  await showBlocks(page);
  await page.locator(".editing-main").evaluate((element) => {
    element.scrollTop = 0;
  });
  await groupGrip.scrollIntoViewIfNeeded();
  const groupHandleRect = await groupGrip.boundingBox();
  const groupDestination = await regions.first().boundingBox();
  assert(groupHandleRect && groupDestination);
  await page.mouse.move(
    groupHandleRect.x + groupHandleRect.width / 2,
    groupHandleRect.y + groupHandleRect.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(groupDestination.x + 60, groupDestination.y + groupDestination.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
  const movedGroup = await readBody(page);
  assert(
    movedGroup.startsWith("<Group>"),
    "Pointer drag moves the outer group rather than one nested child",
  );
  assert(movedGroup.includes(groupedSection));
  assert(movedGroup.indexOf("</Group>") < movedGroup.indexOf("導入。"));
  const groupedSaved = (await savedDraft(page)).source;
  beginPhase("group reload, ungroup and undo");
  await page.reload();
  await title.waitFor();
  assert.equal(
    (await savedDraft(page)).source,
    groupedSaved,
    "The group survives persistence and reload",
  );
  assert.equal(await readBody(page), movedGroup);
  await showBlocks(page);
  await group
    .locator(":scope > .cms-region-toolbar")
    .getByRole("button", { name: "ブロックの操作", exact: true })
    .click();
  await group.getByRole("button", { name: "グループを解除", exact: true }).click();
  const ungrouped = await readBody(page);
  assert(!ungrouped.includes("<Group>"));
  assert(
    ungrouped.includes(groupedSection),
    "Ungrouping retains every child at the group's position",
  );
  assert(ungrouped.indexOf("## 章A") < ungrouped.indexOf("導入。"));
  await page.getByRole("button", { name: "元に戻す", exact: true }).click();
  assert.equal(
    await readBody(page),
    movedGroup,
    "Undo restores the group and its exact child source",
  );
  await page.getByRole("button", { name: "やり直す", exact: true }).click();
  assert.equal(await readBody(page), ungrouped, "Redo removes only the group boundary again");
  beginPhase("footnote blocks, reference preservation and SVG backlinks");
  const footnoteBody =
    "本文[^architecture]。同じ脚注[^architecture]。\n\n[^architecture]: 設計の参照。\n";
  await writeBody(page, footnoteBody);
  await showBlocks(page);
  const noteContent = blocks.getByRole("textbox", { name: "脚注の内容", exact: true });
  await noteContent.waitFor();
  assert.equal(
    await blocks.getByRole("textbox", { name: "本文の参照記号", exact: true }).inputValue(),
    "[^architecture]",
  );
  await noteContent.focus();
  await title.click();
  assert.equal(
    await readBody(page),
    footnoteBody,
    "Focusing a footnote preserves its original source",
  );
  await showBlocks(page);
  assert.equal(
    await blocks.getByRole("textbox", { name: "ブロックのMDX", exact: true }).count(),
    0,
  );
  await noteContent.fill("設計の参照。\n\n補足した根拠。");
  await blocks.getByRole("button", { name: "段落を編集", exact: true }).click();
  const noteParagraph = blocks.getByRole("textbox", {
    name: "本文（脚注参照を含む）",
    exact: true,
  });
  await noteParagraph.press("Control+End");
  await page.keyboard.insertText("追記。");
  const editedFootnotes = await readBody(page);
  assert.match(editedFootnotes, /本文\[\^architecture\]。同じ脚注\[\^architecture\]。追記。/u);
  assert.match(editedFootnotes, /\[\^architecture\]: 設計の参照。\n\n {4}補足した根拠。/u);
  assert.doesNotMatch(
    editedFootnotes,
    /\\\[\^|\\\[\\\^/u,
    "Editing a paragraph must not escape its footnote references",
  );
  await page.getByRole("tab", { name: "プレビュー", exact: true }).click();
  const notePreview = page.frameLocator("iframe").first();
  await notePreview.locator(".footnotes a[data-footnote-backref] svg").first().waitFor();
  assert.equal(await notePreview.locator(".footnotes a[data-footnote-backref] svg").count(), 2);
  assert.doesNotMatch(await notePreview.locator(".footnotes").innerText(), /[↩\uFE0E\uFE0F]/u);
  const referenceIds = await notePreview
    .locator("a[data-footnote-ref]")
    .evaluateAll((links) => links.map((link) => link.id));
  const backlinkTargets = await notePreview
    .locator("a[data-footnote-backref]")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  assert.deepEqual(
    backlinkTargets,
    referenceIds.map((id) => "#" + id),
  );
  assert.equal(new Set(referenceIds).size, 2);
  await showBlocks(page);
  for (let added = 1; added <= 2; added++) {
    await blocks.locator(":scope > .cms-append-block").click();
    const notesPalette = page.getByRole("dialog", { name: "ブロックを挿入", exact: true });
    await notesPalette.getByRole("searchbox", { name: "ブロックを検索", exact: true }).fill("脚注");
    await notesPalette
      .getByRole("button", { name: "脚注 本文から参照する補足・出典", exact: true })
      .click();
    assert.equal(
      await blocks.getByRole("textbox", { name: "脚注の内容", exact: true }).count(),
      added + 1,
    );
  }
  const insertedFootnotes = await readBody(page);
  assert.match(insertedFootnotes, /\[\^note-1\]:/u);
  assert.match(insertedFootnotes, /\[\^note-2\]:/u);
  assert(
    insertedFootnotes.startsWith(editedFootnotes.trimEnd()),
    "Inserting notes preserves the preceding article",
  );
  await showBlocks(page);
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await blocks
      .locator(".cms-footnote-block")
      .evaluateAll((notes) => notes.every((note) => note.scrollWidth <= note.clientWidth + 1)),
    "Footnote controls fit the mobile editor",
  );
  await blocks.screenshot({ path: resolve(out, "footnote-blocks-mobile.png") });
  await page.setViewportSize({ width: 1365, height: 1000 });
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
  await blocks.locator(":scope > .cms-append-block").click();
  const palette = page.getByRole("dialog", { name: "ブロックを挿入", exact: true });
  await palette.getByRole("searchbox", { name: "ブロックを検索", exact: true }).fill("引用");
  await palette.getByRole("button", { name: /引用/u }).click();
  assert.match(await readBody(page), /> 引用文/u, "Searchable palette inserts a structural quote");
  beginPhase("table cells and row insertion");
  await showBlocks(page);
  await blocks.locator(":scope > .cms-append-block").click();
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
  beginPhase("narrow table controls stay within the table scroll area");
  await page.setViewportSize({ width: 320, height: 740 });
  const tablePreview = blocks.getByRole("button", { name: "表を編集", exact: true });
  if (await tablePreview.isVisible()) await tablePreview.press("Enter");
  const addColumn = blocks.getByRole("button", { name: "列を追加", exact: true });
  await addColumn.waitFor();
  const tableOverflow = await addColumn.evaluate((button) => {
    let container = button.parentElement;
    while (
      container &&
      !(
        container.scrollWidth > container.clientWidth &&
        /auto|scroll/.test(getComputedStyle(container).overflowX)
      )
    )
      container = container.parentElement;
    const editor = document.querySelector(".editing-main");
    return {
      contained: Boolean(container && !container.matches(".editing-main,body,html")),
      editorWidth: editor.clientWidth,
      editorContentWidth: editor.scrollWidth,
    };
  });
  assert(tableOverflow.contained, "Wide tables own their horizontal scrolling");
  assert(
    tableOverflow.editorContentWidth <= tableOverflow.editorWidth + 1,
    "A wide table does not widen the editor",
  );
  await addColumn.scrollIntoViewIfNeeded();
  const columnBounds = await addColumn.boundingBox();
  assert(
    columnBounds && columnBounds.x >= 0 && columnBounds.x + columnBounds.width <= 321,
    "The last column control remains reachable at 320px",
  );
  await addColumn.click();
  assert.match(await readBody(page), /UIから編集した値/u, "Adding a column preserves edited cells");
  await page.setViewportSize({ width: 1280, height: 900 });
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
  let persisted = (await savedDraft(page)).source;
  await page.screenshot({ path: resolve(out, "editor-mobile.png"), fullPage: true });
  beginPhase("mobile writing tools and separate management screens");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await sourceEditor(page);
    assert.deepEqual(
      (await page.locator(".workspace-rail button").allTextContents()).map((label) => label.trim()),
      ["構成", "画像", "添削"],
      "The writing dock contains only tools used with the current body",
    );
    assert(await page.getByRole("button", { name: "元に戻す", exact: true }).isVisible());
    assert(await page.getByRole("button", { name: "やり直す", exact: true }).isVisible());
    await page.locator(".editing-main").evaluate((element) => {
      element.scrollTop = Math.min(120, element.scrollHeight - element.clientHeight);
    });
    const beforeNavigationScroll = await page
      .locator(".editing-main")
      .evaluate((element) => element.scrollTop);
    await panel(page, "原稿一覧", page.getByRole("heading", { name: "下書きの続き", exact: true }));
    assert(!(await page.locator(".editing-main").isVisible()));
    const libraryBox = await page.locator(".start-workspace").boundingBox();
    assert(
      libraryBox && libraryBox.width >= width - 48,
      "Draft management uses the mobile page rather than a side panel",
    );
    await page
      .getByRole("navigation", { name: "CMSの管理", exact: true })
      .getByRole("button", { name: "連載", exact: true })
      .click();
    await page.getByRole("heading", { name: "連載・コース", exact: true }).waitFor();
    assert(
      !(await page.locator(".editing-main").isVisible()),
      "Series management does not split the writing canvas",
    );
    await goHome(page);
    await ensureEditing(page);
    assert.equal(
      await page.locator(".editing-main").evaluate((element) => element.scrollTop),
      beforeNavigationScroll,
      "Returning from management retains the writing scroll position",
    );
    assert.equal(await readBody(page), longBody, "Management navigation retains the unsaved body");
    await panel(page, "記事情報を開く", page.locator(".panel-metadata"));
    assert(!(await page.locator(".editing-main").isVisible()));
    await closePanel(page);
    await panel(page, "履歴を開く", page.locator(".panel-history"));
    assert(!(await page.locator(".editing-main").isVisible()));
    await closePanel(page);
    await panel(page, "保存と確認を開く", page.locator(".panel-workflow"));
    assert(!(await page.locator(".editing-main").isVisible()));
    await closePanel(page);
    assert.equal(await readBody(page), longBody);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  beginPhase("mobile insertion with software keyboard viewport");
  for (const size of [
    { width: 390, height: 844, keyboard: 375, offset: 24 },
    { width: 320, height: 700, keyboard: 280, offset: 20 },
  ]) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await showBlocks(page);
    assert.equal(await blocks.locator(":scope > .cms-block-topbar").count(), 0);
    const append = blocks.locator(":scope > .cms-append-block");
    await append.scrollIntoViewIfNeeded();
    const beforePaletteScroll = await page
      .locator(".editing-main")
      .evaluate((element) => element.scrollTop);
    await append.click();
    const mobilePalette = page.getByRole("dialog", { name: "ブロックを挿入", exact: true });
    const search = mobilePalette.getByRole("searchbox", { name: "ブロックを検索" });
    await search.waitFor();
    assert.equal(await mobilePalette.getAttribute("aria-modal"), "true");
    assert.equal(await page.locator(".cms-insert-overlay").count(), 1);
    assert.equal(
      await search.evaluate((element) => element === document.activeElement),
      false,
      "Pointer opening shows the choices without opening the search keyboard",
    );
    assert.equal(
      await mobilePalette.locator(".cms-palette-visual svg").count(),
      await mobilePalette.locator(".cms-palette-choice").count(),
      "Every block choice uses the same SVG icon system",
    );
    await search.click();
    assert.equal(await search.evaluate((element) => element === document.activeElement), true);
    assert.equal(
      await page.locator(".editing-main").evaluate((element) => element.scrollTop),
      beforePaletteScroll,
      "Opening and focusing search must not scroll the underlying document",
    );
    const keyboardGeometry = await page.evaluate(async ({ keyboard, offset }) => {
      const viewport = window.visualViewport;
      if (!viewport) throw Error("VisualViewport required for keyboard regression test");
      Object.defineProperty(viewport, "height", { value: keyboard, configurable: true });
      Object.defineProperty(viewport, "offsetTop", { value: offset, configurable: true });
      viewport.dispatchEvent(new Event("resize"));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const overlay = document.querySelector(".cms-insert-overlay");
      const list = overlay?.querySelector(".cms-palette-scroll");
      const app = document.querySelector(".editor-app");
      return {
        overlayTop: overlay?.getBoundingClientRect().top,
        overlayHeight: overlay?.getBoundingClientRect().height,
        appTop: app?.getBoundingClientRect().top,
        appHeight: app?.getBoundingClientRect().height,
        listHeight: list?.getBoundingClientRect().height,
      };
    }, size);
    assert(Math.abs(keyboardGeometry.overlayTop - size.offset) <= 1);
    assert(Math.abs(keyboardGeometry.overlayHeight - size.keyboard) <= 1);
    assert(Math.abs(keyboardGeometry.appTop - size.offset) <= 1);
    assert(Math.abs(keyboardGeometry.appHeight - size.keyboard) <= 1);
    assert(keyboardGeometry.listHeight > 100, "Suggestions remain usable above the keyboard");
    await search.fill("引用");
    const quoteChoice = mobilePalette.getByRole("button", { name: /引用/u });
    await quoteChoice.waitFor();
    if (size.width === 390) {
      await mobilePalette.getByRole("button", { name: "挿入メニューを閉じる" }).click();
    } else {
      await quoteChoice.click();
    }
    assert.equal(await page.locator(".cms-insert-overlay").count(), 0);
    await page.evaluate(async () => {
      const viewport = window.visualViewport;
      delete viewport.height;
      delete viewport.offsetTop;
      viewport.dispatchEvent(new Event("resize"));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    if (size.width === 390) {
      assert.equal(
        (await savedDraft(page)).source,
        persisted,
        "Cancelling insertion preserves the full draft",
      );
    } else {
      const insertedBody = await readBody(page);
      assert(
        insertedBody.includes(longBody.trimEnd()),
        "Selecting a block preserves the existing long body",
      );
      assert.match(insertedBody, /> 引用文/u);
      persisted = (await savedDraft(page)).source;
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
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
          "heading/body/image grouping with pointer and keyboard movement",
          "group persistence, ungroup, undo and redo",
          "parent/child module props",
          "footnote blocks, preserved references, unique insertion and SVG backlinks",
          "optional boolean props",
          "TeX and code language",
          "accessible table cells and row insertion",
          "searchable visual insertion",
          "body-only highlighted MDX",
          "390px wrapping",
          "320px and 390px writing and management navigation",
          "mobile browse-first insertion and simulated software keyboard viewport",
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
