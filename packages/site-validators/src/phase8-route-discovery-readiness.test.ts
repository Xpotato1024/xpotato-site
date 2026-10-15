import { describe, expect, it } from "vitest";
import { inspectHtml, semanticLinkUrl, validateRedirectGraph, validateArchiveArticleRoutes } from "./phase8-route-discovery-readiness.js";

describe("Phase 8 route invariants", () => {
  it("rejects duplicate sources, self loops, cycles, chains, canonical sources and missing targets", () => {
    const r = (sourcePath: string, targetPath: string) => ({ sourcePath, targetPath });
    for (const records of [[r("/a/", "/c/"), r("/a/", "/b/")], [r("/a/", "/a/")], [r("/a/", "/b/"), r("/b/", "/a/")], [r("/a/", "/b/"), r("/b/", "/c/")], [r("/canonical/", "/c/")], [r("/a/", "/missing/")]]) {
      expect(() => validateRedirectGraph(records, ["/canonical/"], ["/b/", "/c/"])).toThrow();
    }
    expect(() => validateRedirectGraph([r("/a/", "/c/")], ["/c/"], ["/c/"])).not.toThrow();
  });
  it("distinguishes semantic anchors from historical code literals without rewriting either", () => {
    const html = '<title>日本語</title><meta content="noindex,follow" name="robots"><link href="https://xpotato.net/current/" rel="canonical"><meta content="説明" name="description"><a href="/current/">link</a><pre><code><a href="/old/">literal</a></code></pre>';
    expect(inspectHtml(html)).toEqual({ title: "日本語", description: "説明", noindex: true, canonicals: ["https://xpotato.net/current/"], anchors: ["/current/"], historicalLocalReferences: [] });
  });
  it("rejects clickable local/unknown URLs while preserving literal historical evidence", () => {
    for (const href of ["d:/Xpotato-cloud/script.py", "file:///tmp/example", "unknown:example", "http://localhost/docs/"]) {
      expect(() => semanticLinkUrl(href, "/blog/example/")).toThrow();
    }
    expect(semanticLinkUrl("/tools/prime-factorizer/", "/blog/example/").pathname).toBe("/tools/prime-factorizer/");
    const historical = '<span data-historical-local-reference="d:/Xpotato-cloud/script.py">script <code>d:/Xpotato-cloud/script.py</code></span>';
    expect(inspectHtml(historical)).toMatchObject({ anchors: [], historicalLocalReferences: ["d:/Xpotato-cloud/script.py"] });
    expect(() => inspectHtml('<a data-historical-local-reference="d:/x" href="d:/x">x</a>')).toThrow();
  });
});


describe("archive article-region exact set", () => {
  const list = (routes: string[]) => '<nav><a href="/about/">header</a></nav><ul class="article-list">' +
    routes.map((route) => '<li><article><h2><a href="' + route + '">article</a></h2></article></li>').join("") + "</ul>";
  it("accepts exact ordered items, ignores navigation, and checks an empty archive", () => {
    expect(() => validateArchiveArticleRoutes(list(["/blog/a/", "/blog/b/"]), ["/blog/a/", "/blog/b/"])).not.toThrow();
    expect(() => validateArchiveArticleRoutes('<nav><a href="/projects/">empty fallback</a></nav>', [])).not.toThrow();
  });
  it.each([
    { routes: ["/blog/a/", "/blog/noindex/"] }, { routes: ["/blog/a/", "/blog/other-page/"] },
    { routes: ["/blog/a/", "/blog/a/"] }, { routes: ["/blog/missing/"] }, { routes: [] },
  ])("rejects extra excluded/wrong-page/duplicate or missing items: $routes", ({ routes }) => {
    expect(() => validateArchiveArticleRoutes(list(routes), ["/blog/a/"])).toThrow();
  });
  it("rejects duplicate article-list containers and extra items on an empty page", () => {
    expect(() => validateArchiveArticleRoutes(list(["/blog/a/"]) + list(["/blog/a/"]), ["/blog/a/"])).toThrow();
    expect(() => validateArchiveArticleRoutes(list(["/blog/noindex/"]), [])).toThrow();
  });
});
