import { parse } from "@astrojs/compiler/sync";
import { readFileSync } from "node:fs";
import postcss from "postcss";
import { describe, expect, it } from "vitest";
import { expandedCss } from "../../../shared/styles/expanded-css-test-helper.js";
import { getSectionNavigation } from "../../../shared/lib/site-config.js";

interface Node {
  type: string;
  name?: string;
  value?: string;
  attributes?: { name: string; value: string }[];
  children?: Node[];
}
const source = (path: string) => readFileSync("apps/site/src/" + path, "utf8");
const nodes = (node: Node): Node[] => [node, ...(node.children ?? []).flatMap(nodes)];
const attr = (node: Node, name: string) =>
  node.attributes?.find((item) => item.name === name)?.value;
const hasClass = (node: Node, name: string) =>
  (attr(node, "class") ?? "").split(/\s+/u).includes(name);
const text = (node: Node): string =>
  node.type === "text" ? (node.value ?? "") : (node.children ?? []).map(text).join("");
const markup = (path: string) => nodes(parse(source(path), {}).ast as Node);
const home = markup("pages/index.astro");
const homeCss = source("features/home/styles.css");
const tokensCss = readFileSync("packages/design-system/src/tokens.css", "utf8");
const sharedCss = expandedCss(
  readFileSync("packages/design-system/src/tokens.css", "utf8") +
    "\n" +
    source("shared/styles/global.css"),
);
const rules = (css: string, selector: string) => {
  const result: Record<string, string>[] = [];
  postcss.parse(css).walkRules((rule) => {
    if (rule.selectors.includes(selector)) {
      const declarations: Record<string, string> = {};
      rule.walkDecls((declaration) => {
        declarations[declaration.prop] = declaration.value;
      });
      result.push(declarations);
    }
  });
  return result;
};
const property = (css: string, name: string) => {
  const values: string[] = [];
  postcss.parse(css).walkDecls(name, (declaration) => {
    values.push(declaration.value.replace(/\s+/gu, " "));
  });
  return values;
};

describe("home introduction and internal link presentation", () => {
  it("keeps a static English title and the Japanese catch without hero controls", () => {
    const hero = home.find((node) => node.name === "section" && hasClass(node, "intro"))!;
    expect(hero).toBeDefined();
    const children = nodes(hero);
    const title = children.find((node) => hasClass(node, "home-title-static"))!;
    expect(attr(title, "lang")).toBe("en");
    expect(
      nodes(title)
        .filter((node) => node.name === "span")
        .map((node) => text(node).trim()),
    ).toEqual(["Think.", "Build.", "Run."]);
    expect(text(children.find((node) => hasClass(node, "home-catch"))!).trim()).toBe(
      "ものづくり、プログラミング、日々の試行錯誤",
    );
    expect(children.some((node) => ["a", "button"].includes(node.name ?? ""))).toBe(false);
    for (const name of ["home-brand", "home-title-japanese", "home-introduction", "home-contact"]) {
      expect(home.some((node) => hasClass(node, name))).toBe(false);
    }
    expect(children.some((node) => attr(node, "aria-live") !== undefined)).toBe(false);
    const order = [
      home.findIndex((node) => node.name === "UpdateActivity"),
      ...["records-heading", "projects-heading", "tools-heading"].map((id) =>
        home.findIndex((node) => attr(node, "id") === id),
      ),
    ];
    expect(order.every((position) => position >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    const layout = home.find((node) => node.name === "BaseLayout")!;
    expect(attr(layout, "image")).toBe("workshopAsset?.socialImage");
    expect(attr(layout, "homeHeader")).toBeDefined();
    expect(attr(layout, "description")).toBe(
      "Xpotatoの技術とものづくりの記録。ロボティクスやプログラミングの試行錯誤、制作物、教育資料、ブラウザで使える小さなツールをまとめています。",
    );
  });

  it("limits photo fusion to the homepage and keeps header motion values explicit", () => {
    expect(homeCss).not.toMatch(/@keyframes home-title|button-glass|data-menu-surface/u);
    expect(homeCss).toContain(".home-header-layout .header-band");
    expect(homeCss).toContain('data-home-header-state="top"');
    expect(homeCss).not.toContain(".home-header-layout .header-band::before {");
    expect(property(homeCss, "--header-glass-motion")).toContain("0.7s ease-in-out");
    expect(property(homeCss, "--header-ink-motion")).toContain("0.35s ease-in-out 0.175s");
    const header = markup("shared/layouts/BaseLayout.astro").find(
      (node) => node.name === "SiteHeader",
    )!;
    expect(attr(header, "homeHeader")).toBe("Astro.props.homeHeader === true");
    expect(source("shared/shell/SiteHeader.astro")).toMatch(/homeHeader\s*&&\s*\(?\s*<script/u);
    expect(source("shared/shell/SiteFooter.astro")).not.toContain("reduce-home-motion");
  });

  it("shares one header/menu material plane and retains fallback backgrounds", () => {
    expect(sharedCss).not.toContain("home-header-layout");
    const planes = rules(sharedCss, ".header-band::before");
    expect(planes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ background: "#faf9f7", "pointer-events": "none" }),
        expect.objectContaining({
          background: "#faf9f7c7",
          "backdrop-filter": "blur(18px) saturate(145%)",
        }),
      ]),
    );
    expect(
      planes.some((rule) =>
        Object.values(rule).some((value) => value.includes("--site-glass-height")),
      ),
    ).toBe(true);
    expect(rules(sharedCss, ":is(.mobile-menu-panel, .mobile-menu-fallback nav)")).toContainEqual(
      expect.objectContaining({ background: "#faf9f7" }),
    );
    expect(
      rules(
        sharedCss,
        '.header-band[data-menu-surface="shared"] :is(.mobile-menu-panel, .mobile-menu-fallback nav)',
      ),
    ).toContainEqual(
      expect.objectContaining({
        background: "transparent",
        "border-color": "transparent",
        "box-shadow": "none",
        "backdrop-filter": "none",
        inset: "var(--site-header-bottom) 0 auto",
      }),
    );
  });

  it("has no delayed label fade and disables transitions for reduced motion", () => {
    expect(property(sharedCss, "transition")).toContain(
      "opacity 0.2s, display 0.2s allow-discrete, overlay 0.2s allow-discrete",
    );
    expect(property(sharedCss, "transition")).not.toContain("opacity 0.2s ease 0.35s");
    expect(sharedCss).not.toMatch(/data-menu-surface[^{}]+> ul/u);
    const reduced: string[] = [];
    postcss.parse(sharedCss).walkAtRules("media", (rule) => {
      if (rule.params === "(prefers-reduced-motion: reduce)") {
        rule.walkDecls("transition", (declaration) => {
          reduced.push(declaration.value + (declaration.important ? " !important" : ""));
        });
      }
    });
    expect(reduced).toContain("none !important");
    expect(property(sharedCss, "transition-duration")).not.toContain("0.01ms");
  });

  it("keeps about and contact in both shared navigation locations", () => {
    for (const location of ["header", "footer"] as const) {
      const routes = getSectionNavigation(location).map((item) => item.href);
      expect(routes).toEqual(expect.arrayContaining(["/about/", "/contact/"]));
    }
    expect(source("shared/shell/SiteFooter.astro")).toMatch(
      /getSectionNavigation\(["']footer["']\)/u,
    );
    expect(source("shared/shell/SiteHeader.astro")).toMatch(
      /getSectionNavigation\(["']header["']\)/u,
    );
    expect(source("pages/index.astro")).not.toContain("考えたことを、つくって確かめる。");
  });

  it("presents tools as linked rows, not enclosing cards, with native focus and arrows", () => {
    const row = home.find((node) => hasClass(node, "home-tool-row"))!;
    expect(row.name).toBe("a");
    expect(attr(row, "href")).toBe("item.route");
    const children = nodes(row);
    expect(children.some((node) => node.name === "HomeNewLabel")).toBe(true);
    expect(
      children.some((node) => node.name === "h3" && hasClass(node, "content-item-title")),
    ).toBe(true);
    const arrow = children.find((node) => hasClass(node, "home-tool-arrow"))!;
    expect(attr(arrow, "aria-hidden")).toBe("true");
    expect(text(arrow).trim()).toBe("→");
    expect(home.some((node) => hasClass(node, "home-tool-card"))).toBe(false);
    expect(homeCss).not.toContain("home-tool-card");
    expect(rules(homeCss, ".home-tool-list > li + li")).toContainEqual({
      "border-top": "1px solid var(--border-divider)",
    });
    const style = rules(homeCss, ".home-tool-row")[0]!;
    expect(style).toMatchObject({ display: "block", "min-height": "var(--control-min-size)" });
    expect(Object.keys(style).some((key) => /border|background|box-shadow/u.test(key))).toBe(false);
    expect(rules(homeCss, ".home-tool-row:focus-visible").length).toBeGreaterThan(0);
  });

  it("derives quiet data colors from brand tokens and does not override the shared title typeface", () => {
    expect(property(sharedCss, "--brand-rgb")).toContain("116, 83, 153");
    expect(property(sharedCss, "--accent")).toContain("var(--color-accent)");
    for (const [level, alpha] of [
      [0, 0.08],
      [1, 0.35],
      [2, 0.6],
      [3, 0.85],
    ]) {
      expect(property(tokensCss, "--color-activity-" + level)).toContain(
        "rgba(var(--brand-rgb), " + alpha + ")",
      );
      expect(homeCss).toContain("var(--color-activity-" + level + ")");
    }
    expect(property(tokensCss, "--color-activity-prelaunch")).toContain(
      "rgba(var(--brand-rgb), 0.3)",
    );
    expect(property(tokensCss, "--color-label-static")).toContain("rgba(var(--brand-rgb), 0.9)");
    expect(property(homeCss, "--font-meta")).toContain("var(--font-body)");
    expect(homeCss).not.toContain("--activity-level-");
    expect(rules(homeCss, ".home .section-heading")).toContainEqual(
      expect.objectContaining({ display: "flex", "flex-wrap": "wrap" }),
    );
    expect(rules(homeCss, ".home .section-heading h2")).toContainEqual(
      expect.objectContaining({ flex: "1 1 max-content", "min-width": "0" }),
    );
    for (const selector of [".project-slide h3", ".home-update-title", ".home-tool-row h3"]) {
      expect(rules(homeCss, selector).length).toBeGreaterThan(0);
      for (const rule of rules(homeCss, selector)) {
        expect(Object.keys(rule).some((key) => /^font(?:-|$)/u.test(key))).toBe(false);
      }
    }
    expect(property(tokensCss, "--text-content-item")).toContain("1.125rem");
    expect(property(tokensCss, "--text-content-item--line-height")).toContain("1.5");
    expect(property(tokensCss, "--text-content-item--font-weight")).toContain("400");
    expect(home.some((node) => attr(node, "titleRole") === "content-item")).toBe(true);
  });

  it("keeps internal arrows decorative and retains external-link indicators", () => {
    for (const file of [
      "features/home/components/ProjectCarousel.astro",
      "features/discovery/components/ArticleCard.astro",
      "features/discovery/components/ArchivePage.astro",
      "pages/projects/index.astro",
      "pages/tools/index.astro",
    ]) {
      const value = source(file);
      expect(value).not.toContain("↗");
      expect(value).toContain("→");
      expect(markup(file).some((node) => attr(node, "aria-hidden") === "true")).toBe(true);
    }
    expect(source("shared/shell/SocialLinks.astro")).toContain("↗");
    expect(source("pages/projects/[...slug].astro")).toContain("↗");
  });
});
