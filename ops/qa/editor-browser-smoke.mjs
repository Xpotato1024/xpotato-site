import { existsSync } from "node:fs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { editorStaticServer } from "./editor-static-server.mjs";
const root = resolve("."),
  out = resolve(".local/cms-validation/browser");
await mkdir(out, { recursive: true });
const server = await editorStaticServer(root);
let browser;
try {
  const executable = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    chromium.executablePath(),
  ].find((value) => value && existsSync(value));
  browser = await chromium.launch({
    headless: true,
    ...(executable ? { executablePath: executable } : {}),
  });
  const context = await browser.newContext({
      viewport: { width: 1365, height: 1000 },
      locale: "ja-JP",
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(server.origin + "/editor/");
  await page.getByRole("textbox", { name: "記事タイトル", exact: true }).waitFor();
  await page
    .getByRole("textbox", { name: "記事タイトル", exact: true })
    .fill("CMS 動作確認（合成データ）");
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await page
    .getByRole("textbox", { name: "段落を編集" })
    .fill("人間の下書きを、同じMarkdownとして保存します。");
  await page.getByRole("tab", { name: "MDXソース" }).click();
  const source = page.getByRole("textbox", { name: "MDXソース", exact: true });
  assert.match(await source.inputValue(), /人間の下書き/u);
  await source.fill((await source.inputValue()) + "\n## 変換後も本文を保持\n\n保持される内容。\n");
  await page.getByRole("tab", { name: "ブロック編集" }).click();
  assert.equal(
    await page.getByRole("textbox", { name: "見出し", exact: true }).inputValue(),
    "## 変換後も本文を保持",
  );
  await page.waitForFunction(() =>
    document.querySelector(".save-state")?.textContent?.includes("保存済み"),
  );
  await page.reload();
  await page.getByRole("textbox", { name: "記事タイトル", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "記事タイトル", exact: true }).inputValue(),
    "CMS 動作確認（合成データ）",
  );
  await page.screenshot({ path: resolve(out, "editor-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: resolve(out, "editor-mobile.png"), fullPage: true });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("textbox", { name: "記事タイトル", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "記事タイトル", exact: true }).inputValue(),
    "CMS 動作確認（合成データ）",
  );
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (
      await Promise.all(
        keys
          .filter((k) => k.startsWith("xpotato-editor-"))
          .map(async (k) => (await (await caches.open(k)).keys()).map((r) => r.url)),
      )
    ).flat();
  });
  assert(cached.length > 5);
  assert(cached.every((url) => new URL(url).pathname.startsWith("/editor/")));
  assert(cached.every((url) => !url.includes("editor-api")));
  await context.close();
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(out, "result.json"),
    JSON.stringify(
      {
        mode: "local-real-chromium",
        tests: [
          "MDX/block round trip",
          "IndexedDB reopen",
          "390px no overflow",
          "offline shell reopen",
          "no private API cached",
        ],
        result: "pass",
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Editor browser smoke PASS: desktop, mobile viewport, persisted source, offline shell.",
  );
} finally {
  await browser?.close();
  await server.close();
}
