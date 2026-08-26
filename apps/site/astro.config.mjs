import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://xpotato.jp",
  output: "static",
  integrations: [
    mdx(),
    react(),
    sitemap({ filter: (page) => page !== "https://xpotato.jp/search/" }),
  ],
  vite: { plugins: [tailwindcss()] },
});
