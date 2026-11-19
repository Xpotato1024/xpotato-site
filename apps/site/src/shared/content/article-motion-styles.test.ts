import { expandedCss } from "../styles/expanded-css-test-helper.js";
import { readFile } from "node:fs/promises";
import { describe, it, expect } from "vitest";
const get = (p: string) => readFile(new URL(p, import.meta.url), "utf8");
describe("conditional article styles", () => {
  it("loads each article stylesheet independently and keeps motion CSS with its script", async () => {
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
      "hasLineChart",
      "hasComparison",
      "hasMediaCredits",
      "hasGallery",
      "hasDiagnostics",
      "codeCssHref",
      "articleMotionCssHref",
      "articleBarChartCssHref",
      "articleLineChartCssHref",
      "articleComparisonCssHref",
      "mediaCreditCssHref",
      "articleGalleryCssHref",
      "articleDiagnosticsCssHref",
      "seriesNavigation",
      "seriesCssHref",
      `return ${selection![1]};`,
    );
    for (let flags = 0; flags < 512; flags++) {
      const code = !!(flags & 1),
        motion = !!(flags & 2),
        chart = !!(flags & 4),
        credits = !!(flags & 8),
        series = !!(flags & 16),
        gallery = !!(flags & 32),
        diagnostics = !!(flags & 64),
        lineChart = !!(flags & 128),
        comparison = !!(flags & 256);
      const selected = select(
        code,
        motion,
        chart,
        lineChart,
        comparison,
        credits,
        gallery,
        diagnostics,
        "code",
        "motion",
        "chart",
        "line-chart",
        "comparison",
        "credits",
        "gallery",
        "diagnostics",
        series ? [{}] : [],
        "series",
      ) as string[];
      expect([...selected].sort()).toEqual(
        [
          ...(code ? ["code"] : []),
          ...(motion ? ["motion"] : []),
          ...(chart ? ["chart"] : []),
          ...(lineChart ? ["line-chart"] : []),
          ...(comparison ? ["comparison"] : []),
          ...(credits ? ["credits"] : []),
          ...(series ? ["series"] : []),
          ...(gallery ? ["gallery"] : []),
          ...(diagnostics ? ["diagnostics"] : []),
        ].sort(),
      );
    }
    expect(layout).toMatch(
      /hasAnimatedMedia\s*&&\s*\(?\s*<script\s+is:inline\s+src="\/scripts\/article-motion\.js"/u,
    );
  });
  it.each([
    ["LineChart", "article-line-chart", "articleLineChartCssHref", "article-line-chart.css"],
    ["Comparison", "article-comparison", "articleComparisonCssHref", "article-comparison.css"],
  ])(
    "selects %s CSS from the actual root class, not prose that mentions the module",
    async (name, className, href, file) => {
      const layout = await get("../layouts/ContentLayout.astro");
      expect(layout).toContain(`import ${href} from "../styles/${file}?url&no-inline";`);
      const condition = layout.match(
        new RegExp(`const has${name} = (\\/[^\\r\\n]+\\/u)\\.test\\(bodyHtml\\);`, "u"),
      );
      expect(condition).not.toBeNull();
      const selects = new Function("bodyHtml", `return ${condition![1]}.test(bodyHtml);`);
      expect(selects(`<figure class="${className}">本文</figure>`)).toBe(true);
      expect(selects(`<section class="other ${className} selected">本文</section>`)).toBe(true);
      expect(selects(`<p>${className}</p>`)).toBe(false);
      expect(selects(`<span class="${className}__title">部品の子だけ</span>`)).toBe(false);
      expect(selects("<p>通常の文章。</p>")).toBe(false);
    },
  );
  it("loads series navigation independently of the series directory styles", async () => {
    const layout = await get("../layouts/ContentLayout.astro"),
      navigation = await get("../../features/series/styles/series-navigation.css");
    expect(layout).toContain(
      'import seriesCssHref from "../../features/series/styles/series-navigation.css?url&no-inline";',
    );
    expect(navigation).toContain(".series-navigation");
    expect(navigation).not.toMatch(/\.series-(?:page|list|card|entries)\b|@import/u);
  });
  it("keeps ordinary figure CSS free of motion controls without removing caption styles or tool isolation", async () => {
    const modules = await get("../styles/article-modules.css"),
      motion = expandedCss(await get("../styles/article-motion.css"));
    expect(modules).not.toContain("article-motion");
    expect(modules).not.toContain("article-gallery");
    expect(modules).not.toContain("article-diagnostic");
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
