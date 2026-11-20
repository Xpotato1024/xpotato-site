import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { transform } from "@astrojs/compiler-rs";
import ts from "typescript";
import * as runtime from "astro/runtime/server/index.js";
import { experimental_AstroContainer } from "astro/container";
import * as chartRendering from "@xpotato/portable-content/charts";
import * as contracts from "@xpotato/content-contracts/content";
import { fromHtml } from "hast-util-from-html";
import { visit } from "unist-util-visit";
import { previewDocument } from "../../../../editor/src/preview.js";

type Renderer = (props?: Record<string, unknown>, children?: string) => Promise<string>;
const renderers: Record<string, Renderer> = {};
const components = ["Comparison/Comparison", "Comparison/ComparisonCase", "LineChart/LineChart"];
beforeAll(async () => {
  const container = await experimental_AstroContainer.create();
  for (const path of components) {
    const source = await readFile(new URL(`./${path}.astro`, import.meta.url), "utf8");
    const compiled = transform(source, { filename: path + ".astro", resultScopedSlot: true });
    const code = ts.transpileModule(compiled.code, {
      compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const module = { exports: {} as { default: Parameters<typeof runtime.renderToString>[1] } };
    new Function("require", "exports", code)((id: string) => {
      if (id === "astro/runtime/server/index.js") {
        return { ...runtime, createMetadata: () => ({}) };
      }
      if (id === "@xpotato/portable-content/charts") {
        return chartRendering;
      }
      if (id === "@xpotato/content-contracts/content" || id === "@xpotato/content-contracts") {
        return contracts;
      }
      throw new Error(`Unexpected dependency: ${id}`);
    }, module.exports);
    renderers[path] = (props = {}, children = "") =>
      container.renderToString(module.exports.default, { props, slots: { default: children } });
  }
});
const draft = (body: string) =>
  [
    "---",
    'id: "11111111-1111-4111-8111-111111111111"',
    'title: "公開部品の合成確認"',
    'description: "実測ではない表示確認用の原稿"',
    'category: "software"',
    "tags: []",
    "draft: true",
    "---",
    body,
  ].join("\n");
function classCount(html: string, name: string, within?: string) {
  const root = fromHtml(html, { fragment: true });
  let count = 0;
  const match = (node: { properties: Record<string, unknown> }, value: string) =>
    Array.isArray(node.properties.className) && node.properties.className.includes(value);
  if (within) {
    visit(root, "element", (node) => {
      if (match(node, within)) {
        visit(node, "element", (child) => {
          if (match(child, name)) {
            count++;
          }
        });
      }
    });
  } else {
    visit(root, "element", (node) => {
      if (match(node, name)) {
        count++;
      }
    });
  }
  return count;
}

describe("public Astro comparison components", () => {
  it("renders four separately labeled condition bodies with nested text and figures", async () => {
    const cases = await Promise.all(
      ["条件A", "条件B", "条件C", "条件D"].map((label, index) =>
        renderers["Comparison/ComparisonCase"]!(
          { label },
          `<p>${label}の本文。</p><figure><img src="/fixture-${index}.png" alt="${label}の図"></figure>`,
        ),
      ),
    );
    const html = await renderers["Comparison/Comparison"]!({}, cases.join(""));
    expect(classCount(html, "article-comparison__case")).toBe(4);
    expect(classCount(html, "article-comparison__case-body")).toBe(4);
    expect(classCount(html, "article-comparison__legacy-labels")).toBe(0);
    for (const label of ["条件A", "条件B", "条件C", "条件D"]) {
      expect(html).toContain(`${label}の本文。`);
      expect(html).toContain(`alt="${label}の図"`);
    }
    expect(html).not.toMatch(/<script|astro-island| style=/u);
  });
  it("keeps legacy comparison labels and unpartitioned source without inventing columns", async () => {
    const children = "<p>既存の本文。</p><ul><li>既存の条件。</li></ul>";
    const html = await renderers["Comparison/Comparison"]!(
      { leftLabel: "変更前", rightLabel: "変更後" },
      children,
    );
    expect(classCount(html, "article-comparison__legacy-labels")).toBe(1);
    expect(classCount(html, "article-comparison__case")).toBe(0);
    expect(html).toContain(children);
    expect(html).toContain("変更前");
    expect(html).toContain("変更後");
  });
  it("escapes condition labels rather than inserting authored markup", async () => {
    const html = await renderers["Comparison/ComparisonCase"]!(
      { label: '<script>"unsafe"</script>' },
      "<p>本文。</p>",
    );
    expect(html).toContain("&lt;script&gt;");
    let scripts = 0;
    visit(fromHtml(html, { fragment: true }), "element", (node) => {
      if (node.tagName === "script") {
        scripts++;
      }
    });
    expect(scripts).toBe(0);
  });
});

describe("public Astro numeric charts and CMS preview", () => {
  const series = [
    {
      label: "条件A",
      points: [
        { x: 0, y: -1.123456789 },
        { x: 1, y: 0 },
        { x: 2, y: 3.5 },
      ],
    },
    {
      label: "条件B",
      points: [
        { x: 0, y: 2 },
        { x: 1, y: 4 },
        { x: 2, y: 3 },
      ],
    },
  ];
  const props = {
    title: "合成データの推移",
    description: "描画の確認用であり実測結果ではありません。",
    xLabel: "時間 (s)",
    yLabel: "変位 (mm)",
    series: JSON.stringify(series),
  };
  it.each(["line", "scatter", "analysis"])(
    "renders %s from the same static model in Astro and CMS without public runtime",
    async (kind) => {
      const input = { ...props, kind };
      const html = await renderers["LineChart/LineChart"]!(input);
      const source = `<LineChart title="${props.title}" description="${props.description}" xLabel="${props.xLabel}" yLabel="${props.yLabel}" kind="${kind}" series='${props.series}' />`;
      const preview = await previewDocument(draft(source));
      expect(preview.warnings).toEqual([]);
      expect(preview.html).toContain(html.trim());
      expect(classCount(html, "article-line-chart__point", "article-line-chart__plot")).toBe(6);
      expect(classCount(html, "article-line-chart__line", "article-line-chart__plot")).toBe(
        kind === "line" ? 2 : 0,
      );
      expect(classCount(html, "article-line-chart__legend-item")).toBe(2);
      expect(html).toContain("<td>-1.123456789</td>");
      expect(html).toContain("<td>0</td>");
      expect(html).toContain("時間 (s)");
      expect(html).toContain("変位 (mm)");
      expect(html).toContain(props.description);
      expect(html).not.toMatch(/<script|<canvas|<img|astro-island| style=|NaN|Infinity/u);
    },
  );
  it("shares fitted observations and an external curve without changing source measurements", async () => {
    const observed = {
      label: "測定A",
      fit: { method: "linear" },
      points: [
        { x: 2, y: 5 },
        { x: 0, y: 1 },
        { x: 1, y: 3 },
        { x: 1, y: 3 },
      ],
    };
    const curve = {
      label: "理論値",
      role: "curve",
      points: [
        { x: 0, y: 1 },
        { x: 2, y: 5 },
      ],
    };
    const input = { ...props, kind: "analysis", series: JSON.stringify([observed, curve]) };
    const html = await renderers["LineChart/LineChart"]!(input);
    const source = `<LineChart title="${props.title}" xLabel="${props.xLabel}" yLabel="${props.yLabel}" description="${props.description}" kind="analysis" series='${input.series}' />`;
    const preview = await previewDocument(draft(source));
    expect(preview.warnings).toEqual([]);
    expect(preview.html).toContain(html.trim());
    expect(classCount(html, "article-line-chart__point", "article-line-chart__plot")).toBe(4);
    expect(classCount(html, "article-line-chart__fit", "article-line-chart__plot")).toBe(1);
    expect(classCount(html, "article-line-chart__external-curve", "article-line-chart__plot")).toBe(
      1,
    );
    expect(classCount(html, "article-line-chart__fit-result")).toBe(1);
    expect(html).toContain("article-line-chart__math-line");
    expect(html).toContain("<math");
    expect(html).toContain("<dt>R²</dt><dd>1</dd>");
    expect(html).toContain("article-line-chart__fit");
    expect(html).not.toMatch(/<script|<canvas|astro-island|NaN|Infinity/u);
    expect(JSON.parse(input.series)[0].points).toEqual(observed.points);
  });
  it("shares formula curves, custom padding and cropped observations without changing source or adding runtime", async () => {
    const theory = {
      label: "理論",
      role: "formula",
      formula: { expression: "y = 0.5*x^2", xMin: 0, xMax: 4, samples: 21 },
    };
    const observed = {
      label: "測定",
      points: [
        { x: 0, y: 0.2 },
        { x: 1, y: 0.6 },
        { x: 2, y: 2.1 },
        { x: 3, y: 4.4 },
        { x: 4, y: 8.2 },
      ],
    };
    const input = {
      ...props,
      kind: "analysis",
      series: JSON.stringify([theory, observed]),
      xPadding: "10",
      yPadding: "20",
      xMin: "0",
      xMax: "3",
      yMin: "0",
    };
    const original = structuredClone(input);
    const html = await renderers["LineChart/LineChart"]!(input);
    const source = `<LineChart title="${props.title}" description="${props.description}" xLabel="${props.xLabel}" yLabel="${props.yLabel}" kind="analysis" xPadding="10" yPadding="20" xMin="0" xMax="3" yMin="0" series='${input.series}' />`;
    const preview = await previewDocument(draft(source));
    expect(preview.warnings).toEqual([]);
    expect(preview.html).toContain(html.trim());
    expect(classCount(html, "article-line-chart__formula", "article-line-chart__plot")).toBe(1);
    expect(classCount(html, "article-line-chart__point", "article-line-chart__plot")).toBe(4);
    expect(classCount(html, "article-line-chart__formula-result")).toBe(1);
    expect(classCount(html, "article-line-chart__range-note")).toBe(1);
    expect(html).toContain("<msup><mi>x</mi><mn>2</mn></msup>");
    expect(html).toContain("理論（理論式の計算値）");
    expect(html).toContain("<td>4</td><td>8</td>");
    expect(html).toContain("<td>4</td><td>8.2</td>");
    expect(html).toContain(">9.84</text>");
    expect(html).not.toMatch(/<script|<canvas|astro-island| style=|NaN|Infinity/u);
    expect(input).toEqual(original);
    expect(JSON.parse(input.series)).toEqual([theory, observed]);
    expect(JSON.parse(input.series)[0]).not.toHaveProperty("points");
  });
  it("renders one scatter observation and retains zero without fabricating a positive value", async () => {
    const html = await renderers["LineChart/LineChart"]!({
      ...props,
      kind: "scatter",
      series: JSON.stringify([{ label: "原点", points: [{ x: 0, y: 0 }] }]),
    });
    expect(classCount(html, "article-line-chart__point", "article-line-chart__plot")).toBe(1);
    expect(html).toContain("<td>0</td><td>0</td>");
    expect(html).not.toMatch(/NaN|Infinity/u);
  });
  it("escapes all text fields at the actual Astro boundary", async () => {
    const html = await renderers["LineChart/LineChart"]!({
      ...props,
      title: "<script>title</script>",
      description: "<img>説明",
      xLabel: "<b>軸 (s)</b>",
      series: JSON.stringify([
        {
          label: "<svg>系列</svg>",
          points: [
            { x: 0, y: 1 },
            { x: 1, y: 2 },
          ],
        },
      ]),
    });
    for (const text of ["&lt;script&gt;", "&lt;img&gt;", "&lt;b&gt;", "&lt;svg&gt;"]) {
      expect(html).toContain(text);
    }
    expect(html).not.toMatch(/<script|<img>|<b>/u);
  });
  it.each([
    { kind: "pie" },
    { series: "[]" },
    { series: '[{"label":"a","points":[{"x":0,"y":1},{"x":1,"y":1e13}]}]' },
    { kind: "line", series: '[{"label":"a","points":[{"x":1,"y":1},{"x":1,"y":2}]}]' },
  ])("rejects invalid chart data before producing public HTML: %j", async (invalid) => {
    await expect(renderers["LineChart/LineChart"]!({ ...props, ...invalid })).rejects.toThrow();
  });
});
