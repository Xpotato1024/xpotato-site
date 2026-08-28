import { describe, expect, it } from "vitest";
import {
  analyzeBuiltHtml,
  renderSecurityHeaderArtifact,
  validateBuiltHtmlAgainstSecurityHeaders,
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
    html: "<!doctype html><html><head></head><body><main><h1>Tool</h1><style>astro-island{display:contents}</style><script>window.fixture=true;</script><astro-island></astro-island></main></body></html>",
  },
];

const validArtifact = (): string => renderSecurityHeaderArtifact(analyzeBuiltHtml(representativeBuild));

describe("application-local security headers", () => {
  it("accepts the required headers, explicit CSP baseline, JSON-LD, same-origin search module, and hashed Tool runtime", () => {
    expect(validateSecurityHeaderArtifact(validArtifact())).toEqual([]);
    expect(validateBuiltHtmlAgainstSecurityHeaders(validArtifact(), representativeBuild)).toEqual([]);
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
