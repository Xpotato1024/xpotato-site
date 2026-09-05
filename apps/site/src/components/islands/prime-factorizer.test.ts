import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PrimeFactorizer from "./PrimeFactorizer.js";
import { factorize, formatPrimeFactorization, submitPrimeFactorizerDraft } from "./prime-factorizer-model.js";

describe("PrimeFactorizer legacy-observable parity", () => {
  it.each([
    [2, [2]],
    [13, [13]],
    [84, [2, 2, 3, 7]],
    [360, [2, 2, 2, 3, 3, 5]],
  ])("factorizes %s in ascending order with multiplicity", (input, expected) => {
    expect(factorize(input)).toEqual(expected);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -3, 0, 1, 2.5])("rejects non-domain input %s", (input) => {
    expect(factorize(input)).toEqual([]);
  });

  it("retains the last accepted result after every invalid draft submit", () => {
    for (const draft of ["", "0", "1", "-4", "2.5", "not-a-number"]) {
      expect(submitPrimeFactorizerDraft(360, draft)).toBe(360);
    }
  });

  it("accepts integer-valued decimal text and does not add a safe-integer restriction", () => {
    const twoToThe53 = Number("9007199254740992");
    expect(submitPrimeFactorizerDraft(360, "3.0")).toBe(3);
    expect(submitPrimeFactorizerDraft(360, "9007199254740992")).toBe(twoToThe53);
    expect(factorize(twoToThe53)).toEqual(Array.from({ length: 53 }, () => 2));
  });

  it("preserves the complete legacy result representation", () => {
    expect(formatPrimeFactorization(360)).toBe("360 = 2 × 2 × 2 × 3 × 3 × 5");
    expect(formatPrimeFactorization(13)).toBe("13 = 13");
  });

  it("renders an accessible semantic form with the frozen input and submit affordances", () => {
    const html = renderToStaticMarkup(createElement(PrimeFactorizer));
    expect(html).toContain("<form>");
    expect(html).toMatch(/<label for="prime-factorizer-input">2以上の整数<\/label>/u);
    expect(html).toMatch(/<input[^>]*id="prime-factorizer-input"[^>]*inputMode="numeric"[^>]*min="2"[^>]*step="1"[^>]*type="number"[^>]*value="360"/u);
    expect(html).toContain('<button type="submit">分解する</button>');
    expect(html).toMatch(/<output[^>]*aria-live="polite"[^>]*aria-atomic="true"[^>]*>360 = 2 × 2 × 2 × 3 × 3 × 5<\/output>/u);
  });
});
