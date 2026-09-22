import { describe, expect, it } from "vitest";
import type { ContentDiscoveryRecord, TaxonomyRegistry } from "@xpotato/content-contracts";
import { taxonomyRegistry } from "../content-registry/taxonomy/index.js";
import {
  archiveRoute,
  generateArchivePages,
  paginate,
  relatedScore,
  selectDynamicArchivePages,
  selectRelated,
  sortNewestFirst,
} from "./discovery.js";

const record = (
  contentId: string,
  overrides: Partial<ContentDiscoveryRecord> = {},
): ContentDiscoveryRecord => ({
  contentId,
  collection: "blog",
  route: `/blog/${contentId}/`,
  title: contentId,
  description: `${contentId} description`,
  pubDate: "2026-09-20",
  categoryId: "software",
  tagIds: [],
  featured: false,
  siteSearchEligible: true,
  webIndexable: true,
  ...overrides,
});

const taxonomyWithExtraTags = (): TaxonomyRegistry => ({
  ...taxonomyRegistry,
  tags: [
    ...taxonomyRegistry.tags,
    {
      id: "retired-tag",
      label: "Retired tag",
      slug: "retired-tag",
      kind: "technology",
      aliases: [],
      archive: true,
      indexable: true,
      status: "retired",
    },
    {
      id: "hidden-tag",
      label: "Hidden tag",
      slug: "hidden-tag",
      kind: "topic",
      aliases: [],
      archive: true,
      indexable: false,
      status: "active",
    },
  ],
});

describe("static discovery", () => {
  it("paginates at the configured size and omits page/1", () => {
    expect(paginate(Array.from({ length: 25 }, (_, index) => index), 12).map((page) => page.length)).toEqual([12, 12, 1]);
    expect(archiveRoute("/blog/", 1)).toBe("/blog/");
    expect(archiveRoute("/blog/", 2)).toBe("/blog/page/2/");
  });

  it("orders by newest date then stable ContentId", () => {
    const ordered = sortNewestFirst([
      record("b", { pubDate: "2026-09-20" }),
      record("z", { pubDate: "2026-09-21" }),
      record("a", { pubDate: "2026-09-20" }),
    ]);
    expect(ordered.map((item) => item.contentId)).toEqual(["z", "a", "b"]);
  });

  it("uses primary taxonomy namespaces and ignores unknown or retired shared tags", () => {
    const taxonomy = taxonomyWithExtraTags();
    const blog = record("blog", { categoryId: "infrastructure", tagIds: ["unknown-tag", "retired-tag"] });
    const note = record("note", {
      collection: "notes",
      route: "/notes/note/",
      categoryId: undefined,
      subjectId: "infrastructure",
      tagIds: ["unknown-tag", "retired-tag"],
    });
    expect(relatedScore(blog, note, taxonomy)).toBe(0);

    const sameBlogTaxonomy = record("same", {
      categoryId: "infrastructure",
      tagIds: ["unknown-tag", "retired-tag"],
    });
    expect(relatedScore(blog, sameBlogTaxonomy, taxonomy)).toBe(3);
  });

  it("excludes noindex source and candidates, and limits related links to four with recency ties", () => {
    const source = record("source", { categoryId: "robotics", tagIds: ["astro"] });
    const candidates = [
      record("c", { categoryId: "software", tagIds: ["astro"], pubDate: "2026-09-19" }),
      record("b", { categoryId: "software", tagIds: ["astro"], pubDate: "2026-09-20" }),
      record("z", { categoryId: "software", tagIds: ["astro"], pubDate: "2026-09-21" }),
      record("a", { categoryId: "software", tagIds: ["astro"], pubDate: "2026-09-20" }),
      record("d", { categoryId: "software", tagIds: ["astro"], pubDate: "2026-09-18" }),
      record("private", { categoryId: "software", tagIds: ["astro"], webIndexable: false, siteSearchEligible: false }),
    ];
    expect(selectRelated(source, candidates, taxonomyRegistry).map((item) => item.contentId)).toEqual(["z", "a", "b", "c"]);
    expect(selectRelated({ ...source, webIndexable: false }, candidates, taxonomyRegistry)).toEqual([]);
  });

  it("uses web indexability, not site-search eligibility, for related content", () => {
    const source = record("source", {
      categoryId: "robotics",
      tagIds: ["astro"],
      siteSearchEligible: false,
    });
    const candidate = record("candidate", {
      categoryId: "software",
      tagIds: ["astro"],
      siteSearchEligible: false,
    });

    expect(relatedScore(source, candidate, taxonomyRegistry)).toBeGreaterThanOrEqual(1);
    expect(selectRelated(source, [candidate], taxonomyRegistry).map((item) => item.contentId)).toEqual(["candidate"]);
  });

  it("creates roots for empty collections but no empty taxonomy pages", () => {
    const pages = generateArchivePages([], taxonomyWithExtraTags());
    expect(pages.map((page) => page.route)).toEqual(["/blog/", "/notes/"]);
    expect(pages.every((page) => page.itemContentIds.length === 0)).toBe(true);
  });

  it("routes root page 2 and later through the collection catch-all", () => {
    const records = Array.from({ length: 25 }, (_, index) =>
      record(`candidate-${String(index).padStart(2, "0")}`, { categoryId: "software" }),
    );
    const pages = generateArchivePages(records, taxonomyRegistry);
    const dynamicRoots = selectDynamicArchivePages(pages, "blog").filter((page) => page.scope.kind === "root");

    expect(dynamicRoots.map((page) => page.route)).toEqual(["/blog/page/2/", "/blog/page/3/"]);
    expect(selectDynamicArchivePages(pages, "notes")).toEqual([]);
  });

  it("generates only active policy archives, with no empty pages and deterministic pagination", () => {
    const taxonomy = taxonomyWithExtraTags();
    const blogs = Array.from({ length: 13 }, (_, index) =>
      record(`blog-${String(index).padStart(2, "0")}`, {
        route: `/blog/post-${index}/`,
        categoryId: "software",
        tagIds: ["astro", "hidden-tag", "retired-tag", "unknown-tag"],
        pubDate: index === 12 ? "2025-08-01" : "2026-09-20",
      }),
    ).reverse();
    const note = record("note-1", {
      collection: "notes",
      route: "/notes/note-1/",
      pubDate: "2026-09-19",
      categoryId: undefined,
      subjectId: "infrastructure",
      tagIds: [],
    });
    const pages = generateArchivePages([...blogs, note], taxonomy);
    const blogRoot = pages.filter((page) => page.collection === "blog" && page.scope.kind === "root");
    expect(blogRoot.map((page) => page.itemContentIds.length)).toEqual([12, 1]);
    expect(blogRoot[0]?.itemContentIds[0]).toBe("blog-00");
    expect(blogRoot[1]?.route).toBe("/blog/page/2/");
    expect(blogRoot.some((page) => page.route.includes("page/1"))).toBe(false);

    expect(pages.some((page) => page.route === "/blog/category/software/" )).toBe(true);
    expect(pages.some((page) => page.route === "/blog/tag/astro/" )).toBe(true);
    expect(pages.some((page) => page.route === "/blog/tag/hidden-tag/" && page.noindex)).toBe(true);
    expect(pages.some((page) => page.route.includes("retired-tag"))).toBe(false);
    expect(pages.some((page) => page.route.includes("unknown-tag"))).toBe(false);
    expect(pages.some((page) => page.route === "/notes/subject/infrastructure/" )).toBe(true);
    expect(pages.some((page) => page.route === "/blog/category/infrastructure/" )).toBe(false);
    expect(pages.some((page) => page.route === "/blog/archive/2025/" )).toBe(true);
    expect(pages.some((page) => page.route === "/blog/archive/2026/" )).toBe(true);
  });
});
