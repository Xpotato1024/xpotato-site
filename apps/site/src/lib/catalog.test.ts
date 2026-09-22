import { describe, expect, it } from "vitest";
import { taxonomyRegistry } from "../content-registry/taxonomy/index.js";
import {
  deriveContentCatalog,
  selectPublishedCatalog,
  selectSearchEligibleCatalog,
  selectWebIndexableCatalog,
  type CatalogSourceRecord,
} from "./catalog.js";
import type { BlogFrontmatter } from "@xpotato/content-contracts";

const blog = (dataOverrides: Partial<BlogFrontmatter> = {}, slug = "catalog-basics"): CatalogSourceRecord => ({
  collection: "blog",
  slug,
  data: {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Catalog basics",
    description: "A catalog fixture",
    pubDate: "2026-09-20",
    category: "software",
    tags: ["astro"],
    draft: false,
    ...dataOverrides,
  },
});

describe("derived content catalog", () => {
  it("derives schema-backed canonical routes and keeps draft state separate from publication", () => {
    const entry = deriveContentCatalog(
      [blog({ draft: true })],
      taxonomyRegistry,
    )[0];
    if (!entry) throw new Error("Expected draft candidate");

    expect(entry.routeRecord).toEqual({
      contentId: "11111111-1111-4111-8111-111111111111",
      collection: "blog",
      slug: "catalog-basics",
      route: "/blog/catalog-basics/",
      canonical: true,
    });
    expect(entry.disposition).toBe("held_candidate");
    expect(entry.discoveryRecord.webIndexable).toBe(false);
    expect(entry.discoveryRecord.siteSearchEligible).toBe(false);
    expect(selectPublishedCatalog([entry])).toEqual([]);
  });

  it("retains a published noindex detail route but excludes it from discovery selection", () => {
    const entry = deriveContentCatalog(
      [blog({ seo: { noindex: true } })],
      taxonomyRegistry,
    )[0];
    if (!entry) throw new Error("Expected published noindex entry");

    expect(entry.disposition).toBe("published");
    expect(entry.routeRecord.route).toBe("/blog/catalog-basics/");
    expect(selectPublishedCatalog([entry])).toHaveLength(1);
    expect(selectWebIndexableCatalog([entry])).toEqual([]);
    expect(selectSearchEligibleCatalog([entry])).toEqual([]);
  });

  it("uses the page entry slug for its route and rejects duplicate identity or reserved routes", () => {
    const page: CatalogSourceRecord = {
      collection: "pages",
      slug: "about",
      data: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        title: "About",
        description: "About the site",
        draft: false,
      },
    };
    const entry = deriveContentCatalog([page], taxonomyRegistry)[0];
    if (!entry) throw new Error("Expected page entry");
    expect(entry.routeRecord.route).toBe("/about/");
    expect(entry.discoveryRecord.collection).toBe("pages");

    expect(() => deriveContentCatalog([blog(), blog({}, "another-route")], taxonomyRegistry)).toThrow(
      /Duplicate ContentId/u,
    );
    expect(() => deriveContentCatalog([{ ...page, slug: "search" }], taxonomyRegistry)).toThrow(/reserved site route/u);
  });
});
