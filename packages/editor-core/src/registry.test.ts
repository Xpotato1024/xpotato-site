import { describe, expect, it } from "vitest";
import { taxonomyRegistrySchema } from "@xpotato/content-contracts/content";
import {
  applyTaxonomyAdditions,
  parseEditorContentIndex,
  parseRegistryChanges,
  previewRegistryChanges,
  remainingRegistryChanges,
  rebaseSeriesChanges,
  taxonomySnapshotFields,
  updateEditorContentIndex,
  type TaxonomyAddition,
} from "./registry.js";

const registry = taxonomyRegistrySchema.parse({
  schemaVersion: 1,
  blogCategories: [
    {
      id: "software",
      label: "ソフトウェア",
      description: "設計と実装",
      slug: "software",
      aliases: [],
      status: "active",
      indexable: true,
    },
  ],
  noteSubjects: [],
  toolCategories: [],
  tags: [
    {
      id: "react",
      label: "React",
      slug: "react",
      kind: "technology",
      aliases: ["リアクト"],
      archive: true,
      indexable: true,
      status: "active",
    },
  ],
});
const id = "11111111-1111-4111-8111-111111111111";
const purpose: TaxonomyAddition = {
  namespace: "tags",
  id: "tutorial",
  label: "チュートリアル",
  description: "順に操作して学ぶ",
  aliases: ["入門手順"],
  kind: "purpose",
};

describe("scoped editorial registry changes", () => {
  it("adds typed taxonomy without discarding aliases, kind, or the existing registry", () => {
    const next = applyTaxonomyAdditions(registry, [purpose]);
    expect(next.tags.at(-1)).toMatchObject({
      id: "tutorial",
      label: purpose.label,
      kind: "purpose",
      aliases: purpose.aliases,
      slug: "tutorial",
      status: "active",
      indexable: false,
    });
    expect(next.tags[0]).toEqual(registry.tags[0]);
    expect(registry.tags).toHaveLength(1);
    const snapshot = {
      contractVersion: 1 as const,
      modules: ["Figure"],
      ...taxonomySnapshotFields(registry),
    };
    const preview = previewRegistryChanges(snapshot, { taxonomy: [purpose] });
    expect(preview.tags).toEqual(["react", "tutorial"]);
    expect(preview.terms?.tags.at(-1)?.kind).toBe("purpose");
    expect(snapshot.tags).toEqual(["react"]);
  });
  it("rejects arbitrary file writes, unknown keys, missing tag kind, and duplicate IDs or aliases", () => {
    expect(() =>
      parseRegistryChanges({ path: ".github/workflows/deploy.yml", source: "attack" }),
    ).toThrow();
    expect(() => parseRegistryChanges({ taxonomy: [{ ...purpose, indexable: true }] })).toThrow();
    expect(() =>
      parseRegistryChanges({ taxonomy: [{ namespace: "tags", id: "x", label: "X" }] }),
    ).toThrow("TAG_KIND_REQUIRED");
    expect(() => applyTaxonomyAdditions(registry, [{ ...purpose, id: "react" }])).toThrow(
      "TAXONOMY_ID_EXISTS",
    );
    expect(() => applyTaxonomyAdditions(registry, [{ ...purpose, label: "リアクト" }])).toThrow(
      "TAXONOMY_TERM_EXISTS",
    );
    expect(() => applyTaxonomyAdditions(registry, [{ ...purpose, label: "ＲＥＡＣＴ" }])).toThrow(
      "TAXONOMY_TERM_EXISTS",
    );
    expect(() =>
      applyTaxonomyAdditions(registry, [{ ...purpose, aliases: ["チュートリアル"] }]),
    ).toThrow("TAXONOMY_ALIAS_DUPLICATE");
  });
  it("clears only the exact submitted operations after a save while retaining later edits", () => {
    const newer: TaxonomyAddition = { ...purpose, id: "practice", label: "練習", aliases: [] };
    expect(
      remainingRegistryChanges({ taxonomy: [purpose, newer] }, { taxonomy: [purpose] }),
    ).toEqual({ taxonomy: [newer] });
    expect(
      remainingRegistryChanges({ taxonomy: [purpose] }, { taxonomy: [purpose] }),
    ).toBeUndefined();
    const original = { schemaVersion: 1 as const, series: [] };
    const changed = {
      schemaVersion: 1 as const,
      series: [
        {
          id: "course",
          slug: "course",
          title: "入門",
          description: "",
          kind: "course" as const,
          status: "ongoing" as const,
          entries: [{ contentId: id }],
        },
      ],
    };
    expect(
      remainingRegistryChanges(
        { series: changed, seriesBase: original },
        { series: original, seriesBase: original },
      ),
    ).toEqual({ series: changed, seriesBase: original });
  });
});

describe("authenticated content index", () => {
  it("updates the current title without creating a second identity or changing another source", () => {
    const first = {
      contentId: id,
      path: "content/articles/first.mdx",
      title: "旧名",
      collection: "blog" as const,
    };
    const index = parseEditorContentIndex({ schemaVersion: 1, documents: [first] });
    expect(updateEditorContentIndex(index, { ...first, title: "新名" }).documents).toEqual([
      { ...first, title: "新名" },
    ]);
    expect(() =>
      updateEditorContentIndex(index, {
        ...first,
        path: "content/notes/copy.mdx",
        collection: "notes",
      }),
    ).toThrow("CONTENT_ID_PATH_CONFLICT");
    expect(() =>
      parseEditorContentIndex({
        schemaVersion: 1,
        documents: [{ ...first, path: ".github/workflows/deploy.yml" }],
      }),
    ).toThrow();
    expect(() => parseEditorContentIndex({ schemaVersion: 1, documents: [first, first] })).toThrow(
      "EDITOR_CONTENT_INDEX_DUPLICATE",
    );
  });
});

describe("three-way series reconciliation", () => {
  const empty = { schemaVersion: 1 as const, series: [] };
  const series = (name: string) => ({
    id: name,
    slug: name,
    title: name,
    description: "",
    kind: "series" as const,
    status: "ongoing" as const,
    entries: [{ contentId: id }],
  });
  it("adds an offline series without replacing unseen remote series", () => {
    const local = { ...empty, series: [series("local")] };
    const remote = { ...empty, series: [series("remote")] };
    const result = rebaseSeriesChanges({ seriesBase: empty, series: local }, remote);
    expect(result.series?.series.map((item) => item.id)).toEqual(["remote", "local"]);
    expect(result.seriesBase).toEqual(remote);
    expect(() => parseRegistryChanges({ series: local })).toThrow("SERIES_BASE_REQUIRED");
  });
  it("preserves untouched remote edits and applies an independent local edit or removal", () => {
    const base = { ...empty, series: [series("first"), series("second")] };
    const local = {
      ...empty,
      series: [{ ...series("first"), title: "local title" }, series("second")],
    };
    const remote = {
      ...empty,
      series: [series("first"), { ...series("second"), title: "remote title" }],
    };
    expect(
      rebaseSeriesChanges({ seriesBase: base, series: local }, remote).series?.series.map(
        (item) => item.title,
      ),
    ).toEqual(["local title", "remote title"]);
    const removed = { ...empty, series: [series("second")] };
    expect(
      rebaseSeriesChanges({ seriesBase: base, series: removed }, remote).series?.series,
    ).toEqual([remote.series[1]]);
  });
  it("rejects conflicting changes to the same series or newly colliding URL names", () => {
    const base = { ...empty, series: [series("first")] };
    const local = { ...empty, series: [{ ...series("first"), title: "local title" }] };
    const remote = { ...empty, series: [{ ...series("first"), title: "remote title" }] };
    expect(() => rebaseSeriesChanges({ seriesBase: base, series: local }, remote)).toThrow(
      "SERIES_CONFLICT",
    );
    expect(() => rebaseSeriesChanges({ seriesBase: base, series: empty }, remote)).toThrow(
      "SERIES_CONFLICT",
    );
    expect(() =>
      rebaseSeriesChanges(
        {
          seriesBase: empty,
          series: { ...empty, series: [{ ...series("other"), slug: "first" }] },
        },
        remote,
      ),
    ).toThrow("SERIES_CONFLICT");
  });
  it("does not turn changes typed during a save into deletion of newly discovered remote series", () => {
    const remote = { ...empty, series: [series("remote")] };
    const submitted = rebaseSeriesChanges(
      { seriesBase: empty, series: { ...empty, series: [series("local")] } },
      remote,
    );
    const current = {
      seriesBase: empty,
      series: { ...empty, series: [series("local"), series("newer")] },
    };
    const remaining = remainingRegistryChanges(current, submitted);
    expect(remaining?.series?.series.map((item) => item.id)).toEqual(["remote", "local", "newer"]);
    expect(remaining?.seriesBase).toEqual(submitted.series);
    expect(
      remainingRegistryChanges(
        { seriesBase: empty, series: { ...empty, series: [series("local")] } },
        submitted,
      ),
    ).toBeUndefined();
  });
});
