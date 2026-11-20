import { describe, expect, it } from "vitest";
import {
  seriesRegistrySchema,
  type SeriesRecord,
  type SeriesRegistry,
} from "@xpotato/content-contracts/series";
import type { TaxonomyRegistry } from "@xpotato/content-contracts";
import { deriveContentCatalog, type CatalogSourceRecord } from "./catalog.js";
import { derivePublicSeries, seriesForContent, validateSeriesReferences } from "./series.js";

const taxonomyRegistry: TaxonomyRegistry = {
  schemaVersion: 1,
  blogCategories: [],
  noteSubjects: [],
  toolCategories: [],
  tags: [],
};

const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
] as const;

const blog = (index: number, overrides: Record<string, unknown> = {}): CatalogSourceRecord => ({
  collection: "blog",
  slug: `part-${index}`,
  data: {
    id: ids[index]!,
    title: `Part ${index + 1}`,
    description: `Description ${index + 1}`,
    pubDate: `2026-10-${String(index + 1).padStart(2, "0")}`,
    category: "software",
    tags: [],
    draft: false,
    ...overrides,
  },
});

const record = (
  contentIds: readonly string[],
  overrides: Partial<SeriesRecord> = {},
): SeriesRecord => ({
  id: "understanding-math",
  slug: "understanding-math",
  title: "数学を理解する",
  description: "順序を編集できる学習コース",
  kind: "course",
  status: "ongoing",
  entries: contentIds.map((contentId) => ({ contentId })),
  ...overrides,
});
const registry = (...series: SeriesRecord[]): SeriesRegistry => ({ schemaVersion: 1, series });

describe("series registry contract", () => {
  it("accepts an empty registry, empty series, and membership in several series", () => {
    expect(seriesRegistrySchema.parse(registry())).toEqual(registry());
    expect(seriesRegistrySchema.safeParse(registry(record([]))).success).toBe(true);
    expect(
      seriesRegistrySchema.safeParse(
        registry(
          record([ids[0]]),
          record([ids[0]], { id: "another-course", slug: "another-course" }),
        ),
      ).success,
    ).toBe(true);
  });

  it("rejects duplicate series identity, slug or member within a series", () => {
    expect(seriesRegistrySchema.safeParse(registry(record([ids[0], ids[0]]))).success).toBe(false);
    expect(
      seriesRegistrySchema.safeParse(registry(record([]), record([], { slug: "another-slug" })))
        .success,
    ).toBe(false);
    expect(
      seriesRegistrySchema.safeParse(registry(record([]), record([], { id: "another-id" })))
        .success,
    ).toBe(false);
  });

  it("rejects malformed identities, path slugs and authored prev/next fields", () => {
    expect(seriesRegistrySchema.safeParse(registry(record(["not-a-uuid"]))).success).toBe(false);
    expect(
      seriesRegistrySchema.safeParse(registry(record([], { slug: "../private" }))).success,
    ).toBe(false);
    expect(
      seriesRegistrySchema.safeParse({
        schemaVersion: 1,
        series: [
          {
            ...record([]),
            previous: "/notes/something/",
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("public series projection", () => {
  it("uses editorial array order, even when dates and source order disagree", () => {
    const catalog = deriveContentCatalog([blog(0), blog(1), blog(2)], taxonomyRegistry);
    const series = derivePublicSeries(registry(record([ids[2], ids[0], ids[1]])), catalog)[0]!;
    expect(series.entries.map((entry) => [entry.contentId, entry.ordinal])).toEqual([
      [ids[2], 1],
      [ids[0], 2],
      [ids[1], 3],
    ]);
    const navigation = seriesForContent(ids[0], [series])[0]!;
    expect(navigation.previous?.contentId).toBe(ids[2]);
    expect(navigation.next?.contentId).toBe(ids[1]);
    expect(navigation.current.ordinal).toBe(2);
  });

  it("excludes draft, held and noindex records before counting and linking", () => {
    const catalog = deriveContentCatalog(
      [
        blog(0),
        blog(1, { draft: true, title: "PRIVATE-DRAFT-TITLE" }),
        blog(2, { seo: { noindex: true }, title: "PRIVATE-NOINDEX-TITLE" }),
        blog(3, { title: "PRIVATE-HELD-TITLE" }),
        blog(4),
      ],
      taxonomyRegistry,
    );
    catalog[3]!.disposition = "held_candidate";
    const source = record(ids);
    source.entries[1]!.label = "PRIVATE-DRAFT-LABEL";
    const publicSeries = derivePublicSeries(registry(source), catalog);
    expect(publicSeries[0]!.entries.map((entry) => entry.ordinal)).toEqual([1, 2]);
    expect(seriesForContent(ids[0], publicSeries)[0]?.next?.contentId).toBe(ids[4]);
    expect(seriesForContent(ids[4], publicSeries)[0]?.previous?.contentId).toBe(ids[0]);
    expect(seriesForContent(ids[1], publicSeries)).toEqual([]);
    const serialized = JSON.stringify(publicSeries);
    expect(serialized).not.toContain("PRIVATE-");
    for (const hiddenId of [ids[1], ids[2], ids[3]]) {
      expect(serialized).not.toContain(hiddenId);
    }
  });

  it("rejects missing referenced identities rather than hiding a broken relation", () => {
    const source = registry(record([ids[0], ids[1]]));
    expect(validateSeriesReferences(source, [ids[0]])).toEqual([
      `Series understanding-math references unknown ContentId: ${ids[1]}`,
    ]);
    expect(() =>
      derivePublicSeries(source, deriveContentCatalog([blog(0)], taxonomyRegistry)),
    ).toThrow(/unknown ContentId/u);
  });

  it("follows the current canonical route for a stable ContentId after renaming a note", () => {
    const note: CatalogSourceRecord = {
      collection: "notes",
      slug: "old-name",
      data: {
        id: ids[0],
        title: "続きのメモ",
        description: "メモの説明",
        pubDate: "2020-01-01",
        subject: "daily",
        tags: [],
        draft: false,
      },
    };
    const source = registry(record([ids[0]]));
    const before = derivePublicSeries(source, deriveContentCatalog([note], taxonomyRegistry));
    const after = derivePublicSeries(
      source,
      deriveContentCatalog([{ ...note, slug: "renamed-note" }], taxonomyRegistry),
    );
    expect(before[0]?.entries[0]?.route).toBe("/notes/old-name/");
    expect(after[0]?.entries[0]?.route).toBe("/notes/renamed-note/");
  });

  it("publishes no empty or private-only series and handles a single latest entry", () => {
    const catalog = deriveContentCatalog([blog(0), blog(1, { draft: true })], taxonomyRegistry);
    const publicSeries = derivePublicSeries(
      registry(
        record([]),
        record([ids[1]], { id: "private-course", slug: "private-course", title: "PRIVATE-COURSE" }),
        record([ids[0]], { id: "finished-course", slug: "finished-course", status: "completed" }),
      ),
      catalog,
    );
    expect(publicSeries).toHaveLength(1);
    expect(JSON.stringify(publicSeries)).not.toContain("PRIVATE-");
    const navigation = seriesForContent(ids[0], publicSeries)[0]!;
    expect(navigation.current.ordinal).toBe(1);
    expect(navigation.previous).toBeUndefined();
    expect(navigation.next).toBeUndefined();
    expect(navigation.series.status).toBe("completed");
  });

  it("keeps separate reading orders when content belongs to more than one series", () => {
    const catalog = deriveContentCatalog([blog(0), blog(1), blog(2)], taxonomyRegistry);
    const publicSeries = derivePublicSeries(
      registry(
        record([ids[0], ids[1]]),
        record([ids[2], ids[0]], { id: "second-series", slug: "second-series", kind: "series" }),
      ),
      catalog,
    );
    const navigation = seriesForContent(ids[0], publicSeries);
    expect(navigation).toHaveLength(2);
    expect(navigation[0]?.next?.contentId).toBe(ids[1]);
    expect(navigation[1]?.previous?.contentId).toBe(ids[2]);
    expect(navigation[1]?.next).toBeUndefined();
  });

  it("supports all content collections and reserves the entire series route namespace", () => {
    const common = { title: "Content", description: "Description", draft: false };
    const dated = { ...common, pubDate: "2026-01-01", tags: [] };
    const catalog = deriveContentCatalog(
      [
        blog(0),
        { collection: "notes", slug: "note", data: { ...dated, id: ids[1], subject: "daily" } },
        {
          collection: "projects",
          slug: "project",
          data: { ...dated, id: ids[2], status: "active" },
        },
        { collection: "tools", slug: "tool", data: { ...dated, id: ids[3], category: "utility" } },
        { collection: "pages", slug: "page", data: { ...common, id: ids[4] } },
      ],
      taxonomyRegistry,
    );
    expect(
      derivePublicSeries(registry(record(ids)), catalog)[0]?.entries.map(
        (entry) => entry.collection,
      ),
    ).toEqual(["blog", "notes", "projects", "tools", "pages"]);
    for (const slug of ["series", "series/overlapping-course"]) {
      expect(() =>
        deriveContentCatalog(
          [{ collection: "pages", slug, data: { ...common, id: ids[4] } }],
          taxonomyRegistry,
        ),
      ).toThrow(/reserved site route/u);
    }
  });
});
