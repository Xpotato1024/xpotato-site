import {
  blogFrontmatterSchema,
  contentDiscoveryRecordSchema,
  contentRouteRecordSchema,
  noteFrontmatterSchema,
  pageFrontmatterSchema,
  projectFrontmatterSchema,
  toolFrontmatterSchema,
  type BlogFrontmatter,
  type ContentCollection,
  type ContentDiscoveryRecord,
  type NoteFrontmatter,
  type PageFrontmatter,
  type ProjectFrontmatter,
  type TaxonomyRegistry,
  type ToolFrontmatter,
} from "@xpotato/content-contracts";

export type CatalogSourceRecord =
  | { collection: "blog"; slug: string; data: BlogFrontmatter }
  | { collection: "notes"; slug: string; data: NoteFrontmatter }
  | { collection: "projects"; slug: string; data: ProjectFrontmatter }
  | { collection: "tools"; slug: string; data: ToolFrontmatter }
  | { collection: "pages"; slug: string; data: PageFrontmatter };

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
      return blogFrontmatterSchema.parse(record.data);
    case "notes":
      return noteFrontmatterSchema.parse(record.data);
    case "projects":
      return projectFrontmatterSchema.parse(record.data);
    case "tools":
      return toolFrontmatterSchema.parse(record.data);
    case "pages":
      return pageFrontmatterSchema.parse(record.data);
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
  const stack = record.collection === "projects" ? record.data.stack ?? [] : [];
  return [...new Set([...tags, ...stack])];
};

const reservedPageRoutes = new Set([
  "/blog/",
  "/notes/",
  "/projects/",
  "/pages/",
  "/tools/",
  "/search/",
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
  const entries = records.map((source): DerivedCatalogEntry => {
    const data = parseFrontmatter(source);
    const prefix = collectionPrefixes[source.collection];
    const slug = source.slug.replace(/^\/+|\/+$/gu, "");
    const route = `/${prefix ? `${prefix}/` : ""}${slug}/`;
    if (source.collection === "pages" && reservedPageRoutes.has(route)) {
      throw new Error(`Page content route collides with a reserved site route: ${route}`);
    }
    if (routes.has(route)) throw new Error(`Duplicate content route: ${route}`);
    if (contentIds.has(data.id)) throw new Error(`Duplicate ContentId in content catalog: ${data.id}`);
    routes.add(route);
    contentIds.add(data.id);
    const routeRecord = contentRouteRecordSchema.parse({
      contentId: data.id,
      collection: source.collection,
      slug,
      route,
      canonical: true,
    });
    const noindex = data.seo?.noindex === true;
    const discoveryRecord = contentDiscoveryRecordSchema.parse({
      contentId: data.id,
      collection: source.collection,
      route,
      title: data.title,
      description: data.description,
      ...( "pubDate" in data ? { pubDate: data.pubDate } : {}),
      ...(data.updatedDate ? { updatedDate: data.updatedDate } : {}),
      ...taxonomyField(source),
      tagIds: tagIdsFor(source),
      featured: "featured" in data && data.featured === true,
      siteSearchEligible: !data.draft && !noindex,
      webIndexable: !data.draft && !noindex,
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
export const selectPublishedCatalog = (entries: readonly DerivedCatalogEntry[]): DerivedCatalogEntry[] =>
  entries.filter((entry) => entry.disposition === "published");

/** Selects public records allowed into indexable archives, feeds, and related-content candidates. */
export const selectWebIndexableCatalog = (entries: readonly DerivedCatalogEntry[]): DerivedCatalogEntry[] =>
  entries.filter((entry) => entry.disposition === "published" && entry.discoveryRecord.webIndexable);

export const selectSearchEligibleCatalog = (entries: readonly DerivedCatalogEntry[]): DerivedCatalogEntry[] =>
  entries.filter((entry) => entry.disposition === "published" && entry.discoveryRecord.siteSearchEligible);
