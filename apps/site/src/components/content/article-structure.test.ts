import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const get = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

describe("shared article presentation contract", () => {
  it("imports shared editorial styles after the global token sheet", async () => {
    const layout = await get("../../layouts/BaseLayout.astro");
    expect(layout.indexOf('import "../styles/global.css"')).toBeLessThan(layout.indexOf('import "../styles/article-structure.css"'));
  });
  it("distinguishes headings, structured blocks, and narrow viewports", async () => {
    const css = await get("../../styles/article-structure.css");
    for (const selector of [".prose > h2", ".prose > h3", ".article-diagnostic", ".article-callout", ".article-steps", ".table-of-contents", "@media (max-width: 760px)"]) {
      expect(css).toContain(selector);
    }
    expect(css).toContain("var(--accent)");
    expect(css).toContain("[data-bt]");
  });
  it("keeps SVG decorations nonverbal and diagnostic HTML semantic", async () => {
    const glyph = await get("./ArticleIcon.astro");
    const list = await get("./DiagnosticList.astro");
    const item = await get("./DiagnosticItem.astro");
    expect(glyph).toContain('aria-hidden="true"');
    expect(list).toContain("<dl ");
    expect(item).toContain("<dt ");
    expect(item).toContain("<dd ");
    expect(item).toContain("まず確認");
  });
});
