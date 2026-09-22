import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { siteConfig } from "./src/lib/site-config.ts";
import { collectSitemapExcludedUrls, isArchiveSitemapEligible } from "./src/lib/sitemap.ts";
import { isAbsolute, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { redirectArtifact } from "./src/content-registry/redirects.ts";

const previewOutput = process.env.XPOTATO_PHASE8_PREVIEW_OUTPUT;
if (previewOutput) {
  const withinTemp = relative(resolve(process.env.RUNNER_TEMP ?? tmpdir()), resolve(previewOutput));
  if (!isAbsolute(previewOutput) || withinTemp.startsWith("..") || isAbsolute(withinTemp) || !withinTemp) {
    throw new Error("Phase 8 fixture output must be an absolute child of the system temporary directory");
  }
}

export const astroCanonicalOrigin = siteConfig.site.canonicalOrigin;
const sitemapExcludedUrls = await collectSitemapExcludedUrls({
  contentRoot: new URL("./src/content/", import.meta.url),
  canonicalOrigin: astroCanonicalOrigin,
  searchPath: siteConfig.discovery.searchPath,
});

export default defineConfig({
  site: astroCanonicalOrigin,
  output: "static",
  ...(previewOutput ? { outDir: previewOutput } : {}),
  integrations: [
    {
      name: "application-path-redirect-artifact",
      hooks: { "astro:build:done": async ({ dir }) => {
        await writeFile(new URL("_redirects", dir), redirectArtifact(), "utf8");
      } },
    },
    ...(previewOutput ? [{
      name: "phase8-private-held-blog-fixture",
      hooks: { "astro:config:setup": ({ injectRoute }) => injectRoute({
        pattern: "/__phase8_fixture/blog-detail/",
        entrypoint: fileURLToPath(new URL("../../tests/fixtures/phase8/blog-detail.astro", import.meta.url)),
        prerender: true,
      }) },
    }] : []),
    mdx(),
    react(),
    sitemap({ filter: (page) => !sitemapExcludedUrls.has(page) && isArchiveSitemapEligible(page) && !new URL(page).pathname.startsWith("/__phase8_fixture/") }),
  ],
  vite: { plugins: [tailwindcss()] },
});
