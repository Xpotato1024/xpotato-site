import { describe, expect, it } from "vitest";
import { isSitemapEligible } from "./sitemap.js";

describe("sitemap eligibility", () => {
  it("includes normal public content", () => {
    expect(isSitemapEligible({ route: "/notes/example/", draft: false, noindex: false, searchPath: "/search/" })).toBe(true);
  });

  it.each([
    { route: "/notes/draft/", draft: true, noindex: false },
    { route: "/projects/private/", draft: false, noindex: true },
    { route: "/search/", draft: false, noindex: false },
  ])("excludes draft, noindex, and search routes: $route", (fixture) => {
    expect(isSitemapEligible({ ...fixture, searchPath: "/search/" })).toBe(false);
  });
});
