import { describe, expect, it } from "vitest";
import { safeMathMarkup } from "./math.js";
describe("public-compatible equation editing", () => {
  it("renders TeX commands as native MathML without an inline stylesheet or extra fonts", () => {
    const html = safeMathMarkup("\\sigma = \\sqrt{\\frac{1}{N}}");
    expect(html).toContain("<math");
    expect(html).toContain("<msqrt>");
    expect(html).toContain("<mfrac>");
    expect(html).toContain("σ");
    expect(html).not.toMatch(/<[^>]+\s(?:style|href|src|on\w+)\s*=/iu);
  });
  it("rejects unsupported macros and bounded-input violations before display", () => {
    for (const value of [
      "",
      "x".repeat(4097),
      "\\href{https://example.com}{x}",
      "\\newcommand{\\x}{1}",
      "\\htmlStyle{color:red}{x}",
      "\\frac{",
    ]) {
      expect(() => safeMathMarkup(value)).toThrow();
    }
  });
});
