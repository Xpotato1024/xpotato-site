import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { deriveContentCatalog, selectSearchEligibleCatalog, selectWebIndexableCatalog, type CatalogSourceRecord, type DerivedCatalogEntry } from "../../../apps/site/src/lib/catalog.js";
import { generateArchivePages } from "../../../apps/site/src/lib/discovery.js";
import { renderRssFeed } from "../../../apps/site/src/lib/rss.js";
import { taxonomyRegistry } from "../../../apps/site/src/content-registry/taxonomy/index.js";
import { siteConfig } from "../../../apps/site/src/lib/site-config.js";
import { buildSearchDocumentsFromHtmlPages } from "../../../apps/site/src/search/html.js";
import { readPhase8Catalog } from "./phase8-route-discovery-readiness.js";
import { projectMigrationDiscovery, selectMigrationCohort, type MigrationIdentity } from "./migration-cohort.js";

let catalog: DerivedCatalogEntry[];
let records: MigrationIdentity[];
let identities: MigrationIdentity[];
beforeAll(async () => {
  catalog = await readPhase8Catalog();
  records = JSON.parse(await readFile(new URL("../../../docs/migration/content-materialization-v1.json", import.meta.url), "utf8")).records;
  identities = JSON.parse(await readFile(new URL("../../../docs/migration/content-id-map-v1.json", import.meta.url), "utf8")).entries;
});
const articles = (count: number, draft = false, noindex = false) =>
  deriveContentCatalog(Array.from({ length: count }, (_, index): CatalogSourceRecord => ({
    collection: "blog", slug: "new-article-" + index,
    data: { id: "90000000-0000-4000-8000-" + String(index).padStart(12, "0"), title: "追加記事" + index,
      description: "人工fixture", pubDate: "2026-10-15", category: "software", tags: [], draft,
      ...(noindex ? { seo: { noindex: true } } : {}) },
  })), taxonomyRegistry);
const roots = (entries: readonly DerivedCatalogEntry[]) => generateArchivePages(
  selectWebIndexableCatalog(entries).map((entry) => entry.discoveryRecord), taxonomyRegistry,
).filter((page) => page.collection === "blog" && page.scope.kind === "root");

describe("frozen migration / current publication separation", () => {
  it.each([1, 13, 25])("adds %i new articles without changing migration evidence", (count) => {
    const added = articles(count);
    const current = [...catalog, ...added];
    const before = selectMigrationCohort(catalog, records, identities);
    const after = selectMigrationCohort(current, records, identities);
    expect(projectMigrationDiscovery(after)).toEqual(projectMigrationDiscovery(before));
    const legacyPages = generateArchivePages(projectMigrationDiscovery(after), taxonomyRegistry)
      .filter((page) => page.collection === "blog" && page.scope.kind === "root");
    expect(legacyPages.map((page) => page.items.length)).toEqual([12, 12, 12, 8]);
    expect(roots(current).map((page) => page.items.length)).toEqual(count === 1 ? [1] : count === 13 ? [12, 1] : [12, 12, 1]);
    const expectedIds = added.map((entry) => entry.routeRecord.contentId);
    expect(roots(current).flatMap((page) => page.itemContentIds)).toEqual(expectedIds);
    const feed = renderRssFeed(selectWebIndexableCatalog(current).map((entry) => entry.discoveryRecord), taxonomyRegistry,
      { ...siteConfig.site, description: siteConfig.site.defaultDescription });
    const guids = [...feed.matchAll(/<guid[^>]*>([^<]+)<\/guid>/gu)].map((match) => match[1]);
    expect(guids).toEqual(expectedIds.slice(0, 20).map((id) => siteConfig.site.canonicalOrigin + "#" + id));
    const pages = selectSearchEligibleCatalog(current).map((entry) => ({
      route: entry.routeRecord.route,
      html: '<main data-search-body data-search-id="' + entry.routeRecord.contentId + '" data-search-collection="' + entry.routeRecord.collection + '" data-search-title="' + entry.discoveryRecord.title + '" data-search-description="fixture" data-search-taxonomy="">新規記事</main>',
    }));
    const docs = buildSearchDocumentsFromHtmlPages(pages);
    expect(docs.filter((doc) => doc.collection === "blog").map((doc) => doc.id)).toEqual(expectedIds);
    expect(after.filter((entry) => entry.source.collection === "blog").every((entry) => entry.source.data.draft)).toBe(true);
  });
  it.each([[true, false], [false, true]])("excludes draft=%s/noindex=%s from discovery", (draft, noindex) => {
    const current = [...catalog, ...articles(1, draft, noindex)];
    expect(roots(current)).toEqual(roots(catalog));
    expect(selectSearchEligibleCatalog(current)).toEqual(selectSearchEligibleCatalog(catalog));
    expect(projectMigrationDiscovery(selectMigrationCohort(current, records, identities)))
      .toEqual(projectMigrationDiscovery(selectMigrationCohort(catalog, records, identities)));
  });
  it("rejects missing/released content and changed/duplicate cohort identities", () => {
    const held = selectMigrationCohort(catalog, records, identities).find((entry) => entry.source.collection === "blog")!;
    expect(() => selectMigrationCohort(catalog.filter((entry) => entry !== held), records, identities)).toThrow("Lost materialized");
    expect(() => selectMigrationCohort(catalog.map((entry) => entry === held ? { ...held, disposition: "published" as const } : entry), records, identities)).toThrow("hold");
    expect(() => selectMigrationCohort(catalog, records.slice(1), identities)).toThrow("53");
    expect(() => selectMigrationCohort(catalog, records, identities.slice(1))).toThrow("mismatch");
    expect(() => selectMigrationCohort(catalog, [...records.slice(1), records[1]!], [...records.slice(1), records[1]!])).toThrow("Duplicate");
    expect(() => selectMigrationCohort([...catalog, held], records, identities)).toThrow("Duplicate catalog");
  });
  it("rejects duplicate IDs/routes and orders same-day articles by stable ID", () => {
    const first = articles(1)[0]!.source;
    expect(() => deriveContentCatalog([first, { ...first, slug: "other" }], taxonomyRegistry)).toThrow("Duplicate ContentId");
    expect(() => deriveContentCatalog([first, { ...first, data: { ...first.data, id: "99999999-9999-4999-8999-999999999999" } } as CatalogSourceRecord], taxonomyRegistry)).toThrow("Duplicate content route");
    expect(roots(articles(13).reverse()).flatMap((page) => page.itemContentIds))
      .toEqual(articles(13).map((entry) => entry.routeRecord.contentId));
  });
});
