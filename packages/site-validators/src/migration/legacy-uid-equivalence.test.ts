import { describe, expect, it } from "vitest";
import {
  LEGACY_PRIME_FACTORIZER_COMPONENT_PATH,
  LEGACY_PRIME_FACTORIZER_CONTENT_ID,
  LEGACY_PRIME_FACTORIZER_HTML_PATH,
  provePrimeFactorizerAstroUidVariance,
  validateAstroReactIslandUidVarianceEvidence,
  verifyPrimeFactorizerInteractiveBinding,
} from "./legacy-uid-equivalence.js";

const island = (uid: string, overrides = "", child = "<section><p>same</p></section>"): string =>
  `<!doctype html><html><body><astro-island uid="${uid}" prefix="r1" component-url="/_astro/PrimeFactorizer.abc123.js" component-export="default" renderer-url="/_astro/client.xyz789.js" props="{}" ssr client="visible" opts="{&quot;name&quot;:&quot;PrimeFactorizer&quot;,&quot;value&quot;:true}" await-children${overrides}>${child}</astro-island></body></html>`;

describe("accepted frozen Astro/React island uid equivalence", () => {
  it("accepts only a uid value change and preserves both raw values as evidence", () => {
    const proof = provePrimeFactorizerAstroUidVariance({
      path: LEGACY_PRIME_FACTORIZER_HTML_PATH,
      firstHtml: island("ZPqW8H"),
      secondHtml: island("19OE8f"),
      interactiveBindingVerified: true,
    });
    expect(proof).toBeDefined();
    expect(proof?.firstComparisonHtml).toBe(proof?.secondComparisonHtml);
    expect(proof?.evidence.observedValues).toEqual(["ZPqW8H", "19OE8f"]);
    expect(validateAstroReactIslandUidVarianceEvidence(proof?.evidence)).toEqual([]);
  });

  it("rejects a non-uid attribute difference", () => {
    expect(() => provePrimeFactorizerAstroUidVariance({
      path: LEGACY_PRIME_FACTORIZER_HTML_PATH,
      firstHtml: island("AAA111"),
      secondHtml: island("BBB222", " data-extra=\"changed\""),
      interactiveBindingVerified: true,
    })).toThrow(/variance beyond the Astro island uid value/u);
  });

  it("rejects changed SSR children", () => {
    expect(() => provePrimeFactorizerAstroUidVariance({
      path: LEGACY_PRIME_FACTORIZER_HTML_PATH,
      firstHtml: island("AAA111"),
      secondHtml: island("BBB222", "", "<section><p>changed</p></section>"),
      interactiveBindingVerified: true,
    })).toThrow(/variance beyond the Astro island uid value/u);
  });

  it("does not apply to another HTML path", () => {
    expect(provePrimeFactorizerAstroUidVariance({
      path: "blog/index.html",
      firstHtml: island("AAA111"),
      secondHtml: island("BBB222"),
      interactiveBindingVerified: true,
    })).toBeUndefined();
  });

  it("requires the exact frozen interactive inventory binding", () => {
    expect(verifyPrimeFactorizerInteractiveBinding([{
      componentPath: LEGACY_PRIME_FACTORIZER_COMPONENT_PATH,
      usedByContentIds: [LEGACY_PRIME_FACTORIZER_CONTENT_ID],
      framework: "React",
      hydrationDirective: "client:visible",
    }])).toEqual([]);
    expect(verifyPrimeFactorizerInteractiveBinding([{
      componentPath: LEGACY_PRIME_FACTORIZER_COMPONENT_PATH,
      usedByContentIds: [LEGACY_PRIME_FACTORIZER_CONTENT_ID],
      framework: "React",
      hydrationDirective: "client:load",
    }]).length).toBeGreaterThan(0);
  });
});
