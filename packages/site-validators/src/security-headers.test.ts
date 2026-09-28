import { describe, expect, it } from "vitest";
import {
  analyzeBuiltHtml,
  renderSecurityHeaderArtifact,
  validateBuiltHtmlAgainstSecurityHeaders,
  validateCanonicalLfSecurityHeaderArtifact,
  validateSecurityHeaderArtifact,
  type BuiltHtmlInput,
} from "./security-headers.js";

const representativeBuild: readonly BuiltHtmlInput[] = [
  {
    path: "notes/infrastructure-foundation/index.html",
    html: "<!doctype html><html><head><script type=\"application/ld+json\">{\"name\":\"fixture\"}</script></head><body><main><h1>Note</h1></main></body></html>",
  },
  {
    path: "search/index.html",
    html: "<!doctype html><html><head></head><body><main data-search-client><h1>Search</h1></main><script type=\"module\" src=\"/_astro/search.js\"></script></body></html>",
  },
  {
    path: "tools/prime-factorizer/index.html",
    html: "<!doctype html><html><head></head><body><main><h1>Tool</h1><style>astro-island{display:contents}</style><script>self.Astro.visible=()=>{};window.fixture=true;window.dispatchEvent(new Event('astro:visible'));</script><script>customElements.define('astro-island',class extends HTMLElement{});</script><astro-island></astro-island></main></body></html>",
  },
];

const validArtifact = (): string => renderSecurityHeaderArtifact(analyzeBuiltHtml(representativeBuild));

describe("application-local security headers", () => {
  it("accepts the required headers, explicit CSP baseline, JSON-LD, same-origin search module, and hashed Tool runtime", () => {
    expect(validateSecurityHeaderArtifact(validArtifact())).toEqual([]);
    expect(validateBuiltHtmlAgainstSecurityHeaders(validArtifact(), representativeBuild)).toEqual([]);
  });

  it("renders canonical LF-only control bytes and rejects CRLF materialization", () => {
    const artifact = validArtifact();
    expect(validateCanonicalLfSecurityHeaderArtifact(artifact)).toEqual([]);
    expect(artifact.includes("\r")).toBe(false);
    expect(artifact.endsWith("\n")).toBe(true);
    const crlf = artifact.replaceAll("\n", "\r\n");
    expect(validateCanonicalLfSecurityHeaderArtifact(crlf).join("\n")).toMatch(/LF line endings/u);
  });

  it.each([
    ["missing required header", (source: string) => source.replace("  Referrer-Policy: strict-origin-when-cross-origin\n", "")],
    ["unsafe-eval", (source: string) => source.replace("script-src 'self'", "script-src 'self' 'unsafe-eval'")],
    ["unsafe-inline", (source: string) => source.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")],
    ["object source", (source: string) => source.replace("object-src 'none'", "object-src 'self'")],
    ["frame ancestor", (source: string) => source.replace("frame-ancestors 'none'", "frame-ancestors 'self'")],
    ["third-party script", (source: string) => source.replace("script-src 'self'", "script-src 'self' https://cdn.example")],
    ["private media origin", (source: string) => source.replace("img-src 'self' data:", "img-src 'self' data: https://private.r2.dev")],
    ["Cloudflare Images origin", (source: string) => source.replace("img-src 'self' data:", "img-src 'self' data: https://imagedelivery.net")],
  ])("rejects %s", (_label, mutate) => {
    expect(validateSecurityHeaderArtifact(mutate(validArtifact()))).not.toEqual([]);
  });

  it("rejects stale executable hashes when built inline code changes", () => {
    const changedBuild = representativeBuild.map((entry) => entry.path.includes("prime-factorizer")
      ? { ...entry, html: entry.html.replace("window.fixture=true;", "window.fixture=false;") }
      : entry);
    expect(validateBuiltHtmlAgainstSecurityHeaders(validArtifact(), changedBuild).join("\n")).toMatch(/script hashes are stale/);
  });

  it.each([
    ["a content route", { path: "about/index.html", html: "<html><body><script>window.injected=true</script></body></html>" }],
    ["the search route", { ...representativeBuild[1]!, html: representativeBuild[1]!.html.replace("</body>", "<script>window.injected=true</script></body>") }],
    ["the Tool route", { ...representativeBuild[2]!, html: representativeBuild[2]!.html.replace("</main>", "<script>window.injected=true</script></main>") }],
  ])("rejects newly added inline executable code on %s before generation", (_route, addedRoute) => {
    const build = [...representativeBuild, addedRoute];
    const analysis = analyzeBuiltHtml(build);
    expect(analysis.errors.join("\n")).toMatch(/content-only route|search runtime|visible-hydration and astro-island runtime bootstrap/u);
    const generated = renderSecurityHeaderArtifact(analysis);
    expect(validateBuiltHtmlAgainstSecurityHeaders(generated, build).join("\n")).toMatch(/content-only route|search runtime|visible-hydration and astro-island runtime bootstrap/u);
  });

  it("rejects private media origins in exact built JavaScript and CSS assets", () => {
    const errors = validateBuiltHtmlAgainstSecurityHeaders(validArtifact(), representativeBuild, [
      { path: "_astro/runtime.js", source: 'fetch("https://private.r2.dev/source-media/object.webp")' },
      { path: "_astro/theme.css", source: 'background-image:url("https://imagedelivery.net/account/image")' },
    ]);
    expect(errors.join("\n")).toMatch(/private\/protected\/optional media origin/u);
  });

  it.each([
    ["third-party executable source", "<script src=\"https://cdn.example/tool.js\"></script>"],
    ["inline event handler", "<button onclick=\"run()\">Run</button>"],
    ["inline style attribute", "<div style=\"display:none\"></div>"],
  ])("rejects built HTML with %s", (_label, fragment) => {
    const unsafeBuild = representativeBuild.map((entry) => entry.path.includes("prime-factorizer")
      ? { ...entry, html: entry.html.replace("</main>", `${fragment}</main>`) }
      : entry);
    const artifact = renderSecurityHeaderArtifact(analyzeBuiltHtml(unsafeBuild));
    expect(validateBuiltHtmlAgainstSecurityHeaders(artifact, unsafeBuild)).not.toEqual([]);
  });
});
