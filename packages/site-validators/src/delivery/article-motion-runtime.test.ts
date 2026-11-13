import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import type { ContentMediaRegistry } from "@xpotato/content-contracts";
import { renderRegistryPicture } from "@xpotato/portable-content/media-picture";
import { articleMediaTargets } from "@xpotato/content-contracts/article-media-targets";
import { inspectArticleMotionMarkup, measureArticleMotionRuntime, validateArticleMotionSource, articleMotionBudget } from "./article-motion-runtime.js";
import { analyzeBuiltHtml, renderSecurityHeaderArtifact, validateBuiltHtmlAgainstSecurityHeaders } from "./security-headers.js";
import { measureRouteRuntime, assertRuntimeIsolation } from "../migration/phase8-runtime.js";

const contentId = "f8a847d4-8f5d-4bb0-a387-750f096479f2", route = "/articles/motion/";
const object = (sha: string) => ({ sha256: sha, objectKey: "media/v1/objects/sha256/" + sha.slice(0, 2) + "/" + sha + ".webp", format: "webp" as const, width: 640, height: 320, sizeBytes: 123 });
const registry: ContentMediaRegistry = { schemaVersion: 1, contentId, assets: [{
  assetId: "motion-poster", role: "inline", origin: "camera", status: "active", defaultAlt: "Motion & poster", decorative: false,
  rightsRef: "rights", provenanceRef: "provenance", visualAuditRef: "audit",
  canonicalSource: { storageClass: "private_canonical_media_v1", sha256: "a".repeat(64), format: "webp", width: 640, height: 320, sizeBytes: 123, ingestProfileId: "canonical-raster-v1", ingestProfileSha256: "a".repeat(64) },
  delivery: { mode: "responsive", profileId: "photo-inline-v1", profileSha256: "a".repeat(64), master: object("a".repeat(64)), variants: [object("b".repeat(64))] },
}] };
const poster = registry.assets[0]!;
registry.assets.push({ ...structuredClone(poster), assetId: "motion", canonicalSource: { ...poster.canonicalSource!, animation: { frameCount: 2, delaysMs: [50, 100], loop: 0 } },
  delivery: { ...poster.delivery, mode: "animated", posterAssetId: poster.assetId, master: { ...object("c".repeat(64)), animation: { frameCount: 2, delaysMs: [50, 100], loop: 0 } }, variants: [{ ...object("d".repeat(64)), animation: { frameCount: 2, delaysMs: [50, 100], loop: 0 } }] } });
const media = renderRegistryPicture({ registry, assetId: "motion", urlFor: ref => articleMediaTargets.publicOrigin + "/" + ref.objectKey });
const script = '<script src="/scripts/article-motion.js" defer></script>';
const code = '<div data-code-block><pre><code>1 + 1</code></pre></div><script src="/scripts/code-copy.js" defer></script>';
const wrap = (body = media, runtime = script) => '<html><head><link rel="canonical" href="https://xpotato.net' + route + '"></head><body><main data-search-collection="blog" data-search-id="' + contentId + '"><h1>Motion</h1>' + body + '</main>' + runtime + '</body></html>';
const fixture = wrap(), source = readFileSync(new URL("../../../../apps/site/public/scripts/article-motion.js", import.meta.url), "utf8");
const pages = (html = fixture) => [
  { path: "articles/motion/index.html", html },
  { path: "notes/infrastructure-foundation/index.html", html: "<main>Static note</main>" },
  { path: "search/index.html", html: '<script type="module" src="/_astro/search.js"></script>' },
];
const built = (sourceText = source) => [{ path: "scripts/article-motion.js", source: sourceText }];
const validate = (html = fixture, assets = built()) => {
  const inputs = pages(html); return validateBuiltHtmlAgainstSecurityHeaders(renderSecurityHeaderArtifact(analyzeBuiltHtml(inputs)), inputs, assets);
};

describe("bounded public article motion runtime", () => {
  it("admits actual renderer markup, multiple pictures, classic deferred source and unchanged CSP", () => {
    expect(inspectArticleMotionMarkup(fixture, route).script).toBe(true);
    expect(inspectArticleMotionMarkup(wrap(media + media), route).script).toBe(true);
    expect(inspectArticleMotionMarkup("<main>No motion</main>", "/about/").script).toBe(false);
    expect(analyzeBuiltHtml(pages()).errors).toEqual([]);
    expect(validate()).toEqual([]);
    expect(renderSecurityHeaderArtifact(analyzeBuiltHtml(pages()))).toBe(renderSecurityHeaderArtifact(analyzeBuiltHtml(pages(wrap("", "")))));
  });

  it.each([
    wrap(media, ""), wrap("", script), wrap(media, script + script),
    wrap(media, script.replace(" defer", "")), wrap(media, script.replace(" defer", " async")),
    wrap(media, script.replace(" defer", ' type="module"')), wrap(media, script.replace(" defer", " defer defer")),
    wrap(media, script.replace("</script>", "void 0;</script>")),
    wrap(media, script.replace(".js", ".js?v=1")), wrap(media, script.replace('src="/', 'src="https://other.invalid/')),
    fixture.replace('data-playing="false"', 'data-playing="true"'),
    fixture.replace('data-motion-toggle hidden', 'data-motion-toggle'), fixture.replace('type="button"', 'type="submit"'),
    fixture.replace('data-motion-picture', 'data-other-picture'), fixture.replace('data-motion-view', 'data-other-view'),
    wrap(media + '<span data-motion-view></span>'),
    wrap(media.replace("<template", '<span data-motion-view></span><template')),
    fixture.replace('</template>', '<script>window.evil=true</script></template>'),
    fixture.replace('</template>', '<img src="/injected.png"></template>'),
    fixture.replace('</template>', '<iframe src="/"></iframe></template>'),
    fixture.replace('<img src=', '<img onerror="bad()" src='),
    fixture.replace('class="motion-play"', 'class="motion-play" onload="bad()"'),
    fixture.replace('image/webp', 'image/svg+xml'),
    fixture.replace('https://assets.xpotato.net/', 'https://foreign.invalid/'),
    fixture.replace('width="640"', 'width="0"'),
    fixture.replace('data-search-collection="blog"', 'data-search-collection="tools"'),
    fixture.replace('data-search-id="' + contentId, 'data-search-id="00000000-0000-4000-8000-000000000000'),
    fixture.replace("</head>", '<meta name="robots" content="noindex"></head>'),
    fixture.replace("</head>", '<meta name="xpotato-private-draft-preview-v1" content="candidate"></head>'),
    fixture.replace('https://xpotato.net' + route, 'https://xpotato.net/articles/other/'),
  ])("rejects missing, duplicated, forged or active enhancement markup", html => {
    expect(() => inspectArticleMotionMarkup(html, route)).toThrow();
    expect(analyzeBuiltHtml(pages(html)).errors.length).toBeGreaterThan(0);
  });

  it("rejects wrong routes and keeps unknown scripts and inline handlers rejected with code-copy", () => {
    for (const path of ["/", "/about/", "/search/", "/tools/prime-factorizer/"]) expect(() => inspectArticleMotionMarkup(fixture, path)).toThrow();
    expect(validate(wrap(media + code))).toEqual([]);
    for (const extra of ['<script src="/scripts/unknown.js"></script>', '<script>void 0;</script>', '<script src="/scripts/code-copy.js" defer></script>', '<button onclick="bad()">x</button>']) {
      expect(analyzeBuiltHtml(pages(wrap(media + code + extra))).errors.length).toBeGreaterThan(0);
    }
    expect(analyzeBuiltHtml(pages(wrap(media, script + '<script src="/scripts/code-copy.js" defer></script>'))).errors.length).toBeGreaterThan(0);
  });

  it("requires one actual reviewed asset, tolerating only LF versus CRLF checkout bytes", () => {
    expect(() => validateArticleMotionSource(source)).not.toThrow();
    const lf = source.replaceAll("\r\n", "\n");
    expect(() => validateArticleMotionSource(lf.replaceAll("\n", "\r\n"))).not.toThrow();
    expect(validate(fixture, [])).toContain("Article motion requires exactly one built runtime asset");
    expect(validate(fixture, [...built(), ...built()])).toContain("Article motion requires exactly one built runtime asset");
    for (const bad of ["void 0;", 'document.body.replaceChildren()', 'fetch("/")', 'window["fetch"]("/")', 'localStorage.getItem("x")', 'import("./other.js")', 'eval("1")', source + "\nvoid 0;", source.replace("setPlaying(!playing)", "setPlaying(true)")]) {
      expect(() => validateArticleMotionSource(bad)).toThrow("forbidden");
      expect(validate(fixture, built(bad)).join(" ")).toContain("forbidden");
    }
    expect(() => validateArticleMotionSource(" ".repeat(articleMotionBudget.raw + 1))).toThrow("budget");
  });

  it("measures exact bytes separately, coexists with copy, and keeps total JS accounting explicit", async () => {
    const dist = await mkdtemp(join(tmpdir(), "article-motion-runtime-"));
    try {
      await mkdir(join(dist, "scripts")); await mkdir(join(dist, "_astro"));
      await writeFile(join(dist, "scripts/article-motion.js"), source);
      await writeFile(join(dist, "scripts/code-copy.js"), "void 0;");
      await writeFile(join(dist, "_astro/search.js"), "void 0;");
      const result = await measureRouteRuntime(dist, route, wrap(media + code));
      expect(result.assets).toEqual([]);
      expect(result.articleMotionAssets).toEqual([{ path: "/scripts/article-motion.js", bytes: Buffer.byteLength(source), gzipBytes: gzipSync(source).length, sha256: createHash("sha256").update(source).digest("hex") }]);
      expect(result.codeCopyAssets).toHaveLength(1);
      const search = await measureRouteRuntime(dist, "/search/", '<script src="/_astro/search.js"></script>');
      expect(() => assertRuntimeIsolation([result, search])).not.toThrow();
      await expect(measureRouteRuntime(dist, route, wrap(media + code + '<script src="/scripts/unknown.js"></script>'))).rejects.toThrow();
      await writeFile(join(dist, "scripts/article-motion.js"), source + "\nvoid 0;");
      await expect(measureArticleMotionRuntime(dist, fixture, route)).rejects.toThrow("forbidden");
      const budgetSource = readFileSync(new URL("../../../../tools/qa/performance-budget.mjs", import.meta.url), "utf8");
      expect(budgetSource).toContain('check(route+" article motion JS",size(motionAssets),articleMotionBudget)');
      expect(budgetSource).toContain("...shareAssets,...motionAssets,...homeHeaderAssets");
      expect(budgetSource).toContain("articleMotionJs:size(motionAssets)");
    } finally { await rm(dist, { recursive: true, force: true }); }
  });
});
