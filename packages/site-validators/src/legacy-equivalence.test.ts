import { describe, expect, it } from "vitest";
import { compareLegacyHtmlEquivalence, type LegacySortRecord } from "./legacy-equivalence.js";

const record = (route: string, overrides: Partial<LegacySortRecord> = {}): LegacySortRecord => ({
  route,
  collection: route.startsWith("/projects/") ? "projects" : "blog",
  title: route,
  pubDateMs: 1_000,
  tags: [],
  ...overrides,
});
const catalog = (...records: LegacySortRecord[]): ReadonlyMap<string, LegacySortRecord> => new Map(records.map((item) => [item.route, item]));
const article = (route: string, label: string): string => `<article><a href="${route}"><time datetime="2026-01-01T00:00:00.000Z"></time><span>${label}</span></a></article>`;
const page = (items: readonly string[], extra = ""): string => `<!doctype html><html><body><main>${extra}<div class="grid">${items.join("\n")}</div></main></body></html>`;

describe("legacy HTML characterized equivalence", () => {
  it("accepts a published-entry permutation only inside an equal pubDate tie", () => {
    const a = record("/blog/a/");
    const b = record("/blog/b/");
    expect(compareLegacyHtmlEquivalence({
      path: "blog/index.html",
      firstHtml: page([article(a.route, "A"), article(b.route, "B")]),
      secondHtml: page([article(b.route, "B"), article(a.route, "A")]),
      catalog: catalog(a, b),
    })).toEqual({ equivalent: true, tiePermutationCount: 1 });
  });

  it("rejects movement across unequal published-entry keys", () => {
    const newer = record("/blog/newer/", { pubDateMs: 2_000 });
    const older = record("/blog/older/", { pubDateMs: 1_000 });
    expect(compareLegacyHtmlEquivalence({
      path: "blog/index.html",
      firstHtml: page([article(newer.route, "New"), article(older.route, "Old")]),
      secondHtml: page([article(older.route, "Old"), article(newer.route, "New")]),
      catalog: catalog(newer, older),
    }).equivalent).toBe(false);
  });

  it("rejects changed rendered material inside a tied item", () => {
    const a = record("/blog/a/");
    const b = record("/blog/b/");
    expect(compareLegacyHtmlEquivalence({
      path: "blog/index.html",
      firstHtml: page([article(a.route, "A"), article(b.route, "B")]),
      secondHtml: page([article(b.route, "CHANGED"), article(a.route, "A")]),
      catalog: catalog(a, b),
    }).equivalent).toBe(false);
  });

  it("accepts related-post permutations only when score and pubDate are tied", () => {
    const current = record("/blog/current/", { category: "same", tags: ["x"] });
    const a = record("/blog/a/", { category: "same", tags: ["x"] });
    const b = record("/blog/b/", { category: "same", tags: ["x"] });
    const related = (items: readonly string[]) => `<!doctype html><html><body><section><h2>関連記事</h2><div>${items.join("\n")}</div></section></body></html>`;
    expect(compareLegacyHtmlEquivalence({
      path: "blog/current/index.html",
      firstHtml: related([article(a.route, "A"), article(b.route, "B")]),
      secondHtml: related([article(b.route, "B"), article(a.route, "A")]),
      catalog: catalog(current, a, b),
    })).toEqual({ equivalent: true, tiePermutationCount: 1 });
  });

  it("fails closed when bytes change outside a proven sequence", () => {
    const a = record("/blog/a/");
    const b = record("/blog/b/");
    expect(compareLegacyHtmlEquivalence({
      path: "blog/index.html",
      firstHtml: page([article(a.route, "A"), article(b.route, "B")], "<h1>Blog</h1>"),
      secondHtml: page([article(b.route, "B"), article(a.route, "A")], "<h1>Changed</h1>"),
      catalog: catalog(a, b),
    }).equivalent).toBe(false);
  });
});
