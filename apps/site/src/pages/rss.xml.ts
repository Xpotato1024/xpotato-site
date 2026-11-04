import type { APIRoute } from "astro";
import { taxonomyRegistry } from "../content-registry/taxonomy/index.js";
import { siteConfig } from "../lib/site-config.js";
import { selectFeedEligibleCatalog } from "../lib/discovery/catalog.js";
import { getLiveContentCatalog } from "../lib/discovery/live-catalog.js";
import { renderRssFeed } from "../lib/discovery/rss.js";

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
