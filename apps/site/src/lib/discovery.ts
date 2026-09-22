import type { ContentDiscoveryRecord, TaxonomyRegistry } from "@xpotato/content-contracts";
import { discoveryProfile } from "../content-registry/discovery.js";

export type ArchiveScope =
  | { kind: "root" }
  | { kind: "category"; id: string }
  | { kind: "tag"; id: string }
  | { kind: "subject"; id: string }
  | { kind: "year"; year: number };

export interface GeneratedArchivePage {
  collection: "blog" | "notes";
  scope: ArchiveScope;
  page: number;
  totalPages: number;
  route: string;
  itemContentIds: string[];
  title: string;
  description: string;
  noindex: boolean;
  items: ContentDiscoveryRecord[];
}

/** Returns archive paths that belong to the collection catch-all route, leaving page 1 to its index page. */
export const selectDynamicArchivePages = (
  pages: readonly GeneratedArchivePage[],
  collection: "blog" | "notes",
): GeneratedArchivePage[] =>
  pages.filter((page) => page.collection === collection && !(page.scope.kind === "root" && page.page === 1));

export const compareNewestFirst = <T extends { contentId: string; pubDate?: string | undefined }>(left: T, right: T): number =>
  (right.pubDate ?? "").localeCompare(left.pubDate ?? "") || left.contentId.localeCompare(right.contentId);

export const sortNewestFirst = <T extends { contentId: string; pubDate?: string | undefined }>(items: readonly T[]): T[] =>
  [...items].sort(compareNewestFirst);

export const paginate = <T>(items: readonly T[], pageSize: number): readonly (readonly T[])[] => {
  if (!Number.isInteger(pageSize) || pageSize <= 0) throw new Error("pageSize must be positive");
  return Array.from({ length: Math.ceil(items.length / pageSize) }, (_, index) =>
    items.slice(index * pageSize, (index + 1) * pageSize),
  );
};

export const archiveRoute = (root: string, page: number): string => {
  if (!Number.isInteger(page) || page < 1) throw new Error("page starts at 1");
  return page === 1 ? `${root.replace(/\/$/u, "")}/` : `${root.replace(/\/$/u, "")}/page/${page}/`;
};

const scopeRoot = (collection: "blog" | "notes", scope: ArchiveScope, taxonomy: TaxonomyRegistry): string => {
  if (scope.kind === "root") return `/${collection}/`;
  if (scope.kind === "category") {
    const term = taxonomy.blogCategories.find((candidate) => candidate.id === scope.id && candidate.status === "active");
    if (!term) throw new Error(`Unknown or retired Blog category: ${scope.id}`);
    return `/blog/category/${term.slug}/`;
  }
  if (scope.kind === "tag") {
    const term = taxonomy.tags.find((candidate) => candidate.id === scope.id && candidate.status === "active" && candidate.archive);
    if (!term) throw new Error(`Unknown, retired, or non-archive tag: ${scope.id}`);
    return `/blog/tag/${term.slug}/`;
  }
  if (scope.kind === "subject") {
    const term = taxonomy.noteSubjects.find((candidate) => candidate.id === scope.id && candidate.status === "active" && candidate.archive);
    if (!term) throw new Error(`Unknown, retired, or non-archive Note subject: ${scope.id}`);
    return `/notes/subject/${term.slug}/`;
  }
  if (collection !== "blog" || !Number.isInteger(scope.year) || scope.year < 1000 || scope.year > 9999) {
    throw new Error("Year archives require a four-digit Blog year");
  }
  return `/blog/archive/${scope.year}/`;
};

const recordsForScope = (
  records: readonly ContentDiscoveryRecord[],
  collection: "blog" | "notes",
  scope: ArchiveScope,
): ContentDiscoveryRecord[] =>
  records.filter((record) => {
    if (record.collection !== collection || !record.webIndexable) return false;
    switch (scope.kind) {
      case "root":
        return true;
      case "category":
        return collection === "blog" && record.categoryId === scope.id;
      case "tag":
        return collection === "blog" && record.tagIds.includes(scope.id);
      case "subject":
        return collection === "notes" && record.subjectId === scope.id;
      case "year":
        return collection === "blog" && record.pubDate?.slice(0, 4) === String(scope.year);
    }
  });

const archiveTitle = (
  collection: "blog" | "notes",
  scope: ArchiveScope,
  taxonomy: TaxonomyRegistry,
): { title: string; description: string; noindex: boolean } => {
  if (scope.kind === "root") {
    return collection === "blog"
      ? { title: "Blog", description: "技術とものづくりの記事一覧です。", noindex: false }
      : { title: "Notes", description: "補助ノートの一覧です。", noindex: false };
  }
  if (scope.kind === "category") {
    const term = taxonomy.blogCategories.find((candidate) => candidate.id === scope.id)!;
    return { title: `Blog: ${term.label}`, description: term.description, noindex: !term.indexable };
  }
  if (scope.kind === "tag") {
    const term = taxonomy.tags.find((candidate) => candidate.id === scope.id)!;
    return {
      title: `Blog tag: ${term.label}`,
      description: term.description ?? `${term.label} に関連する記事です。`,
      noindex: !term.indexable,
    };
  }
  if (scope.kind === "subject") {
    const term = taxonomy.noteSubjects.find((candidate) => candidate.id === scope.id)!;
    return { title: `Notes: ${term.label}`, description: term.description, noindex: !term.indexable };
  }
  return { title: `Blog archive: ${scope.year}`, description: `${scope.year}年に公開した記事です。`, noindex: false };
};

/**
 * Derives the route list for already-selected public records. Normal production callers must pass
 * selectWebIndexableCatalog output; evidence tools may explicitly pass a separate candidate projection.
 */
export const generateArchivePages = (
  records: readonly ContentDiscoveryRecord[],
  taxonomy: TaxonomyRegistry,
): GeneratedArchivePage[] => {
  const pages: GeneratedArchivePage[] = [];
  const addScope = (
    collection: "blog" | "notes",
    scope: ArchiveScope,
    pageSize: number,
    rootAlways: boolean,
  ) => {
    const items = sortNewestFirst(recordsForScope(records, collection, scope));
    if (!items.length && !rootAlways) return;
    const chunks = paginate(items, pageSize);
    const totalPages = Math.max(rootAlways ? 1 : 0, chunks.length);
    const base = scopeRoot(collection, scope, taxonomy);
    const meta = archiveTitle(collection, scope, taxonomy);
    for (let index = 0; index < totalPages; index += 1) {
      const pageNumber = index + 1;
      const pageItems = chunks[index] ?? [];
      pages.push({
        collection,
        scope,
        page: pageNumber,
        totalPages,
        route: archiveRoute(base, pageNumber),
        itemContentIds: pageItems.map((item) => item.contentId),
        title: pageNumber === 1 ? meta.title : `${meta.title} (${pageNumber})`,
        description: meta.description,
        noindex: meta.noindex,
        items: [...pageItems],
      });
    }
  };

  addScope("blog", { kind: "root" }, discoveryProfile.pagination.blogPageSize, true);
  addScope("notes", { kind: "root" }, discoveryProfile.pagination.notesPageSize, true);

  for (const category of taxonomy.blogCategories.filter((term) => term.status === "active")) {
    addScope("blog", { kind: "category", id: category.id }, discoveryProfile.pagination.blogPageSize, false);
  }

  const activeArchiveTags = taxonomy.tags.filter((term) => term.status === "active" && term.archive);
  for (const tag of activeArchiveTags) {
    addScope("blog", { kind: "tag", id: tag.id }, discoveryProfile.pagination.blogPageSize, false);
  }

  for (const subject of taxonomy.noteSubjects.filter((term) => term.status === "active" && term.archive)) {
    addScope("notes", { kind: "subject", id: subject.id }, discoveryProfile.pagination.notesPageSize, false);
  }

  const years = [...new Set(
    records
      .filter((record) => record.collection === "blog" && record.webIndexable && /^\d{4}$/u.test(record.pubDate?.slice(0, 4) ?? ""))
      .map((record) => Number(record.pubDate!.slice(0, 4))),
  )].sort((left, right) => right - left);
  for (const year of years) addScope("blog", { kind: "year", year }, discoveryProfile.pagination.blogPageSize, false);

  return pages;
};

const primaryTaxonomy = (record: ContentDiscoveryRecord): { namespace: string; id: string } | undefined => {
  if (record.collection === "blog" && record.categoryId) return { namespace: "blog-category", id: record.categoryId };
  if (record.collection === "notes" && record.subjectId) return { namespace: "note-subject", id: record.subjectId };
  if (record.collection === "tools" && record.toolCategoryId) return { namespace: "tool-category", id: record.toolCategoryId };
  return undefined;
};

export const relatedScore = (
  source: ContentDiscoveryRecord,
  candidate: ContentDiscoveryRecord,
  taxonomy: TaxonomyRegistry,
): number => {
  if (
    source.contentId === candidate.contentId ||
    !source.webIndexable ||
    !candidate.webIndexable
  ) {
    return -1;
  }
  let score = source.collection === candidate.collection ? discoveryProfile.related.weights.sameCollection : 0;
  const sourcePrimary = primaryTaxonomy(source);
  const candidatePrimary = primaryTaxonomy(candidate);
  if (sourcePrimary && candidatePrimary && sourcePrimary.namespace === candidatePrimary.namespace && sourcePrimary.id === candidatePrimary.id) {
    score += discoveryProfile.related.weights.samePrimaryTaxonomy;
  }
  const activeTags = new Map(
    taxonomy.tags.filter((tag) => tag.status === "active").map((tag) => [tag.id, tag.kind] as const),
  );
  const candidateTags = new Set(candidate.tagIds);
  for (const id of new Set(source.tagIds)) {
    if (!candidateTags.has(id)) continue;
    const kind = activeTags.get(id);
    if (kind === "technology") score += discoveryProfile.related.weights.sharedTechnologyTag;
    if (kind === "topic") score += discoveryProfile.related.weights.sharedTopicTag;
  }
  return score;
};

export const selectRelated = (
  source: ContentDiscoveryRecord,
  candidates: readonly ContentDiscoveryRecord[],
  taxonomy: TaxonomyRegistry,
): readonly ContentDiscoveryRecord[] => {
  if (!source.webIndexable) return [];
  return candidates
    .filter((candidate) => candidate.webIndexable && candidate.contentId !== source.contentId)
    .map((candidate) => ({ candidate, score: relatedScore(source, candidate, taxonomy) }))
    .filter(({ score }) => score >= discoveryProfile.related.minimumScore)
    .sort(
      (left, right) =>
        right.score - left.score ||
        compareNewestFirst(left.candidate, right.candidate),
    )
    .slice(0, discoveryProfile.related.maxItems)
    .map(({ candidate }) => candidate);
};
