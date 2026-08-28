import type { APIRoute } from "astro";
import { siteConfig } from "../lib/site-config.js";

export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\nSitemap: ${siteConfig.site.canonicalOrigin}sitemap-index.xml\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
