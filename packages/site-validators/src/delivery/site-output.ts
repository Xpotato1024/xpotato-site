import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import sax from "sax";
import {
  readPublicationHoldIds,
  assertPublicationHolds,
  publicationHoldsPath,
} from "@xpotato/portable-content/publication-holds";
import { isFeedEligible } from "@xpotato/portable-content/feed";
import { readSiteContent } from "../site-content.js";
import { validateEditorShell } from "./editor-runtime.js";
import { measureRouteRuntime, assertRuntimeIsolation } from "./route-runtime.js";
import { readSearchOutput } from "./search-output.js";
import { measureLocalServing } from "./local-serving.js";
import { readRegisteredToolRoutes } from "../browser-tools/tool-runtime-policy.js";
import {
  currentApplicationRedirects,
  redirectArtifact,
} from "../../../../content/registry/redirects.js";
import { articleUrlHistory } from "../../../../content/registry/article-url-history.js";
import { taxonomyRegistry } from "../../../../content/registry/taxonomy/index.js";
import { discoveryProfile } from "../../../../content/registry/discovery.js";
import { siteConfig } from "../../../../apps/site/src/shared/lib/site-config.js";
import {
  generateArchivePages,
  selectRelated,
  relatedScore,
} from "../../../../apps/site/src/features/discovery/model/discovery.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../.."),
  origin = siteConfig.site.canonicalOrigin;
const sorted = (values: readonly string[]) => [...values].sort();
export const validateRedirectGraph = (
  records: readonly { sourcePath: string; targetPath: string }[],
  canonical: readonly string[],
  targets: readonly string[],
) => {
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
const attr = (node: Node, key: string) =>
  "attrs" in node ? node.attrs.find((a) => a.name === key)?.value : undefined;
const elements = (
  node: Node,
  visit: (node: Node, literal: boolean) => void,
  literal = false,
): void => {
  const insideLiteral = literal || ("tagName" in node && ["pre", "code"].includes(node.tagName));
  visit(node, insideLiteral);
  if ("childNodes" in node)
    for (const child of node.childNodes) elements(child, visit, insideLiteral);
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
    if (node.tagName === "link" && attr(node, "rel") === "canonical")
      canonicals.push(attr(node, "href") ?? "");
    if (node.tagName === "meta" && attr(node, "name") === "robots")
      noindex = (attr(node, "content") ?? "").split(/[,\s]+/u).includes("noindex");
    if (node.tagName === "meta" && attr(node, "name") === "description")
      description = attr(node, "content") ?? "";
    if (node.tagName === "title")
      title = node.childNodes.map((child) => ("value" in child ? child.value : "")).join("");
    if (node.tagName === "a" && !literal && attr(node, "href")) anchors.push(attr(node, "href")!);
    const historical = attr(node, "data-historical-local-reference");
    if (historical) {
      assert.notEqual(node.tagName, "a", "Historical local references must not be clickable");
      historicalLocalReferences.push(historical);
    }
  });
  return { canonicals, noindex, description, title, anchors, historicalLocalReferences };
};

/** Indexable content keeps its SEO contract; the separately owned application shell must stay noindex. */
export const validateBuiltPageMetadata = (route: string, html: string) => {
  const metadata = inspectHtml(html);
  if (route === "/editor/") {
    assert.deepEqual(validateEditorShell(html), [], "Editor shell contract");
    assert.equal(metadata.noindex, true, "Editor must not enter discovery");
    assert.ok(metadata.title, "Editor title is required");
    assert.deepEqual(metadata.canonicals, [], "Editor shell does not claim an editorial canonical");
  } else {
    assert.deepEqual(
      metadata.canonicals,
      [new URL(route, origin).href],
      `Self canonical: ${route}`,
    );
    assert.ok(metadata.title && metadata.description, `SEO metadata: ${route}`);
  }
  return metadata;
};

/** Read the complete article-list region, without filtering against expected IDs. */
export const validateArchiveArticleRoutes = (html: string, expectedRoutes: readonly string[]) => {
  const routes: string[] = [];
  let lists = 0;
  const visit = (node: Node, insideList = false): void => {
    const articleList =
      "tagName" in node &&
      node.tagName === "ul" &&
      (attr(node, "class") ?? "").split(/\s+/u).includes("article-list");
    if (articleList) lists += 1;
    const inside = insideList || articleList;
    if (inside && "tagName" in node && node.tagName === "a") routes.push(attr(node, "href") ?? "");
    if ("childNodes" in node) for (const child of node.childNodes) visit(child, inside);
  };
  visit(parse(html));
  assert.equal(lists, expectedRoutes.length > 0 ? 1 : 0, "Archive article-list container count");
  assert.deepEqual(
    routes,
    expectedRoutes,
    "Archive article routes must exactly equal expected ordered set",
  );
};

export const semanticLinkUrl = (href: string, route: string): URL => {
  const url = new URL(href, new URL(route, origin));
  assert.ok(
    ["https:", "http:", "mailto:", "tel:"].includes(url.protocol),
    `Unsupported clickable URL: ${route} -> ${href}`,
  );
  if (["http:", "https:"].includes(url.protocol)) {
    assert.ok(
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
        !url.hostname.endsWith(".local"),
      `Internal-only clickable URL: ${href}`,
    );
  }
  return url;
};

const validateXml = (xml: string) => {
  sax.parser(true).write(xml).close();
};
const xmlValues = (xml: string, tag: string) =>
  [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)<\\/${tag}>`, "gu"))].map(
    (match) => match[1]!,
  );

/** Validate current output, never re-run a retired migration or manufacture a hypothetical site. */
export async function checkSiteOutput() {
  const dist = join(root, "apps/site/dist"),
    catalog = (await readSiteContent()).catalog;
  const holdIds = readPublicationHoldIds(
    JSON.parse(await readFile(join(root, publicationHoldsPath), "utf8")),
  );
  assertPublicationHolds(catalog, holdIds);
  const canonicalRoutes = catalog.map((e) => e.routeRecord.route);
  assert.equal(new Set(canonicalRoutes).size, catalog.length, "Duplicate content routes");
  assert.equal(
    new Set(catalog.map((e) => e.routeRecord.contentId)).size,
    catalog.length,
    "Duplicate ContentId",
  );
  const reserved = [
    "/",
    "/blog/",
    "/articles/",
    "/notes/",
    "/projects/",
    "/tools/",
    "/pages/",
    "/search/",
    "/rss.xml",
    "/404.html",
    "/editor/",
    "/editor-api/",
  ];
  for (const route of canonicalRoutes)
    assert.ok(
      !reserved.includes(route) &&
        !/^\/(?:articles|notes)\/(?:page|category|tag|subject|archive)\//u.test(route),
      "Reserved content route: " + route,
    );
  const htmlRoutes = new Map<string, { html: string; metadata: ReturnType<typeof inspectHtml> }>();
  for (const path of await readdir(dist, { recursive: true }))
    if (path.endsWith(".html")) {
      const route = "/" + path.replaceAll("\\", "/").replace(/index\.html$/u, ""),
        html = await readFile(join(dist, path), "utf8");
      assert.ok(
        !route.includes("__") && !route.includes("/private/"),
        "Private fixture route leaked",
      );
      htmlRoutes.set(route, { html, metadata: validateBuiltPageMetadata(route, html) });
    }
  for (const entry of catalog) {
    const built = htmlRoutes.get(entry.routeRecord.route);
    if (entry.disposition === "held_candidate")
      assert.ok(!built, "Held content emitted: " + entry.routeRecord.route);
    else {
      assert.ok(built, "Published canonical absent: " + entry.routeRecord.route);
      assert.equal(!built.metadata.noindex, entry.discoveryRecord.webIndexable);
    }
  }
  const provider = JSON.parse(
    await readFile(join(root, "content/registry/provider-redirects.json"), "utf8"),
  ) as {
    schemaVersion: number;
    records: {
      id: string;
      contentId: string;
      match: { kind: string; path: string; query: { p: string } };
      targetUrl: string;
      permanent: boolean;
    }[];
  };
  assert.equal(provider.schemaVersion, 1);
  assert.equal(provider.records.length, 3);
  assert.equal(new Set(provider.records.map((r) => r.id)).size, provider.records.length);
  for (const row of provider.records) {
    assert.equal(row.match.kind, "query");
    assert.equal(row.match.path, "/");
    assert.match(row.match.query.p, /^\d+$/);
    assert.deepEqual(Object.keys(row.match.query), ["p"]);
    assert.equal(row.permanent, true);
    const url = new URL(row.targetUrl);
    assert.equal(url.origin, new URL(origin).origin);
    assert.equal(url.search, "");
    assert.equal(url.hash, "");
    const route =
      articleUrlHistory.find((h) => h.sourcePath === url.pathname)?.targetPath ?? url.pathname;
    assert.ok(
      catalog.some(
        (e) => e.routeRecord.contentId === row.contentId && e.routeRecord.route === route,
      ),
      "Provider query target identity changed",
    );
  }
  const redirects = currentApplicationRedirects(catalog);
  validateRedirectGraph(redirects, canonicalRoutes, [...htmlRoutes.keys()]);
  assert.equal(await readFile(join(dist, "_redirects"), "utf8"), redirectArtifact(redirects));
  for (const redirect of redirects)
    assert.ok(!htmlRoutes.has(redirect.sourcePath), "Redirect source emitted as page");
  const sitemap = await readFile(join(dist, "sitemap-0.xml"), "utf8");
  validateXml(sitemap);
  const sitemapUrls = xmlValues(sitemap, "loc");
  assert.equal(new Set(sitemapUrls).size, sitemapUrls.length, "Duplicate sitemap URL");
  assert.deepEqual(
    sorted(sitemapUrls),
    sorted(
      [...htmlRoutes]
        .filter(([, page]) => !page.metadata.noindex)
        .map(([route]) => new URL(route, origin).href),
    ),
    "Sitemap must equal indexable routes",
  );
  assert.equal(
    await readFile(join(dist, "robots.txt"), "utf8"),
    "User-agent: *\nAllow: /\nSitemap: " + origin + "sitemap-index.xml\n",
  );
  for (const route of ["/404.html", "/search/", "/editor/"])
    assert.equal(
      htmlRoutes.get(route)?.metadata.noindex,
      true,
      "Application/error page must be noindex: " + route,
    );
  const records = catalog.map((e) => e.discoveryRecord).filter((r) => r.webIndexable),
    archives = generateArchivePages(records, taxonomyRegistry);
  for (const archive of archives) {
    const built = htmlRoutes.get(archive.route);
    assert.ok(built, "Missing archive: " + archive.route);
    assert.equal(built.metadata.noindex, archive.noindex);
    validateArchiveArticleRoutes(
      built.html,
      archive.items.map((i) => i.route),
    );
    assert.ok(!archive.route.includes("/page/1/"));
    assert.ok(archive.scope.kind === "root" || archive.items.length > 0);
  }
  const isArchive = (route: string) =>
    ["/articles/", "/notes/"].includes(route) ||
    /^\/(?:articles|notes)\/(?:page|category|tag|subject|archive)\//u.test(route);
  assert.deepEqual(
    sorted([...htmlRoutes.keys()].filter(isArchive)),
    sorted(archives.map((p) => p.route)),
    "Archive route set differs from catalog",
  );
  const rss = await readFile(join(dist, "rss.xml"), "utf8");
  validateXml(rss);
  const items = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/gu)].map((m) => m[1]!);
  const feed = records
    .filter(isFeedEligible)
    .sort(
      (a, b) =>
        (b.pubDate ?? "").localeCompare(a.pubDate ?? "") || a.contentId.localeCompare(b.contentId),
    )
    .slice(0, discoveryProfile.feed.maxItems);
  assert.deepEqual(
    items.flatMap((item) => xmlValues(item, "link")),
    feed.map((r) => new URL(r.route, origin).href),
  );
  assert.deepEqual(
    items.flatMap((item) => xmlValues(item, "guid")),
    feed.map((r) => origin + "#" + r.contentId),
  );
  assert.ok(!rss.includes("content:encoded"));
  for (const record of records) {
    const related = selectRelated(record, records, taxonomyRegistry);
    assert.ok(related.length <= discoveryProfile.related.maxItems);
    assert.ok(
      related.every(
        (item) =>
          item.contentId !== record.contentId &&
          relatedScore(record, item, taxonomyRegistry) >= discoveryProfile.related.minimumScore,
      ),
    );
  }
  const runtime = await Promise.all(
    [...htmlRoutes].map(([route, page]) => measureRouteRuntime(dist, route, page.html)),
  );
  assertRuntimeIsolation(runtime, await readRegisteredToolRoutes());
  for (const [route, { metadata }] of htmlRoutes)
    for (const href of metadata.anchors) {
      const url = semanticLinkUrl(href, route);
      if (url.origin !== new URL(origin).origin) continue;
      assert.ok(
        !redirects.some((r) => r.sourcePath === url.pathname),
        "Internal link uses redirect: " + href,
      );
      assert.ok(
        !catalog.some(
          (e) => e.routeRecord.route === url.pathname && e.disposition === "held_candidate",
        ),
        "Internal link exposes held article: " + href,
      );
      assert.ok(
        htmlRoutes.has(url.pathname) ||
          (await readFile(join(dist, url.pathname)).then(
            () => true,
            () => false,
          )),
        "Broken internal link: " + route + " -> " + href,
      );
    }
  const search = await readSearchOutput(dist);
  assert.deepEqual(
    search.index.documents,
    catalog
      .filter((e) => e.discoveryRecord.siteSearchEligible)
      .map((e) => ({
        id: e.routeRecord.contentId,
        route: e.routeRecord.route,
        title: e.discoveryRecord.title,
        collection: e.routeRecord.collection,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    "Search index differs from eligible catalog",
  );
  const serving = await measureLocalServing();
  return {
    providerRequirements: provider.records.length,
    pages: htmlRoutes.size,
    content: catalog.length,
    holds: holdIds.length,
    archives: archives.length,
    sitemap: sitemapUrls.length,
    search: search.index.documentCount,
    serving,
  };
}
