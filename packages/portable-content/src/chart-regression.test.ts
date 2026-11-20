import { describe, expect, it } from "vitest";
import { fitChartSeries, type ChartFit } from "./chart-regression.js";

const data = (xs: readonly number[], fn: (x: number) => number) => xs.map((x) => ({ x, y: fn(x) }));
const sequence = (count: number, start = 0) =>
  Array.from({ length: count }, (_, index) => start + index);
const unsafeFit = (fit: Record<string, unknown>) => fit as unknown as ChartFit;

describe("chart regression", () => {
  it("fits every observation without changing input and draws only within its domain", () => {
    const points = Object.freeze(
      data([5, 0, 2, 4, 1, 3], (x) => 1 + 2 * x).map((point) => Object.freeze(point)),
    );
    const result = fitChartSeries(points, { method: "linear" });
    expect(result.sampleCount).toBe(6);
    expect(result.domain).toEqual([0, 5]);
    expect(result.points).toHaveLength(201);
    expect(result.points[0]).toEqual({ x: 0, y: 1 });
    expect(result.points.at(-1)).toEqual({ x: 5, y: 11 });
    expect(result.points.every((point) => point.x >= 0 && point.x <= 5)).toBe(true);
    expect(points.map((point) => point.x)).toEqual([5, 0, 2, 4, 1, 3]);
    expect(result.normalization).toEqual({ transform: "linear", offset: 2.5, scale: 5 });
    expect(result.coefficients).toEqual([6, 10]);
    expect(result.rSquared).toBe(1);
    expect(result.rmse).toBe(0);
    expect(result.equation).toContain("z = (x − 2.5) / 5");
  });

  it.each([
    ["quad", (x: number) => 3 - 2 * x + 0.5 * x ** 2],
    ["poly", (x: number) => 1 + 0.2 * x - 0.3 * x ** 2 + 0.1 * x ** 3],
    ["exp", (x: number) => 2 * Math.exp(0.15 * x)],
    ["log", (x: number) => 2 + 3 * Math.log(x)],
    ["pow", (x: number) => 2 * x ** 1.4],
  ] as const)("reproduces a known %s model", (method, fn) => {
    const result = fitChartSeries(data(sequence(8, 1), fn), { method });
    expect(result.rSquared).toBeCloseTo(1, 12);
    expect(result.rmse).toBeLessThan(1e-11);
    expect(result.points.length).toBeLessThanOrEqual(1001);
    for (const point of result.points) {
      expect(point.y).toBeCloseTo(fn(point.x), 9);
    }
    expect(result.equation).toContain("z =");
  });

  it("reports polynomial coefficients in the documented normalized coordinate", () => {
    const quadratic = fitChartSeries(
      data(sequence(7, -3), (x) => 2 - 3 * x + 4 * x ** 2),
      { method: "quad" },
    );
    expect(quadratic.normalization).toEqual({ transform: "linear", offset: 0, scale: 6 });
    quadratic.coefficients!.forEach((value, index) =>
      expect(value).toBeCloseTo([2, -18, 144][index]!, 9),
    );
    const cubic = fitChartSeries(
      data(sequence(5, -2), (x) => 1 + 2 * x - 3 * x ** 2 + 4 * x ** 3),
      { method: "poly", degree: 3 },
    );
    cubic.coefficients!.forEach((value, index) =>
      expect(value).toBeCloseTo([1, 8, -48, 256][index]!, 9),
    );
  });

  it.each(["linear", "quad", "poly", "exp"] as const)(
    "keeps %s accurate when x has a large offset",
    (method) => {
      const origin = 1e12 - 20;
      const fn = (x: number) => {
        const z = x - origin;
        return method === "exp"
          ? 2 * Math.exp(0.1 * z)
          : 3 + 2 * z + (method === "quad" ? z ** 2 : method === "poly" ? z ** 3 : 0);
      };
      const result = fitChartSeries(data(sequence(12, origin), fn), { method });
      expect(result.rSquared).toBeCloseTo(1, 12);
      expect(result.rmse).toBeLessThan(1e-9);
      for (const point of result.points) {
        expect(point.y).toBeCloseTo(fn(point.x), 8);
      }
    },
  );

  it.each(["log", "pow"] as const)("keeps %s accurate for nearby large positive x", (method) => {
    const origin = 1e11;
    const fn =
      method === "log"
        ? (x: number) => 5 + 2e11 * Math.log1p((x - origin) / origin)
        : (x: number) => 2 * Math.exp(1e10 * Math.log1p((x - origin) / origin));
    const result = fitChartSeries(data(sequence(11, origin), fn), { method });
    expect(result.normalization?.transform).toBe("log");
    expect(result.rSquared).toBeCloseTo(1, 12);
    for (const point of result.points) {
      expect(point.y).toBeCloseTo(fn(point.x), 8);
    }
  });

  it("keeps small y and a large y offset numerically usable", () => {
    const small = fitChartSeries(
      data([0, 1, 2, 3], (x) => (1 + 2 * x) * 1e-250),
      { method: "linear" },
    );
    expect(small.rSquared).toBeCloseTo(1, 12);
    expect(small.points.at(-1)!.y / 7e-250).toBeCloseTo(1, 12);
    const offset = fitChartSeries(
      data(sequence(6), (x) => 1e11 + 3 * x),
      { method: "linear" },
    );
    expect(offset.coefficients).toEqual([1e11 + 7.5, 15]);
    expect(offset.rmse).toBe(0);
  });

  it("treats repeated x as repeated observations for parametric regression", () => {
    const result = fitChartSeries(
      [
        { x: 0, y: 0 },
        { x: 0, y: 2 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ],
      { method: "linear" },
    );
    expect(result.sampleCount).toBe(4);
    expect(result.points[0]!.y).toBeCloseTo(10 / 11, 12);
    expect(result.points.at(-1)!.y).toBeCloseTo(20 / 11, 12);
  });

  it("uses y-weighted log-space fitting for exponential regression", () => {
    const points = [
      { x: 0, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 20 },
    ];
    const sumYLogY = 2 * Math.log(2) + 4 * Math.log(4) + 20 * Math.log(20);
    const sumXYLogY = 2 * Math.log(2) + 8 * Math.log(4) + 60 * Math.log(20);
    const slope = (27 * sumXYLogY - 70 * sumYLogY) / 446;
    const amplitude = Math.exp((sumYLogY - 70 * slope) / 27);
    const result = fitChartSeries(points, { method: "exp" });
    expect(result.points[0]!.y).toBeCloseTo(amplitude, 11);
    expect(result.points.at(-1)!.y).toBeCloseTo(amplitude * Math.exp(3 * slope), 11);
    expect(result.note).toContain("重みは観測値y");
  });

  it("computes metrics in original y and preserves negative R²", () => {
    const result = fitChartSeries(
      [
        { x: 1, y: 100 },
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 4, y: 100 },
      ],
      { method: "pow" },
    );
    expect(result.rSquared).toBeCloseTo(-0.5719161410226508, 10);
    expect(result.rmse).toBeCloseTo(62.06115954879308, 10);
    expect(result.note).toContain("元のyで計算");
  });

  it.each(["linear", "quad", "poly", "exp", "log", "pow"] as const)(
    "returns undefined R² only for constant y in %s",
    (method) => {
      const result = fitChartSeries(
        data(sequence(6, 1), () => 7),
        { method },
      );
      expect(result.rSquared).toBeNull();
      expect(result.rmse).toBe(0);
      expect(result.points.every((point) => point.y === 7)).toBe(true);
      expect(result.note).toContain("yがすべて同じ");
    },
  );

  it("resolves a logarithmic curve across nine orders of magnitude", () => {
    const fn = (x: number) => 3 + 2 * Math.log(x);
    const result = fitChartSeries(data([0.1, 1, 1e2, 1e4, 1e6, 1e8], fn), { method: "log" });
    const yRange = fn(1e8) - fn(0.1);
    for (let index = 1; index < result.points.length; index += 1) {
      const left = result.points[index - 1]!;
      const right = result.points[index]!;
      for (const fraction of [0.1, 0.25, 0.5, 0.75, 0.9]) {
        const x = left.x + (right.x - left.x) * fraction;
        const drawn = left.y + (right.y - left.y) * fraction;
        expect(Math.abs(drawn - fn(x)) / yRange).toBeLessThan(0.0005);
      }
    }
    expect(result.points.length).toBeLessThanOrEqual(1001);
    expect(result.points[0]!.x).toBe(0.1);
    expect(result.points.at(-1)!.x).toBe(1e8);
  });
});

describe("chart regression input limits", () => {
  it.each([
    ["linear", 2],
    ["quad", 3],
    ["poly", 4],
    ["exp", 2],
    ["log", 2],
    ["pow", 2],
    ["loess", 3],
  ] as const)("requires enough distinct x for %s", (method, minimum) => {
    expect(() =>
      fitChartSeries(
        data(sequence(minimum - 1, 1), () => 2),
        { method },
      ),
    ).toThrow(`少なくとも${minimum}点`);
    expect(() =>
      fitChartSeries(
        data(sequence(minimum, 1), () => 2),
        { method },
      ),
    ).not.toThrow();
  });

  it("counts independent x values rather than rows for polynomial degree", () => {
    expect(() =>
      fitChartSeries(
        data([0, 0, 1, 1, 2, 2], (x) => x),
        { method: "poly" },
      ),
    ).toThrow("少なくとも4点");
    expect(() =>
      fitChartSeries(
        data([0, 0, 1, 1], (x) => x),
        { method: "quad" },
      ),
    ).toThrow("少なくとも3点");
    expect(() =>
      fitChartSeries(
        data([1, 1], () => 2),
        { method: "linear" },
      ),
    ).toThrow("少なくとも2点");
  });

  it.each([
    { method: "poly", degree: 2 },
    { method: "poly", degree: 4 },
    { method: "quad", degree: 3 },
    { method: "linear", bandwidth: 0.3 },
    { method: "loess", bandwidth: 0 },
    { method: "loess", bandwidth: -0.5 },
    { method: "loess", bandwidth: 1.1 },
    { method: "loess", bandwidth: Number.NaN },
    { method: "loess", bandwidth: Infinity },
    { method: "missing" },
    { method: "linear", weight: 1 },
  ])("rejects incompatible fit settings %j", (fit) => {
    expect(() =>
      fitChartSeries(
        data([1, 2, 3, 4], (x) => x),
        unsafeFit(fit),
      ),
    ).toThrow();
  });

  it.each([
    ["log", 0, 2],
    ["log", -1, 2],
    ["pow", 0, 2],
    ["pow", -1, 2],
    ["pow", 1, 0],
    ["pow", 1, -2],
    ["exp", 1, 0],
    ["exp", 1, -2],
  ] as const)(
    "rejects invalid %s domain at x=%s, y=%s without dropping the row",
    (method, x, y) => {
      expect(() =>
        fitChartSeries(
          [
            { x, y },
            { x: 2, y: 3 },
            { x: 3, y: 4 },
          ],
          { method },
        ),
      ).toThrow("0より大きく");
    },
  );

  it.each([Number.NaN, Infinity, -Infinity, 1e12 + 1, -1e12 - 1])(
    "rejects a nonfinite or out-of-range observation %s",
    (value) => {
      expect(() =>
        fitChartSeries(
          [
            { x: value, y: 1 },
            { x: 2, y: 3 },
          ],
          { method: "linear" },
        ),
      ).toThrow("有限な数値");
      expect(() =>
        fitChartSeries(
          [
            { x: 1, y: value },
            { x: 2, y: 3 },
          ],
          { method: "linear" },
        ),
      ).toThrow("有限な数値");
    },
  );

  it("bounds work and rejects nearly singular fits explicitly", () => {
    expect(() =>
      fitChartSeries(
        data(sequence(501), (x) => x),
        { method: "linear" },
      ),
    ).toThrow("500点以内");
    expect(() =>
      fitChartSeries(
        data([0, 1e-9, 1], (x) => x),
        { method: "quad" },
      ),
    ).toThrow("安定して計算できません");
    expect(() =>
      fitChartSeries(
        [
          { x: 0, y: 1e-15 },
          { x: 1, y: 1 },
        ],
        { method: "exp" },
      ),
    ).toThrow("重みが一部の点に偏り");
  });

  it("rejects a polynomial whose unsampled maximum exceeds the value limit", () => {
    const points = data([0, 0.5, 1], (x) => 1e12 + 1 - (x - 0.503) ** 2 * 1e6);
    expect(points.every((point) => point.y < 1e12)).toBe(true);
    expect(() => fitChartSeries(points, { method: "quad" })).toThrow("曲線が絶対値1兆を超えます");
  });
});

describe("LOESS smoothing", () => {
  it("returns sorted observed x without a misleading equation or goodness-of-fit score", () => {
    const points = sequence(21)
      .reverse()
      .map((x) => ({ x, y: 2 + 3 * x + (x % 2 === 0 ? 0.8 : -0.8) }));
    const result = fitChartSeries(points, { method: "loess", bandwidth: 0.6 });
    expect(result.points.map((point) => point.x)).toEqual(sequence(21));
    expect(result.equation).toBeNull();
    expect(result.coefficients).toBeNull();
    expect(result.rSquared).toBeNull();
    expect(result.rmse).toBeNull();
    const deviation = result.points.reduce(
      (sum, point) => sum + (point.y - 2 - 3 * point.x) ** 2,
      0,
    );
    expect(deviation).toBeLessThan((21 * 0.8 ** 2) / 2);
    expect(result.note).toContain("近傍12点");
    expect(points[0]!.x).toBe(20);
  });

  it("keeps original large x coordinates and states the minimum effective neighborhood", () => {
    const points = data(sequence(3, 1e12 - 3), (x) => 2 * (x - (1e12 - 3)));
    const result = fitChartSeries(points, { method: "loess" });
    expect(result.points).toEqual(points);
    expect(result.note).toContain("帯域幅0.3、近傍2点");
    expect(result.note).toContain("帯域幅を増やしてください");
  });

  it("rejects duplicate x whose smoothing otherwise depends on row order", () => {
    const points = [
      { x: 0, y: 11 },
      { x: 0, y: 14 },
      { x: 0, y: 2 },
      { x: 1, y: 9 },
      { x: 2, y: 10 },
    ];
    expect(() => fitChartSeries(points, { method: "loess" })).toThrow("同じxを持つ点を扱えません");
    expect(() => fitChartSeries([...points].reverse(), { method: "loess" })).toThrow(
      "同じxを持つ点を扱えません",
    );
  });
});
