import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const dist = resolve(root, "apps/site/dist");
const contentOnly = await readFile(join(dist, "notes/infrastructure-foundation/index.html"), "utf8");
const noindexContent = await readFile(join(dist, "projects/vnext-foundation/index.html"), "utf8");
const tool = await readFile(join(dist, "tools/prime-factorizer/index.html"), "utf8");
const search = await readFile(join(dist, "search/index.html"), "utf8");
const errors: string[] = [];
if (/<astro-island\b/iu.test(contentOnly)) errors.push("content-only fixture unexpectedly contains an Astro island");
if (/search-client/iu.test(contentOnly)) errors.push("content-only fixture unexpectedly loads search JavaScript");
if (/<script\b(?![^>]*type="application\/ld\+json")/iu.test(contentOnly)) errors.push("content-only fixture unexpectedly contains executable JavaScript");
if (!contentOnly.includes("<title>検索向けvNext基盤ノート | Xpotato</title>")) errors.push("titleOverride missing from document title");
if (!/<meta\s+property="og:title"\s+content="検索向けvNext基盤ノート"/iu.test(contentOnly)) errors.push("titleOverride missing from OG title");
if (!/<meta\s+name="description"\s+content="SEO override metadataの実装fixtureです。"/iu.test(contentOnly)) errors.push("descriptionOverride missing from meta description");
if (!/<meta\s+property="og:description"\s+content="SEO override metadataの実装fixtureです。"/iu.test(contentOnly)) errors.push("descriptionOverride missing from OG description");
if (!/<link\s+rel="canonical"\s+href="https:\/\/xpotato\.net\/notes\/infrastructure-foundation\/"/iu.test(contentOnly)) errors.push("canonicalOverride missing from canonical link");
if (!/<h1>vNext基盤ノート<\/h1>/u.test(contentOnly)) errors.push("SEO override must not replace the visible editorial h1");
if (!/<meta\s+name="robots"\s+content="noindex"/iu.test(noindexContent)) errors.push("noindex content must render a noindex directive");
if (!/<astro-island\b/iu.test(tool)) errors.push("Tool fixture must resolve its registry-owned React island");
if (!/<astro-island\b[^>]*\bclient="visible"/iu.test(tool)) errors.push("Tool fixture hydration must be selected from the visible registry mode");
if (!/<meta\s+name="robots"\s+content="noindex"/iu.test(search)) errors.push("/search/ must be noindex");
if (!/search-client/iu.test(search)) errors.push("/search/ must load the search client");
if (!/<label\s+for="search-query"/iu.test(search) || !/aria-live="polite"/iu.test(search)) errors.push("search accessibility controls missing");
const indexFiles = (await readdir(join(dist, "search"))).filter((name) => name === "search-index.json");
if (indexFiles.length !== 1) errors.push("generated MiniSearch index missing");
for (const [route, html] of [["content fixture", contentOnly], ["noindex content fixture", noindexContent], ["Tool fixture", tool], ["search", search]] as const) {
  if (!/<html\s+lang="ja"/iu.test(html)) errors.push(`${route}: html language missing`);
  if (!/<title>[^<]+<\/title>/iu.test(html)) errors.push(`${route}: title missing`);
  if (!/<meta\s+name="description"/iu.test(html)) errors.push(`${route}: description missing`);
  if (!/<link\s+rel="canonical"/iu.test(html)) errors.push(`${route}: canonical missing`);
  if (!/<link\s+rel="canonical"\s+href="https:\/\/xpotato\.net\//iu.test(html)) errors.push(`${route}: canonical origin must be https://xpotato.net`);
  if (/xpotato\.jp/iu.test(html)) errors.push(`${route}: obsolete canonical origin found`);
  if (!/<main\b/iu.test(html) || !/<h1\b/iu.test(html)) errors.push(`${route}: landmark or h1 missing`);
}
const sitemap = await readFile(join(dist, "sitemap-0.xml"), "utf8");
if (sitemap.includes("/search/")) errors.push("/search/ must be excluded from sitemap");
if (sitemap.includes("/projects/vnext-foundation/")) errors.push("noindex content must be excluded from sitemap");
if (!sitemap.includes("/notes/infrastructure-foundation/")) errors.push("normal public content must be included in sitemap");
if (!sitemap.includes("https://xpotato.net/") || sitemap.includes("xpotato.jp")) errors.push("sitemap canonical origin mismatch");
const rss = await readFile(join(dist, "rss.xml"), "utf8");
if ((rss.match(/<item>/gu) ?? []).length > 20 || /<content:encoded/iu.test(rss)) errors.push("RSS must contain at most 20 summary-only items");
const scriptMetrics = await Promise.all(
  (await readdir(join(dist, "_astro")))
    .filter((name) => name.endsWith(".js"))
    .sort()
    .map(async (name) => ({ name, bytes: (await stat(join(dist, "_astro", name))).size })),
);
if (errors.length > 0) throw new Error(`Static validation failed:\n${errors.join("\n")}`);
console.log("Static validation PASS");
console.log(`Bundle measurement (no frozen byte threshold): ${JSON.stringify(scriptMetrics)}`);
