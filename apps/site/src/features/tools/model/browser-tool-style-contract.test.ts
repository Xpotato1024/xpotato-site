import { expandedCss } from "../../../shared/styles/expanded-css-test-helper.js";
import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
it("prose descendant rules explicitly exclude the opt-in browser tool root", async () => {
  const css = expandedCss(
    (
      await Promise.all(
        ["global", "content", "code"].map((name) =>
          readFile(`apps/site/src/shared/styles/${name}.css`, "utf8"),
        ),
      )
    ).join("\n"),
  );
  let checks = 0;
  for (const m of css.matchAll(/([^{}]+)\{[^{}]*\}/gu)) {
    if (/\.prose\s+/u.test(m[1]!)) {
      expect(m[1]).toContain(":not(:where([data-bt], [data-bt] *))");
      checks++;
    }
  }
  expect(checks).toBeGreaterThan(30);
  expect(css).not.toMatch(/\.prose summary\s*\{/u);
});
it("embedding passes named theme values without styling private UI selectors", async () => {
  let css = await readFile("apps/site/src/features/tools/components/Demo.astro", "utf8");
  for (const key of [
    "font-family",
    "font-size",
    "line-height",
    "summary-font-size",
    "summary-font-weight",
    "help-font-size",
    "heading-font-size",
    "control-min-size",
  ])
    expect(css).toContain("--bt-" + key + ":");
  expect(css).not.toMatch(/\.bt-prime-factorizer\s+(?:summary|p|button)/u);
});
it("the selected manual tool stylesheet loads only with its rendered island", async () => {
  const base = "apps/site/src/features/tools/renderers/",
    styles = await readFile(base + "PrimeFactorizerStyles.astro", "utf8"),
    wrapper = await readFile("apps/site/src/features/tools/islands/PrimeFactorizer.tsx", "utf8");
  expect(wrapper).not.toMatch(/\.css/u);
  const dependency = JSON.parse(await readFile("apps/site/package.json", "utf8")).dependencies[
    "@xpotato-tool/prime-factorizer"
  ];
  expect(dependency).toMatch(
    /^file:\.\.\/\.\.\/vendor\/browser-tools\/prime-factorizer\/v[0-9]+-[0-9]+-[0-9]+$/u,
  );
  const selectedRelease = dependency.split("/").at(-1);
  expect(styles).toContain("prime-factorizer/" + selectedRelease + "/tool.css?url");
  expect(styles).toContain('data-tool-styles="prime-factorizer"');
  for (const name of ["Visible", "Load", "Idle", "Media"]) {
    const source = await readFile(base + "PrimeFactorizer" + name + ".astro", "utf8");
    expect(source.match(/<PrimeFactorizerStyles\s*\/>/gu)).toHaveLength(1);
  }
});

it("publishes independent boundary and disclosure spacing APIs without removing legacy themes", async () => {
  const { browserToolThemeProperties, browserToolSpacingProperties } =
    await import("../../../../../../packages/content-contracts/src/browser-tool.js");
  expect(browserToolThemeProperties).toEqual(
    expect.arrayContaining(["--bt-border", "--bt-border-control", "--bt-border-divider"]),
  );
  expect(browserToolSpacingProperties).toContain("--bt-summary-padding-block");
  const bridge = await readFile("apps/site/src/features/tools/components/Demo.astro", "utf8");
  for (const [tool, site] of [
    ["border", "border-tool"],
    ["border-control", "border-control"],
    ["border-divider", "border-divider"],
    ["summary-padding-block", "disclosure-padding-block"],
  ])
    expect(bridge).toContain(`--bt-${tool}: var(--${site})`);
  const template = await readFile("templates/browser-tool-sync/styles/tool.css", "utf8");
  expect(template).toMatch(/var\(--bt-border-control,\s*var\(--bt-border,\s*#736a7b\)\)/u);
  expect(template).toMatch(/var\(--bt-border-divider,\s*var\(--bt-border,\s*#d8d4dc\)\)/u);
  expect(template).toMatch(/padding-block:\s*var\(--bt-summary-padding-block,\s*0?\.5rem\)/u);
  expect(template).toMatch(
    /min-height:\s*max\(var\(--bt-control-min-size,\s*2\.75rem\),\s*44px\)/u,
  );
  expect(template).not.toMatch(/--bt-border-(?:control|divider)\s*:/u);
});
