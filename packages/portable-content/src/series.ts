import type { ContentCollection } from "@xpotato/content-contracts/common";
import {
  seriesRegistrySchema,
  type SeriesRecord,
  type SeriesRegistry,
} from "@xpotato/content-contracts/series";
import type { DerivedCatalogEntry } from "./catalog.js";

export interface PublicSeriesEntry {
  contentId: string;
  collection: ContentCollection;
  title: string;
  description: string;
  route: string;
  ordinal: number;
  label?: string;
}

export interface PublicSeries {
  id: string;
  slug: string;
  title: string;
  description: string;
  kind: SeriesRecord["kind"];
  status: SeriesRecord["status"];
  route: string;
  entries: PublicSeriesEntry[];
}

export interface SeriesNavigation {
  series: PublicSeries;
  current: PublicSeriesEntry;
  previous?: PublicSeriesEntry;
  next?: PublicSeriesEntry;
}

export const validateSeriesReferences = (
  registry: SeriesRegistry,
  knownContentIds: Iterable<string>,
): string[] => {
  const known = new Set(knownContentIds);
  return registry.series.flatMap((series) =>
    series.entries
      .filter((entry) => !known.has(entry.contentId))
      .map((entry) => `Series ${series.id} references unknown ContentId: ${entry.contentId}`),
  );
};

/** Only this projection may cross from the editorial registry into a public page. */
export const derivePublicSeries = (
  input: SeriesRegistry,
  catalog: readonly DerivedCatalogEntry[],
): PublicSeries[] => {
  const registry = seriesRegistrySchema.parse(input);
  const byId = new Map(catalog.map((entry) => [entry.routeRecord.contentId, entry]));
  const errors = validateSeriesReferences(registry, byId.keys());
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return registry.series.flatMap((series) => {
    const entries: PublicSeriesEntry[] = [];
    for (const member of series.entries) {
      const content = byId.get(member.contentId)!;
      if (content.disposition !== "published" || !content.discoveryRecord.webIndexable) {
        continue;
      }
      entries.push({
        contentId: member.contentId,
        collection: content.routeRecord.collection,
        title: content.discoveryRecord.title,
        description: content.discoveryRecord.description,
        route: content.routeRecord.route,
        ordinal: entries.length + 1,
        ...(member.label ? { label: member.label } : {}),
      });
    }
    if (entries.length === 0) {
      return [];
    }
    return [
      {
        id: series.id,
        slug: series.slug,
        title: series.title,
        description: series.description,
        kind: series.kind,
        status: series.status,
        route: `/series/${series.slug}/`,
        entries,
      },
    ];
  });
};

export const seriesForContent = (
  contentId: string,
  allSeries: readonly PublicSeries[],
): SeriesNavigation[] =>
  allSeries.flatMap((series) => {
    const index = series.entries.findIndex((entry) => entry.contentId === contentId);
    const current = series.entries[index];
    if (!current) {
      return [];
    }
    const previous = series.entries[index - 1];
    const next = series.entries[index + 1];
    return [
      {
        series,
        current,
        ...(previous ? { previous } : {}),
        ...(next ? { next } : {}),
      },
    ];
  });
