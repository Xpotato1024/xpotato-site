import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { siteConfig } from "./src/lib/site-config.ts";
import { collectSitemapExcludedUrls } from "./src/lib/sitemap.ts";

export const astroCanonicalOrigin = siteConfig.site.canonicalOrigin;
const sitemapExcludedUrls = await collectSitemapExcludedUrls({
  contentRoot: new URL("./src/content/", import.meta.url),
  canonicalOrigin: astroCanonicalOrigin,
  searchPath: siteConfig.discovery.searchPath,
});

export default defineConfig({
  site: astroCanonicalOrigin,
  output: "static",
  integrations: [
    mdx(),
    react(),
    sitemap({ filter: (page) => !sitemapExcludedUrls.has(page) }),
  ],
  vite: { plugins: [tailwindcss()] },
});
