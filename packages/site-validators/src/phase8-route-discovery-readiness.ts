import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import sax from "sax";
import { providerRedirectRequirementSchema } from "@xpotato/content-contracts";
import { fingerprint, sha256 } from "@xpotato/content-contracts/canonical";
import { generateLegacyInventory, inventoryEndpointPaths, validateBaselineAgainstInventory, verifyLegacyTagIdentity } from "./legacy-inventory.js";
import { applicationRedirects, redirectArtifact } from "../../../apps/site/src/content-registry/redirects.js";
import { taxonomyRegistry } from "../../../apps/site/src/content-registry/taxonomy/index.js";
import { discoveryProfile } from "../../../apps/site/src/content-registry/discovery.js";
import { deriveContentCatalog, type CatalogSourceRecord } from "../../../apps/site/src/lib/catalog.js";
import { siteConfig } from "../../../apps/site/src/lib/site-config.js";
import { selectRelated, relatedScore, generateArchivePages } from "../../../apps/site/src/lib/discovery.js";
import { renderRssFeed } from "../../../apps/site/src/lib/rss.js";
import { measureRouteRuntime, assertRuntimeIsolation } from "./phase8-runtime.js";
import { buildPhase8SearchEvidence } from "./phase8-search-evidence.js";
import { measureLocalServing } from "./phase8-serving.js";

export const phase8Root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const dist = join(phase8Root, "apps/site/dist");
const origin = siteConfig.site.canonicalOrigin;
export const phase8ManifestPath = join(phase8Root, "docs/migration/phase8-route-discovery-readiness-v1.json");
const json = async (path: string) => JSON.parse(await readFile(join(phase8Root, path), "utf8"));
const sorted = (values: readonly string[]) => [...values].sort();
const setEvidence = (values: readonly string[]) => ({ count: values.length, values: sorted(values), sha256: fingerprint(sorted(values)) });
const walk = async (directory: string): Promise<string[]> => {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files.sort();
};

export const readPhase8Catalog = async () => {
  const sources: CatalogSourceRecord[] = [];
  for (const collection of ["blog", "notes", "projects", "tools", "pages"] as const) {
    const directory = join(phase8Root, "apps/site/src/content", collection);
    for (const path of await walk(directory)) {
      if (!/\.mdx?$/u.test(path)) continue;
      const source = await readFile(path, "utf8");
      const match = /^---\r?\n([\s\S]+?)\r?\n---/u.exec(source);
      assert.ok(match, `Missing frontmatter ${path}`);
      sources.push({ collection, slug: relative(directory, path).replaceAll("\\", "/").replace(/\.mdx?$/u, ""), data: parseYaml(match[1]!) } as CatalogSourceRecord);
    }
  }
  return deriveContentCatalog(sources, taxonomyRegistry);
};

export const validateRedirectGraph = (records: readonly { sourcePath: string; targetPath: string }[], canonical: readonly string[], targets: readonly string[]) => {
  const sources = records.map((r) => r.sourcePath);
  assert.equal(new Set(sources).size, sources.length, "Redirect source must be unique");
  for (const record of records) {
    assert.notEqual(record.sourcePath, record.targetPath, "Redirect self loop");
    assert.ok(!sources.includes(record.targetPath), "Redirect cycle or avoidable chain");
    assert.ok(!canonical.includes(record.sourcePath), "Canonical route is redirect source");
    assert.ok(targets.includes(record.targetPath), `Redirect target absent: ${record.targetPath}`);
  }
};

type Node = DefaultTreeAdapterMap["node"];
const attr = (node: Node, key: string) => "attrs" in node ? node.attrs.find((a) => a.name === key)?.value : undefined;
const elements = (node: Node, visit: (node: Node, literal: boolean) => void, literal = false): void => {
  const insideLiteral = literal || ("tagName" in node && ["pre", "code"].includes(node.tagName));
  visit(node, insideLiteral);
  if ("childNodes" in node) for (const child of node.childNodes) elements(child, visit, insideLiteral);
};

export const inspectHtml = (html: string) => {
  const canonicals: string[] = [];
  const anchors: string[] = [];
  const historicalLocalReferences: string[] = [];
  let noindex = false;
  let description = "";
  let title = "";
  elements(parse(html), (node, literal) => {
    if (!("tagName" in node)) return;
    if (node.tagName === "link" && attr(node, "rel") === "canonical") canonicals.push(attr(node, "href") ?? "");
    if (node.tagName === "meta" && attr(node, "name") === "robots") noindex = (attr(node, "content") ?? "").split(/[,\s]+/u).includes("noindex");
    if (node.tagName === "meta" && attr(node, "name") === "description") description = attr(node, "content") ?? "";
    if (node.tagName === "title") title = node.childNodes.map((child) => "value" in child ? child.value : "").join("");
    if (node.tagName === "a" && !literal && attr(node, "href")) anchors.push(attr(node, "href")!);
    const historical = attr(node, "data-historical-local-reference");
    if (historical) {
      assert.notEqual(node.tagName, "a", "Historical local references must not be clickable");
      historicalLocalReferences.push(historical);
    }
  });
  return { canonicals, noindex, description, title, anchors, historicalLocalReferences };
};

export const semanticLinkUrl = (href: string, route: string): URL => {
  const url = new URL(href, new URL(route, origin));
  assert.ok(["https:", "http:", "mailto:", "tel:"].includes(url.protocol), `Unsupported clickable URL: ${route} -> ${href}`);
  if (["http:", "https:"].includes(url.protocol)) {
    assert.ok(!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && !url.hostname.endsWith(".local"), `Internal-only clickable URL: ${href}`);
  }
  return url;
};

const validateXml = (xml: string) => { sax.parser(true).write(xml).close(); };
const xmlValues = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)<\\/${tag}>`, "gu"))].map((match) => match[1]!);

export const buildPhase8Readiness = async () => {
  const baseline = await json("tests/fixtures/migration/legacy-freeze-baseline.json");
  assert.deepEqual(verifyLegacyTagIdentity(phase8Root, baseline), []);
  const legacy = generateLegacyInventory(phase8Root, { generatedAt: "2000-01-01T00:00:00.000Z" });
  assert.deepEqual(validateBaselineAgainstInventory(baseline, legacy), []);
  assert.equal(fingerprint(inventoryEndpointPaths(legacy)), baseline.legacyBuild.endpointPathsSha256);
  const catalog = await readPhase8Catalog();
  const canonicalRoutes = catalog.map((item) => item.routeRecord.route);
  assert.equal(new Set(canonicalRoutes).size, catalog.length);
  assert.equal(new Set(catalog.map((item) => item.routeRecord.contentId)).size, catalog.length);
  const reserved = ["/", "/blog/", "/notes/", "/projects/", "/tools/", "/pages/", "/search/", "/rss.xml", "/404.html"];
  for (const route of canonicalRoutes) {
    assert.ok(!reserved.includes(route) && !/^\/(?:blog|notes)\/(?:page|category|tag|subject|archive)\//u.test(route), `Reserved route collision: ${route}`);
  }
  const materialized = await json("docs/migration/content-materialization-v1.json") as { records: { legacyContentId: string; vNextContentId: string; collection: string; targetPath: string; publicationHoldReasons: string[] }[] };
  const mapping = await json("docs/migration/content-id-map-v1.json");
  for (const record of materialized.records) {
    const entry = catalog.find((item) => item.routeRecord.contentId === record.vNextContentId);
    assert.ok(entry, `Lost materialized content ${record.legacyContentId}`);
    assert.ok(mapping.entries.some((m: { legacyContentId: string; vNextContentId: string }) => m.legacyContentId === record.legacyContentId && m.vNextContentId === record.vNextContentId));
    if (record.collection === "blog") assert.equal(entry.disposition, "held_candidate", "Phase 8 cannot lift migrated Blog hold");
  }
  const htmlRoutes = new Map<string, { html: string; metadata: ReturnType<typeof inspectHtml> }>();
  for (const path of (await walk(dist)).filter((path) => path.endsWith(".html"))) {
    const file = relative(dist, path).replaceAll("\\", "/");
    const route = `/${file.replace(/index\.html$/u, "")}`;
    const html = await readFile(path, "utf8");
    const metadata = inspectHtml(html);
    assert.deepEqual(metadata.canonicals, [new URL(route, origin).href], `Self canonical: ${route}`);
    assert.ok(metadata.title && metadata.description, `SEO metadata: ${route}`);
    assert.ok(!route.includes("__phase8_fixture"), "Preview fixture leaked into production output");
    htmlRoutes.set(route, { html, metadata });
  }
  for (const entry of catalog) {
    const built = htmlRoutes.get(entry.routeRecord.route);
    if (entry.disposition === "held_candidate") assert.ok(!built, `Held content emitted: ${entry.routeRecord.route}`);
    else {
      assert.ok(built, `Published canonical absent: ${entry.routeRecord.route}`);
      assert.equal(!built.metadata.noindex, entry.discoveryRecord.webIndexable);
    }
  }
  validateRedirectGraph(applicationRedirects, canonicalRoutes, [...htmlRoutes.keys()]);
  assert.equal(await readFile(join(dist, "_redirects"), "utf8"), redirectArtifact());
  for (const redirect of applicationRedirects) assert.ok(!htmlRoutes.has(redirect.sourcePath), "Duplicate old redirect body emitted");
  const providerRequirements = legacy.routes.filter((r) => r.urlPath.includes("?")).map((record) => {
    const url = new URL(record.urlPath, origin);
    const entry = catalog.find((c) => c.routeRecord.route === record.target);
    assert.ok(entry, `Query identity target binding absent: ${record.urlPath}`);
    return providerRedirectRequirementSchema.parse({ id: `wordpress-${url.searchParams.get("p")}`, match: { kind: "query", path: url.pathname, query: Object.fromEntries(url.searchParams) }, targetUrl: new URL(entry.routeRecord.route, origin).href, permanent: true, reason: "frozen_wordpress_query_identity", contentId: entry.routeRecord.contentId });
  });
  const dispositions = legacy.routes.map((record) => {
    const redirect = applicationRedirects.find((r) => r.sourcePath === record.urlPath);
    const provider = providerRequirements.find((r) => r.match.kind === "query" && `${r.match.path}?${new URLSearchParams(r.match.query)}` === record.urlPath);
    const target = redirect?.targetPath ?? (provider ? new URL(provider.targetUrl).pathname : record.urlPath);
    const entry = catalog.find((c) => c.routeRecord.route === target);
    const disposition = record.urlPath === "/404.html" ? "not_public" : provider ? "provider_redirect" : redirect ? "application_redirect" : "same";
    if (disposition === "same" && !entry) assert.ok(htmlRoutes.has(target) || ["/robots.txt", "/sitemap-0.xml", "/sitemap-index.xml"].includes(target), `Unclassified missing legacy route: ${record.urlPath}`);
    return {
      legacyRoute: record.urlPath, legacyRouteKind: record.sourceKind,
      legacyIdentity: materialized.records.find((m) => m.vNextContentId === entry?.routeRecord.contentId)?.legacyContentId ?? record.urlPath,
      contentId: entry?.routeRecord.contentId ?? null, currentCanonicalRoute: target, disposition,
      applicationRedirectId: redirect?.id ?? null, providerRequirementId: provider?.id ?? null, retirementReason: null,
      publicationState: entry?.disposition ?? "non_content",
      indexability: disposition === "not_public" ? "noindex_404" : redirect || provider ? "redirect_source_excluded" : entry?.disposition === "held_candidate" ? "excluded_publication_hold" : htmlRoutes.get(target)?.metadata.noindex ? "noindex" : htmlRoutes.has(target) ? "indexable_self_canonical" : "discovery_endpoint_not_html",
      evidenceSource: { frozenCommit: baseline.commitSha, inventoryPayloadSha256: legacy.inventoryPayloadSha256, identityMap: "docs/migration/content-id-map-v1.json", routeContract: "docs/contracts/route-slug-redirect-contract.md" },
    };
  });
  assert.equal(new Set(dispositions.map((r) => r.legacyRoute)).size, legacy.routes.length);
  const sitemap = await readFile(join(dist, "sitemap-0.xml"), "utf8");
  validateXml(sitemap);
  const sitemapUrls = xmlValues(sitemap, "loc");
  assert.equal(new Set(sitemapUrls).size, sitemapUrls.length);
  const expectedSitemap = [...htmlRoutes].filter(([, record]) => !record.metadata.noindex).map(([route]) => new URL(route, origin).href);
  assert.deepEqual(sorted(sitemapUrls), sorted(expectedSitemap), "Sitemap must equal current indexable self-canonical set");
  const robots = await readFile(join(dist, "robots.txt"), "utf8");
  assert.equal(robots, `User-agent: *\nAllow: /\nSitemap: ${origin}sitemap-index.xml\n`);
  assert.equal(htmlRoutes.get("/404.html")?.metadata.noindex, true);
  assert.equal(htmlRoutes.get("/search/")?.metadata.noindex, true);
  const rss = await readFile(join(dist, "rss.xml"), "utf8");
  validateXml(rss);
  const rssItems = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/gu)].map((m) => m[1]!);
  const publicRecords = catalog.map((entry) => entry.discoveryRecord).filter((record) => record.webIndexable);
  const currentArchives = generateArchivePages(publicRecords, taxonomyRegistry);
  for (const archive of currentArchives) {
    const built = htmlRoutes.get(archive.route);
    assert.ok(built, `Archive not emitted: ${archive.route}`);
    assert.equal(built.metadata.noindex, archive.noindex);
    assert.deepEqual(built.metadata.anchors.filter((href) => archive.items.some((item) => item.route === href)), archive.items.map((item) => item.route), `Archive ordered content set: ${archive.route}`);
    assert.ok(!archive.route.includes("/page/1/"));
    assert.ok(archive.scope.kind === "root" || archive.items.length > 0);
  }
  const migratedIds = new Set(materialized.records.map((record) => record.vNextContentId));
  // Hypothetical, offline-only projection. No draft source or production selection is changed.
  const candidateRecords = catalog.filter((entry) => entry.disposition === "published" || migratedIds.has(entry.routeRecord.contentId)).map((entry) => ({ ...entry.discoveryRecord, webIndexable: entry.source.data.seo?.noindex !== true, siteSearchEligible: entry.source.data.seo?.noindex !== true }));
  const candidateArchives = generateArchivePages(candidateRecords, taxonomyRegistry);
  const archiveSummary = (pages: ReturnType<typeof generateArchivePages>) => pages.map(({ items: _items, ...page }) => page);
  const candidateBlogPages = candidateArchives.filter((page) => page.collection === "blog" && page.scope.kind === "root");
  assert.deepEqual(candidateBlogPages.map((page) => page.itemContentIds.length), [12, 12, 12, 8]);
  assert.equal(new Set(candidateBlogPages.flatMap((page) => page.itemContentIds)).size, 44);
  const newest = (a: { pubDate?: string | undefined; contentId: string }, b: { pubDate?: string | undefined; contentId: string }) => (b.pubDate ?? "").localeCompare(a.pubDate ?? "") || a.contentId.localeCompare(b.contentId);
  const expectedFeed = publicRecords.filter((r) => r.collection === "blog").sort(newest).slice(0, discoveryProfile.feed.maxItems);
  const candidateFeed = candidateRecords.filter((record) => record.collection === "blog" && record.webIndexable).sort(newest).slice(0, discoveryProfile.feed.maxItems);
  const candidateRss = renderRssFeed(candidateRecords, taxonomyRegistry, { ...siteConfig.site, description: siteConfig.site.defaultDescription });
  validateXml(candidateRss);
  const candidateRssItems = [...candidateRss.matchAll(/<item>([\s\S]*?)<\/item>/gu)].map((m) => m[1]!);
  assert.equal(candidateRssItems.length, 20);
  assert.deepEqual(candidateRssItems.flatMap((item) => xmlValues(item, "link")), candidateFeed.map((r) => new URL(r.route, origin).href));
  assert.deepEqual(candidateRssItems.flatMap((item) => xmlValues(item, "guid")), candidateFeed.map((r) => `${origin}#${r.contentId}`));
  assert.ok(!candidateRss.includes("content:encoded"));
  assert.deepEqual(rssItems.flatMap((item) => xmlValues(item, "link")), expectedFeed.map((r) => new URL(r.route, origin).href));
  assert.deepEqual(rssItems.flatMap((item) => xmlValues(item, "guid")), expectedFeed.map((r) => `${origin}#${r.contentId}`));
  assert.ok(!rss.includes("content:encoded"));
  const related = publicRecords.map((record) => ({ contentId: record.contentId, items: selectRelated(record, publicRecords, taxonomyRegistry).map((item) => ({ contentId: item.contentId, route: item.route, score: relatedScore(record, item, taxonomyRegistry) })) }));
  for (const record of related) { assert.ok(record.items.length <= 4); assert.ok(record.items.every((item) => item.contentId !== record.contentId && item.score >= 4)); }
  const candidateRelated = candidateRecords.filter((record) => record.webIndexable).map((record) => ({ contentId: record.contentId, items: selectRelated(record, candidateRecords, taxonomyRegistry).map((item) => ({ contentId: item.contentId, route: item.route, score: relatedScore(record, item, taxonomyRegistry) })) }));
  for (const record of candidateRelated) { assert.ok(record.items.length <= 4); assert.ok(record.items.every((item) => item.contentId !== record.contentId && item.score >= 4)); }
  const runtime = await Promise.all([...htmlRoutes].map(([route, { html }]) => measureRouteRuntime(dist, route, html)));
  assertRuntimeIsolation(runtime);
  assert.ok(process.env.XPOTATO_PHASE8_TEMP_ROOT, "Held Blog emitted graph fixture build is required");
  const previewRoot = join(process.env.XPOTATO_PHASE8_TEMP_ROOT, "preview");
  const heldEntries = catalog.filter((entry) => entry.routeRecord.collection === "blog" && entry.disposition === "held_candidate");
  const heldPages = await Promise.all(heldEntries.map(async (entry) => {
    const fixtureRoute = `/__phase8_fixture${entry.routeRecord.route}`;
    const html = await readFile(join(previewRoot, fixtureRoute, "index.html"), "utf8");
    const metadata = inspectHtml(html);
    assert.equal(metadata.noindex, true, "Private fixture must be noindex");
    const runtime = await measureRouteRuntime(previewRoot, fixtureRoute, html);
    assert.equal(runtime.islands + runtime.assets.length + runtime.executableInlineScripts, 0);
    return { contentId: entry.routeRecord.contentId, route: entry.routeRecord.route, fixtureRoute, metadata, runtime };
  }));
  assert.equal((await walk(join(previewRoot, "__phase8_fixture/blog"))).filter((path) => path.endsWith(".html")).length, heldEntries.length);
  assertRuntimeIsolation([...runtime, ...heldPages.map((page) => page.runtime)]);
  const internalLinks: { source: string; target: string }[] = [];
  const unresolvedHeldLinks: { source: string; target: string }[] = [];
  for (const [route, { metadata }] of htmlRoutes) {
    for (const href of metadata.anchors) {
      const url = semanticLinkUrl(href, route);
      if (url.origin !== new URL(origin).origin) continue;
      assert.ok(!applicationRedirects.some((r) => r.sourcePath === url.pathname), `Semantic internal link uses redirect source: ${route} -> ${href}`);
      assert.ok(!providerRequirements.some((r) => r.match.kind === "query" && r.match.path === url.pathname && Object.entries(r.match.query).every(([key, value]) => url.searchParams.get(key) === value)), `Semantic internal link uses provider query identity: ${route} -> ${href}`);
      if (catalog.some((c) => c.routeRecord.route === url.pathname && c.disposition === "held_candidate")) { unresolvedHeldLinks.push({ source: route, target: url.pathname }); continue; }
      const file = join(dist, url.pathname);
      assert.ok(htmlRoutes.has(url.pathname) || (await readFile(file).then(() => true).catch(() => false)), `Broken internal link: ${route} -> ${href}`);
      internalLinks.push({ source: route, target: url.pathname });
    }
  }
  assert.deepEqual(unresolvedHeldLinks, [], "Public routes must not link to unbuilt held Blog details");
  const candidateTargets = new Set([...canonicalRoutes, ...candidateArchives.map((page) => page.route), ...htmlRoutes.keys()]);
  const heldInternalLinks: { source: string; target: string }[] = [];
  const historicalLocalReferences: { contentId: string; source: string; uri: string; disposition: string }[] = [];
  for (const page of heldPages) {
    for (const href of page.metadata.anchors) {
      const url = semanticLinkUrl(href, page.route);
      if (url.origin !== new URL(origin).origin) continue;
      assert.ok(!applicationRedirects.some((record) => record.sourcePath === url.pathname), `Held semantic link uses redirect source: ${page.route} -> ${href}`);
      assert.ok(!providerRequirements.some((record) => record.match.kind === "query" && record.match.path === url.pathname && Object.entries(record.match.query).every(([key, value]) => url.searchParams.get(key) === value)), `Held semantic link uses query identity: ${href}`);
      assert.ok(candidateTargets.has(url.pathname) || await readFile(join(dist, url.pathname)).then(() => true).catch(() => false), `Unresolved held semantic link: ${page.route} -> ${href}`);
      heldInternalLinks.push({ source: page.route, target: url.pathname });
    }
    const slug = page.route.replace(/^\/blog\//u, "").replace(/\/$/u, "");
    const sourceBase = join(phase8Root, "apps/site/src/content/blog", slug);
    const source = await readFile(`${sourceBase}.mdx`, "utf8").catch(() => readFile(`${sourceBase}.md`, "utf8"));
    for (const uri of page.metadata.historicalLocalReferences) {
      assert.ok(source.includes(`](${uri})`), "Historical reference URI must retain exact source evidence");
      historicalLocalReferences.push({ contentId: page.contentId, source: page.route, uri, disposition: "historical_local_artifact_literal_not_link" });
    }
  }
  const safetySource = await readFile(join(phase8Root, ".github/workflows/deploy-site.yml"), "utf8");
  assert.match(safetySource, /^\s*if:\s*\$\{\{ false \}\}\s*$/mu);
  const media = await json("docs/migration/media-repository-candidate-v1.json");
  assert.ok(JSON.stringify(media).includes('"persistentMutationAuthorized":false'));
  const search = await buildPhase8SearchEvidence(dist);
  assert.deepEqual(search.index.documents.map((doc) => ({ id: doc.id, route: doc.route, title: doc.title, collection: doc.collection })), catalog.filter((entry) => entry.discoveryRecord.siteSearchEligible).map((entry) => ({ id: entry.routeRecord.contentId, route: entry.routeRecord.route, title: entry.discoveryRecord.title, collection: entry.routeRecord.collection })).sort((a, b) => a.id.localeCompare(b.id)), "Serialized search index must exactly equal eligible ContentId/route/title set");
  const payload = {
    schemaVersion: 1, evidenceVersion: "phase8-route-discovery-readiness-v1",
    frozenLegacyAuthority: { repository: baseline.repository, tag: baseline.tag, tagObjectSha: baseline.tagObjectSha, commitSha: baseline.commitSha, inventoryPayloadSha256: legacy.inventoryPayloadSha256, endpointPathsSha256: fingerprint(inventoryEndpointPaths(legacy)), reproducedBuildEvidence: "tests/fixtures/migration/legacy-freeze-baseline.json" },
    legacyPublicRouteCount: dispositions.length, legacyBuiltEndpointCount: inventoryEndpointPaths(legacy).length,
    dispositionCounts: Object.fromEntries(["same", "application_redirect", "provider_redirect", "retired", "not_public"].map((d) => [d, dispositions.filter((r) => r.disposition === d).length])),
    routeDispositions: dispositions, canonicalContentRoutes: setEvidence(canonicalRoutes), canonicalCurrentHtmlRoutes: setEvidence([...htmlRoutes].filter(([, h]) => !h.metadata.noindex).map(([route]) => route)),
    contentRouteRecords: catalog.map((entry) => ({ ...entry.routeRecord, publicationState: entry.disposition, discovery: entry.discoveryRecord })),
    applicationRedirects, applicationRedirectArtifact: { path: "_redirects", sha256: sha256(redirectArtifact()), servingContract: "Workers Static Assets native _redirects; local GET/HEAD status=301 verified by phase8:serving:check; production activation NOT RUN" },
    localServing: await measureLocalServing(),
    providerRedirectRequirements: providerRequirements, providerRedirectActivation: "NOT_RUN_PHASE9", retiredRoutes: [],
    sitemap: setEvidence(sitemapUrls), robots: { sha256: sha256(robots), unexpectedDisallow: false },
    notFound: { route: "/404.html", noindex: true, sitemapEligible: false, searchEligible: false, assetsNotFoundHandling: "404-page", productionReadback: "NOT_RUN" },
    archives: { profile: discoveryProfile.pagination, current: archiveSummary(currentArchives), offlineCandidateOnly: archiveSummary(candidateArchives), legacyPaginationRoutes: [], legacyTagArchiveRoutes: [], emptyTaxonomyPagesGenerated: false, outOfRange: "404 (local serving check)", candidateDoesNotAuthorizePublication: true },
    rss: { profile: discoveryProfile.feed, itemCount: rssItems.length, contentIds: expectedFeed.map((r) => r.contentId), validXml: true, sha256: sha256(rss), offlineCandidateXml: { validXml: true, sha256: sha256(candidateRss), itemCount: candidateRssItems.length }, offlineCandidateOnly: candidateFeed.map((r) => ({ contentId: r.contentId, canonicalUrl: new URL(r.route, origin).href, pubDate: r.pubDate, description: r.description })), legacyContinuity: "Frozen legacy had no RSS endpoint; vNext Blog summary feed added. Held Blogs excluded." },
    related: { profile: discoveryProfile.related, records: related, sha256: fingerprint(related), offlineCandidateOnly: candidateRelated, candidateSha256: fingerprint(candidateRelated), legacyAdr0031SemanticsApplied: false },
    search, runtimeIsolation: { routes: runtime, heldBlogFixture: { status: "MEASURED_ALL_HELD_PRIVATE_FIXTURES", count: heldPages.length, productionDraftChanged: false, routes: heldPages.map(({ contentId, route, runtime }) => ({ contentId, canonicalCandidate: route, ...runtime })) } },
    internalLinks: { checkedSemanticAnchorCount: internalLinks.length, sha256: fingerprint(internalLinks), unresolvedHeldLinks, heldContent: { renderedCount: heldPages.length, checkedSemanticAnchorCount: heldPages.reduce((count, page) => count + page.metadata.anchors.length, 0), sameSiteLinks: heldInternalLinks, historicalLocalReferences, sourceBytesChanged: false, unresolvedSameSiteLinks: [] }, literalCodeUrlsRewritten: false },
    blogPublicationHold: { migratedCount: materialized.records.filter((r) => r.collection === "blog").length, released: false, candidateRoutesNotPublishable: true, cutoverGate: "Phase 9 media provider persistence/read-back/protection/recovery and explicit publication authorization" },
    safety: { persistentMutationAuthorized: false, providerMutation: false, productionDeploy: false, productionCutover: false, legacyDeletion: false, deployWorkflowGate: "if: ${{ false }}" },
  };
  return { ...payload, manifestPayloadSha256: fingerprint(payload) };
};

export const writePhase8Readiness = async () => {
  const manifest = await buildPhase8Readiness();
  await writeFile(phase8ManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
};
export const checkPhase8Readiness = async () => {
  const manifest = await buildPhase8Readiness();
  assert.equal(await readFile(phase8ManifestPath, "utf8"), `${JSON.stringify(manifest, null, 2)}\n`, "Phase 8 committed bytes differ from exact regeneration");
  return manifest;
};
