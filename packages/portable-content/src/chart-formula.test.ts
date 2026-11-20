import { describe, expect, it } from "vitest";
import { buildChartFormula, type ChartFormula } from "./chart-formula.js";

const formula = (expression: string, xMin = -2, xMax = 2, samples = 201) =>
  buildChartFormula({ expression, xMin, xMax, samples });
const unsafe = (value: unknown) => value as ChartFormula;

describe("theoretical chart expressions", () => {
  it("can draw a physical model without measurements and preserves its original coefficients", () => {
    const input = Object.freeze({ expression: "  y = 0.5 * 9.81 * x^2  ", xMin: 0, xMax: 2 });
    const result = buildChartFormula(input);
    expect(result.expression).toBe("0.5 * 9.81 * x^2");
    expect(result.domain).toEqual([0, 2]);
    expect(result.sampleCount).toBe(result.points.length);
    expect(result.points[0]).toEqual({ x: 0, y: 0 });
    expect(result.points.at(-1)).toEqual({ x: 2, y: 19.62 });
    expect(input.expression).toBe("  y = 0.5 * 9.81 * x^2  ");
    expect(result.points.every((point) => point.y === 0.5 * 9.81 * point.x ** 2)).toBe(true);
  });

  it.each([
    ["2 + 3 * x", (x: number) => 2 + 3 * x],
    ["(2 + 3) * x", (x: number) => 5 * x],
    ["-x^2", (x: number) => -(x ** 2)],
    ["(-x)^2", (x: number) => (-x) ** 2],
    ["2^-2*x", (x: number) => x / 4],
    ["2^3^2+x", (x: number) => 512 + x],
    ["x**3", (x: number) => x ** 3],
    ["--x", (x: number) => x],
    ["1e-3*x + .25", (x: number) => 0.001 * x + 0.25],
    ["8 / 2 / 2 + x", (x: number) => 2 + x],
    ["8 - 2 - 1 + x", (x: number) => 5 + x],
    ["pi * x + e", (x: number) => Math.PI * x + Math.E],
  ] as const)("uses mathematical precedence for %s", (expression, expected) => {
    const result = formula(expression);
    for (const point of result.points) expect(point.y).toBeCloseTo(expected(point.x), 12);
  });

  it.each([
    ["sin(x)", Math.sin, -Math.PI, Math.PI],
    ["cos(x)", Math.cos, -Math.PI, Math.PI],
    ["tan(x)", Math.tan, -1, 1],
    ["asin(x)", Math.asin, -1, 1],
    ["acos(x)", Math.acos, -1, 1],
    ["atan(x)", Math.atan, -3, 3],
    ["exp(x)", Math.exp, -3, 3],
    ["ln(x)", Math.log, 0.1, 3],
    ["log(x)", Math.log, 0.1, 3],
    ["log10(x)", Math.log10, 0.1, 3],
    ["sqrt(x)", Math.sqrt, 0, 4],
    ["abs(x)", Math.abs, -3, 3],
    ["x^0.5", Math.sqrt, 0, 4],
  ] as const)("evaluates %s over its permitted real domain", (expression, expected, min, max) => {
    const result = formula(expression, min, max);
    for (const point of result.points) expect(point.y).toBeCloseTo(expected(point.x), 12);
    expect(result.note).toContain("ラジアン");
  });

  it("accepts a damped oscillation using nested functions", () => {
    const result = formula("2*exp(-0.3*x)*sin(2*pi*x)", 0, 3);
    for (const point of result.points) {
      expect(point.y).toBeCloseTo(
        2 * Math.exp(-0.3 * point.x) * Math.sin(2 * Math.PI * point.x),
        12,
      );
    }
    expect(result.points.length).toBeGreaterThanOrEqual(201);
    expect(result.points.length).toBeLessThanOrEqual(1001);
  });

  it("handles correlated factors and common valid domain boundaries", () => {
    for (const expression of ["sqrt(x*x)", "sqrt(x^2)"]) {
      const result = formula(expression, -3, 3, 21);
      for (const point of result.points) expect(point.y).toBeCloseTo(Math.abs(point.x), 12);
    }
    const root = formula("sqrt(x^2-1)", 1, 2);
    expect(root.points[0]!.y).toBe(0);
    const quotient = formula("x/(x-x+1)");
    for (const point of quotient.points) expect(point.y).toBe(point.x);
    expect(
      formula("sin(x)^2+cos(x)^2").points.every((point) => Math.abs(point.y - 1) < 1e-14),
    ).toBe(true);
  });

  it("subdivides overestimated intervals before rejecting a finite expression", () => {
    const result = formula("exp(200000*x-199999*x)", 0, 1);
    expect(result.points.length).toBeGreaterThan(201);
    for (const point of result.points)
      expect(point.y).toBe(Math.exp(200000 * point.x - 199999 * point.x));
  });

  it("adds samples to a coarse curve without changing the requested domain", () => {
    const result = formula("x^2", -2, 3, 21);
    expect(result.points.length).toBeGreaterThan(21);
    expect(result.points[0]!.x).toBe(-2);
    expect(result.points.at(-1)!.x).toBe(3);
    expect(
      result.points.every((point, index) => index === 0 || point.x > result.points[index - 1]!.x),
    ).toBe(true);
    for (let index = 1; index < result.points.length; index += 1) {
      const left = result.points[index - 1]!,
        right = result.points[index]!;
      const x = left.x + (right.x - left.x) / 2;
      expect(Math.abs(x ** 2 - (left.y + right.y) / 2)).toBeLessThan(9 * 0.0005 + 1e-12);
    }
  });

  it("does not alias high-frequency sine into an apparently flat curve", () => {
    expect(() => formula("sin(800*pi*x)", 0, 1)).toThrow(/1001点|計算量/);
  });

  it("finds a narrow triangular peak even when all initial and quarter-point samples are zero", () => {
    const result = formula(
      "8192*(abs(x-0.12298583984375)+abs(x-0.12310791015625)-2*abs(x-0.123046875))",
      0,
      1,
    );
    expect(Math.max(...result.points.map((point) => point.y))).toBeCloseTo(1, 5);
    expect(result.points.length).toBeLessThanOrEqual(1001);
    expect(result.points.length).toBeGreaterThan(201);
    const plateau = result.points.filter((point) => point.x < 0.12 || point.x > 0.125);
    expect(plateau.every((point) => point.y === 0)).toBe(true);
  });

  it("rejects an unresolved narrow peak on a nonzero baseline instead of drawing a constant", () => {
    expect(() => formula("1+1/(1+1e24*(x-0.123456789)^2)", 0, 1)).toThrow(/描画上限|計算量/);
  });

  it("resolves the narrow peak after the author selects a sufficiently small x range", () => {
    const center = 0.123456789;
    const result = formula("1+1/(1+1e24*(x-0.123456789)^2)", center - 1e-10, center + 1e-10);
    expect(Math.max(...result.points.map((point) => point.y))).toBe(2);
    expect(result.points.length).toBeLessThanOrEqual(1001);
    expect(result.points[0]!.x).toBe(center - 1e-10);
    expect(result.points.at(-1)!.x).toBe(center + 1e-10);
  });

  it("retains ordinary combined trigonometric curves and square-root endpoints", () => {
    for (const expression of [
      "sin(x)+cos(x)",
      "sin(x)*sin(x)+cos(x)*cos(x)",
      "sqrt(x)",
      "asin(x)",
    ]) {
      const result = formula(expression, 0, 1);
      expect(result.points[0]!.x).toBe(0);
      expect(result.points.at(-1)!.x).toBe(1);
      expect(result.points.every((point) => Number.isFinite(point.y))).toBe(true);
      expect(result.points.length).toBeLessThanOrEqual(1001);
    }
  });

  it("does not connect the two sides of poles missed by the initial sample grid", () => {
    for (const expression of ["1/(x-0.1234567)", "1/(x*x-2)", "tan(x)"]) {
      expect(() => formula(expression, 0, 2)).toThrow(/連続性|1兆|0で割る|有限|1001点/);
    }
  });

  it.each([
    ["1/x", -1, 1],
    ["log(x)", -1, 1],
    ["sqrt(x)", -1, 1],
    ["asin(x)", -2, 2],
    ["acos(x)", -2, 2],
    ["x^0.5", -1, 1],
    ["x^-2", -1, 1],
    ["x^0", -1, 1],
    ["sqrt((x-0.1234)*(x-0.1235))", 0, 1],
  ] as const)(
    "rejects a partly undefined formula %s without dropping bad values",
    (expression, min, max) => {
      expect(() => formula(expression, min, max)).toThrow(/理論式|有限/);
    },
  );

  it("rejects hidden singularities even if later subtraction would cancel their values", () => {
    expect(() => formula("1/(x-0.1234567)-1/(x-0.1234567)", 0, 1)).toThrow(/連続性|0で割る|有限/);
  });

  it("supports large x offsets and very small finite y", () => {
    const result = formula("2*(x-999999999900)+1", 999999999900, 999999999999);
    for (const point of result.points) {
      expect(point.y).toBe(2 * (point.x - 999999999900) + 1);
    }
    const tiny = formula("1e-250*(x+3)");
    expect(tiny.points[0]!.y).toBe(1e-250);
    expect(tiny.points.at(-1)!.y).toBe(5e-250);
    expect(formula("1e-320").points.every((point) => point.y === 1e-320)).toBe(true);
  });

  it("asks for a coarser density if x values cannot be represented distinctly", () => {
    expect(() => formula("x-1e12", 1e12 - 0.001, 1e12)).toThrow(/描画点を区別/);
    const result = formula("x-1e12", 1e12 - 0.01, 1e12, 21);
    expect(result.points.length).toBe(21);
  });

  it.each([
    "fetch('https://example.com')",
    "Math.sin(x)",
    "x.constructor",
    "constructor(x)",
    "__proto__",
    "globalThis",
    "process.exit()",
    "import(x)",
    "x[0]",
    "x;1",
    "x=1",
    "x=>x",
    "(()=>1)()",
    "`x`",
    "[x]",
    "{x:1}",
    "random()",
    "Infinity",
    "NaN",
    "2x",
    "sin x",
    "sin(x,1)",
    "x)",
    "(x",
    "x+",
    "sin()",
    "0x10",
  ])("rejects unsupported syntax %s", (expression) => {
    expect(() => formula(expression)).toThrow(/理論式/);
  });

  it.each([
    "1e999",
    "1e-999",
    "exp(-1000)",
    "1e-300*1e-300",
    "1e-300/1e300",
    "1e-300^2",
    "1e308+1e308",
    "1e12+1",
  ])("rejects nonrepresentable or out-of-range calculations in %s", (expression) =>
    expect(() => formula(expression)).toThrow(/理論式|有限|小さすぎ/),
  );

  it("bounds parser complexity", () => {
    expect(() => formula("(".repeat(40) + "x" + ")".repeat(40))).toThrow(/深すぎ/);
    expect(() => formula("x+".repeat(150) + "1")).toThrow(/複雑すぎ/);
    expect(() => formula("x".repeat(501))).toThrow(/500文字/);
  });

  it.each([
    null,
    { expression: "x", xMin: 1, xMax: 1 },
    { expression: "x", xMin: 2, xMax: 1 },
    { expression: "x", xMin: -Infinity, xMax: 1 },
    { expression: "x", xMin: 0, xMax: NaN },
    { expression: "x", xMin: 0, xMax: 1e12 + 1 },
    { expression: "x", xMin: 0, xMax: 1, samples: 20 },
    { expression: "x", xMin: 0, xMax: 1, samples: 1002 },
    { expression: "x", xMin: 0, xMax: 1, samples: 100.5 },
    { expression: "x", xMin: 0, xMax: 1, samples: null },
    { expression: "x", xMin: 0, xMax: 1, extra: true },
    { expression: "", xMin: 0, xMax: 1 },
    { expression: "y=", xMin: 0, xMax: 1 },
  ])("rejects invalid input %#", (input) => {
    expect(() => buildChartFormula(unsafe(input))).toThrow();
  });
});
