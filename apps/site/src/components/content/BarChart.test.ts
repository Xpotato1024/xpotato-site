import { beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { transform } from "@astrojs/compiler-rs";
import ts from "typescript";
import * as runtime from "astro/runtime/server/index.js";
import { experimental_AstroContainer } from "astro/container";
import { barChartModulePropsSchema, barChartRowsSchema } from "@xpotato/content-contracts";
import { validatePortableMdx } from "@xpotato/portable-content";

let render: (props: Record<string, unknown>) => Promise<string>;
const rows = [{ label: "OFF・20秒", value: 8930 }, { label: "ON・20秒", value: 4790, note: "描画あり", tone: "muted" }, { label: "OFF・2秒", value: 1060 }];
const base = { title: "RTF比較", unit: "倍", max: "9000", rows: JSON.stringify(rows) };
const mdx = (props = base) => `<BarChart title='${props.title}' unit='${props.unit}' max='${props.max}' rows='${props.rows}' />`;
beforeAll(async () => {
  const source = await readFile(new URL("./BarChart.astro", import.meta.url), "utf8");
  const compiled = transform(source, { filename: "BarChart.astro", resultScopedSlot: true });
  const code = ts.transpileModule(compiled.code, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} as { default: Parameters<typeof runtime.renderToString>[1] } };
  const require = (id: string) => {
    if (id === "astro/runtime/server/index.js") return { ...runtime, createMetadata: () => ({}) };
    if (id === "@xpotato/content-contracts") return { barChartModulePropsSchema, barChartRowsSchema };
    throw new Error(`Unexpected dependency: ${id}`);
  };
  new Function("require", "exports", code)(require, module.exports);
  const container = await experimental_AstroContainer.create();
  render = props => container.renderToString(module.exports.default, { props });
});

describe("native BarChart", () => {
  it("accepts portable literal data without expressions or child markup", () => {
    expect(validatePortableMdx(mdx())).toEqual([]);
    expect(validatePortableMdx(mdx().replace('max=\'9000\'', 'max={9000}')).join(" ")).toContain("expressions are not portable");
    expect(validatePortableMdx(mdx().replace(" />", ">hidden content</BarChart>")).join(" ")).toContain("does not accept children");
  });
  it("renders visible exact values, a common zero scale and no runtime or raster", async () => {
    const html = await render(base);
    for (const value of ["8,930", "4,790", "1,060", "9,000", "4,500", "描画あり"]) expect(html).toContain(value);
    for (const row of rows) expect(html).toContain(`width:${row.value / 9000 * 100}%`);
    expect(html).toContain('<dl class="article-bar-chart__rows">');
    expect(html).not.toMatch(/<script|<img|<canvas|astro-island|role="img"/u);
    const zero = await render({ ...base, rows: JSON.stringify([{ label: "zero", value: 0 }]) });
    expect(zero).toContain("width:0%");
  });
  it.each([
    { max: "0" }, { max: "Infinity" }, { max: "-1" }, { rows: "not json" }, { rows: "[]" },
    { rows: '[{"label":"a","value":-1}]' }, { rows: '[{"label":"a","value":9001}]' },
    { rows: '[{"label":"a","value":"12"}]' }, { rows: '[{"label":"a","value":1,"tone":"red"}]' },
  ])("rejects misleading or invalid data at both boundaries: %j", async invalid => {
    const props = { ...base, ...invalid };
    expect(validatePortableMdx(mdx(props)).length).toBeGreaterThan(0);
    await expect(render(props)).rejects.toThrow();
  });
  it("escapes author text and selects module CSS with mobile fallback", async () => {
    const html = await render({ ...base, title: "<script>bad</script>", rows: JSON.stringify([{ label: "<em>x</em>", value: 1, note: "<img>" }]) });
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toMatch(/<script|<em>|<img>/u);
    const layout = await readFile(new URL("../../layouts/ContentLayout.astro", import.meta.url), "utf8");
    const selection = layout.match(/const hasBarChart = (\/[^\r\n]+\/u)\.test\(bodyHtml\);/u);
    expect(selection).not.toBeNull();
    expect(layout).toContain("...(hasBarChart ? [articleBarChartCssHref] : [])");
    expect(new Function("bodyHtml", `return ${selection![1]}.test(bodyHtml);`)("<p>No chart</p>")).toBe(false);
    expect(new Function("bodyHtml", `return ${selection![1]}.test(bodyHtml);`)(html)).toBe(true);
    const css = await readFile(new URL("../../styles/article-bar-chart.css", import.meta.url), "utf8");
    expect(css).toContain(".prose .article-bar-chart__row& { grid-template-columns:minmax(0,1fr)");
    expect(css).not.toMatch(/article-bar-chart__bar[^}]*min-width/u);
  });
});
