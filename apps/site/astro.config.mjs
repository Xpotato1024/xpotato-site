import { rehypeTableAlignment } from "./src/shared/blocks/transforms/table-alignment.mjs";
import { codeBlockTransformer } from "./src/shared/blocks/transforms/code-block-transformer.mjs";
import { remarkMathBlocks } from "./src/shared/blocks/transforms/math-blocks.mjs";
import { rehypeFootnoteBacklinks } from "./src/shared/blocks/transforms/footnote-backlinks.mjs";
import { homeWorkshopIntegration } from "../../ops/build/home-workshop/home-workshop-build.ts";
import { routeFontIntegration } from "./src/shared/lib/font-subsets.mjs";
import mdx from "@astrojs/mdx";
import { unified } from "@astrojs/markdown-remark";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { siteConfig } from "./src/shared/lib/site-config.ts";
import { readSiteRevision } from "../../ops/build/site-revision.ts";
import {
  collectSitemapExcludedUrls,
  isArchiveSitemapEligible,
} from "./src/features/discovery/model/sitemap.ts";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { redirectArtifact, currentApplicationRedirects } from "../../content/registry/redirects.ts";
import { readSiteContent } from "../../packages/site-validators/src/site-content.ts";

import { assertNoPrivateCandidateEnvironment } from "@xpotato/portable-content/private-output";
assertNoPrivateCandidateEnvironment(process.env);

export const astroCanonicalOrigin = siteConfig.site.canonicalOrigin;
const sitemapExcludedUrls = await collectSitemapExcludedUrls({
  contentRoot: new URL("../../content/", import.meta.url),
  canonicalOrigin: astroCanonicalOrigin,
  searchPath: siteConfig.discovery.searchPath,
});

export default defineConfig({
  site: astroCanonicalOrigin,
  output: "static",
  markdown: {
    processor: unified({ rehypePlugins: [rehypeFootnoteBacklinks, rehypeTableAlignment] }),
    shikiConfig: { theme: "github-dark", transformers: [codeBlockTransformer] },
  },
  integrations: [
    routeFontIntegration(),
    homeWorkshopIntegration(),
    {
      name: "application-path-redirect-artifact",
      hooks: {
        "astro:build:done": async ({ dir }) => {
          await writeFile(
            new URL("_redirects", dir),
            redirectArtifact(currentApplicationRedirects((await readSiteContent()).catalog)),
            "utf8",
          );
        },
      },
    },
    mdx({
      processor: unified({
        remarkPlugins: [remarkMathBlocks],
        rehypePlugins: [rehypeFootnoteBacklinks, rehypeTableAlignment],
      }),
    }),
    react(),
    sitemap({ filter: (page) => !sitemapExcludedUrls.has(page) && isArchiveSitemapEligible(page) }),
  ],
  vite: {
    build: {
      assetsInlineLimit: (filePath) =>
        ["ProjectCarousel.astro", "UpdateActivity.astro"].some((name) => filePath.includes(name))
          ? false
          : undefined,
    },
    plugins: [tailwindcss()],
    define: {
      __SITE_REVISION__: JSON.stringify(
        readSiteRevision(fileURLToPath(new URL("../../", import.meta.url))),
      ),
      __COPYRIGHT_YEAR__: JSON.stringify(new Date().getUTCFullYear()),
    },
  },
});
