/** Exercise the visible editing surface; do not reach into React or CodeMirror state. */
export async function sourceEditor(page) {
  const toggle = page.getByRole("button", { name: "MDX本文を表示", exact: true });
  if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
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
  const toggle = page.getByRole("button", { name: "MDX本文を表示", exact: true });
  if ((await toggle.getAttribute("aria-pressed")) === "true") await toggle.click();
  await page
    .getByRole("region", { name: "本文のブロック編集", exact: true })
    .waitFor({ state: "visible" });
}
export async function panel(page, label, content) {
  if (!(await content.isVisible()))
    await page.getByRole("button", { name: label, exact: true }).click();
  await content.waitFor({ state: "visible" });
}
export async function closePanel(page) {
  const close = page.getByRole("button", { name: "パネルを閉じる", exact: true });
  if (await close.isVisible()) await close.click();
}
export async function savedDraft(page) {
  await page.locator(".save-state").filter({ hasText: "保存済み" }).waitFor();
  return page.evaluate(async () => {
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
}
