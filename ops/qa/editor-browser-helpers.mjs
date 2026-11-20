/** Exercise the visible editing surface; do not reach into React or CodeMirror state. */
export async function goHome(page) {
  const heading = page.getByRole("heading", { name: "原稿", level: 1, exact: true });
  if (await heading.isVisible()) return;
  await closePanel(page);
  const fromEditor = page
    .locator(".editor-header")
    .getByRole("button", { name: "ホームに戻る", exact: true });
  if (await fromEditor.isVisible()) await fromEditor.click();
  else
    await page
      .getByRole("navigation", { name: "CMSの管理", exact: true })
      .getByRole("button", { name: "ホーム", exact: true })
      .click();
  await heading.waitFor({ state: "visible" });
}

/** Opening the CMS must not create a draft; editing tests explicitly start or resume one. */
export async function ensureEditing(page) {
  await page
    .locator(
      ".editor-header:not(.workspace-header):visible, .workspace-home:visible, .start-workspace:visible, .registry-workspace:visible",
    )
    .first()
    .waitFor({ state: "visible" });
  if (await page.locator(".editor-header:not(.workspace-header)").isVisible()) return;
  await goHome(page);
  const resume = page.locator(".resume-draft");
  if (await resume.isVisible()) await resume.click();
  else {
    await page
      .locator(".entry-cards")
      .getByRole("button", { name: /^新規作成/u })
      .click();
    await page.getByRole("heading", { name: "新規作成", exact: true }).waitFor();
    await page.getByRole("radio", { name: "この端末", exact: true }).check();
    await page.getByRole("button", { name: "作成して編集", exact: true }).click();
  }
  await page.locator(".editor-header:not(.workspace-header)").waitFor({ state: "visible" });
}

async function writingSurface(page) {
  await ensureEditing(page);
  if (!(await page.locator(".editing-main").isVisible())) await closePanel(page);
}
export async function sourceEditor(page) {
  await writingSurface(page);
  const mode = page.getByRole("tab", { name: "MDX", exact: true });
  if ((await mode.getAttribute("aria-selected")) !== "true") await mode.click();
  const editor = page.getByRole("textbox", { name: "MDX本文", exact: true });
  await editor.waitFor({ state: "visible" });
  return editor;
}
export async function readBody(page) {
  const editor = await sourceEditor(page);
  return editor
    .locator(".cm-line")
    .evaluateAll((lines) => lines.map((line) => line.textContent ?? "").join("\n"));
}
export async function writeBody(page, body) {
  const editor = await sourceEditor(page);
  // Clear through the editor keymap so native insertion cannot copy highlighted span styles.
  await editor.press("ControlOrMeta+a");
  await editor.press("Backspace");
  if (body) await page.keyboard.insertText(body);
  return editor;
}
export async function showBlocks(page) {
  await writingSurface(page);
  const mode = page.getByRole("tab", { name: "ブロックエディタ", exact: true });
  if ((await mode.getAttribute("aria-selected")) !== "true") await mode.click();
  await page
    .getByRole("region", { name: "本文のブロック編集", exact: true })
    .waitFor({ state: "visible" });
}
export async function panel(page, label, content) {
  if (await content.isVisible()) return;
  if (label === "下書き一覧を開く" || label === "原稿一覧") {
    await goHome(page);
    await page
      .locator(".entry-cards")
      .getByRole("button", { name: /^下書きの続き/u })
      .click();
  } else if (label === "連載を開く") {
    await goHome(page);
    await page
      .getByRole("navigation", { name: "CMSの管理", exact: true })
      .getByRole("button", { name: "連載", exact: true })
      .click();
  } else if (label === "記事情報を開く" || label === "履歴を開く") {
    await ensureEditing(page);
    await closePanel(page);
    await page.getByRole("button", { name: "記事メニューを開く", exact: true }).click();
    await page.getByRole("button", { name: label, exact: true }).click();
  } else {
    await ensureEditing(page);
    const trigger = page.getByRole("button", { name: label, exact: true }).first();
    if (!(await trigger.isVisible())) await closePanel(page);
    await trigger.click();
  }
  await content.waitFor({ state: "visible" });
}
export async function closePanel(page) {
  const close = page.getByRole("button", { name: "パネルを閉じる", exact: true });
  if (await close.isVisible()) await close.click();
}
export async function savedDraft(page, expected = {}) {
  await page.locator(".save-state").filter({ hasText: "保存済み" }).waitFor();
  const read = () =>
    page.evaluate(async () => {
      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open("xpotato-editor-v1");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const drafts = await new Promise((resolve, reject) => {
        const request = database.transaction("drafts", "readonly").objectStore("drafts").getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      database.close();
      return drafts.sort((left, right) => right.savedAt.localeCompare(left.savedAt))[0];
    });
  // Consecutive edits can precede the save indicator's next render. Poll the
  // persisted revision explicitly; an async browser predicate is not a save gate.
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const latest = await read();
    if (
      latest &&
      (expected.source === undefined || latest.source === expected.source) &&
      (expected.annotationCount === undefined ||
        (Array.isArray(latest.annotations) &&
          latest.annotations.length === expected.annotationCount))
    ) {
      return latest;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw Error("Expected draft revision did not reach local storage");
}
