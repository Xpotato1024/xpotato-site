import { describe, expect, it } from "vitest";
import { chartFormulaToTex } from "./chart-formula.js";
import { renderChartMath } from "./chart-math.js";

describe("bounded scientific formulas are typeset as semantic MathML", () => {
  it("turns arithmetic, powers and functions into readable TeX", () => {
    const tex = chartFormulaToTex("y = 0.5*x^2 + sin(x/2)");
    expect(tex).toContain(String.raw`{x}^{2}`);
    expect(tex).toContain(String.raw`\sin\left(\frac{x}{2}\right)`);
    const math = renderChartMath(String.raw`y=${tex}`);
    expect(math).toContain("<math");
    expect(math).toContain("<mfrac>");
    expect(math).toContain("<msup>");
    expect(math).not.toContain("<script");
  });
  it.each(["x+alert(1)", "x<svg/onload=1>", String.raw`\href{https://example.com}{x}`])(
    "does not accept TeX, HTML or JavaScript as an expression: %s",
    (source) => expect(() => chartFormulaToTex(source)).toThrow(),
  );
  it("preserves the precedence of unary minus and powers", () => {
    expect(chartFormulaToTex("(-x)^2")).toContain(String.raw`\left(-x\right)`);
    expect(chartFormulaToTex("-x^2")).toBe("-{x}^{2}");
  });
});
