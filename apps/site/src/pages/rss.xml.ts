import type { APIRoute } from "astro";
import { taxonomyRegistry } from "../../../../content/registry/taxonomy/index.js";
import { siteConfig } from "../shared/lib/site-config.js";
import { selectFeedEligibleCatalog } from "@xpotato/portable-content/catalog";
import { getLiveContentCatalog } from "../features/discovery/model/live-catalog.js";
import { renderRssFeed } from "../features/discovery/model/rss.js";

export const GET: APIRoute = async () => {
  const catalog = selectFeedEligibleCatalog(await getLiveContentCatalog());
  const xml = renderRssFeed(
    catalog.map((entry) => entry.discoveryRecord),
    taxonomyRegistry,
    {
      canonicalOrigin: siteConfig.site.canonicalOrigin,
      name: siteConfig.site.name,
      description: siteConfig.site.defaultDescription,
    },
  );
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
};
