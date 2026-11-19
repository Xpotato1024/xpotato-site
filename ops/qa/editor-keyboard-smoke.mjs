import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { editorStaticServer } from "./editor-static-server.mjs";
import {
  closePanel,
  panel,
  savedDraft,
  showBlocks,
  sourceEditor,
  writeBody,
} from "./editor-browser-helpers.mjs";

const output = resolve(".local/cms-validation/keyboard");
await mkdir(output, { recursive: true });
const server = await editorStaticServer(resolve("."));
let browser;
let page;
const checks = [];

async function keyboard(height, offsetTop = 0) {
  await page.evaluate(
    async ({ height, offsetTop }) => {
      const viewport = window.visualViewport;
      assertViewport(viewport);
      function assertViewport(value) {
        if (!value) throw Error("VisualViewport is required for the keyboard regression");
      }
      if (height === null) {
        delete viewport.height;
        delete viewport.offsetTop;
      } else {
        Object.defineProperty(viewport, "height", { value: height, configurable: true });
        Object.defineProperty(viewport, "offsetTop", { value: offsetTop, configurable: true });
      }
      viewport.dispatchEvent(new Event("resize"));
      viewport.dispatchEvent(new Event("scroll"));
      for (let frame = 0; frame < 5; frame++) {
        await new Promise(requestAnimationFrame);
      }
    },
    { height, offsetTop },
  );
}

async function caretState(locator, kind = "rich") {
  return locator.evaluate((element, kind) => {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    const viewport = window.visualViewport;
    let rect;
    let selection;
    if (kind === "source") {
      const root = element.getRootNode();
      const selected =
        root instanceof ShadowRoot && root.mode === "open" ? root.getSelection?.() : null;
      if (
        !selected?.anchorNode ||
        !selected.focusNode ||
        !element.contains(selected.anchorNode) ||
        !element.contains(selected.focusNode)
      )
        throw Error("Caret left the MDX shadow editor");
      const cursor = root.querySelector(".cm-cursor");
      rect = cursor?.getBoundingClientRect();
      // Offscreen lines are virtualized; only the selection endpoints are stable DOM evidence.
      selection = {
        anchorText: selected.anchorNode.textContent,
        anchor: selected.anchorOffset,
        focusText: selected.focusNode.textContent,
        focus: selected.focusOffset,
      };
    } else if (kind === "field") {
      rect = element.getBoundingClientRect();
      selection = {
        start: element.selectionStart,
        end: element.selectionEnd,
        value: element.value,
      };
    } else if (kind === "textarea") {
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const line = element.value.slice(0, element.selectionEnd).split("\n").length - 1;
      const lineHeight = parseFloat(style.lineHeight);
      const top =
        bounds.top +
        element.clientTop +
        parseFloat(style.paddingTop) +
        line * lineHeight -
        element.scrollTop;
      rect = {
        top,
        bottom: top + lineHeight,
        left: bounds.left + element.clientLeft + parseFloat(style.paddingLeft),
        right: bounds.right - element.clientLeft,
      };
      selection = {
        start: element.selectionStart,
        end: element.selectionEnd,
        value: element.value,
      };
    } else {
      const selected = window.getSelection();
      if (!selected?.focusNode || !element.contains(selected.focusNode))
        throw Error("Caret left the rich editor");
      const range = document.createRange();
      range.setStart(selected.focusNode, selected.focusOffset);
      range.collapse(true);
      rect = range.getBoundingClientRect();
      selection = {
        anchorText: selected.anchorNode.textContent,
        anchor: selected.anchorOffset,
        focusText: selected.focusNode.textContent,
        focus: selected.focusOffset,
        text: selected.toString(),
      };
    }
    if (!rect || !Number.isFinite(rect.top) || rect.bottom <= rect.top)
      throw Error("No measurable caret rectangle");
    const point = {
      x: Math.min(innerWidth - 1, Math.max(1, rect.left + 2)),
      y: (rect.top + rect.bottom) / 2,
    };
    let hit = document.elementFromPoint(point.x, point.y);
    while (hit?.shadowRoot) {
      const next = hit.shadowRoot.elementFromPoint?.(point.x, point.y);
      if (!next || next === hit) break;
      hit = next;
    }
    return {
      focused: active === element,
      selection,
      rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
      viewport: {
        top: viewport?.offsetTop ?? 0,
        bottom: (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight),
      },
      hit: hit?.tagName,
      hitOwnInput: !!hit && (hit === element || element.contains(hit)),
      keyboard: document.documentElement.dataset.editorKeyboard,
    };
  }, kind);
}

async function visibleCaret(locator, label, kind = "rich") {
  const state = await caretState(locator, kind);
  assert(state.focused, `${label}: focus must stay in the original input`);
  assert(
    state.rect.top >= state.viewport.top && state.rect.bottom <= state.viewport.bottom,
    `${label}: caret must remain inside the visual viewport: ${JSON.stringify(state)}`,
  );
  assert(
    state.hitOwnInput,
    `${label}: a header, writing dock or scroll clipping must not cover the caret: ${JSON.stringify(state)}`,
  );
  assert.equal(state.keyboard, "true", `${label}: keyboard layout must be active`);
  checks.push(label);
  return state;
}

try {
  const executable = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    chromium.executablePath(),
  ].find((path) => path && existsSync(path));
  browser = await chromium.launch({
    headless: true,
    ...(executable ? { executablePath: executable } : {}),
  });
  const context = await browser.newContext({
    locale: "ja-JP",
    viewport: { width: 390, height: 844 },
  });
  context.setDefaultTimeout(15000);
  page = await context.newPage();
  const errors = [];
  const violations = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.exposeFunction("recordKeyboardCsp", (directive) => violations.push(directive));
  await page.addInitScript(() =>
    document.addEventListener(
      "securitypolicyviolation",
      (event) => void window.recordKeyboardCsp(event.violatedDirective),
    ),
  );
  await page.goto(server.origin + "/editor/");
  const paragraph = "キーボードを開いても入力位置を見失わないように確認します。".repeat(45);
  const source = `<Group>\n\n## グループ内の見出し\n\n${paragraph}\n\n</Group>\n`;

  for (const size of [
    { width: 390, height: 844, keyboard: 375, offset: 24 },
    { width: 320, height: 700, keyboard: 280, offset: 20 },
  ]) {
    console.log(`Editor keyboard phase: ${size.width}px nested rich caret`);
    await keyboard(null);
    await page.setViewportSize({ width: size.width, height: size.height });
    await writeBody(page, source);
    const savedSource = (await savedDraft(page)).source;
    await showBlocks(page);
    const rich = page.locator('.cms-rich-editor .cms-prose[contenteditable="true"]').first();
    if (!(await rich.isVisible()))
      await page.getByRole("button", { name: "段落を編集", exact: true }).first().click();
    await rich.waitFor();
    await rich.press("ControlOrMeta+End");
    const before = await caretState(rich);
    await keyboard(size.keyboard, size.offset);
    const after = await visibleCaret(rich, `${size.width}: rich caret after keyboard opens`);
    assert.deepEqual(
      after.selection,
      before.selection,
      "Keyboard opening must not replace the user's selection",
    );
    await rich.dispatchEvent("compositionstart", { data: "" });
    await page.evaluate(async () => {
      await new Promise(requestAnimationFrame);
    });
    const compositionStart = await caretState(rich);
    await keyboard(size.keyboard - 20, size.offset + 10);
    const composing = await visibleCaret(rich, `${size.width}: composition viewport movement`);
    assert.deepEqual(
      composing.selection,
      compositionStart.selection,
      "Viewport movement during composition must preserve the active composition selection",
    );
    await rich.dispatchEvent("compositionend", { data: "" });
    await rich.press("ControlOrMeta+Home");
    await keyboard(size.keyboard, size.offset);
    await visibleCaret(rich, `${size.width}: rich caret below sticky controls`);
    await page.screenshot({ path: resolve(output, `rich-${size.width}.png`) });
    assert.equal(
      (await savedDraft(page)).source,
      savedSource,
      "Rich-editor focus and composition viewport changes must preserve every source byte",
    );

    console.log(`Editor keyboard phase: ${size.width}px MDX shadow caret`);
    await keyboard(null);
    const mdx = await sourceEditor(page);
    await mdx.press("ControlOrMeta+End");
    const mdxBefore = await caretState(mdx, "source");
    await keyboard(size.keyboard, size.offset);
    const mdxAfter = await visibleCaret(
      mdx,
      `${size.width}: MDX caret after keyboard opens`,
      "source",
    );
    assert.deepEqual(
      mdxAfter.selection,
      mdxBefore.selection,
      "Viewport movement must preserve the MDX caret selection",
    );
    await mdx.press("ControlOrMeta+Home");
    await keyboard(size.keyboard, size.offset);
    await visibleCaret(mdx, `${size.width}: MDX caret below sticky controls`, "source");
    await keyboard(null);
    assert.equal(
      (await savedDraft(page)).source,
      savedSource,
      "Focus and viewport changes preserve the entire nested source",
    );

    console.log(`Editor keyboard phase: ${size.width}px management fields`);
    const metadata = page.getByRole("region", { name: "記事情報", exact: true });
    await panel(page, "記事情報を開く", metadata);
    const search = metadata.getByRole("searchbox", { name: "話題タグを検索", exact: true });
    await search.click();
    await search.fill("キーボード");
    const fieldBefore = await caretState(search, "field");
    await keyboard(size.keyboard, size.offset);
    const fieldAfter = await visibleCaret(
      search,
      `${size.width}: management search field`,
      "field",
    );
    assert.deepEqual(fieldAfter.selection, fieldBefore.selection);
    await keyboard(null);
    const description = metadata.getByRole("textbox", { name: "概要", exact: true });
    await description.fill(Array.from({ length: 30 }, (_, index) => String(index)).join("\n"));
    await description.press("ControlOrMeta+End");
    const textBefore = await caretState(description, "textarea");
    await keyboard(size.keyboard, size.offset);
    const textAfter = await visibleCaret(
      description,
      `${size.width}: textarea internal and page scroll`,
      "textarea",
    );
    assert.deepEqual(textAfter.selection, textBefore.selection);
    await page.screenshot({ path: resolve(output, `form-${size.width}.png`) });
    await keyboard(null);
    await closePanel(page);
  }
  assert.deepEqual(errors, [], "No runtime errors while revealing focused inputs");
  assert.deepEqual(violations, [], "Caret measurement must not violate the editor CSP");
  await writeFile(
    resolve(output, "result.json"),
    JSON.stringify(
      {
        result: "pass",
        mode: "Chromium with simulated VisualViewport and composition events; not a real iPhone or IME",
        checks,
        runtimeErrors: errors,
        cspViolations: violations,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Editor keyboard smoke PASS: ${checks.length} caret visibility checks, source and selection preserved.`,
  );
} catch (error) {
  await page?.screenshot({ path: resolve(output, "failure.png") }).catch(() => {});
  await writeFile(
    resolve(output, "failure.json"),
    JSON.stringify({ error: error.message, checks }, null, 2) + "\n",
  );
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
