import { describe, expect, it } from "vitest";
import { lineChartGeometry, prepareLineChart, renderLineChart } from "./charts.js";
import { validatePortableMdx } from "./index.js";

const input = (series: unknown) => ({
  title: "合成データ",
  kind: "analysis",
  xLabel: "時間 (s)",
  yLabel: "値 (V)",
  series: JSON.stringify(series),
});

describe("static experimental chart rendering", () => {
  it("uses distinct tick offsets for large nearby values and keeps exact values in the data table", () => {
    const points = [
      { x: 1e9, y: 1e10 },
      { x: 1e9 + 4, y: 1e10 + 8 },
    ];
    const series = [{ label: "測定", points, fit: { method: "linear" as const } }];
    const geometry = lineChartGeometry(series);
    expect(geometry.xOffset).toBe(1e9);
    expect(geometry.yOffset).toBe(1e10);
    const html = renderLineChart(input(series));
    expect(html).toContain("横軸の目盛りは1000000000からの差です。");
    expect(html).toContain("<td>1000000004</td><td>10000000008</td>");
    expect(html).not.toMatch(/NaN|Infinity/u);
  });

  it("recomputes a fit after editing an observation and does not mutate the source", () => {
    const series = [
      {
        label: "測定",
        points: [
          { x: 0, y: 1 },
          { x: 1, y: 3 },
          { x: 2, y: 5 },
        ],
        fit: { method: "linear" },
      },
    ];
    const first = input(series);
    const result = prepareLineChart(first);
    expect(result.fits[0]?.rSquared).toBeCloseTo(1);
    series[0]!.points[1]!.y = 7;
    const edited = prepareLineChart(input(series));
    expect(edited.fits[0]?.rSquared).toBeLessThan(1);
    expect(edited.fits[0]?.coefficients).not.toEqual(result.fits[0]?.coefficients);
    expect(JSON.parse(first.series)[0].points[1].y).toBe(3);
  });

  it("checks numerical failures on the portable MDX authoring path as well as rendering", () => {
    const series = [
      {
        label: "過大な推定",
        points: [
          { x: 0, y: 1e12 },
          { x: 1, y: -1e12 },
          { x: 3, y: 1e12 },
        ],
        fit: { method: "quad" },
      },
    ];
    const props = input(series);
    expect(() => renderLineChart(props)).toThrow();
    const source = `<LineChart title="合成データ" kind="analysis" xLabel="X (s)" yLabel="Y (V)" series='${props.series}' />`;
    expect(validatePortableMdx(source).some((issue) => issue.startsWith("LineChart:"))).toBe(true);
  });

  it("does not invent fit metrics for constant data or for LOESS smoothing", () => {
    const points = Array.from({ length: 12 }, (_, x) => ({ x, y: 5 }));
    const linear = renderLineChart(input([{ label: "一定", points, fit: { method: "linear" } }]));
    expect(linear).toContain("算出できません（Yが一定）");
    const smooth = renderLineChart(
      input([{ label: "平滑化", points, fit: { method: "loess", bandwidth: 0.6 } }]),
    );
    expect(smooth).toContain("LOESS");
    expect(smooth).not.toContain("<dt>R²");
    expect(smooth).not.toContain("<dt>RMSE");
  });
});

describe("chart axis ranges", () => {
  const series = [
    {
      label: "測定",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 20 },
      ],
    },
  ];

  it("leaves five percent of the data span beyond both ends by default", () => {
    const plot = lineChartGeometry(series);
    expect(plot.xDomain).toEqual({ min: -0.5, max: 10.5 });
    expect(plot.yDomain).toEqual({ min: -1, max: 21 });
    expect(plot.series[0]!.points[0]!.cx).toBeGreaterThan(plot.left);
    expect(plot.series[0]!.points[1]!.cx).toBeLessThan(plot.width - plot.right);
    expect(plot.series[0]!.points[0]!.cy).toBeLessThan(plot.height - plot.bottom);
    expect(plot.series[0]!.points[1]!.cy).toBeGreaterThan(plot.top);
    expect(plot.cropped).toBe(false);
  });

  it("adjusts each axis independently and leaves a manually fixed end exact", () => {
    const plot = lineChartGeometry(series, [], {
      xMin: "0",
      xPadding: "10",
      yMax: "25",
      yPadding: "20",
    });
    expect(plot.xDomain).toEqual({ min: 0, max: 11 });
    expect(plot.yDomain).toEqual({ min: -4, max: 25 });
    const fixed = lineChartGeometry(series, [], {
      xMin: "-5",
      xMax: "25",
      xPadding: "100",
    });
    expect(fixed.xDomain).toEqual({ min: -5, max: 25 });
  });

  it("can remove automatic padding without changing the original points", () => {
    const before = JSON.stringify(series);
    const plot = lineChartGeometry(series, [], { xPadding: "0", yPadding: "0" });
    expect(plot.xDomain).toEqual({ min: 0, max: 10 });
    expect(plot.yDomain).toEqual({ min: 0, max: 20 });
    expect(plot.series[0]!.points[0]!.cx).toBe(plot.left);
    expect(plot.series[0]!.points[0]!.cy).toBe(plot.height - plot.bottom);
    expect(JSON.stringify(series)).toBe(before);
  });

  it.each([0, 12, -12, 1e-300, -1e-300, Number.MIN_VALUE, 1e12])(
    "keeps a constant value %s inside a finite, nonzero range",
    (value) => {
      const plot = lineChartGeometry([{ label: "一定", points: [{ x: value, y: value }] }]);
      expect(plot.xDomain.min).toBeLessThan(value);
      expect(plot.xDomain.max).toBeGreaterThan(value);
      expect(plot.series[0]!.points[0]!.cx).toBeGreaterThan(plot.left);
      expect(plot.series[0]!.points[0]!.cx).toBeLessThan(plot.width - plot.right);
      expect(
        plot.xTicks.every((tick) => Number.isFinite(tick.value) && Number.isFinite(tick.at)),
      ).toBe(true);
      expect(new Set(plot.xTicks.map((tick) => tick.value)).size).toBe(plot.xTicks.length);
    },
  );

  it("keeps nearby large values and subnormal intervals finite with distinct ticks", () => {
    const near = lineChartGeometry([
      {
        label: "近接",
        points: [
          { x: 1e12 - 0.0001220703125, y: 0 },
          { x: 1e12, y: 1 },
        ],
      },
    ]);
    expect(near.xDomain.min).toBeLessThan(1e12 - 0.0001220703125);
    expect(near.xDomain.max).toBeGreaterThan(1e12);
    expect(new Set(near.xTicks.map((tick) => tick.value)).size).toBe(near.xTicks.length);
    const tiny = lineChartGeometry(
      [
        {
          label: "微小",
          points: [
            { x: 0, y: 0 },
            { x: Number.MIN_VALUE, y: 1 },
          ],
        },
      ],
      [],
      { xPadding: "0" },
    );
    expect(tiny.xTicks.length).toBeGreaterThanOrEqual(2);
    expect(new Set(tiny.xTicks.map((tick) => tick.value)).size).toBe(tiny.xTicks.length);
    expect(tiny.series[0]!.points.map((point) => point.cx)).toEqual([
      tiny.left,
      tiny.width - tiny.right,
    ]);
  });

  it("uses an offset when rounding would otherwise give multiple ticks the same label", () => {
    const plot = lineChartGeometry([
      {
        label: "微小変化",
        points: [
          { x: 100, y: 0 },
          { x: 100.1, y: 1 },
        ],
      },
    ]);
    expect(plot.xOffset).toBe(100);
  });

  it("crops only the drawing while preserving all observations and fit results", () => {
    const data = [
      {
        label: "測定",
        points: [0, 1, 2, 3].map((x) => ({ x, y: 2 * x + 1 })),
        fit: { method: "linear" },
      },
    ];
    const automatic = prepareLineChart(input(data));
    const props = { ...input(data), xMin: "1", xMax: "2", yMin: "0", yMax: "7" };
    const cropped = prepareLineChart(props);
    expect(cropped.plot.cropped).toBe(true);
    expect(cropped.data).toEqual(automatic.data);
    expect(cropped.fits).toEqual(automatic.fits);
    const html = renderLineChart(props);
    expect(html).toContain('class="article-line-chart__drawing"');
    expect(html).toContain('overflow="hidden"');
    expect(html).not.toMatch(/\bid="|clip-path=/u);
    expect(html).toContain("表示範囲の外にある点や曲線");
    expect(html).toContain("近似には全ての測定点を使っています。");
    expect(html).toContain("<td>0</td><td>1</td>");
    expect(html).toContain("<td>3</td><td>7</td>");
    const drawing = html.match(/<svg class="article-line-chart__drawing"[^>]*>(.*?)<\/svg>/su)![1]!;
    expect(drawing.match(/class="article-line-chart__point"/gu)).toHaveLength(2);
    expect(renderLineChart(input(data))).not.toContain("article-line-chart__range-note");
  });

  it("clips crossing lines before creating SVG coordinates and never bridges an invisible excursion", () => {
    const plot = lineChartGeometry(
      [
        {
          label: "直線",
          points: [
            { x: -10, y: -10 },
            { x: 10, y: 10 },
          ],
        },
        {
          label: "範囲外",
          points: [
            { x: -10, y: 5 },
            { x: 10, y: 5 },
          ],
        },
        {
          label: "折返し",
          points: [
            { x: -2, y: 0 },
            { x: 0, y: 0 },
            { x: 2, y: 2 },
            { x: 0, y: 1 },
          ],
        },
      ],
      [],
      { xMin: "-1", xMax: "1", yMin: "-1", yMax: "1" },
    );
    expect(plot.series[0]!.path).toBe("M100.00 310.00 L602.00 26.00");
    expect(plot.series[1]!.path).toBe("");
    expect(plot.series[2]!.path.match(/M/gu)).toHaveLength(2);
  });

  it("validates a resolved automatic end on the portable MDX path", () => {
    const props = { ...input(series), xMin: "20" };
    expect(() => prepareLineChart(props)).toThrow(/横軸の最小値/u);
    const source = `<LineChart title="範囲" kind="analysis" xLabel="X" yLabel="Y" xMin="20" series='${props.series}' />`;
    expect(validatePortableMdx(source).some((issue) => issue.includes("横軸の最小値"))).toBe(true);
  });

  it.each([
    { xPadding: "-1" },
    { yPadding: "101" },
    { xMin: "NaN" },
    { yMax: "" },
    { xMin: "1e-999" },
    { xMin: "5", xMax: "4" },
    { yMin: "10", yMax: "10" },
  ])("rejects invalid axis settings without drawing an inferred range: %j", (settings) => {
    expect(() => prepareLineChart({ ...input(series), ...settings })).toThrow();
  });

  it("rejects a view too narrow to place the full dataset reliably", () => {
    expect(() => prepareLineChart({ ...input(series), xMin: "0", xMax: "1e-20" })).toThrow(
      /細かすぎ/u,
    );
  });
});

describe("theory formula rendering", () => {
  const theory = {
    label: "理論",
    role: "formula",
    formula: { expression: "x^2", xMin: 0, xMax: 2, samples: 21 },
  };

  it("draws a formula before observations exist and identifies its calculated values", () => {
    const props = input([theory]);
    const before = props.series;
    const prepared = prepareLineChart(props);
    expect(prepared.fits).toEqual([null]);
    expect(prepared.formulas[0]?.domain).toEqual([0, 2]);
    expect(prepared.data[0]!.points[0]).toEqual({ x: 0, y: 0 });
    expect(prepared.data[0]!.points.at(-1)).toEqual({ x: 2, y: 4 });
    const html = renderLineChart(props);
    expect(html).toContain('data-role="formula"');
    expect(html).toContain("article-line-chart__formula-result");
    expect(html).toContain("理論式・計算条件を見る");
    expect(html).toContain("y = x^2");
    expect(html).toContain("理論（理論式の計算値）");
    expect(html).not.toContain("article-line-chart__point");
    expect(html).not.toContain("<dt>R²");
    expect(props.series).toBe(before);
    expect(JSON.parse(props.series)[0]).not.toHaveProperty("points");
  });

  it("recomputes an edited formula without modifying the saved expression", () => {
    const props = input([theory]);
    const first = prepareLineChart(props);
    const edited = prepareLineChart(
      input([{ ...theory, formula: { ...theory.formula, expression: "3*x" } }]),
    );
    expect(first.data[0]!.points.at(-1)?.y).toBe(4);
    expect(edited.data[0]!.points.at(-1)?.y).toBe(6);
    expect(JSON.parse(props.series)[0].formula.expression).toBe("x^2");
  });

  it("distinguishes formulas, supplied curves and fitted measurements in one static chart", () => {
    const html = renderLineChart(
      input([
        { ...theory, label: "理論<&>" },
        {
          label: "測定",
          points: [
            { x: 0, y: 1 },
            { x: 2, y: 5 },
          ],
          fit: { method: "linear" },
        },
        {
          label: "解析結果",
          role: "curve",
          points: [
            { x: 0, y: 0 },
            { x: 2, y: 3 },
          ],
        },
      ]),
    );
    expect(html).toContain("理論&lt;&amp;&gt;（理論式）");
    expect(html).toContain("測定（測定値）");
    expect(html).toContain("解析結果（計算済み曲線）");
    expect(html).toContain("理論式・近似式・計算条件を見る");
    expect(html).toContain("article-line-chart__fit");
    expect(html).toContain("article-line-chart__external-curve");
    expect(html).toContain("<dt>R²");
  });

  it("rejects an invalid formula during portable authoring as well as rendering", () => {
    const props = input([{ ...theory, formula: { ...theory.formula, expression: "1/(x-1)" } }]);
    expect(() => prepareLineChart(props)).toThrow(/理論/u);
    const source = `<LineChart title="式" kind="analysis" xLabel="X" yLabel="Y" series='${props.series}' />`;
    expect(validatePortableMdx(source).some((issue) => issue.startsWith("LineChart:"))).toBe(true);
  });
});
