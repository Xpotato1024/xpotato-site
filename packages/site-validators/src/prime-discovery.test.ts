import { describe, expect, it } from "vitest";
import { validatePrimeDiscovery } from "./prime-discovery.js";
const canonical = "https://xpotato.net/tools/prime-factorizer/";
const guide = '<h2>使い方と計算例</h2><p>素数だけの積。360 = 2³ × 3² × 5。12 = 2² × 3。97。</p><h2>結果を読むときの注意</h2><p>残りの数と証明を確認。</p>';
const html = '<html><head><link rel="canonical" href="' + canonical + '"><script type="application/ld+json">' + JSON.stringify({"@type":"WebPage",url:canonical}) + '</script></head><body><main><h1>素因数分解機</h1><astro-island>GUI</astro-island>' + guide + '</main></body></html>';
const tools = '<a href="/tools/prime-factorizer/">素因数分解機</a>', sitemap = '<urlset><url><loc>' + canonical + '</loc></url></urlset>';
const check = (page = html, list = tools, map = sitemap) => validatePrimeDiscovery(page, list, map);
describe("prime tool static discovery regression", () => {
  it("accepts the interactive tool followed by a static guide and canonical discovery", () => expect(check()).toEqual([]));
  it("rejects text available only through a hydrated island, script, hidden node or closed help", () => {
    for (const wrapper of ['<astro-island>BODY</astro-island>', '<script>BODY</script>', '<div hidden>BODY</div>', '<details>BODY</details>']) {
      expect(check(html.replace(guide, wrapper.replace("BODY", guide)))).toContain("prime: static definition and calculation examples missing");
    }
  });
  it("keeps the input before guidance without a preceding contents menu", () => {
    expect(check(html.replace('<astro-island>GUI</astro-island>' + guide, guide + '<astro-island>GUI</astro-island>'))).toContain("prime: interactive tool must precede guide");
    expect(check(html.replace('<main>', '<main><nav class="table-of-contents"></nav>'))).toContain("prime: guide must not insert a table of contents above the tool");
  });
  it("rejects wrong or duplicate canonical, noindex and missing h1", () => {
    expect(check(html.replace(canonical, 'https://example.com/'))).toContain("prime: self canonical missing or duplicate");
    expect(check(html.replace('</head>', '<link rel="canonical" href="' + canonical + '"></head>'))).toContain("prime: self canonical missing or duplicate");
    expect(check(html.replace('</head>', '<meta name="robots" content="noindex"></head>'))).toContain("prime: unexpectedly noindex");
    expect(check(html.replace('<h1>素因数分解機</h1>', ''))).toContain("prime: one descriptive h1 required");
  });
  it("rejects JavaScript-only navigation and a missing sitemap entry", () => {
    expect(check(html, '<button>開く</button>')).toContain("prime: tools archive crawlable link missing");
    expect(check(html, tools, '<urlset/>')).toContain("prime: canonical missing from sitemap");
  });
  it("requires honest WebPage identity and rejects invented rich-result entities", () => {
    expect(check(html.replace('"WebPage"', '"Other"'))).toContain("prime: WebPage identity missing");
    expect(check(html.replace('</head>', '<script type="application/ld+json">{"@type":"AggregateRating"}</script></head>'))).toContain("prime: unsupported rich-result entity");
  });
});
