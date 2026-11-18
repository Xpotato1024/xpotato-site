import { describe, expect, it } from "vitest";
import { deriveContentCatalog, type CatalogSourceRecord } from "@xpotato/portable-content/catalog";
import type { TaxonomyRegistry } from "@xpotato/content-contracts";
import { deriveEducationDirectory } from "./directory.js";

const taxonomy: TaxonomyRegistry = {
  schemaVersion: 1,
  blogCategories: [],
  noteSubjects: [],
  toolCategories: [],
  tags: [],
};
const note = (index: number, overrides: Record<string, unknown> = {}): CatalogSourceRecord => ({
  collection: "notes",
  slug: `lesson-${index}`,
  data: {
    id: `00000000-0000-4000-8000-00000000000${index}`,
    title: `教材${index}`,
    description: "説明",
    pubDate: "2026-01-01",
    subject: "learning",
    tags: [],
    draft: false,
    education: {
      subject: "数学",
      audience: "初学者",
      prerequisites: "四則演算",
      goals: ["式を読む"],
    },
    ...overrides,
  },
});

describe("education directory", () => {
  it("groups only published discoverable education metadata, including ordinary notes", () => {
    const catalog = deriveContentCatalog(
      [
        note(1),
        note(2, { draft: true, title: "PRIVATE-DRAFT" }),
        note(3, { seo: { noindex: true }, title: "PRIVATE-NOINDEX" }),
        note(4, { education: undefined }),
        note(5, { education: { subject: "情報" } }),
      ],
      taxonomy,
    );
    const directory = deriveEducationDirectory(catalog);
    expect(directory).toHaveLength(2);
    expect(
      directory
        .flatMap((group) => group.entries)
        .map((entry) => entry.title)
        .sort(),
    ).toEqual(["教材1", "教材5"]);
    expect(
      directory.find((group) => group.subject === "数学")?.entries[0]?.education.goals,
    ).toEqual(["式を読む"]);
    expect(JSON.stringify(directory)).not.toContain("PRIVATE-");
  });
});
