import { expandedCss } from "../styles/expanded-css-test-helper.js";
import { readFile } from "node:fs/promises";
import { describe, it, expect } from "vitest";
const get = (p: string) => readFile(new URL(p, import.meta.url), "utf8");
describe("conditional article motion styles", () => {
  it("loads motion CSS with the same rendered-body condition as its script, alongside independent code CSS", async () => {
    const layout = await get("../layouts/ContentLayout.astro");
    expect(layout).toContain('const hasAnimatedMedia = bodyHtml.includes("data-article-motion");');
    expect(layout).toContain(
      'import articleMotionCssHref from "../styles/article-motion.css?url&no-inline";',
    );
    const selection = layout.match(/pageCssHrefs=\{(\[[\s\S]*?\])\}\s+articleCssHref=/u);
    expect(selection).not.toBeNull();
    const select = new Function(
      "hasCodeBlocks",
      "hasAnimatedMedia",
      "hasBarChart",
      "hasMediaCredits",
      "codeCssHref",
      "articleMotionCssHref",
      "articleBarChartCssHref",
      "mediaCreditCssHref",
      "seriesNavigation",
      "seriesCssHref",
      `return ${selection![1]};`,
    );
    for (let flags = 0; flags < 32; flags++) {
      const code = !!(flags & 1),
        motion = !!(flags & 2),
        chart = !!(flags & 4),
        credits = !!(flags & 8),
        series = !!(flags & 16);
      const selected = select(
        code,
        motion,
        chart,
        credits,
        "code",
        "motion",
        "chart",
        "credits",
        series ? [{}] : [],
        "series",
      ) as string[];
      expect([...selected].sort()).toEqual(
        [
          ...(code ? ["code"] : []),
          ...(motion ? ["motion"] : []),
          ...(chart ? ["chart"] : []),
          ...(credits ? ["credits"] : []),
          ...(series ? ["series"] : []),
        ].sort(),
      );
    }
    expect(layout).toMatch(
      /hasAnimatedMedia\s*&&\s*\(?\s*<script\s+is:inline\s+src="\/scripts\/article-motion\.js"/u,
    );
  });
  it("keeps ordinary figure CSS free of motion controls without removing caption styles or tool isolation", async () => {
    const modules = await get("../styles/article-modules.css"),
      motion = expandedCss(await get("../styles/article-motion.css"));
    expect(modules).not.toContain("article-motion");
    expect(modules).toMatch(/\.article-figure\s*>\s*figcaption/u);
    expect(motion).toContain(".article-motion-toggle");
    expect(motion).toMatch(/grid-column:\s*1 \/ -1;\s*grid-row:\s*1;/u);
    for (const selector of motion.matchAll(/[.]prose[^{}]+[{]/gu))
      expect(selector[0]).toContain("[data-bt]");
  });
  it("exercises the extracted stylesheet in the shared-renderer browser regression", async () => {
    const fixture = await get("../../../../../ops/qa/article-motion-layout.mjs");
    expect(fixture).toMatch(/["']article-modules\.css["']\s*,\s*["']article-motion\.css["']/u);
  });
});
