import { describe, expect, it } from "vitest";
import { archiveRoute, paginate, relatedScore } from "./discovery.js";
import { taxonomyRegistry } from "../content-registry/taxonomy/index.js";

const record = (id: string, tags: string[] = [], category = "software") => ({
  contentId: id,
  collection: "blog" as const,
  route: `/${id}/`,
  title: id,
  description: id,
  categoryId: category,
  tagIds: tags,
  featured: false,
  siteSearchEligible: true,
  webIndexable: true,
});

describe("static discovery", () => {
  it("paginates at 12 without a page/1 route", () => {
    expect(paginate(Array.from({ length: 25 }, (_, index) => index), 12).map((page) => page.length)).toEqual([12, 12, 1]);
    expect(archiveRoute("/blog/", 1)).toBe("/blog/");
    expect(archiveRoute("/blog/", 2)).toBe("/blog/page/2/");
  });

  it("implements frozen related weights", () => {
    expect(relatedScore(record("a"), record("b"), taxonomyRegistry)).toBe(3);
    expect(relatedScore(record("a", ["astro"]), record("b", ["astro"]), taxonomyRegistry)).toBe(7);
    expect(relatedScore(record("a", ["static-site"]), record("b", ["static-site"]), taxonomyRegistry)).toBe(5);
  });
});
