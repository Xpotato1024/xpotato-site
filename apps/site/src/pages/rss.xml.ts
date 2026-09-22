import type { APIRoute } from "astro";
import { taxonomyRegistry } from "../content-registry/taxonomy/index.js";
import { siteConfig } from "../lib/site-config.js";
import { selectWebIndexableCatalog } from "../lib/catalog.js";
import { getLiveContentCatalog } from "../lib/live-catalog.js";
import { renderRssFeed } from "../lib/rss.js";

export const GET: APIRoute = async () => {
  const catalog = selectWebIndexableCatalog(await getLiveContentCatalog());
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
