import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { discoveryProfile } from "../content-registry/discovery.js";
import { siteConfig } from "../lib/site-config.js";

const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export const GET: APIRoute = async () => {
  const items = (await getCollection("blog", ({ data }) => !data.draft && data.seo?.noindex !== true))
    .sort((left, right) => right.data.pubDate.localeCompare(left.data.pubDate))
    .slice(0, discoveryProfile.feed.maxItems)
    .map((entry) => {
      const url = new URL(`/blog/${entry.id}/`, siteConfig.site.canonicalOrigin).href;
      return `<item><guid isPermaLink="false">${siteConfig.site.canonicalOrigin}#${entry.data.id}</guid><title>${escape(entry.data.title)}</title><description>${escape(entry.data.description)}</description><link>${url}</link><pubDate>${new Date(`${entry.data.pubDate}T00:00:00+09:00`).toUTCString()}</pubDate></item>`;
    });
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escape(siteConfig.site.name)}</title><link>${siteConfig.site.canonicalOrigin}</link><description>${escape(siteConfig.site.defaultDescription)}</description>${items.join("")}</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
};
