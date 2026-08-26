import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { siteConfig } from "./src/lib/site-config.ts";

export const astroCanonicalOrigin = siteConfig.site.canonicalOrigin;

export default defineConfig({
  site: astroCanonicalOrigin,
  output: "static",
  integrations: [
    mdx(),
    react(),
    sitemap({ filter: (page) => page !== new URL(siteConfig.discovery.searchPath, astroCanonicalOrigin).href }),
  ],
  vite: { plugins: [tailwindcss()] },
});
