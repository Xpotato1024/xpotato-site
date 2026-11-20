import { describe, expect, it } from "vitest";
import { lineChartModulePropsSchema, lineChartSeriesSchema } from "./content.js";

const points = [
  { x: 1, y: 2 },
  { x: 2, y: 4 },
  { x: 3, y: 8 },
  { x: 4, y: 16 },
];
const chart = (series: unknown, kind = "analysis") => ({
  title: "合成データ",
  xLabel: "時間 (s)",
  yLabel: "変位 (mm)",
  kind,
  series: JSON.stringify(series),
});

describe("experimental chart source contract", () => {
  it.each(["linear", "quad", "poly", "exp", "log", "pow", "loess"])(
    "retains the %s method and the original observations",
    (method) => {
      const series = [{ label: "観測", points, fit: { method } }];
      const parsed = lineChartModulePropsSchema.parse(chart(series));
      expect(JSON.parse(parsed.series)).toEqual(series);
    },
  );

  it("allows repeated, unsorted measurements with a fit and never turns them into curve samples", () => {
    const series = [
      { label: "反復測定", points: [points[2], points[0], points[2]], fit: { method: "linear" } },
    ];
    expect(lineChartModulePropsSchema.parse(chart(series)).series).toBe(JSON.stringify(series));
    expect(lineChartModulePropsSchema.safeParse(chart(series, "line")).success).toBe(true);
    expect(
      lineChartModulePropsSchema.safeParse(chart([{ ...series[0], fit: undefined }], "line"))
        .success,
    ).toBe(false);
  });

  it.each([
    { fit: { method: "custom", formula: "fetch('https://example.com')" } },
    { fit: { method: "poly", degree: 9 } },
    { fit: { method: "linear", bandwidth: 0.3 } },
    { fit: { method: "loess", bandwidth: 0 } },
    { fit: { method: "loess", bandwidth: 1.1 } },
    { fit: { method: "linear" }, role: "curve" },
    {
      fit: { method: "log" },
      points: [
        { x: 0, y: 1 },
        { x: 1, y: 2 },
      ],
    },
    {
      fit: { method: "exp" },
      points: [
        { x: 1, y: 0 },
        { x: 2, y: 3 },
      ],
    },
    {
      fit: { method: "pow" },
      points: [
        { x: 1, y: -1 },
        { x: 2, y: 3 },
      ],
    },
    { fit: { method: "quad" }, points: [points[0], points[1], points[1]] },
    { fit: { method: "poly" }, points: points.slice(0, 3) },
    { fit: { method: "loess" }, points: [points[0], points[1], points[2], points[2]] },
    { role: "curve", points: [points[1], points[0]] },
  ])("rejects incompatible settings instead of dropping measurements: %j", (patch) => {
    expect(
      lineChartModulePropsSchema.safeParse(chart([{ label: "観測", points, ...patch }])).success,
    ).toBe(false);
  });

  it("allows precomputed curves without inferring any fitted model", () => {
    const series = [{ label: "理論曲線", role: "curve", points }];
    expect(lineChartSeriesSchema.parse(series)).toEqual(series);
  });
});
