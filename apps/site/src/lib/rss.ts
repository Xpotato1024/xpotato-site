import type { ContentDiscoveryRecord, TaxonomyRegistry } from "@xpotato/content-contracts";
import { discoveryProfile } from "../content-registry/discovery.js";
import { sortNewestFirst } from "./discovery.js";

export interface RssSiteIdentity {
  canonicalOrigin: string;
  name: string;
  description: string;
}

const escapeXml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const labelsFor = (record: ContentDiscoveryRecord, taxonomy: TaxonomyRegistry) => {
  const category = record.categoryId
    ? taxonomy.blogCategories.find((term) => term.id === record.categoryId && term.status === "active")?.label
    : undefined;
  const activeTags = new Map(
    taxonomy.tags.filter((tag) => tag.status === "active").map((tag) => [tag.id, tag.label] as const),
  );
  return {
    categories: category ? [category] : [],
    tags: [...new Set(record.tagIds)].flatMap((id) => {
      const label = activeTags.get(id);
      return label ? [label] : [];
    }),
  };
};

/** Renders the profile's public Blog summary feed from derived metadata only. */
export const renderRssFeed = (
  records: readonly ContentDiscoveryRecord[],
  taxonomy: TaxonomyRegistry,
  site: RssSiteIdentity,
): string => {
  if (!discoveryProfile.feed.enabled) return "";
  if (discoveryProfile.feed.contentMode !== "summary") throw new Error("Only summary RSS mode is supported by this renderer");
  const items = sortNewestFirst(
    records.filter(
      (record) =>
        record.collection === "blog" &&
        record.webIndexable &&
        record.pubDate,
    ),
  )
    .slice(0, discoveryProfile.feed.maxItems)
    .map((record) => {
      const canonicalUrl = new URL(record.route, site.canonicalOrigin).href;
      const labels = labelsFor(record, taxonomy);
      const categories = [...labels.categories, ...labels.tags]
        .map((label) => `<category>${escapeXml(label)}</category>`)
        .join("");
      return `<item><guid isPermaLink="false">${escapeXml(`${site.canonicalOrigin}#${record.contentId}`)}</guid><title>${escapeXml(record.title)}</title><description>${escapeXml(record.description)}</description><link>${escapeXml(canonicalUrl)}</link><pubDate>${new Date(`${record.pubDate}T00:00:00+09:00`).toUTCString()}</pubDate>${categories}</item>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(site.name)}</title><link>${escapeXml(site.canonicalOrigin)}</link><description>${escapeXml(site.description)}</description>${items.join("")}</channel></rss>`;
};
