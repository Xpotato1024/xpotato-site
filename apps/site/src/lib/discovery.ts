import type { ContentDiscoveryRecord, TaxonomyRegistry } from "@xpotato/content-contracts";
import { discoveryProfile } from "../content-registry/discovery.js";

export const paginate = <T>(items: readonly T[], pageSize: number): readonly (readonly T[])[] => {
  if (!Number.isInteger(pageSize) || pageSize <= 0) throw new Error("pageSize must be positive");
  return Array.from({ length: Math.ceil(items.length / pageSize) }, (_, index) => items.slice(index * pageSize, (index + 1) * pageSize));
};

export const archiveRoute = (root: string, page: number): string => {
  if (!Number.isInteger(page) || page < 1) throw new Error("page starts at 1");
  return page === 1 ? `${root.replace(/\/$/u, "")}/` : `${root.replace(/\/$/u, "")}/page/${page}/`;
};

export const relatedScore = (
  source: ContentDiscoveryRecord,
  candidate: ContentDiscoveryRecord,
  taxonomy: TaxonomyRegistry,
): number => {
  if (source.contentId === candidate.contentId) return -1;
  let score = source.collection === candidate.collection ? discoveryProfile.related.weights.sameCollection : 0;
  const primary = (record: ContentDiscoveryRecord) => record.categoryId ?? record.subjectId ?? record.toolCategoryId;
  if (primary(source) && primary(source) === primary(candidate)) score += discoveryProfile.related.weights.samePrimaryTaxonomy;
  const tags = new Map(taxonomy.tags.map((tag) => [tag.id, tag.kind]));
  for (const id of source.tagIds.filter((tagId) => candidate.tagIds.includes(tagId))) {
    score += tags.get(id) === "technology" ? discoveryProfile.related.weights.sharedTechnologyTag : discoveryProfile.related.weights.sharedTopicTag;
  }
  return score;
};

export const selectRelated = (
  source: ContentDiscoveryRecord,
  candidates: readonly ContentDiscoveryRecord[],
  taxonomy: TaxonomyRegistry,
): readonly ContentDiscoveryRecord[] =>
  candidates
    .filter((candidate) => candidate.webIndexable && candidate.contentId !== source.contentId)
    .map((candidate) => ({ candidate, score: relatedScore(source, candidate, taxonomy) }))
    .filter(({ score }) => score >= discoveryProfile.related.minimumScore)
    .sort((left, right) => right.score - left.score || left.candidate.contentId.localeCompare(right.candidate.contentId))
    .slice(0, discoveryProfile.related.maxItems)
    .map(({ candidate }) => candidate);
