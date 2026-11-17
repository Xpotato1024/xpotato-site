import { discoveryProfileSchema } from "@xpotato/content-contracts";

export const discoveryProfile = discoveryProfileSchema.parse({
  schemaVersion: 1,
  pagination: { blogPageSize: 12, notesPageSize: 12 },
  feed: { enabled: true, path: "/rss.xml", maxItems: 20, contentMode: "summary" },
  related: {
    maxItems: 4,
    weights: { sameCollection: 1, samePrimaryTaxonomy: 2, sharedTechnologyTag: 4, sharedTopicTag: 2 },
    minimumScore: 4,
  },
  search: {
    enabled: true,
    route: "/search/",
    engine: "minisearch",
    engineVersion: "7.2.0",
    tokenizerId: "xpotato-ja-tech-bigram-v1",
    includeCollections: ["blog", "notes", "projects", "tools", "pages"],
  },
});
