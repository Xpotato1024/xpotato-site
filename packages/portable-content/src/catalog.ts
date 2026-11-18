import {
  articleRoute,
  articleUrlId,
  blogSourceFrontmatterSchema,
  contentDiscoveryRecordSchema,
  contentRouteRecordSchema,
  noteSourceFrontmatterSchema,
  pageSourceFrontmatterSchema,
  projectSourceFrontmatterSchema,
  toolSourceFrontmatterSchema,
  type BlogSourceFrontmatter,
  type ContentCollection,
  type ContentDiscoveryRecord,
  type NoteSourceFrontmatter,
  type PageSourceFrontmatter,
  type ProjectSourceFrontmatter,
  type TaxonomyRegistry,
  type ToolSourceFrontmatter,
} from "@xpotato/content-contracts";
import { isFeedEligible } from "./feed.js";

export type CatalogSourceRecord =
  | { collection: "blog"; slug: string; data: BlogSourceFrontmatter }
  | { collection: "notes"; slug: string; data: NoteSourceFrontmatter }
  | { collection: "projects"; slug: string; data: ProjectSourceFrontmatter }
  | { collection: "tools"; slug: string; data: ToolSourceFrontmatter }
  | { collection: "pages"; slug: string; data: PageSourceFrontmatter };

export type ContentRouteRecord = ReturnType<typeof contentRouteRecordSchema.parse>;
export type CatalogDisposition = "published" | "held_candidate";

export interface DerivedCatalogEntry {
  source: CatalogSourceRecord;
  routeRecord: ContentRouteRecord;
  discoveryRecord: ContentDiscoveryRecord;
  disposition: CatalogDisposition;
}

const collectionPrefixes: Record<ContentCollection, string> = {
  blog: "blog",
  notes: "notes",
  projects: "projects",
  tools: "tools",
  pages: "",
};

const parseFrontmatter = (record: CatalogSourceRecord) => {
  switch (record.collection) {
    case "blog":
      return blogSourceFrontmatterSchema.parse(record.data);
    case "notes":
      return noteSourceFrontmatterSchema.parse(record.data);
    case "projects":
      return projectSourceFrontmatterSchema.parse(record.data);
    case "tools":
      return toolSourceFrontmatterSchema.parse(record.data);
    case "pages":
      return pageSourceFrontmatterSchema.parse(record.data);
  }
};

const taxonomyField = (record: CatalogSourceRecord) => {
  switch (record.collection) {
    case "blog":
      return { categoryId: record.data.category };
    case "notes":
      return { subjectId: record.data.subject };
    case "tools":
      return { toolCategoryId: record.data.category };
    default:
      return {};
  }
};

const tagIdsFor = (record: CatalogSourceRecord): string[] => {
  const tags = "tags" in record.data ? record.data.tags : [];
  const stack = record.collection === "projects" ? (record.data.stack ?? []) : [];
  return [...new Set([...tags, ...stack])];
};

const reservedPageRoutes = new Set([
  "/blog/",
  "/articles/",
  "/notes/",
  "/projects/",
  "/pages/",
  "/tools/",
  "/search/",
  "/series/",
  "/rss/",
  "/robots/",
  "/404/",
  "/404.html/",
]);

export const deriveContentCatalog = (
  records: readonly CatalogSourceRecord[],
  _taxonomy: TaxonomyRegistry,
): DerivedCatalogEntry[] => {
  const routes = new Set<string>();
  const contentIds = new Set<string>();
  const sourcePaths = new Set<string>();
  const entries = records.map((source): DerivedCatalogEntry => {
    const data = parseFrontmatter(source);
    const prefix = collectionPrefixes[source.collection];
    const slug = source.slug.replace(/^\/+|\/+$/gu, "");
    const route =
      source.collection === "blog"
        ? articleRoute(data.id)
        : `/${prefix ? `${prefix}/` : ""}${slug}/`;
    if (
      source.collection === "pages" &&
      (reservedPageRoutes.has(route) || route.startsWith("/series/"))
    ) {
      throw new Error(`Page content route collides with a reserved site route: ${route}`);
    }
    if (contentIds.has(data.id))
      throw new Error(`Duplicate ContentId in content catalog: ${data.id}`);
    if (routes.has(route)) throw new Error(`Duplicate content route: ${route}`);
    const sourcePath = source.collection + "/" + slug;
    if (sourcePaths.has(sourcePath))
      throw new Error(`Duplicate content source path: ${sourcePath}`);
    sourcePaths.add(sourcePath);
    routes.add(route);
    contentIds.add(data.id);
    const routeRecord = contentRouteRecordSchema.parse({
      contentId: data.id,
      collection: source.collection,
      slug: source.collection === "blog" ? articleUrlId(data.id) : slug,
      route,
      canonical: true,
    });
    const noindex = data.seo?.noindex === true;
    const discoveryRecord = contentDiscoveryRecordSchema.parse({
      contentId: data.id,
      collection: source.collection,
      route,
      title: data.title,
      // Held drafts never enter discovery. Keep authored metadata unchanged;
      // use the title only as the nonempty internal catalog label while editing.
      description: data.draft && !data.description ? data.title : data.description,
      ...("pubDate" in data ? { pubDate: data.pubDate } : {}),
      ...(data.updatedDate ? { updatedDate: data.updatedDate } : {}),
      ...("publishedAt" in data && data.publishedAt ? { publishedAt: data.publishedAt } : {}),
      ...("updatedAt" in data && data.updatedAt ? { updatedAt: data.updatedAt } : {}),
      ...taxonomyField(source),
      tagIds: tagIdsFor(source),
      featured: "featured" in data && data.featured === true,
      siteSearchEligible: !data.draft && !noindex,
      webIndexable: !data.draft && !noindex,
      ...(data.feed === undefined ? {} : { feed: data.feed }),
    });
    return {
      source,
      routeRecord,
      discoveryRecord,
      disposition: data.draft ? "held_candidate" : "published",
    };
  });
  return entries;
};

/** Selects real public detail routes. noindex suppresses discovery surfaces, not the detail URL. */
export const selectPublishedCatalog = (
  entries: readonly DerivedCatalogEntry[],
): DerivedCatalogEntry[] => entries.filter((entry) => entry.disposition === "published");

/** Selects public records allowed into indexable archives, feeds, and related-content candidates. */
export const selectWebIndexableCatalog = (
  entries: readonly DerivedCatalogEntry[],
): DerivedCatalogEntry[] =>
  entries.filter(
    (entry) => entry.disposition === "published" && entry.discoveryRecord.webIndexable,
  );

export const selectSearchEligibleCatalog = (
  entries: readonly DerivedCatalogEntry[],
): DerivedCatalogEntry[] =>
  entries.filter(
    (entry) => entry.disposition === "published" && entry.discoveryRecord.siteSearchEligible,
  );

export const selectFeedEligibleCatalog = (
  entries: readonly DerivedCatalogEntry[],
): DerivedCatalogEntry[] =>
  entries.filter(
    (entry) => entry.disposition === "published" && isFeedEligible(entry.discoveryRecord),
  );
