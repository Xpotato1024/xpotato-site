import MiniSearch from "minisearch";
import type { Options } from "minisearch";
import type { SearchDocument } from "@xpotato/content-contracts";
import { tokenize } from "./tokenizer.js";

export const miniSearchOptions: Options<SearchDocument> = {
    idField: "id",
    fields: ["title", "taxonomyText", "headingText", "bodyText", "cjkSingles"],
    storeFields: ["route", "collection", "title", "description", "pubDate"],
    tokenize: (value: string) => [...tokenize(value)],
    searchOptions: {
      combineWith: "AND",
      fuzzy: false,
      boost: { title: 6, taxonomyText: 3, headingText: 2, bodyText: 1, cjkSingles: 0.25 },
    },
  };

export const createSearchIndex = (): MiniSearch<SearchDocument> => new MiniSearch<SearchDocument>(miniSearchOptions);
