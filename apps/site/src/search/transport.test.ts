import MiniSearch from "minisearch";
import type { SearchDocument } from "@xpotato/content-contracts";
import { describe, expect, it } from "vitest";
import { miniSearchOptions } from "./config.js";
import { createSearchIndexFromDocuments, loadSearchIndex, searchSearchIndex, serializeSearchIndex } from "./runtime.js";
import { compactSearchIndex, expandSearchIndex } from "./transport.js";

const documents: SearchDocument[] = [
  { id: "f8a847d4-8f5d-4bb0-a387-750f096479f2", route: "/target/", collection: "blog", title: "新幹線 MuJoCo 4.0", description: "日本語と技術語", taxonomyText: "robotics simulation", headingText: "新幹線 接触予測", bodyText: "新幹線 新幹線 MuJoCo 4.0 C++ C# GPT-5.6 WSL ネットワーク", cjkSingles: "新 幹 線 接 触 予 測", pubDate: "2026-11-13", thumbnail: { src: "https://example.com/cover.png", width: 1600, height: 900, sources: [{ type: "image/webp", candidates: [{ src: "https://example.com/cover.webp", width: 800 }] }] } },
  { id: "90af3222-b287-412f-99eb-fcd9ee92a579", route: "/generic/", collection: "notes", title: "新しい設計", description: "一般", taxonomyText: "", headingText: "", bodyText: "新しい MuJoCo 4.0", cjkSingles: "新" },
];

const makeIndex = () => createSearchIndexFromDocuments(documents);

describe("lossless search index transport", () => {
  it("reconstructs the exact native JSON, including metadata and stored result fields", () => {
    const index = makeIndex();
    const original = JSON.stringify(index);
    const packed = serializeSearchIndex(index);
    expect(JSON.stringify(expandSearchIndex(JSON.parse(packed)))).toBe(original);
    expect(JSON.stringify(index)).toBe(original);
    expect(serializeSearchIndex(index)).toBe(packed);
    expect(Buffer.byteLength(packed)).toBeLessThan(Buffer.byteLength(original));
    expect(JSON.parse(packed).postingsFormat).toBe("xpotato-field-tuples-v1");
  });

  it("preserves every result, score, order, and field for all indexed terms and mixed queries", () => {
    const index = makeIndex();
    const native = MiniSearch.loadJSON<SearchDocument>(JSON.stringify(index), miniSearchOptions);
    const compact = loadSearchIndex(serializeSearchIndex(index));
    const legacy = loadSearchIndex(JSON.stringify(index));
    const queries = [...index.toJSON().index.map(([term]) => term), "新幹線", "MuJoCo 4.0", "WSL ネットワーク", "C++", "C#", "GPT-5.6", "missing", ""];
    for (const query of queries) {
      expect(searchSearchIndex(compact, query)).toEqual(searchSearchIndex(native, query));
      expect(searchSearchIndex(legacy, query)).toEqual(searchSearchIndex(native, query));
    }
    expect(searchSearchIndex(compact, "新幹線")[0]).toMatchObject({ id: documents[0]!.id, thumbnail: documents[0]!.thumbnail });
  });

  it("retains sparse document IDs, empty fields, empty terms, and empty indexes", () => {
    const index = makeIndex();
    index.discard(documents[0]!.id);
    const original = index.toJSON();
    original.index.push(["empty-fields", {}], ["empty-documents", { 3: {} }]);
    expect(JSON.stringify(expandSearchIndex(compactSearchIndex(original)))).toBe(JSON.stringify(original));
    const empty = createSearchIndexFromDocuments([]);
    expect(JSON.stringify(expandSearchIndex(compactSearchIndex(empty.toJSON())))).toBe(JSON.stringify(empty));
    expect(loadSearchIndex(serializeSearchIndex(empty)).documentCount).toBe(0);
  });

  it("rejects unknown formats and malformed or duplicate postings instead of changing results", () => {
    const packed = compactSearchIndex(makeIndex().toJSON());
    expect(() => expandSearchIndex({ ...packed, postingsFormat: "unknown" } as never)).toThrow(/format/);
    expect(() => compactSearchIndex({ ...makeIndex().toJSON(), serializationVersion: 3 })).toThrow(/version/);
    expect(() => expandSearchIndex({ ...packed, serializationVersion: 3 })).toThrow(/format/);
    expect(() => expandSearchIndex({ ...packed, index: [["duplicate"], ["duplicate"]] })).toThrow(/Invalid search/);
    for (const fields of [[[0, 1]], [[-1]], [[0], [0]], [[0, 1, 0]], [[0, 1, 1, 1, 2]], [[0, 0.5, 1]]]) {
      expect(() => expandSearchIndex({ ...packed, index: [["broken", ...fields]] } as never)).toThrow(/Invalid search/);
    }
  });
});
