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
