import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { editorStaticServer } from "./editor-static-server.mjs";
import {
  closePanel,
  ensureEditing,
  goHome,
  panel,
  savedDraft,
  showBlocks,
  writeBody,
} from "./editor-browser-helpers.mjs";

const root = resolve(".");
const out = resolve(".local/cms-validation/workspace-browser");
await mkdir(out, { recursive: true });
const apiCalls = [];
const server = await editorStaticServer(root, async (request, response) => {
  apiCalls.push({
    method: request.method,
    path: new URL(request.url, "http://localhost").pathname,
  });
  response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(
    JSON.stringify({ authenticated: false, configured: false, repository: "fixture/editor" }),
  );
});
let browser;
let failurePage;
let phase = "launch";
const checks = [];
const errors = [];
const violations = [];
const outside = [];
const purposeName = "ブラウザー検証の目的";
const purposeAlias = "qa-workflow-purpose";
const categoryName = "ブラウザー検証の分類";
const seriesName = "ブラウザー検証の空連載";
const draftTitle = "ワークフロー検証の教育記事";

function begin(name) {
  phase = name;
  console.log("Editor workspace phase START: " + name);
}

async function snapshot(page) {
  return page.evaluate(async () => {
    const database = await new Promise((accept, reject) => {
      const request = indexedDB.open("xpotato-editor-v1");
      request.onsuccess = () => accept(request.result);
      request.onerror = () => reject(request.error);
    });
    const read = (store) =>
      new Promise((accept, reject) => {
        const request = database.transaction(store, "readonly").objectStore(store).getAll();
        request.onsuccess = () => accept(request.result);
        request.onerror = () => reject(request.error);
      });
    const [drafts, workspace] = await Promise.all([read("drafts"), read("workspace")]);
    const result = { version: database.version, drafts, workspace };
    database.close();
    return result;
  });
}

async function manage(page, label) {
  await goHome(page);
  await page
    .getByRole("navigation", { name: "CMSの管理", exact: true })
    .getByRole("button", { name: label, exact: true })
    .click();
  await page
    .getByRole("heading", { name: label === "連載" ? "連載・コース" : label, exact: true })
    .waitFor();
}

async function waitRegistrySaved(page) {
  await page.locator(".registry-status small").filter({ hasText: "この端末に保存済み" }).waitFor();
}

async function addTerm(page, group, label, alias) {
  const manager = page.getByRole("region", { name: "タグ・分類", exact: true });
  await manager.getByRole("button", { name: "新規追加", exact: true }).click();
  const form = manager.locator(".taxonomy-create");
  const kind = form.getByRole("combobox", { name: "種類", exact: true });
  await kind.selectOption(group);
  assert.equal(await kind.inputValue(), group);
  await form.getByLabel("名前", { exact: true }).fill(label);
  if (alias) {
    await form.locator("summary").click();
    await form.getByLabel("検索用の別名", { exact: true }).fill(alias);
  }
  await form.getByRole("button", { name: "追加", exact: true }).click();
  await manager.locator(".taxonomy-record").filter({ hasText: label }).waitFor();
  await waitRegistrySaved(page);
}

async function assertNoOverflow(page, label) {
  const geometry = await page.evaluate(() => ({
    viewport: innerWidth,
    page: document.documentElement.scrollWidth,
  }));
  assert(
    geometry.page <= geometry.viewport + 1,
    label + ": no page overflow " + JSON.stringify(geometry),
  );
}

async function assertOutlineGeometry(page, outline, width) {
  await page.setViewportSize({ width, height: 844 });
  await outline.locator(".outline-row").first().waitFor();
  const geometry = await outline.locator(".outline-row").evaluateAll((buttons) =>
    buttons.map((button) => {
      const row = button.getBoundingClientRect();
      const icon = button.querySelector("svg")?.getBoundingClientRect();
      const text = button.querySelector(".outline-text")?.getBoundingClientRect();
      const parentRow = button
        .closest(".outline-children")
        ?.parentElement?.querySelector(":scope > .outline-row")
        ?.getBoundingClientRect();
      return {
        title: button.querySelector(".outline-title")?.textContent,
        left: row.left,
        right: row.right,
        width: row.width,
        height: row.height,
        iconLeft: icon?.left,
        textLeft: text?.left,
        parentLeft: parentRow?.left,
      };
    }),
  );
  assert(geometry.length > 4, "The outline includes content blocks beyond groups and headings");
  for (const item of geometry) {
    assert(
      item.width >= 44 && item.height >= 44 && item.left >= 0 && item.right <= width + 1,
      width + ": outline controls fit the viewport and remain touchable " + JSON.stringify(item),
    );
    assert(
      item.iconLeft >= item.left && item.iconLeft <= item.left + 24,
      width + ": every outline row starts with an SVG block symbol " + JSON.stringify(item),
    );
    assert(
      item.textLeft > item.iconLeft && item.textLeft <= item.left + 80,
      width + ": outline text is aligned next to its symbol, not centered " + JSON.stringify(item),
    );
    if (item.parentLeft !== undefined)
      assert(item.left > item.parentLeft, "A child is visually nested under its container");
  }
  await assertNoOverflow(page, "outline at " + width + "px");
  await page.screenshot({ path: resolve(out, "outline-" + width + "px.png"), fullPage: true });
}

async function insertVisibility(page) {
  return page.locator(".cms-insert-after").evaluateAll((buttons) =>
    buttons.map((button) => {
      const style = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      return {
        visible: Number(style.opacity) > 0.5 && style.visibility !== "hidden",
        interactive: style.pointerEvents !== "none",
        width: rect.width,
        height: rect.height,
        focused: button === document.activeElement,
      };
    }),
  );
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
  });
  context.setDefaultTimeout(15000);
  context.setDefaultNavigationTimeout(15000);
  const page = await context.newPage();
  failurePage = page;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (
      !request.url().startsWith(server.origin) &&
      !request.url().startsWith("blob:") &&
      !request.url().startsWith("data:")
    )
      outside.push(request.url());
  });
  await page.addInitScript(() =>
    document.addEventListener("securitypolicyviolation", (event) => {
      if (window.top === window)
        console.error("CSP_VIOLATION:" + event.violatedDirective + ":" + event.blockedURI);
    }),
  );
  page.on("console", (message) => {
    if (message.text().startsWith("CSP_VIOLATION:")) violations.push(message.text());
  });

  begin("empty home and three explicit entry points");
  await page.goto(server.origin + "/editor/");
  await page.getByRole("heading", { name: "原稿", level: 1, exact: true }).waitFor();
  assert.equal(
    (await snapshot(page)).drafts.length,
    0,
    "Opening the CMS does not save an untitled or sample draft",
  );
  assert.equal(await page.locator(".resume-draft").count(), 0);
  for (const label of ["新規作成", "既存記事を改稿", "下書きの続き"]) {
    await page
      .locator(".entry-cards")
      .getByRole("button", { name: new RegExp("^" + label, "u") })
      .click();
    await page.getByRole("heading", { name: label, exact: true }).waitFor();
    assert.equal(await page.locator(".editing-main").isVisible(), false);
    if (label === "新規作成") {
      const kinds = page
        .getByRole("group", { name: "投稿先種別", exact: true })
        .getByRole("button");
      assert.equal(await kinds.count(), 6);
      await kinds.filter({ hasText: "教育記事" }).click();
      assert.equal(
        await kinds.filter({ hasText: "教育記事" }).getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(
        await page.getByRole("radio", { name: "新しいブランチ", exact: true }).isDisabled(),
        true,
      );
      assert.equal(
        await page.getByRole("radio", { name: "既存のブランチ", exact: true }).isDisabled(),
        true,
      );
      assert.equal(
        await page.getByRole("radio", { name: "この端末", exact: true }).isChecked(),
        true,
      );
    } else {
      assert.equal(
        await page.getByRole("button", { name: "一覧を取得", exact: true }).isDisabled(),
        true,
      );
    }
    await goHome(page);
    assert.equal(
      (await snapshot(page)).drafts.length,
      0,
      "Browsing an entry screen alone does not create an article",
    );
  }
  checks.push("initial home and three entry screens create no phantom draft");
  await page.screenshot({ path: resolve(out, "home-mobile.png"), fullPage: true });

  begin("independent taxonomy and empty series");
  await manage(page, "分類・タグ");
  await addTerm(page, "purpose", purposeName, purposeAlias);
  await addTerm(page, "blogCategories", categoryName);
  const taxonomy = page.getByRole("region", { name: "タグ・分類", exact: true });
  await taxonomy
    .getByRole("combobox", { name: "種類で絞り込む", exact: true })
    .selectOption("purpose");
  await taxonomy
    .getByRole("searchbox", { name: "タグ・分類を検索", exact: true })
    .fill(purposeAlias);
  assert.equal(
    await taxonomy.locator(".taxonomy-record").count(),
    1,
    "Alias search respects the selected taxonomy kind",
  );
  assert.match(
    await taxonomy.locator(".taxonomy-record").innerText(),
    new RegExp(purposeName, "u"),
  );
  assert.equal((await snapshot(page)).drafts.length, 0);
  await manage(page, "連載");
  const series = page.getByRole("region", { name: "連載", exact: true });
  await series.getByRole("button", { name: "連載を作成", exact: true }).click();
  await series.getByLabel("連載名", { exact: true }).fill(seriesName);
  await series
    .getByLabel("説明", { exact: true })
    .fill("記事を書く前に用意する合成テストの連載です。");
  await series.getByRole("combobox", { name: "種類", exact: true }).selectOption("course");
  await series.getByRole("button", { name: "連載を作成", exact: true }).click();
  await series.getByRole("heading", { name: seriesName, exact: true }).waitFor();
  assert.equal(await series.locator(".series-entries > li").count(), 0);
  assert.equal(
    await series.getByRole("button", { name: "この記事を末尾に追加", exact: true }).count(),
    0,
  );
  await waitRegistrySaved(page);
  const registryOnly = await snapshot(page);
  assert.equal(registryOnly.drafts.length, 0);
  const registry = registryOnly.workspace.find((record) => record.id === "registry:local");
  assert(registry?.changes?.taxonomy.some((term) => term.label === purposeName));
  assert(registry?.changes?.taxonomy.some((term) => term.label === categoryName));
  assert.deepEqual(
    registry?.changes?.series.series.find((item) => item.title === seriesName)?.entries,
    [],
  );
  await page.reload();
  await page.getByRole("heading", { name: "連載・コース", exact: true }).waitFor();
  await series.getByRole("searchbox", { name: "連載を検索", exact: true }).fill(seriesName);
  await series.locator(".series-choice").filter({ hasText: seriesName }).click();
  assert.equal(await series.locator(".series-entries > li").count(), 0);
  await manage(page, "分類・タグ");
  await taxonomy
    .getByRole("searchbox", { name: "タグ・分類を検索", exact: true })
    .fill(purposeAlias);
  await taxonomy.locator(".taxonomy-record").filter({ hasText: purposeName }).waitFor();
  assert.equal((await snapshot(page)).drafts.length, 0);
  checks.push(
    "taxonomy alias search, category creation and empty course persist independently of articles",
  );

  begin("local metadata reuse and article creation");
  await goHome(page);
  await page
    .locator(".entry-cards")
    .getByRole("button", { name: /^新規作成/u })
    .click();
  await page
    .getByRole("group", { name: "投稿先種別", exact: true })
    .getByRole("button", { name: /^教育記事/u })
    .click();
  await page.getByRole("radio", { name: "この端末", exact: true }).check();
  await page.getByRole("button", { name: "作成して編集", exact: true }).click();
  await page.getByRole("textbox", { name: "タイトル", exact: true }).fill(draftTitle);
  assert.equal(await page.locator(".document-kind").innerText(), "教育記事");
  const body =
    "## 学習の順序\n\n" +
    Array.from(
      { length: 12 },
      (_, index) => `${index + 1}番目の説明。編集中の本文は管理画面への移動でも保持します。`,
    ).join("\n\n") +
    "\n";
  await writeBody(page, body);
  await panel(page, "記事情報を開く", page.locator(".panel-metadata"));
  const metadata = page.locator(".panel-metadata");
  await metadata.getByRole("searchbox", { name: "目的タグを検索", exact: true }).fill(purposeAlias);
  const purpose = metadata
    .locator(".term-options")
    .getByRole("button", { name: purposeName, exact: true });
  await purpose.click();
  assert.equal(await purpose.getAttribute("aria-pressed"), "true");
  await closePanel(page);
  const originalDraft = await savedDraft(page);
  const originalRecord = (await snapshot(page)).drafts.find(
    (draft) => draft.id === originalDraft.id,
  );
  const purposeId = registry.changes.taxonomy.find((term) => term.label === purposeName).id;
  assert(
    originalRecord.source.includes(purposeId),
    "A globally created local purpose tag can be selected in article metadata",
  );
  assert.equal((await snapshot(page)).drafts.length, 1);
  checks.push("explicit education creation reuses independently created local purpose tags");

  begin("three peer modes fit 320px and preserve source");
  await page.setViewportSize({ width: 320, height: 700 });
  const tabs = page.getByRole("tablist", { name: "編集モード", exact: true });
  assert.equal(await tabs.getByRole("tab").count(), 3);
  assert.equal(
    await tabs.locator("svg").count(),
    3,
    "Block, preview and MDX modes share the SVG icon system",
  );
  for (const name of ["ブロックエディタ", "プレビュー", "MDX"]) {
    const tab = tabs.getByRole("tab", { name, exact: true });
    await tab.click();
    assert.equal(await tab.getAttribute("aria-selected"), "true");
    assert.equal(await tabs.locator('[aria-selected="true"]').count(), 1);
    const visibleTabs = await tabs.getByRole("tab").evaluateAll((items) =>
      items.every((item) => {
        const rect = item.getBoundingClientRect();
        return (
          rect.left >= 0 && rect.right <= innerWidth + 1 && rect.width >= 44 && rect.height >= 44
        );
      }),
    );
    assert(visibleTabs, name + ": all three mode controls remain visible and touchable");
    await assertNoOverflow(page, name + " at 320px");
  }
  assert.equal((await savedDraft(page)).source, originalDraft.source);
  await page.screenshot({ path: resolve(out, "modes-320px.png"), fullPage: true });
  checks.push("three same-level SVG modes fit 320px without changing source");

  begin("browser history and draft resumption");
  await showBlocks(page);
  const scroll = await page.locator(".editing-main").evaluate((element) => {
    element.scrollTop = 140;
    return element.scrollTop;
  });
  await goHome(page);
  await page
    .getByRole("navigation", { name: "CMSの管理", exact: true })
    .getByRole("button", { name: "連載", exact: true })
    .click();
  await page.getByRole("heading", { name: "連載・コース", exact: true }).waitFor();
  await page.goBack();
  await page.getByRole("heading", { name: "原稿", level: 1, exact: true }).waitFor();
  await page.goBack();
  await page.locator(".editor-header:not(.workspace-header)").waitFor({ state: "visible" });
  assert.equal(
    await page.locator(".editing-main").evaluate((element) => element.scrollTop),
    scroll,
  );
  assert.equal((await savedDraft(page)).id, originalDraft.id);
  assert.equal((await savedDraft(page)).source, originalDraft.source);
  await goHome(page);
  await page
    .locator(".entry-cards")
    .getByRole("button", { name: /^下書きの続き/u })
    .click();
  await page
    .getByRole("region", { name: "この端末の下書き", exact: true })
    .getByRole("button", { name: new RegExp("^" + draftTitle, "u") })
    .click();
  assert.equal(
    await page.getByRole("checkbox", { name: "添削から開く", exact: true }).isChecked(),
    false,
  );
  await page.getByRole("button", { name: "編集を始める", exact: true }).click();
  await page.locator(".editor-header:not(.workspace-header)").waitFor({ state: "visible" });
  assert.equal((await savedDraft(page)).id, originalDraft.id);
  assert.equal(
    (await snapshot(page)).drafts.length,
    1,
    "Resuming a saved draft does not duplicate it",
  );
  checks.push("browser back navigation and draft resumption preserve identity, source and scroll");

  begin("sample annotations and unambiguous outline");
  await page.setViewportSize({ width: 390, height: 844 });
  await goHome(page);
  await page.getByRole("button", { name: "操作サンプルを開く", exact: true }).click();
  // Sample creation is asynchronous; do not resume the previous draft while it opens.
  await page.locator(".editor-header:not(.workspace-header)").waitFor({ state: "visible" });
  await page.waitForFunction(
    () =>
      document.querySelector(".title-label textarea")?.value === "操作サンプル：記事の構成と添削",
  );
  await showBlocks(page);
  const sample = await savedDraft(page);
  assert.notEqual(sample.id, originalDraft.id);
  const sampleRecord = (await snapshot(page)).drafts.find((draft) => draft.id === sample.id);
  assert.equal(sampleRecord.annotations.length, 4);
  const blocks = page.getByRole("region", { name: "本文のブロック編集", exact: true });
  begin("math print option is reversible without metadata corruption");
  const printSource = blocks.getByRole("checkbox", { name: "印刷時はTeX原文を表示", exact: true });
  const mathLabel = blocks.getByRole("textbox", { name: "式の説明", exact: true });
  const label = await mathLabel.inputValue();
  const checkedSource = sample.source.replace(
    'label="' + label + '"',
    'label="' + label + '" print="source"',
  );
  assert.notEqual(checkedSource, sample.source);
  await printSource.check();
  assert.equal(await mathLabel.inputValue(), label);
  assert.equal((await savedDraft(page, { source: checkedSource })).source, checkedSource);
  await page.getByRole("button", { name: "元に戻す", exact: true }).click();
  assert.equal(await printSource.isChecked(), false);
  assert.equal((await savedDraft(page, { source: sample.source })).source, sample.source);
  await page.getByRole("button", { name: "やり直す", exact: true }).click();
  assert.equal(await printSource.isChecked(), true);
  assert.equal((await savedDraft(page, { source: checkedSource })).source, checkedSource);
  for (const checked of [false, true, false]) {
    await printSource.setChecked(checked);
    assert.equal(await mathLabel.inputValue(), label);
    const expected = checked ? checkedSource : sample.source;
    assert.equal((await savedDraft(page, { source: expected })).source, expected);
  }
  await page.reload();
  await ensureEditing(page);
  await showBlocks(page);
  assert.equal(await printSource.isChecked(), false);
  assert.equal(await mathLabel.inputValue(), label);
  assert.equal((await savedDraft(page)).source, sample.source);
  const checkBounds = await printSource.evaluate((input) => {
    const label = input.closest("label");
    const text = Array.from(label.childNodes).find(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
    );
    const range = document.createRange();
    range.selectNodeContents(text);
    const check = input.getBoundingClientRect();
    const caption = range.getBoundingClientRect();
    return {
      height: label.getBoundingClientRect().height,
      checkRight: check.right,
      captionLeft: caption.left,
    };
  });
  assert(
    checkBounds.height >= 44 && checkBounds.captionLeft >= checkBounds.checkRight,
    "Checkbox label is a full-height horizontal tap target",
  );
  checks.push(
    "math print toggle, undo/redo and reload preserve description, formula and all other source",
  );
  begin("sample review indicators and target selection");
  for (const state of ["open", "proposal", "resolved", "applied"]) {
    assert.equal(
      await blocks.locator(`.cms-review-indicator[data-review-state="${state}"]`).count(),
      1,
      state + ": exactly one block indicator",
    );
    assert.equal(
      await blocks.locator(`.cms-review-mark[data-review-state="${state}"]`).count(),
      1,
      state + ": exact text highlighting",
    );
  }
  assert.equal(
    await blocks.locator('[data-group="true"] > .cms-region-toolbar .cms-review-indicator').count(),
    0,
    "A group does not duplicate the badges on its children",
  );
  const badgeBounds = await blocks
    .locator(".cms-nested-editor .cms-review-indicator")
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const bounds = (element) => {
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        };
        return {
          state: button.getAttribute("data-review-state"),
          button: bounds(button),
          label: bounds(button.querySelector("span")),
          blockLabel: bounds(button.parentElement?.querySelector(":scope > span")),
        };
      }),
    );
  assert.equal(badgeBounds.length, 4, "All sample review badges belong to nested blocks");
  for (const bounds of badgeBounds) {
    const { button, label, blockLabel } = bounds;
    assert(button && label && blockLabel, "Nested badge and block labels are present");
    assert(
      label.left >= button.left - 1 &&
        label.right <= button.right + 1 &&
        label.top >= button.top - 1 &&
        label.bottom <= button.bottom + 1,
      bounds.state + ": the review label stays inside its button " + JSON.stringify(bounds),
    );
    assert(
      blockLabel.right <= button.left + 1,
      bounds.state +
        ": the review badge does not overlap the block label " +
        JSON.stringify(bounds),
    );
  }
  assert.equal(sample.source.includes("cms-review-mark"), false);
  const proposed = sampleRecord.annotations.find(
    (comment) => comment.status === "open" && comment.proposal,
  );
  await blocks.locator('.cms-review-indicator[data-review-state="proposal"]').click();
  const review = page.getByRole("region", { name: "本文の添削", exact: true });
  const selectedCard = review.locator('.review-card[data-review-selected="true"]');
  await selectedCard.waitFor();
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("data-review-selected") === "true",
  );
  assert.equal(
    await selectedCard.locator(".diff-before del").innerText(),
    proposed.proposal.expected,
  );
  assert.equal(
    await selectedCard.locator(".diff-after ins").innerText(),
    proposed.proposal.replacement,
  );
  assert.notEqual(
    await selectedCard
      .locator(".diff-before")
      .evaluate((element) => getComputedStyle(element).backgroundColor),
    await selectedCard
      .locator(".diff-after")
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  );
  await selectedCard.getByRole("button", { name: "対象へ", exact: true }).click();
  await review.waitFor({ state: "hidden" });
  assert.equal(await blocks.locator('.cms-review-mark[data-review-active="true"]').count(), 1);
  await blocks.locator('.cms-review-indicator[data-review-state="resolved"]').click();
  await selectedCard.waitFor();
  assert.match(await selectedCard.locator(".review-card-status").innerText(), /解決済み/u);
  assert.equal(await selectedCard.locator(".review-card-status svg circle").count(), 1);
  await closePanel(page);
  await panel(page, "記事構成を開く", page.getByRole("region", { name: "記事構成", exact: true }));
  const outline = page.getByRole("region", { name: "記事構成", exact: true });
  const outlineLabels = (await outline.locator(".outline-title").allTextContents()).map((label) =>
    label.trim(),
  );
  assert.equal(outlineLabels.filter((label) => label.includes("構成をまとめて動かす")).length, 1);
  assert.equal(outlineLabels.filter((label) => label.includes("本文を確認して直す")).length, 1);
  assert(outlineLabels.includes("グループ 1"));
  assert(outlineLabels.includes("グループ 2"));
  for (const kind of ["paragraph", "heading", "Figure", "code", "math", "Group"])
    assert(
      (await outline.locator(`li[data-kind="${kind}"] > .outline-row svg`).count()) > 0,
      kind + ": the outline shows a visual block type rather than headings alone",
    );
  assert.equal(
    await outline.locator('li[data-kind="Group"] > .outline-children').count(),
    2,
    "Each explicit group owns its nested article blocks",
  );
  assert(outlineLabels.some((label) => /三つの枠|外側の枠/u.test(label)));
  assert(outlineLabels.some((label) => label.includes("数式表示のサンプル")));
  await assertOutlineGeometry(page, outline, 390);
  await assertOutlineGeometry(page, outline, 320);
  await outline
    .locator(".outline-row")
    .filter({ has: page.getByText("本文を確認して直す", { exact: true }) })
    .click();
  await outline.waitFor({ state: "hidden" });
  const locatedHeading = blocks
    .locator(".cms-editor-region[data-active]")
    .filter({ has: page.getByRole("heading", { name: "本文を確認して直す", exact: true }) })
    .last();
  await locatedHeading.waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await closePanel(page);
  assert.equal(
    (await savedDraft(page)).source,
    sample.source,
    "Selecting annotations and outline items does not rewrite body source",
  );
  await blocks.locator('.cms-review-indicator[data-review-state="proposal"]').click();
  await selectedCard.getByRole("button", { name: "修正案を反映", exact: true }).click();
  await closePanel(page);
  const appliedSample = await savedDraft(page, {
    source: sample.source.replace(proposed.proposal.expected, proposed.proposal.replacement),
  });
  assert.equal(
    appliedSample.source,
    sample.source.replace(proposed.proposal.expected, proposed.proposal.replacement),
  );
  await showBlocks(page);
  assert.equal(
    await blocks.locator('.cms-review-indicator[data-review-state="applied"]').count(),
    2,
  );
  await page.screenshot({ path: resolve(out, "sample-review-mobile.png"), fullPage: true });

  begin("one-tap follow-up review keeps the earlier applied decision");
  const previousApplied = sampleRecord.annotations.find((comment) => comment.status === "applied");
  const appliedBadge = blocks.locator('.cms-review-indicator[data-review-state="applied"]').last();
  await appliedBadge.click();
  const additional = selectedCard.getByLabel("追加の指摘", { exact: true });
  await additional.waitFor();
  assert.equal(
    await selectedCard.locator(".review-context-composer .selected-quote").innerText(),
    previousApplied.proposal.replacement,
  );
  assert.notEqual(
    await page.evaluate(() => document.activeElement?.tagName),
    "TEXTAREA",
    "Opening a review does not open the software keyboard",
  );
  assert.equal(
    await selectedCard.getByRole("button", { name: "指摘を再開", exact: true }).count(),
    0,
  );
  const followUpInstruction = "反映後の文に操作例を補足する";
  await additional.fill(followUpInstruction);
  await selectedCard.getByRole("button", { name: "対象へ", exact: true }).click();
  await review.waitFor({ state: "hidden" });
  await appliedBadge.click();
  await additional.waitFor();
  assert.equal(
    await additional.inputValue(),
    followUpInstruction,
    "Returning to the target keeps the unfinished instruction",
  );
  await closePanel(page);
  await page.waitForFunction(() => document.activeElement?.matches(".cms-review-indicator"));
  await appliedBadge.click();
  assert.equal(
    await additional.inputValue(),
    followUpInstruction,
    "Closing and reopening the panel keeps the unfinished instruction",
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await appliedBadge.click();
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("data-review-selected") === "true",
  );
  assert.equal(
    await additional.inputValue(),
    followUpInstruction,
    "Reopening the same target keeps the unfinished instruction",
  );
  await selectedCard.getByRole("button", { name: "指摘を追加", exact: true }).click();
  const followed = await savedDraft(page, { annotationCount: 5 });
  assert.equal(
    followed.source,
    appliedSample.source,
    "A new instruction does not change body text",
  );
  assert.deepEqual(
    followed.annotations.find((comment) => comment.id === previousApplied.id),
    previousApplied,
    "The previous applied proposal and diff remain unchanged",
  );
  const followUp = followed.annotations.find(
    (comment) => comment.instruction === followUpInstruction,
  );
  assert(followUp && followUp.id !== previousApplied.id);
  assert.equal(followUp.anchor.quote, previousApplied.proposal.replacement);
  assert.equal(followUp.status, "open");
  assert.equal(followed.annotations.length, 5);
  await closePanel(page);
  await page.setViewportSize({ width: 390, height: 844 });
  checks.push(
    "review status opens an exact current-text composer; repeated opening keeps input and adding preserves applied history",
  );
  await page.reload();
  await ensureEditing(page);
  assert.equal((await savedDraft(page)).source, appliedSample.source);
  assert.equal(
    (await snapshot(page)).drafts
      .find((draft) => draft.id === sample.id)
      .annotations.filter((comment) => comment.status === "applied").length,
    2,
  );
  await goHome(page);
  await page
    .locator(".entry-cards")
    .getByRole("button", { name: /^下書きの続き/u })
    .click();
  await page
    .getByRole("region", { name: "この端末の下書き", exact: true })
    .getByRole("button", { name: /^操作サンプル：記事の構成と添削/u })
    .click();
  assert.equal(
    await page.getByRole("checkbox", { name: "添削から開く", exact: true }).isChecked(),
    true,
  );
  await page.getByRole("button", { name: "編集を始める", exact: true }).click();
  await review.waitFor({ state: "visible" });
  assert.equal((await snapshot(page)).drafts.length, 2);
  checks.push(
    "sample shows open/proposed/resolved/applied inline marks and nonduplicated group outline",
  );
  checks.push("proposal diff selection, exact application and AI review entry survive reload");

  begin("fresh canvas review and quiet insertion on a touch viewport");
  const canvasContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "ja-JP",
    isMobile: true,
    hasTouch: true,
  });
  canvasContext.setDefaultTimeout(15000);
  const canvas = await canvasContext.newPage();
  failurePage = canvas;
  canvas.on("pageerror", (error) => errors.push(error.message));
  await canvas.goto(server.origin + "/editor/");
  await ensureEditing(canvas);
  await showBlocks(canvas);
  const emptyDraft = await savedDraft(canvas);
  const emptyInsert = canvas.locator(".cms-empty-blocks").getByRole("button", {
    name: "ブロックを追加",
    exact: true,
  });
  await emptyInsert.click();
  await canvas.getByRole("dialog", { name: "ブロックを挿入", exact: true }).waitFor();
  await canvas.getByRole("button", { name: "挿入メニューを閉じる", exact: true }).click();
  assert.equal((await savedDraft(canvas)).source, emptyDraft.source);
  const wholeQuote = "この段落全体について説明を補います。";
  const selectedQuote = "選択した文章だけ";
  const selectionParagraph = selectedQuote + "に指摘を付けます。本文全体は書き換えません。";
  const canvasBody = [
    "<Group>",
    "## ひとまとまりの構成",
    wholeQuote,
    selectionParagraph,
    "最後の段落です。",
    "</Group>",
  ].join("\n\n");
  const header = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u.exec(emptyDraft.source)?.[0];
  assert(header, "The new draft has a valid metadata delimiter");
  const canvasSource = header + canvasBody;
  await writeBody(canvas, canvasBody);
  await showBlocks(canvas);
  await savedDraft(canvas, { source: canvasSource });
  const canvasBlocks = canvas.getByRole("region", { name: "本文のブロック編集", exact: true });
  const preview = (text) =>
    canvasBlocks.locator(".cms-preview-target").filter({ hasText: text }).first();
  const regionFor = (text) => preview(text).locator("xpath=ancestor::article[1]");
  const wholeRegion = regionFor(wholeQuote);
  const wholeRegionId = await wholeRegion.getAttribute("data-region-id");
  const fixedWholeRegion = canvasBlocks.locator(`[data-region-id="${wholeRegionId}"]`);
  await preview(wholeQuote).press("Enter");
  await fixedWholeRegion.locator(".cms-rich-editor [contenteditable=true]").waitFor();
  const insertState = await insertVisibility(canvas);
  assert(insertState.length > 1);
  assert.equal(
    insertState.filter((button) => button.visible).length,
    1,
    "Only the focused leaf block exposes an insertion marker on touch screens",
  );
  assert(
    insertState.every((button) => button.width >= 44 && button.height >= 44),
    "Quieter insertion markers retain 44px tap areas",
  );
  assert(
    insertState.filter((button) => !button.visible).every((button) => !button.interactive),
    "Hidden insertion controls do not intercept scrolling or text taps",
  );
  const insertion = fixedWholeRegion.locator(":scope > .cms-insert-after");
  await insertion.click();
  await canvas.getByRole("dialog", { name: "ブロックを挿入", exact: true }).waitFor();
  await canvas.getByRole("button", { name: "挿入メニューを閉じる", exact: true }).click();
  assert.equal((await savedDraft(canvas)).source, canvasSource);
  await canvas.screenshot({ path: resolve(out, "quiet-insertion-390px.png"), fullPage: true });

  const freshReview = fixedWholeRegion.getByRole("button", { name: "指摘を追加", exact: true });
  await freshReview.click();
  const canvasReview = canvas.getByRole("region", { name: "本文の添削", exact: true });
  const composer = canvasReview.locator(".review-composer").first();
  await composer.getByLabel("指摘", { exact: true }).waitFor();
  assert.equal(await composer.locator(".selected-quote").innerText(), wholeQuote);
  assert.match(await composer.innerText(), /ブロック全体/u);
  assert.notEqual(await canvas.evaluate(() => document.activeElement?.tagName), "TEXTAREA");
  const wholeInstruction = "ブロック全体の具体例を補ってください。";
  const wholeInput = composer.getByLabel("指摘", { exact: true });
  await wholeInput.pressSequentially(wholeInstruction);
  assert.equal(await wholeInput.inputValue(), wholeInstruction);
  assert.equal(await wholeInput.evaluate((input) => input === document.activeElement), true);
  await composer.getByRole("button", { name: "指摘を追加", exact: true }).click();
  const firstReviewDraft = await savedDraft(canvas, { source: canvasSource, annotationCount: 1 });
  assert.equal(firstReviewDraft.annotations[0].instruction, wholeInstruction);
  assert.equal(firstReviewDraft.annotations[0].anchor.quote, wholeQuote);
  assert.equal(firstReviewDraft.annotations[0].status, "open");
  await closePanel(canvas);
  await canvas.waitForFunction(() => document.activeElement?.matches(".cms-review-create"));

  const selectionRegionId = await regionFor(selectionParagraph).getAttribute("data-region-id");
  const selectionRegion = canvasBlocks.locator(`[data-region-id="${selectionRegionId}"]`);
  await preview(selectionParagraph).press("Enter");
  const richText = selectionRegion.locator(".cms-rich-editor [contenteditable=true]").first();
  await richText.waitFor();
  await richText.press("ControlOrMeta+Home");
  await canvas.keyboard.down("Shift");
  for (const _ of selectedQuote) await canvas.keyboard.press("ArrowRight");
  await canvas.keyboard.up("Shift");
  await canvas.waitForFunction((quote) => getSelection()?.toString() === quote, selectedQuote);
  await selectionRegion.getByRole("button", { name: "指摘を追加", exact: true }).click();
  await composer.getByLabel("指摘", { exact: true }).waitFor();
  assert.equal(await composer.locator(".selected-quote").innerText(), selectedQuote);
  assert.match(await composer.innerText(), /選択した文章/u);
  const rangeInstruction = "この言い回しを具体的にしてください。";
  await composer.getByLabel("指摘", { exact: true }).fill(rangeInstruction);
  await closePanel(canvas);
  await selectionRegion.getByRole("button", { name: "指摘を追加", exact: true }).click();
  assert.equal(await composer.getByLabel("指摘", { exact: true }).inputValue(), rangeInstruction);
  assert.equal(await composer.locator(".selected-quote").innerText(), selectedQuote);
  await canvas.setViewportSize({ width: 320, height: 740 });
  await assertNoOverflow(canvas, "fresh review at 320px");
  await canvas.screenshot({
    path: resolve(out, "fresh-review-selection-320px.png"),
    fullPage: true,
  });
  await composer.getByRole("button", { name: "指摘を追加", exact: true }).click();
  const secondReviewDraft = await savedDraft(canvas, { source: canvasSource, annotationCount: 2 });
  assert.deepEqual(secondReviewDraft.annotations[0], firstReviewDraft.annotations[0]);
  const rangeReview = secondReviewDraft.annotations.find(
    (comment) => comment.instruction === rangeInstruction,
  );
  assert.equal(rangeReview.anchor.quote, selectedQuote);
  assert.notEqual(rangeReview.id, firstReviewDraft.annotations[0].id);
  await closePanel(canvas);

  const resumedPreview = preview(selectionParagraph);
  if (await resumedPreview.isVisible()) await resumedPreview.press("Enter");
  await richText.waitFor();
  await richText.focus();
  await richText.press("ControlOrMeta+Home");
  await canvas.keyboard.down("Shift");
  for (const _ of selectedQuote) await canvas.keyboard.press("ArrowRight");
  await canvas.keyboard.up("Shift");
  await canvas.waitForFunction((quote) => getSelection()?.toString() === quote, selectedQuote);
  await richText.press("ArrowRight");
  await canvas.waitForFunction(() => getSelection()?.isCollapsed);
  await panel(canvas, "添削を開く", canvasReview);
  await composer.getByLabel("指摘", { exact: true }).waitFor();
  assert.equal(
    await composer.locator(".selected-quote").innerText(),
    selectionParagraph,
    "The original review dock uses the whole block after a text selection is collapsed",
  );
  assert.match(await composer.innerText(), /ブロック全体/u);
  await composer.getByLabel("指摘", { exact: true }).fill("段落全体の説明を確認します。");
  assert.equal(
    await composer.getByRole("button", { name: "指摘を追加", exact: true }).isEnabled(),
    true,
    "An ordinary caret leaves the original review path usable",
  );
  await composer.getByLabel("指摘", { exact: true }).fill("");
  await closePanel(canvas);
  assert.deepEqual(
    (await savedDraft(canvas, { source: canvasSource, annotationCount: 2 })).annotations,
    secondReviewDraft.annotations,
  );

  const firstPreview = canvasBlocks.locator(".cms-preview-target").first();
  await firstPreview.focus();
  await canvas.keyboard.press("Tab");
  await canvas.waitForFunction(() => document.activeElement?.matches(".cms-insert-after"));
  assert(
    (await insertVisibility(canvas)).some((button) => button.focused && button.visible),
    "An insertion control becomes visible when reached with Tab",
  );
  await canvas.keyboard.press("Enter");
  await canvas.getByRole("dialog", { name: "ブロックを挿入", exact: true }).waitFor();
  await canvas.getByRole("button", { name: "挿入メニューを閉じる", exact: true }).click();
  await canvasBlocks.locator(":scope > .cms-append-block").click();
  await canvas.getByRole("dialog", { name: "ブロックを挿入", exact: true }).waitFor();
  await canvas.getByRole("button", { name: "挿入メニューを閉じる", exact: true }).click();
  assert.equal((await savedDraft(canvas)).source, canvasSource);
  await canvas.reload();
  await ensureEditing(canvas);
  assert.deepEqual(
    (await savedDraft(canvas, { annotationCount: 2 })).annotations,
    secondReviewDraft.annotations,
  );
  checks.push(
    "unmarked nested blocks and exact selected text create new persisted reviews without changing source or previous decisions",
    "collapsing a selection restores whole-block review through the original dock without retaining a stale quote",
    "touch insertion is limited to the focused leaf while keyboard, empty and end insertion remain available with 44px targets",
  );
  await canvasContext.close();
  failurePage = page;

  begin("IndexedDB version 2 upgrades without losing draft media or history");
  const migrationContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "ja-JP",
  });
  migrationContext.setDefaultTimeout(15000);
  const migration = await migrationContext.newPage();
  failurePage = migration;
  migration.on("pageerror", (error) => errors.push(error.message));
  await migration.route(server.origin + "/editor/migration-fixture.html", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Migration fixture</title>",
    }),
  );
  await migration.goto(server.origin + "/editor/migration-fixture.html");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWOoCJj2HwAFAAJeoZPDtAAAAABJRU5ErkJggg==",
    "base64",
  );
  const sha = createHash("sha256").update(png).digest("hex");
  await migration.evaluate(
    async ({ draft, bytes, sha }) => {
      const database = await new Promise((accept, reject) => {
        const request = indexedDB.open("xpotato-editor-v1", 2);
        request.onupgradeneeded = () => {
          const db = request.result;
          db.createObjectStore("drafts", { keyPath: "id" });
          db.createObjectStore("media", { keyPath: "id" }).createIndex("draftId", "draftId");
          db.createObjectStore("revisions", { keyPath: "id" }).createIndex("draftId", "draftId");
        };
        request.onsuccess = () => accept(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((accept, reject) => {
        const transaction = database.transaction(["drafts", "media", "revisions"], "readwrite");
        transaction.objectStore("drafts").put(draft);
        transaction.objectStore("media").put({
          id: "44444444-4444-4444-8444-444444444444",
          draftId: draft.id,
          assetId: "migration-fixture",
          blob: new Blob([new Uint8Array(bytes)], { type: "image/png" }),
          originalBytes: bytes.length,
          sourceSha256: sha,
          sha256: sha,
          kind: "technical",
          transform: "identity-v1",
          createdAt: draft.savedAt,
          originalName: "migration.png",
          sourceRetained: true,
        });
        transaction.objectStore("revisions").put({
          id: "55555555-5555-4555-8555-555555555555",
          draftId: draft.id,
          source: draft.source,
          savedAt: draft.savedAt,
          label: "移行前の履歴",
        });
        transaction.oncomplete = () => accept();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    },
    { draft: originalRecord, bytes: [...png], sha },
  );
  await migration.goto(server.origin + "/editor/");
  await migration.getByRole("heading", { name: "原稿", level: 1, exact: true }).waitFor();
  const upgraded = await snapshot(migration);
  assert.equal(upgraded.version, 3);
  assert.equal(upgraded.drafts.length, 1);
  assert.equal(upgraded.drafts[0].source, originalRecord.source);
  await ensureEditing(migration);
  assert.equal(
    await migration.getByRole("textbox", { name: "タイトル", exact: true }).inputValue(),
    draftTitle,
  );
  const legacy = await migration.evaluate(async () => {
    const database = await new Promise((accept, reject) => {
      const request = indexedDB.open("xpotato-editor-v1");
      request.onsuccess = () => accept(request.result);
      request.onerror = () => reject(request.error);
    });
    const read = (store) =>
      new Promise((accept, reject) => {
        const request = database.transaction(store, "readonly").objectStore(store).getAll();
        request.onsuccess = () => accept(request.result);
        request.onerror = () => reject(request.error);
      });
    const [media, revisions] = await Promise.all([read("media"), read("revisions")]);
    database.close();
    return {
      media: await Promise.all(
        media.map(async (item) => ({
          id: item.id,
          draftId: item.draftId,
          sha: item.sha256,
          bytes: Array.from(new Uint8Array(await item.blob.arrayBuffer())),
        })),
      ),
      revisions,
    };
  });
  assert.equal(legacy.media.length, 1);
  assert.equal(legacy.media[0].draftId, originalRecord.id);
  assert.equal(legacy.media[0].sha, sha);
  assert.deepEqual(legacy.media[0].bytes, [...png]);
  assert.equal(
    legacy.revisions.find((item) => item.id === "55555555-5555-4555-8555-555555555555").source,
    originalRecord.source,
  );
  checks.push("IndexedDB v2 to v3 retains existing source, exact media bytes and revision history");
  await migrationContext.close();
  failurePage = page;

  assert.deepEqual(errors, []);
  assert.deepEqual(violations, []);
  assert.deepEqual(outside, []);
  assert(
    apiCalls.every((call) => call.method === "GET"),
    "Local authoring and registry management make no API writes",
  );
  await writeFile(
    resolve(out, "result.json"),
    JSON.stringify(
      {
        result: "pass",
        mode: "local-real-chromium-synthetic-unauthenticated-API",
        checks,
        errors,
        violations,
        apiCalls,
        liveGitHub: false,
        liveR2: false,
        productionMutation: false,
      },
      null,
      2,
    ) + "\n",
  );
  await context.close();
  console.log(
    "Editor workspace smoke PASS: explicit entry, independent registries, compact modes, review markers, persistence and v2 migration.",
  );
} catch (error) {
  console.error("Editor workspace phase FAIL: " + phase);
  if (failurePage && !failurePage.isClosed()) {
    await Promise.allSettled([
      failurePage.screenshot({ path: resolve(out, "failure.png"), fullPage: true, timeout: 5000 }),
      failurePage.content().then((html) => writeFile(resolve(out, "failure.html"), html)),
      writeFile(
        resolve(out, "failure.json"),
        JSON.stringify(
          {
            phase,
            message: error instanceof Error ? error.message : String(error),
            url: failurePage.url(),
            errors,
            violations,
          },
          null,
          2,
        ) + "\n",
      ),
    ]);
  }
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
