import { describe, expect, it } from "vitest";
import { blockTree } from "@xpotato/editor-core/blocks";
import { readMathMeta, safeMathMarkup, writeMathMeta } from "./math.js";

describe("math fence settings", () => {
  it("can enable and disable TeX printing repeatedly without changing the label or formula", () => {
    const label = "数式表示のサンプル";
    const formula = "\\sigma = \\sqrt{\\frac{1}{N}}";
    let source = '```math label="' + label + '"\n' + formula + "\n```";
    for (const checked of [true, false, true, false]) {
      const before = blockTree(source).children![0]!;
      const meta = readMathMeta(before.meta!);
      source = "```math " + writeMathMeta(meta.label, checked) + "\n" + before.value + "\n```";
      const after = blockTree(source).children![0]!;
      expect(readMathMeta(after.meta!)).toEqual({ label, printSource: checked, valid: true });
      expect(after.value).toBe(formula);
      expect(after.meta).toBe('label="' + label + '"' + (checked ? ' print="source"' : ""));
    }
  });

  it("keeps print selection when the description changes, including incomplete input", () => {
    for (const label of ["", " ", '式の"説明', "標準偏差", "x".repeat(161), "式\tの説明"]) {
      const metadata = writeMathMeta(label, true);
      const result = readMathMeta(metadata);
      expect(result.label).toBe(label);
      expect(result.printSource).toBe(true);
      expect(result.valid).toBe(label === "標準偏差");
    }
  });

  it("does not interpret arbitrary fence options as supported math metadata", () => {
    for (const metadata of ["", 'title="標準偏差"', 'label="説明" print="other"']) {
      expect(readMathMeta(metadata).valid).toBe(false);
    }
  });
});

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
