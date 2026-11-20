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

  it("retains the actionable model error when a formula series is also supported", () => {
    const result = lineChartModulePropsSchema.safeParse(
      chart([
        {
          label: "測定",
          points: [
            { x: 0, y: 1 },
            { x: 1, y: 2 },
          ],
          fit: { method: "log" },
        },
      ]),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toContain("対数近似はX");
    }
  });
});

describe("theory formulas and editable chart axes", () => {
  const theory = {
    label: "自由落下の理論値",
    role: "formula",
    formula: { expression: "0.5*9.81*x^2", xMin: 0, xMax: 3 },
  };

  it.each(["line", "scatter", "analysis"])(
    "keeps a formula as source without requiring measurements in %s mode",
    (kind) => {
      const source = chart([theory], kind);
      expect(lineChartModulePropsSchema.parse(source)).toEqual(source);
      expect(lineChartSeriesSchema.parse([theory])).toEqual([theory]);
    },
  );

  it("counts formula, measured and imported curve series against the same limit", () => {
    const mixed = [theory, { label: "測定", points }, { label: "外部計算", role: "curve", points }];
    expect(lineChartSeriesSchema.parse(mixed)).toEqual(mixed);
    expect(lineChartSeriesSchema.safeParse([...mixed, ...mixed]).success).toBe(true);
    expect(lineChartSeriesSchema.safeParse([...mixed, ...mixed, theory]).success).toBe(false);
  });

  it.each([
    { points },
    { fit: { method: "linear" } },
    { formula: { expression: "x", xMin: 1, xMax: 1 } },
    { formula: { expression: "x", xMin: 2, xMax: 1 } },
    { formula: { expression: "", xMin: 0, xMax: 1 } },
    { formula: { expression: "x".repeat(501), xMin: 0, xMax: 1 } },
    { formula: { expression: "x", xMin: 0, xMax: 1, samples: 20 } },
    { formula: { expression: "x", xMin: 0, xMax: 1, samples: 1002 } },
    { formula: { expression: "x", xMin: 0, xMax: 1, samples: 100.5 } },
    { formula: { expression: "x", xMin: "0", xMax: 1 } },
    { formula: { expression: "x", xMin: 0, xMax: 1e13 } },
    { formula: { expression: "x", xMin: 0, xMax: 1, transform: "custom" } },
  ])(
    "rejects ambiguous or invalid formula source instead of retaining cached points: %j",
    (patch) => {
      expect(lineChartModulePropsSchema.safeParse(chart([{ ...theory, ...patch }])).success).toBe(
        false,
      );
    },
  );

  it("preserves independent fixed bounds and automatic padding as portable attributes", () => {
    const source = {
      ...chart([theory]),
      xMin: "0",
      yMax: "5e1",
      xPadding: "0",
      yPadding: "12.5",
    };
    expect(lineChartModulePropsSchema.parse(source)).toEqual(source);
  });

  it.each([
    { xMin: "0", xMax: "0" },
    { yMin: "2", yMax: "1" },
    { xMin: "1e-999" },
    { xMax: "1e13" },
    { yMin: "NaN" },
    { yMax: "Infinity" },
    { xMin: "0x10" },
    { xMin: "" },
    { yMax: "12 mm" },
    { xPadding: "-1" },
    { yPadding: "100.1" },
    { xPadding: 5 },
  ])("rejects invalid axis settings without normalizing them into zero: %j", (patch) => {
    expect(lineChartModulePropsSchema.safeParse({ ...chart([theory]), ...patch }).success).toBe(
      false,
    );
  });
});

describe("analysis visibility contract", () => {
  const series = [
    {
      label: "測定値",
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    },
  ];
  for (const analysisDisplay of ["concise", "detailed", "hidden"] as const) {
    it(`accepts ${analysisDisplay} as a portable display setting`, () => {
      const source = { ...chart(series), analysisDisplay };
      expect(lineChartModulePropsSchema.parse(source)).toEqual(source);
    });
  }
  it("rejects unknown and non-string visibility settings", () => {
    for (const analysisDisplay of ["expanded", false, 0]) {
      expect(
        lineChartModulePropsSchema.safeParse({ ...chart(series), analysisDisplay }).success,
      ).toBe(false);
    }
  });
});
