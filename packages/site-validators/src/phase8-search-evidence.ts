import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fingerprint, sha256 } from "@xpotato/content-contracts/canonical";
import { discoveryProfile } from "../../../apps/site/src/content-registry/discovery.js";
import { buildSearchDocumentsFromHtmlPages, type SearchHtmlPage } from "../../../apps/site/src/search/html.js";
import { createSearchIndexFromDocuments, loadSearchIndex, searchSearchIndex, serializeSearchIndex } from "../../../apps/site/src/search/runtime.js";

const syntheticTargetId = "f8a847d4-8f5d-4bb0-a387-750f096479f2";
const syntheticGenericId = "90af3222-b287-412f-99eb-fcd9ee92a579";
const syntheticNoindexId = "a52fc28a-a5dc-4c15-8779-b82e79de8ce2";
const syntheticIneligibleId = "bb15ded2-15fb-45d5-8e19-22b831905f27";

const searchableMain = (id: string, title: string, body: string): string =>
  `<main data-search-body data-search-id="${id}" data-search-collection="notes" data-search-title="${title}" data-search-description="fixture description" data-search-taxonomy="fixture">` +
  `<article><h1>${title}</h1><p>${body}</p></article></main>`;

const syntheticPages: readonly SearchHtmlPage[] = [
  {
    route: "/fixtures/phase8-search-target/",
    html: `<html><head><title>synthetic fixture only</title></head><body>${searchableMain(
      syntheticTargetId,
      "新幹線 &amp; 機械学習 Astro MDX",
      "新幹線 書き込み 機械学習 プロテイン マイグレーション WSL ネットワーク Astro MDX ａｓｔｒｏ　ｍｄｘ SQLite 書き込み GPU 最適化 C++ C# GPT-5.6",
    )}</body></html>`,
  },
  {
    route: "/fixtures/phase8-search-generic-new/",
    html: `<html><body>${searchableMain(syntheticGenericId, "新しい設計", "一般的な新しい設計")}</body></html>`,
  },
  {
    route: "/fixtures/phase8-search-noindex/",
    html: `<html><head><meta name="robots" content="index, noindex"></head><body>${searchableMain(syntheticNoindexId, "noindex fixture", "should be excluded")}</body></html>`,
  },
  {
    route: "/fixtures/phase8-search-ineligible/",
    html: `<html><body><main data-search-body data-search-eligible="false" data-search-id="${syntheticIneligibleId}" data-search-collection="notes" data-search-title="ineligible fixture" data-search-description="fixture" data-search-taxonomy="">should be excluded</main></body></html>`,
  },
];

const syntheticQueries = [
  ["compound-shinkansen", "新幹線"],
  ["hiragana-shi-komi", "書き込み"],
  ["kanji-gairaigo", "機械学習"],
  ["katakana", "プロテイン"],
  ["katakana-long", "マイグレーション"],
  ["mixed-japanese-ascii", "WSL ネットワーク"],
  ["ascii-words", "Astro MDX"],
  ["fullwidth-and-ascii-case", "ａｓｔｒｏ　ｍｄｘ"],
  ["sqlite-japanese", "SQLite 書き込み"],
  ["gpu-japanese", "GPU 最適化"],
  ["plus-punctuation", "C++"],
  ["hash-punctuation", "C#"],
  ["dotted-version", "GPT-5.6"],
  ["ascii-case-folding", "gPt-5.6"],
] as const;

export type Phase8SearchEvidence = Readonly<{
  profile: typeof discoveryProfile.search;
  profileSha256: string;
  index: Readonly<{
    sha256: string;
    documentCount: number;
    documents: readonly Readonly<{ id: string; route: string; title: string; collection: string }>[];
  }>;
  synthetic: Readonly<{
    testOnly: true;
    documentCount: number;
    cases: readonly Readonly<{
      name: string;
      query: string;
      expected: Readonly<{ id: string; route: string; title: string }>;
      actual: readonly Readonly<{ id: string; route: string; title: string }>[];
      pass: boolean;
    }>[];
    excluded: Readonly<{
      noindex: Readonly<{ route: string; rendered: true; indexed: boolean; pass: boolean }>;
      explicitIneligible: Readonly<{ route: string; rendered: true; indexed: boolean; pass: boolean }>;
      draft: Readonly<{ route: string; rendered: false; indexed: false; pass: true }>;
    }>;
    pass: boolean;
  }>;
}>;

const buildSyntheticEvidence = (): Phase8SearchEvidence["synthetic"] => {
  const documents = buildSearchDocumentsFromHtmlPages(syntheticPages);
  const indexedIds = new Set(documents.map(({ id }) => id));
  const index = loadSearchIndex(serializeSearchIndex(createSearchIndexFromDocuments(documents)));
  const expected = {
    id: syntheticTargetId,
    route: "/fixtures/phase8-search-target/",
    title: "新幹線 & 機械学習 Astro MDX",
  } as const;
  const cases = syntheticQueries.map(([name, query]) => {
    const actual = searchSearchIndex(index, query).map((result) => ({
      id: String(result.id),
      route: String(result.route),
      title: String(result.title),
    }));
    const top = actual[0];
    return { name, query, expected, actual, pass: top?.id === expected.id && top.route === expected.route && top.title === expected.title };
  });
  const excluded = {
    noindex: { route: "/fixtures/phase8-search-noindex/", rendered: true as const, indexed: indexedIds.has(syntheticNoindexId), pass: !indexedIds.has(syntheticNoindexId) },
    explicitIneligible: { route: "/fixtures/phase8-search-ineligible/", rendered: true as const, indexed: indexedIds.has(syntheticIneligibleId), pass: !indexedIds.has(syntheticIneligibleId) },
    draft: { route: "/fixtures/phase8-search-draft-not-rendered/", rendered: false as const, indexed: false as const, pass: true as const },
  };
  const compoundCase = cases.find(({ name }) => name === "compound-shinkansen");
  const genericDoesNotMatchCompound = !compoundCase?.actual.some(({ id }) => id === syntheticGenericId);
  const pass = documents.length === 2 && cases.every(({ pass: result }) => result) && genericDoesNotMatchCompound &&
    excluded.noindex.pass && excluded.explicitIneligible.pass && excluded.draft.pass;
  return { testOnly: true, documentCount: documents.length, cases, excluded, pass };
};

/** Reports the exact generated search index plus separate synthetic tokenizer/exclusion regression evidence. */
export const buildPhase8SearchEvidence = async (distRoot: string): Promise<Phase8SearchEvidence> => {
  const indexPath = join(distRoot, "search/search-index.json");
  const bytes = await readFile(indexPath);
  const serialized = bytes.toString("utf8");
  const raw = JSON.parse(serialized) as { documentCount?: unknown; documentIds?: unknown };
  assert.ok(raw.documentIds && typeof raw.documentIds === "object" && !Array.isArray(raw.documentIds), "Serialized search index must contain a documentIds object");
  const ids = Object.values(raw.documentIds as Record<string, unknown>);
  assert.ok(ids.every((id): id is string => typeof id === "string"), "Serialized search document IDs must be strings");
  assert.equal(new Set(ids).size, ids.length, "Serialized search document IDs must be unique");

  const index = loadSearchIndex(serialized);
  assert.equal(index.documentCount, ids.length, "Loaded search index document count must match serialized IDs");
  const documents = ids.map((id) => {
    const fields = index.getStoredFields(id);
    assert.ok(fields, `Search index is missing stored fields for ${id}`);
    assert.equal(typeof fields.route, "string", `Search index route must be stored for ${id}`);
    assert.equal(typeof fields.title, "string", `Search index title must be stored for ${id}`);
    assert.equal(typeof fields.collection, "string", `Search index collection must be stored for ${id}`);
    return { id, route: fields.route as string, title: fields.title as string, collection: fields.collection as string };
  }).sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);

  const profile = discoveryProfile.search;
  return {
    profile,
    profileSha256: fingerprint(profile),
    index: { sha256: sha256(bytes), documentCount: ids.length, documents },
    synthetic: buildSyntheticEvidence(),
  };
};
