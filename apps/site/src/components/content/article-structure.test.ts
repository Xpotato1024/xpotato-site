import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const get = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

describe("shared article presentation contract", () => {
  it("loads editorial styles only on non-tool content routes", async () => {
    const base = await get("../../layouts/BaseLayout.astro");
    const layout = await get("../../layouts/ContentLayout.astro");
    expect(base).toContain('import "../styles/global.css"');
    expect(base).not.toContain('import "../styles/article-structure.css"');
    expect(layout).toContain('article-structure.css?url');
    expect(layout).toContain('collection === "tools" ? undefined : articleCssHref');
  });
  it("distinguishes headings, structured blocks, and narrow viewports", async () => {
    const css = await get("../../styles/article-structure.css");
    for (const selector of [".prose > h2", ".prose > h3", ".article-diagnostic", ".article-callout", ".article-steps", ".table-of-contents", "@media (max-width: 760px)"]) {
      expect(css).toContain(selector);
    }
    expect(css).toContain("var(--accent)");
    expect(css).toContain("[data-bt]");
  });
  it("preserves the existing heading font family, size and line-height", async () => {
    const css = await get("../../styles/article-structure.css");
    const headingRules = css.slice(css.indexOf(".prose > h2"), css.indexOf(".prose ul"));
    expect(headingRules).not.toMatch(/font-(?:family|size|weight)|line-height|letter-spacing/u);
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
