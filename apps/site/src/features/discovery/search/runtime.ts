import MiniSearch from "minisearch";
import type { SearchDocument } from "@xpotato/content-contracts";
import { createSearchIndex, miniSearchOptions } from "./config.js";
import { compactSearchIndex, expandSearchIndex } from "./transport.js";

export const createSearchIndexFromDocuments = (documents: readonly SearchDocument[]): MiniSearch<SearchDocument> => {
  const index = createSearchIndex();
  index.addAll([...documents]);
  return index;
};

export const serializeSearchIndex = (index: MiniSearch<SearchDocument>): string =>
  `${JSON.stringify(compactSearchIndex(index.toJSON()))}\n`;

export const loadSearchIndex = (serialized: string): MiniSearch<SearchDocument> =>
  MiniSearch.loadJSON<SearchDocument>(JSON.stringify(expandSearchIndex(JSON.parse(serialized))), miniSearchOptions);

export const searchSearchIndex = (index: MiniSearch<SearchDocument>, query: string) =>
  index.search(query, miniSearchOptions.searchOptions);
