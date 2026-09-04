import { describe, expect, it } from "vitest";
import { compareLegacyHtmlEquivalence, type LegacySortRecord } from "./legacy-equivalence.js";
import {
  expectedFrozenCompactBlogCardHtml,
  proveRankedPrefixBoundaryTie,
  type RankedPrefixRecord,
} from "./legacy-ranked-prefix-equivalence.js";

const record = (route: string, overrides: Partial<RankedPrefixRecord> = {}): RankedPrefixRecord => ({
  route,
  collection: "blog",
  title: route,
  description: `Description ${route}`,
  pubDateMs: Date.parse("2026-03-30T00:00:00.000Z"),
  category: "app",
  tags: ["x", "y", "z"],
  draft: false,
  ...overrides,
});
const catalog = (...records: RankedPrefixRecord[]): ReadonlyMap<string, RankedPrefixRecord> => new Map(records.map((item) => [item.route, item]));
const materials = (records: readonly RankedPrefixRecord[]): ReadonlyMap<string, string> => new Map(records.map((item) => [item.route, expectedFrozenCompactBlogCardHtml(item)]));
const sequencePage = (records: readonly RankedPrefixRecord[]): string => `<!doctype html><html><body><main><div>${records.map(expectedFrozenCompactBlogCardHtml).join("\n")}</div></main></body></html>`;

describe("ranked-prefix-boundary-tie-v1", () => {
  it("accepts only membership changes inside the home top-3 cutoff tie group", () => {
    const strict = record("/blog/strict/", { pubDateMs: 3_000 });
    const b = record("/blog/b/", { pubDateMs: 2_000 });
    const c = record("/blog/c/", { pubDateMs: 2_000 });
    const d = record("/blog/d/", { pubDateMs: 2_000 });
    const lower = record("/blog/lower/", { pubDateMs: 1_000 });
    const all = [strict, b, c, d, lower];
    const proof = proveRankedPrefixBoundaryTie({
      path: "index.html",
      regionKey: "/html[0]/body[1]/main[0]/div[0]",
      kind: "published",
      firstIdentities: [strict.route, b.route, c.route],
      secondIdentities: [strict.route, d.route, b.route],
      firstMaterials: materials([strict, b, c]),
      secondMaterials: materials([strict, d, b]),
      gaps: ["", "\n", "\n", ""],
      catalog: catalog(...all),
    });
    expect(proof?.evidence.strictPrefixIdentities).toEqual([strict.route]);
    expect(proof?.evidence.boundaryCandidateIdentities).toEqual([b.route, c.route, d.route]);
    expect(proof?.evidence.membershipDeltaIdentities).toEqual([c.route, d.route]);
    expect(proof?.evidence.selectedFromBoundaryCount).toBe(2);
  });

  it("rejects a realization that drops a strict-prefix candidate", () => {
    const strict = record("/blog/strict/", { pubDateMs: 3_000 });
    const b = record("/blog/b/", { pubDateMs: 2_000 });
    const c = record("/blog/c/", { pubDateMs: 2_000 });
    const d = record("/blog/d/", { pubDateMs: 2_000 });
    const all = [strict, b, c, d];
    expect(() => proveRankedPrefixBoundaryTie({
      path: "index.html",
      regionKey: "home",
      kind: "published",
      firstIdentities: [strict.route, b.route, c.route],
      secondIdentities: [b.route, c.route, d.route],
      firstMaterials: materials([strict, b, c]),
      secondMaterials: materials([b, c, d]),
      gaps: ["", "", "", ""],
      catalog: catalog(...all),
    })).toThrow(/strict candidate missing/);
  });

  it("rejects a lower-ranked candidate crossing the cutoff", () => {
    const strict = record("/blog/strict/", { pubDateMs: 3_000 });
    const b = record("/blog/b/", { pubDateMs: 2_000 });
    const c = record("/blog/c/", { pubDateMs: 2_000 });
    const d = record("/blog/d/", { pubDateMs: 2_000 });
    const lower = record("/blog/lower/", { pubDateMs: 1_000 });
    const all = [strict, b, c, d, lower];
    expect(() => proveRankedPrefixBoundaryTie({
      path: "index.html",
      regionKey: "home",
      kind: "published",
      firstIdentities: [strict.route, b.route, c.route],
      secondIdentities: [strict.route, d.route, lower.route],
      firstMaterials: materials([strict, b, c]),
      secondMaterials: materials([strict, d, lower]),
      gaps: ["", "", "", ""],
      catalog: catalog(...all),
    })).toThrow(/lower-ranked candidate selected/);
  });

  it("rejects selected-only compact card markup corruption", () => {
    const strict = record("/blog/strict/", { pubDateMs: 3_000 });
    const b = record("/blog/b/", { pubDateMs: 2_000 });
    const c = record("/blog/c/", { pubDateMs: 2_000 });
    const d = record("/blog/d/", { pubDateMs: 2_000 });
    const first = materials([strict, b, c]);
    const second = new Map(materials([strict, b, d]));
    second.set(d.route, second.get(d.route)!.replace(' data-reveal="card"', ""));
    expect(() => proveRankedPrefixBoundaryTie({
      path: "index.html",
      regionKey: "home",
      kind: "published",
      firstIdentities: [strict.route, b.route, c.route],
      secondIdentities: [strict.route, b.route, d.route],
      firstMaterials: first,
      secondMaterials: second,
      gaps: ["", "", "", ""],
      catalog: catalog(strict, b, c, d),
    })).toThrow(/source\/renderer projection mismatch/);
  });

  it("rejects selected-only compact cards with duplicate raw attributes before parse5 can discard them", () => {
    const strict = record("/blog/strict/", { pubDateMs: 3_000 });
    const b = record("/blog/b/", { pubDateMs: 2_000 });
    const c = record("/blog/c/", { pubDateMs: 2_000 });
    const d = record("/blog/d/", { pubDateMs: 2_000 });
    const first = materials([strict, b, c]);
    const second = new Map(materials([strict, b, d]));
    second.set(d.route, second.get(d.route)!.replace('data-reveal="card"', 'data-reveal="card" data-reveal="unexpected"'));
    expect(() => proveRankedPrefixBoundaryTie({
      path: "index.html",
      regionKey: "home",
      kind: "published",
      firstIdentities: [strict.route, b.route, c.route],
      secondIdentities: [strict.route, b.route, d.route],
      firstMaterials: first,
      secondMaterials: second,
      gaps: ["", "", "", ""],
      catalog: catalog(strict, b, c, d),
    })).toThrow(/HTML parse error.*duplicate-attribute/);
  });

  it("uses candidate tag occurrence count for Related ranking", () => {
    const current = record("/blog/current/", { category: "diary", tags: ["x"] });
    const strict = record("/blog/strict/", { category: "diary", tags: ["x", "x"], pubDateMs: 2_000 });
    const b = record("/blog/b/", { category: "app", tags: ["x"], pubDateMs: 2_000 });
    const c = record("/blog/c/", { category: "app", tags: ["x"], pubDateMs: 2_000 });
    const d = record("/blog/d/", { category: "app", tags: ["x"], pubDateMs: 2_000 });
    const all = [current, strict, b, c, d];
    const proof = proveRankedPrefixBoundaryTie({
      path: "blog/current/index.html",
      regionKey: "related",
      kind: "related",
      current,
      firstIdentities: [strict.route, b.route, c.route],
      secondIdentities: [strict.route, d.route, b.route],
      firstMaterials: materials([strict, b, c]),
      secondMaterials: materials([strict, d, b]),
      gaps: ["", "", "", ""],
      catalog: catalog(...all),
    });
    expect(proof?.evidence.strictPrefixIdentities).toEqual([strict.route]);
    expect(proof?.evidence.boundaryCandidateIdentities).toEqual([b.route, c.route, d.route]);
  });

  it("integrates the accepted boundary class into HTML comparison without weakening other regions", () => {
    const strict = record("/blog/strict/", { pubDateMs: 3_000 });
    const b = record("/blog/b/", { pubDateMs: 2_000 });
    const c = record("/blog/c/", { pubDateMs: 2_000 });
    const d = record("/blog/d/", { pubDateMs: 2_000 });
    const lower = record("/blog/lower/", { pubDateMs: 1_000 });
    const result = compareLegacyHtmlEquivalence({
      path: "index.html",
      firstHtml: sequencePage([strict, b, c]),
      secondHtml: sequencePage([strict, b, d]),
      catalog: catalog(strict, b, c, d, lower) as ReadonlyMap<string, LegacySortRecord>,
    });
    expect(result.equivalent).toBe(true);
    expect(result.tiePermutationCount).toBe(0);
    expect(result.boundarySelectionVariances).toHaveLength(1);
    expect(result.boundarySelectionVariances[0]?.membershipDeltaIdentities).toEqual([c.route, d.route]);
  });
});
