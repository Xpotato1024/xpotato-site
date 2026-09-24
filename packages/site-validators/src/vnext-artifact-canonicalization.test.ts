import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertProfileVersions,
  canonicalizePrimeFactorizerHtml,
  vnextProfile,
} from "./vnext-artifact-canonicalization.js";

const fixture = readFileSync(new URL("../fixtures/vnext-prime-factorizer.html", import.meta.url));
const source = fixture.toString("utf8");
const versions = vnextProfile.versions;
const assets = vnextProfile.assets;
const run = (html: string, observedAssets = assets, actualVersions = versions) =>
  canonicalizePrimeFactorizerHtml(Buffer.from(html, "utf8"), actualVersions, observedAssets);

describe("bounded vNext Astro island canonicalization", () => {
  it("converges supported raw UID variance and changes only its verified value bytes", () => {
    const one = run(source);
    const two = run(source.replace('uid="Z1BMTyK"', 'uid="1N2TSx"'));
    expect(one.output.equals(two.output)).toBe(true);
    expect(one.canonicalUid).toMatch(/^xpv1-[0-9a-f]{64}$/u);
    expect(one.output.toString("utf8").replace(one.canonicalUid, one.rawUid)).toBe(source);
    expect(one.changedOnlyUidValue).toBe(true);
    expect(run(one.output.toString("utf8")).output.equals(one.output)).toBe(true);
  });

  it.each([
    ["component-url", '/_astro/PrimeFactorizer.B0vyJ8Ra.js', "/_astro/PrimeFactorizer.other.js"],
    ["renderer-url", "/_astro/client.XHtoj3W1.js", "/_astro/client.other.js"],
    ["component-export", 'component-export="default"', 'component-export="other"'],
    ["props", 'props="{}"', 'props="{&quot;value&quot;:1}"'],
    ["client directive", 'client="visible"', 'client="load"'],
    ["SSR children", "360 = 2 × 2 × 2 × 3 × 3 × 5", "360 = 2 × 3 × 5"],
    ["island position", "<astro-island", "x<astro-island"],
    ["unexpected attribute", " await-children>", ' data-extra="x" await-children>'],
    ["surrounding page", "<title>", "<title>unexpected"],
  ])("fails closed on non-UID variance: %s", (_name, before, after) => {
    expect(source.includes(before)).toBe(true);
    expect(() => run(source.replace(before, after))).toThrow();
  });

  it("fails closed on added or missing islands", () => {
    expect(() => run(source.replace("</body>", '<astro-island uid="x"></astro-island></body>'))).toThrow(/UNEXPECTED_ISLAND/u);
    expect(() => run(source.replace("<astro-island", "<other-island"))).toThrow(/UNEXPECTED_ISLAND/u);
  });

  it("fails closed on asset bytes and runtime version changes", () => {
    expect(() => run(source, { ...assets, "/_astro/client.XHtoj3W1.js": "0".repeat(64) })).toThrow(/asset/u);
    expect(() => run(source, assets, { ...versions, astro: "7.2.8" })).toThrow(/UNREVIEWED_RUNTIME_VERSION/u);
    expect(() => run(source, assets, { ...versions, "@astrojs/react": "6.0.5" })).toThrow(/UNREVIEWED_RUNTIME_VERSION/u);
    expect(() => run(source, assets, { ...versions, react: "19.2.9" })).toThrow(/UNREVIEWED_RUNTIME_VERSION/u);
    expect(() => assertProfileVersions({ ...versions, "react-dom": "19.2.9" })).toThrow(/UNREVIEWED_RUNTIME_VERSION/u);
  });
});
