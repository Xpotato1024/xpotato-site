import { getCollection } from "astro:content";
import { taxonomyRegistry } from "../content-registry/taxonomy/index.js";
import { deriveContentCatalog, type CatalogSourceRecord } from "./catalog.js";

/** Adapts validated Astro entries to the pure catalog derivation used by offline callers too. */
export const getLiveContentCatalog = async () => {
  const [blog, notes, projects, tools, pages] = await Promise.all([
    getCollection("blog"),
    getCollection("notes"),
    getCollection("projects"),
    getCollection("tools"),
    getCollection("pages"),
  ]);

  const records: CatalogSourceRecord[] = [
    ...blog.map((entry) => ({ collection: "blog" as const, slug: entry.id, data: entry.data })),
    ...notes.map((entry) => ({ collection: "notes" as const, slug: entry.id, data: entry.data })),
    ...projects.map((entry) => ({ collection: "projects" as const, slug: entry.id, data: entry.data })),
    ...tools.map((entry) => ({ collection: "tools" as const, slug: entry.id, data: entry.data })),
    ...pages.map((entry) => ({ collection: "pages" as const, slug: entry.id, data: entry.data })),
  ];
  return deriveContentCatalog(records, taxonomyRegistry);
};
