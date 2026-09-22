import MiniSearch from "minisearch";
import type { SearchDocument } from "@xpotato/content-contracts";
import { createSearchIndex, miniSearchOptions } from "./config.js";

export const createSearchIndexFromDocuments = (documents: readonly SearchDocument[]): MiniSearch<SearchDocument> => {
  const index = createSearchIndex();
  index.addAll([...documents]);
  return index;
};

export const serializeSearchIndex = (index: MiniSearch<SearchDocument>): string => `${JSON.stringify(index)}\n`;

export const loadSearchIndex = (serialized: string): MiniSearch<SearchDocument> =>
  MiniSearch.loadJSON<SearchDocument>(serialized, miniSearchOptions);

export const searchSearchIndex = (index: MiniSearch<SearchDocument>, query: string) =>
  index.search(query, miniSearchOptions.searchOptions);
